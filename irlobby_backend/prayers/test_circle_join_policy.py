"""Join policy A: request queue, admin approve, invites, and no open join."""

from unittest.mock import patch

from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from activities.models import Church
from moderation.models import AbuseReport, BlockedUser
from prayers.models import CircleInvite, CircleJoinRequest, CircleMembership
from users.models import User


def make_user(name, church=None, first_name=None, last_name="Lee"):
    user = User.objects.create_user(
        username=name,
        email=f"{name}@example.com",
        password="Passw0rd-123",
        first_name=first_name if first_name is not None else name.capitalize(),
        last_name=last_name,
    )
    if church is not None:
        user.church = church
        user.save(update_fields=["church"])
    return user


class CirclePolicyTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.church = Church.objects.create(name="Franconia")
        self.other_church = Church.objects.create(name="Souderton")
        self.admin = make_user("sarah", self.church, first_name="Sarah", last_name="Miller")
        self.anna = make_user("anna", self.church, first_name="Anna", last_name="Lee")
        self.pete = make_user("pete", self.church, first_name="Pete", last_name="King")
        self.outsider = make_user("noah", self.other_church, first_name="Noah")
        self.unchurched = make_user("pat", None, first_name="Pat")
        self.client.force_authenticate(self.admin)
        created = self.client.post(
            reverse("circle-list"),
            {"name": "Young Adults", "description": "  Upper   <b>hall</b>  "},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.circle_id = created.data["id"]
        self.assertEqual(created.data["description"], "Upper hall")
        self.assertTrue(created.data["is_admin"])
        self.assertEqual(created.data["membership_state"], "joined")

    def circle_row(self, user, name="Young Adults"):
        self.client.force_authenticate(user)
        listing = self.client.get(reverse("circle-list"))
        rows = [row for row in listing.data["circles"] if row["name"] == name]
        self.assertEqual(len(rows), 1, listing.data)
        return rows[0]

    def test_create_requires_a_name_and_rejects_a_long_description(self):
        self.client.force_authenticate(self.admin)
        blank = self.client.post(reverse("circle-list"), {"name": "   "}, format="json")
        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        duplicate = self.client.post(
            reverse("circle-list"), {"name": "young adults"}, format="json"
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        long = self.client.post(
            reverse("circle-list"),
            {"name": "Choir", "description": "x" * 281},
            format="json",
        )
        self.assertEqual(long.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("description", long.data)

    def test_directory_search_states_and_church_scope(self):
        self.client.force_authenticate(self.admin)
        self.client.post(reverse("circle-list"), {"name": "Parents"}, format="json")
        found = self.client.get(reverse("circle-list"), {"q": "young"})
        self.assertEqual([row["name"] for row in found.data["circles"]], ["Young Adults"])
        empty = self.client.get(reverse("circle-list"), {"q": "zzz"})
        self.assertEqual(empty.data["circles"], [])

        self.client.force_authenticate(self.outsider)
        self.assertEqual(self.client.get(reverse("circle-list")).data["circles"], [])
        self.assertEqual(
            self.client.get(reverse("circle-detail", args=[self.circle_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.client.force_authenticate(self.unchurched)
        self.assertEqual(
            self.client.post(
                reverse("circle-join-requests", args=[self.circle_id]), format="json"
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_request_approve_makes_a_member_and_unlocks_the_prayer_picker(self):
        self.client.force_authenticate(self.anna)
        asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(asked.status_code, status.HTTP_201_CREATED)
        self.assertEqual(asked.data["status"], "pending")
        again = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["id"], asked.data["id"])

        row = self.circle_row(self.anna)
        self.assertEqual(row["membership_state"], "pending")
        self.assertFalse(row["is_member"])
        self.assertFalse(row["is_admin"])

        blocked = self.client.post(
            reverse("prayer-list"),
            {"title": "Pray for Sunday", "circle_ids": [self.circle_id]},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.anna)
        self.assertEqual(
            self.client.get(reverse("circle-join-requests", args=[self.circle_id])).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.client.force_authenticate(self.admin)
        listing = self.client.get(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(listing.data["requests"][0]["user"]["display_name"], "Anna L.")
        approved = self.client.post(
            reverse("circle-join-request-approve", args=[self.circle_id, asked.data["id"]])
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(approved.data["request"]["status"], "approved")
        self.assertEqual(approved.data["circle"]["member_count"], 2)

        row = self.circle_row(self.anna)
        self.assertEqual(row["membership_state"], "joined")
        self.assertTrue(row["is_member"])
        self.assertFalse(row["is_admin"])
        created = self.client.post(
            reverse("prayer-list"),
            {"title": "Pray for Sunday", "circle_ids": [self.circle_id]},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertFalse(created.data["whole_church"])
        self.assertEqual(created.data["circles"], [{"id": self.circle_id, "name": "Young Adults"}])

        # Approving again is not a second membership.
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post(
                reverse("circle-join-request-approve", args=[self.circle_id, asked.data["id"]])
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_decline_lets_the_person_ask_again(self):
        self.client.force_authenticate(self.anna)
        asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.client.force_authenticate(self.admin)
        declined = self.client.post(
            reverse("circle-join-request-decline", args=[self.circle_id, asked.data["id"]])
        )
        self.assertEqual(declined.status_code, status.HTTP_200_OK)
        self.assertEqual(declined.data["request"]["status"], "declined")
        self.assertEqual(self.circle_row(self.anna)["membership_state"], "none")
        self.client.force_authenticate(self.anna)
        again = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(again.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(again.data["id"], asked.data["id"])

    def test_admin_cannot_approve_someone_who_left_the_church(self):
        self.client.force_authenticate(self.anna)
        asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.anna.church = self.other_church
        self.anna.save(update_fields=["church"])
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("circle-join-request-approve", args=[self.circle_id, asked.data["id"]])
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            CircleMembership.objects.filter(circle_id=self.circle_id, user=self.anna).exists()
        )

    def test_a_block_hides_the_request_from_that_admin_only(self):
        CircleMembership.objects.create(circle_id=self.circle_id, user=self.pete, is_admin=True)
        self.client.force_authenticate(self.anna)
        asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        BlockedUser.objects.create(blocker=self.admin, blocked=self.anna)
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.get(reverse("circle-join-requests", args=[self.circle_id])).data[
                "requests"
            ],
            [],
        )
        self.client.force_authenticate(self.pete)
        listing = self.client.get(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(listing.data["requests"][0]["id"], asked.data["id"])
        approved = self.client.post(
            reverse("circle-join-request-approve", args=[self.circle_id, asked.data["id"]])
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

    def test_invite_accept_skips_the_request_queue(self):
        self.client.force_authenticate(self.anna)
        self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.client.force_authenticate(self.admin)
        sent = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [self.anna.id, self.anna.id, self.pete.id]},
            format="json",
        )
        self.assertEqual(sent.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(sent.data["invites"]), 2)
        self.assertEqual(sent.data["errors"], [])
        self.assertEqual(
            CircleJoinRequest.objects.get(circle_id=self.circle_id, user=self.anna).status,
            CircleJoinRequest.STATUS_CANCELLED,
        )
        self.assertEqual(self.circle_row(self.anna)["membership_state"], "invited")
        self.assertFalse(self.circle_row(self.anna)["is_member"])

        self.client.force_authenticate(self.anna)
        asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(asked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Accept it to join", asked.data["detail"])

        inbox = self.client.get(reverse("circle-invite-inbox"))
        self.assertEqual(len(inbox.data["invites"]), 1)
        invite = inbox.data["invites"][0]
        self.assertEqual(invite["circle"]["name"], "Young Adults")
        self.assertEqual(invite["inviter"]["display_name"], "Sarah M.")
        accepted = self.client.post(reverse("circle-invite-accept", args=[invite["id"]]))
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(accepted.data["invite"]["status"], "accepted")
        self.assertTrue(accepted.data["circle"]["is_member"])
        self.assertFalse(accepted.data["circle"]["is_admin"])
        self.assertEqual(accepted.data["circle"]["membership_state"], "joined")
        self.assertEqual(self.client.get(reverse("circle-invite-inbox")).data["invites"], [])
        self.assertTrue(
            CircleMembership.objects.filter(
                circle_id=self.circle_id, user=self.anna, is_admin=False
            ).exists()
        )

    def test_decline_ends_the_invite(self):
        self.client.force_authenticate(self.admin)
        sent = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [self.anna.id]},
            format="json",
        )
        invite_id = sent.data["invites"][0]["id"]
        self.client.force_authenticate(self.anna)
        declined = self.client.post(reverse("circle-invite-decline", args=[invite_id]))
        self.assertEqual(declined.status_code, status.HTTP_200_OK)
        self.assertEqual(declined.data["invite"]["status"], "declined")
        self.assertEqual(self.client.get(reverse("circle-invite-inbox")).data["invites"], [])
        self.assertEqual(self.circle_row(self.anna)["membership_state"], "none")
        self.assertEqual(
            self.client.post(reverse("circle-invite-accept", args=[invite_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(asked.status_code, status.HTTP_201_CREATED)

    def test_invites_skip_members_other_churches_blocks_and_self(self):
        CircleMembership.objects.create(circle_id=self.circle_id, user=self.pete)
        BlockedUser.objects.create(blocker=self.anna, blocked=self.admin)
        self.client.force_authenticate(self.admin)
        sent = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [self.admin.id, self.pete.id, self.anna.id, self.outsider.id, 999999]},
            format="json",
        )
        self.assertEqual(sent.status_code, status.HTTP_400_BAD_REQUEST)
        details = {row["user_id"]: row["detail"] for row in sent.data["errors"]}
        self.assertEqual(details[self.admin.id], "You can't invite yourself.")
        self.assertEqual(details[self.pete.id], "Already a member.")
        self.assertEqual(details[self.anna.id], "Not found.")
        self.assertEqual(details[self.outsider.id], "Not found.")
        self.assertEqual(details[999999], "Not found.")
        self.assertFalse(CircleInvite.objects.filter(circle_id=self.circle_id).exists())

    def test_pending_invite_cap_is_fifty(self):
        people = [make_user(f"cap{i}", self.church, first_name=f"Cap{i}") for i in range(50)]
        CircleInvite.objects.bulk_create(
            [
                CircleInvite(circle_id=self.circle_id, inviter=self.admin, invitee=person)
                for person in people
            ]
        )
        self.client.force_authenticate(self.admin)
        extra = make_user("extra", self.church, first_name="Extra")
        blocked = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [extra.id]},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            blocked.data["errors"][0]["detail"], "This circle already has 50 pending invites."
        )
        again = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [people[0].id]},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["invites"][0]["invitee"]["id"], people[0].id)
        self.assertEqual(again.data["errors"], [])

    def test_admin_manages_members_and_cannot_remove_the_last_admin(self):
        self.client.force_authenticate(self.admin)
        sent = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [self.anna.id, self.pete.id]},
            format="json",
        )
        by_name = {row["invitee"]["display_name"]: row["id"] for row in sent.data["invites"]}
        self.client.force_authenticate(self.anna)
        self.client.post(reverse("circle-invite-accept", args=[by_name["Anna L."]]))
        self.client.force_authenticate(self.pete)
        self.client.post(reverse("circle-invite-accept", args=[by_name["Pete K."]]))

        self.client.force_authenticate(self.anna)
        members = self.client.get(reverse("circle-members", args=[self.circle_id]))
        self.assertEqual(
            [row["display_name"] for row in members.data["members"]],
            ["Anna L.", "Pete K.", "Sarah M."],
        )
        self.assertEqual(
            self.client.post(
                reverse("circle-member-make-admin", args=[self.circle_id, self.pete.id])
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.client.force_authenticate(self.admin)
        detail = self.client.get(reverse("circle-detail", args=[self.circle_id]))
        self.assertEqual(detail.data["description"], "Upper hall")
        self.assertEqual(len(detail.data["members_preview"]), 3)

        made = self.client.post(
            reverse("circle-member-make-admin", args=[self.circle_id, self.pete.id])
        )
        self.assertTrue(made.data["member"]["is_admin"])
        again = self.client.post(
            reverse("circle-member-make-admin", args=[self.circle_id, self.pete.id])
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK)

        removed = self.client.post(
            reverse("circle-member-remove-admin", args=[self.circle_id, self.admin.id])
        )
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertFalse(removed.data["member"]["is_admin"])
        self.client.force_authenticate(self.pete)
        last = self.client.post(
            reverse("circle-member-remove-admin", args=[self.circle_id, self.pete.id])
        )
        self.assertEqual(last.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(last.data["detail"], "Circles need at least one admin.")
        self.assertEqual(last.data["code"], "last_admin")

        kick = self.client.post(
            reverse("circle-member-remove", args=[self.circle_id, self.pete.id])
        )
        self.assertEqual(kick.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(kick.data["detail"], "Circles need at least one admin.")

        # Sarah is no longer an admin, so Pete (now the only admin) has to remove her.
        self.client.force_authenticate(self.pete)
        gone = self.client.post(
            reverse("circle-member-remove", args=[self.circle_id, self.admin.id])
        )
        self.assertEqual(gone.status_code, status.HTTP_200_OK)
        self.assertEqual(gone.data["member_count"], 2)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.circle_row(self.admin)["membership_state"], "none")

        self.client.force_authenticate(self.pete)
        cannot_leave = self.client.post(reverse("circle-leave", args=[self.circle_id]))
        self.assertEqual(cannot_leave.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(cannot_leave.data["detail"], "Circles need at least one admin.")
        self.assertTrue(
            CircleMembership.objects.filter(circle_id=self.circle_id, user=self.pete).exists()
        )

        made = self.client.post(
            reverse("circle-member-make-admin", args=[self.circle_id, self.anna.id])
        )
        self.assertTrue(made.data["member"]["is_admin"])
        left = self.client.post(reverse("circle-leave", args=[self.circle_id]))
        self.assertEqual(left.status_code, status.HTTP_200_OK)
        self.assertFalse(left.data["is_member"])
        self.assertTrue(
            CircleMembership.objects.filter(
                circle_id=self.circle_id, user=self.anna, is_admin=True
            ).exists()
        )

    def test_people_search_skips_members_and_blocked_people(self):
        CircleMembership.objects.create(circle_id=self.circle_id, user=self.pete)
        amy = make_user("amy", self.church, first_name="Amy", last_name="Ng")
        self.client.force_authenticate(self.admin)
        self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": [self.anna.id]},
            format="json",
        )
        BlockedUser.objects.create(blocker=self.admin, blocked=amy)
        found = self.client.get(reverse("circle-people", args=[self.circle_id]), {"q": "a"})
        names = {row["display_name"]: row["invite_state"] for row in found.data["people"]}
        self.assertEqual(names, {"Anna L.": "invited"})
        self.client.force_authenticate(self.anna)
        self.assertEqual(
            self.client.get(reverse("circle-people", args=[self.circle_id])).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_report_circle_reuses_report_reasons(self):
        self.client.force_authenticate(self.anna)
        filed = self.client.post(
            reverse("circle-report", args=[self.circle_id]),
            {"reason": "spam", "description": "Not a real group"},
            format="json",
        )
        self.assertEqual(filed.status_code, status.HTTP_201_CREATED)
        report = AbuseReport.objects.get(pk=filed.data["id"])
        self.assertEqual(report.target_type, "circle")
        self.assertEqual(report.target_id, self.circle_id)
        self.assertEqual(report.reason, "spam")
        self.assertEqual(report.reported_user_id, self.admin.id)
        again = self.client.post(
            reverse("circle-report", args=[self.circle_id]),
            {"reason": "spam"},
            format="json",
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK)
        self.assertEqual(again.data["id"], report.id)

        self.client.force_authenticate(self.admin)
        own = self.client.post(
            reverse("circle-report", args=[self.circle_id]), {"reason": "other"}, format="json"
        )
        self.assertEqual(own.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(AbuseReport.objects.get(pk=own.data["id"]).reported_user_id)
        bad = self.client.post(
            reverse("circle-report", args=[self.circle_id]),
            {"reason": "nope"},
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(self.outsider)
        self.assertEqual(
            self.client.post(reverse("circle-report", args=[self.circle_id])).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_guards_for_bad_invites_membership_and_push_failures(self):
        self.client.force_authenticate(self.admin)
        empty = self.client.post(
            reverse("circle-invites", args=[self.circle_id]), {"user_ids": []}, format="json"
        )
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)
        junk = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": ["nope"]},
            format="json",
        )
        self.assertEqual(junk.status_code, status.HTTP_400_BAD_REQUEST)
        too_many = self.client.post(
            reverse("circle-invites", args=[self.circle_id]),
            {"user_ids": list(range(1, 52))},
            format="json",
        )
        self.assertEqual(too_many.status_code, status.HTTP_400_BAD_REQUEST)

        missing = self.client.post(
            reverse("circle-member-remove", args=[self.circle_id, self.anna.id])
        )
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)
        not_admin = self.client.post(
            reverse("circle-member-remove-admin", args=[self.circle_id, self.admin.id])
        )
        # Sarah is an admin; demote is blocked because she is the last one.
        self.assertEqual(not_admin.status_code, status.HTTP_400_BAD_REQUEST)
        CircleMembership.objects.create(circle_id=self.circle_id, user=self.pete)
        demote = self.client.post(
            reverse("circle-member-remove-admin", args=[self.circle_id, self.pete.id])
        )
        self.assertEqual(demote.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(demote.data["detail"], "That person is not an admin.")

        self.client.force_authenticate(self.anna)
        with patch("prayers.notifications.send_push_to_user", side_effect=RuntimeError("down")):
            asked = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(asked.status_code, status.HTTP_201_CREATED)
        self.client.force_authenticate(self.admin)
        already = self.client.post(reverse("circle-join-requests", args=[self.circle_id]))
        self.assertEqual(already.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(already.data["detail"], "You are already in this circle.")

        with patch("prayers.notifications.send_push_to_user", side_effect=RuntimeError("down")):
            sent = self.client.post(
                reverse("circle-invites", args=[self.circle_id]),
                {"user_ids": [self.pete.id]},
                format="json",
            )
        # Pete is already a member, so this does not notify. Invite Anna instead.
        self.assertEqual(sent.status_code, status.HTTP_400_BAD_REQUEST)
        with patch("prayers.notifications.send_push_to_user", side_effect=RuntimeError("down")):
            sent = self.client.post(
                reverse("circle-invites", args=[self.circle_id]),
                {"user_ids": [self.anna.id]},
                format="json",
            )
            self.assertEqual(sent.status_code, status.HTTP_201_CREATED)
            approved = self.client.post(
                reverse("circle-join-request-approve", args=[self.circle_id, asked.data["id"]])
            )
        # The invite cancelled Anna's request, so approve no longer finds it.
        self.assertEqual(approved.status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(self.anna)
        BlockedUser.objects.create(blocker=self.anna, blocked=self.admin)
        self.assertEqual(self.client.get(reverse("circle-invite-inbox")).data["invites"], [])
        self.assertEqual(
            self.client.post(
                reverse("circle-invite-accept", args=[sent.data["invites"][0]["id"]])
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.client.force_authenticate(self.unchurched)
        self.assertEqual(self.client.get(reverse("circle-invite-inbox")).data["invites"], [])

    def test_open_join_never_adds_a_membership(self):
        self.client.force_authenticate(self.anna)
        response = self.client.post(reverse("circle-join", args=[self.circle_id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "open_join_closed")
        self.assertEqual(
            response.data["detail"],
            "Open join is closed. Request to join and wait for an admin to approve.",
        )
        self.assertFalse(
            CircleMembership.objects.filter(circle_id=self.circle_id, user=self.anna).exists()
        )

    def test_deleting_the_last_admin_promotes_the_earliest_other_member(self):
        from users.account_deletion import delete_account

        CircleMembership.objects.create(circle_id=self.circle_id, user=self.anna)
        CircleMembership.objects.create(circle_id=self.circle_id, user=self.pete)
        delete_account(self.admin)
        self.assertFalse(User.objects.filter(pk=self.admin.pk).exists())
        successor = CircleMembership.objects.get(circle_id=self.circle_id, user=self.anna)
        self.assertTrue(successor.is_admin)
        self.assertFalse(
            CircleMembership.objects.get(circle_id=self.circle_id, user=self.pete).is_admin
        )

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"circle_create": "2/min"}})
    def test_creating_circles_is_rate_limited(self):
        cache.clear()
        self.client.force_authenticate(self.admin)
        codes = [
            self.client.post(
                reverse("circle-list"), {"name": f"Group {i}"}, format="json"
            ).status_code
            for i in range(3)
        ]
        self.assertEqual(codes, [201, 201, 429])
        self.assertEqual(self.client.get(reverse("circle-list")).status_code, status.HTTP_200_OK)

    @override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_RATES": {"circle_invite": "2/min"}})
    def test_sending_invites_is_rate_limited(self):
        cache.clear()
        self.client.force_authenticate(self.admin)
        people = [self.anna, self.pete, make_user("ruth", self.church, first_name="Ruth")]
        codes = [
            self.client.post(
                reverse("circle-invites", args=[self.circle_id]),
                {"user_ids": [person.id]},
                format="json",
            ).status_code
            for person in people
        ]
        self.assertEqual(codes, [201, 201, 429])
        self.assertEqual(
            self.client.get(reverse("circle-invites", args=[self.circle_id])).status_code,
            status.HTTP_200_OK,
        )
