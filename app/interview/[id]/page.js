'use client'
export const runtime = 'edge';
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from '../page.module.css'
import CanvasArea from '@/components/CanvasArea'
import { supabase } from '@/lib/supabase'
import { Mic, Code, PenTool, MessageSquare, Play, Square, Settings } from 'lucide-react'

export default function InterviewSessionPage({ params }) {
  const id = params.id
  const [canvasState, setCanvasState] = useState([])
  const [transcript, setTranscript] = useState([])
  const transcriptRef = useRef([])
  const codingTranscriptRef = useRef(null)
  const systemDesignTranscriptRef = useRef(null)
  const showConversationTranscriptRef = useRef(null)
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
  const [isPreparingAgent, setIsPreparingAgent] = useState(false)

  // New states for Supabase Integration
  const [linkData, setLinkData] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [loading, setLoading] = useState(true)

  // STT State
  const [isRecording, setIsRecording] = useState(false)
  const [isSttReady, setIsSttReady] = useState(false)
  const [inputText, setInputText] = useState('')
  const inputTextRef = useRef('')
  const [partialText, setPartialText] = useState('')
  const [autoSendTrigger, setAutoSendTrigger] = useState(0)
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const isUserSpeakingRef = useRef(false)
  const silenceTimeoutRef = useRef(null)

  // Layout State
  const [activeTab, setActiveTab] = useState('interview')
  const [showConversation, setShowConversation] = useState(false)
  const [submittedCode, setSubmittedCode] = useState('// Write your code here...')

  const wsRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const processorRef = useRef(null)
  const lastAppendedTextRef = useRef('')

  // TTS State
  const [selectedVoice, setSelectedVoice] = useState('en_US-lessac-medium')
  const [ttsStatus, setTtsStatus] = useState('')
  const [ttsReady, setTtsReady] = useState(false)
  const ttsReadyRef = useRef(false)
  const videoRef = useRef(null)
  const [hasGpu, setHasGpu] = useState(null)
  const [ttsEngine, setTtsEngine] = useState('piper')
  const workerRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioQueueRef = useRef([])
  const isPlayingRef = useRef(false)
  const isSpeakingRef = useRef(false)
  const activeAudioSourcesRef = useRef(0)
  const lastInitVoiceRef = useRef(null)
  
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    if (videoRef.current) {
      if (isSpeaking) {
        videoRef.current.play().catch(e => console.log(e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isSpeaking]);

  const checkWebGPU = async () => {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return false;
      let info;
      if (adapter.info) {
        info = adapter.info;
      } else if (typeof adapter.requestAdapterInfo === 'function') {
        info = await adapter.requestAdapterInfo();
      } else {
        info = { description: '', vendor: '', architecture: '' };
      }
      const desc = info.description?.toLowerCase() || '';
      const vendor = info.vendor?.toLowerCase() || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) return false;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if (isMac) return true;
      const isIntel = desc.includes('intel') || vendor.includes('intel');
      const isAmdIgpu = (desc.includes('amd') || vendor.includes('amd')) &&
        (desc.includes('integrated') || desc === 'amd radeon graphics' || desc === 'amd radeon(tm) graphics' || !desc.includes('rx '));
      if (isIntel || isAmdIgpu) return false;
      return true;
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    checkWebGPU().then(gpu => {
      setHasGpu(gpu);
      if (gpu) setTtsEngine('kokoro');
      else setTtsEngine('piper');
    });
  }, []);

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
            description: data.jobDescription || data.problemDesc || 'Design a scalable system based on the interviewer prompts.',
            constraints: 'Focus on scale, availability, and database choices.'
          },
          level: data.level,
          plan: data.interviewPlan
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

    // Init TTS worker (debounced to prevent React StrictMode double-creation)
    let initTimeout;
    
    initTimeout = setTimeout(() => {
      try {
        if (ttsEngine === 'kokoro') {
          console.log('Main thread: Creating Kokoro Worker...');
          workerRef.current = new Worker('/kokoro.worker.js', { type: 'module' });
          workerRef.current.postMessage({ type: 'INIT', voice_id: 'af_heart' });
        } else {
          console.log('Main thread: Creating Piper Worker...');
          workerRef.current = new Worker('/piper.worker.js', { type: 'module' });
          lastInitVoiceRef.current = selectedVoice;
          workerRef.current.postMessage({ type: 'INIT', voice_id: selectedVoice });
        }
        
        workerRef.current.onmessage = (e) => {
          const { type, status, message, error, audioData, isRawPCM, sampleRate, text } = e.data;
          if (type === 'STATUS' && !message?.includes('0%') && !message?.includes('100%') && Math.random() < 0.99) return; // Reduce log spam
          console.log('Main thread: Received message from worker:', type, message || error || '');
          if (type === 'STATUS') setTtsStatus(message);
          if (type === 'READY') {
            setTtsReady(true);
            ttsReadyRef.current = true;
            setTtsStatus('');
          }
          if (type === 'ERROR') {
            console.error('TTS Worker Error:', error);
            setTtsStatus('Failed to load local voice.');
          }
          if (type === 'AUDIO_CHUNK') {
            scheduleAudio(audioData, text, isRawPCM, sampleRate);
          }
        };
        console.log(`Main thread: ${ttsEngine} Worker created successfully`);
      } catch (err) {
        console.error('Failed to init worker', err);
        setTtsStatus('Failed to init worker.');
      }
    }, 300);

    return () => {
      clearTimeout(initTimeout);
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    }
  }, [id, ttsEngine])

    // Fallback UI indicator for speaking since we removed raw VAD
    useEffect(() => {
      if (inputText || partialText) {
        if (!isUserSpeaking) setIsUserSpeaking(true);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          setIsUserSpeaking(false);
        }, 500);
      }
    }, [inputText, partialText]);
  
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

    // Keep refs in sync with state
    useEffect(() => {
      transcriptRef.current = transcript;
    }, [transcript]);
    useEffect(() => {
      inputTextRef.current = inputText;
    }, [inputText]);

    // Auto-scroll all conversation panels when transcript updates
    useEffect(() => {
      if (codingTranscriptRef.current) {
        codingTranscriptRef.current.scrollTop = codingTranscriptRef.current.scrollHeight;
      }
      if (systemDesignTranscriptRef.current) {
        systemDesignTranscriptRef.current.scrollTop = systemDesignTranscriptRef.current.scrollHeight;
      }
      if (showConversationTranscriptRef.current) {
        showConversationTranscriptRef.current.scrollTop = showConversationTranscriptRef.current.scrollHeight;
      }
    }, [transcript]);
  
    // Handle Auto-send VAD trigger — use ref to avoid stale closure
    useEffect(() => {
      if (autoSendTrigger > 0) {
        const currentText = inputTextRef.current.trim();
        // Only clear and submit if there's actual content
        if (currentText !== '') {
          setInputText('');
          setPartialText('');
          inputTextRef.current = '';
          handleUserMessage(currentText);
        }
      }
    }, [autoSendTrigger]);

  // Initialize or update the TTS worker voice whenever it changes
  useEffect(() => {
    if (ttsEngine === 'kokoro') return;
    console.log('Main thread: selectedVoice changed to', selectedVoice, 'Worker exists:', !!workerRef.current);
    if (workerRef.current && lastInitVoiceRef.current !== selectedVoice) {
      lastInitVoiceRef.current = selectedVoice;
      setTtsReady(false);
      ttsReadyRef.current = false;
      console.log('Main thread: Sending INIT message to worker');
      workerRef.current.postMessage({ type: 'INIT', voice_id: selectedVoice });
    }
  }, [selectedVoice, ttsEngine])

  const nextStartTimeRef = useRef(0)

  const scheduleAudio = async (audioData, text, isRawPCM, sampleRate) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    try {
      let audioBuffer;
      if (isRawPCM) {
        const f32 = new Float32Array(audioData);
        audioBuffer = audioContextRef.current.createBuffer(1, f32.length, sampleRate || 24000);
        audioBuffer.copyToChannel(f32, 0);
      } else {
        audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);

      // Increment active sources
      activeAudioSourcesRef.current += 1;

      // Schedule seamlessly
      let startTime = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime + 0.05);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

        // Sync the text appearing with the audio starting
        const delayMs = Math.max(0, (startTime - audioContextRef.current.currentTime) * 1000);
        setTimeout(() => {
          isSpeakingRef.current = true;
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
        activeAudioSourcesRef.current -= 1;
        if (activeAudioSourcesRef.current <= 0) {
          activeAudioSourcesRef.current = 0;
          isSpeakingRef.current = false;
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      // Connect STT with dynamic sampleRate
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
      if (apiKey) {
        const sampleRate = audioContextRef.current.sampleRate || 16000;
        console.log(`[STT] Connecting to Deepgram with sample_rate=${sampleRate}`);
        const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&encoding=linear16&sample_rate=${sampleRate}&channels=1&endpointing=150&interim_results=true`;
        
        if (wsRef.current) wsRef.current.close();
        const ws = new WebSocket(deepgramUrl, ['token', apiKey]);
        ws.onopen = () => setIsSttReady(true);
        ws.onmessage = (event) => {
          try {
            // Keep logs slim but log any non-transcript messages fully
            const parsed = JSON.parse(event.data);
            if (!parsed.channel) {
              console.log('[STT] Deepgram metadata/error:', parsed);
            }
            if (parsed.channel && parsed.channel.alternatives && parsed.channel.alternatives[0]) {
              const text = parsed.channel.alternatives[0].transcript;
              const isFinal = parsed.is_final;
              const speechFinal = parsed.speech_final;
              if (text) {
                if (isFinal) {
                  setInputText(prev => {
                    const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
                    return prev + spacer + text.trim();
                  });
                  setPartialText('');
                  if (speechFinal) setAutoSendTrigger(prev => prev + 1);
                } else {
                  setPartialText(text);
                }
              }
              if (speechFinal && !text) {
                setAutoSendTrigger(prev => prev + 1);
              }
            }
          } catch (err) {
            console.error('Deepgram parse error:', err);
          }
        };
        ws.onerror = (e) => console.error('Deepgram WS error:', e);
        ws.onclose = () => setIsSttReady(false);
        wsRef.current = ws;
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const speaking = isSpeakingRef.current;
          const wsOpen = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
             sum += inputData[i] * inputData[i];
          }
          let rms = Math.sqrt(sum / inputData.length);
          if (rms > 0.02 && !speaking) {
             if (!isUserSpeakingRef.current) {
                isUserSpeakingRef.current = true;
                setIsUserSpeaking(true);
             }
             if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
             silenceTimeoutRef.current = setTimeout(() => {
                isUserSpeakingRef.current = false;
                setIsUserSpeaking(false);
             }, 500);
          }

          // Always send to Deepgram to prevent timeout, but send silence when agent is speaking
          if (wsOpen) {
            let l = inputData.length;
            let buf = new Int16Array(l);
            while (l--) {
              let s = speaking ? 0 : Math.max(-1, Math.min(1, inputData[l]));
              buf[l] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            wsRef.current.send(buf.buffer);
          }
        };

      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = 0; // Mute the mic playback to prevent feedback loop!
      
      source.connect(processor);
      processor.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      processorRef.current = processor;

      setIsRecording(true);
    } catch (error) {
      console.error('Error starting microphone:', error);
    }
  };

  const stopRecording = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleStart = async () => {
    if (!candidateName.trim()) {
      alert('Please enter your name to begin.')
      return
    }

    setIsPreparingAgent(true)

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
      setIsPreparingAgent(false)
      return
    }

    setSessionId(sessionData.id)
    setTimeLeft(linkData.durationMin * 60)

    // Wait until TTS is actually ready with a minimum delay for the loading animation
    const waitForTTS = () => new Promise(resolve => {
      const startTime = Date.now()
      const checkInterval = setInterval(() => {
        if (ttsReadyRef.current && (Date.now() - startTime > 2500)) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 500)
    })
    
    await waitForTTS()

    // Give it a brief visual delay so the user sees the preparation screen
    setTimeout(async () => {
      setIsPreparingAgent(false)
      setStarted(true)

      // Start listening immediately
      await startRecording();

      // Send an initial system prompt to trigger the welcome message
      evaluateState([], "Hello, I am ready to begin the interview.")
    }, 2000)
  }

  const handleCanvasUpdate = async (payload) => {
    const canvasShapes = Array.isArray(payload) ? payload : (payload.shapes || [])
    const canvasBindings = Array.isArray(payload) ? [] : (payload.bindings || [])
    const rawElements = Array.isArray(payload) ? payload : (payload.rawElements || payload.elements || null)

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

      setTranscript(prev => [...prev, { role: 'user', text, phase: activeTab }])

      // If agent is already processing, wait for it to finish then evaluate
      if (isProcessingRef.current) {
        const waitAndEval = () => {
          if (!isProcessingRef.current) {
            evaluateState(canvasState, text);
          } else {
            setTimeout(waitAndEval, 300);
          }
        };
        setTimeout(waitAndEval, 300);
        return;
      }

      await evaluateState(canvasState, text)
    }

  const cleanForTTS = (text) => {
    return text
      .replace(/[*#_`~>]/g, '')  // Remove markdown symbols
      .replace(/\n/g, ' ')       // Replace newlines with spaces
      .replace(/\s{2,}/g, ' ')   // Collapse multiple spaces
      .trim();
  }

  const evaluateState = async (state, userText, overridePhase) => {
    if (isProcessingRef.current || isReportGenerating || reportData) return
    isProcessingRef.current = true
    try {
      const payloadShapes = Array.isArray(state) ? state : (state.shapes || [])
      const payloadBindings = Array.isArray(state) ? [] : (state.bindings || [])

      // Map voice ID to language name for the LLM prompt
      const getLanguageName = (id) => {
        if (id.includes('hi_IN')) return 'Hindi';
        if (id.includes('te_IN')) return 'Telugu';
        if (id.includes('ta_IN')) return 'Tamil';
        if (id.includes('ml_IN')) return 'Malayalam';
        if (id.includes('fr_FR')) return 'French';
        if (id.includes('pl_PL')) return 'Polish';
        if (id.includes('zh_CN')) return 'Chinese';
        return 'English';
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shapes: payloadShapes,
          bindings: payloadBindings,
          userText,
          transcript: transcriptRef.current,
          interviewContext,
          language: getLanguageName(selectedVoice),
          currentPhase: overridePhase || activeTab
        })
      })

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json()
        if (data.reply) {
          setTranscript(prev => [...prev, { role: 'agent', text: data.reply, phase: activeTab }]);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let currentSentence = '';
      let phaseChangedTo = null;
      
      // Add empty agent message (or '...' if using TTS sync)
      const useTtsSync = ttsReadyRef.current && workerRef.current;
      setTranscript(prev => [...prev, { role: 'agent', text: useTtsSync ? '...' : '', phase: overridePhase || activeTab }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        currentSentence += chunk;

        // Detect and strip phase change triggers
        if (fullText.includes('[PHASE_CHANGE: coding]')) {
           setActiveTab('coding');
           fullText = fullText.replace('[PHASE_CHANGE: coding]', '');
           currentSentence = currentSentence.replace('[PHASE_CHANGE: coding]', '');
           phaseChangedTo = 'coding';
        }
        if (fullText.includes('[PHASE_CHANGE: system_design]')) {
           setActiveTab('system_design');
           fullText = fullText.replace('[PHASE_CHANGE: system_design]', '');
           currentSentence = currentSentence.replace('[PHASE_CHANGE: system_design]', '');
           phaseChangedTo = 'system_design';
        }
        
        // Update UI dynamically ONLY if we are not syncing with TTS
        if (!useTtsSync) {
          setTranscript(prev => {
            const newT = [...prev];
            if (newT.length > 0) {
              const lastMsg = { ...newT[newT.length - 1] };
              lastMsg.text = fullText.trim();
              newT[newT.length - 1] = lastMsg;
            }
            return newT;
          });
        }

        // Sentence boundary detection for Piper TTS streaming
        const match = currentSentence.match(/(\.(?!\d)|[!?。！？।॥])\s*/);
        if (match) {
           const parts = currentSentence.split(/(\.(?!\d)|[!?。！？।॥])\s*/);
           while (parts.length > 2) {
              const textPart = parts.shift();
              const punctPart = parts.shift();
              const sentence = (textPart + punctPart).trim();
              const cleanedSentence = cleanForTTS(sentence);
              if (cleanedSentence && ttsReadyRef.current && workerRef.current) {
                 const voice = ttsEngine === 'kokoro' ? 'af_heart' : selectedVoice;
                 workerRef.current.postMessage({ type: 'GENERATE', text: cleanedSentence, voice_id: voice });
              }
           }
           currentSentence = parts[0] || '';
        }
      }
      
      // Flush the remaining text chunk at the end
      if (currentSentence.trim() && ttsReadyRef.current && workerRef.current) {
         const cleaned = cleanForTTS(currentSentence);
         if (cleaned) {
            const voice = ttsEngine === 'kokoro' ? 'af_heart' : selectedVoice;
            workerRef.current.postMessage({ type: 'GENERATE', text: cleaned, voice_id: voice });
         }
      }

      // If the agent chose to remain silent (e.g. evaluating the canvas without comment), remove the placeholder
      if (fullText.trim() === '') {
        setTranscript(prev => {
          const newT = [...prev];
          newT.pop();
          return newT;
        });
      }

      // If a phase change was detected, trigger opening question for the new phase
      if (phaseChangedTo) {
        const newPhase = phaseChangedTo;
        const triggerMsg = newPhase === 'coding'
          ? '(Phase just changed to Coding. Welcome the candidate and present the coding question now.)'
          : '(Phase just changed to System Design. Welcome the candidate and present the system design problem now.)';
        setTimeout(() => {
          isProcessingRef.current = false;
          evaluateState(canvasState, triggerMsg, newPhase);
        }, 800);
        return;
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
      const rawElementsForDB = canvasState.rawElements || canvasState.elements || payloadShapes

      const response = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shapes: payloadShapes,
          bindings: payloadBindings,
          rawElements: rawElementsForDB,
          transcript,
          interviewContext,
          submittedCode
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
      {!started && !isPreparingAgent && (
        <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', position: 'absolute', top: 0, left: 0, zIndex: 100 }}>
          <div style={{ background: '#ffffff', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin Logo" style={{ height: '36px', marginBottom: '24px' }} />
            
            <p style={{ margin: '0 0 32px 0', color: '#1e3a8a', fontSize: '15px', textAlign: 'center', lineHeight: '1.5' }}>
              Hello! I'm glad to have you for the <strong style={{color: '#0369a1'}}>{linkData.title}</strong> interview today. Before we begin, could you please fill in the details below?
            </p>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#0369a1' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="Ex: John Doe"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    background: '#f8f9fb',
                    outline: 'none',
                    fontSize: '14px',
                    width: '100%',
                    color: '#111827',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#0284c7'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#0369a1' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="Ex: john@example.com"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    background: '#f8f9fb',
                    outline: 'none',
                    fontSize: '14px',
                    width: '100%',
                    color: '#111827',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#0284c7'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>

            <button
              onClick={handleStart}
              style={{
                width: '100%',
                padding: '14px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseOver={e => e.target.style.background = '#0369a1'}
              onMouseOut={e => e.target.style.background = '#0284c7'}
            >
              Start Interview
            </button>
          </div>
        </div>
      )}

      {isPreparingAgent && (
        <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', position: 'absolute', top: 0, left: 0, zIndex: 110, flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', animation: 'spin 2s linear infinite' }} viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle cx="50" cy="50" r="48" fill="none" stroke="#0284c7" strokeWidth="4" strokeDasharray="300" strokeDashoffset="220" strokeLinecap="round" />
            </svg>
            <img src="/favicon.ico" alt="Xobin Logo" style={{ width: '48px', height: '48px', borderRadius: '8px' }} />
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <h3 style={{ margin: 0, color: '#111827', fontSize: '20px', fontWeight: '600' }}>Preparing the agent...</h3>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>Please wait while we set up your interview environment.</p>
        </div>
      )}

      {started && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#f8f9fb', position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
          {/* Header */}
          <div style={{ height: '72px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
            <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin Logo" style={{ height: '32px' }} />
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setActiveTab('interview')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'interview' ? '#e0f2fe' : 'transparent', color: activeTab === 'interview' ? '#0284c7' : '#4b5563', fontWeight: '500', cursor: 'pointer' }}>Interview</button>
              <button onClick={() => setActiveTab('coding')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'coding' ? '#e0f2fe' : 'transparent', color: activeTab === 'coding' ? '#0284c7' : '#4b5563', fontWeight: '500', cursor: 'pointer' }}>Coding</button>
              <button onClick={() => setActiveTab('system_design')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: activeTab === 'system_design' ? '#e0f2fe' : 'transparent', color: activeTab === 'system_design' ? '#0284c7' : '#4b5563', fontWeight: '500', cursor: 'pointer' }}>System Design</button>
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {timeLeft !== null && (
                <div style={{ fontWeight: '600', color: timeLeft < 60 ? '#ef4444' : '#111827', background: '#f3f4f6', padding: '6px 12px', borderRadius: '8px' }}>
                  {formatTime(timeLeft)}
                </div>
              )}
              <button onClick={() => setShowConversation(!showConversation)} style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', color: '#374151', fontWeight: '500', cursor: 'pointer' }}>
                {showConversation ? 'Hide Conversation' : 'Show Conversation'}
              </button>
              <button onClick={handleEndInterview} style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
                End Interview
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            
            {/* Phase: Interview (Google Meet Style) */}
            {activeTab === 'interview' && (
              <div style={{ flex: 1, display: 'flex', gap: '24px', padding: '24px', alignItems: 'center', justifyContent: 'center' }}>
                 {/* Agent Panel (Left) */}
                 <div style={{ flex: 1, height: '100%', maxWidth: '50%', background: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                   <p style={{ position: 'absolute', top: '16px', left: '24px', color: '#111827', margin: 0, fontWeight: '500', fontSize: '15px' }}>Xona (AI Interviewer)</p>
                   <video ref={videoRef} loop muted playsInline src="https://cdn.dribbble.com/userupload/15697531/file/original-0242acdc69146d4472fc5e69b48616dc.mp4" style={{ width: '320px', height: '320px', objectFit: 'cover', borderRadius: '50%', opacity: isSpeaking ? 1 : 0.6, transition: 'all 0.3s' }} />
                 </div>

                 {/* User Panel (Right) */}
                 <div style={{ flex: 1, height: '100%', maxWidth: '50%', background: '#ffffff', borderRadius: '16px', border: isUserSpeaking ? '3px solid #0284c7' : '1px solid #e5e7eb', transition: 'border-color 0.3s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: isUserSpeaking ? '0 0 0 4px rgba(2, 132, 199, 0.1)' : 'none' }}>
                   <p style={{ position: 'absolute', top: '16px', left: '24px', color: '#111827', margin: 0, fontWeight: '500', fontSize: '15px' }}>{candidateName || 'You'}</p>
                   
                   <div style={{ width: '160px', height: '160px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                     {isUserSpeaking && <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #0284c7', animation: 'pulse 2s infinite' }}></div>}
                     <img src={`https://api.dicebear.com/9.x/initials/svg?seed=${candidateName || 'User'}&backgroundColor=e5e7eb&textColor=111827`} alt="User Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                   </div>
                 </div>
              </div>
            )}

            {/* Phase: Coding */}
            {activeTab === 'coding' && (
              <div style={{ flex: 1, display: 'flex', height: '100%' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', background: '#fff' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>Code Editor</h3>
                    <button onClick={() => {
                       handleUserMessage(`[CODE_SUBMITTED]:\n${submittedCode}`)
                    }} style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Submit Code</button>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#4b5563', fontSize: '12px', fontFamily: 'monospace' }}>Code Editor</span>
                      </div>
                      <textarea
                        value={submittedCode}
                        onChange={(e) => setSubmittedCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const start = e.target.selectionStart;
                            const end = e.target.selectionEnd;
                            const newVal = submittedCode.substring(0, start) + '    ' + submittedCode.substring(end);
                            setSubmittedCode(newVal);
                            setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 4; }, 0);
                          }
                        }}
                        spellCheck={false}
                        placeholder="// Write your code here..."
                        style={{
                          flex: 1,
                          padding: '16px',
                          background: '#ffffff',
                          color: '#111827',
                          border: 'none',
                          outline: 'none',
                          fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          resize: 'none',
                          minHeight: '400px',
                          width: '100%',
                          boxSizing: 'border-box',
                          caretColor: '#cdd6f4',
                          borderRadius: '0 0 8px 8px'
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div style={{ width: '360px', background: '#f8fafc', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' }}>
                   {/* Animated Voice Orb Section */}
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0', width: '100%', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                     <button type="button" onClick={() => {}} style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <video ref={videoRef} loop muted playsInline src="https://cdn.dribbble.com/userupload/15697531/file/original-0242acdc69146d4472fc5e69b48616dc.mp4" style={{ width: '150%', height: '150%', objectFit: 'cover', borderRadius: '50%', maskImage: 'radial-gradient(circle, white 38%, transparent 40%)', WebkitMaskImage: '-webkit-radial-gradient(circle, white 38%, transparent 40%)', zIndex: 2, position: 'relative', opacity: isSpeaking ? 1 : 0.7, transition: 'all 0.3s' }} />
                     </button>
                     {isRecording && <div style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isUserSpeaking ? '#3b82f6' : '#94a3b8', animation: isUserSpeaking ? 'pulse 2s infinite' : 'none' }} /> {isUserSpeaking ? 'Hearing you...' : 'Listening...'}</div>}
                   </div>
                   {/* Transcript Chat Area */}
                   <div ref={codingTranscriptRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     {transcript.filter(msg => {
                       if (activeTab === 'interview') return !msg.phase || msg.phase === 'interview';
                       if (activeTab === 'coding') return !msg.phase || msg.phase === 'interview' || msg.phase === 'coding';
                       return true;
                     }).map((msg, i) => (
                       <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                         <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {msg.role === 'agent' ? 'Xona' : (<span>You <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>)}
                         </div>
                         <div style={{ padding: '12px 16px', borderRadius: msg.role === 'agent' ? '2px 16px 16px 16px' : '16px 2px 16px 16px', background: msg.role === 'agent' ? '#ffffff' : '#3b82f6', color: msg.role === 'agent' ? '#334155' : '#ffffff', border: msg.role === 'agent' ? '1px solid #e2e8f0' : 'none', fontSize: '14px', lineHeight: '1.5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', maxWidth: '90%' }}>
                            {msg.text.includes('[CODE_SUBMITTED]') ? <i>Code Submitted</i> : msg.text}
                         </div>
                       </div>
                     ))}
                     {(inputText || partialText) ? (
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '100%' }}>
                         <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span>You <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                         </div>
                         <div style={{ padding: '12px 16px', borderRadius: '16px 2px 16px 16px', background: '#3b82f6', color: '#ffffff', border: 'none', fontSize: '14px', lineHeight: '1.5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', maxWidth: '90%' }}>
                            {inputText} {partialText}
                         </div>
                       </div>
                     ) : null}
                   </div>
                </div>
              </div>
            )}

            {/* Phase: System Design */}
            {activeTab === 'system_design' && (
              <div style={{ flex: 1, display: 'flex', height: '100%' }}>
                <div style={{ flex: 1, background: '#fff', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#111827' }}>System Design Board</h3>
                    <button onClick={handleEndInterview} style={{ padding: '8px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Submit Design</button>
                  </div>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <CanvasArea
                      onCanvasUpdate={handleCanvasUpdate}
                      onThemeChange={(t) => setTheme(t)}
                    />
                  </div>
                </div>
                
                <div style={{ width: '360px', background: '#f8fafc', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0' }}>
                   {/* Animated Voice Orb Section */}
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0', width: '100%', borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                     <button type="button" onClick={() => {}} style={{ position: 'relative', width: '180px', height: '180px', borderRadius: '50%', border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                       <video ref={videoRef} loop muted playsInline src="https://cdn.dribbble.com/userupload/15697531/file/original-0242acdc69146d4472fc5e69b48616dc.mp4" style={{ width: '150%', height: '150%', objectFit: 'cover', borderRadius: '50%', maskImage: 'radial-gradient(circle, white 38%, transparent 40%)', WebkitMaskImage: '-webkit-radial-gradient(circle, white 38%, transparent 40%)', zIndex: 2, position: 'relative', opacity: isSpeaking ? 1 : 0.7, transition: 'all 0.3s' }} />
                     </button>
                     {isRecording && <div style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isUserSpeaking ? '#3b82f6' : '#94a3b8', animation: isUserSpeaking ? 'pulse 2s infinite' : 'none' }} /> {isUserSpeaking ? 'Hearing you...' : 'Listening...'}</div>}
                   </div>
                   {/* Transcript Chat Area */}
                   <div ref={systemDesignTranscriptRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     {transcript.filter(msg => {
                       if (activeTab === 'interview') return !msg.phase || msg.phase === 'interview';
                       if (activeTab === 'coding') return !msg.phase || msg.phase === 'interview' || msg.phase === 'coding';
                       return true;
                     }).map((msg, i) => (
                       <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                         <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {msg.role === 'agent' ? 'Xona' : (<span>You <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>)}
                         </div>
                         <div style={{ padding: '12px 16px', borderRadius: msg.role === 'agent' ? '2px 16px 16px 16px' : '16px 2px 16px 16px', background: msg.role === 'agent' ? '#ffffff' : '#3b82f6', color: msg.role === 'agent' ? '#334155' : '#ffffff', border: msg.role === 'agent' ? '1px solid #e2e8f0' : 'none', fontSize: '14px', lineHeight: '1.5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', maxWidth: '90%' }}>
                            {msg.text.includes('[CODE_SUBMITTED]') ? <i>Code Submitted</i> : msg.text}
                         </div>
                       </div>
                     ))}
                     {(inputText || partialText) ? (
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '100%' }}>
                         <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <span>You <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>
                         </div>
                         <div style={{ padding: '12px 16px', borderRadius: '16px 2px 16px 16px', background: '#3b82f6', color: '#ffffff', border: 'none', fontSize: '14px', lineHeight: '1.5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', maxWidth: '90%' }}>
                            {inputText} {partialText}
                         </div>
                       </div>
                     ) : null}
                   </div>
                </div>
              </div>
            )}

            {/* Transcript Sidebar Overlay (Right side absolute) */}
            {showConversation && (
              <div style={{ width: '360px', background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.05)', zIndex: 20 }}>
                 <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <h3 style={{ margin: 0, fontSize: '15px' }}>Conversation</h3>
                   <button onClick={() => setShowConversation(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>&times;</button>
                 </div>
                 <div ref={showConversationTranscriptRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                   {transcript.filter(msg => {
                       if (activeTab === 'interview') return !msg.phase || msg.phase === 'interview';
                       if (activeTab === 'coding') return !msg.phase || msg.phase === 'interview' || msg.phase === 'coding';
                       return true; // system_design: show everything
                     }).map((msg, i) => (
                     <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                       <span style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{msg.role === 'user' ? 'You' : 'Xona'}</span>
                       <div style={{ background: msg.role === 'user' ? '#0284c7' : '#f3f4f6', color: msg.role === 'user' ? '#fff' : '#111827', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', maxWidth: '85%' }}>
                         {msg.text.includes('[CODE_SUBMITTED]') ? <i>Code Submitted</i> : msg.text}
                       </div>
                     </div>
                   ))}
                   {(inputText || partialText) ? (
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                       <span style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>You (speaking...)</span>
                       <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '10px 14px', borderRadius: '12px', fontSize: '14px', maxWidth: '85%' }}>
                         {inputText} {partialText}
                       </div>
                     </div>
                   ) : null}
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

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
