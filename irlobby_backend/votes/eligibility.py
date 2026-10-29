"""Who may use voting.

Circle admin is an existing circle membership with ``is_admin`` (the person who
created the circle starts as that admin). There is no separate ballot role.

``voting_member_attested_at`` is on User (``users/0019``, PR #75). A non-null
timestamp is the gate for seeing, casting, and creating. Age is not checked
again. A null timestamp is not a voting member, including accounts created
before the checkbox (that column is not backfilled).

Age 18 or older in America/New_York is only the fallback when that column is
absent. A missing birth date is not a voting member in that fallback. Household
children are not accounts and have no path on these routes.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model

from activities.eligibility import age_on, ny_today

VOTING_MEMBER_FIELD = "voting_member_attested_at"
NOT_VOTING_MEMBER_CODE = "not_voting_member"
AGE_GATE_DETAIL = "Voting is for adults 18 and older."
ATTESTED_GATE_DETAIL = "Voting is for voting members."


def model_has_voting_member_field() -> bool:
    User = get_user_model()
    return any(field.name == VOTING_MEMBER_FIELD for field in User._meta.local_fields)


def not_voting_member_detail() -> str:
    if model_has_voting_member_field():
        return ATTESTED_GATE_DETAIL
    return AGE_GATE_DETAIL


def is_voting_member(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if model_has_voting_member_field():
        return getattr(user, VOTING_MEMBER_FIELD, None) is not None
    age = age_on(getattr(user, "date_of_birth", None), ny_today())
    return age is not None and age >= 18
