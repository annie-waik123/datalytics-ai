import { useState, useEffect } from 'react'

/**
 * DigitalClock - A 7-segment style digital clock with date display
 * Features:
 * - Real-time updating (every second)
 * - 7-segment font with neon glow effect
 * - Responsive (hides seconds on small screens)
 * - Stacked layout with date below time
 */
export default function DigitalClock() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isSmallScreen, setIsSmallScreen] = useState(false)

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Check screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768)
    }

    // Initial check
    checkScreenSize()

    // Listen for resize
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Format time
  const formatTime = () => {
    const hours = String(currentTime.getHours()).padStart(2, '0')
    const minutes = String(currentTime.getMinutes()).padStart(2, '0')
    const seconds = String(currentTime.getSeconds()).padStart(2, '0')

    if (isSmallScreen) {
      return `${hours}:${minutes}`
    }
    return `${hours}:${minutes}:${seconds}`
  }

  // Format date
  const formatDate = () => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }
    return currentTime.toLocaleDateString('en-US', options)
  }

  return (
    <>
      <style>
        {`@import url('https://fonts.cdnfonts.com/css/ds-digital');`}
      </style>
      <div 
        className="digital-clock-container"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2px 10px',
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          boxShadow: '0 0 10px rgba(0, 212, 255, 0.1), inset 0 0 5px rgba(0, 212, 255, 0.05)',
          marginRight: isSmallScreen ? '4px' : '12px',
          minWidth: isSmallScreen ? '70px' : '90px',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Time Display - 7-segment style */}
        <div
          className="digital-time"
          style={{
            fontFamily: "'DS-Digital', 'Courier New', monospace",
            fontSize: isSmallScreen ? '1.1rem' : '1.3rem',
            color: '#00d4ff',
            letterSpacing: '1px',
            textShadow: '0 0 5px rgba(0, 212, 255, 0.8), 0 0 15px rgba(0, 212, 255, 0.4)',
            lineHeight: '1',
            marginBottom: '1px',
            fontVariantNumeric: 'tabular-nums',
            transition: 'all 0.2s ease',
          }}
        >
          {formatTime()}
        </div>

        {/* Date Display */}
        <div
          className="digital-date"
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: isSmallScreen ? '0.55rem' : '0.6rem',
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: '600',
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
            textTransform: 'uppercase'
          }}
        >
          {formatDate()}
        </div>
      </div>
    </>
  )
}
