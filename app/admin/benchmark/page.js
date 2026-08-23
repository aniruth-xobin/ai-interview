'use client';

import { useState } from 'react';
import LiveKitPipeline from '@/components/LiveKitPipeline';
import CustomPipeline from '@/components/CustomPipeline';

export default function BenchmarkPage() {
  const [started, setStarted] = useState(false);
  const [liveKitToken, setLiveKitToken] = useState('');
  
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  const handleStart = async () => {
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: 'benchmark-room-1',
          participantName: 'BenchmarkTester',
          metadata: { mode: 'job_fit', session_id: 'benchmark-1' } // Triggers the xobin-agent backend fetch
        })
      });
      const data = await res.json();
      if (data.token) {
        setLiveKitToken(data.token);
      } else {
        alert('Failed to get token. Did you add the API keys to .env?');
      }
      setStarted(true);
    } catch (e) {
      console.error(e);
      alert('Error starting benchmark');
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '40px', color: '#0f172a' }}>Simultaneous Latency Benchmark</h1>
      
      {!started ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '24px', color: '#64748b' }}>
            Click below to establish simultaneous connections to both pipelines and begin the A/B latency test.
          </p>
          <button 
            onClick={handleStart}
            style={{ padding: '12px 24px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', cursor: 'pointer' }}
          >
            Start Benchmark
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
          
          {/* Pipeline A */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', background: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#0284c7', marginTop: 0, textAlign: 'center' }}>Pipeline A (LiveKit)</h2>
            <div style={{ height: '300px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <LiveKitPipeline token={liveKitToken} serverUrl={serverUrl} />
            </div>
          </div>

          {/* Pipeline B */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', background: '#f8fafc', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#b45309', marginTop: 0, textAlign: 'center' }}>Pipeline B (Custom)</h2>
            <div style={{ height: '300px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <CustomPipeline />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
