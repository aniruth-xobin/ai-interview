"use client";

import { useState, useRef, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  BarVisualizer,
  useVoiceAssistant,
  useTranscriptions,
} from "@livekit/components-react";
import "@livekit/components-styles";

export default function LiveKitPipeline({ token, serverUrl, onSessionEnd, onMetricsUpdate }) {
  if (!token || !serverUrl) {
    return <div style={{ padding: 20, color: "#94a3b8" }}>Connecting to LiveKit...</div>;
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column" }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AgentUI onSessionEnd={onSessionEnd} onMetricsUpdate={onMetricsUpdate} />
        <TranscriptLog />
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio" />
    </LiveKitRoom>
  );
}

function AgentUI({ onSessionEnd, onMetricsUpdate }) {
  const { state, audioTrack } = useVoiceAssistant();
  const connectionState = useConnectionState();

  const thinkingStartTimeRef = useRef(null);
  const latenciesRef = useRef([]);

  // Track latency using LiveKit's internal state machine
  // This is much more reliable than useIsSpeaking when dealing with dual-mic scenarios
  useEffect(() => {
    if (state === "thinking" && !thinkingStartTimeRef.current) {
      // LiveKit VAD just triggered endpointing. User stopped speaking ~300ms ago.
      thinkingStartTimeRef.current = Date.now();
    } else if (state === "speaking" && thinkingStartTimeRef.current) {
      // Agent started speaking.
      // Total E2E Latency = Time in 'thinking' + 300ms (average LiveKit VAD buffer)
      const thinkingDuration = Date.now() - thinkingStartTimeRef.current;
      const totalLatency = thinkingDuration + 300; 
      
      if (totalLatency > 50 && totalLatency < 30000) {
        latenciesRef.current = [...latenciesRef.current, totalLatency];
        if (onMetricsUpdate) {
          onMetricsUpdate({
            latencies: latenciesRef.current,
            turns: latenciesRef.current.length,
          });
        }
      }
      thinkingStartTimeRef.current = null;
    } else if (state === "listening") {
      thinkingStartTimeRef.current = null;
    }
  }, [state, onMetricsUpdate]);

  const stateColor = {
    listening: "#22c55e",
    thinking: "#6366f1",
    speaking: "#0ea5e9",
    connecting: "#f59e0b",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", borderBottom: "1px solid #e2e8f0" }}>
      <div style={{ marginBottom: "8px", fontSize: "12px", fontWeight: 600, color: stateColor[state] || "#64748b" }}>
        {connectionState} · Agent: {state || "idle"}
      </div>
      {audioTrack ? (
        <BarVisualizer state={state} trackRef={audioTrack} barCount={7} options={{ minHeight: 10 }} style={{ height: "40px", width: "160px" }} />
      ) : (
        <div style={{ height: "40px", display: "flex", alignItems: "center", color: "#94a3b8", fontSize: "12px" }}>
          Waiting for agent audio...
        </div>
      )}
    </div>
  );
}

function TranscriptLog() {
  const segments = useTranscriptions();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [segments]);

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
      {segments.map((segment, index) => {
        const text = segment.text || (segment.segments && segment.segments[0]?.text) || "";
        const identity = segment.participantInfo?.identity || "Unknown";
        const isLocal = identity.includes("BenchmarkTester") || identity === "participant";
        if (!text) return null;

        return (
          <div
            key={segment.id || index}
            style={{
              alignSelf: isLocal ? "flex-end" : "flex-start",
              background: isLocal ? "#0ea5e9" : "#f1f5f9",
              color: isLocal ? "#fff" : "#0f172a",
              padding: "8px 12px",
              borderRadius: 12,
              maxWidth: "85%",
              fontSize: 13,
              lineHeight: "1.4",
            }}
          >
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2, fontWeight: 600 }}>
              {isLocal ? "You" : "Agent A"}
            </div>
            {text}
          </div>
        );
      })}
      {segments.length === 0 && (
        <div style={{ textAlign: "center", color: "#94a3b8", marginTop: 20, fontSize: 12 }}>
          Start speaking... transcripts will appear here.
        </div>
      )}
    </div>
  );
}
