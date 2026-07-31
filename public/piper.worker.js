import * as tts from 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/+esm';

let isReady = false;
let currentVoice = null;

const generationQueue = [];
let isGenerating = false;

async function processQueue() {
  if (isGenerating || generationQueue.length === 0) return;
  isGenerating = true;
  
  const req = generationQueue.shift();
  try {
    const wavBlob = await tts.predict({
      text: req.text,
      voiceId: req.voice_id || 'en_US-lessac-medium',
    });
    
    const arrayBuffer = await wavBlob.arrayBuffer();
    
    self.postMessage({
      type: 'AUDIO_CHUNK',
      audioData: arrayBuffer,
      textId: req.textId,
      text: req.text
    }, [arrayBuffer]);
  } catch (err) {
    console.error('Error generating Piper audio', err);
    self.postMessage({ type: 'ERROR', error: err.message || String(err) });
  }
  
  isGenerating = false;
  processQueue();
}

self.addEventListener('message', async (e) => {
  const { type, text, voice_id } = e.data;

  if (type === 'INIT') {
    try {
      if (currentVoice !== voice_id) {
        self.postMessage({ type: 'STATUS', message: `Downloading Piper model: ${voice_id}...` });
        
        await tts.download(voice_id, (progress) => {
          const percent = Math.round(progress.loaded * 100 / progress.total);
          self.postMessage({ type: 'STATUS', message: `Downloading ${voice_id}: ${percent}%` });
        });
        
        currentVoice = voice_id;
      }
      
      isReady = true;
      self.postMessage({ type: 'READY' });
    } catch (err) {
      console.error('Failed to init Piper TTS', err);
      self.postMessage({ type: 'ERROR', error: err.message || String(err) });
    }
  } else if (type === 'GENERATE') {
    if (!isReady) {
      self.postMessage({ type: 'ERROR', error: 'Piper TTS not initialized yet' });
      return;
    }
    
    generationQueue.push(e.data);
    processQueue();
  }
});
