'use client';

import { LiveKitRoom, RoomAudioRenderer, StartAudio, useConnectionState } from '@livekit/components-react';
import '@livekit/components-styles';

export default function LiveKitPipeline({ token, serverUrl }) {
  if (!token || !serverUrl) {
    return <div>Waiting for LiveKit connection details...</div>;
  }

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <ConnectionStatus />
      <RoomAudioRenderer />
      <StartAudio label="Click to allow audio playback" />
    </LiveKitRoom>
  );
}

function ConnectionStatus() {
  const state = useConnectionState();
  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#334155' }}>
      <strong>LiveKit Status:</strong> {state}
    </div>
  );
}
