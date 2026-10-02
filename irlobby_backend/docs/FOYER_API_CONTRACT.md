# The Foyer API contract

Mobile client contract for gatherings. Existing auth (`POST /api/users/register/`, `POST /api/users/login/`, `GET/PATCH /api/users/profile/`) is unchanged except for the profile and registration fields below. All authenticated routes use `Authorization: Bearer <access>`.

Dates are ISO-8601. Ages are computed in `America/New_York`. `capacity` is people, not accounts: `null` means unlimited, otherwise 1–500. `platform_fee_percent` is always `0`.

Giving and donations are out of scope for this build. There is no gift amount, Checkout Session, or church Stripe account in the API. Those can return later. RSVP stays free.

## Profile and registration

`POST /api/users/register/` (no auth)

Extra optional fields: `date_of_birth` (`YYYY-MM-DD`), `sex` (`male` | `female`).

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
- When only month/year is stored, `date_of_birth` is the last day of that month (never older than the child is).

`DELETE /api/users/household/<id>/` → 204 (unchanged).

`POST /api/activities/<id>/rsvp/` accepts `member_ids` (same list as `dependent_ids`; both are merged). The response and `my_rsvp` return both `dependent_ids` and `member_ids`. A spouse counts as an adult for sex rules and any age range, except events with `age_max` under 18.

`GET /api/activities/<id>/whos-coming/` returns the same people under `dependents` and `members` (each has `relationship`, `birth_month`, `birth_year`; spouse `age` is `null`).

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
- Never includes location, family, birth date, username or last name.

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
- Every confirmed attendee except the host and whoever cancelled gets one push notification (`title` "<title> was cancelled", body "<title> was cancelled. Reason: <reason>", data `{ "type": "activity_cancelled", "activityId", "screen": "Activity" }`), including accounts that are going only for a spouse or child. Pending and declined RSVPs are not notified. Sent after the database commit, through the Expo push helper (respects the user's `pushNotifications` preference). There is no separate in-app notification inbox.
- If a gathering chat already exists, a message "<title> was cancelled by the host. Reason: …" is added to it (sender = the person who cancelled). The chat stays fully open after cancelling: reads and sends (REST and websocket) keep working, so the host can announce a new date.
- Cancelled gatherings are left out of `GET /api/activities/` (the swipe deck and browse list), `GET /api/public/calendar`, `GET /api/public/calendar.ics` and `GET /api/public/events/<id>.ics` (404). They are still returned by `GET /api/activities/<id>/`, `/hosted/` and `/going/` with `is_cancelled: true`; photos and the signed-token `event.ics` keep working (that file now carries `STATUS:CANCELLED`).
- New RSVPs (`POST /rsvp/`), legacy `POST /join/`, swipes (`POST /api/swipes/<id>/swipe/`, `POST /api/swipes/`) and ticket purchases on a cancelled gathering → 400.
- Clients cannot set `is_cancelled`, `cancelled_at` or `cancel_reason` through `PATCH`.

## Photo downloads

`GET /api/activities/<id>/photos/download/` → `{ "photos": [ { "id", "filename", "url", "expires_at" } ] }`. Allowed: any logged-in user for public-calendar events; otherwise host, staff, or a confirmed going attendee once the event has started; else 403. Each `url` is a signed original (about 1 hour, separate salt) that needs no auth header and responds with `Content-Disposition: attachment` and `Cache-Control: private`. Invalid or expired → 403. Every photo of the event is included (no per-photo opt-out).

## Hidden addresses

For member-hosted events (`host_kind` `person`, not on the public church calendar), `location`, `latitude` and `longitude` are `null` in activity responses unless the viewer is the host, staff, has a going RSVP, or holds a paid ticket. Church-hosted and public-calendar events are unchanged. `calendar_links` for a viewer who cannot see the address use an `ics_url` whose file has an empty `LOCATION`, and Google/Outlook links with no location.
