---
name: financemanager-deploy
description: Ship a change to the Save Your Penny web app and its API, and verify each one is actually live. Use when asked to deploy, publish, push, or confirm a fix is running in production. Covers the two-repo split (Vercel for the web app, GitHub Actions to Docker Hub to Render for the API), how to check what is actually deployed, and the CockroachDB sequence-drift failure mode.
compatibility: opencode
metadata:
  project: financemanagerAngular17
---

## What I do

The product is two repos that deploy through different pipelines, and neither
one has a "deploy succeeded" signal you can trust on its own. This skill walks
the push → pipeline → verify loop for each side and tells you what to check
before telling the user a fix is live.

## The two sides

| | Web app | API |
|---|---|---|
| Repo | this one | `../FinanceManagerApi` |
| Host | `https://financemanager.muhit.dev` | `https://fmapi.muhit.dev` |
| Pipeline | `.github/workflows/ci.yml` — build + audit + karma tests. **No deploy step.** | `CI/CD` — build, test, Docker push, migrate, notify Render |
| Deploy | **Vercel's GitHub integration**, on push to `main` | Docker Hub → Render pulls the image |
| Signal | none — verify by fetching the site | the workflow's green tick, then wait for Render |

## Web app

```bash
git push origin main
gh run list --repo musarratChowdhury/financemanagerAngular17 --limit 3
```

A green CI run proves the code **builds and tests pass**. It says nothing about
the site. Verify the deployed bundle:

```python
import requests, re
r = requests.get('https://financemanager.muhit.dev/')
main = [s for s in re.findall(r'<script[^>]+src="([^"]+)"', r.text) if 'main-' in s][0]
js = requests.get('https://financemanager.muhit.dev/' + main.lstrip('/')).text
print(main, len(js))
print('your marker in bundle:', 'your-marker' in js)
```

The bundle filename is content-hashed (`main-<hash>.js`), so a changed filename
means a new deploy landed. If the filename is unchanged, the push has not
deployed yet (or Vercel rejected the build — check the Vercel dashboard).

If the browser still shows the old behaviour but the bundle is new, suspect the
**service worker**: it caches assets under `ngsw:/:db:<hash>:assets:app:cache`.
Hard-reload or unregister the SW before concluding the fix is broken.

## API

```bash
cd ../FinanceManagerApi
git push origin main
gh run list --repo musarratChowdhury/FinanceManagerApi --limit 3
gh run view <id> --repo musarratChowdhury/FinanceManagerApi --log-failed
```

The workflow order is: build → test → **push Docker image** → apply EF
migrations → notify Render. Two consequences:

- A failure **after** the image push leaves a new image on Docker Hub that
  Render may still auto-deploy.
- `RENDER_DEPLOY_HOOK_URL` is not configured, so Render polls Docker Hub on its
  own schedule. A green workflow does not mean the API is live — wait a few
  minutes, then probe the API for the behaviour you changed.

```python
import requests
r = requests.post('https://fmapi.muhit.dev/api/Authentication/login',
                  json={'email': 'admin@gmail.com', 'password': '123456'}, timeout=60)
tok = r.json()['token']
# probe the specific endpoint your fix touched
```

## The failure mode worth knowing

A 500 on `POST /api/Expense/Create` while reads work fine is usually **not** a
code bug — it is the `Expenses_Id_seq` sequence drifting **behind**
`max(Expenses.Id)`, so the insert collides with an existing primary key.

```sql
SELECT setval('"Expenses_Id_seq"',
               (SELECT COALESCE(MAX("Id"), 0) FROM "Expenses") + 1, false);
```

Run it through the `cockroachdb-cloud` MCP or `psycopg2`. A sequence *ahead* of
`max(Id)` is harmless (id gaps); behind it is the bug.

## Verify the whole flow

Once both sides are deployed, run the end-to-end test against production —
that is the only check that exercises the browser, the API and the database
together. See the `financemanager-e2e` skill.

## Checklist

1. Both repos clean, committed, pushed to `main`.
2. Web CI green **and** the deployed `main-<hash>.js` contains your change.
3. API CI green **and** the live API responds with the new behaviour.
4. `npx playwright test` green against `https://financemanager.muhit.dev`.
5. No leftover test rows in the ledger.
