import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId, sessionType, telemetryDump, transcript, turnMetricsTimeline, toolCallTimeline } = body;

    console.log('[Audit] Received sessionId:', sessionId, '| transcript length:', transcript?.length, '| turns:', turnMetricsTimeline?.length, '| tool calls:', toolCallTimeline?.length);

    if (!sessionId || !transcript) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Build a rich context string for Groq that includes ALL server-side data
    const turnMetricsSummary = (turnMetricsTimeline || []).map(t => {
      const flags = [];
      if (t.llm_ttft_ms > 2000) flags.push('LLM_SPIKE');
      if (t.stt_ms > 600) flags.push('STT_SPIKE');
      if (t.tts_ttfb_ms > 500) flags.push('TTS_SPIKE');
      return `Turn ${t.turn_index}: STT=${t.stt_ms ?? 'N/A'}ms, LLM_TTFT=${t.llm_ttft_ms ?? 'N/A'}ms, TTS=${t.tts_ttfb_ms ?? 'N/A'}ms, Tokens=${(t.prompt_tokens ?? 0) + (t.completion_tokens ?? 0)}${flags.length ? ' [FLAGS: ' + flags.join(', ') + ']' : ''}`;
    }).join('\n');

    // Build a unified transcript with inline tool calls
    let unifiedTranscript = '';
    let currentTurn = 1;
    let turnMsgs = [];
    
    (transcript || []).forEach(msg => {
      if (msg.role === 'user') {
        if (turnMsgs.length > 0) {
          unifiedTranscript += `Turn ${currentTurn}:\n` + turnMsgs.join('\n') + '\n';
          const toolsThisTurn = (toolCallTimeline || []).filter(tc => tc.turn_index === currentTurn);
          toolsThisTurn.forEach(tc => {
            unifiedTranscript += `[SYSTEM: Agent called tool '${tc.tool_name}']\n`;
          });
          unifiedTranscript += '\n';
          currentTurn++;
          turnMsgs = [];
        }
      }
      turnMsgs.push(`${msg.role === 'user' ? 'Candidate' : 'Agent'}: ${msg.text}`);
    });
    
    if (turnMsgs.length > 0) {
      unifiedTranscript += `Turn ${currentTurn}:\n` + turnMsgs.join('\n') + '\n';
      const toolsThisTurn = (toolCallTimeline || []).filter(tc => tc.turn_index === currentTurn);
      toolsThisTurn.forEach(tc => {
        unifiedTranscript += `[SYSTEM: Agent called tool '${tc.tool_name}']\n`;
      });
    }

    const toolCallSummary = (toolCallTimeline || []).map(tc =>
      `Turn ${tc.turn_index}: ${tc.tool_name}(${JSON.stringify(tc.arguments).slice(0, 100)}) => ${tc.result?.slice(0, 100) ?? 'void'}`
    ).join('\n');

    const hm = telemetryDump || {};

    const systemPrompt = `You are an expert AI Audit Agent evaluating a voice-based software engineering interview session.
You have access to the FULL server-side telemetry from this session including:
- The conversation transcript
- Turn-by-turn latency metrics (STT, LLM Time-To-First-Token, TTS latency)  
- All tool calls made by the agent

Use ALL of this data to produce a comprehensive audit evaluation. Specifically:
1. Identify any turns where latency spiked (LLM > 2000ms, STT > 600ms, TTS > 500ms) and explain what might have caused it.
2. Verify that all tool calls were appropriate and correctly triggered at the right moment in the interview.
3. Evaluate conversation quality, hallucinations, and whether the agent followed its system prompt.

Return ONLY a valid JSON object with the following structure:
{
  "context_accuracy_score": <number 1-10>,
  "context_accuracy_notes": "<brief explanation>",
  "conversation_flow_score": <number 1-10>,
  "conversation_flow_notes": "<brief explanation>",
  "hallucination_rate": <number 1-10, where 10 is NO hallucinations/perfect>,
  "hallucination_notes": "<brief explanation>",
  "transcription_accuracy_score": <number 1-10>,
  "transcription_accuracy_notes": "<brief explanation>",
  "response_relevance_score": <number 1-10>,
  "response_relevance_notes": "<brief explanation>",
  "latency_analysis": "<2-3 sentences specifically analyzing the turn-by-turn latency data. Call out any spike turns by number and explain impact on candidate experience>",
  "tool_call_analysis": "<2-3 sentences evaluating whether all tool calls were correct, timely, and appropriate>",
  "overall_score": <number 0-10, one decimal place>,
  "overall_insight": "<4-5 sentence holistic summary covering: where the interview went well, specific latency spike turns, tool call correctness, transcription quality, hallucination presence, and one key improvement recommendation>"
}`;

    const userContent = JSON.stringify({
      transcript,
      turnMetrics: turnMetricsSummary || 'No turn metrics available (client-side session)',
      toolCalls: toolCallSummary || 'No tool calls recorded',
      averageHardMetrics: {
        avg_stt_latency_ms: hm.stt_latency,
        avg_llm_ttft_ms: hm.server_llm_ttft,
        avg_tts_latency_ms: hm.tts_latency,
        barge_ins: hm.bargeIns,
        duration_seconds: hm.durationSeconds,
      }
    });

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
              { role: 'user', content: userContent }
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

    const safeHardMetrics = hm;
    if (safeHardMetrics.stt_latency === undefined) safeHardMetrics.stt_latency = null;
    if (safeHardMetrics.tts_latency === undefined) safeHardMetrics.tts_latency = null;
    if (safeHardMetrics.server_llm_ttft === undefined) safeHardMetrics.server_llm_ttft = null;
    if (safeHardMetrics.bargeIns === undefined) safeHardMetrics.bargeIns = 0;
    if (safeHardMetrics.durationSeconds === undefined) safeHardMetrics.durationSeconds = 0;

    // Manually handle UPSERT/MERGE
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
          transcript: transcript,
          turn_metrics_timeline: turnMetricsTimeline || [],
          tool_call_timeline: toolCallTimeline || [],
        })
        .eq('id', existing.id);
      dbError = error;
    } else {
      const { error } = await supabase.from('AuditScorecards').insert([{
        session_id: sessionId,
        session_type: sessionType || 'guided',
        hard_metrics: safeHardMetrics,
        soft_metrics: softMetrics,
        transcript: transcript,
        turn_metrics_timeline: turnMetricsTimeline || [],
        tool_call_timeline: toolCallTimeline || [],
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

