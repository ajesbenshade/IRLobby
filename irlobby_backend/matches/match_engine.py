from __future__ import annotations

import logging
import math
from collections import deque
from dataclasses import dataclass, field, fields
from datetime import UTC, datetime, time, timedelta
from typing import Any, Literal, Protocol

logger = logging.getLogger(__name__)


BehavioralState = Literal["none", "good", "bad"]
TimeWindowPreference = Literal["morning", "afternoon", "evening", "late_night"]
GroupSizePreference = Literal["one_to_one", "small_group", "open"]


@dataclass
class WeeklyAvailabilitySlot:
    """A repeating weekly availability block.

    Attributes:
        weekday: Python weekday number where Monday is 0 and Sunday is 6.
        start_minute: Minute offset from midnight in local user time.
        end_minute: Minute offset from midnight in local user time.
            If end_minute <= start_minute, the slot is treated as crossing midnight.
    """

    weekday: int
    start_minute: int
    end_minute: int


@dataclass
class AvailabilityWindow:
    """A concrete datetime range used for overlap calculations."""

    start_at: datetime
    end_at: datetime


@dataclass
class MatchWeights:
    """Runtime-configurable weights and scalar knobs for matching.

    The six `w_*` fields intentionally mirror the v1.0 scoring model and default to:
    distance=0.25, time=0.25, interest=0.25, reliability=0.15,
    behavioral=0.05, profile=0.05.
    """

    w_d: float = 0.25
    w_t: float = 0.25
    w_i: float = 0.25
    w_r: float = 0.15
    w_b: float = 0.05
    w_q: float = 0.05

    d_ideal_default_km: float = 2.0
    distance_alpha: float = -math.log(0.3) / 8.0
    availability_days: int = 7
    target_minutes: int = 60
    near_term_hours: int = 48
    near_term_multiplier: float = 1.25
    reports_penalty_divisor: float = 3.0
    bio_length_target: int = 300

    behavioral_no_history_score: float = 0.8
    low_rating_floor: float = 0.35
    low_rating_dampener: float = 0.6

    cooldown_hours: int = 72
    cooldown_demote_multiplier: float = 0.75
    diversity_tag_streak_limit: int = 2

    max_boost_multiplier: float = 1.3
    boosted_score_cap: float = 1.0
    free_now_window_minutes: int = 120
    free_later_today_minutes: int = 180

    observability_top_k: int = 20

    def __post_init__(self) -> None:
        self.w_d = _clamp01(self.w_d)
        self.w_t = _clamp01(self.w_t)
        self.w_i = _clamp01(self.w_i)
        self.w_r = _clamp01(self.w_r)
        self.w_b = _clamp01(self.w_b)
        self.w_q = _clamp01(self.w_q)
        total = self.w_d + self.w_t + self.w_i + self.w_r + self.w_b + self.w_q
        if total <= 0:
            raise ValueError("MatchWeights must have a positive total weight.")
        if abs(total - 1.0) > 1e-6:
            self.w_d /= total
            self.w_t /= total
            self.w_i /= total
            self.w_r /= total
            self.w_b /= total
            self.w_q /= total

    @classmethod
    def from_settings(cls) -> MatchWeights:
        """Load weights and knobs from Django settings with safe defaults.

        Supported settings names:
        - `MATCH_ENGINE_WEIGHTS`: dict for any dataclass field names.
        - Any individual field as `MATCH_ENGINE_<FIELD_NAME_IN_UPPERCASE>`.
        """

        raw_overrides: dict[str, Any] = {}
        try:
            from django.conf import settings

            dict_overrides = getattr(settings, "MATCH_ENGINE_WEIGHTS", None)
            if isinstance(dict_overrides, dict):
                raw_overrides.update(dict_overrides)
            for field_info in fields(cls):
                field_name = field_info.name
                setting_name = f"MATCH_ENGINE_{field_name.upper()}"
                if hasattr(settings, setting_name):
                    raw_overrides[field_name] = getattr(settings, setting_name)
        except Exception:
            # Keep defaults when Django settings are unavailable in isolated tests.
            pass
        return cls(**raw_overrides)


@dataclass
class UserMatchProfile:
    """Pure profile object consumed by the matching engine.

    This object intentionally avoids direct ORM coupling; callers can build it from
    Django models, cache payloads, or external systems.
    """

    user_id: int

    home_lat: float
    home_lng: float
    current_lat: float | None = None
    current_lng: float | None = None

    age: int | None = None
    preferred_age_min: int | None = None
    preferred_age_max: int | None = None

    max_travel_radius_km: float = 25.0

    weekly_slots: list[WeeklyAvailabilitySlot] = field(default_factory=list)
    ad_hoc_windows: list[AvailabilityWindow] = field(default_factory=list)
    free_now: bool = False
    free_later_today: bool = False

    interests: set[str] = field(default_factory=set)
    ideal_distance_km_by_interest: dict[str, float] = field(default_factory=dict)
    preferred_time_windows: set[TimeWindowPreference] = field(default_factory=set)
    preferred_group_size: GroupSizePreference = "open"

    show_up_rate: float = 0.5
    response_rate: float = 0.5
    reports_count: int = 0
    no_show_flags: int = 0

    has_photos: bool = False
    bio_length: int = 0
    verified: bool = False

    blocked_user_ids: set[int] = field(default_factory=set)
    muted_user_ids: set[int] = field(default_factory=set)

    prior_behavioral_ratings: dict[int, BehavioralState] = field(default_factory=dict)
    safety_rating: float | None = None

    paid_boost_active: bool = False
    boost_factor: float = 0.0

    last_shown_at_by_viewer: dict[int, datetime] = field(default_factory=dict)
    ignored_by_user_ids: set[int] = field(default_factory=set)


@dataclass
class ScoreComponents:
    """Detailed score component values for a pair."""

    distance: float = 0.0
    time: float = 0.0
    interest: float = 0.0
    reliability: float = 0.0
    behavioral: float = 0.0
    profile: float = 0.0

    soft_floor_multiplier: float = 1.0
    cooldown_multiplier: float = 1.0
    boost_multiplier: float = 1.0

    overlap_minutes: float = 0.0
    near_term_overlap_minutes: float = 0.0
    distance_km: float = 0.0
    d_ideal_km: float = 0.0


@dataclass
class ScoreResult:
    """Result of pairwise scoring for two user profiles."""

    user_a_id: int
    user_b_id: int
    passed_hard_filters: bool
    hard_filter_reason: str | None
    total_score: float
    components: ScoreComponents
    top_factors: list[str] = field(default_factory=list)


@dataclass
class RankedCandidate:
    """Final rank artifact returned by `get_candidates` and `rank_candidates`."""

    user_id: int
    score: float
    rank: int
    score_result: ScoreResult
    reasons: list[str] = field(default_factory=list)


class ProfileProvider(Protocol):
    """Provider interface used to load a single profile by user ID."""

    def __call__(self, user_id: int) -> UserMatchProfile | None: ...


class CandidateProvider(Protocol):
    """Provider interface used to load candidate profiles for a requester."""

    def __call__(self, user_id: int, spontaneous: bool = False) -> list[UserMatchProfile]: ...


class ObservabilityHook(Protocol):
    """Optional analytics sink for top-k ranking events."""

    def __call__(self, event_name: str, payload: dict[str, Any]) -> None: ...


_weights: MatchWeights = MatchWeights.from_settings()
_profile_provider: ProfileProvider | None = None
_candidate_provider: CandidateProvider | None = None
_observability_hook: ObservabilityHook | None = None


def configure_match_engine(
    *,
    profile_provider: ProfileProvider | None = None,
    candidate_provider: CandidateProvider | None = None,
    observability_hook: ObservabilityHook | None = None,
    weights: MatchWeights | None = None,
) -> None:
    """Configure runtime providers and optional overrides for the engine.

    This can be called from Django startup code, Celery bootstrap, or tests.
    """

    global _profile_provider
    global _candidate_provider
    global _observability_hook
    global _weights

    if profile_provider is not None:
        _profile_provider = profile_provider
    if candidate_provider is not None:
        _candidate_provider = candidate_provider
    if observability_hook is not None:
        _observability_hook = observability_hook
    if weights is not None:
        _weights = weights


def get_candidates(
    user_id: int,
    limit: int = 20,
    spontaneous: bool = False,
) -> list[RankedCandidate]:
    """Return ranked candidates for a user.

    Args:
        user_id: Requester user ID.
        limit: Max number of candidates returned.
        spontaneous: When true, prioritize "free now" context.

    Returns:
        Ranked candidates sorted by descending score.
    """

    _require_providers()
    assert _candidate_provider is not None
    raw_candidates = _candidate_provider(user_id, spontaneous)
    ranked = rank_candidates(user_id=user_id, candidates=raw_candidates)
    if spontaneous:
        ranked = _apply_spontaneous_mode_boost(ranked)
    return ranked[: max(0, limit)]


def score_pair(user_a: UserMatchProfile, user_b: UserMatchProfile) -> ScoreResult:
    """Score a pair using IRLobby v1.0 formulas and hard filters.

    Hard filters run before scoring in this strict order:
    1) Block / safety, 2) Radius, 3) Age / preference, 4) Availability overlap.

    Score:
        Score = w_d*S_distance + w_t*S_time + w_i*S_interest +
                w_r*S_reliability + w_b*S_behavioral + w_q*S_profile
    """

    hard_reason, overlap_minutes, near_term_overlap = _apply_hard_filters(user_a, user_b)
    components = ScoreComponents()
    if hard_reason is not None:
        return ScoreResult(
            user_a_id=user_a.user_id,
            user_b_id=user_b.user_id,
            passed_hard_filters=False,
            hard_filter_reason=hard_reason,
            total_score=0.0,
            components=components,
            top_factors=[f"Hard filter failed: {hard_reason}"],
        )

    dist_km = _haversine_km(*_effective_location(user_a), *_effective_location(user_b))
    d_ideal = _activity_aware_ideal_distance_km(user_a, user_b, _weights)

    components.distance_km = dist_km
    components.d_ideal_km = d_ideal
    components.overlap_minutes = overlap_minutes
    components.near_term_overlap_minutes = near_term_overlap

    components.distance = _score_distance(
        dist_km=dist_km, d_ideal=d_ideal, alpha=_weights.distance_alpha
    )
    components.time = _score_time(
        overlap_minutes=overlap_minutes,
        near_term_overlap_minutes=near_term_overlap,
        target_minutes=_weights.target_minutes,
        near_term_multiplier=_weights.near_term_multiplier,
    )
    components.interest = _score_interest(user_a, user_b)
    components.reliability = _score_reliability(user_a, user_b)
    components.behavioral = _score_behavioral(user_a, user_b)
    components.profile = _score_profile_pair(user_a, user_b)

    weighted_total = (
        (_weights.w_d * components.distance)
        + (_weights.w_t * components.time)
        + (_weights.w_i * components.interest)
        + (_weights.w_r * components.reliability)
        + (_weights.w_b * components.behavioral)
        + (_weights.w_q * components.profile)
    )

    components.soft_floor_multiplier = _soft_low_rating_multiplier(user_a, user_b, _weights)
    total_score = _clamp01(weighted_total * components.soft_floor_multiplier)

    top_factors = _top_factor_labels(components)
    return ScoreResult(
        user_a_id=user_a.user_id,
        user_b_id=user_b.user_id,
        passed_hard_filters=True,
        hard_filter_reason=None,
        total_score=total_score,
        components=components,
        top_factors=top_factors,
    )


def rank_candidates(user_id: int, candidates: list[UserMatchProfile]) -> list[RankedCandidate]:
    """Score and rank candidates for a requester using business-layer rules.

    Steps:
    1) Score candidate pairs.
    2) Drop hard-filter failures.
    3) Apply cooldown demotion and paid boost multipliers.
    4) Sort by score descending.
    5) Apply diversity sequencing to avoid repetitive runs of near-identical profiles.
    """

    _require_profile_provider()
    assert _profile_provider is not None
    requester = _profile_provider(user_id)
    if requester is None:
        logger.warning("match_engine.requester_missing user_id=%s", user_id)
        return []

    now = datetime.now(UTC)
    scored: list[RankedCandidate] = []

    for candidate in candidates:
        if candidate.user_id == requester.user_id:
            continue
        result = score_pair(requester, candidate)
        if not result.passed_hard_filters:
            continue

        final_score = result.total_score
        cooldown_multiplier = _cooldown_multiplier(requester, candidate, now)
        result.components.cooldown_multiplier = cooldown_multiplier
        final_score = _clamp01(final_score * cooldown_multiplier)

        if candidate.paid_boost_active:
            boost_multiplier = min(
                1.0 + max(candidate.boost_factor, 0.0), _weights.max_boost_multiplier
            )
            result.components.boost_multiplier = boost_multiplier
            final_score = min(final_score * boost_multiplier, _weights.boosted_score_cap)

        final_score = _clamp01(final_score)
        result.total_score = final_score

        scored.append(
            RankedCandidate(
                user_id=candidate.user_id,
                score=final_score,
                rank=0,
                score_result=result,
                reasons=explain_match(requester, candidate),
            )
        )

    scored.sort(key=lambda item: (item.score, -item.user_id), reverse=True)
    diversified = _apply_diversity(scored, candidates)
    for idx, item in enumerate(diversified, start=1):
        item.rank = idx

    _emit_top_k_observability(user_id=user_id, ranked=diversified)
    return diversified


def explain_match(user_a: UserMatchProfile, user_b: UserMatchProfile) -> list[str]:
    """Return top 2-3 human-readable reasons for a potential match."""

    scored = score_pair(user_a, user_b)
    if not scored.passed_hard_filters:
        return [f"Not currently matchable: {scored.hard_filter_reason}."]

    c = scored.components
    reasons_by_component: dict[str, str] = {
        "distance": f"You are nearby ({c.distance_km:.1f} km apart).",
        "time": (
            "You both have overlapping availability "
            f"({int(c.overlap_minutes)} min, including {int(c.near_term_overlap_minutes)} min soon)."
        ),
        "interest": _interest_reason(user_a, user_b),
        "reliability": "You both have strong reliability signals (responses and show-ups).",
        "behavioral": _behavioral_reason(user_a, user_b),
        "profile": "Both profiles are complete and trustworthy.",
    }
    ranked_components = sorted(
        [
            ("distance", c.distance),
            ("time", c.time),
            ("interest", c.interest),
            ("reliability", c.reliability),
            ("behavioral", c.behavioral),
            ("profile", c.profile),
        ],
        key=lambda item: item[1],
        reverse=True,
    )

    reasons: list[str] = []
    for component_name, value in ranked_components:
        if value <= 0:
            continue
        reasons.append(reasons_by_component[component_name])
        if len(reasons) == 3:
            break
    if len(reasons) < 2:
        reasons.append("You appear to be a potentially compatible match overall.")
    return reasons[:3]


def _require_providers() -> None:
    _require_profile_provider()
    if _candidate_provider is None:
        raise RuntimeError(
            "match_engine candidate provider is not configured. "
            "Call configure_match_engine(candidate_provider=...) at startup."
        )


def _require_profile_provider() -> None:
    if _profile_provider is None:
        raise RuntimeError(
            "match_engine profile provider is not configured. "
            "Call configure_match_engine(profile_provider=...) at startup."
        )


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _effective_location(user: UserMatchProfile) -> tuple[float, float]:
    """Prefer dynamic location if available, otherwise fallback to home location."""

    if user.current_lat is not None and user.current_lng is not None:
        return user.current_lat, user.current_lng
    return user.home_lat, user.home_lng


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute great-circle distance using the haversine formula."""

    r = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * (math.sin(d_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _score_distance(dist_km: float, d_ideal: float, alpha: float) -> float:
    if dist_km <= d_ideal:
        return 1.0
    return _clamp01(math.exp(-alpha * (dist_km - d_ideal)))


def _score_time(
    overlap_minutes: float,
    near_term_overlap_minutes: float,
    target_minutes: int,
    near_term_multiplier: float,
) -> float:
    base = min(1.0, overlap_minutes / max(target_minutes, 1))
    if near_term_overlap_minutes > 0:
        base *= near_term_multiplier
    return _clamp01(base)


def _score_interest(user_a: UserMatchProfile, user_b: UserMatchProfile) -> float:
    union = user_a.interests | user_b.interests
    if not union:
        return 0.0
    intersection = user_a.interests & user_b.interests
    return _clamp01(len(intersection) / len(union))


def _reports_penalty(reports_count: int, no_show_flags: int) -> float:
    total_flags = max(0, reports_count) + max(0, no_show_flags)
    return _clamp01(total_flags / max(_weights.reports_penalty_divisor, 1.0))


def _user_reliability(user: UserMatchProfile) -> float:
    score = (
        (0.5 * _clamp01(user.show_up_rate))
        + (0.3 * _clamp01(user.response_rate))
        - (0.2 * _reports_penalty(user.reports_count, user.no_show_flags))
    )
    return _clamp01(score)


def _score_reliability(user_a: UserMatchProfile, user_b: UserMatchProfile) -> float:
    return min(_user_reliability(user_a), _user_reliability(user_b))


def _score_behavioral(user_a: UserMatchProfile, user_b: UserMatchProfile) -> float:
    rating_a = user_a.prior_behavioral_ratings.get(user_b.user_id, "none")
    rating_b = user_b.prior_behavioral_ratings.get(user_a.user_id, "none")
    if rating_a == "bad" or rating_b == "bad":
        return 0.0
    if rating_a == "good" and rating_b == "good":
        return 1.0
    return _weights.behavioral_no_history_score


def _normalized_bio_length(bio_length: int) -> float:
    return _clamp01(max(0, bio_length) / max(_weights.bio_length_target, 1))


def _profile_quality(user: UserMatchProfile) -> float:
    return _clamp01(
        (0.4 * (1.0 if user.has_photos else 0.0))
        + (0.3 * _normalized_bio_length(user.bio_length))
        + (0.3 * (1.0 if user.verified else 0.0))
    )


def _score_profile_pair(user_a: UserMatchProfile, user_b: UserMatchProfile) -> float:
    # Pair quality is conservative to avoid overranking if one profile is incomplete.
    return min(_profile_quality(user_a), _profile_quality(user_b))


def _activity_aware_ideal_distance_km(
    user_a: UserMatchProfile,
    user_b: UserMatchProfile,
    weights: MatchWeights,
) -> float:
    overlap = user_a.interests & user_b.interests
    if not overlap:
        return weights.d_ideal_default_km
    values: list[float] = []
    for interest in overlap:
        a_val = user_a.ideal_distance_km_by_interest.get(interest)
        b_val = user_b.ideal_distance_km_by_interest.get(interest)
        if a_val is not None:
            values.append(float(a_val))
        if b_val is not None:
            values.append(float(b_val))
    if not values:
        return weights.d_ideal_default_km
    return max(0.1, sum(values) / len(values))


def _expand_availability(
    profile: UserMatchProfile,
    *,
    now: datetime,
    horizon_end: datetime,
) -> list[AvailabilityWindow]:
    """Expand repeating and ad-hoc availability into concrete windows.

    This implementation keeps overlap checks simple and readable; if candidate volumes
    grow substantially, pre-computing and caching interval lists in Redis is preferred.
    """

    windows: list[AvailabilityWindow] = []
    now = now.astimezone(UTC)
    horizon_end = horizon_end.astimezone(UTC)

    current_date = now.date()
    num_days = (horizon_end.date() - current_date).days + 1
    for day_offset in range(max(0, num_days)):
        day = current_date + timedelta(days=day_offset)
        weekday = day.weekday()
        for slot in profile.weekly_slots:
            if slot.weekday != weekday:
                continue
            start_dt = datetime.combine(day, time.min, tzinfo=UTC) + timedelta(
                minutes=slot.start_minute
            )
            end_dt = datetime.combine(day, time.min, tzinfo=UTC) + timedelta(
                minutes=slot.end_minute
            )
            if slot.end_minute <= slot.start_minute:
                end_dt += timedelta(days=1)
            windows.append(AvailabilityWindow(start_at=start_dt, end_at=end_dt))

    for window in profile.ad_hoc_windows:
        if window.end_at <= now or window.start_at >= horizon_end:
            continue
        windows.append(
            AvailabilityWindow(
                start_at=max(window.start_at.astimezone(UTC), now),
                end_at=min(window.end_at.astimezone(UTC), horizon_end),
            )
        )

    if profile.free_now:
        windows.append(
            AvailabilityWindow(
                start_at=now,
                end_at=min(horizon_end, now + timedelta(minutes=_weights.free_now_window_minutes)),
            )
        )

    if profile.free_later_today:
        later_start = now + timedelta(hours=2)
        day_end = datetime.combine(now.date(), time.max, tzinfo=UTC)
        later_end = min(day_end, later_start + timedelta(minutes=_weights.free_later_today_minutes))
        if later_start < later_end:
            windows.append(AvailabilityWindow(start_at=later_start, end_at=later_end))

    return _merge_windows(windows)


def _merge_windows(windows: list[AvailabilityWindow]) -> list[AvailabilityWindow]:
    if not windows:
        return []
    sorted_windows = sorted(windows, key=lambda w: w.start_at)
    merged: list[AvailabilityWindow] = [sorted_windows[0]]
    for current in sorted_windows[1:]:
        last = merged[-1]
        if current.start_at <= last.end_at:
            merged[-1] = AvailabilityWindow(
                start_at=last.start_at, end_at=max(last.end_at, current.end_at)
            )
        else:
            merged.append(current)
    return merged


def _overlap_totals(
    windows_a: list[AvailabilityWindow],
    windows_b: list[AvailabilityWindow],
    *,
    now: datetime,
    near_term_hours: int,
) -> tuple[float, float]:
    total_minutes = 0.0
    near_term_minutes = 0.0
    near_term_end = now + timedelta(hours=near_term_hours)

    # Two-pointer merge gives linear overlap time after sorting/merging.
    i = 0
    j = 0
    while i < len(windows_a) and j < len(windows_b):
        a = windows_a[i]
        b = windows_b[j]
        start = max(a.start_at, b.start_at)
        end = min(a.end_at, b.end_at)
        if start < end:
            minutes = (end - start).total_seconds() / 60.0
            total_minutes += minutes

            near_start = max(start, now)
            near_end = min(end, near_term_end)
            if near_start < near_end:
                near_term_minutes += (near_end - near_start).total_seconds() / 60.0

        if a.end_at <= b.end_at:
            i += 1
        else:
            j += 1

    return total_minutes, near_term_minutes


def _apply_hard_filters(
    user_a: UserMatchProfile,
    user_b: UserMatchProfile,
) -> tuple[str | None, float, float]:
    """Apply required hard filters in the exact spec order."""

    # 1) Block / safety filter
    if (
        user_b.user_id in user_a.blocked_user_ids
        or user_a.user_id in user_b.blocked_user_ids
        or user_b.user_id in user_a.muted_user_ids
        or user_a.user_id in user_b.muted_user_ids
    ):
        return "block_or_safety", 0.0, 0.0

    # 2) Radius filter
    dist_km = _haversine_km(*_effective_location(user_a), *_effective_location(user_b))
    if dist_km > min(user_a.max_travel_radius_km, user_b.max_travel_radius_km):
        return "radius", 0.0, 0.0

    # 3) Age / preference filter
    if not _passes_age_preference(user_a, user_b):
        return "age_preference", 0.0, 0.0

    # 4) Availability overlap in next N days
    now = datetime.now(UTC)
    horizon_end = now + timedelta(days=_weights.availability_days)
    windows_a = _expand_availability(user_a, now=now, horizon_end=horizon_end)
    windows_b = _expand_availability(user_b, now=now, horizon_end=horizon_end)
    overlap_minutes, near_term_overlap = _overlap_totals(
        windows_a,
        windows_b,
        now=now,
        near_term_hours=_weights.near_term_hours,
    )
    if overlap_minutes <= 0:
        return "availability", 0.0, 0.0

    return None, overlap_minutes, near_term_overlap


def _passes_age_preference(user_a: UserMatchProfile, user_b: UserMatchProfile) -> bool:
    if user_a.age is None or user_b.age is None:
        return True
    if user_a.preferred_age_min is not None and user_b.age < user_a.preferred_age_min:
        return False
    if user_a.preferred_age_max is not None and user_b.age > user_a.preferred_age_max:
        return False
    if user_b.preferred_age_min is not None and user_a.age < user_b.preferred_age_min:
        return False
    if user_b.preferred_age_max is not None and user_a.age > user_b.preferred_age_max:
        return False
    return True


def _soft_low_rating_multiplier(
    user_a: UserMatchProfile,
    user_b: UserMatchProfile,
    weights: MatchWeights,
) -> float:
    """Apply a soft floor after hard filters for trust/safety.

    We do not hard-exclude low-rated users here; we dampen the score to keep UX
    flexible while reducing ranking priority.
    """

    ratings = [r for r in [user_a.safety_rating, user_b.safety_rating] if r is not None]
    if not ratings:
        return 1.0
    floor_basis = _clamp01(min(ratings))
    if floor_basis < weights.low_rating_floor:
        return _clamp01(weights.low_rating_dampener)
    return 1.0


def _cooldown_multiplier(
    requester: UserMatchProfile,
    candidate: UserMatchProfile,
    now: datetime,
) -> float:
    if requester.user_id not in candidate.ignored_by_user_ids:
        return 1.0
    last_shown = candidate.last_shown_at_by_viewer.get(requester.user_id)
    if last_shown is None:
        return 1.0
    age_hours = (now - last_shown.astimezone(UTC)).total_seconds() / 3600.0
    if age_hours < _weights.cooldown_hours:
        return _clamp01(_weights.cooldown_demote_multiplier)
    return 1.0


def _apply_diversity(
    ranked: list[RankedCandidate],
    candidates: list[UserMatchProfile],
) -> list[RankedCandidate]:
    if not ranked:
        return ranked

    by_id = {candidate.user_id: candidate for candidate in candidates}
    ready = deque(ranked)
    output: list[RankedCandidate] = []
    deferred: deque[RankedCandidate] = deque()
    last_signature: str | None = None
    signature_streak = 0

    # Greedy pass keeps the ranking stable while reducing repetitive profile runs.
    while ready:
        current = ready.popleft()
        profile = by_id.get(current.user_id)
        signature = _diversity_signature(profile)

        if (
            signature == last_signature
            and signature_streak >= _weights.diversity_tag_streak_limit
            and len(ready) > 0
        ):
            deferred.append(current)
            continue

        output.append(current)
        if signature == last_signature:
            signature_streak += 1
        else:
            last_signature = signature
            signature_streak = 1

        if not ready and deferred:
            ready, deferred = deferred, deque()

    output.extend(deferred)
    return output


def _diversity_signature(profile: UserMatchProfile | None) -> str:
    if profile is None or not profile.interests:
        return "none"
    return sorted(profile.interests)[0]


def _apply_spontaneous_mode_boost(ranked: list[RankedCandidate]) -> list[RankedCandidate]:
    if not ranked:
        return ranked
    boosted = sorted(
        ranked,
        key=lambda item: (
            item.score_result.components.near_term_overlap_minutes > 0,
            item.score_result.components.time,
            item.score,
        ),
        reverse=True,
    )
    for idx, row in enumerate(boosted, start=1):
        row.rank = idx
    return boosted


def _top_factor_labels(components: ScoreComponents) -> list[str]:
    rows = [
        ("distance", components.distance),
        ("time", components.time),
        ("interest", components.interest),
        ("reliability", components.reliability),
        ("behavioral", components.behavioral),
        ("profile", components.profile),
    ]
    rows.sort(key=lambda item: item[1], reverse=True)
    return [name for name, _ in rows[:3]]


def _interest_reason(user_a: UserMatchProfile, user_b: UserMatchProfile) -> str:
    overlap = sorted(user_a.interests & user_b.interests)
    if not overlap:
        return "You have complementary activity interests to explore."
    top = ", ".join(overlap[:3])
    return f"You share activity interests: {top}."


def _behavioral_reason(user_a: UserMatchProfile, user_b: UserMatchProfile) -> str:
    rating_a = user_a.prior_behavioral_ratings.get(user_b.user_id, "none")
    rating_b = user_b.prior_behavioral_ratings.get(user_a.user_id, "none")
    if rating_a == "good" and rating_b == "good":
        return "You both had a positive previous interaction."
    if rating_a == "bad" or rating_b == "bad":
        return "A prior interaction signal was negative, so score is reduced."
    return "No prior interaction history was found, so this is a fresh match."


def _emit_top_k_observability(user_id: int, ranked: list[RankedCandidate]) -> None:
    top = ranked[: _weights.observability_top_k]
    payload = {
        "user_id": user_id,
        "top_k": [
            {
                "candidate_id": row.user_id,
                "score": round(row.score, 4),
                "components": {
                    "distance": round(row.score_result.components.distance, 4),
                    "time": round(row.score_result.components.time, 4),
                    "interest": round(row.score_result.components.interest, 4),
                    "reliability": round(row.score_result.components.reliability, 4),
                    "behavioral": round(row.score_result.components.behavioral, 4),
                    "profile": round(row.score_result.components.profile, 4),
                },
                "top_factors": row.score_result.top_factors,
            }
            for row in top
        ],
    }
    logger.info("match_engine.top_k %s", payload)
    if _observability_hook is not None:
        try:
            _observability_hook("match_engine.top_k", payload)
        except Exception:
            logger.exception("match_engine observability hook failed")


"""
Integration Notes
-----------------
1) Views (DRF):
   - Build `UserMatchProfile` objects from serializers/models and call `get_candidates()`
     for feed endpoints.
   - Use `explain_match()` when returning ranked rows so clients can show concise reasons.

2) Celery tasks:
   - Run periodic refresh jobs that pre-rank candidates in batches (per city/region bucket)
     and cache results for low-latency API reads.

3) Channels consumers:
   - Trigger on presence/free-now updates to recompute nearby suggestions and push events.

4) Redis caching strategy:
   - Cache serialized `UserMatchProfile` payloads by user ID (short TTL, e.g., 5-15 minutes).
   - Cache pre-expanded availability intervals and interest sets to avoid repetitive CPU work.
   - Bucket users by region/city key so candidate provider can cheaply pre-filter pools.
   - Invalidate keys on profile, location, availability, safety, or interaction updates.
"""
