# The Foyer – TestFlight beta text (DRAFT for build 94+; Webmaster pastes into App Store Connect)

Source for Mobile's rewrite of apps/mobile/store/metadata/reviewer-demo-account.md. No passwords in this file or the repo; the demo password lives only in App Store Connect.

## Beta App Description
The Foyer helps members of a congregation find and host gatherings together: potlucks, small groups, service days and other events. Members choose their church, see upcoming gatherings from people in their church, RSVP, chat with guests and share photos from the event. This beta is being tested with a small group of Mennonite churches in southeastern Pennsylvania.

## Feedback Email
support@irlobby.com   (pending Aaron's OK)

## Beta App Review Information – notes for Apple's reviewer
Sign in with the demo account entered in the Sign-In Information fields (app-review@irlobby.com).

The demo account already has a home church selected and is exempt from the one-gathering-per-week member limit, so you can create more than one gathering while reviewing.

Suggested path:
1. Sign in. Discover shows upcoming gatherings from the account's church.
2. Open a gathering to see details, RSVP, guest chat and photos.
3. Tap Host to create a gathering (title, time, place, who can see it). Hosts can cancel a gathering (keeps its photos) or delete it (removes the gathering and its photos).
4. Profile lets you change your church. Settings has Send feedback, notifications and account deletion (Settings > Delete account removes the account and the photos it added).

The app has no purchases, payments, ads or tracking. Location is optional and used only to center maps (the Discover map and the place picker when hosting) on where you are. It is off by default; the app asks for location "While Using the App" only after the member turns on "Use my location for maps" in Profile and opens a map. It is never used in the background, and the app does not show distances. [Checked by Mobile against build 94 code, Oct 18]

## What to Test (build 94)
Thanks for trying The Foyer!

Please try:
- Signing up and choosing your church at the new "Your church" step.
- Browsing gatherings from your church and RSVPing to one.
- Hosting a gathering. Members can host one gathering per week; deleting a gathering doesn't free up that week.
- Adding photos to a gathering (up to 30 an hour, 50 per gathering).
- Settings > Send feedback for anything confusing, broken or missing.

Please don't tick "Post to the church website calendar" on test gatherings unless you mean for it to appear on your church's public website.

The app is iPhone-only for now. Please install build 94 or later.
