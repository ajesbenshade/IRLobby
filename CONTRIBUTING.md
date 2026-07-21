# Contributing to IRLobby

IRLobby is proprietary software. This repository is closed source.

Contribution access is limited to internal team members and authorized contractors or partners under a signed agreement.

If you are not an authorized contributor, do not submit code changes. Do not reuse project source. For commercial licensing or partnership inquiries, contact legal@irlobby.com.

## Before you start (authorized contributors)

1. Read the root [README](README.md).
2. Run the quick-start path for the area you plan to change.
3. Create a branch from `main` with a short, descriptive name in the approved internal workflow.
4. Install the local secret guard before you work with environment files:

```bash
bash scripts/install-secret-guard.sh
```

Do not commit real `.env` files, private keys, API keys, mobile store credentials, service-account JSON, or reviewer account passwords. Use `.env.example` placeholders in docs and examples.

## Project areas

- `apps/mobile` — Expo and React Native mobile app
- `apps/web` — React, Vite, and Tailwind web app
- `irlobby_backend` — Django REST API, WebSockets, Celery, and deployment assets
- `packages/shared` — shared schema and utility code
- `docs` — release, deployment, parity, email, and product documentation

## Development checks

Run the checks that match the files you changed:

```bash
npm run check:api-contract
npm run check:web
npm run check:mobile
npm run check:release
```

For backend changes, also run these commands from `irlobby_backend`:

```bash
python manage.py check
pytest
```

For Python quality checks, CI also runs `ruff`, `black --check`, `mypy`, Bandit, and Safety. If a pull request changes backend behavior, include the relevant pytest coverage. If existing coverage is enough, explain why.

## Pull request expectations

- Keep the change focused on one behavior, screen, or documentation task.
- Match the existing style in the area you edit.
- Include screenshots or short screen recordings for visible UI changes.
- State any migrations, environment variables, or deployment steps that reviewers need.
- Link related issues or release checklist items when they apply.

All code submissions must come from authorized contributors under the project proprietary terms.

## Release and deployment docs

- [Deployment overview](docs/DEPLOYMENT.md)
- [Oracle backend runbook](irlobby_backend/deploy/oracle/README.md)
- [App Store release flow](apps/mobile/APP_STORE_RELEASE.md)
- [Launch checklist](LAUNCH_CHECKLIST.md)
- [Play Store launch checklist](PLAY_STORE_LAUNCH.md)

## Maintainer notes

Public GitHub metadata is tracked in [docs/REPOSITORY_SETTINGS.md](docs/REPOSITORY_SETTINGS.md). Update that checklist when the repository description, topics, website URL, or social preview changes.
