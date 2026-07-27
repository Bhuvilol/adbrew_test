# Approach & Design Notes

This document is the "why" behind the code — the reasoning, trade-offs, and a couple of genuine debugging detours I hit along the way. The README explicitly calls out understanding (and being able to explain) the Docker setup as a differentiator, so I've documented that journey in full rather than quietly papering over it.

## Guiding philosophy

The assignment itself is small — two backend endpoints, one React component, three containers. My goal was to write code that's production-quality *for that scope*: clear error handling, no dead code, no unjustified abstraction. I tried to actively avoid the opposite failure mode too — building a "repository/service/controller" layered architecture for a two-endpoint app would be over-engineering, not good practice. Where I added structure (a small `serialize_todo` helper, for instance), it's because it removes real duplication, not because it looks more "enterprise."

---

## 1. Getting the Docker setup actually running

This ended up being the most involved part of the whole exercise, and also the part the README most directly invites you to dig into. Running `docker compose build` on a fresh clone failed twice, for reasons that trace back to time itself rather than anything wrong with my approach.

**Failure 1 — MongoDB wouldn't install:**
```
mongodb-org-server : Depends: libssl1.1 (>= 1.1.0) but it is not installable
```
The root cause: the Dockerfile's `FROM python:3.8` is an untagged, "floating" base image. Docker Hub periodically rebuilds it against whatever Debian release is current for Python 3.8's support window — when this assignment was written, that was Debian 10 ("buster"); today it resolves to Debian 12 ("bookworm"). The Dockerfile hardcodes MongoDB 4.4's apt repo for buster specifically (that's the only Debian release Mongo 4.4 ever shipped packages for), and those packages depend on `libssl1.1` — a package Debian 12 dropped entirely in favor of OpenSSL 3.

I considered two fixes:
- **Swap the `mongo` service to the official `mongo:4.4` Docker Hub image** instead of building it from our shared apt-based image. This is arguably the more idiomatic Docker pattern (custom-build only what you need to customize), and it would have sidestepped the problem entirely.
- **Pin the base image to `python:3.8-buster` and get apt working on it again.**

I went with the second option, deliberately, even though it's more work: the assignment explicitly frames the Dockerfile as something to understand *and debug*, not something to route around. Swapping in a pre-built image would have avoided demonstrating exactly the skill being tested for.

That meant a second layer of work: Debian buster itself is now fully end-of-life, and its packages were pulled off the live `deb.debian.org` mirrors onto a frozen `archive.debian.org`/`snapshot.debian.org`. I initially guessed at rewriting `/etc/apt/sources.list` to point at `archive.debian.org`, which got the main package list working but missed the security-suite line (a different, non-obvious hostname pattern). The more reliable fix, once I checked the base image directly (`docker run --rm python:3.8-buster cat /etc/apt/sources.list`), was to use the exact frozen `snapshot.debian.org` mirror lines Debian's own image maintainers had already left commented out in the file for this exact scenario — plus explicitly disabling apt's `Acquire::Check-Valid-Until` check, since a frozen historical snapshot's `Release` file has a fixed, long-past expiry date that apt would otherwise reject as suspicious.

**Failure 2 — `easy_install: command not found`:** this one was simpler and not Debian's fault at all. The Dockerfile had a `RUN easy_install pip` line — a legacy bootstrapping step from old `setuptools` versions. Modern `setuptools` dropped `easy_install` entirely, but the line was actually always dead code: the official `python:3.8` image already ships with a working `pip`, which the very next line (`pip install -r requirements.txt`) already depended on. I just deleted it.

**A third, unrelated issue surfaced later:** the React dev server's file-watcher never noticed edits made from the host, even though the bind-mounted file was genuinely updated. This is a well-known Docker Desktop-on-Windows limitation — native filesystem change notifications (`inotify`) frequently don't propagate across the bind-mount boundary. The fix is to set `CHOKIDAR_USEPOLLING=true` on the `app` service, which makes Create React App's dev server poll the filesystem instead of waiting for a native event.

---

## 2. Backend design (`src/rest/rest/views.py`)

- **No Django ORM/models, per the instructions** — I use the `pymongo` `db` client that was already instantiated in the stub, directly.
- **`serialize_todo()` as a small shared helper**, not inlined separately in `GET` and `POST`: Mongo's `_id` field is an `ObjectId`, which isn't JSON-serializable, so every document needs its `_id` converted to a string `id` before it can go in a `Response`. Writing that conversion once and reusing it in both handlers means the JSON shape returned by `GET` and `POST` is *guaranteed* identical, not just "supposed to match by convention."
- **Narrow exception handling**: I catch `pymongo.errors.PyMongoError` specifically (not a bare `except:`), log the real exception server-side via `logger.exception` (full traceback in container logs), and return a generic, non-leaky error message to the client. A bare except would also silently swallow real programming bugs I'd want surfaced.
- **Validation on `POST`**: an empty/whitespace-only `description` is rejected with `400`, not silently accepted or crashed on. This is enforced server-side (the frontend also checks it, but the API can't trust the frontend to be the only client).
- **`201 Created`** on successful `POST`, not `200` — the more precise status code for "a resource was created."
- **Cleaned up `urls.py`**: the route had a leftover `name='signup'` (clearly copy-pasted from some other project). Fixed to `name='todo-list'`.
- **Removed two unused imports** (`from django.shortcuts import render`, and `json`) left over from Django's project scaffold — neither was ever actually used once the view logic was written.

---

## 3. Frontend design (`src/app/src/App.js`)

- **Hooks only, per the instructions** — `useState` for the todo list, the input's value, and any error message; `useEffect` with an empty dependency array to fetch once on mount (the hooks equivalent of `componentDidMount`).
- **Controlled input**: the text field's value lives in React state (`value={newTodo}` + `onChange`), not the DOM — the idiomatic hooks replacement for what a class component would do with `this.state`.
- **`event.preventDefault()`** in the submit handler: without it, submitting an HTML form triggers a full browser page reload by default, wiping all React state. Easy to miss, breaks the whole app if skipped.
- **Manually checking `response.ok`**: `fetch()` only rejects its promise on a *network* failure — a `400`/`500` HTTP response is still a "successful" fetch as far as the Promise API is concerned. Skipping this check would mean a backend error gets silently treated as valid data.
- **`key={todo.id}`**, not array index, on each rendered `<li>`: index-as-key is a common shortcut that breaks down as soon as items are inserted/removed, since indices shift under the list but React uses them to track identity.
- **`async/await`** instead of chained `.then()/.catch()`: functionally equivalent, but reads more linearly and made the error handling (`try/catch`) clearer once the submit flow started chaining a `POST` followed by a refresh `GET`.
- **Fixed a pre-existing (if minor) accessibility gap**: the original markup had `<label for="todo">` with no matching `id` on the `<input>` — so the label was never actually associated with its field. Added `id="todo"` and changed `for` to the JSX-correct `htmlFor`.
- **A small drive-by markup fix**: the original hardcoded `<li>` elements weren't wrapped in a `<ul>`, which is invalid HTML. Fixed while rewriting the render logic.

---

## 4. Testing approach (`App.test.js`)

I mocked `global.fetch` rather than hitting the real Django/Mongo backend in the frontend's unit tests — a unit test that depends on a live network call is slow, flaky, and order-dependent, which defeats the point of having a fast, isolated test suite. The three tests map directly onto the three behaviors the README's "Task" section describes: the list renders, todos fetched from the API show up, and submitting the form both posts and refreshes the list.

**A worthwhile detour, documented for transparency:** early test runs showed React `act()` warnings coming from the chained `POST → refresh GET` flow. I traced the actual cause — `@testing-library/user-event` v12 (what this project has pinned) dispatches click events synchronously and doesn't wait for an async handler's returned promise to resolve, regardless of whether that handler uses `.then()` or `async/await`. The "correct," purpose-built fix is v14 of that library, which was specifically redesigned to track cascading async updates like this. I tried it — and hit a second wall: v14 requires Node ≥12, while this container's Node (installed via Debian buster's old `apt` package) is v10.24.0.

Fixing *that* would mean upgrading Node inside the shared Dockerfile — the same image all three services build from — which is a real, broader-blast-radius infrastructure change, layered on top of the Debian/MongoDB archaeology from section 1. I made the deliberate call to stop there and revert to the working v12 setup: the warnings are cosmetic (they don't affect the test's pass/fail result or any real user in a browser — `act()` is a testing-only concept), and taking on a third round of EOL-infrastructure surgery purely to silence a console warning would be a poor use of effort for an assignment framed as "a few hours of work." I'd rather make that trade-off explicit than either quietly leave a mysterious warning unexplained, or burn disproportionate time chasing a purely cosmetic result.

---

## 5. Repo & git workflow

- Cloned as a standalone repo (not forked), per the instructions — `origin` points at my own repo; `upstream` points at the original Adbrew repo, kept only as a read-only reference, never a push target.
- All implementation work happened on a separate branch (`bhuvi`), keeping `master` as an untouched mirror of the original scaffold.
- Commits are split by logically complete, independently-verified unit (Dockerfile fix, backend endpoints, `urls.py` cleanup, frontend implementation, final review pass) rather than one giant commit — each one was tested working before being committed.

---

## 6. Things I deliberately left alone

- **`nginx` is installed in the `Dockerfile` but never used** by any service's command. It's clearly unused cruft, but removing it wasn't part of the task, so I left it rather than scope-creep into unrelated Dockerfile cleanup.
- **Django's `settings.py`** still has SQLite configured (unused — Mongo is the real store, per instructions), `CORS_ORIGIN_ALLOW_ALL = True`, and a dummy `SECRET_KEY`. These are all fine for this local-dev submission's scope; I'd harden them for an actual production deployment, but changing security posture no one asked me to touch felt like the wrong kind of initiative to take here.
- **The `act()` test warnings**, as discussed above — a documented, deliberate stopping point rather than an oversight.
