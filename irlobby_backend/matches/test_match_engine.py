from datetime import UTC, datetime, timedelta

import pytest

import matches.match_engine as match_engine
from matches.match_engine import (
    AvailabilityWindow,
    MatchWeights,
    UserMatchProfile,
    configure_match_engine,
    explain_match,
    get_candidates,
    score_pair,
)


def _window(hours_from_now=1, minutes=120):
    start = datetime.now(UTC) + timedelta(hours=hours_from_now)
    return AvailabilityWindow(start_at=start, end_at=start + timedelta(minutes=minutes))


def _profile(user_id, **overrides):
    values = {
        "user_id": user_id,
        "home_lat": 40.7128,
        "home_lng": -74.0060,
        "age": 30,
        "preferred_age_min": 21,
        "preferred_age_max": 45,
        "max_travel_radius_km": 50,
        "ad_hoc_windows": [_window()],
        "interests": {"board_games", "art"},
        "ideal_distance_km_by_interest": {"board_games": 3.0},
        "show_up_rate": 0.95,
        "response_rate": 0.9,
        "has_photos": True,
        "bio_length": 360,
        "verified": True,
    }
    values.update(overrides)
    return UserMatchProfile(**values)


def test_match_weights_normalize_and_reject_zero_total():
    weights = MatchWeights(w_d=2, w_t=2, w_i=0, w_r=0, w_b=0, w_q=0)

    assert weights.w_d == pytest.approx(0.5)
    assert weights.w_t == pytest.approx(0.5)

    with pytest.raises(ValueError, match="positive total weight"):
        MatchWeights(w_d=0, w_t=0, w_i=0, w_r=0, w_b=0, w_q=0)


def test_score_pair_returns_components_and_explanations_for_viable_match():
    configure_match_engine(weights=MatchWeights())
    requester = _profile(1)
    candidate = _profile(
        2,
        home_lat=40.7130,
        home_lng=-74.0058,
        prior_behavioral_ratings={1: "good"},
    )
    requester.prior_behavioral_ratings[2] = "good"

    result = score_pair(requester, candidate)
    reasons = explain_match(requester, candidate)

    assert result.passed_hard_filters is True
    assert result.total_score > 0.75
    assert result.components.distance == pytest.approx(1.0)
    assert result.components.interest > 0
    assert result.components.overlap_minutes > 0
    assert "distance" in result.top_factors
    assert len(reasons) >= 2


@pytest.mark.parametrize(
    ("requester_overrides", "candidate_overrides", "reason"),
    [
        ({"blocked_user_ids": {2}}, {}, "block_or_safety"),
        ({"max_travel_radius_km": 2}, {"home_lat": 41.8781, "home_lng": -87.6298}, "radius"),
        ({"preferred_age_min": 35}, {"age": 30}, "age_preference"),
        ({"ad_hoc_windows": []}, {"ad_hoc_windows": []}, "availability"),
    ],
)
def test_score_pair_reports_hard_filter_failures(requester_overrides, candidate_overrides, reason):
    configure_match_engine(weights=MatchWeights())

    result = score_pair(_profile(1, **requester_overrides), _profile(2, **candidate_overrides))

    assert result.passed_hard_filters is False
    assert result.hard_filter_reason == reason
    assert result.total_score == 0


def test_get_candidates_applies_ranking_boosts_and_observability_hook():
    requester = _profile(1, interests={"board_games"})
    boosted = _profile(
        2,
        interests={"board_games"},
        paid_boost_active=True,
        boost_factor=0.5,
        free_now=True,
    )
    cooled_down = _profile(
        3,
        interests={"art"},
        ignored_by_user_ids={1},
        last_shown_at_by_viewer={1: datetime.now(UTC) - timedelta(hours=1)},
    )
    filtered = _profile(4, blocked_user_ids={1})
    profiles = {1: requester}
    events = []

    configure_match_engine(
        profile_provider=lambda user_id: profiles.get(user_id),
        candidate_provider=lambda user_id, spontaneous=False: [boosted, cooled_down, filtered],
        observability_hook=lambda event_name, payload: events.append((event_name, payload)),
        weights=MatchWeights(observability_top_k=2),
    )

    ranked = get_candidates(1, limit=5, spontaneous=True)

    assert [candidate.user_id for candidate in ranked] == [boosted.user_id, cooled_down.user_id]
    assert ranked[0].rank == 1
    assert ranked[0].score_result.components.boost_multiplier > 1
    assert ranked[1].score_result.components.cooldown_multiplier < 1
    assert ranked[0].reasons
    assert events[0][0] == "match_engine.top_k"
    assert events[0][1]["top_k"][0]["candidate_id"] == boosted.user_id


def test_get_candidates_requires_configured_providers(monkeypatch):
    monkeypatch.setattr(match_engine, "_profile_provider", None)
    monkeypatch.setattr(match_engine, "_candidate_provider", None)
    configure_match_engine(weights=MatchWeights())

    with pytest.raises(RuntimeError, match="provider is not configured"):
        get_candidates(1)
