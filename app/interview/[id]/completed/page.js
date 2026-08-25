'use client'
import Link from 'next/link'

export default function CompletedPage() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', fontFamily: 'inherit' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#dcfce7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#111827', margin: '0 0 16px 0' }}>Interview Completed!</h1>
      <p style={{ color: '#4b5563', fontSize: '15px', maxWidth: '400px', textAlign: 'center', margin: '0 0 32px 0' }}>
        Thank you for your time. Your responses have been saved successfully. You may now close this tab.
      </p>
      <Link href="/" style={{ padding: '10px 24px', backgroundColor: '#0284c7', color: '#fff', textDecoration: 'none', borderRadius: '8px', fontWeight: '500' }}>
        Return Home
      </Link>
    </div>
  )
}
