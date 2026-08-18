const fs = require('fs');
const file = 'node_modules/@diffusionstudio/vits-web/dist/vits-web.js';

if (!fs.existsSync(file)) {
  console.log('vits-web.js not found!');
  process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// Cache InferenceSession to dramatically speed up sequential TTS generation
const createSessionStr = "y = await _.InferenceSession.create(await k.arrayBuffer())";
const cachedSessionStr = "y = (globalThis._onnxSessionCache = globalThis._onnxSessionCache || {}, globalThis._onnxSessionCache[n] = globalThis._onnxSessionCache[n] || await _.InferenceSession.create(await k.arrayBuffer()))";

if (content.includes(createSessionStr)) {
  content = content.replace(createSessionStr, cachedSessionStr);
  fs.writeFileSync(file, content);
  console.log('InferenceSession caching patched successfully!');
} else {
  console.log('Patch skipped: InferenceSession string not found. (Already patched?)');
}

// Replace module specifier with local URL to allow native browser ESM loading
if (content.includes('import("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.es6.min.js")')) {
  // Replace the dynamic import
  content = content.replace('import("https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.es6.min.js")', 'import("/onnxruntime-web/esm/ort.min.js")');
  fs.writeFileSync(file, content);
  console.log('Bare module specifier patched to local URL successfully!');
} else if (content.includes('import("onnxruntime-web")')) {
  content = content.replace('import("onnxruntime-web")', 'import("/onnxruntime-web/esm/ort.min.js")');
  fs.writeFileSync(file, content);
  console.log('Bare module specifier patched to local URL successfully!');
}

// Replace the WASM CDN path with the local path to prevent COEP blocking
const wasmCdnStr = 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/';
if (content.includes(wasmCdnStr)) {
  content = content.replace(wasmCdnStr, '/onnxruntime-web/');
  fs.writeFileSync(file, content);
  console.log('WASM CDN path patched to local URL successfully!');
}

// Also replace the bare import in piper-DeOu3H9E.js if it exists
const piperFile = 'node_modules/@diffusionstudio/vits-web/dist/piper-DeOu3H9E.js';
if (fs.existsSync(piperFile)) {
  let pContent = fs.readFileSync(piperFile, 'utf8');
  if (pContent.includes('require("fs")') || pContent.includes('String.fromCharCode')) {
    pContent = pContent.replace(/require\("fs"\)/g, 'require(String.fromCharCode(102, 115))');
    pContent = pContent.replace(/require\("path"\)/g, 'require(String.fromCharCode(112, 97, 116, 104))');
    
    // In case the import is compiled differently in this file
    if (pContent.includes('import("onnxruntime-web")')) {
      pContent = pContent.replace('import("onnxruntime-web")', 'import("/onnxruntime-web/esm/ort.min.js")');
    }
    
    fs.writeFileSync(piperFile, pContent);
    console.log('Patched piper-DeOu3H9E.js to bypass Next.js Turbopack analysis with String.fromCharCode.');
  }
}

// Copy patched vits-web to public/ so it can be served statically without Turbopack interference
const path = require('path');
const publicVitsWebPath = path.join(__dirname, 'public', 'vits-web');
if (!fs.existsSync(publicVitsWebPath)) {
  fs.mkdirSync(publicVitsWebPath, { recursive: true });
}

// Copy onnxruntime-web to public/ as well
const publicOnnxWebPath = path.join(__dirname, 'public', 'onnxruntime-web');
if (!fs.existsSync(publicOnnxWebPath)) {
  fs.mkdirSync(publicOnnxWebPath, { recursive: true });
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath);
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirSync(path.join(__dirname, 'node_modules', '@diffusionstudio', 'vits-web', 'dist'), publicVitsWebPath);
console.log('Copied patched vits-web to public/vits-web for static serving.');

copyDirSync(path.join(__dirname, 'node_modules', 'onnxruntime-web', 'dist'), publicOnnxWebPath);
console.log('Copied onnxruntime-web to public/onnxruntime-web for static serving.');
