"""Optional mailing address: save rules, member-profile visibility, directory list omission."""

from django.test import SimpleTestCase
from django.urls import URLPattern, URLResolver, get_resolver, reverse
from rest_framework.test import APITestCase

from activities.models import Church
from users.mailing import (
    POSTAL_ERROR,
    SHOW_INCOMPLETE_ERROR,
    STATE_ERROR,
    normalize_postal,
    normalize_state,
)
from users.models import Friendship, User
from users.test_social import attend_together, card_url, make

STREET = "123 Main St"
APT = "Apt 4"
CITY = "Harleysville"
POSTAL = "19438-1234"
FORMATTED = f"{STREET}\n{APT}\n{CITY}, PA {POSTAL}"
FORMATTED_NO_APT = f"{STREET}\n{CITY}, PA {POSTAL}"

FULL_ADDRESS = {
    "mailing_street": STREET,
    "mailing_street2": APT,
    "mailing_city": CITY,
    "mailing_state": "pa",
    "mailing_postal": "194381234",
    "show_mailing_address": True,
}

FORBIDDEN_KEYS = {
    "mailing_address",
    "mailing_street",
    "mailing_street2",
    "mailing_city",
    "mailing_state",
    "mailing_postal",
    "show_mailing_address",
}


def _directory_list_paths():
    """Concrete URL paths whose route or name mentions a directory list."""
    found = []

    def walk(patterns, prefix):
        for pattern in patterns:
            if isinstance(pattern, URLResolver):
                walk(pattern.url_patterns, prefix + str(pattern.pattern))
                continue
            if not isinstance(pattern, URLPattern):
                continue
            route = prefix + str(pattern.pattern)
            name = pattern.name or ""
            if "directory" not in route.lower() and "directory" not in name.lower():
                continue
            if "<" in route or "(?P" in route:
                continue
            path = "/" + route.lstrip("/")
            found.append(path if path.endswith("/") else path + "/")

    walk(get_resolver().url_patterns, "")
    return found


class MailingNormalizeTests(SimpleTestCase):
    def test_postal_forms(self):
        self.assertEqual(normalize_postal("19438"), "19438")
        self.assertEqual(normalize_postal("19438-1234"), POSTAL)
        self.assertEqual(normalize_postal("194381234"), POSTAL)
        self.assertEqual(normalize_postal("19438 1234"), POSTAL)
        self.assertEqual(normalize_postal("  "), "")
        self.assertEqual(normalize_postal(None), "")
        for bad in ("1943", "19438123", "19438-123", "ABCDE", "19438-12345", "19438-123a"):
            with self.assertRaises(ValueError):
                normalize_postal(bad)

    def test_state_codes(self):
        self.assertEqual(normalize_state("pa"), "PA")
        self.assertEqual(normalize_state(" dc "), "DC")
        self.assertEqual(normalize_state("pr"), "PR")
        self.assertEqual(normalize_state(""), "")
        for bad in ("Pennsylvania", "ZZ", "P", "USA"):
            with self.assertRaises(ValueError):
                normalize_state(bad)


class MailingAddressSaveTests(APITestCase):
    def setUp(self):
        self.me = make("me", location="Account City")
        self.client.force_authenticate(self.me)
        self.url = reverse("user-profile")

    def test_save_normalizes_state_and_zip_without_reusing_account_city(self):
        resp = self.client.patch(self.url, FULL_ADDRESS, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["mailing_street"], STREET)
        self.assertEqual(resp.data["mailing_street2"], APT)
        self.assertEqual(resp.data["mailing_city"], CITY)
        self.assertEqual(resp.data["mailing_state"], "PA")
        self.assertEqual(resp.data["mailing_postal"], POSTAL)
        self.assertTrue(resp.data["show_mailing_address"])
        self.assertEqual(resp.data["location"], "Account City")
        self.assertEqual(resp.data["city"], "Account City")
        self.me.refresh_from_db()
        self.assertEqual(self.me.mailing_city, CITY)
        self.assertEqual(self.me.location, "Account City")

    def test_account_city_does_not_fill_mailing_city(self):
        resp = self.client.patch(self.url, {"location": "Souderton"}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["city"], "Souderton")
        self.assertEqual(resp.data["mailing_city"], "")
        self.assertEqual(resp.data["mailing_state"], "")
        self.assertFalse(resp.data["show_mailing_address"])
        self.me.refresh_from_db()
        self.assertEqual(self.me.mailing_city, "")

    def test_invalid_state_and_zip_are_rejected(self):
        state = self.client.patch(
            self.url, {**FULL_ADDRESS, "mailing_state": "Pennsylvania"}, format="json"
        )
        self.assertEqual(state.status_code, 400)
        self.assertEqual(state.data["mailing_state"], [STATE_ERROR])
        postal = self.client.patch(
            self.url, {**FULL_ADDRESS, "mailing_postal": "1943"}, format="json"
        )
        self.assertEqual(postal.status_code, 400)
        self.assertEqual(postal.data["mailing_postal"], [POSTAL_ERROR])
        self.me.refresh_from_db()
        self.assertEqual(self.me.mailing_street, "")
        self.assertFalse(self.me.show_mailing_address)

    def test_show_true_rejects_incomplete_address_and_apt_is_optional(self):
        for field in ("mailing_street", "mailing_city", "mailing_state", "mailing_postal"):
            resp = self.client.patch(self.url, {**FULL_ADDRESS, field: ""}, format="json")
            self.assertEqual(resp.status_code, 400, field)
            self.assertEqual(resp.data["show_mailing_address"], [SHOW_INCOMPLETE_ERROR])
        self.me.refresh_from_db()
        self.assertFalse(self.me.show_mailing_address)
        self.assertEqual(self.me.mailing_street, "")

        saved = self.client.patch(self.url, {**FULL_ADDRESS, "mailing_street2": ""}, format="json")
        self.assertEqual(saved.status_code, 200, saved.data)
        self.assertIsNone(saved.data["mailing_street2"])
        self.assertTrue(saved.data["show_mailing_address"])
        self.assertEqual(saved.data["mailing_street"], STREET)

    def test_show_off_keeps_the_saved_address(self):
        self.assertEqual(self.client.patch(self.url, FULL_ADDRESS, format="json").status_code, 200)
        resp = self.client.patch(self.url, {"show_mailing_address": False}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertFalse(resp.data["show_mailing_address"])
        self.assertEqual(resp.data["mailing_street"], STREET)
        self.assertEqual(resp.data["mailing_city"], CITY)
        self.assertEqual(resp.data["mailing_state"], "PA")
        self.assertEqual(resp.data["mailing_postal"], POSTAL)
        self.me.refresh_from_db()
        self.assertEqual(self.me.mailing_street, STREET)
        self.assertFalse(self.me.show_mailing_address)

    def test_clearing_a_shown_address_without_turning_show_off_is_rejected(self):
        self.client.patch(self.url, FULL_ADDRESS, format="json")
        resp = self.client.patch(self.url, {"mailing_street": ""}, format="json")
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["show_mailing_address"], [SHOW_INCOMPLETE_ERROR])
        self.me.refresh_from_db()
        self.assertEqual(self.me.mailing_street, STREET)
        self.assertTrue(self.me.show_mailing_address)

    def test_empty_fields_store_no_address(self):
        self.client.patch(self.url, FULL_ADDRESS, format="json")
        resp = self.client.patch(
            self.url,
            {
                "mailing_street": "  ",
                "mailing_street2": "",
                "mailing_city": "",
                "mailing_state": "",
                "mailing_postal": "",
                "show_mailing_address": False,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["mailing_street"], "")
        self.assertIsNone(resp.data["mailing_street2"])
        self.assertEqual(resp.data["mailing_city"], "")
        self.assertEqual(resp.data["mailing_state"], "")
        self.assertEqual(resp.data["mailing_postal"], "")
        self.assertFalse(resp.data["show_mailing_address"])

    def test_hidden_partial_address_can_be_saved(self):
        resp = self.client.patch(
            self.url,
            {"mailing_street": "  <b>9 Oak</b>  ", "show_mailing_address": False},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["mailing_street"], "9 Oak")
        self.assertFalse(resp.data["show_mailing_address"])

    def test_spaced_zip_is_normalized(self):
        resp = self.client.patch(
            self.url, {**FULL_ADDRESS, "mailing_postal": "19438 1234"}, format="json"
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data["mailing_postal"], POSTAL)


class MailingAddressVisibilityTests(APITestCase):
    def setUp(self):
        self.church = Church.objects.create(name="Mailing Address Church")
        self.owner = make(
            "owner",
            church=self.church,
            profile_visibility="public",
            mailing_street=STREET,
            mailing_street2=APT,
            mailing_city=CITY,
            mailing_state="PA",
            mailing_postal=POSTAL,
            show_mailing_address=True,
        )
        self.viewer = make("viewer", church=self.church)
        self.client.force_authenticate(self.viewer)

    def test_member_profile_includes_address_when_opted_in_and_visible(self):
        data = self.client.get(card_url(self.owner)).data
        self.assertEqual(
            data["mailing_address"],
            {
                "street": STREET,
                "street2": APT,
                "city": CITY,
                "state": "PA",
                "postal": POSTAL,
                "formatted": FORMATTED,
            },
        )
        self.assertNotIn("mailing_street", data)

    def test_member_profile_omits_apt_line_when_street2_empty(self):
        User.objects.filter(pk=self.owner.pk).update(mailing_street2=None)
        data = self.client.get(card_url(self.owner)).data
        self.assertIsNone(data["mailing_address"]["street2"])
        self.assertEqual(data["mailing_address"]["formatted"], FORMATTED_NO_APT)

    def test_member_profile_hides_address_when_show_is_off(self):
        User.objects.filter(pk=self.owner.pk).update(show_mailing_address=False)
        data = self.client.get(card_url(self.owner)).data
        self.assertEqual(data["visible"], True)
        self.assertNotIn("mailing_address", data)
        self.assertNotIn(STREET, str(data))
        self.assertNotIn(POSTAL, str(data))

    def test_member_profile_hides_address_when_visibility_fails(self):
        # Same church but only_me: a limited add-friend card is allowed, the address is not.
        User.objects.filter(pk=self.owner.pk).update(profile_visibility="only_me")
        same_church = self.client.get(card_url(self.owner))
        self.assertEqual(same_church.status_code, 200)
        self.assertFalse(same_church.data["visible"])
        self.assertNotIn("mailing_address", same_church.data)
        self.assertNotIn(STREET, str(same_church.data))

        # No shared church and only_me: unreachable, so 404 with no address.
        User.objects.filter(pk=self.viewer.pk).update(church=None)
        self.viewer.refresh_from_db()
        hidden = self.client.get(card_url(self.owner))
        self.assertEqual(hidden.status_code, 404)
        self.assertNotIn(STREET, hidden.content.decode())

        User.objects.filter(pk=self.owner.pk).update(profile_visibility="friends")
        friends_only = self.client.get(card_url(self.owner))
        self.assertEqual(friends_only.status_code, 404)
        self.assertNotIn(STREET, friends_only.content.decode())

        User.objects.filter(pk=self.owner.pk).update(profile_visibility="church")
        attend_together(self.owner, self.viewer)
        limited = self.client.get(card_url(self.owner))
        self.assertEqual(limited.status_code, 200)
        self.assertFalse(limited.data["visible"])
        self.assertNotIn("mailing_address", limited.data)
        self.assertNotIn(STREET, str(limited.data))

    def test_accepted_friend_outside_church_sees_church_level_address(self):
        User.objects.filter(pk=self.owner.pk).update(profile_visibility="church")
        other = Church.objects.create(name="Mailing Other Church")
        User.objects.filter(pk=self.viewer.pk).update(church=other)
        self.viewer.refresh_from_db()
        blocked = self.client.get(card_url(self.owner))
        self.assertEqual(blocked.status_code, 404)
        self.assertNotIn(STREET, blocked.content.decode())
        Friendship.objects.create(requester=self.viewer, recipient=self.owner, status="accepted")
        data = self.client.get(card_url(self.owner)).data
        self.assertEqual(data["mailing_address"]["formatted"], FORMATTED)

    def test_own_card_follows_the_show_flag_while_edit_profile_keeps_the_address(self):
        self.client.force_authenticate(self.owner)
        User.objects.filter(pk=self.owner.pk).update(show_mailing_address=False)
        self.owner.refresh_from_db()
        card = self.client.get(card_url(self.owner)).data
        self.assertNotIn("mailing_address", card)
        profile = self.client.get(reverse("user-profile")).data
        self.assertEqual(profile["mailing_street"], STREET)
        self.assertEqual(profile["mailing_postal"], POSTAL)
        self.assertFalse(profile["show_mailing_address"])

    def test_incomplete_address_is_not_shown_even_if_the_flag_is_on(self):
        User.objects.filter(pk=self.owner.pk).update(mailing_city="")
        data = self.client.get(card_url(self.owner)).data
        self.assertNotIn("mailing_address", data)
        self.assertNotIn(STREET, str(data))

    def test_directory_list_never_includes_address(self):
        """List rows stay avatar / first name / last initial. Detail is the profile card."""
        Friendship.objects.create(requester=self.viewer, recipient=self.owner, status="accepted")
        paths = ["/api/directory/", "/api/directory", reverse("friend-list")]
        paths.extend(_directory_list_paths())
        seen = []
        for path in dict.fromkeys(paths):
            response = self.client.get(path)
            seen.append((path, response.status_code))
            body = response.content.decode()
            self.assertNotIn(STREET, body, path)
            self.assertNotIn(POSTAL, body, path)
            self.assertNotIn("mailing_street", body, path)
            self.assertNotIn("mailing_address", body, path)
            self.assertNotIn("show_mailing_address", body, path)
            if response.status_code == 200 and "application/json" in response["Content-Type"]:
                self._assert_no_mailing_keys(response.json(), path)
        # The profile card is the detail payload and still shows the address.
        detail = self.client.get(card_url(self.owner))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["mailing_address"]["street"], STREET)
        self.assertTrue(seen)

    def _assert_no_mailing_keys(self, value, path):
        if isinstance(value, dict):
            overlap = FORBIDDEN_KEYS & set(value)
            self.assertFalse(overlap, f"{path} leaked {overlap}")
            for key, item in value.items():
                self._assert_no_mailing_keys(item, f"{path}.{key}")
        elif isinstance(value, list):
            for index, item in enumerate(value):
                self._assert_no_mailing_keys(item, f"{path}[{index}]")
        elif isinstance(value, str):
            self.assertNotIn(STREET, value, path)
            self.assertNotIn(POSTAL, value, path)
