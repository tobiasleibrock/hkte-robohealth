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
└── dashboard/
    ├── frontend/ Community health dashboard (React + Vite, Mapbox GL)
    │             Map view of Hong Kong buildings with per-tower health insights.
    └── backend/  Dashboard API (Node.js + Express)
                  Serves aggregated readings and building/resident metadata.
```

## Running locally

**Patient app** (robot touchscreen)

```bash
cd app
npm install
npm run dev          # http://localhost:3000
```

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

## Status

Prototype. Hardware integration, clinical workflows, and the medicine-ordering / referral pipeline are stubbed against mock data.
