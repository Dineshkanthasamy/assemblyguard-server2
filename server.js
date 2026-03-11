const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── In-memory state (resets on redeploy — fine for live dashboard) ──
let stations  = {};   // latest heartbeat per station
let anomalies = [];   // last 50 anomalies

// ════════════════════════════════════════════════
//  API — Jetson posts here
// ════════════════════════════════════════════════

// POST /api/heartbeat  — called every 3 sec from Jetson
app.post("/api/heartbeat", (req, res) => {
  const d = req.body;
  if (!d.station_id) return res.status(400).json({ error: "missing station_id" });
  stations[d.station_id] = { ...d, last_seen: new Date().toISOString() };
  console.log(`[HB] ${d.station_id} → ${d.status}  fps=${d.fps}`);
  res.json({ ok: true });
});

// POST /api/anomaly  — called on each anomaly event
app.post("/api/anomaly", (req, res) => {
  const d = req.body;
  if (!d.station_id) return res.status(400).json({ error: "missing station_id" });
  anomalies.unshift({ ...d, received_at: new Date().toISOString() });
  if (anomalies.length > 50) anomalies.pop();
  console.log(`[ANOMALY] ${d.station_id} → ${d.details}`);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════
//  API — Dashboard reads here
// ════════════════════════════════════════════════

app.get("/api/status", (req, res) => {
  res.json({ stations, anomaly_count: anomalies.length });
});

app.get("/api/anomalies", (req, res) => {
  // strip large image_b64 from list view
  const safe = anomalies.map(({ image_b64, ...rest }) => rest);
  res.json(safe);
});

app.get("/api/anomalies/:index/image", (req, res) => {
  const a = anomalies[parseInt(req.params.index)];
  if (!a) return res.status(404).json({ error: "not found" });
  res.json({ image_b64: a.image_b64 || "" });
});

// ════════════════════════════════════════════════
//  Serve dashboard for any other route
// ════════════════════════════════════════════════
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AssemblyGuard server running on port ${PORT}`));
