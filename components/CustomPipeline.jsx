"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const DEEPGRAM_API_KEY = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
const DEEPGRAM_URL = `wss://api.deepgram.com/v1/listen?model=${process.env.NEXT_PUBLIC_PIPELINE_B_STT_MODEL || "nova-3"}&punctuate=true&endpointing=150&smart_format=true`;
const CLIENT_SILENCE_MS = 600;

const STATE = {
  IDLE: "idle", LISTENING: "listening",
  TRANSCRIBING: "transcribing", THINKING: "thinking", SPEAKING: "speaking",
};
const STATE_LABELS = {
  [STATE.IDLE]: "Waiting...", [STATE.LISTENING]: "Listening...",
  [STATE.TRANSCRIBING]: "Transcribing...", [STATE.THINKING]: "Thinking...", [STATE.SPEAKING]: "Agent Speaking",
};

export default function CustomPipeline({ onSessionEnd, onMetricsUpdate, active = false }) {
  const [phase, setPhase] = useState(STATE.IDLE);
  const [transcript, setTranscript] = useState([]);
  const [partialText, setPartialText] = useState("");
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({ turns: 0, totalLatencyMs: [] });

  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const historyRef = useRef([]);
  const latencyStartRef = useRef(null);
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const accumulatedTextRef = useRef("");
  const silenceTimerRef = useRef(null);
  const isMutedRef = useRef(false);
  const startedRef = useRef(false);

  // Audio Queue refs
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isStreamingLLMRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, partialText]);

  useEffect(() => {
    if (onMetricsUpdate) onMetricsUpdate(metrics);
  }, [metrics, onMetricsUpdate]);

  const addMessage = useCallback((role, text) => {
    setTranscript((prev) => [...prev, { role, text, ts: Date.now() }]);
    historyRef.current = [...historyRef.current, { role, content: text }];
  }, []);

  const updateLastAssistantMessage = useCallback((text) => {
    setTranscript((prev) => {
      const newT = [...prev];
      if (newT.length > 0 && newT[newT.length - 1].role === "assistant") {
        newT[newT.length - 1].text = text;
      }
      return newT;
    });
  }, []);

  const processAudioQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    setPhase(STATE.SPEAKING);
    const url = audioQueueRef.current.shift();
    
    const audio = new Audio(url);
    audioRef.current = audio;
    
    const done = () => {
      URL.revokeObjectURL(url);
      isPlayingRef.current = false;
      if (audioQueueRef.current.length > 0) {
        processAudioQueue();
      } else if (!isStreamingLLMRef.current) {
        // Completely finished
        isMutedRef.current = false;
        accumulatedTextRef.current = "";
        setPartialText("");
        setPhase(STATE.LISTENING);
      }
    };
    
    audio.onended = done;
    audio.onerror = done;
    
    // Attempt playback. If browser blocks due to autoplay policy, skip gracefully.
    audio.play().catch((err) => {
      console.warn("Audio playback blocked or failed:", err);
      done();
    });
  }, []);

  const fetchTTSForChunk = useCallback(async (textChunk) => {
    if (!textChunk.trim()) return;
    try {
      const res = await fetch("/api/pipeline-b/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textChunk }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioQueueRef.current.push(url);
      processAudioQueue();
    } catch (err) {
      console.error("[TTS Chunk Error]", err);
    }
  }, [processAudioQueue]);

  const sendToLLM = useCallback(async (userText) => {
    const clean = (userText || "").trim();
    if (!clean) return;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    
    // Stop any currently playing audio if user interrupted (though mic should be muted, just in case)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    accumulatedTextRef.current = "";
    setPartialText("");
    addMessage("user", clean);
    setPhase(STATE.THINKING);
    latencyStartRef.current = Date.now();
    isMutedRef.current = true; // Mute mic while processing
    
    try {
      const res = await fetch("/api/pipeline-b/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: clean, history: historyRef.current.slice(-10) }),
      });
      
      if (!res.ok) {
         const d = await res.json();
         throw new Error(d.error || "LLM request failed");
      }

      isStreamingLLMRef.current = true;
      let latencyMs = Date.now() - latencyStartRef.current;
      setMetrics((m) => ({ turns: m.turns + 1, totalLatencyMs: [...m.totalLatencyMs, latencyMs] }));
      
      // Setup stream reader
      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let fullResponseText = "";
      let sentenceBuffer = "";
      
      addMessage("assistant", ""); // Placeholder for stream

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkStr = decoder.decode(value, { stream: true });
        fullResponseText += chunkStr;
        sentenceBuffer += chunkStr;
        
        updateLastAssistantMessage(fullResponseText);

        // Improved sentence boundary check: matches punctuation followed by space or newline
        const match = sentenceBuffer.match(/([.?!])([\s\n]+)/);
        if (match) {
           const splitIndex = match.index + match[1].length;
           const chunkToSpeak = sentenceBuffer.slice(0, splitIndex).trim();
           sentenceBuffer = sentenceBuffer.slice(splitIndex); // Keep the space/newline for the next buffer, or trim it
           
           if (chunkToSpeak) {
             fetchTTSForChunk(chunkToSpeak);
           }
        }
      }

      // Flush remaining text
      const finalChunk = sentenceBuffer.trim();
      if (finalChunk) {
        fetchTTSForChunk(finalChunk);
      }
      
      // Stream done
      isStreamingLLMRef.current = false;
      historyRef.current = [...historyRef.current, { role: "assistant", content: fullResponseText }];
      
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        // Fallback if audio failed or nothing was queued
        isMutedRef.current = false;
        setPhase(STATE.LISTENING);
      }

    } catch (err) {
      console.error("[LLM]", err);
      setError(err.message);
      isMutedRef.current = false;
      isStreamingLLMRef.current = false;
      setPhase(STATE.LISTENING);
    }
  }, [addMessage, updateLastAssistantMessage, fetchTTSForChunk]);

  const flushUtterance = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (isMutedRef.current) return;
    const finalText = accumulatedTextRef.current.trim();
    if (finalText) sendToLLM(finalText);
  }, [sendToLLM]);

  const startSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => { console.log("[SilenceTimer] fired"); flushUtterance(); }, CLIENT_SILENCE_MS);
  }, [flushUtterance]);

  const startDeepgram = useCallback((stream) => {
    accumulatedTextRef.current = "";
    const ws = new WebSocket(DEEPGRAM_URL, ["token", DEEPGRAM_API_KEY]);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log("[Deepgram] Connected");
      setPhase(STATE.LISTENING);
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (ws.readyState === WebSocket.OPEN && e.data.size > 0) ws.send(e.data); };
      recorder.start(100);
    };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type !== "Results") return;
        if (isMutedRef.current) return;
        const alt = data.channel?.alternatives?.[0];
        const text = (alt?.transcript || "").trim();
        if (data.is_final) {
          if (text) { accumulatedTextRef.current += (accumulatedTextRef.current ? " " : "") + text; setPartialText(accumulatedTextRef.current); setPhase(STATE.TRANSCRIBING); }
          if (data.speech_final) { flushUtterance(); }
          else if (accumulatedTextRef.current) startSilenceTimer();
        } else if (text) {
          setPartialText(accumulatedTextRef.current + (accumulatedTextRef.current ? " " : "") + text);
          setPhase(STATE.TRANSCRIBING);
        }
      } catch (err) { console.error("[Deepgram] parse error", err); }
    };
    ws.onerror = (e) => { console.error("[Deepgram] Error", e); setError("Deepgram connection error"); };
    ws.onclose = () => console.log("[Deepgram] Disconnected");
  }, [flushUtterance, startSilenceTimer]);

  useEffect(() => {
    if (active && !startedRef.current) {
      startedRef.current = true;
      isMutedRef.current = false;
      historyRef.current = [];
      setTranscript([]);
      setMetrics({ turns: 0, totalLatencyMs: [] });
      accumulatedTextRef.current = "";
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      isStreamingLLMRef.current = false;
      
      // Unlock audio context on first render just to be safe
      const dummy = new Audio();
      dummy.play().catch(() => {});
      
      navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then((stream) => { streamRef.current = stream; startDeepgram(stream); })
        .catch((err) => setError("Microphone access denied: " + err.message));
    }
    if (!active && startedRef.current) {
      startedRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current = null; }
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setPhase(STATE.IDLE);
    }
  }, [active, startDeepgram]);

  const avgLatency = metrics.totalLatencyMs.length > 0
    ? Math.round(metrics.totalLatencyMs.reduce((a, b) => a + b, 0) / metrics.totalLatencyMs.length) : null;

  const phaseColor = {
    [STATE.IDLE]: "#334155", [STATE.LISTENING]: "#22c55e",
    [STATE.TRANSCRIBING]: "#f59e0b", [STATE.THINKING]: "#6366f1", [STATE.SPEAKING]: "#0ea5e9",
  };

  return (
    <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: phaseColor[phase] }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: phaseColor[phase] }}>{STATE_LABELS[phase]}</span>
        </div>
        {avgLatency && <span style={{ fontSize: 11, background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: 9999, fontWeight: 600 }}>Avg: {avgLatency}ms</span>}
      </div>
      {error && <div style={{ padding: "8px 16px", background: "#fef2f2", color: "#dc2626", fontSize: 12, borderBottom: "1px solid #fecaca" }}>?? {error}</div>}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {transcript.length === 0 && (
          <div style={{ textAlign: "center", color: "#94a3b8", marginTop: 40, fontSize: 13 }}>
            {active ? "You speak first - agent will respond." : "Waiting for session to start..."}
          </div>
        )}
        {transcript.map((msg, i) => (
          <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", background: msg.role === "user" ? "#0ea5e9" : "#f1f5f9", color: msg.role === "user" ? "#fff" : "#0f172a", padding: "8px 12px", borderRadius: 12, maxWidth: "85%", fontSize: 13, lineHeight: "1.4", whiteSpace: "pre-wrap" }}>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2, fontWeight: 600 }}>{msg.role === "user" ? "You" : "Agent B"}</div>
            {msg.text}
          </div>
        ))}
        {partialText && phase !== STATE.THINKING && phase !== STATE.SPEAKING && (
          <div style={{ alignSelf: "flex-end", background: "#bae6fd", color: "#0c4a6e", padding: "8px 12px", borderRadius: 12, maxWidth: "85%", fontSize: 13, fontStyle: "italic", opacity: 0.8 }}>
            <div style={{ fontSize: 10, marginBottom: 2, fontWeight: 600 }}>You (speaking...)</div>
            {partialText}
          </div>
        )}
      </div>
    </div>
  );
}
