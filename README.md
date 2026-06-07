# RoboHealth Hong Kong

An in-building autonomous health robot for Hong Kong's high-density residential towers. The robot travels door-to-door, performs routine health check-ups with residents, and feeds the results into a community-level dashboard that helps building managers and public-health teams spot trends early.

## The idea

Hong Kong's hospitals are overloaded, and chronic diseases often go undetected until they become acute. A large share of the population lives in dense vertical communities where a single robot, riding the building's elevators, can reach hundreds of households a day.

The robot:

1. **Roams** the building on a daily route, or can be **summoned** by a resident on demand.
2. **Checks in** with the patient — blood pressure, heart rate, SpO₂, temperature, a short symptom interview, and follow-up questions tailored to their history.
3. **Treats or refers** — orders prescription refills, schedules a teleconsultation, or recommends an in-person doctor's appointment when something looks off.
4. **Reports** — anonymized, aggregated readings flow into the dashboard.

The dashboard turns thousands of small interactions into a live picture of a community's health: which floors are seeing a flu spike, which buildings have rising hypertension, where chronic conditions are clustering. The goal is a shift from reactive to **preventive** care — catching disease earlier, easing pressure on hospitals, and giving residents a much lower-friction way to stay on top of their health.

## Repository layout

```
.
├── app/          Robot-side patient app (TanStack Start, React 19, Tailwind v4, shadcn)
│                 The touchscreen UI residents interact with during a check-up.
│
├── health/       Prototype video-analysis scripts for screening measurements.
│                 Includes RGB vision analysis and urine-strip colorimetry.
│
├── supabase/     Local Supabase configuration and database migrations.
│                 Defines auth profiles, clinical data, robot fleet, workflows,
│                 and dashboard analytics tables.
│
└── dashboard/
    ├── frontend/ Community health dashboard (React + Vite, Mapbox GL)
    │             Map view of Hong Kong buildings with per-tower health insights.
    └── backend/  Dashboard API (Node.js + Express)
                  Serves aggregated readings and building/resident metadata.
```

## Running locally

**Patient app PWA** (robot touchscreen)

```bash
cd app
npm install
npm run dev          # http://localhost:3000
```

The app in `app/` is the resident-facing robot touchscreen / PWA prototype. It uses TanStack Start, TanStack Router, React 19, Tailwind CSS v4, shadcn-style UI components, and the assets in `app/public/`, including the web app manifest and PWA icons.

Useful commands:

```bash
cd app
npm run dev              # Vite dev server on http://localhost:3000
npm run build            # Production build into app/dist
npm run preview          # Preview the production build
npm run test             # Vitest test run
npm run generate-routes  # Regenerate TanStack Router route tree
```

The main user flow currently lives in `app/src/routes/index.tsx`: residents schedule or summon the robot, watch the mock route progress, interact when the robot arrives, and see a medication / follow-up outcome screen.

**Dashboard backend**

```bash
cd dashboard/backend
npm install
npm run dev
```

**Dashboard frontend**

```bash
cd dashboard/frontend
npm install
npm run dev
```

The frontend uses Mapbox GL — set a `MAPBOX_KEY` in `dashboard/.env` to render the map.

## Health analysis scripts

The `health/` package contains prototype screening scripts that analyze raw video and emit structured JSON. These scripts are not diagnostic medical devices; they are intended for robot workflow prototyping, algorithm exploration, and data-shape validation.

Install the Python package from the `health/` folder:

```bash
cd health
uv sync
```

If you are not using `uv`, create a Python 3.13+ environment and install the package with its dependencies:

```bash
cd health
python3 -m pip install -e .
```

For MediaPipe-based blink and pose/gait analysis, install the optional pose dependencies:

```bash
python3 -m pip install -e ".[pose]"
```

### Vision analysis

`health/vision_analysis.py` estimates screenable measurements from ordinary RGB video:

- Heart rate from face rPPG using POS / CHROM spectral analysis.
- HRV RMSSD and pulse irregularity index from the rPPG waveform when enough stable video exists.
- Respiratory rate from torso optical flow, frame-difference motion, or green-channel rPPG modulation.
- Facial color screening indices: pallor, redness, and yellowness.
- Blink rate with MediaPipe Face Mesh when MediaPipe is installed.
- Pupil radius in pixels from face-derived eye-band circle detection.
- Step rate and lateral sway with MediaPipe Pose when a full-body walking view is available.
- Explicit notes for measurements that cannot be inferred from RGB video alone, such as SpO2, skin temperature, blood pressure, glucose, ECG rhythm, pathogen tests, and environmental sensing.

Run it with:

```bash
cd health
uv run vision-analysis path/to/video.mp4 --output data/vision_results.json
```

Equivalent direct script call:

```bash
python3 vision_analysis.py path/to/video.mp4 --output data/vision_results.json
```

Useful options:

```bash
uv run vision-analysis path/to/video.mp4 --max-frames 1800 --sample-every 2
uv run vision-analysis path/to/video.mp4 --no-mediapipe
```

The JSON result includes video metadata, `estimates`, lower-level `metrics`, skipped non-video measurements, confidence labels, warnings, methods, and limitations.

### Urine-strip analysis

`health/urine_analysis.py` analyzes a urine dipstick / cartridge video with colorimetric reagent-pad matching. It samples frames, builds a robust median frame, detects or uses configured reagent pad regions, applies optional white/black calibration, converts sampled pad colors to Lab color space, and matches each pad to a reference color chart.

Included urine markers:

- Leukocytes
- Nitrite
- Urobilinogen
- Protein
- pH
- Blood
- Specific gravity
- Ketones
- Bilirubin
- Glucose

It also derives a simple UTI screening value from nitrite plus leukocyte esterase: `negative_screen`, `possible_screen`, or `positive_screen`.

Run it with automatic pad detection:

```bash
cd health
uv run urine-analysis path/to/urine-strip-video.mp4 --output data/urine_results.json
```

For reliable robot-cartridge runs, create and edit an ROI / calibration config:

```bash
uv run urine-analysis --write-example-config data/urine_config.json
uv run urine-analysis path/to/urine-strip-video.mp4 \
  --config data/urine_config.json \
  --output data/urine_results.json
```

The config can provide fixed pad ROIs, strip orientation, pad count, white/black reference ROIs, and manufacturer-specific color charts. The built-in charts are generic prototype references only; production use requires the exact strip manufacturer's read times, colors, lighting protocol, and clinical validation.

## Supabase database

The `supabase/` folder contains the local Supabase CLI project. `supabase/config.toml` enables the local API, Auth, Studio, Storage, Realtime, and a Postgres 17 database. Important local ports are:

- API: `http://127.0.0.1:54321`
- Database: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Inbucket email UI: `http://127.0.0.1:54324`

Start the local Supabase stack:

```bash
supabase start
```

Apply all migrations to a fresh local database:

```bash
supabase db reset
```

Create a new migration after changing the schema:

```bash
supabase migration new short_description
```

Check migration status:

```bash
supabase migration list
```

The migrations currently define:

- `profiles`: user profile rows linked to `auth.users` with row-level security.
- Foundation security: organizations, memberships, audit events, extensions, helper functions, timestamps, and RLS policies.
- Hong Kong residential graph: communities, buildings, floors, rooms, households, patients, residencies, contacts, consents, and care-team membership.
- Robot fleet and devices: robot units, deployments, sensor devices, calibrations, consumable lots, inventory, and room visits.
- Clinical capability catalog: modalities, measurement definitions, diagnostic panels, panel measurements, and clinical thresholds.
- Encounters, measurements, and media: robot care sessions, session consents, media artifacts, observations, sample collections, diagnostic orders/results/items, and imaging findings.
- Care workflows and integrations: risk scores, alerts, provider notes, referrals, medication orders, pharmacy fulfillment requests, adherence events, and care-plan tasks.
- Dashboard analytics: dashboard snapshots, community health metrics, population risk segments, and export jobs.

Most tables enable row-level security. Access is scoped through organization membership or patient care-team membership, depending on the data domain.

## Status

Prototype. Hardware integration, clinical workflows, and the medicine-ordering / referral pipeline are stubbed against mock data.
