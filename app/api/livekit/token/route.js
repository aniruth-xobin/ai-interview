import { AccessToken, AgentDispatchClient, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { roomName, participantName, metadata } = await request.json();

    if (!roomName || !participantName) {
      return NextResponse.json({ error: 'roomName and participantName are required' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;
    const agentName = process.env.LIVEKIT_AGENT_NAME || 'xobin-agent';

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json({ error: 'LiveKit credentials are not configured in .env' }, { status: 500 });
    }

    // Step 1: Create the room first (so the agent can be dispatched into it)
    const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
    try {
      await roomService.createRoom({ name: roomName });
      console.log('Room created:', roomName);
    } catch (e) {
      console.log('Room may already exist:', e.message);
    }

    // Step 2: Dispatch the agent into the room
    const agentDispatch = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
    try {
      await agentDispatch.createDispatch(roomName, agentName, { metadata: metadata ? JSON.stringify(metadata) : '' });
      console.log('Agent dispatched:', agentName);
    } catch (e) {
      console.error('Agent dispatch failed:', e.message);
    }

    // Step 3: Generate participant token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
      metadata: metadata ? JSON.stringify(metadata) : '',
    });

    at.addGrant({ 
      roomJoin: true, 
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
  }
}
