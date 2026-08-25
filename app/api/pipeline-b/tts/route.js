export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text || text.trim().length === 0) {
      return Response.json({ error: "No text provided" }, { status: 400 });
    }

    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": process.env.CARTESIA_API_KEY,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: process.env.PIPELINE_B_TTS_MODEL || "sonic-3",
        transcript: text,
        voice: {
          mode: "id",
          id: process.env.PIPELINE_B_TTS_VOICE || "6ccbfb76-1fc6-48f7-b71d-91ac6298247b",
        },
        output_format: {
          container: "mp3",
          encoding: "mp3",
          sample_rate: 44100,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[pipeline-b/tts] Cartesia error:", errText);
      return Response.json({ error: errText }, { status: 500 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    console.error("[pipeline-b/tts] error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

