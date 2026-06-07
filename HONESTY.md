# HONESTY.md

> Mandatory disclosure for the hackathon. This file lives at the root of your repository. Judges cross-check it against your code and your technical video.
>
> **The deal:** disclosed shortcuts are **not** penalized — that is the entire point of this file. Hidden ones are. Undisclosed pre-built code is heavily penalized, each undisclosed mock carries a small penalty, and a faked demo is heavily penalized. Telling the truth here costs you nothing.

---

## 1. Team — who did what
Judges compare this against `git shortlog -sn`, so keep it honest.

| Member | GitHub handle | Main contributions |
|---|---|---|
| Nick | nickrmb | Dashboard UI, mapbox integration |
| Tobias | tobiasleibrock | Mobile Application |
| Lucas | LucasBerger | Dashboard Map Design + Initialization of Data |
| Merlin | - | Market and Business Research + Pitch work |

---

## 2. What is fully working
Features that run end-to-end on the live app, with real data and real logic. Be specific: name the feature, what input it takes, what output it produces.

- Dashboard overview with frontend (react) and backend (express) syncing data for visualization
- Mapbox interactive map integration
- Supabase database setup with migration files and full deployment (not connected to backend yet, data mocked)
- Vision analysis script running algorithms from scientific papers on real mp4 data to detect multiple biomarkers (see README) + testing of this
- PWA Docker and deployment to bot.nightlyfe.de

---

## 3. What is mocked, stubbed, or hardcoded
Every shortcut. Examples: a login that accepts any password, a payment that always succeeds, an "AI" that is an if/else, a database that is an in-memory dictionary, fake JSON returned instead of a real API call.

**Undisclosed mocks carry a small penalty each. Anything you list here = free.**

| What is faked | Where (file:line or folder) | Why we mocked it | What the real version would do |
|---|---|---|---|
| Data sources | Backend (data.js) | Could not collect any real data | Use robot to collect data and sync in supabase |
| Analysis data | Backend + Frontend Dashboard | We had no way to sample Urine or Spit data at all | Try out sample methods and analysis methods |
| PWA app functionality | app/ folder (TanStack) | We did not built a robot backend that coordinates and orders robots as we dont have access to any (or residents for testing) | Develop and deploy backend with robot integration |

If nothing is mocked, write: *"Nothing is mocked — every feature listed above uses real logic and real data."*

---

## 4. External APIs, services & data sources
Everything the project calls or pretends to call. Mark each as real or mocked.

| Service / API / dataset | Used for | Real call or mocked? | Auth (sandbox / test key / none) |
|---|---|---|---|
| Mapbox API | Map and building data | Real | Real key |

---

## 5. Pre-existing code
Anything written **before** kickoff that we brought into this project: prior personal projects, forked open-source code, templates, boilerplate, internal libraries.

*All code in this repo was written during the hackathon window.*

---

## 6. Known limitations & next steps
What we would build next, and the weak spots we already know about. Naming these honestly is a strength, not a flaw.

- Connect App with Backend
- Integrate actual production ready database
- MVP with an actual (probably stationary first) robot
