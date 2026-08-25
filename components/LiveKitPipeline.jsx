"use client";

import { useState, useRef, useEffect } from "react";
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

  const thinkingStartTimeRef = useRef(null);
  const latenciesRef = useRef([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  

  useEffect(() => {
    if (state === "thinking" && !thinkingStartTimeRef.current) {
      thinkingStartTimeRef.current = Date.now();
      setIsSpeaking(true);
    } else if (state === "speaking") {
      if (thinkingStartTimeRef.current) {
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
      }
      setIsSpeaking(true);
    } else if (state === "listening") {
      thinkingStartTimeRef.current = null;
      setIsSpeaking(false);
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
      onSessionEnd({
        latencies: latenciesRef.current,
        turns: latenciesRef.current.length
      }, finalTranscript);
    }
  };

  const formattedTranscript = segments.map(s => {
    const text = s.text || (s.segments && s.segments[0]?.text) || "";
    const identity = s.participantInfo?.identity || "Unknown";
    const isLocal = identity === localParticipant?.identity || identity === candidateName;
    return { role: isLocal ? "user" : "agent", text };
  });

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
