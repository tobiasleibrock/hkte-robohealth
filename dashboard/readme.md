## General Idea

Hong Kong faces challenges in preventive healthcare. Many people only visit a doctor once symptoms already exist, which means diseases are often detected late. The culture around healthcare is generally less preventive, with limited focus on regular checkups and early detection.

The idea is to introduce an autonomous health-check robot for large residential buildings. Residents can request a basic health screening through a mobile app. After receiving a request, the robot drives to the resident’s apartment and performs a health check directly at the doorstep.

The robot would be equipped with different medical and sensing instruments, such as:

- Blood pressure measurement
- Blood sampling or blood probe system
- Camera-based visual inspection
- LiDAR for navigation and spatial awareness
- Basic biometric sensors
- Possibly temperature, oxygen saturation, and heart rate measurement

The goal is to make preventive healthcare more accessible, convenient, and frequent. Instead of requiring people to visit a clinic, the checkup comes directly to them.

If the system detects early warning signs, it can recommend next steps. In simple cases, suitable medicine or supplements could be ordered through a partnered pharmacy. In more serious cases, the user could be advised to contact a doctor or book a medical appointment.

## This Repository

This repository focuses on building the dashboard for the robot’s data collection system. The goal is to create a simple, modern website with smooth animations, clean interactions, and an intuitive interface.

The dashboard should visualize health data collected by robots across Hong Kong. A central feature should be an abstract 3D map of Hong Kong, showing different buildings where robots are active. Each building should be clickable.

When a user clicks on a building, a side panel should open and display data related to that building. This data should include both individual customer profiles and aggregated community-level health insights.

For individual residents, the dashboard could show:

- Basic profile information
- Health check history
- Blood pressure records
- Heart rate and oxygen levels
- Detected risk indicators
- Medication or pharmacy recommendations
- Follow-up status

For the building as a whole, the dashboard could show collective health statistics, such as:

- Number of active users
- Number of completed health checks
- Common risk patterns
- Average blood pressure or heart rate trends
- Percentage of residents needing follow-up
- Community-level health alerts

The overall goal is to make the dashboard feel futuristic, clear, and easy to use. It should help operators understand where robots are active, what data has been collected, and which residents or buildings may require medical attention.

## Implementation

The project uses a classic split between a backend API and a frontend single-page app.

```
backend/    Express API serving mock building, resident and community health data
frontend/   React + Vite + Tailwind dashboard with a live 3D Mapbox map of Hong Kong
```

### Tech stack

- **Backend:** Node + Express, deterministic mock-data generator (seeded so the dataset is stable). Buildings carry real Hong Kong coordinates.
- **Frontend:** React 18, Vite, Tailwind CSS, `mapbox-gl` + `react-map-gl` for the live 3D map, Framer Motion for panel/UI animation.

### Mapbox token

The map needs a Mapbox **public** access token (starts with `pk.`). It is read from the repository-root `.env`:

```
mapbox_key="pk.eyJ1Ijoi..."
```

Get a free token at https://account.mapbox.com/access-tokens/. Without a valid token the dashboard falls back to an abstract coordinate board so it stays usable.

### Running locally

The frontend dev server proxies `/api` to the backend, so you just run both:

```bash
# Terminal 1 — API on http://localhost:4000
cd backend
npm install
npm run dev

# Terminal 2 — dashboard on http://localhost:5173
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. (Restart the frontend after changing `.env`.)

### API

| Method | Route                  | Description                                   |
| ------ | ---------------------- | --------------------------------------------- |
| GET    | `/api/network`         | Fleet-wide totals for the top status bar      |
| GET    | `/api/buildings`       | Lightweight building list for the 3D map      |
| GET    | `/api/buildings/:id`   | Full building detail: residents + community   |

### Dashboard features

- Live, pitched 3D map of Hong Kong (Mapbox) with real extruded buildings and a clean dark, minimalist style.
- Each robot building is a marker placed at its real coordinates, colour-coded by health status (stable / watch / alert), with a pulsing halo when a robot is online. Hover labels it; clicking flies the camera in and opens its profile.
- Side panel with two views:
  - **Community:** active users, completed checks, follow-up %, high-risk count, average vitals, common risk patterns and community-level alerts.
  - **Residents:** expandable cards with profile, vitals, a systolic trend sparkline, risk tags, pharmacy/medication recommendation and follow-up status.