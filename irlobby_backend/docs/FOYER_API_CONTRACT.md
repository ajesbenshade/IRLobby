# The Foyer API contract

Mobile client contract for gatherings. Existing auth (`POST /api/users/register/`, `POST /api/users/login/`, `GET/PATCH /api/users/profile/`) is unchanged except for the profile and registration fields below. All authenticated routes use `Authorization: Bearer <access>`.

Dates are ISO-8601. Ages are computed in `America/New_York`. `capacity` is people, not accounts: `null` means unlimited, otherwise 1–500. `platform_fee_percent` is always `0`.

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
{ "id": 1, "name": "Franconia Mennonite Church", "is_verified": true, "can_receive_gifts": false }
```

Seeded verified churches: Franconia, Souderton, Blooming Glen, Plains, Zion, Perkasie, Deep Run East, and Finland Mennonite Church.

`POST /api/churches/` (auth)

```json
{ "name": "Typed Chapel" }
```

201 if created (always `is_verified: false`). 200 if that name already exists (case-insensitive). The Stripe account id is never returned.

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
| `donation_enabled` | bool, default false |
| `suggested_donation` | decimal string or `null` |
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
  "donation_enabled": true,
  "suggested_donation": "10.00",
  "host_kind": "person",
  "host_church_id": null,
  "host_name": "Sarah Host",
  "cover_photo_url": null,
  "going_count": 0,
  "my_rsvp": null,
  "photos": [],
  "giving_available": false,
  "gift_disclaimer": "This gift goes to Sarah Host directly. It is not a tax-deductible gift to Franconia Mennonite Church.",
  "fee_note": "Stripe's card fee applies. The Foyer takes no cut.",
  "platform_fee_percent": "0.00"
}
```

`audience` chip text: `Everyone`, `Women · 18+` (min ≥ 18 and no max), `Everyone · Ages 6+` (min under 18 and no max), `Everyone · Ages 6–17` (both bounds).

`host_name` is the person's first and last name, or the church name when `host_kind` is `church`. `gift_disclaimer` and `fee_note` are `null` when `donation_enabled` is false. For a church host the disclaimer is `Your gift goes to <church name>.` and does not include the personal-host tax sentence.

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

RSVP does not charge anyone. Gifts are a separate Checkout Session opened in Safari.

`POST /api/activities/<id>/giving-link/` (auth)

Requires `donation_enabled`, a confirmed going RSVP (yourself or a household child), and a connected account: the host's Stripe account for `host_kind: person`, or `Church.stripe_account_id` for `host_kind: church`. The church Stripe id is set in Django admin, not by the mobile API.

```json
{ "amount": "10.00", "success_url": "https://api.irlobby.com/tickets/success", "cancel_url": "https://api.irlobby.com/tickets/cancel" }
```

`success_url` and `cancel_url` are optional and use the existing ticket bounce URLs. 201:

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_...",
  "session_id": "cs_...",
  "amount": "10.00",
  "currency": "usd",
  "host_kind": "person",
  "host_name": "Sarah Host",
  "tax_deductible": false,
  "disclaimer": "This gift goes to Sarah Host directly. It is not a tax-deductible gift to Franconia Mennonite Church.",
  "fee_note": "Stripe's card fee applies. The Foyer takes no cut.",
  "platform_fee_percent": 0,
  "application_fee_amount": 0
}
```

Open `url` in the system browser. For a church host, `tax_deductible` is `null` and `disclaimer` is `Your gift goes to <church name>.`

The charge is a Stripe Connect **direct charge** on the recipient account (`Stripe-Account` header) with `application_fee_amount: 0`. `STRIPE_ALLOW_LIVE_MODE` still blocks live secret keys.

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

## Stripe Connect finding

Current onboarding (`users/stripe_connect.py`) creates an Accounts v2 **Express** account (`dashboard: "express"`), not a Standard account (`dashboard: "full"`). It was recipient-only (`configuration.recipient` with `stripe_transfers` and `payouts`; `fees_collector` and `losses_collector` are `application`).

Direct charges need the **merchant** `card_payments` capability. Recipient-only Express accounts cannot take them, so hosts who already onboarded have to re-onboard. New onboarding requests merchant `card_payments` alongside recipient transfers, and opening the onboarding link again requests merchant configuration on an existing account. Responsibilities cannot be changed later, so the platform still collects Stripe fees and the application fee stays 0. Legacy ticket destination charges and QR codes are left in place and unused; their application fee is also forced to 0.
