'use client'

import { useState, useRef, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../page.module.css'
import CanvasArea from '@/components/CanvasArea'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

export default function InterviewSessionPage({ params }) {
  const unwrappedParams = use(params)
  const id = unwrappedParams.id
  const [canvasState, setCanvasState] = useState([])
  const [transcript, setTranscript] = useState([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [started, setStarted] = useState(false)
  const [walkthroughStep, setWalkthroughStep] = useState(0)
  const [theme, setTheme] = useState('light')
  const [interviewContext, setInterviewContext] = useState(null)
  const [isReportGenerating, setIsReportGenerating] = useState(false)
  const [reportData, setReportData] = useState(null)
  const router = useRouter()
  const evaluationTimeoutRef = useRef(null)
  const isProcessingRef = useRef(false)

  // New states for Supabase Integration
  const [linkData, setLinkData] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [loading, setLoading] = useState(true)

  // TTS State
  const [selectedVoice, setSelectedVoice] = useState('en_US-lessac-medium')
  const [ttsStatus, setTtsStatus] = useState('')
  const [ttsReady, setTtsReady] = useState(false)
  const workerRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioQueueRef = useRef([])
  const isPlayingRef = useRef(false)

  useEffect(() => {
    const fetchLink = async () => {
      const { data } = await supabase
        .from('InterviewLink')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        setLinkData(data)
        setInterviewContext({
          problem: {
            title: data.title,
            description: data.problemDesc || 'Design a scalable system based on the interviewer prompts.',
            constraints: 'Focus on scale, availability, and database choices.'
          },
          level: data.level
        })
      }
      setLoading(false)
    }
    fetchLink()

    // Preload basic voices for fallback
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }

    // Init audio context on interaction
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      window.removeEventListener('click', initAudio);
    };
    window.addEventListener('click', initAudio);

    // Init Piper TTS worker
    try {
      workerRef.current = new Worker('/piper.worker.js', { type: 'module' });
      workerRef.current.onmessage = (e) => {
        const { type, status, message, error, audioData, text } = e.data;
        if (type === 'STATUS') setTtsStatus(message);
        if (type === 'READY') {
          setTtsReady(true);
          setTtsStatus('');
        }
        if (type === 'ERROR') {
          console.error('TTS Worker Error:', error);
          setTtsStatus('Failed to load local voice. Falling back to basic voice.');
        }
        if (type === 'AUDIO_CHUNK') {
          scheduleAudio(audioData, text);
        }
      };
    } catch (err) {
      console.error('Failed to init worker', err);
      setTtsStatus('Failed to init worker. Fallback enabled.');
    }

    return () => {
      if (workerRef.current) workerRef.current.terminate();
    }
  }, [id])

  // Initialize or update the TTS worker voice whenever it changes
  useEffect(() => {
    if (workerRef.current) {
      setTtsReady(false);
      workerRef.current.postMessage({ type: 'INIT', voice_id: selectedVoice });
    }
  }, [selectedVoice])

  const nextStartTimeRef = useRef(0)

  const scheduleAudio = async (audioData, text) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    try {
      const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      // Schedule seamlessly
      let startTime = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime + 0.05);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      // Sync the text appearing with the audio starting
      const delayMs = Math.max(0, (startTime - audioContextRef.current.currentTime) * 1000);
      setTimeout(() => {
        setIsSpeaking(true);
        if (text) {
          setTranscript(prev => {
            const newT = [...prev];
            if (newT.length > 0) {
              const lastMsg = { ...newT[newT.length - 1] };
              if (lastMsg.role === 'agent') {
                if (lastMsg.text === '...') lastMsg.text = text.trim();
                else lastMsg.text = (lastMsg.text + " " + text).trim();
                newT[newT.length - 1] = lastMsg;
              }
            }
            return newT;
          });
        }
      }, delayMs);

      source.onended = () => {
        // If we've reached the end of the scheduled audio, turn off the speaking indicator
        if (audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.1) {
          setIsSpeaking(false);
        }
      };
    } catch (err) {
      console.error('Failed to decode audio data:', err);
    }
  }

  useEffect(() => {
    if (started && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            handleEndInterview()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [started, timeLeft])

  const handleStart = async () => {
    if (!candidateName.trim()) {
      alert('Please enter your name to begin.')
      return
    }

    const { data: sessionData, error } = await supabase
      .from('InterviewSession')
      .insert([{
        id: crypto.randomUUID(),
        interviewLinkId: linkData.id,
        candidateName: candidateEmail ? `${candidateName} (${candidateEmail})` : candidateName,
        status: 'in_progress',
        startedAt: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) {
      console.error('Failed to create session:', error)
      alert('Failed to start session. Please try again.')
      return
    }

    setSessionId(sessionData.id)
    setTimeLeft(linkData.durationMin * 60)
    setStarted(true)

    // Send an initial system prompt to trigger the welcome message
    evaluateState([], "Hello, I am ready to begin the interview.")
  }

  const handleCanvasUpdate = async (payload) => {
    const canvasShapes = Array.isArray(payload) ? payload : (payload.shapes || [])
    const canvasBindings = Array.isArray(payload) ? [] : (payload.bindings || [])
    const rawElements = Array.isArray(payload) ? null : (payload.rawElements || null)

    const newShapesStr = JSON.stringify(canvasShapes)
    const oldShapesStr = JSON.stringify(canvasState.shapes || [])
    if (newShapesStr === oldShapesStr) return

    setCanvasState({ shapes: canvasShapes, bindings: canvasBindings, rawElements })

    if (started && canvasShapes.length > 0) {
      if (evaluationTimeoutRef.current) {
        clearTimeout(evaluationTimeoutRef.current)
      }
      // Debounce silent canvas updates
      evaluationTimeoutRef.current = setTimeout(() => {
        evaluateState({ shapes: canvasShapes, bindings: canvasBindings }, null)
      }, 3000)
    }
  }

  const handleUserMessage = async (text) => {
    if (!text || text.trim() === '') return
    if (isProcessingRef.current) return

    setTranscript(prev => [...prev, { role: 'user', text }])
    await evaluateState(canvasState, text)
  }

  const evaluateState = async (state, userText) => {
    if (isProcessingRef.current || isReportGenerating || reportData) return
    isProcessingRef.current = true
    try {
      const payloadShapes = Array.isArray(state) ? state : (state.shapes || [])
      const payloadBindings = Array.isArray(state) ? [] : (state.bindings || [])

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shapes: payloadShapes,
          bindings: payloadBindings,
          userText,
          transcript,
          interviewContext
        })
      })

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json()
        if (data.reply) {
          setTranscript(prev => [...prev, { role: 'agent', text: data.reply }]);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let currentSentence = '';
      
      // Add empty agent message (or '...' if using TTS sync)
      const useTtsSync = ttsReady && workerRef.current;
      setTranscript(prev => [...prev, { role: 'agent', text: useTtsSync ? '...' : '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        currentSentence += chunk;
        
        // Update UI dynamically ONLY if we are not syncing with TTS
        if (!useTtsSync) {
          setTranscript(prev => {
            const newT = [...prev];
            if (newT.length > 0) {
              const lastMsg = { ...newT[newT.length - 1] };
              lastMsg.text = fullText;
              newT[newT.length - 1] = lastMsg;
            }
            return newT;
          });
        }

        // Sentence boundary detection for Piper TTS streaming
        const match = currentSentence.match(/([.!?])\s+/);
        if (match) {
           const parts = currentSentence.split(/([.!?])\s+/);
           // parts format: ["Hello", "!", "World", ".", ""]
           while (parts.length > 2) {
              const textPart = parts.shift();
              const punctPart = parts.shift();
              const sentence = (textPart + punctPart).trim();
              if (sentence && ttsReady && workerRef.current) {
                 workerRef.current.postMessage({ type: 'GENERATE', text: sentence, voice_id: selectedVoice });
              }
           }
           currentSentence = parts[0] || '';
        }
      }
      
      // Flush the remaining text chunk at the end
      if (currentSentence.trim() && ttsReady && workerRef.current) {
         workerRef.current.postMessage({ type: 'GENERATE', text: currentSentence.trim(), voice_id: selectedVoice });
      }

    } catch (error) {
      console.error("Evaluation failed", error)
    } finally {
      isProcessingRef.current = false
    }
  }

  const handleEndInterview = async () => {
    window.speechSynthesis.cancel()
    if (evaluationTimeoutRef.current) clearTimeout(evaluationTimeoutRef.current)
    setIsReportGenerating(true)
    try {
      const payloadShapes = Array.isArray(canvasState) ? canvasState : (canvasState.shapes || [])
      const payloadBindings = Array.isArray(canvasState) ? [] : (canvasState.bindings || [])
      const rawElementsForDB = canvasState.rawElements || payloadShapes

      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shapes: payloadShapes,
          bindings: payloadBindings,
          transcript,
          interviewContext
        })
      })

      const data = await response.json()
      if (response.ok) {
        setReportData(data)

        // Update Supabase session
        if (sessionId) {
          const { error: updateError } = await supabase
            .from('InterviewSession')
            .update({
              status: 'completed',
              score: Math.round(Number(data.score) || 0),
              reportJson: JSON.stringify(data),
              canvasJson: JSON.stringify(rawElementsForDB),
              transcriptJson: JSON.stringify(transcript),
              completedAt: new Date().toISOString()
            })
            .eq('id', sessionId)

          if (updateError) {
            console.error("Failed to update session status:", updateError)
          }
        }
      } else {
        console.error("Failed to generate report:", data.error)
        alert("Failed to generate report. Please try again.")
      }
    } catch (error) {
      console.error("Report generation failed", error)
      alert("Failed to generate report.")
    } finally {
      setIsReportGenerating(false)
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) return <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center', color: '#fff' }}>Loading Interview...</div>
  if (!linkData) return <div className={styles.container} style={{ justifyContent: 'center', alignItems: 'center', color: '#fff' }}>Invalid Interview Link</div>

  return (
    <main className={`${styles.container} ${theme === 'dark' ? styles.darkTheme : ''}`}>
      {!started && walkthroughStep < 2 && (
        <div className={styles.walkthroughOverlay}>
          {walkthroughStep === 0 && (
            <div className={`${styles.tooltipBox} ${styles.canvasTooltip}`}>
              <h3>Design Canvas</h3>
              <p>This is where you'll architect your system. Draw components, connect services, and lay out your design just like a real whiteboard interview.</p>
              <button onClick={() => setWalkthroughStep(1)} className={styles.tooltipNextBtn}>Next</button>
            </div>
          )}
          {walkthroughStep === 1 && (
            <div className={`${styles.tooltipBox} ${styles.sidebarTooltip}`}>
              <h3>AI Interviewer</h3>
              <p>Your interactive AI agent lives here. It will analyze your drawing in real-time and converse with you. Tap the orb to speak.</p>
              <button onClick={() => setWalkthroughStep(2)} className={styles.tooltipNextBtn}>Got it</button>
            </div>
          )}
        </div>
      )}

      {!started && walkthroughStep === 2 && (
        <div className={styles.fullPageOverlay}>
          <div className={styles.startScreenContent} style={{ background: '#ffffff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', color: '#111827', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className={styles.startOrbWrapper} style={{ marginBottom: '24px', width: '180px', height: '180px' }}>
              <video
                autoPlay
                loop
                muted
                playsInline
                className={styles.startOrbVideo}
                src="https://cdn.dribbble.com/userupload/15697531/file/original-0242acdc69146d4472fc5e69b48616dc.mp4"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
              />
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600' }}>{linkData.title}</h2>
            <p style={{ margin: '0 0 24px 0', color: '#6b7280', fontSize: '14px', textAlign: 'center' }}>Please enter your details to begin the interview.</p>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    fontSize: '14px',
                    width: '100%',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#111827'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Email <span style={{ color: '#9ca3af', fontWeight: '400' }}>(Optional)</span></label>
                <input
                  type="email"
                  placeholder="e.g. jane@example.com"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    fontSize: '14px',
                    width: '100%',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#111827'}
                  onBlur={e => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              <div style={{ display: 'none' }}>
                <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Interviewer Voice</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    outline: 'none',
                    fontSize: '14px',
                    width: '100%',
                    background: '#fff'
                  }}
                >
                  <option value="en_US-lessac-medium">Lessac (US Female)</option>
                </select>
              </div>

              {ttsStatus && (
                <div style={{ fontSize: '12px', color: '#059669', background: '#d1fae5', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                  {ttsStatus}
                </div>
              )}
            </div>

            <button
              onClick={handleStart}
              style={{
                width: '100%',
                padding: '12px',
                background: '#111827',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={e => e.target.style.background = '#374151'}
              onMouseOut={e => e.target.style.background = '#111827'}
            >
              Start Interview ({linkData.durationMin} min)
            </button>
          </div>
        </div>
      )}

      <div className={styles.logoContainer}>
        <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin Logo" />
      </div>

      {started && timeLeft !== null && (
        <div style={{ position: 'absolute', top: 16, right: 440, zIndex: 10, background: 'var(--glass-bg)', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', fontWeight: 'bold', color: timeLeft < 60 ? '#ff4d4d' : 'var(--text-main)' }}>
          Time Remaining: {formatTime(timeLeft)}
        </div>
      )}

      <div className={styles.canvasWrapper}>
        <CanvasArea
          onCanvasUpdate={handleCanvasUpdate}
          onThemeChange={(t) => setTheme(t)}
        />
      </div>
      <div className={styles.sidebarWrapper}>
        <Sidebar
          transcript={transcript}
          isSpeaking={isSpeaking}
          onUserMessage={handleUserMessage}
          onEndInterview={handleEndInterview}
        />
      </div>

      {isReportGenerating && (
        <div className={styles.fullPageOverlay}>
          <div className={styles.loader} />
          <h2 style={{ color: 'white', marginTop: '20px' }}>Generating Interview Report...</h2>
        </div>
      )}

      {reportData && (
        <div className={styles.fullPageOverlay}>
          <div className={styles.reportModal}>
            <h2>Interview Feedback</h2>
            <div className={styles.reportScore}>
              Score: <span>{reportData.score}/10</span>
            </div>
            <div className={styles.reportLevel}>
              Level Assessed: <span>{reportData.level}</span>
            </div>
            <div className={styles.reportDecision}>
              Decision: <span className={reportData.decision.toLowerCase() === 'hire' ? styles.decisionHire : styles.decisionNoHire}>{reportData.decision}</span>
            </div>

            <div className={styles.reportSection}>
              <h3>Strengths</h3>
              <ul>
                {reportData.strengths?.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            <div className={styles.reportSection}>
              <h3>Areas for Improvement</h3>
              <ul>
                {reportData.weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>

            {reportData.recommendation && (
              <div className={styles.reportSection}>
                <h3>Recommendation</h3>
                <p style={{ fontWeight: '500', color: '#111827' }}>{reportData.recommendation}</p>
              </div>
            )}

            <div className={styles.reportSection}>
              <h3>Detailed Feedback</h3>
              <p>{reportData.feedback}</p>
            </div>

            <button className={styles.closeReportBtn} onClick={() => router.push('/')}>
              Return to Home
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
