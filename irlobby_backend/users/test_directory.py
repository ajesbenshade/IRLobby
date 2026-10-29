"""Church Directory list: Franconia adults, and opted-in household children."""

from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from activities.eligibility import ny_today
from activities.models import FRANCONIA_CHURCH_NAME, Church, HouseholdDependent
from activities.test_foyer import _safe_birthdate
from moderation.models import BlockedUser
from users.directory import household_children_for
from users.models import Friendship, User

ROW_KEYS = {"id", "first_name", "last_initial", "avatar_url", "household_children"}
CHILD_KEYS = {"id", "first_name", "birth_month", "birth_day"}
DIRECTORY_URL = reverse("directory-list")


def make(name, first, church, last="Smith", age=40, **extra):
    dob = extra.pop("date_of_birth", _safe_birthdate(age) if age is not None else None)
    email = extra.pop("email", f"{name}@example.com")
    return User.objects.create_user(
        username=name,
        email=email,
        password="Passw0rd-123",
        first_name=first,
        last_name=last,
        date_of_birth=dob,
        church=church,
        **extra,
    )


class DirectoryApiTests(APITestCase):
    def setUp(self):
        self.franconia = Church.objects.get(name=FRANCONIA_CHURCH_NAME)
        self.souderton = Church.objects.get(name="Souderton Mennonite Church")
        self.viewer = make(
            "viewer",
            "Vera",
            self.franconia,
            last="Adams",
            profile_visibility="only_me",
            avatar_url="https://cdn.example/vera.png",
        )

    def listed(self, user=None, **params):
        self.client.force_authenticate(user or self.viewer)
        response = self.client.get(DIRECTORY_URL, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response

    def ids(self, user=None, **params):
        return [row["id"] for row in self.listed(user, **params).data["results"]]

    def test_unauthenticated_is_401(self):
        response = self.client.get(DIRECTORY_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_franconia_viewers_get_an_empty_page(self):
        make("maria", "Maria", self.franconia, profile_visibility="church")
        souderton = make("soud", "Sam", self.souderton, profile_visibility="church")
        unchurched = make("none", "Pat", None, profile_visibility="church")
        short = Church.objects.create(name="Franconia")
        almost = make("almost", "Al", short, profile_visibility="church")
        for viewer in (souderton, unchurched, almost):
            page = self.listed(viewer)
            self.assertEqual(page.data["count"], 0)
            self.assertEqual(page.data["results"], [])
            self.assertIsNone(page.data["next"])
            self.assertIsNone(page.data["previous"])

    def test_friend_outside_franconia_still_sees_an_empty_page(self):
        maria = make("maria", "Maria", self.franconia, profile_visibility="church")
        friend = make("pal", "Pat", self.souderton, profile_visibility="church")
        Friendship.objects.create(requester=friend, recipient=maria, status="accepted")
        self.assertEqual(self.ids(friend), [])

    def test_church_visibility_is_listed_and_other_levels_are_not(self):
        listed = make(
            "maria",
            "Maria",
            self.franconia,
            profile_visibility="church",
            avatar_url="https://cdn.example/maria.png",
            email="leak-maria@example.com",
            location="Secret City",
            phone="+12155550199",
        )
        only = make("only", "Olivia", self.franconia, profile_visibility="only_me")
        only.show_household_in_directory = True
        only.save(update_fields=["show_household_in_directory"])
        HouseholdDependent.objects.create(
            parent=only,
            name="Hiddenkid",
            relationship="child",
            date_of_birth=date(2015, 1, 1),
        )
        make("fr", "Frank", self.franconia, profile_visibility="friends")
        make("pub", "Paula", self.franconia, profile_visibility="public")
        make("gone", "Gina", self.franconia, profile_visibility="church", is_active=False)
        make("other", "Oscar", self.souderton, profile_visibility="church")
        page = self.listed()
        self.assertEqual(self.ids(), [listed.id])
        row = page.data["results"][0]
        self.assertEqual(set(row), ROW_KEYS)
        self.assertEqual(row["first_name"], "Maria")
        self.assertEqual(row["last_initial"], "S")
        self.assertEqual(row["avatar_url"], "https://cdn.example/maria.png")
        self.assertEqual(row["household_children"], [])
        body = str(page.content)
        for leak in (
            "leak-maria@example.com",
            "Secret City",
            "+12155550199",
            "Olivia",
            "Frank",
            "Hiddenkid",
        ):
            self.assertNotIn(leak, body)

    def test_viewer_with_church_visibility_is_included(self):
        self.viewer.profile_visibility = "church"
        self.viewer.save(update_fields=["profile_visibility"])
        self.assertEqual(self.ids(), [self.viewer.id])

    def test_under_18_accounts_are_excluded_and_18_is_included(self):
        adult = make("adult", "Ada", self.franconia, age=18, profile_visibility="church")
        make("teen", "Tina", self.franconia, age=17, profile_visibility="church")
        make("child", "Cora", self.franconia, age=13, profile_visibility="church")
        today = ny_today()
        tomorrow = today + timedelta(days=1)
        try:
            turns_18_tomorrow = date(tomorrow.year - 18, tomorrow.month, tomorrow.day)
        except ValueError:
            turns_18_tomorrow = None
        if turns_18_tomorrow is not None:
            make(
                "soon",
                "Soon",
                self.franconia,
                date_of_birth=turns_18_tomorrow,
                profile_visibility="church",
            )
        no_dob = make(
            "nodob",
            "Nora",
            self.franconia,
            age=None,
            profile_visibility="church",
        )
        self.assertIsNone(no_dob.date_of_birth)
        self.assertEqual(self.ids(), [adult.id, no_dob.id])

    def test_feb29_birthday_uses_the_same_age_rules_as_the_rest_of_the_app(self):
        parent = make(
            "parent",
            "Paul",
            self.franconia,
            date_of_birth=date(1980, 1, 15),
            profile_visibility="only_me",
        )
        leap_child_user = make(
            "leap",
            "Leap",
            self.franconia,
            date_of_birth=date(2008, 2, 29),
            profile_visibility="church",
        )
        day_before = make(
            "before",
            "Bea",
            self.franconia,
            date_of_birth=date(2008, 2, 28),
            profile_visibility="church",
        )
        day_after = make(
            "after",
            "Ann",
            self.franconia,
            date_of_birth=date(2008, 3, 2),
            profile_visibility="church",
        )
        HouseholdDependent.objects.create(
            parent=parent,
            name="Pippa",
            relationship="child",
            date_of_birth=date(2008, 2, 29),
        )
        parent.show_household_in_directory = True
        parent.profile_visibility = "church"
        parent.save(update_fields=["show_household_in_directory", "profile_visibility"])

        with patch("users.directory.ny_today", return_value=date(2026, 2, 28)):
            page = self.listed(parent)
        by_id = {row["id"]: row for row in page.data["results"]}
        self.assertIn(day_before.id, by_id)
        self.assertNotIn(leap_child_user.id, by_id)
        self.assertNotIn(day_after.id, by_id)
        children = by_id[parent.id]["household_children"]
        self.assertEqual(len(children), 1)
        self.assertEqual(
            children[0],
            {
                "id": children[0]["id"],
                "first_name": "Pippa",
                "birth_month": 2,
                "birth_day": 29,
            },
        )
        self.assertEqual(set(children[0]), CHILD_KEYS)

        with patch("users.directory.ny_today", return_value=date(2026, 3, 1)):
            page = self.listed(parent)
        by_id = {row["id"]: row for row in page.data["results"]}
        self.assertIn(leap_child_user.id, by_id)
        self.assertIn(day_before.id, by_id)
        self.assertNotIn(day_after.id, by_id)
        self.assertEqual(by_id[parent.id]["household_children"], [])

    def test_blocked_either_way_is_excluded(self):
        left = make("left", "Liam", self.franconia, profile_visibility="church")
        right = make("right", "Rita", self.franconia, profile_visibility="church")
        kept = make("kept", "Kara", self.franconia, profile_visibility="church")
        BlockedUser.objects.create(blocker=self.viewer, blocked=left)
        self.assertNotIn(left.id, self.ids())
        BlockedUser.objects.all().delete()
        BlockedUser.objects.create(blocker=right, blocked=self.viewer)
        found = self.ids()
        self.assertNotIn(right.id, found)
        self.assertIn(kept.id, found)
        self.assertIn(left.id, found)

    def test_search_matches_first_name_and_last_name(self):
        maria = make("maria", "Maria", self.franconia, last="Smith", profile_visibility="church")
        quinn = make("quinn", "Bob", self.franconia, last="Quinn", profile_visibility="church")
        self.assertEqual(self.ids(q="maria"), [maria.id])
        self.assertEqual(self.ids(q="MARIA"), [maria.id])
        self.assertEqual(self.ids(q="smi"), [maria.id])
        self.assertEqual(self.ids(q="q"), [quinn.id])
        self.assertEqual(self.ids(q=""), [quinn.id, maria.id])
        self.assertEqual(self.ids(q="   "), [quinn.id, maria.id])
        self.assertEqual(self.ids(q="leak-maria"), [])

    def test_sorted_by_first_name_then_last_name_then_id(self):
        zoe = make("zoe", "Zoe", self.franconia, last="Adams", profile_visibility="church")
        amy_zed = make("amyz", "Amy", self.franconia, last="Zed", profile_visibility="church")
        amy_adams = make("amya", "Amy", self.franconia, last="Adams", profile_visibility="church")
        amy_baker = make("amyb", "amy", self.franconia, last="Baker", profile_visibility="church")
        amy_adams_2 = make(
            "amya2", "Amy", self.franconia, last="Adams", profile_visibility="church"
        )
        self.assertLess(amy_adams.id, amy_adams_2.id)
        self.assertEqual(
            self.ids(),
            [amy_adams.id, amy_adams_2.id, amy_baker.id, amy_zed.id, zoe.id],
        )

    def test_last_initial_is_one_capital_letter_or_blank(self):
        smith = make("s1", "Ann", self.franconia, last="smith", profile_visibility="church")
        blank = make("s2", "Bea", self.franconia, last="", profile_visibility="church")
        spaces = make("s3", "Cy", self.franconia, last="   ", profile_visibility="church")
        accented = make("s4", "Dee", self.franconia, last="élise", profile_visibility="church")
        by_id = {row["id"]: row["last_initial"] for row in self.listed().data["results"]}
        self.assertEqual(by_id[smith.id], "S")
        self.assertEqual(by_id[blank.id], "")
        self.assertEqual(by_id[spaces.id], "")
        self.assertEqual(by_id[accented.id], "É")

    def test_pagination_follows_the_default_page_size(self):
        page_size = settings.REST_FRAMEWORK["PAGE_SIZE"]
        for index in range(page_size + 1):
            make(
                f"p{index:02d}",
                f"Name{index:02d}",
                self.franconia,
                profile_visibility="church",
            )
        first = self.listed()
        self.assertEqual(first.data["count"], page_size + 1)
        self.assertEqual(len(first.data["results"]), page_size)
        self.assertIn("page=2", first.data["next"])
        self.assertIsNone(first.data["previous"])
        self.assertEqual(first.data["results"][0]["first_name"], "Name00")
        second = self.listed(page=2)
        self.assertEqual(len(second.data["results"]), 1)
        self.assertEqual(second.data["results"][0]["first_name"], f"Name{page_size:02d}")
        self.assertIsNone(second.data["next"])
        self.assertIsNotNone(second.data["previous"])

    def test_household_children_follow_the_opt_in_and_hide_the_year(self):
        parent = make(
            "parent",
            "Aaron",
            self.franconia,
            last="Ellis",
            profile_visibility="church",
            email="parent-leak@example.com",
            location="Secret City",
            phone="+12155550123",
        )
        child = HouseholdDependent.objects.create(
            parent=parent,
            name="Pippa Secretlast",
            relationship="child",
            sex="female",
            date_of_birth=date(2015, 3, 4),
        )
        HouseholdDependent.objects.create(
            parent=parent,
            name="Monthonly",
            relationship="child",
            date_of_birth=None,
            birth_month=6,
            birth_year=2011,
        )
        HouseholdDependent.objects.create(parent=parent, name="Alexandria", relationship="spouse")
        HouseholdDependent.objects.create(
            parent=parent,
            name="Grownup",
            relationship="child",
            date_of_birth=_safe_birthdate(30),
        )
        teen_dob = _safe_birthdate(15)
        make(
            "teennoah",
            "Noah",
            self.franconia,
            last="Lee",
            date_of_birth=teen_dob,
            profile_visibility="church",
        )
        HouseholdDependent.objects.create(
            parent=parent, name="Noah", relationship="child", date_of_birth=teen_dob
        )
        HouseholdDependent.objects.create(
            parent=parent, name="   ", relationship="child", date_of_birth=date(2016, 1, 2)
        )

        hidden = self.listed()
        self.assertEqual([row["id"] for row in hidden.data["results"]], [parent.id])
        self.assertEqual(hidden.data["results"][0]["household_children"], [])
        self.assertNotIn("Pippa", str(hidden.content))

        parent.show_household_in_directory = True
        parent.save(update_fields=["show_household_in_directory"])
        shown = self.listed()
        row = shown.data["results"][0]
        self.assertEqual(row["id"], parent.id)
        self.assertEqual(row["first_name"], "Aaron")
        self.assertEqual(len(row["household_children"]), 1)
        payload = row["household_children"][0]
        self.assertEqual(set(payload), CHILD_KEYS)
        self.assertEqual(payload["id"], child.id)
        self.assertEqual(payload["first_name"], "Pippa")
        self.assertEqual(payload["birth_month"], 3)
        self.assertEqual(payload["birth_day"], 4)
        body = str(shown.content)
        self.assertEqual(
            payload,
            {"id": child.id, "first_name": "Pippa", "birth_month": 3, "birth_day": 4},
        )
        for leak in (
            "Secretlast",
            "Monthonly",
            "Alexandria",
            "Grownup",
            "Noah",
            "female",
            "parent-leak@example.com",
            "Secret City",
            "+12155550123",
            "birth_year",
            "date_of_birth",
        ):
            self.assertNotIn(leak, body)

        minor = make("minor", "Mia", self.franconia, age=16, profile_visibility="only_me")
        minor_page = self.listed(minor)
        self.assertEqual(minor_page.data["results"][0]["household_children"], [])
        self.assertNotIn("Pippa", str(minor_page.content))

        ageless = make(
            "ageless",
            "Agnes",
            self.franconia,
            age=None,
            profile_visibility="only_me",
        )
        ageless_page = self.listed(ageless)
        parent_row = next(row for row in ageless_page.data["results"] if row["id"] == parent.id)
        self.assertEqual(parent_row["household_children"], [])
        self.assertNotIn("Pippa", str(ageless_page.content))

    def test_search_does_not_match_a_child_name(self):
        parent = make("parent2", "Maria", self.franconia, profile_visibility="church")
        parent.show_household_in_directory = True
        parent.save(update_fields=["show_household_in_directory"])
        HouseholdDependent.objects.create(
            parent=parent, name="Pippa", relationship="child", date_of_birth=date(2015, 3, 4)
        )
        self.assertEqual(self.ids(q="pippa"), [])
        self.assertEqual(self.ids(q="maria"), [parent.id])

    def test_blocked_parent_hides_their_children(self):
        parent = make("parent3", "Aaron", self.franconia, profile_visibility="church")
        parent.show_household_in_directory = True
        parent.save(update_fields=["show_household_in_directory"])
        HouseholdDependent.objects.create(
            parent=parent, name="Pippa", relationship="child", date_of_birth=date(2015, 4, 5)
        )
        BlockedUser.objects.create(blocker=parent, blocked=self.viewer)
        page = self.listed()
        self.assertEqual(page.data["results"], [])
        self.assertNotIn("Pippa", str(page.content))

    def test_profile_flag_defaults_off_and_is_patchable(self):
        self.client.force_authenticate(self.viewer)
        current = self.client.get(reverse("user-profile"))
        self.assertEqual(current.status_code, status.HTTP_200_OK)
        self.assertIs(current.data["show_household_in_directory"], False)
        turned_on = self.client.patch(
            reverse("user-profile"),
            {"show_household_in_directory": True},
            format="json",
        )
        self.assertEqual(turned_on.status_code, status.HTTP_200_OK)
        self.assertIs(turned_on.data["show_household_in_directory"], True)
        self.viewer.refresh_from_db()
        self.assertTrue(self.viewer.show_household_in_directory)
        turned_off = self.client.patch(
            reverse("user-profile"),
            {"show_household_in_directory": False},
            format="json",
        )
        self.assertIs(turned_off.data["show_household_in_directory"], False)
        status_payload = self.client.get(reverse("auth-status"))
        self.assertIs(status_payload.data["user"]["show_household_in_directory"], False)

    def test_household_helper_loads_children_without_the_list_prefetch(self):
        parent = make("helper", "Hope", self.franconia, profile_visibility="church")
        HouseholdDependent.objects.create(
            parent=parent, name="Pippa", relationship="child", date_of_birth=date(2015, 3, 4)
        )
        self.assertEqual(
            household_children_for(parent),
            [
                {
                    "id": parent.household_dependents.get().id,
                    "first_name": "Pippa",
                    "birth_month": 3,
                    "birth_day": 4,
                }
            ],
        )

    def test_birthday_wish_endpoint_is_not_registered(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post("/api/directory/wishes/", {"child_id": 1}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
