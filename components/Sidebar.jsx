'use client'

import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import InteractiveOrb from './InteractiveOrb'
import styles from './Sidebar.module.css'

export default function Sidebar({ transcript, isSpeaking, onUserMessage, onEndInterview }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript])

  return (
    <div className={styles.sidebar}>
      
      <InteractiveOrb onUserMessage={onUserMessage} />
      
      <div className={styles.transcriptArea} ref={scrollRef}>
        {transcript.map((msg, idx) => (
          <div key={idx} className={`${styles.messageWrapper} ${msg.role === 'agent' ? styles.wrapperAgent : styles.wrapperUser}`}>
            <div className={styles.messageLabel}>
              {msg.role === 'agent' ? (
                <>
                  Xona
                </>
              ) : (
                <>
                  You
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </>
              )}
            </div>
            <div className={`${styles.message} ${styles[msg.role]}`}>
              {msg.text === '...' ? (
                <div className={styles.typingIndicator}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              ) : (
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className={styles.sidebarFooter}>
        <button className={styles.endInterviewButton} onClick={onEndInterview}>
          End Interview
        </button>
      </div>
      
    </div>
  )
}
