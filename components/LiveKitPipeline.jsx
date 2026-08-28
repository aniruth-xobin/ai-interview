"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useConnectionState,
  useVoiceAssistant,
  useTranscriptions,
  useLocalParticipant,
  useIsSpeaking,
} from "@livekit/components-react";
import "@livekit/components-styles";
import GmeetUI from "./GmeetUI";

export default function LiveKitPipeline({ token, serverUrl, onSessionEnd, onMetricsUpdate, candidateName }) {
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
      style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#f8fafc" }}
      
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <AgentUI onSessionEnd={onSessionEnd} onMetricsUpdate={onMetricsUpdate} candidateName={candidateName} />
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio" />
    </LiveKitRoom>
  );
}

function AgentUI({ onSessionEnd, onMetricsUpdate, candidateName }) {
  const { localParticipant } = useLocalParticipant();
  const isUserSpeakingLive = useIsSpeaking(localParticipant);
  const { state, audioTrack } = useVoiceAssistant();
  const connectionState = useConnectionState();
  const hasEndedRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const latestTranscriptRef = useRef([]);
  const segments = useTranscriptions();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const bargeInsRef = useRef(0);
  const wasUserSpeakingRef = useRef(false);
  const sessionStartTimeRef = useRef(null);
  const ttftsRef = useRef([]);
  const thinkingStartTimeRef = useRef(null);

  useEffect(() => {
    if (state === 'thinking') {
      if (!thinkingStartTimeRef.current) {
        thinkingStartTimeRef.current = Date.now();
      }
    } else if (state === 'speaking') {
      if (thinkingStartTimeRef.current) {
        const ttft = Date.now() - thinkingStartTimeRef.current;
        ttftsRef.current.push(ttft);
        thinkingStartTimeRef.current = null;
      }
    } else {
      thinkingStartTimeRef.current = null;
    }
  }, [state]);
  
  useEffect(() => {
    if (connectionState === 'connected' && !sessionStartTimeRef.current) {
      sessionStartTimeRef.current = Date.now();
    }
  }, [connectionState]);

  useEffect(() => {
    if (state === 'speaking' && isUserSpeakingLive && !wasUserSpeakingRef.current) {
      bargeInsRef.current += 1;
    }
    wasUserSpeakingRef.current = isUserSpeakingLive;
  }, [isUserSpeakingLive, state]);
  

  useEffect(() => {
    if (state === "speaking" || state === "thinking") {
      setIsSpeaking(true);
    } else {
      setIsSpeaking(false);
    }
  }, [state, onMetricsUpdate]);

  const handleEnd = () => {
    const finalTranscript = latestTranscriptRef.current.length > 0 
      ? latestTranscriptRef.current 
      : segments.map(s => {
          const text = s.text || (s.segments && s.segments[0]?.text) || "";
          const identity = s.participantInfo?.identity || "Unknown";
          const isLocal = identity === localParticipant?.identity || identity === candidateName;
          return { role: isLocal ? "user" : "agent", text };
        });

    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    
    if (onSessionEnd) {
      const avgTtft = ttftsRef.current.length > 0 
        ? Math.floor(ttftsRef.current.reduce((a, b) => a + b, 0) / ttftsRef.current.length) 
        : 0;

      onSessionEnd({
        latencies: [], // legacy
        turns: ttftsRef.current.length,
        llm_ttft: avgTtft,
        bargeIns: bargeInsRef.current,
        durationSeconds: Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      }, finalTranscript);
    }
  };

  // Build merged transcript: group consecutive same-role segments into one bubble.
  // LiveKit fires one segment per VAD chunk — we must merge same-speaker runs.
  const formattedTranscript = useMemo(() => {
    return segments.reduce((acc, s) => {
      const text = (s.text || (s.segments && s.segments[0]?.text) || "").trim();
      if (!text) return acc;
      const identity = s.participantInfo?.identity || "Unknown";
      const isLocal = identity === localParticipant?.identity || identity === candidateName;
      const role = isLocal ? "user" : "agent";
      if (acc.length > 0 && acc[acc.length - 1].role === role) {
        acc[acc.length - 1] = { role, text: acc[acc.length - 1].text + " " + text };
      } else {
        acc.push({ role, text });
      }
      return acc;
    }, []);
  }, [segments, localParticipant?.identity, candidateName]);

  useEffect(() => {
    if (formattedTranscript.length > 0) {
      latestTranscriptRef.current = formattedTranscript;
    }
  }, [formattedTranscript]);

  useEffect(() => {
    if (connectionState === "connected") {
      wasConnectedRef.current = true;
    }
    if (connectionState === "disconnected" && wasConnectedRef.current && !hasEndedRef.current) {
      handleEnd();
    }
  }, [connectionState]);

  return (
    <GmeetUI
      candidateName={candidateName}
      isSpeaking={isSpeaking}
      isUserSpeaking={isUserSpeakingLive}
      transcript={formattedTranscript}
      onEndInterview={handleEnd}
      agentName="Xona"
    />
  );
}



