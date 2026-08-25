"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import GmeetUI from "./GmeetUI";

const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
const DEEPGRAM_URL = `wss://api.deepgram.com/v1/listen?model=${process.env.NEXT_PUBLIC_PIPELINE_B_STT_MODEL || "nova-2"}&punctuate=true&endpointing=150&smart_format=true&interim_results=true`;
const CLIENT_SILENCE_MS = 150;

const STATE = {
  IDLE: "idle", LISTENING: "listening",
  TRANSCRIBING: "transcribing", THINKING: "thinking", SPEAKING: "speaking",
};

export default function CustomPipeline({ onSessionEnd, onMetricsUpdate, active = false, interviewPlan, candidateName }) {
  const [phase, setPhase] = useState(STATE.IDLE);
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({ turns: 0, latencies: [] });

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const historyRef = useRef([]);
  const latencyStartRef = useRef(null);
  const audioRef = useRef(null);
  const accumulatedTextRef = useRef("");
  const silenceTimerRef = useRef(null);
  const isMutedRef = useRef(false);
  const startedRef = useRef(false);
  const hasTriggeredStartRef = useRef(false);

  // Audio Queue refs
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isStreamingLLMRef = useRef(false);

  useEffect(() => {
    if (onMetricsUpdate) onMetricsUpdate(metrics);
  }, [metrics, onMetricsUpdate]);

  const addMessage = useCallback((role, text) => {
    const msg = { role, text: text.trim() };
    setTranscript((prev) => [...prev, msg]);
    historyRef.current.push(msg);
  }, []);

  // Playback queue processor
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    setPhase(STATE.SPEAKING);
    isMutedRef.current = true; // Mute mic while agent speaks
    
    const { blob, text } = audioQueueRef.current.shift();
    
    // Add text to transcript before playing
    // addMessage("agent", text);

    const url = URL.createObjectURL(blob);
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    
    audioRef.current.src = url;
    
    audioRef.current.onended = () => {
      URL.revokeObjectURL(url);
      isPlayingRef.current = false;
      
      if (audioQueueRef.current.length > 0) {
        playNextAudio();
      } else if (!isStreamingLLMRef.current) {
        // Only return to listening if LLM is fully done generating
        setPhase(STATE.LISTENING);
        isMutedRef.current = false;
        accumulatedTextRef.current = ""; 
      }
    };

    try {
      await audioRef.current.play();
    } catch (err) {
      console.error("Audio play failed:", err);
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) {
        playNextAudio();
      } else if (!isStreamingLLMRef.current) {
        setPhase(STATE.LISTENING);
        isMutedRef.current = false;
        accumulatedTextRef.current = "";
      }
    }
  }, [addMessage]);

  const handleLLMStream = useCallback(async (textPayload) => {
    try {
      const response = await fetch("/api/pipeline-b/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          history: historyRef.current, 
          newMessage: textPayload,
          interviewPlan: interviewPlan 
        }),
      });

      if (!response.ok) throw new Error("LLM Error");
      
      // Calculate TTFB latency
      if (latencyStartRef.current) {
        const ttfb = Date.now() - latencyStartRef.current;
        setMetrics(prev => ({
          turns: prev.turns + 1,
          latencies: [...prev.latencies, ttfb]
        }));
        latencyStartRef.current = null;
      }

      isStreamingLLMRef.current = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponseText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        fullResponseText += chunk;
        
        // Split by sentences to chunk TTS
        const sentences = buffer.match(/[^.!?]+[.!?]+/g);
        
        if (sentences) {
          for (const sentence of sentences) {
            await fetchTTS(sentence.trim());
          }
          buffer = buffer.replace(/[^.!?]+[.!?]+/g, ""); // keep remainder
        }
      }
      
      // Flush remainder
      if (buffer.trim()) {
        await fetchTTS(buffer.trim());
      }
      
      // Add the entire response as a single bubble to the transcript
      if (fullResponseText.trim().length > 0) {
        addMessage("agent", fullResponseText.trim());
      }
      
      isStreamingLLMRef.current = false;
      
      // If audio queue finished before LLM stream ended, restart state
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
         setPhase(STATE.LISTENING);
         isMutedRef.current = false;
         accumulatedTextRef.current = "";
      }

    } catch (err) {
      console.error(err);
      setError("Failed to get agent response");
      setPhase(STATE.LISTENING);
    }
  }, [interviewPlan]);

  const fetchTTS = async (text) => {
    if (!text) return;
    try {
      const response = await fetch("/api/pipeline-b/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("TTS Error");
      
      const blob = await response.blob();
      audioQueueRef.current.push({ blob, text });
      playNextAudio();
      
    } catch (err) {
      console.error(err);
    }
  };

  const processUserSpeech = useCallback(async () => {
    if (isMutedRef.current) return;
    const finalUserText = accumulatedTextRef.current.trim();
    if (!finalUserText) return;

    setPhase(STATE.THINKING);
    latencyStartRef.current = Date.now();
    addMessage("user", finalUserText);
    
    setPartialText("");
    accumulatedTextRef.current = "";

    await handleLLMStream(finalUserText);
  }, [addMessage, handleLLMStream]);

  // STT Handlers
  const handleMessage = useCallback((event) => {
    if (isMutedRef.current) return;

    const data = JSON.parse(event.data);
    const transcriptText = data?.channel?.alternatives[0]?.transcript;

    if (transcriptText) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setPhase(STATE.TRANSCRIBING);

      if (data.is_final) {
        accumulatedTextRef.current += " " + transcriptText;
        setPartialText(accumulatedTextRef.current);

        silenceTimerRef.current = setTimeout(() => {
          processUserSpeech();
        }, CLIENT_SILENCE_MS);
      } else {
        setPartialText(accumulatedTextRef.current + " " + transcriptText);
      }
    }
  }, [processUserSpeech]);

  const connectDeepgram = useCallback(() => {
    if (!DEEPGRAM_API_KEY) {
      setError("Deepgram API Key missing");
      return;
    }
    const ws = new WebSocket(DEEPGRAM_URL, ["token", DEEPGRAM_API_KEY]);
    ws.onopen = () => {
      setPhase(STATE.LISTENING);
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
        mediaRecorderRef.current.start(250);
      }

      if (!hasTriggeredStartRef.current) {
        hasTriggeredStartRef.current = true;
        handleLLMStream("START_INTERVIEW");
      }
    };
    ws.onmessage = handleMessage;
    ws.onclose = () => {
       if (startedRef.current) {
          // Attempt reconnect if closed unexpectedly
          setTimeout(connectDeepgram, 1000);
       }
    };
    ws.onerror = () => setError("STT connection error");
    wsRef.current = ws;
  }, [handleMessage]);

  const startMic = useCallback(async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      
      mediaRecorderRef.current.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      });
      
      connectDeepgram();
    } catch (err) {
      setError("Microphone access denied");
    }
  }, [connectDeepgram]);

  // Handle active flag
  useEffect(() => {
    if (active && !startedRef.current) {
      startedRef.current = true;
      startMic();
    }
    
    return () => {
      if (!active && startedRef.current) {
        startedRef.current = false;
        if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        if (wsRef.current) wsRef.current.close();
      }
    };
  }, [active, startMic]);

  const handleEnd = () => {
    if (onSessionEnd) {
      onSessionEnd(metrics, transcript);
    }
  };

  const isUserSpeaking = partialText.length > 0 && phase !== STATE.THINKING && phase !== STATE.SPEAKING;

  return (
    <GmeetUI
      candidateName={candidateName}
      isSpeaking={phase === STATE.SPEAKING || phase === STATE.THINKING}
      isUserSpeaking={isUserSpeaking}
      transcript={transcript}
      onEndInterview={handleEnd}
      agentName="Xona"
    />
  );
}

