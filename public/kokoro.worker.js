// public/kokoro.worker.js
// This worker lives in public/ to bypass Vite's bundler entirely.
// kokoro-js's phonemizer (eSpeak-NG WASM) data gets corrupted by Vite's dep optimizer.

let tts = null;
let isReady = false;
const generationQueue = [];
let isGenerating = false;

async function loadKokoro() {
  // Import kokoro.web.js from CDN - it's a self-contained ESM bundle
  const module = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js');
  return module.KokoroTTS;
}

async function processQueue() {
  if (isGenerating || generationQueue.length === 0) return;
  isGenerating = true;

  const req = generationQueue.shift();
  console.log('[Kokoro Worker] processQueue: generating for text:', req.text?.substring(0, 50));
  try {
    const voice = req.voice_id || 'af_heart';
    const audio = await tts.generate(req.text, { voice });

    // IMPORTANT: Copy the audio data into a new Float32Array!
    // The WebGPU ONNX tensor's underlying ArrayBuffer can contain NaN values
    // if we try to transfer it directly, because the GPU readback may not
    // have completed or the buffer may be a view into a larger allocation.
    const rawPcm = audio.audio;
    const pcmCopy = new Float32Array(rawPcm.length);
    pcmCopy.set(rawPcm);
    
    const sampleRate = audio.sampling_rate || 24000;
    console.log('[Kokoro Worker] generate SUCCESS, audio length:', pcmCopy.length, 'maxAmp:', pcmCopy.reduce((m, v) => Math.max(m, Math.abs(v)), 0));

    self.postMessage({
      type: 'AUDIO_CHUNK',
      audioData: pcmCopy.buffer,
      isRawPCM: true,
      sampleRate: sampleRate,
      text: req.text,
      msgId: req.msgId
    }, [pcmCopy.buffer]);
  } catch (err) {
    console.error('[Kokoro Worker] Error generating Kokoro audio', err);
    self.postMessage({ type: 'ERROR', error: err.message || String(err) });
  }

  isGenerating = false;
  processQueue();
}

self.addEventListener('message', async (e) => {
  const { type, dtype } = e.data;

  if (type === 'INIT') {
    try {
      console.log('[Kokoro Worker] INIT received, loading from CDN...');
      self.postMessage({ type: 'STATUS', message: 'Loading Kokoro from CDN...' });
      
      const KokoroTTS = await loadKokoro();
      console.log('[Kokoro Worker] CDN module loaded successfully');
      
      self.postMessage({ type: 'STATUS', message: 'Downloading Kokoro WebGPU model...' });

      tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
        dtype: "fp32",
        device: "webgpu",
        power_preference: "high-performance",
        progress_callback: (progress) => {
          if (!progress) return;
          let percent = 0;
          if (typeof progress.progress === 'number') {
            percent = Math.round(progress.progress > 1 ? progress.progress : progress.progress * 100);
          } else if (progress.loaded && progress.total) {
            percent = Math.round((progress.loaded * 100) / progress.total);
          }
          const fileName = progress.file ? ` (${progress.file.split('/').pop()})` : '';
          self.postMessage({ type: 'STATUS', message: `Downloading Kokoro WebGPU... ${percent}%${fileName}` });
        }
      });

      isReady = true;
      console.log('[Kokoro Worker] READY! Model loaded successfully.');
      self.postMessage({ type: 'READY' });
    } catch (err) {
      console.error("Kokoro WebGPU INIT error:", err);
      self.postMessage({ type: 'ERROR', error: err.message || String(err) });
    }
  } else if (type === 'GENERATE') {
    if (!isReady) {
      self.postMessage({ type: 'ERROR', error: 'Kokoro TTS not initialized yet' });
      return;
    }

    console.log('[Kokoro Worker] GENERATE received:', e.data.text?.substring(0, 50));
    generationQueue.push(e.data);
    processQueue();
  }
});
