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
        <AgentUI onSessionEnd={onSessionEnd} candidateName={candidateName} />
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio" />
    </LiveKitRoom>
  );
}

function AgentUI({ onSessionEnd, candidateName }) {
  const { localParticipant } = useLocalParticipant();
  const isUserSpeakingLive = useIsSpeaking(localParticipant);
  const { state } = useVoiceAssistant();
  const connectionState = useConnectionState();
  const hasEndedRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const latestTranscriptRef = useRef([]);
  const segments = useTranscriptions();

  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (state === "speaking" || state === "thinking") {
      setIsSpeaking(true);
    } else {
      setIsSpeaking(false);
    }
  }, [state]);

  const handleEnd = () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    const finalTranscript = latestTranscriptRef.current.length > 0
      ? latestTranscriptRef.current
      : segments.map(s => {
          const text = s.text || (s.segments && s.segments[0]?.text) || "";
          const identity = s.participantInfo?.identity || "Unknown";
          const isLocal = identity === localParticipant?.identity || identity === candidateName;
          return { role: isLocal ? "user" : "agent", text };
        });

    // Only pass the transcript - metrics now come from the Python server
    if (onSessionEnd) {
      onSessionEnd({}, finalTranscript);
    }
  };

  // Build merged transcript: group consecutive same-role segments into one bubble.
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