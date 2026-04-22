# IRLobby

IRLobby is a social activity matching platform with a React web app in `apps/web` and an Expo app in `apps/mobile`, backed by the Django API in `irlobby_backend` and shared types/utilities in `packages/shared`.

## Support status

- `apps/mobile`: active and supported
- `apps/web`: active and supported
- `irlobby_backend`: active and supported
- `packages/shared`: active and supported

## Repository layout

- `apps/mobile` — React Native / Expo mobile app
- `apps/web` — React + Vite web app (public site + authenticated app)
- `irlobby_backend` — Django REST + WebSocket backend
- `packages/shared` — shared schema and utility code

## Quick start

### Prerequisites

- Python 3.12 or later recommended
- Node.js 20.x recommended
- Git

### Backend

```bash
cd irlobby_backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
# Add Stripe credentials before running the app
# STRIPE_API_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL, ENABLE_TICKETING
python manage.py migrate
python manage.py runserver
```

The API is available at `http://localhost:8000`.

### Mobile

```bash
cd apps/mobile
npm install
npm run start
```

Follow the Expo CLI instructions to open the app in a simulator or on device.

## Root scripts

- `npm run dev` — starts the mobile app
- `npm run build` — builds the mobile app bundle
- `npm run build:web` — builds the web app deployment bundle
- `npm run check:api-contract` — validates frontend API path usage against Django routes
- `npm run check:web` — runs web tests and web production build
- `npm run check:mobile` — runs mobile typecheck and iOS bundle export
- `npm run check:release` — runs API contract, web, and mobile release gate checks

## Mobile builds

Production iOS builds can be triggered automatically from GitHub Actions via `.github/workflows/mobile-eas-build.yml` once:

1. the `EXPO_TOKEN` repository secret is configured, and
2. one successful manual `eas build -p ios --profile production` has been completed so EAS has the required iOS build credentials, and
3. one successful manual `eas submit -p ios --profile production` has been completed, or an App Store Connect API key has been configured in Expo, so CI can submit non-interactively.

See `apps/mobile/APP_STORE_RELEASE.md` for the current release process.

## CI

The active CI workflows validate the web app, mobile app, shared API contract assumptions, and Django backend.

## Notes

- `vercel.json` has been removed and deployment is currently managed through cPanel Git deployment.
- The legacy `client/` folder has already been removed from the repository.

## Deployment notes

Production deployments currently target the mobile app plus an Oracle VM backend using Docker Compose with a Neon PostgreSQL database. See `irlobby_backend/deploy/oracle/README.md` for the backend deployment runbook.


## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with the backend checks and the active mobile checks
5. Submit a pull request

---

## License

MIT
