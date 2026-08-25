"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import LiveKitPipeline from "@/components/LiveKitPipeline";
import CustomPipeline from "@/components/CustomPipeline";

const METADATA = {
  roomName: "benchmark-room-1",
  participantName: "BenchmarkTester",
  metadata: { 
    mode: "guided", 
    candidateName: "Tester", 
    interviewerName: "AI", 
    jobTitle: "Engineer", 
    interviewGoals: [{ title: "System Design", skill: "Architecture" }], 
    language: "English",
    instructions: "WAIT FOR THE USER TO SPEAK FIRST. DO NOT GREET. DO NOT SAY HELLO. RESPOND ONLY AFTER THE USER HAS SPOKEN."
  },
};

function MetricBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 8, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
    </div>
  );
}

function ReportCard({ aMetrics, bMetrics, sessionDuration }) {
  const aAvg = aMetrics.latencies.length > 0 ? Math.round(aMetrics.latencies.reduce((s, v) => s + v, 0) / aMetrics.latencies.length) : null;
  const bAvg = bMetrics.totalLatencyMs.length > 0 ? Math.round(bMetrics.totalLatencyMs.reduce((s, v) => s + v, 0) / bMetrics.totalLatencyMs.length) : null;
  const aMin = aMetrics.latencies.length > 0 ? Math.min(...aMetrics.latencies) : null;
  const aMax = aMetrics.latencies.length > 0 ? Math.max(...aMetrics.latencies) : null;
  const bMin = bMetrics.totalLatencyMs.length > 0 ? Math.min(...bMetrics.totalLatencyMs) : null;
  const bMax = bMetrics.totalLatencyMs.length > 0 ? Math.max(...bMetrics.totalLatencyMs) : null;
  const maxLatency = Math.max(aAvg || 0, bAvg || 0, 1);
  const winner = aAvg && bAvg ? (aAvg < bAvg ? "A" : "B") : aAvg ? "A" : bAvg ? "B" : null;
  const winnerColor = winner === "A" ? "#0ea5e9" : "#f59e0b";
  const margin = aAvg && bAvg ? Math.abs(aAvg - bAvg) : null;
  const pctFaster = aAvg && bAvg ? Math.round((Math.abs(aAvg - bAvg) / Math.max(aAvg, bAvg)) * 100) : null;
  const aStdDev = aMetrics.latencies.length > 1 ? Math.round(Math.sqrt(aMetrics.latencies.reduce((s, v) => s + Math.pow(v - (aAvg || 0), 2), 0) / aMetrics.latencies.length)) : null;
  const bStdDev = bMetrics.totalLatencyMs.length > 1 ? Math.round(Math.sqrt(bMetrics.totalLatencyMs.reduce((s, v) => s + Math.pow(v - (bAvg || 0), 2), 0) / bMetrics.totalLatencyMs.length)) : null;
  const ts = new Date().toISOString();

  return (
    <div style={{ background: "#0f172a", color: "#e2e8f0", fontFamily: "'Courier New', monospace", minHeight: "100vh", padding: "40px 60px" }}>
      <div style={{ borderBottom: "1px solid #334155", paddingBottom: 24, marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 3, marginBottom: 8 }}>SYSTEM BENCHMARK REPORT · CONFIDENTIAL</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc", margin: 0 }}>Voice Agent Pipeline Comparison</h1>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>Generated: {ts} · Duration: {Math.round(sessionDuration / 1000)}s · Env: LiveKit Cloud</div>
      </div>

      {winner && (
        <div style={{ background: winner === "A" ? "#0c2b3d" : "#2d1e0a", border: `1px solid ${winnerColor}`, borderRadius: 8, padding: "20px 28px", marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: winnerColor, letterSpacing: 2, marginBottom: 4 }}>WINNER</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc" }}>Pipeline {winner} · {winner === "A" ? "LiveKit Hosted Agent" : "Custom WebSocket Pipeline"}</div>
            {pctFaster && margin && <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{pctFaster}% faster avg response · {margin}ms advantage per turn</div>}
          </div>
          <div style={{ fontSize: 48 }}>🏆</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
        {[
          { label: "Pipeline A", sub: "LiveKit Hosted Agent (server-managed STT→LLM→TTS)", color: "#0ea5e9", avg: aAvg, min: aMin, max: aMax, turns: aMetrics.turns, latencies: aMetrics.latencies, stdDev: aStdDev, stack: "Deepgram + OpenAI + Cartesia (LiveKit-managed)" },
          { label: "Pipeline B", sub: "Custom WebSocket Pipeline (client-orchestrated)", color: "#f59e0b", avg: bAvg, min: bMin, max: bMax, turns: bMetrics.turns, latencies: bMetrics.totalLatencyMs, stdDev: bStdDev, stack: "Deepgram Nova-3 + GPT-4.1-mini + Cartesia Sonic-3" },
        ].map((p) => (
          <div key={p.label} style={{ background: "#1e293b", borderRadius: 8, padding: 24, border: `1px solid ${p.color}33` }}>
            <div style={{ fontSize: 11, color: p.color, letterSpacing: 2, marginBottom: 4 }}>{p.label.toUpperCase()}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc", marginBottom: 2 }}>{p.label}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 20 }}>{p.stack}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[{ name: "AVG", value: p.avg ? `${p.avg}ms` : "—", color: p.color }, { name: "MIN", value: p.min ? `${p.min}ms` : "—", color: "#22c55e" }, { name: "MAX", value: p.max ? `${p.max}ms` : "—", color: "#ef4444" }].map((m) => (
                <div key={m.name} style={{ background: "#0f172a", borderRadius: 6, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 1, marginBottom: 4 }}>{m.name}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                <span>AVG vs PEER</span><span>{p.avg ? `${p.avg}ms` : "No data"}</span>
              </div>
              <MetricBar value={p.avg || 0} max={maxLatency} color={p.color} />
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              TURNS: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.turns}</span>
              {p.stdDev && <span style={{ marginLeft: 16 }}>STD DEV: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>±{p.stdDev}ms</span></span>}
            </div>
            {p.latencies.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 9, color: "#64748b", letterSpacing: 1, marginBottom: 8 }}>LATENCY PER TURN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {p.latencies.map((lat, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 10, color: "#64748b", width: 40 }}>T{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ background: "#0f172a", borderRadius: 3, height: 5, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min((lat / (maxLatency * 1.2)) * 100, 100)}%`, height: "100%", background: lat < 1500 ? "#22c55e" : lat < 3000 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} />
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: lat < 1500 ? "#22c55e" : lat < 3000 ? "#f59e0b" : "#ef4444", width: 55, textAlign: "right" }}>{lat}ms</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ background: "#1e293b", borderRadius: 8, padding: 24, marginBottom: 24, border: "1px solid #334155" }}>
        <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 2, marginBottom: 12 }}>ANALYSIS SUMMARY</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #334155" }}>
              {["Dimension", "Pipeline A (LiveKit)", "Pipeline B (Custom)", "Verdict"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#64748b", fontWeight: 600, fontSize: 10, letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Avg E2E Latency", aAvg ? `${aAvg}ms` : "N/A", bAvg ? `${bAvg}ms` : "N/A", aAvg && bAvg ? (aAvg < bAvg ? "✅ A wins" : "✅ B wins") : "—"],
              ["Architecture", "Server-managed", "Client-orchestrated", "—"],
              ["Turns Measured", aMetrics.turns.toString(), bMetrics.turns.toString(), "—"],
              ["Std Deviation", aStdDev ? `±${aStdDev}ms` : "—", bStdDev ? `±${bStdDev}ms` : "—", "Lower = more consistent"],
              ["Scalability", "LiveKit Cloud (managed)", "Custom infra required", "A advantage"],
              ["Model Stack", "Server-configured", "Nova-3 + GPT-4.1-mini + Sonic-3", "—"],
            ].map(([dim, a, b, verdict], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #1e293b" }}>
                <td style={{ padding: "10px 12px", color: "#94a3b8", fontWeight: 600 }}>{dim}</td>
                <td style={{ padding: "10px 12px", color: "#0ea5e9" }}>{a}</td>
                <td style={{ padding: "10px 12px", color: "#f59e0b" }}>{b}</td>
                <td style={{ padding: "10px 12px", color: "#22c55e", fontStyle: "italic" }}>{verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#334155" }}>
        END OF REPORT · Pipeline A = LiveKit Agents Framework · Pipeline B = Custom WebSocket
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  const [phase, setPhase] = useState("idle"); // "idle" | "active" | "report"
  const [liveKitToken, setLiveKitToken] = useState("");
  const [aMetrics, setAMetrics] = useState({ latencies: [], turns: 0 });
  const [bMetrics, setBMetrics] = useState({ turns: 0, totalLatencyMs: [] });
  const sessionStartRef = useRef(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  const handleAMetrics = useCallback((m) => setAMetrics(m), []);
  const handleBMetrics = useCallback((m) => setBMetrics(m), []);

  const handleStart = async () => {
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(METADATA),
      });
      const d = await res.json();
      if (!d.token) { alert("Failed to get LiveKit token"); return; }
      setLiveKitToken(d.token);
      sessionStartRef.current = Date.now();
      setPhase("active");
    } catch (e) { console.error(e); alert("Error starting session"); }
  };

  const handleEnd = () => {
    setSessionDuration(Date.now() - (sessionStartRef.current || Date.now()));
    setPhase("report");
  };

  if (phase === "report") {
    return <ReportCard aMetrics={aMetrics} bMetrics={bMetrics} sessionDuration={sessionDuration} />;
  }

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const aAvg = aMetrics.latencies.length > 0 ? Math.round(aMetrics.latencies.reduce((s, v) => s + v, 0) / aMetrics.latencies.length) : null;
  const bAvg = bMetrics.totalLatencyMs.length > 0 ? Math.round(bMetrics.totalLatencyMs.reduce((s, v) => s + v, 0) / bMetrics.totalLatencyMs.length) : null;

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      {phase === "idle" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 3, marginBottom: 8 }}>A/B LATENCY BENCHMARK</div>
            <h1 style={{ fontSize: 32, fontWeight: 700, color: "#f8fafc", margin: "0 0 12px 0" }}>Voice Agent Pipeline Test</h1>
            <p style={{ color: "#64748b", fontSize: 14, maxWidth: 480, lineHeight: 1.6 }}>
              Both pipelines will start simultaneously.
              <br/>You speak first — both agents will listen and respond to the same input.
            </p>
          </div>
          <button onClick={handleStart} style={{ padding: "14px 40px", background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 16 }}>Start Interview</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748b", letterSpacing: 2 }}>LIVE A/B TEST</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#f8fafc" }}>Speak now — both agents are listening</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 16px", border: "1px solid #0ea5e933" }}>
                <div style={{ fontSize: 9, color: "#0ea5e9", letterSpacing: 1 }}>PIPELINE A AVG</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0ea5e9" }}>{aAvg ? `${aAvg}ms` : "—"}</div>
              </div>
              <div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 16px", border: "1px solid #f59e0b33" }}>
                <div style={{ fontSize: 9, color: "#f59e0b", letterSpacing: 1 }}>PIPELINE B AVG</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>{bAvg ? `${bAvg}ms` : "—"}</div>
              </div>
              <button onClick={handleEnd} style={{ padding: "10px 24px", background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>End Session &amp; Report</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ border: "1px solid #0ea5e944", borderRadius: 12, overflow: "hidden", height: 480 }}>
              <div style={{ padding: "8px 16px", background: "#0c2b3d", borderBottom: "1px solid #0ea5e944", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ea5e9" }} />
                <span style={{ color: "#0ea5e9", fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>PIPELINE A · LIVEKIT HOSTED</span>
                {aAvg && <span style={{ marginLeft: "auto", fontSize: 11, color: "#0ea5e9" }}>{aAvg}ms avg · {aMetrics.turns} turns</span>}
              </div>
              <div style={{ height: "calc(100% - 37px)", background: "#fff" }}>
                {liveKitToken ? <LiveKitPipeline token={liveKitToken} serverUrl={serverUrl} onMetricsUpdate={handleAMetrics} /> : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8" }}>Connecting...</div>}
              </div>
            </div>
            <div style={{ border: "1px solid #f59e0b44", borderRadius: 12, overflow: "hidden", height: 480 }}>
              <div style={{ padding: "8px 16px", background: "#2d1e0a", borderBottom: "1px solid #f59e0b44", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} />
                <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>PIPELINE B · CUSTOM WEBSOCKET</span>
                {bAvg && <span style={{ marginLeft: "auto", fontSize: 11, color: "#f59e0b" }}>{bAvg}ms avg · {bMetrics.turns} turns</span>}
              </div>
              <div style={{ height: "calc(100% - 37px)", background: "#fff" }}>
                <CustomPipeline active={phase === "active"} onMetricsUpdate={handleBMetrics} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
