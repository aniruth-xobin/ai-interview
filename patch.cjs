const fs = require('fs');
const file = 'node_modules/@diffusionstudio/vits-web/dist/vits-web.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Swap base URL
const badUrl = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main";
const goodUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/main";
if (content.includes(badUrl)) {
  content = content.replace(badUrl, goodUrl);
}

// 2. Inject Indian female languages into the dictionary
const dictStart = "c = {";
const injectedDict = "c = { 'hi_IN-priyamvada-medium': 'hi/hi_IN/priyamvada/medium/hi_IN-priyamvada-medium.onnx', 'ml_IN-meera-medium': 'ml/ml_IN/meera/medium/ml_IN-meera-medium.onnx', 'te_IN-padmavathi-medium': 'te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx',";
if (content.includes(dictStart) && !content.includes('hi_IN-priyamvada-medium')) {
  content = content.replace(dictStart, injectedDict);
}
const badMapString = "Object.keys(i.speaker_id_map).length";
const goodMapString = "(i.speaker_id_map ? Object.keys(i.speaker_id_map).length : 0)";
if (content.includes(badMapString)) {
  content = content.replace(badMapString, goodMapString);
} else {
  console.log("Speaker ID map already patched or not found.");
}

fs.writeFileSync(file, content);
console.log("Patched vits-web successfully!");

// Strip require("fs") and require("path") from the emscripten module so Next.js doesn't crash
const emscriptenFile = 'node_modules/@diffusionstudio/vits-web/dist/piper-DeOu3H9E.js';
if (fs.existsSync(emscriptenFile)) {
  let emsContent = fs.readFileSync(emscriptenFile, 'utf8');
  emsContent = emsContent.replace(/require\("fs"\)/g, '({ readFile: function(a,b){ b(new Error("No fs")); } })');
  emsContent = emsContent.replace(/require\("path"\)/g, '({ dirname: function(){ return ""; }, join: function(){ return ""; } })');
  fs.writeFileSync(emscriptenFile, emsContent);
  console.log("Patched piper emscripten file successfully!");
}
