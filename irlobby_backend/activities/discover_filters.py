"""Discover list filters for church gatherings.

Mobile contract for ``GET /api/activities/`` (all params optional):

* ``audience`` — ``everyone`` | ``men`` | ``women``. Exact match on
  ``Activity.audience_gender``. Omit, or an unknown value, to skip the filter.
* ``ages`` — ``all`` | ``kids_family`` | ``youth`` | ``adults``. See the overlap
  rule below. ``all`` and an omitted or unknown value apply no age filter.
* ``type`` — stable slug (table below). Exact match on the Design label stored
  in ``Activity.category``. The same slug or label may be sent as ``category``.
  Any other ``category`` value keeps the older substring match so legacy rows
  (Sports & Fitness, Social, and the rest) can still be searched. Those legacy
  categories do not match a ``type`` slug until the row is recategorized.

Host create stores the Design label, not the slug. Prayer requests are a
separate ``/api/prayers/`` feed and are not part of this queryset.

Age overlap rule
----------------
Each bucket is an inclusive age range:

* ``kids_family`` — 0 through 12
* ``youth`` — 13 through 17
* ``adults`` — 18 and older, with no upper bound

A gathering window is ``[age_min, age_max]``. A null ``age_min`` means no lower
bound; a null ``age_max`` means no upper bound. The gathering matches a bucket
when the two ranges share at least one age (each range starts at or before the
other ends).

Open-age gatherings are the rows where **both** ``age_min`` and ``age_max`` are
null. They match ``ages=all`` and a request that omits ``ages`` only. They do
not match ``kids_family``, ``youth``, or ``adults``. A window with only one
bound is not open-age: ``age_min=5`` and ``age_max`` null (5+) overlaps every
bucket, and ``age_min`` null with ``age_max=8`` overlaps kids only.
"""

from __future__ import annotations

from django.db.models import Q, QuerySet

# Slug -> Design label stored on Activity.category by host create.
GATHERING_TYPES: tuple[tuple[str, str], ...] = (
    ("worship_service", "Worship & service"),
    ("fellowship_meals", "Fellowship & meals"),
    ("kids_family", "Kids & family"),
    ("youth", "Youth"),
    ("small_groups", "Small groups"),
    ("music", "Music"),
    ("outreach", "Outreach"),
    ("other", "Other"),
)

GATHERING_TYPE_BY_SLUG: dict[str, str] = dict(GATHERING_TYPES)
GATHERING_TYPE_LABELS: frozenset[str] = frozenset(label for _, label in GATHERING_TYPES)

AUDIENCE_VALUES: frozenset[str] = frozenset({"everyone", "men", "women"})

# Inclusive bounds. None upper bound means 18+ with no max.
AGE_BUCKETS: dict[str, tuple[int, int | None]] = {
    "kids_family": (0, 12),
    "youth": (13, 17),
    "adults": (18, None),
}
AGES_ALL = "all"


def canonical_gathering_category(value: str) -> str | None:
    """Map a type slug or Design label to the stored category string."""
    text = value.strip()
    label = GATHERING_TYPE_BY_SLUG.get(text)
    if label:
        return label
    if text in GATHERING_TYPE_LABELS:
        return text
    return None


def age_overlap_q(bucket_min: int, bucket_max: int | None) -> Q:
    """Gatherings whose age window overlaps ``[bucket_min, bucket_max]``.

    Open-age rows (both bounds null) are excluded. See the module docstring
    for the overlap rule and the open-age exception.
    """
    open_age = Q(age_min__isnull=True, age_max__isnull=True)
    if bucket_max is None:
        # Adults, 18+: the window reaches 18 when it has no max, or its max
        # is at least 18. A missing min does not include 18 when the max
        # stops earlier (for example, ages 12 and under).
        reaches_adults = Q(age_max__isnull=True) | Q(age_max__gte=bucket_min)
        return reaches_adults & ~open_age

    # [age_min, age_max] overlaps [bucket_min, bucket_max] when the gathering
    # starts at or before the bucket ends AND ends at or after the bucket starts.
    starts_before_bucket_ends = Q(age_min__isnull=True) | Q(age_min__lte=bucket_max)
    ends_after_bucket_starts = Q(age_max__isnull=True) | Q(age_max__gte=bucket_min)
    return starts_before_bucket_ends & ends_after_bucket_starts & ~open_age


def apply_discover_gathering_filters(queryset: QuerySet, params) -> QuerySet:
    """Apply audience, ages, and type/category. Other query params are untouched."""
    audience = (params.get("audience") or "").strip()
    if audience in AUDIENCE_VALUES:
        queryset = queryset.filter(audience_gender=audience)

    ages = (params.get("ages") or "").strip()
    # ``all``, omitted, and unknown values do not filter. Open-age rows stay
    # in that unfiltered set and are left out of the three buckets above.
    bucket = AGE_BUCKETS.get(ages)
    if bucket is not None:
        queryset = queryset.filter(age_overlap_q(bucket[0], bucket[1]))

    gathering_type = (params.get("type") or "").strip()
    type_label = canonical_gathering_category(gathering_type) if gathering_type else None
    if type_label:
        queryset = queryset.filter(category=type_label)

    category = (params.get("category") or "").strip()
    if category:
        category_label = canonical_gathering_category(category)
        if category_label:
            queryset = queryset.filter(category=category_label)
        else:
            # Legacy dating/marketplace categories: substring match, unchanged.
            queryset = queryset.filter(category__icontains=category)

    return queryset
