# IRLobby - Your Lobby for IRL Meetups

**IRLobby** is a social activity matching application. It pairs real‑world activities with familiar swipe‑based discovery and includes chat, hosting, and location‑aware features.

---

## Overview

- **Frontend**: React + TypeScript application located in `apps/web`.
- **Mobile**: React Native/Expo project in `apps/mobile` (used for mobile builds).
- **Backend**: Django application under `irlobby_backend` serving a REST/WS API.
- **Shared code**: reusable utilities in `packages/shared`.

> ⚠️ The old `client/` directory was a previous copy of the web frontend. It has been removed; please use `apps/web` going forward.

## Quick port reference

| Service              | Default port | Description                               |
|---------------------|--------------|-------------------------------------------|
| Frontend dev server | 5173         | Vite hot‑reload UI                        |
| Django API          | 8000         | REST endpoints                            |
| WebSocket (ASGI)    | 8001         | real‑time chat via Channels/Daphne        |
| PostgreSQL (Docker) | 5432         | backend database                          |
| Expo mobile server  | 19006        | (when running `expo start` in `apps/mobile`)

---

## Getting Started

### Prerequisites

- Python 3.8 or later
- Node.js 16 or later
- Git

### 1. Backend (Django)

```bash
# from repo root
cd irlobby_backend
python -m venv .venv        # create virtualenv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# copy example env and tweak values
cp ../.env.example .env
# adjust DATABASE_URL, SECRET_KEY etc

# apply migrations
python manage.py migrate

# optionally create an admin user
python manage.py createsuperuser

# start development server (API + WebSocket)
python manage.py runserver
```

The API will be available at `http://localhost:8000`; the WebSocket endpoint is `ws://localhost:8001`.

### 2. Frontend (Web)

```bash
cd apps/web
npm install          # or yarn
npm run dev
```

Open http://localhost:5173 in your browser to view the application.  The frontend talks to the backend at port 8000 by default (see `VITE_API_BASE_URL` in `.env`).

### 3. Mobile (optional)

```bash
cd apps/mobile
npm install
npm run start        # Expo CLI
```

Follow Expo's CLI instructions to launch on simulator or device.

---

## Dockerized development

A simple Docker Compose configuration is provided to run the backend and database together.

```bash
# build and start containers (development configuration):
docker-compose -f docker-compose.dev.yml up --build

# production-like (uses same compose file without overrides):
docker-compose up --build -d
```

Services:
- `db` – Postgres database
- `backend` – Django application (migrations run automatically)

Access the API at the same ports listed above.  You may still run the web frontend with `npm run dev` outside Docker.

---

## Environment variables

Copy `.env.example` to `.env` (backend reads it via `python-decouple`).

```bash
cp .env.example .env
```

The example file contains comments explaining common values such as:

```
# Django
SECRET_KEY=...
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=sqlite:///db.sqlite3
# or: postgresql://user:pass@localhost:5432/irlobby

# API/CORS
domain origins or FRONTEND_BASE_URL

# OAuth / email / third‑party keys
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

# any other custom settings
```

Only the backend reads `.env`; frontend configuration is injected via Vite's `VITE_API_BASE_URL`.

---

## Workspace configuration

This repository uses npm workspaces to manage the JavaScript packages in `apps/` and `packages/`.  Run `npm install` at the root to install dependencies for all workspaces.


## Continuous Integration

A GitHub Actions workflow (`.github/workflows/ci.yml`) installs both Node and Python dependencies, lints/builds the web client, and runs `python manage.py check` to validate the Django configuration.  The workflow will fail early if any path or script is broken.

---

## Legacy/removed

- The `client/` folder has been deprecated and removed.
- Previous Node.js/Express backend and Render-specific instructions are no longer applicable.

---

## Deployment notes

Production deployments currently target an Oracle VM using Docker Compose with a Neon PostgreSQL database.  See `irlobby_backend/deploy/oracle/README.md` for the deployment runbook.  The React frontend can be hosted as static files on any CDN or platform; build output lives in `apps/web/dist`.


## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (backend `pytest` or `manage.py test`, web `npm run test`)
5. Submit a pull request

---

## License

MIT
