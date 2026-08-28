import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, sessionType, telemetryDump, transcript } = body;

    console.log('[Audit] Received sessionId:', sessionId, '| transcript length:', transcript?.length);

    if (!sessionId || !transcript) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const systemPrompt = `You are an expert AI Audit Agent evaluating a voice-based session.
You will be provided with the transcript of the conversation between an 'agent' (AI) and a 'user' (human).
Your goal is to evaluate the Soft Quality Metrics of this conversation.

Analyze the transcript and return ONLY a valid JSON object with the following structure:
{
  "context_accuracy_score": <number 1-10>,
  "context_accuracy_notes": "<brief explanation>",
  "conversation_flow_score": <number 1-10>,
  "conversation_flow_notes": "<brief explanation>",
  "hallucination_rate": <number 1-10, where 10 is NO hallucinations/perfect>,
  "hallucination_notes": "<brief explanation>",
  "transcription_accuracy_score": <number 1-10, where 10 means the user transcript has logical sentences>,
  "transcription_accuracy_notes": "<brief explanation>",
  "response_relevance_score": <number 1-10, where 10 means AI responses perfectly address user statements>,
  "response_relevance_notes": "<brief explanation>",
  "overall_score": <number 0-10, one decimal place, average of all above scores weighted by importance>,
  "overall_insight": "<3-4 sentence holistic summary covering: where the interview went well, latency quality assessment (STT/LLM/TTS), transcription quality, whether the agent correctly followed its system prompt, hallucination presence, and one key improvement recommendation>"
}`;

    const groqKeys = [
      process.env.GROQ_API_KEY_1, process.env.GROQ_API_KEY_2, process.env.GROQ_API_KEY_3,
      process.env.GROQ_API_KEY_4, process.env.GROQ_API_KEY_5, process.env.GROQ_API_KEY_6,
      process.env.GROQ_API_KEY
    ].filter(Boolean);

    if (groqKeys.length === 0) {
      return NextResponse.json({ error: 'No Groq API keys configured' }, { status: 500 });
    }

    let groqData = null;
    let usedKeyIndex = -1;

    for (let i = 0; i < groqKeys.length; i++) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKeys[i]}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(transcript) }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });
        if (res.ok) {
          groqData = await res.json();
          usedKeyIndex = i;
          break;
        } else {
          const errText = await res.text();
          console.warn(`[Audit] Groq key ${i} failed: ${res.status} ${errText}`);
        }
      } catch (err) {
        console.warn(`[Audit] Groq key ${i} threw:`, err.message);
      }
    }

    if (!groqData) {
      return NextResponse.json({ error: 'All Groq API keys failed' }, { status: 500 });
    }

    let softMetrics = {};
    try {
      softMetrics = JSON.parse(groqData.choices[0].message.content);
    } catch (e) {
      softMetrics = { error: 'Failed to parse json output' };
    }

    const safeHardMetrics = telemetryDump || {};
    if (safeHardMetrics.stt_latency === undefined) safeHardMetrics.stt_latency = null;
    if (safeHardMetrics.tts_latency === undefined) safeHardMetrics.tts_latency = null;
    if (safeHardMetrics.server_llm_ttft === undefined) safeHardMetrics.server_llm_ttft = null;
    if (safeHardMetrics.bargeIns === undefined) safeHardMetrics.bargeIns = 0;
    if (safeHardMetrics.durationSeconds === undefined) safeHardMetrics.durationSeconds = 0;

    // Manually handle UPSERT/MERGE because session_id lacks a unique constraint
    const { data: existing } = await supabase
      .from('AuditScorecards')
      .select('id, hard_metrics')
      .eq('session_id', sessionId)
      .limit(1)
      .single();

    let dbError = null;

    if (existing) {
      const mergedHardMetrics = { ...(existing.hard_metrics || {}), ...safeHardMetrics };
      mergedHardMetrics.bargeIns = Math.max(existing.hard_metrics?.bargeIns || 0, safeHardMetrics.bargeIns || 0);
      mergedHardMetrics.durationSeconds = Math.max(existing.hard_metrics?.durationSeconds || 0, safeHardMetrics.durationSeconds || 0);

      const { error } = await supabase
        .from('AuditScorecards')
        .update({
          session_type: sessionType || 'guided',
          hard_metrics: mergedHardMetrics,
          soft_metrics: softMetrics,
          transcript: transcript
        })
        .eq('id', existing.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('AuditScorecards').insert([{
        session_id: sessionId,
        session_type: sessionType || 'guided',
        hard_metrics: safeHardMetrics,
        soft_metrics: softMetrics,
        transcript: transcript
      }]);
      dbError = error;
    }

    if (dbError) {
      console.error('[Audit] DB insert error:', dbError);
      return NextResponse.json({ error: 'DB insert failed', detail: dbError.message }, { status: 500 });
    }

    console.log('[Audit] Successfully evaluated and saved for session:', sessionId);
    return NextResponse.json({ success: true, softMetrics, usedKeyIndex: usedKeyIndex + 1 });

  } catch (error) {
    console.error('[Audit] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 });
  }
}
