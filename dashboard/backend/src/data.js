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

// Clustered around Central Plaza / HKCEC in Wan Chai North — supertall offices
// mixed with residential blocks, all within ~400m.
const BUILDINGS = [
  { name: "Central Plaza", district: "Wan Chai", lng: 114.1738, lat: 22.2810, mapboxFeatureIds: [1047690917, 1047690916, 1047690915, 1047690912, 1047690911, 1047690913, 1047690918] },
  { name: "Convention Plaza", district: "Wan Chai", lng: 114.1730, lat: 22.2823, mapboxFeatureIds: [1324261693, 107497692, 1324261692] },
  { name: "Sun Hung Kai Centre", district: "Wan Chai", lng: 114.1748, lat: 22.2810, mapboxFeatureIds: [1326229742, 1326229741, 1326229740, 1326229739, 1326229738] },
  { name: "Great Eagle Centre", district: "Wan Chai", lng: 114.1728, lat: 22.2811, mapboxFeatureIds: [40491153, 1326229650, 1326229655, 1326229648, 1326229661, 1326229651, 40491170, 1326229653, 1326229654, 1326229652, 1326229662, 1326229675, 1326229663, 1326229667, 1326229666, 1326229676, 1326229672, 1326229673, 1326229671, 1326229677, 40491165, 1326229665, 1326229664, 1326229674, 1326229670, 1326229669, 1326229668, 1326229660, 1326229656, 1326229649, 1326229659, 1326229658, 1326229657] },
  { name: "China Resources Building", district: "Wan Chai", lng: 114.1739, lat: 22.2795, mapboxFeatureIds: [1326229735, 1326229732, 1326229731, 1326229730, 1326229729, 1326229728, 1326229727, 1326229726, 1326229725, 1326229724, 1326229722, 1326229723, 1326229721, 1326229720, 1326229719, 1326229718, 1326229717, 1326229736, 1326229688, 1326229687, 1326229686, 1326229685, 1326229683, 1326229684, 1326229682, 1326229681, 1326229680, 1326229679, 1326229678, 1326229733, 1326229716, 1326229715, 1326229714, 1326229713, 1326229712, 1326229737, 1326229711, 1326229701, 1326229702, 1326229703, 1326229704, 1326229705, 1326229706, 1326229707, 1326229708, 1326229709, 1326229710, 1326229700, 1326229734, 1326229699, 1326229698, 1326229697, 1326229696, 1326229695, 1326229689, 1326229694, 1326229693, 1326229690, 1326229692, 1326229691] },
  { name: "Shui On Centre", district: "Wan Chai", lng: 114.1746, lat: 22.2789, mapboxFeatureIds: [241998997] },
  { name: "Wan Chai Tower", district: "Wan Chai", lng: 114.1726, lat: 22.2794, mapboxFeatureIds: [27087041] },
  { name: "Immigration Tower", district: "Wan Chai", lng: 114.1730, lat: 22.2790, mapboxFeatureIds: [510722228] },
  { name: "Revenue Tower", district: "Wan Chai", lng: 114.1725, lat: 22.2788, mapboxFeatureIds: [27087037] },
  { name: "Hopewell Centre", district: "Wan Chai", lng: 114.1718, lat: 22.2761, mapboxFeatureIds: [1381061198, 88391069] },
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

function makeResident(buildingId, idx, healthBias = 0) {
  const age = randInt(24, 88);

  // Roll a severity bucket first, then generate vitals consistent with it so
  // the overall population skews strongly healthy with a small minority at risk.
  // healthBias shifts the roll up (riskier building) or down (healthier).
  const roll = rand() + healthBias;
  const severity = roll < 0.8 ? "low" : roll < 0.94 ? "moderate" : "high";

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

  // --- Diabetes panel ---
  const ageFactor = Math.max(0, (age - 45) / 45);
  const diabetesRoll = rand() + ageFactor * 0.25 + (severity === "high" ? 0.2 : severity === "moderate" ? 0.1 : 0);
  const hba1c =
    diabetesRoll > 0.85
      ? Number(randFloat(6.5, 9.8).toFixed(1))
      : diabetesRoll > 0.6
      ? Number(randFloat(5.7, 6.4).toFixed(1))
      : Number(randFloat(4.5, 5.6).toFixed(1));
  const fastingGlucose =
    hba1c >= 6.5 ? randInt(126, 210) : hba1c >= 5.7 ? randInt(100, 125) : randInt(70, 99);
  const timeInRange =
    hba1c >= 6.5 ? randInt(40, 72) : hba1c >= 5.7 ? randInt(68, 86) : randInt(85, 98);
  const diabetesStatus =
    hba1c >= 6.5 ? "Diabetisch" : hba1c >= 5.7 ? "Prä-Diabetisch" : "Normal";

  // --- Dementia / cognitive panel ---
  const cogAgeFactor = Math.max(0, (age - 60) / 30);
  const mciProb = Math.min(0.96, rand() * 0.35 + cogAgeFactor * 0.55);
  const mciStatus =
    mciProb >= 0.5 ? "Auffällig" : mciProb >= 0.25 ? "Grenzwertig" : "Normal";
  const walkingSpeed = Number(
    Math.max(0.3, 1.5 - cogAgeFactor * 0.55 + (rand() - 0.5) * 0.3).toFixed(2)
  );
  const frailtyIndex = Number(Math.min(0.95, cogAgeFactor * 0.45 + rand() * 0.3).toFixed(2));
  const frailtyStatus =
    frailtyIndex > 0.35 ? "Frail" : frailtyIndex > 0.12 ? "Prä-Frail" : "Robust";
  const hyposmiaScore = randInt(0, 3);

  // --- Body composition (BIA) ---
  const bodyFat = Number(randFloat(14, 38).toFixed(1));
  const muscleMass = Number(randFloat(26, 46).toFixed(1));
  const waterPct = Number(randFloat(45, 65).toFixed(1));
  const visceralFat = randInt(2, 18);

  // --- HRV / Stress ---
  const stressIndex = Number(randFloat(1.2, 9.4).toFixed(1));

  return {
    id: `${buildingId}-r${idx}`,
    name: `${pick(SURNAMES)} ${pick(GIVEN)}`,
    age,
    unit: `${randInt(3, 42)}/${pick(["A", "B", "C", "D", "E", "F"])}`,
    lastCheck: `2026-0${randInt(1, 6)}-${String(randInt(10, 28)).padStart(2, "0")}`,
    totalChecks: checks,
    vitals: {
      systolic,
      diastolic,
      heartRate,
      spo2,
      temperature: Number(randFloat(36.1, 37.6).toFixed(1)),
      stressIndex,
    },
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
    diabetes: { hba1c, fastingGlucose, timeInRange, status: diabetesStatus },
    dementia: { mciProb: Number(mciProb.toFixed(2)), mciStatus, walkingSpeed, frailtyIndex, frailtyStatus, hyposmiaScore },
    bodyComposition: { bodyFat, muscleMass, waterPct, visceralFat },
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
  const floors = randInt(28, 56);
  const residentCount = randInt(460, 540);
  // Per-building health bias so averages spread across stable/watch/alert buckets
  // instead of all converging to the population mean at this resident count.
  const healthBias = randFloat(-0.18, 0.22);
  const residents = Array.from({ length: residentCount }, (_, idx) => makeResident(id, idx, healthBias));
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
    mapboxFeatureIds: b.mapboxFeatureIds ?? [],
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
  mapboxFeatureIds: b.mapboxFeatureIds,
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
