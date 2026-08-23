'use client';

import { useState, useEffect } from 'react';

export default function CustomPipeline() {
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    // We will build the WebSocket/Deepgram logic here
    setTimeout(() => setStatus('Connected (Custom)'), 1000);
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#334155' }}>
        <strong>Custom Status:</strong> {status}
      </div>
    </div>
  );
}
