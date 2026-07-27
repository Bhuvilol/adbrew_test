# Todo App — Django · React · MongoDB

A small full-stack todo list application: a React (hooks-only) frontend backed by a Django REST API, persisting directly to MongoDB, with all three services running in Docker.

> This project was built as a take-home assignment for a Backend SDE Intern role at Adbrew. For the full reasoning behind every design and debugging decision, see **[APPROACH.md](APPROACH.md)**.

## Stack

| Layer    | Technology                          |
|----------|--------------------------------------|
| Frontend | React 17 (hooks), Create React App   |
| Backend  | Django 3 + Django REST Framework     |
| Database | MongoDB 4.4, via `pymongo` (no ORM)  |
| Infra    | Docker + Docker Compose, 3 containers |

## Architecture

Three containers, one shared base image, each running a different process:

| Service | Container | Port    | Runs                                          |
|---------|-----------|---------|------------------------------------------------|
| `app`   | `app`     | `3000`  | React dev server (`yarn start`)                |
| `api`   | `api`     | `8000`  | Django dev server (`manage.py runserver`)      |
| `mongo` | `mongo`   | `27017` | `mongod`                                        |

Your local `src/` directory is bind-mounted into both `app` and `api`, so code edits are picked up live without rebuilding. Mongo's data is bind-mounted to `src/db/` on the host, so data survives container restarts.

## Prerequisites

- Docker Desktop, with either the `docker compose` CLI plugin or the legacy `docker-compose` binary.

## Getting started

**1. Clone the repository** and move into it:
```
git clone <this-repo-url>
cd adb_test
```

**2. Set the codebase path env var** (Compose reads this to know what to bind-mount as `/src` in each container):

macOS/Linux:
```bash
export ADBREW_CODEBASE_PATH="$(pwd)/src"
```

Windows (PowerShell):
```powershell
$env:ADBREW_CODEBASE_PATH = "$(pwd)/src".Replace('\', '/')
```

**3. Build the images** (first time only, or after a `Dockerfile` change — this takes a few minutes):
```
docker compose build
```

**4. Start the containers:**
```
docker compose up -d
```

**5. Verify everything's up:**
```
docker ps
```
You should see three running containers: `app`, `api`, `mongo`. Note: `app` can take a minute or two longer than the others on first start, since it's installing all of React's dependencies before the dev server comes up.

**6. Open the app** at http://localhost:3000 — you can also confirm the API directly at http://localhost:8000/todos/, which should return `[]` on a fresh database.

**Stopping everything:**
```
docker compose down
```

## Usage

Once the app is open at `localhost:3000`:

1. Type a description into the "ToDo" text box and click **Add ToDo!**. The input clears and your new todo appears in the list above.
2. Refresh the page (or close and reopen the tab) — your todos are still there, since they're persisted in MongoDB, not just held in the page's memory.
3. Repeat as needed — there's no limit on the number of todos.

## API reference

| Method | Path      | Body                        | Response                                                                     |
|--------|-----------|------------------------------|-------------------------------------------------------------------------------|
| GET    | `/todos/` | —                            | `200` — JSON array of `{ id, description }`                                  |
| POST   | `/todos/` | `{ "description": "..." }`   | `201` with the created `{ id, description }`; `400` if `description` is empty |

## Running tests

```
docker exec -it app bash -c "cd /src/app && yarn test --watchAll=false"
```

## Project structure

```
.
├── Dockerfile              # single shared image for all 3 services
├── docker-compose.yml
└── src/
    ├── app/                # React frontend
    │   └── src/App.js
    └── rest/                # Django backend
        └── rest/
            ├── views.py     # TodoListView (GET/POST /todos)
            └── urls.py
```

## Useful commands

```
docker logs -f --tail=100 <container_name>   # view logs (app, api, or mongo)
docker exec -it <container_name> bash        # shell into a container
docker compose down                          # stop everything
docker restart <container_name>              # restart one container
```

## Further reading

See **[APPROACH.md](APPROACH.md)** for the full design write-up — including a genuine debugging saga around an EOL Debian/MongoDB apt dependency, the reasoning behind each backend/frontend decision, the testing approach, and a few trade-offs I deliberately chose not to chase down.
