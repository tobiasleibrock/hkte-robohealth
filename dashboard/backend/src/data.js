// Deterministic mock-data generator for the Hong Kong health-robot dashboard.
// A small seeded PRNG keeps the dataset stable across requests/restarts so the
// frontend always renders the same city, residents and trends.

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260606);

const randFloat = (min, max) => min + rand() * (max - min);
const randInt = (min, max) => Math.floor(randFloat(min, max + 1));
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const chance = (p) => rand() < p;

// Real Hong Kong coordinates (lng/lat) clustered around Victoria Harbour so the
// fleet reads nicely on a pitched Mapbox view of the city.
const BUILDINGS = [
  { name: "Victoria Heights", district: "Central", lng: 114.1581, lat: 22.2819 },
  { name: "Harbour Vantage", district: "Wan Chai", lng: 114.1722, lat: 22.2783 },
  { name: "Peak Residences", district: "The Peak", lng: 114.1452, lat: 22.2713 },
  { name: "Causeway One", district: "Causeway Bay", lng: 114.1847, lat: 22.2802 },
  { name: "Kowloon Skyline", district: "Tsim Sha Tsui", lng: 114.1716, lat: 22.2971 },
  { name: "Jordan Garden", district: "Jordan", lng: 114.1709, lat: 22.3051 },
  { name: "Mong Kok Towers", district: "Mong Kok", lng: 114.1694, lat: 22.3186 },
  { name: "North Point Plaza", district: "North Point", lng: 114.1996, lat: 22.2905 },
  { name: "Quarry Bay Court", district: "Quarry Bay", lng: 114.2123, lat: 22.2876 },
  { name: "Sai Ying Pun Terrace", district: "Sai Ying Pun", lng: 114.1431, lat: 22.2861 },
  { name: "Aberdeen Marina", district: "Aberdeen", lng: 114.1553, lat: 22.2483 },
  { name: "Hung Hom Crest", district: "Hung Hom", lng: 114.1882, lat: 22.3035 },
];

const SURNAMES = ["Chan", "Wong", "Lee", "Cheung", "Lam", "Ng", "Ho", "Leung", "Tang", "Yeung", "Lau", "Tsang"];
const GIVEN = ["Wai", "Ka", "Man", "Hei", "Ying", "Kit", "Chun", "Yan", "Ling", "Fai", "Mei", "Ho"];

const RISK_TAGS = [
  "Hypertension",
  "Elevated cholesterol",
  "Pre-diabetic",
  "Low SpO₂",
  "Irregular heart rate",
  "High stress markers",
  "Vitamin D deficiency",
];

const RECOMMENDATIONS = [
  "Order Omega-3 supplement via partner pharmacy",
  "Recommend low-sodium diet plan",
  "Schedule follow-up blood panel in 2 weeks",
  "Advise consultation with cardiologist",
  "Order Vitamin D3 via partner pharmacy",
  "Continue routine monthly screening",
  "Recommend 20-min daily light exercise",
];

const FOLLOW_UP = ["None required", "Monitoring", "Pharmacy order placed", "Doctor referral", "Urgent review"];

function makeResident(buildingId, idx) {
  const age = randInt(24, 88);

  // Roll a severity bucket first, then generate vitals consistent with it so
  // the overall population skews healthy with a realistic minority at risk.
  const roll = rand();
  const severity = roll < 0.6 ? "low" : roll < 0.86 ? "moderate" : "high";

  const ranges = {
    low: { sys: [108, 128], dia: [68, 82], hr: [60, 78], spo2: [97, 100] },
    moderate: { sys: [128, 142], dia: [82, 90], hr: [74, 88], spo2: [95, 98] },
    high: { sys: [142, 168], dia: [90, 104], hr: [86, 102], spo2: [91, 96] },
  }[severity];

  const systolic = randInt(ranges.sys[0], ranges.sys[1]);
  const diastolic = randInt(ranges.dia[0], ranges.dia[1]);
  const heartRate = randInt(ranges.hr[0], ranges.hr[1]);
  const spo2 = randInt(ranges.spo2[0], ranges.spo2[1]);
  const checks = randInt(2, 14);

  const risks = [];
  if (systolic >= 140 || diastolic >= 90) risks.push("Hypertension");
  if (spo2 < 95) risks.push("Low SpO₂");
  if (heartRate > 92 || heartRate < 58) risks.push("Irregular heart rate");
  if (severity === "high" && risks.length < 2) risks.push(pick(RISK_TAGS));
  if (severity === "moderate" && risks.length === 0) risks.push(pick(RISK_TAGS));
  if (severity !== "low" && chance(0.3)) risks.push(pick(RISK_TAGS));

  const uniqueRisks = [...new Set(risks)];

  // Build a short history series for sparklines.
  const history = Array.from({ length: 8 }, (_, h) => {
    const base = systolic - 10;
    return {
      date: `2026-${String(((h + 4) % 12) + 1).padStart(2, "0")}-12`,
      systolic: clamp(base + randInt(-8, 14), 100, 175),
      diastolic: clamp(diastolic + randInt(-6, 8), 60, 110),
      heartRate: clamp(heartRate + randInt(-7, 7), 50, 105),
    };
  });

  return {
    id: `${buildingId}-r${idx}`,
    name: `${pick(SURNAMES)} ${pick(GIVEN)}`,
    age,
    unit: `${randInt(3, 42)}/${pick(["A", "B", "C", "D", "E", "F"])}`,
    lastCheck: `2026-0${randInt(1, 6)}-${String(randInt(10, 28)).padStart(2, "0")}`,
    totalChecks: checks,
    vitals: { systolic, diastolic, heartRate, spo2, temperature: Number(randFloat(36.1, 37.6).toFixed(1)) },
    history,
    risks: uniqueRisks,
    severity,
    recommendation: uniqueRisks.length ? pick(RECOMMENDATIONS) : "Continue routine monthly screening",
    followUp:
      severity === "high"
        ? pick(["Doctor referral", "Urgent review"])
        : severity === "moderate"
          ? pick(["Monitoring", "Pharmacy order placed", "None required"])
          : "None required",
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function summarize(residents) {
  const n = residents.length;
  const avg = (sel) => Math.round(residents.reduce((s, r) => s + sel(r), 0) / n);
  const followUps = residents.filter((r) => r.followUp !== "None required").length;
  const highRisk = residents.filter((r) => r.severity === "high").length;

  const riskCounts = {};
  residents.forEach((r) => r.risks.forEach((t) => (riskCounts[t] = (riskCounts[t] || 0) + 1)));
  const commonRisks = Object.entries(riskCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));

  const alerts = [];
  if (highRisk / n > 0.25) alerts.push("Elevated share of high-risk residents — prioritise visits");
  if (avg((r) => r.vitals.systolic) >= 138) alerts.push("Building-wide blood pressure trending high");
  if (followUps / n > 0.4) alerts.push("Large follow-up backlog — schedule robot rounds");
  if (alerts.length === 0) alerts.push("All metrics within expected community range");

  return {
    activeUsers: n,
    completedChecks: residents.reduce((s, r) => s + r.totalChecks, 0),
    avgSystolic: avg((r) => r.vitals.systolic),
    avgDiastolic: avg((r) => r.vitals.diastolic),
    avgHeartRate: avg((r) => r.vitals.heartRate),
    avgSpo2: avg((r) => r.vitals.spo2),
    followUpPct: Math.round((followUps / n) * 100),
    highRiskCount: highRisk,
    commonRisks,
    alerts,
  };
}

export const buildings = BUILDINGS.map((b, i) => {
  const id = `b${i + 1}`;
  const floors = randInt(18, 56);
  const residentCount = randInt(8, 18);
  const residents = Array.from({ length: residentCount }, (_, idx) => makeResident(id, idx));
  const community = summarize(residents);

  // Derive a single building-level status used to colour the 3D tower.
  const highRiskShare = community.highRiskCount / residents.length;
  const status =
    highRiskShare >= 0.2 || community.avgSystolic >= 140
      ? "alert"
      : highRiskShare >= 0.08 || community.followUpPct >= 30 || community.avgSystolic >= 132
        ? "watch"
        : "stable";

  return {
    id,
    name: b.name,
    district: b.district,
    position: { lng: b.lng, lat: b.lat },
    floors,
    height: Number((floors * 0.18 + randFloat(0.5, 2)).toFixed(2)),
    robotActive: chance(0.85),
    status,
    community,
    residents,
  };
});

// Lightweight list payload for the map (no per-resident detail).
export const buildingsSummary = buildings.map((b) => ({
  id: b.id,
  name: b.name,
  district: b.district,
  position: b.position,
  floors: b.floors,
  height: b.height,
  robotActive: b.robotActive,
  status: b.status,
  activeUsers: b.community.activeUsers,
}));

export function getBuilding(id) {
  return buildings.find((b) => b.id === id);
}

export const network = {
  totalBuildings: buildings.length,
  activeRobots: buildings.filter((b) => b.robotActive).length,
  totalResidents: buildings.reduce((s, b) => s + b.residents.length, 0),
  totalChecks: buildings.reduce((s, b) => s + b.community.completedChecks, 0),
  alerts: buildings.filter((b) => b.status === "alert").length,
};
