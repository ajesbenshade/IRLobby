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
  "platform_fee_percent": "0.00"
}
```

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

`POST /api/activities/<id>/photos/` (auth, host or church admin on a church event). Multipart file field `image` (also accepts `photo` or `file`). JPEG, PNG, or WebP. Stored as a compressed JPEG. At most 8.

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

`GET /api/public/calendar.ics` → `text/calendar`. `PRODID:-//Franconia Mennonite Church//The Foyer//EN`. Same events only.

CORS allows `https://franconiamennonite.org`.

## Stripe

The Foyer flow does not use Stripe. Connect onboarding, ticket checkout, and QR validation remain in the codebase from IRLobby and are unused by gatherings. `platform_fee_percent` on an activity is still forced to `0`. Giving can return later; this build does not request `card_payments` or create direct charges.
