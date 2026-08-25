import React, { useState, useEffect, useRef } from 'react';

export default function GmeetUI({
  candidateName,
  isSpeaking,
  isUserSpeaking,
  transcript,
  onEndInterview,
  agentName = "Xona"
}) {
  const [showConversation, setShowConversation] = useState(true);
  const scrollRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [transcript]);

  useEffect(() => {
    if (videoRef.current) {
      if (isSpeaking) {
        videoRef.current.play().catch(e => console.log('play error', e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isSpeaking]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      
      {/* Top Bar for Action Buttons */}
      <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <button 
          onClick={() => setShowConversation(!showConversation)} 
          style={{ padding: '8px 16px', background: '#f3f4f6', border: 'none', borderRadius: '8px', color: '#374151', fontWeight: '500', cursor: 'pointer' }}
        >
          {showConversation ? 'Hide Conversation' : 'Show Conversation'}
        </button>
        <button 
          onClick={onEndInterview} 
          style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}
        >
          End Interview
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Phase: Interview (Google Meet Style) */}
        <div style={{ flex: 1, display: 'flex', gap: '24px', padding: '24px', alignItems: 'center', justifyContent: 'center' }}>
           
           {/* Agent Panel (Left) */}
           <div style={{ flex: 1, height: '100%', maxWidth: '50%', background: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
             <p style={{ position: 'absolute', top: '16px', left: '24px', color: '#111827', margin: 0, fontWeight: '500', fontSize: '15px' }}>{agentName} (AI Interviewer)</p>
             <video ref={videoRef} loop muted playsInline src="https://cdn.dribbble.com/userupload/15697531/file/original-0242acdc69146d4472fc5e69b48616dc.mp4" style={{ width: '320px', height: '320px', objectFit: 'cover', borderRadius: '50%', opacity: isSpeaking ? 1 : 0.6, transition: 'all 0.3s' }} />
           </div>

           {/* User Panel (Right) */}
           <div style={{ flex: 1, height: '100%', maxWidth: '50%', background: '#ffffff', borderRadius: '16px', border: isUserSpeaking ? '3px solid #0284c7' : '1px solid #e5e7eb', transition: 'border-color 0.3s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: isUserSpeaking ? '0 0 0 4px rgba(2, 132, 199, 0.1)' : 'none' }}>
             <p style={{ position: 'absolute', top: '16px', left: '24px', color: '#111827', margin: 0, fontWeight: '500', fontSize: '15px' }}>{candidateName || 'You'}</p>
             <div style={{ width: '160px', height: '160px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
               {isUserSpeaking && <div style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #0284c7', animation: 'pulse 2s infinite' }}></div>}
               <img src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(candidateName || 'User')}&backgroundColor=e5e7eb&textColor=111827`} alt="User Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
             </div>
           </div>
        </div>

        {/* Transcript Sidebar Overlay (Right side absolute) */}
        {showConversation && (
          <div style={{ width: '360px', height: '100%', background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 16px rgba(0,0,0,0.05)', zIndex: 20, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                Interview Transcript
              </h3>
            </div>
            
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {transcript.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                     {msg.role === 'agent' ? agentName : (<span>You <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg></span>)}
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: msg.role === 'agent' ? '2px 16px 16px 16px' : '16px 2px 16px 16px', background: msg.role === 'agent' ? '#ffffff' : '#e0f2fe', color: msg.role === 'agent' ? '#111827' : '#0369a1', border: msg.role === 'agent' ? '1px solid #e2e8f0' : 'none', fontSize: '14px', lineHeight: '1.5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', maxWidth: '90%' }}>
                     {msg.text}
                  </div>
                </div>
              ))}
              {transcript.length === 0 && (
                <div style={{ textAlign: "center", color: "#94a3b8", marginTop: 20, fontSize: 13 }}>
                  Start speaking... transcripts will appear here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(2, 132, 199, 0); }
          100% { box-shadow: 0 0 0 0 rgba(2, 132, 199, 0); }
        }
      `}} />
    </div>
  );
}
