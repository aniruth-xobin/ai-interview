'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import styles from './Landing.module.css'

export default function LandingPage() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slides = ['/slide_new_1.png', '/slide_new_2.png', '/slide_new_3.png']

  const testimonials = [
    {
      quote: "The real-time feedback completely changed how I approach distributed systems. I landed an L5 offer at Google a week after practicing here.",
      author: "Sarah J.",
      role: "Senior Software Engineer"
    },
    {
      quote: "It actually feels like you're talking to a Staff Engineer. The follow-up questions caught edge cases I didn't even know existed.",
      author: "Michael T.",
      role: "Backend Developer"
    },
    {
      quote: "Drawing the architecture on the digital whiteboard while the AI evaluated my choices was the exact preparation I needed for my Meta onsite.",
      author: "David L.",
      role: "Systems Engineer"
    },
    {
      quote: "Worth every minute. It eliminated my interview anxiety because I knew exactly what level of detail the interviewers expected.",
      author: "Emily R.",
      role: "Technical Lead"
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  return (
    <div className={styles.container}>
      {/* Background Glow */}
      <div className={styles.backgroundGlow} />

      <div className={styles.contentWrapper}>
        {/* Navbar */}
        <nav className={styles.navbar}>
          <Link href="/" className={styles.logo}>
            <img src="https://xobin.com/wp-content/uploads/2026/04/logo-CQAmVy86.png" alt="Xobin Logo" className={styles.logoImg} />
          </Link>
          <div className={styles.navLinks}>
            <Link href="#" className={styles.navLink}>Home</Link>
            <Link href="#features" className={styles.navLink}>Features</Link>
            <Link href="#testimonials" className={styles.navLink}>Testimonials</Link>
          </div>
          <Link href="/interview" className={styles.signUpBtn}>
            Start Interview
            <span>→</span>
          </Link>
        </nav>

        {/* Hero Section */}
        <main className={styles.hero}>
          {/* Hero Left: Content */}
          <div className={styles.heroLeft}>
            <div className={styles.socialProof}>
              <div className={styles.stars}>
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              Rated 4.9/5 by 2700+ candidates
            </div>

            <h1 className={styles.headline}>
              Master your technical<br />interviews
            </h1>

            <p className={styles.subheadline}>
              Practice with an elite AI engineering manager. Write code, design architectures, get real-time feedback, and land your dream job at a top-tier tech company.
            </p>

            <div className={styles.ctaWrapper}>
              <Link href="/interview" className={styles.primaryCta}>
                Get Started Now
              </Link>
            </div>
          </div>

          {/* Hero Right: Orb Video */}
          <div className={styles.heroRight}>
            <video
              autoPlay
              loop
              muted
              playsInline
              className={styles.orbVideo}
              src="https://cdn.dribbble.com/userupload/15697531/file/original-0242acdc69146d4472fc5e69b48616dc.mp4"
            />
          </div>
        </main>

        {/* Features Section */}
        <section id="features" className={styles.featuresSection}>
          <div className={styles.featuresHeader}>
            <h2 className={styles.featuresTitle}>Experience the Interview</h2>
            <p className={styles.featuresSubtitle}>
              Simulate a real Staff-level engineering interview at top-tier companies.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <h3 className={styles.featureCardTitle}>Interactive Canvas</h3>
              <p className={styles.featureCardDesc}>
                Write code and draw system architectures naturally using our built-in tools.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <h3 className={styles.featureCardTitle}>Real-time Feedback</h3>
              <p className={styles.featureCardDesc}>
                Xona analyzes your components and connections as you build them, providing instant insights.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                  <line x1="12" y1="22.08" x2="12" y2="12"></line>
                </svg>
              </div>
              <h3 className={styles.featureCardTitle}>Deep Dives</h3>
              <p className={styles.featureCardDesc}>
                Prepare to be challenged on trade-offs, bottlenecks, scalability, and algorithms.
              </p>
            </div>
          </div>
        </section>

        {/* Professional CTA Section */}
        <section className={styles.ctaSection}>
          <div className={styles.ctaBox}>
            <div className={styles.ctaContent}>
              <h2 className={styles.ctaTitle}>Ready to Ace Your Next Interview?</h2>
              <p className={styles.ctaSubtitle}>
                Join thousands of engineers who have leveled up their technical interview skills with our AI-powered interactive platform.
              </p>
              <Link href="/interview" className={styles.ctaButton}>
                Start Practicing Now
              </Link>
            </div>
            {/* Background elements for the glassmorphism effect */}
            <div className={styles.ctaDecoration1}></div>
            <div className={styles.ctaDecoration2}></div>
          </div>
        </section>
      </div>
    </div>
  )
}
