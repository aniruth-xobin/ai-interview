import * as tts from '/vits-web/vits-web.js?v=2';

console.log('Worker thread: Script evaluated successfully');

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
  console.log('Worker thread: Received message', type);

  if (type === 'INIT') {
    try {
      console.log('Worker thread: Processing INIT...');
      if (currentVoice !== voice_id) {
        console.log('Worker thread: Downloading model', voice_id);
        self.postMessage({ type: 'STATUS', message: `Downloading Piper model: ${voice_id}...` });
        
        await tts.download(voice_id, (progress) => {
          const percent = Math.round(progress.loaded * 100 / progress.total);
          self.postMessage({ type: 'STATUS', message: `Downloading ${voice_id}: ${percent}%` });
        });
        
        self.postMessage({ type: 'STATUS', message: `Compiling AI Engine (may take 1-2s)...` });
        console.log('Worker thread: Running dummy inference for compilation...');
        // WARM-UP INFERENCE: Run a dummy punctuation mark to force ONNX to compile the graph NOW and save it to the cache
        await tts.predict({ text: '.', voiceId: voice_id || 'en_US-lessac-medium' });

        currentVoice = voice_id;
        console.log('Worker thread: Compilation finished');
      }
      
      isReady = true;
      self.postMessage({ type: 'READY' });
      console.log('Worker thread: READY sent');
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
  } else if (type === 'FLUSH_CACHE') {
    if (tts.flush) {
      tts.flush().catch(console.error);
    } else {
      navigator.storage.getDirectory().then(dir => dir.getDirectoryHandle('piper').then(p => p.remove({recursive: true}))).catch(console.error);
    }
  }
});
