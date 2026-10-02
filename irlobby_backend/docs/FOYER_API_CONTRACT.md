# The Foyer API contract

Mobile client contract for gatherings. Existing auth (`POST /api/users/register/`, `POST /api/users/login/`, `GET/PATCH /api/users/profile/`) is unchanged except for the profile and registration fields below. All authenticated routes use `Authorization: Bearer <access>`.

Dates are ISO-8601. Ages are computed in `America/New_York`. `capacity` is people, not accounts: `null` means unlimited, otherwise 1–500. `platform_fee_percent` is always `0`.

Giving and donations are out of scope for this build. There is no gift amount, Checkout Session, or church Stripe account in the API. Those can return later. RSVP stays free.

## Profile and registration

`POST /api/users/register/` (no auth)

Extra optional fields: `date_of_birth` (`YYYY-MM-DD`), `sex` (`male` | `female`).

Optional terms acceptance (see "Terms at sign-up" below): `terms_accepted`, `privacy_accepted` (bools), `terms_version`, `privacy_version` (strings, up to 32 characters).

A birth date that makes the person under 13 is rejected:

```json
{ "date_of_birth": ["Accounts are not available under age 13."] }
```

`GET/PATCH /api/users/profile/` (auth)

New fields:

| Field | Read | Write |
|---|---|---|
| `date_of_birth` | yes | yes, aliases `birthDate`, `birth_date` |
| `sex` | yes | `male` or `female` |
| `church` | `{ "id", "name", "is_verified" }` or `null` | no |
| `church_id` | id or `null` | yes, aliases `churchId`; `null` clears it |
| `is_church_admin` | bool | no |
| `household_child_count` | int | no |

Church admins are `ajesbenshade@gmail.com`, `ajesbenshade@outlook.com`, and `aesbenshade@dock.org`.

## Churches

`GET /api/churches/?q=` (auth) → JSON array, verified churches first, max 20.

```json
{ "id": 1, "name": "Franconia Mennonite Church", "is_verified": true }
```

Seeded verified churches: Franconia, Souderton, Blooming Glen, Plains, Zion, Perkasie, Deep Run East, and Finland Mennonite Church.

`POST /api/churches/` (auth)

```json
{ "name": "Typed Chapel" }
```

201 if created (always `is_verified: false`). 200 if that name already exists (case-insensitive). The response is only `id`, `name`, and `is_verified`.

## Household

`GET /api/users/household/` (auth)

```json
{
  "children": [
    { "id": 1, "name": "Child 1", "date_of_birth": "2017-03-04", "sex": "female", "age": 9 }
  ]
}
```

`POST /api/users/household/` (auth)

```json
{ "name": "Child 1", "date_of_birth": "2017-03-04", "sex": "female" }
```

201 returns the child object. Rules:

- Parent must have a birth date and be 18 or older (`parent` error).
- Child must be under 18 (`date_of_birth` error).
- A 13–17 year old who already has an account with the same birth date and the same name (first name, full name, or username) cannot be stored as a dependent (`name` error).

`DELETE /api/users/household/<id>/` (auth) → 204. Only that parent's child.

## Gatherings

`POST /api/activities/` and `PATCH /api/activities/<id>/` (auth, host)

New request fields (snake_case; camelCase aliases accepted):

| Field | Values |
|---|---|
| `audience_gender` | `everyone` (default), `men`, `women` |
| `age_min`, `age_max` | integers or `null`. Max must be ≥ min. |
| `capacity` | `null` or 1–500 |
| `list_on_church_calendar` | bool, default false |
| `host_kind` | `person` (default) or `church` |
| `host_church_id` | optional; church events default to Franconia Mennonite Church |

`host_kind: "church"` is rejected unless the caller is a church admin. Church-hosted events set `calendar_approved: true` immediately. A member event with `list_on_church_calendar: true` stays `calendar_approved: false` until an admin approves it. Clients cannot set `calendar_approved` directly. `platform_fee_percent` sent by the client is ignored and stored as `0`.

Response adds:

```json
{
  "audience_gender": "women",
  "age_min": 18,
  "age_max": null,
  "audience": "Women · 18+",
  "list_on_church_calendar": false,
  "calendar_approved": false,
  "host_kind": "person",
  "host_church_id": null,
  "host_name": "Sarah Host",
  "cover_photo_url": null,
  "going_count": 0,
  "my_rsvp": null,
  "photos": [],
  "platform_fee_percent": "0.00",
  "is_cancelled": false,
  "cancelled_at": null,
  "cancel_reason": "",
  "status": "active",
  "calendar_links": {
    "ics_url": "https://<host>/api/public/event.ics?token=<signed>",
    "webcal_url": "webcal://<host>/api/public/event.ics?token=<signed>",
    "google_url": "https://calendar.google.com/calendar/render?action=TEMPLATE&...",
    "outlook_url": "https://outlook.live.com/calendar/0/deeplink/compose?..."
  }
}
```

`is_cancelled`, `cancelled_at` (ISO datetime or `null`), `cancel_reason` (up to 280 characters, `""` if none) and `status` (`"cancelled"` when cancelled, otherwise `"active"`) are read-only and appear in every activity payload (list, detail, hosted, going). See "Cancel a gathering" below.

`audience` chip text: `Everyone`, `Women · 18+` (min ≥ 18 and no max), `Everyone · Ages 6+` (min under 18 and no max), `Everyone · Ages 6–17` (both bounds).

`host_name` is the person's first and last name, or the church name when `host_kind` is `church`. Clients that send `donation_enabled`, `suggested_donation`, or gift fields are ignored; those names are not accepted or returned.

`my_rsvp` when present:

```json
{ "status": "confirmed", "include_self": true, "dependent_ids": [1], "people_count": 2 }
```

`GET /api/activities/hosted/` — gatherings you host.

`GET /api/activities/going/` — gatherings where your RSVP is `confirmed`.

The old `age_restriction` query filter is no longer applied.

## Who's coming and RSVP

`GET /api/activities/<id>/whos-coming/` (auth)

```json
{
  "me": { "name": "Sarah Host", "sex": "female", "age": 35, "eligible": true, "reason": null },
  "dependents": [
    {
      "id": 1,
      "name": "Child 1",
      "sex": "female",
      "age": 8,
      "eligible": false,
      "reason": "Outside this event's age range"
    }
  ],
  "note": "Only children in your household are listed. Teens with their own account RSVP for themselves."
}
```

Age is the age on the gathering's start date in `America/New_York`. Birth dates are not included. Gender reasons: `This gathering is for men.` / `This gathering is for women.` Missing sex on a gendered gathering: `Add a sex to join this gathering.`

`POST /api/activities/<id>/rsvp/` (auth)

```json
{ "include_self": true, "dependent_ids": [1] }
```

200, creates or replaces the caller's RSVP as `confirmed` (RSVP is free):

```json
{
  "status": "confirmed",
  "include_self": true,
  "dependent_ids": [1],
  "people_count": 2,
  "going_count": 2
}
```

400 if nobody is selected, a child is not in the caller's household, someone is ineligible (`people` array), or the added people would exceed `capacity` (`message`: `Activity is full`). Capacity counts each selected person. `null` capacity never fills.

`DELETE /api/activities/<id>/rsvp/cancel/` (auth) cancels the caller's RSVP.

`POST /api/activities/<id>/join/` remains for the legacy pending request and also counts people.

## Photos

`POST /api/activities/<id>/photos/` (auth, host or church admin on a church event). Multipart file field `image` (also accepts `photo` or `file`). JPEG, PNG, or WebP. Stored as a compressed JPEG. At most 50.

```json
{ "id": 4, "url": "https://<host>/api/activities/12/photos/4/" }
```

`GET /api/activities/<id>/photos/<photo_id>/` — no auth. Response is `image/jpeg` bytes, not JSON and not base64.

`DELETE /api/activities/<id>/photos/<photo_id>/` (auth, host) → 204.

## Giving

Out of scope. There is no `giving-link` endpoint, no gift Checkout Session, and no church Stripe account field. RSVP does not charge anyone. Giving can be added later without changing the RSVP contract.

## Church calendar approval

`POST /api/activities/<id>/calendar/approve/` (auth, church admin only)

The gathering must already have `list_on_church_calendar: true`. 200:

```json
{ "id": 12, "list_on_church_calendar": true, "calendar_approved": true }
```

## Chat

Allowed only for a confirmed going RSVP (yourself or at least one household child), the host, or a church admin when `host_kind` is `church`.

- `GET/POST /api/activities/<id>/chat/` → 403 `{ "error": "Not authorized" }` otherwise.
- `GET/POST /api/messages/conversations/` and `.../messages/` hide activity conversations the caller cannot access.
- WebSocket `ws/chat/<conversation_id>/` closes on connect when the match's gathering is not accessible.
- WebSocket `ws/?token=<access>&activityId=<id>` closes on connect when `activityId` is present and the caller cannot access that gathering. `join_activity` messages use the same rule.

## Public calendar (no auth)

`GET /api/public/calendar`

Only gatherings with `list_on_church_calendar: true` and `calendar_approved: true`.

```json
{
  "events": [
    {
      "title": "Harvest Supper",
      "start": "2026-10-06T18:00:00+00:00",
      "end": null,
      "location": "Franconia meetinghouse",
      "host_name": "Sarah Host",
      "audience": "Everyone · Ages 6+",
      "description": "Bring a dish.",
      "cover_photo_url": null
    }
  ]
}
```

Those eight keys are the only event fields. No birth dates, emails, children, chat, or RSVP lists.

`GET /api/public/calendar.ics` → `text/calendar; charset=utf-8`. `PRODID:-//Franconia Mennonite Church//The Foyer//EN`. Same events only. Subscribe in Apple Calendar by swapping the scheme: `webcal://<host>/api/public/calendar.ics` (same path, no Authorization header).

Feed properties:

| Property | Value |
|---|---|
| `X-WR-CALNAME` | `Franconia Mennonite Church – The Foyer` (en dash) |
| `X-WR-TIMEZONE` | `America/New_York` |
| `UID` | `foyer-activity-<id>@franconiamennonite.org` (stable) |
| `DTSTAMP` | UTC time the file was generated |
| `LAST-MODIFIED` | the gathering `updated_at`, UTC |
| `SEQUENCE` | integer unix time of `updated_at` (bumps when the gathering is saved) |
| `Cache-Control` | `public, max-age=300` |

Timed instants are UTC (`...Z`), which match the `America/New_York` wall time stored on the gathering. Deleted gatherings and gatherings that are not both listed and approved are omitted from the next feed (there is no tombstone, so they are not sent as `CANCELLED`).

CORS allows `https://franconiamennonite.org`.

## Calendar links (no device calendar permission)

List and detail responses (`GET /api/activities/`, `GET /api/activities/<id>/`, and the hosted and going lists) include `calendar_links` when the caller is authenticated. The phone opens these URLs; it does not request calendar permission.

```json
{
  "ics_url": "https://<host>/api/public/events/12.ics",
  "webcal_url": "webcal://<host>/api/public/events/12.ics",
  "google_url": "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Harvest%20Supper&dates=20261006T180000Z/20261006T200000Z&details=Host%3A%20Sarah%20Host%0ABring%20a%20dish.&location=Franconia%20meetinghouse",
  "outlook_url": "https://outlook.live.com/calendar/0/deeplink/compose?subject=Harvest%20Supper&body=Host%3A%20Sarah%20Host%0ABring%20a%20dish.&startdt=2026-10-06T18%3A00%3A00Z&enddt=2026-10-06T20%3A00%3A00Z&location=Franconia%20meetinghouse"
}
```

| Field | Meaning |
|---|---|
| `ics_url` | `.ics` file. Safari and the Apple Calendar app open it with no `Authorization` header. |
| `webcal_url` | the same URL with the `webcal://` scheme |
| `google_url` | `https://calendar.google.com/calendar/render?action=TEMPLATE` with `text`, `dates` (`YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ`), `details`, and `location` |
| `outlook_url` | `https://outlook.live.com/calendar/0/deeplink/compose` with `subject`, `body`, `startdt`, `enddt` (ISO UTC), and `location`. Work and school accounts can use the same query on `https://outlook.office.com/calendar/0/deeplink/compose`. |

Approved church-calendar gatherings (`list_on_church_calendar` and `calendar_approved`) use a public file:

`GET /api/public/events/<id>.ics`

Any other gathering uses an unguessable token that is only returned inside the authenticated `calendar_links` object:

`GET /api/public/event.ics?token=<signed>`

The token is a stable Django signature of the gathering id (`salt` `foyer-event-ics`). It does not change between requests. A missing token, a bad signature, a forged id, or a deleted gathering is `404` with an empty body. `GET /api/public/events/<id>.ics` is also `404` unless that id is on the approved public calendar, so private ids cannot be walked.

Both files are `text/calendar; charset=utf-8` and use `PRODID:-//Franconia Mennonite Church//The Foyer//EN`. The per-gathering file contains only title (`SUMMARY`), start (`DTSTART`), end (`DTEND` when the end is after the start), location, description, and host name (the description begins with `Host: <name>`). It has no `ATTENDEE`, email, household, minor, or other contact data. `Cache-Control` is `public, max-age=300` for the public file and `private, max-age=300` for the token file.

If `end_time` is null, or not after the start, the `.ics` omits `DTEND`. Google and Outlook links still send a positive range by using the start plus one hour. A start and end that fall on America/New_York midnights a whole number of days apart are still written as UTC instants, not a zero-length event.

## Stripe

The Foyer flow does not use Stripe. Connect onboarding, ticket checkout, and QR validation remain in the codebase from IRLobby and are unused by gatherings. `platform_fee_percent` on an activity is still forced to `0`. Giving can return later; this build does not request `card_payments` or create direct charges.

---

# Social features (additive; builds 88/89 keep working)

Every endpoint below requires auth unless stated. Nothing here removes or renames an existing field.

## Family members (spouse and children)

`GET /api/users/household/` now returns `children` (unchanged) and `members`:

```json
{
  "children": [ { "id": 1, "name": "Kid", "date_of_birth": "2017-03-31", "sex": "female", "age": 9,
                  "relationship": "child", "birth_month": 3, "birth_year": 2017 } ],
  "members": [
    { "id": 1, "name": "Kid", "relationship": "child", "sex": "female", "birth_month": 3, "birth_year": 2017, "age": 9 },
    { "id": 2, "name": "Pat", "relationship": "spouse", "sex": "male", "birth_month": null, "birth_year": null, "age": null }
  ]
}
```

`POST /api/users/household/`
- Child: `{ "name", "sex"?, "birth_month": 1-12, "birth_year": 2017 }`, or the old `{ "date_of_birth": "YYYY-MM-DD" }` (also `birth_date`). `relationship` defaults to `"child"`. Must be under 18.
- Spouse: `{ "name", "relationship": "spouse", "sex"? }`. Any birth data is ignored; a spouse is an adult with age `null`. One spouse per household.
- 201 returns the legacy child object (plus `relationship`, `birth_month`, `birth_year`) and a `members` list. Other relationships → 400 `relationship`.
- When only month/year is stored, `date_of_birth` is `null` (older builds saw the last day of the month). Ages still use the last day of the month so a child never looks older. See "Birthdays (additive)" below for `birth_day` and `birth_precision`.

`DELETE /api/users/household/<id>/` → 204 (unchanged).

`POST /api/activities/<id>/rsvp/` accepts `member_ids` (same list as `dependent_ids`; both are merged). The response and `my_rsvp` return both `dependent_ids` and `member_ids`. A spouse counts as an adult for sex rules and any age range, except events with `age_max` under 18.

`GET /api/activities/<id>/whos-coming/` returns the same people under `dependents` and `members` (each has `relationship`, `birth_month`, `birth_year`, `birth_day`, `birth_precision`; spouse `age` is `null`). `birth_day` and `birth_precision` use the same values as the household endpoint: `birth_day` is `null` and `birth_precision` is `"month"` for a month-only child, `birth_day` is 1-31 and `birth_precision` is `"day"` when a full date is stored, and a spouse has all four birth fields `null`. This list is only the requesting user's own household (parent-only data); another user's call never includes these children. `date_of_birth` is not included here.

## Host-only attendees, and past-event attendees

`GET /api/activities/<id>/attendees/`

Host (or church admin on a church event) or staff, any time:

```json
{ "going_count": 4,
  "households": [ { "name": "Guest Smith",
    "people": [ { "name": "Guest Smith", "relationship": "self",   "age_band": "adult" },
                { "name": "Pat",         "relationship": "spouse", "age_band": "adult" },
                { "name": "Kid",         "relationship": "child",  "age_band": "under 13" } ] } ] }
```

`age_band` is `"under 13"`, `"13-17"` or `"adult"`. No emails, phones, locations, birth dates, usernames or ids.

A non-host with a confirmed going RSVP, once the event has started (ongoing or past): names only.

```json
{ "going_count": 4, "attendees": [ { "user_id": 12, "name": "Adult S." }, { "user_id": null, "name": "Teen S." } ] }
```

One row per other going account (household members are never listed). You are not listed. Blocked users (either direction) are omitted. `user_id` is `null` for under-18 accounts unless you are accepted friends, so a stranger cannot open a minor's profile. Anyone else, or before the event starts → 403.

## Profile visibility, contact toggles, reports

New fields on `GET/PATCH /api/users/profile/` (own profile; also in the login payloads):
`profile_visibility` (`only_me` default | `friends` | `church` | `public`), `phone` (E.164, for example `+12155550123`; 10-digit US numbers are normalized; invalid → 400; empty clears), `show_email` (false), `show_phone` (false), `dm_from_shared_events` (false).

`GET /api/users/<id>/profile/` (the "profile card"; the path is final unless the mobile team prefers another):

```json
{ "id": 7, "first_name": "Owner", "avatar_url": "https://…", "bio": "first 160 chars", "friendship": "none", "visible": true, "email": "…", "phone": "+1…" }
```

- `friendship`: `none` | `friends` | `pending_outgoing` | `pending_incoming` | `self`.
- `email` / `phone` appear only if the owner turned `show_email` / `show_phone` on AND the viewer is inside the owner's level. Levels nest: `public` = any logged-in user; `church` = same church (or accepted friend); `friends` = accepted friends; `only_me` = nobody else.
- Under-18 accounts are visible only to accepted friends regardless of the setting.
- The `church` level includes accepted friends: an accepted friend sees a church-level profile even when they are not in the owner's church (or have no church). A non-friend from another church gets 404, and a pending request is not enough.
- If the viewer is not allowed the full card but could still send a friend request (shared attended event, same church, or a public adult), they get `{ "id", "first_name", "friendship", "visible": false }` so the Add Friend button can work.
- Otherwise 404. Blocked in either direction → 404. Your own id returns your own `email` and `phone`.
- Never includes location, family, birth year or date, username or last name. The only birth data is `birthday: {month, day}` for an adult who chose to share it (see "Birthdays (additive)").

`POST /api/users/<id>/report/` `{ "reason": "inappropriate|spam|harassment|fake_profile|threat|other", "description"? }` → 201 `{ "id", "status" }` (creates an `AbuseReport`). Blocking uses the existing `POST /api/moderation/block/<id>/` and `DELETE /api/moderation/unblock/<id>/`; blocking now also removes any friendship.

Phone numbers are never present in any other response (chat, attendees, who's-coming, calendar, .ics, lists).

## Friends

- `POST /api/friends/requests/` `{ "user_id": 7 }` → 201 `{ "id", "direction": "outgoing", "status": "pending", "user": {"id","first_name","avatar_url"}, "created_at" }`. Re-sending is 200 (idempotent). If they already asked you, it accepts (`status: "accepted"`). 400 self/bad id; 403 if the target is not reachable; 404 unknown or blocked; 409 already friends; 429 rate limit (30/hour, `FRIEND_REQUEST_THROTTLE_RATE`).
- Reachable = you both attended a started event, same church, or the target's visibility is `public` (adults only; a minor needs a shared event or church).
- `GET /api/friends/requests/` → `{ "incoming": [ … ], "outgoing": [ … ] }` (pending only; same item shape). A declined request still shows as pending to the sender.
- `POST /api/friends/requests/<id>/accept/` and `/decline/` (recipient only) → `{ "id", "status" }`; otherwise 404.
- `GET /api/friends/` → `{ "friends": [ { "user_id", "first_name", "avatar_url", "since" } ] }`.
- `DELETE /api/friends/<user_id>/` → 204 unfriends (or withdraws your own pending request); 404 if nothing to remove.

## 1:1 chat

Same `Conversation`/`Message` tables as gathering chat (a conversation whose match has no activity). Messages use the existing endpoints: `GET/POST /api/messages/conversations/<id>/messages/` and websocket `ws/chat/<id>/`.

Who may message: accepted friends. If the recipient has `dm_from_shared_events` on, adults who attended a shared (started) event with them may too. A person who opted in may also reply to someone who already wrote to them. Any under-18 on either side → friends only. Blocks cut both ways. Rules are re-checked on every send (REST and websocket); unfriending or blocking stops sending immediately.

- `GET /api/messages/direct/` → `{ "conversations": [ { "id", "other_user": {"id","first_name","avatar_url"}, "last_message": {"id","message","userId","createdAt"} | null, "muted", "can_send", "created_at" } ] }`.
- `POST /api/messages/direct/` `{ "user_id" }` → 201 new / 200 existing conversation summary (same shape); 403 not allowed; 404 unknown or blocked.
- `POST /api/messages/direct/<id>/mute/` `{ "muted": true|false }` → `{ "id", "muted" }` (muted = no push).
- `POST /api/messages/direct/<id>/leave/` → `{ "id", "left": true }`; hides it for you; starting the chat again restores it.
- `POST /api/messages/direct/<id>/report/` `{ "reason", "description"?, "message_id"? }` → 201 `{ "id", "status" }`.
- `POST /api/messages/direct/<id>/block/` → 201; blocks the other person and removes the friendship.
- Sending (POST messages in a 1:1 chat, starting a chat) is rate-limited to 120/hour (`DIRECT_MESSAGE_THROTTLE_RATE`). Non-members, blocked, or left → empty list on GET / 400 on POST (existing behavior); direct-endpoint actions → 404.
- `/api/messages/conversations/` still lists gathering chats only.
- Message `user` objects (REST and websocket) are `{ "id", "firstName" }`; email is no longer returned.

## Cancel RSVP and clearing a pass

`DELETE /api/activities/<id>/rsvp/cancel/` now also deletes your swipe for that activity, so the card returns to the deck. 400 if the event has started, you are the host, or you have no RSVP. For a host the 400 body is `{ "detail": "Hosts can't cancel an RSVP; use Cancel this gathering instead." }`; hosts use `POST /api/activities/<id>/cancel-event/`.

`DELETE /api/swipes/<activity_id>/swipe/` → 200 `{ "deleted": true|false }` (idempotent). 404 only if the activity does not exist.

## Cancel a gathering

`POST /api/activities/<id>/cancel-event/` (auth) body `{ "reason"?: string }` (up to 280 characters, trimmed; optional).

Who: the host, staff, or a church admin on a church-hosted event (the same rule as every other host action). Response: 200 with the full activity payload (same shape as `GET /api/activities/<id>/`), now with:

```json
{ "id": 12, "is_cancelled": true, "cancelled_at": "2026-10-02T14:00:00Z", "cancel_reason": "Snow storm", "status": "cancelled" }
```

| Status | When |
| --- | --- |
| 200 | Cancelled now, or already cancelled (idempotent: returns the current state and sends nothing again; the first reason and time are kept) |
| 400 | `reason` is not text or is over 280 characters (`{ "reason": … }`); or the event has already started or ended (`{ "detail": "This gathering has already started, so it can't be cancelled." }`) |
| 401 | not signed in |
| 403 | signed in but not the host, staff, or church admin of this event |
| 404 | the activity does not exist or is not visible to the caller (same visibility as the detail endpoint) |

What happens:
- RSVPs are kept (nothing is deleted); `my_rsvp` and the going list still show them.
- Every confirmed attendee and every pending requester (see "Require approval") except the host and whoever cancelled gets one push notification (`title` "<title> was cancelled", body "<title> was cancelled. Reason: <reason>", data `{ "type": "activity_cancelled", "activityId", "screen": "Activity" }`), including accounts that are going only for a spouse or child. Declined requests are not notified. Sent after the database commit, through the Expo push helper (respects the user's `pushNotifications` preference). There is no separate in-app notification inbox.
- If a gathering chat already exists, a message "<title> was cancelled by the host. Reason: …" is added to it (sender = the person who cancelled). The chat stays fully open after cancelling: reads and sends (REST and websocket) keep working, so the host can announce a new date.
- Cancelled gatherings are left out of `GET /api/activities/` (the swipe deck and browse list), `GET /api/public/calendar`, `GET /api/public/calendar.ics` and `GET /api/public/events/<id>.ics` (404). They are still returned by `GET /api/activities/<id>/`, `/hosted/` and `/going/` with `is_cancelled: true`; photos and the signed-token `event.ics` keep working (that file now carries `STATUS:CANCELLED`).
- New RSVPs (`POST /rsvp/`), legacy `POST /join/`, swipes (`POST /api/swipes/<id>/swipe/`, `POST /api/swipes/`) and ticket purchases on a cancelled gathering → 400.
- Clients cannot set `is_cancelled`, `cancelled_at` or `cancel_reason` through `PATCH`.

## Require approval

A host can ask to approve each guest before they are going. Off by default.

**Host setting** (`POST /api/activities/` and `PATCH /api/activities/<id>/`, host only like every other field; guests get 403 on PATCH):
- `requires_approval` (bool, also `requiresApproval`) and `allow_rerequest` (bool, also `allowRerequest`): after a decline, the guest may ask again.
- 400 `{ "requires_approval": … }` on a church-hosted event (`host_kind: "church"`) or one on the public church calendar (`list_on_church_calendar` and `calendar_approved`). A member event that is listed but not yet approved by the church may keep it, but `POST /calendar/approve/` then answers 400 until the host turns it off.
- 400 `{ "requires_approval": "Review your pending requests before turning off Require approval." }` when switching it off while requests are pending. Switching it on affects only new RSVPs; people already going stay going.

**Activity payload** (every activity payload, for anyone who can see the event) adds `requires_approval`, `allow_rerequest` and `my_request_status`: `"none"` | `"pending"` | `"approved"` (a confirmed RSVP) | `"declined"`. Host and staff also get `pending_count` (number of requests waiting, blocked accounts left out); other users do not get that key. `my_rsvp.status` is `"pending"` for a request. The RSVP response also carries `my_request_status` and `my_request_reason`.

`my_request_reason` is the host's decline note, shown only to the requester: it is the stored note (string, up to 280 characters) when `my_request_status` is `"declined"` and the host wrote one, and `null` in every other case (no note, pending, approved, none, or any other viewer, including the host and staff). It is never `""`. The note is stored on the request as `decline_reason` and cleared when the request goes back to pending (re-request) or is approved.

**Guest: ask to join.** `POST /api/activities/<id>/rsvp/` (same body as today: `include_self`, `dependent_ids`, `member_ids`). On a Require-approval event, for anyone but the host:

```json
{ "status": "pending", "my_request_status": "pending", "include_self": true, "dependent_ids": [4], "member_ids": [4], "people_count": 2, "going_count": 3 }
```

- 200, a `pending` `ActivityParticipant` is created or updated. Eligibility (audience, age) is still checked; capacity is not (the host checks when approving). Pending people never count in `going_count`, `participant_count`, `spots_left`, attendees, reminders, or `/going/`, and get no exact address, no gathering chat and no attendee list.
- Asking again while pending is idempotent (200; the party is updated; the host is not notified again).
- Declined: 400 `{ "detail": "The host declined your request." }`, unless `allow_rerequest` is true, in which case it becomes pending again (and the host is notified). A declined guest cannot clear the decline by cancelling or leaving while `allow_rerequest` is false (same 400).
- Already confirmed: unchanged behaviour (party edits, capacity check). The host RSVPing to their own event is unchanged (instantly confirmed).
- Blocked either way with the host: 404 `{ "detail": "Not found." }`, as if the event were hidden.
- Withdraw: `DELETE` (or `POST`) `/api/activities/<id>/rsvp/cancel/` deletes the pending request and your swipe, like cancelling an RSVP.
- `GET /api/activities/going/` stays confirmed-only; add `?include_pending=true` to also list events where your request is pending (`my_rsvp.status` tells them apart).

**Host: list requests.** `GET /api/activities/<id>/requests/?status=pending` (default; also `approved` = confirmed, `declined`). Host, staff, or church admin on a church event; 401 anonymous; 403 anyone else; 404 if the event is missing or hidden; 400 for an unknown status. Works on cancelled and started events.

```json
{
  "pending_count": 2,
  "spots_left": 5,
  "requests": [
    {
      "id": 31,
      "user_id": 8,
      "requested_at": "2026-10-02T14:00:00Z",
      "decided_at": null,
      "status": "pending",
      "decline_reason": null,
      "party": { "size": 3, "include_self": true, "members": [ { "name": "Lily", "relationship": "child", "age_band": "under 13" } ] },
      "card": { "first_name": "Ana", "age_band": "adult", "avatar_url": "https://…", "bio": "…", "church_name": "Plains Mennonite Church" }
    }
  ]
}
```

- `decline_reason` is the host's own note on a declined request (`null` if none or not declined); it is the same text the requester sees as `my_request_reason`.
- `id` is the participant id used in the approve/decline URLs. `spots_left` is `capacity` minus people going (never below 0), `null` without a capacity. `pending_count` is always the number of pending requests whatever the `status` filter. Oldest request first. The host themselves and accounts blocked either way with the host are left out.
- `card` shows first name, avatar and bio regardless of the requester's `profile_visibility`; `church_name` is `null` with no church. Never email, phone, last name or birth date. For an under-18 requester the card is only `first_name` and `age_band` (`avatar_url` and `bio` are `null`, no `church_name`). Family members are `name`, `relationship`, `age_band` only. `age_band` is `"under 13"`, `"13-17"` or `"adult"` on the event date.

**Host: decide.** `POST /api/activities/<id>/requests/<participant_id>/approve/` and `POST …/decline/` (body optional `{ "reason": string }`, up to 280 characters, trimmed; decline only; stored as the request's `decline_reason`, blank if none). Same permissions as the list; 404 for an unknown request, one on another event, or a blocked requester.

```json
{ "request": { /* same item as in the list, with status "approved" or "declined" */ }, "going_count": 4, "spots_left": 2 }
```

| Status | When |
| --- | --- |
| 200 | Decided now, or already in that state (idempotent, nothing sent again). A host may approve a declined request they reconsider. |
| 400 | The event is cancelled, or has started or ended; `reason` too long or not text; decline of a request that is already approved |
| 409 | Approve only: the whole party does not fit in the remaining spots (`{ "detail": "Not enough spots for this party." }`; self, spouse and children all count; no capacity = always fits) |

Approving locks the gathering row (`select_for_update`, the same lock RSVP takes) so two approvals cannot overbook the last spots.

**Push notifications** (after the database commit, through the Expo helper, never repeated for idempotent calls):
- Host: title "New request to join <title>", body "<First name> asked to join <title>.", data `{ "type": "join_request", "activityId", "userId", "screen": "Requests" }`. Sent for a new request, or a re-request after a decline; not when a pending request is repeated.
- Requester: title "Your request to join <title> was approved" / "…was declined"; body "Your request to join <title> was approved." / "…declined. Reason: <reason>" (reason only when the host gave one); data `{ "type": "join_request_approved" | "join_request_declined", "activityId", "screen": "Activity" }`.
- Cancelling the gathering also notifies pending requesters (same text as attendees); declined requesters are not notified.

## Full gatherings

A gathering with a capacity is **full** when confirmed people (the account holder if going, plus every spouse and child going) reach `capacity`. Pending requests never count. No capacity (`null`) is never full. Fullness is computed from the RSVPs each time, never stored, so a freed spot (cancelled RSVP, host removal, a smaller party) reopens the gathering by itself. A cancelled gathering uses the same rule.

- **Payload:** every activity payload has `is_full` (bool). `GET /api/public/calendar` items also have `is_full`; full church events stay on the calendar JSON and `.ics`.
- **Deck:** `GET /api/activities/` leaves out full gatherings for people with no RSVP or request row on them (any status) who are not the host or staff. Anyone with a confirmed, pending or declined row, the host, and staff still see it, and `GET /api/activities/<id>/` works for everyone with the link.
- **Joining a full gathering** (new RSVP, a declined guest asking again with `allow_rerequest`, legacy `POST /join/`, a new request on a Require-approval gathering) → 400 `{ "detail": "This gathering is full.", "message": "Activity is full" }` (`message` is the older clients' text). Swipe-right (`POST /api/swipes/<id>/swipe/`, `POST /api/swipes/`) on a full gathering you have no row on → 400 `{ "error": "This gathering is full.", "detail": "This gathering is full." }` (the swipe-list endpoint puts it under `detail` and `activity`). Swipe-left is allowed. Host, staff and anyone with a row can still swipe.
- **Existing participants keep working:** an already confirmed guest re-sending the same or a smaller party gets 200; growing it past capacity is 400. A pending request can still be edited or withdrawn.
- **Party too big, event not yet full:** 400 `{ "detail": "Not enough spots for this party.", "message": "Activity is full" }` on RSVP (the same wording the host's approve uses). Approving on a full gathering stays 409 `Not enough spots for this party.`
- Require-approval gatherings are full by approved (confirmed) people only.

## Photo downloads

`GET /api/activities/<id>/photos/download/` → `{ "photos": [ { "id", "filename", "url", "expires_at" } ] }`. Allowed: any logged-in user for public-calendar events; otherwise host, staff, or a confirmed going attendee once the event has started; else 403. Each `url` is a signed original (about 1 hour, separate salt) that needs no auth header and responds with `Content-Disposition: attachment` and `Cache-Control: private`. Invalid or expired → 403. Every photo of the event is included (no per-photo opt-out).

## Hidden addresses

For member-hosted events (`host_kind` `person`, not on the public church calendar), `location`, `latitude` and `longitude` are `null` in activity responses unless the viewer is the host, staff, has a going RSVP, or holds a paid ticket. Church-hosted and public-calendar events are unchanged. `calendar_links` for a viewer who cannot see the address use an `ics_url` whose file has an empty `LOCATION`, and Google/Outlook links with no location.

# Apple App Store compliance pack

## Terms at sign-up

`POST /api/users/register/` also takes these optional fields (camelCase `termsAccepted`, `privacyAccepted`, `termsVersion`, `privacyVersion` work too):

| Field | Type | Effect |
| --- | --- | --- |
| `terms_accepted` | bool | `true` sets `terms_accepted_at` to now |
| `privacy_accepted` | bool | `true` sets `privacy_accepted_at` to now |
| `terms_version` | string, up to 32 | stored as `terms_version` when terms are accepted |
| `privacy_version` | string, up to 32 | stored as `privacy_version` when privacy is accepted |

Old clients that send none of them keep working: nothing is stamped and the existing onboarding screen still collects acceptance (`PATCH /api/users/onboarding/`). An existing timestamp is never overwritten.

`POST /api/auth/apple/mobile/` and `POST /api/auth/google/mobile/` accept the same four fields in the request body and stamp them on the signed-in account the same way (new or existing; once only).

Setting `REQUIRE_TERMS_ON_REGISTER` (environment variable, default `false`): when `true`, register answers 400 without both acceptances:

```json
{ "terms_accepted": "You must accept the Terms of Use to create an account.", "privacy_accepted": "You must accept the Privacy Policy to create an account." }
```

(Only the missing key is present.) It applies to `register` only, not to social sign-in.

## App config (public)

`GET /api/config/` (no auth; a bad token header is ignored) → 200:

```json
{
  "terms_url": "https://irlobby.com/terms",
  "privacy_url": "https://irlobby.com/privacy",
  "support_email": "support@irlobby.com",
  "church_admin": { "name": "Pastor Rob", "email": "rob@example.org", "phone": "+12155550100" }
}
```

`terms_url`, `privacy_url` and `support_email` are strings (or `null` if configured blank). `church_admin` is `null` when no contact is configured; otherwise each of `name`, `email`, `phone` is a string or `null`. Environment: `FOYER_TERMS_URL`, `FOYER_PRIVACY_URL`, `FOYER_SUPPORT_EMAIL` (default `support@irlobby.com`), `FOYER_CHURCH_ADMIN_CONTACT_NAME`, `FOYER_CHURCH_ADMIN_CONTACT_EMAIL`, `FOYER_CHURCH_ADMIN_PHONE` (all default empty).

The server also serves `GET /terms` and `/terms/` as HTML, exactly like `/privacy`, from `deploy/oracle/legal/terms.html` (and nginx serves the same file at `https://irlobby.com/terms`). The file in the repo is a marked placeholder until the approved terms replace it.

## Report content

Every report is stored as an `AbuseReport` with `target_type` (`user` | `chat_message` | `direct_message` | `event_photo` | `activity` | `join_request`, default `user`), `target_id` (id of what was reported, or `null` for old reports) and `target_snapshot` (a copy of the content, whitespace collapsed, up to 200 characters, so it can still be reviewed if the content is deleted). `reported_user` is the person responsible (the host for a photo or gathering) and may be `null` on very old data. New reports also email `FOYER_SUPPORT_EMAIL` (best effort; a mail failure never fails the request, and a duplicate sends nothing). Reports show in the Django admin under Moderation > Abuse reports, filterable by status and target type.

All endpoints need auth (401 otherwise). Body for all: `{ "reason"?: string, "description"?: string }`. `reason` is one of `inappropriate`, `spam`, `harassment`, `fake_profile`, `threat`, `other` (default `other`; anything else → 400 `{ "reason": "Unknown reason." }`). `description` is HTML-stripped, up to 500 characters (longer → 400 `{ "description": … }`).

| Endpoint | Who may report | Reported user | `target_id` | Snapshot |
| --- | --- | --- | --- | --- |
| `POST /api/activities/<id>/chat/<message_id>/report/` | host, staff, or going attendee (same access as the gathering chat) | the message's sender | message id | message text |
| `POST /api/activities/<id>/photos/<photo_id>/report/` | anyone who can see the gathering | uploader (`EventPhoto.uploaded_by`), else the host | photo id | the photo's stored file path |
| `POST /api/activities/<id>/report/` | anyone who can see the gathering | the host | activity id | "title: description" |
| `POST /api/activities/<id>/requests/<request_id>/report/` | host, staff or church admin only (like the requests list) | the requester | the request (participant) id | "first name: bio" |

Responses: **201** `{ "id", "status": "pending", "target_type", "target_id" }` for a new report. **200** with the same shape and the existing `id` if this reporter already reported this exact target (nothing new is created or emailed). **400** for reporting yourself (`{ "detail": "You cannot report yourself." }`), an unknown reason, or a long description. **401** anonymous. **403** a chat message report from someone outside the chat, or a request report from anyone but the host/staff. **404** the gathering is hidden from you (same visibility as the detail endpoint), the message/photo/request is not part of that gathering, or the person involved is blocked either way with you (a blocked person's messages are hidden from you, and a blocked requester is hidden from the host).

Existing endpoints now fill the same fields and return `target_type` and `target_id` too: `POST /api/users/<id>/report/` and `POST /api/moderation/report/` record `target_type: "user"`; `POST /api/messages/direct/<conversation_id>/report/` records `direct_message` (with the message id and text snapshot) when `message_id` is sent, otherwise `user`. Those three do not de-duplicate and keep their previous responses plus the two new keys.

New field on photos: `EventPhoto.uploaded_by` (set when the host uploads; not shown in any payload).

## Blocks inside gatherings

People blocked either way (you blocked them, or they blocked you) are hidden from you inside gatherings. No response shape changes; the items are simply left out:

- `GET /api/activities/<id>/chat/` leaves out messages whose sender is blocked either way with the viewer. Other members still see those messages.
- `GET /api/messages/conversations/<id>/messages/` (and the `messages` array nested in `GET /api/messages/conversations/`) leave out the same messages.
- Websockets: both the gathering socket (`/ws/?activityId=`) and the conversation socket (`/ws/chat/<id>/`) no longer deliver `chat_message`, typing, read receipts or presence events whose `userId` is blocked either way with the receiving user. This is checked on every event, so a block made while a socket is open takes effect immediately. (There is no websocket history replay; history comes from the REST calls above.)
- `GET /api/activities/<id>/attendees/` (host view) leaves out the households of users blocked either way with the host. `going_count` is still the true total. The attendee-facing list of other people going already left out blocked users.
- Chat message reports on a blocked sender's message return 404 (see Report content).

## Account deletion

`DELETE /api/users/profile/delete/` (auth required; 401 otherwise) deletes the signed-in account. No body. Returns **204** (empty on the wire) on success. A `500` `{ "error": "Failed to delete profile", ... }` means nothing more could be done; the call is safe to retry. It is a hard delete: there is no grace period and the tokens stop working at once.

Order of work: (1) upcoming gatherings the user hosts are cancelled and attendees told, (2) the user's uploaded photos, invites and gathering chats are handled, (3) the account row is deleted (database cascades), (4) the Sign in with Apple token is revoked at Apple.

**Removed**
- The account and everything on it: name, username, email, phone, bio, birth date, sex, avatar, church, location, preferences (including notification and privacy settings), terms/privacy acceptance record, password and login identities (email, Apple, Google), device push tokens, and refresh tokens.
- Friends, friend requests (sent and received) and blocks (both ways).
- Family members (household dependents).
- Every RSVP, join request, swipe and ticket.
- 1:1 chats, including the other person's messages in them.
- The user's own messages in gathering chats.
- Reviews written by or about the user.
- Every photo the user uploaded to any gathering, as database rows and as files on disk (the host's delete-photo call and any deletion of a photo now remove the file too).
- Every gathering the user hosted, with its RSVPs, chats and photos. Upcoming ones (not cancelled, not started) are cancelled first: each confirmed attendee and pending requester gets the "<title> was cancelled" push with reason "The host deleted their account." and a chat note is posted in the gathering chat. The gathering is then deleted, so it no longer appears anywhere (it does not remain as a cancelled entry). Past and already-cancelled gatherings are deleted without notifications. A failed push never blocks deletion.
- Contact details in invites that other people sent to the user's email address (case-insensitive) or phone number, and in invites the user accepted: `contact_name` and `contact_value` are blanked, `invitee` is cleared. The row itself stays for the inviter. Invites the user sent are deleted.
- Sign in with Apple: the stored refresh token is revoked at `https://appleid.apple.com/auth/revoke` (best effort).

**Kept**
- Gathering chats other people are still in, without the user's messages. A gathering chat is tied to two "anchor" attendees; if the user was one, the chat is moved to the first and last remaining confirmed attendees (or merged into the chat that pair already has). If fewer than two confirmed attendees remain, nobody could open it, so it is deleted.
- Abuse reports the user filed, and reports about the user (for 12 months of moderation; the retention sweep is operational, not an API). `reporter` / `reported_user` are cleared; kept: report id, reason, description, status, created date, admin notes, `target_type`, `target_id`, and the short `target_snapshot` text. No name or email is stored on a report.
- Server logs and backups age out on their normal schedule.

Not touched: payments. Foyer takes none; any leftover Stripe Connect account id on the user row is deleted with the row but no Stripe account is closed.

### Sign in with Apple token (optional)

`POST /api/auth/apple/mobile/` accepts one more optional field, `authorization_code` (or `authorizationCode`): the one-time code from the native Sign in with Apple result. When the server has Apple signing configured it trades the code at `https://appleid.apple.com/auth/token` and stores Apple's refresh token on the Apple login record, only so it can be revoked on deletion. The response is unchanged and never contains it. Anything that goes wrong (no code, Apple down, bad code, not configured) is ignored and sign-in still succeeds. Env (all must be set for this to run): `APPLE_TEAM_ID`, `APPLE_SIGNIN_KEY_ID`, `APPLE_SIGNIN_PRIVATE_KEY` (the `.p8` contents; `\n` allowed for newlines), and the client id is the first entry of `APPLE_OAUTH_AUDIENCES`. With any of them missing, deletion skips the Apple call.

Database changes: `SocialAuthIdentity.apple_refresh_token` (secret text, default ""); `AbuseReport.reporter` is now nullable with `on_delete=SET_NULL`.

# Birthdays (additive)

Rules (Aaron's decisions): only adults can share their own birthday. A child's birthday is **never** shared with anyone but the parent, and is used only for age checks. There is no per-child "show on profile" field.

## Household members: birth fields (owning parent only)

`GET /api/users/household/` (`children` and `members`), and the 201 body of `POST /api/users/household/`, now carry these on every child:

```json
{
  "id": 1, "name": "Kid", "relationship": "child", "sex": "female", "age": 9,
  "birth_month": 3, "birth_year": 2017, "birth_day": null, "birth_precision": "month"
}
```

- `birth_precision`: `"month"` (only month and year stored) or `"day"` (a real full date is stored).
- `birth_day`: day of month, `null` when the precision is `"month"`.
- `date_of_birth` (`YYYY-MM-DD`): present with a real value **only when a full date is stored**. It is never a made-up last day of the month. In the legacy `children` list and the POST body the key is always there, `null` when month-only; in `members` the key is left out when month-only.
- A spouse has `birth_month`, `birth_year`, `birth_day` and `birth_precision` all `null`, and no `date_of_birth`.
- `age` is computed as before. Month-only children are aged from the last day of their birth month, so a child never looks older than they are.
- Only the owning parent receives any of this. Hosts (`/activities/<id>/attendees/`, `/activities/<id>/requests/`), other attendees, profile cards, friend lists and `/api/friends/birthdays/` expose a child's **age band only** ("under 13", "13-17", "adult"), never a birth month, day, year or date. A test asserts this.

`POST /api/users/household/` accepts an optional `birth_day` (1-31) with `birth_month` + `birth_year`, or the existing full `date_of_birth` / `birth_date`. Rules: a real calendar date, not in the future (including a month/year later than this month), and the child must be under 18 (`"Only children under 18 can be added to a household."`). `relationship` stays optional and defaults to `"child"`. Errors are keyed `birth_day`, `birth_month` or `date_of_birth`.

## `PATCH /api/users/household/<id>/`

Owner only: anyone else (or an unknown id) gets 404 `{"detail": "Family member not found."}`. Body, all optional:

- `birth_day`: 1-31 sets the day using the stored month and year (so `date_of_birth` becomes a real date and `birth_precision` becomes `"day"`). `null` clears it back to month-only.
- `date_of_birth` (or `birth_date`): replaces the whole birth date.
- `name`, `sex`: unchanged unless sent.

The same checks run again: real date, not in the future, under 18, and a 13-17 child that matches an existing teen account still gets the `name` error. A spouse has no birth data: `birth_day` / `date_of_birth` → 400. 200 returns the same body as the POST (the child object plus `members`).

## `show_birthday` (adults only)

`GET/PATCH /api/users/profile/` has a new field `show_birthday` (bool, default `false`), readable and writable on your own profile.

- `show_birthday: true` is rejected with 400 `{"show_birthday": ["Birthdays can only be shared by accounts 18 and older."]}` when the account is under 18, or `["Add your birth date before sharing your birthday."]` when no birth date is on file. If a birth-date change makes the account a minor, `show_birthday` is switched off.
- Other people can see only your **month and day, never the year**, and only when all of these hold: `show_birthday` is on; you are 18 or older; the viewer is inside your `profile_visibility` level (`only_me` = nobody, `friends` = accepted friends, `church` = same church or friends, `public` = any logged-in user, same rules as email/phone); and nobody blocked the other.
- `GET /api/users/<id>/profile/` adds `"birthday": {"month": 8, "day": 17}` to the full card when those hold, otherwise the key is absent. Feb 29 birthdays show as 2/29.

## `GET /api/friends/birthdays/` (auth)

Your accepted friends whose birthday is today or in the next 7 days, sorted by `days_until` then name:

```json
{ "birthdays": [ { "user_id": 12, "name": "Anna", "month": 10, "day": 5, "days_until": 3 } ] }
```

- Same rules as above for each friend: `show_birthday` on, 18+, your level allowed by their `profile_visibility` (friends with `only_me` are left out), not blocked either way, active account. Your own birthday is not listed. No year, ever.
- `name` is the first name (`"Guest"` if empty). `month`/`day` are the upcoming celebration date, so a Feb 29 birthday shows `2`/`28` in a non-leap year and `2`/`29` in a leap year. The window wraps the year end (Dec 28 sees Jan 3). "Today" is the New York date.
- Empty list: `{"birthdays": []}`. Unauthenticated → 401.

## Daily birthday push

**Off by default (not yet approved).** The push is gated by the env var / Django setting `BIRTHDAY_PUSH_ENABLED` (default `False`). While it is off, the beat entry `friend-birthday-notifications` is not registered and `users.tasks.send_birthday_notifications` is a no-op (returns `{"celebrants": 0, "sent": 0, "disabled": true}`, sends nothing). Set `BIRTHDAY_PUSH_ENABLED=true` and restart `celery_beat` and `celery_worker` to turn it on. The endpoint `GET /api/friends/birthdays/` is not affected by this flag.

When enabled, Celery beat task `users.tasks.send_birthday_notifications` runs daily at 13:00 UTC (9am Eastern in summer, 8am in winter). For each adult with `show_birthday` on whose birthday is today (Feb 29 → Feb 28 in non-leap years) it sends one push to each friend allowed to see it (same rules as the endpoint, so blocked users and `only_me` get nothing), using the existing Expo push setup. A recipient who turned off push notifications (`preferences.notifications.pushNotifications = false`) gets nothing. Payload: `{"type": "friend_birthday", "userId": <id>, "screen": "Profile"}`; the text never contains a year. Requires the existing Celery beat process to be running.

Database change: `users.User.show_birthday` (bool, default false), migration `users/0016_user_show_birthday`. No change to `HouseholdDependent`.

