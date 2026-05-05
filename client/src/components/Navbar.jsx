import { useEffect, useRef, useState } from 'react'
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineBellAlert,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
  HiOutlineCog6Tooth,
  HiOutlineUserCircle,
  HiOutlineCheckCircle,
  HiOutlineBell,
  HiOutlineTrash,
} from 'react-icons/hi2'
import client from '../api/client.js'

const NOTIFICATIONS = [
  { id: 1, title: 'New dataset imported', desc: 'A new dataset has been added to your workspace and is ready for review.', time: 'Just now', unread: true },
  { id: 2, title: 'Insights available', desc: 'Your latest cohort analysis has finished and the dashboard is ready.', time: '12m ago', unread: true },
  { id: 3, title: 'Model training complete', desc: 'Analytics model training completed successfully for the current project.', time: '45m ago', unread: true },
  { id: 4, title: 'Pipeline alert', desc: 'One of your scheduled ETL jobs failed. Open the analytics pipeline to troubleshoot.', time: '1h ago', unread: false },
  { id: 5, title: 'Subscription reminder', desc: 'Your plan renews in 3 days. Review billing and usage before renewal.', time: 'Yesterday', unread: false },
]

export default function Navbar({
  stepLabel,
  onMenuToggle,
  onProfileOpen,
  onOpenSettings,
  onLogout,
  profileName,
  profileRole,
  profileInitials,
  profileAvatar,
  showWelcome = false,
  welcomeType = 'back',
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState(() => {
    if (typeof window === 'undefined') return NOTIFICATIONS
    const saved = window.localStorage.getItem('datalytics-notifications')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (err) {
        console.error('Failed to parse notifications:', err)
      }
    }
    return NOTIFICATIONS
  })
  const [diamondBalance, setDiamondBalance] = useState(() => {
    if (typeof window === 'undefined') return 0
    const cached = window.localStorage.getItem('datalytics-uc-balance')
    return cached !== null ? Number(cached) : 0
  })
  const menuRef = useRef(null)
  const notifRef = useRef(null)

  // Persist notification history locally so the bell keeps state across refreshes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('datalytics-notifications', JSON.stringify(notifs))
    }
  }, [notifs])

  // Fetch diamond balance on mount
  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await client.get('/payment/user-diamonds')
        if (res.data?.diamonds !== undefined) {
          setDiamondBalance(res.data.diamonds)
          window.localStorage.setItem('datalytics-uc-balance', String(res.data.diamonds))
        }
      } catch {
        // User not authenticated or backend down — keep cached/default value
      }
    }
    fetchBalance()
  }, [])

  // Listen for real-time balance updates from payment flow
  useEffect(() => {
    function handleBalanceUpdate(event) {
      if (event.detail?.balance !== undefined) {
        setDiamondBalance(event.detail.balance)
      }
    }
    // Also listen for deductions dispatched from pipeline steps
    function handleDeduction(event) {
      if (event.detail?.remaining !== undefined) {
        setDiamondBalance(event.detail.remaining)
      }
    }
    window.addEventListener('datalytics:diamonds-updated', handleBalanceUpdate)
    window.addEventListener('datalytics:diamonds-deducted', handleDeduction)
    return () => {
      window.removeEventListener('datalytics:diamonds-updated', handleBalanceUpdate)
      window.removeEventListener('datalytics:diamonds-deducted', handleDeduction)
    }
  }, [])

  // Fetch notifications with fallback architecture
  useEffect(() => {
    let poller = null;
    async function fetchNotifications() {
      try {
        const res = await client.get('/notifications');
        if (res.data?.notifications && Array.isArray(res.data.notifications)) {
           // Safely merge or replace based on real API shape.
           // Assuming a complete sync for simplicity
           setNotifs(prev => {
             // Only update if there are genuinely new items to avoid jitter
             if (JSON.stringify(prev) !== JSON.stringify(res.data.notifications)) {
               return res.data.notifications;
             }
             return prev;
           });
        }
      } catch (err) {
        // API gracefully degrades; we stick to the offline/mock storage mode.
      }
    }
    
    fetchNotifications();
    poller = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(poller);
  }, []);

  // Listen for new app notifications so the bell always stays current.
  // You can dispatch a notification from anywhere in the app like:
  // window.dispatchEvent(new CustomEvent('datalytics:notification', { detail: { title, desc, time } }))
  useEffect(() => {
    function handleAppNotification(event) {
      const payload = event.detail
      if (!payload?.title) return

      setNotifs((current) => [
        {
          id: payload.id || Date.now(),
          title: payload.title,
          desc: payload.desc || 'New update from Datalytics Analytics.',
          time: payload.time || 'Just now',
          unread: true,
        },
        ...current,
      ].slice(0, 12))
    }

    window.addEventListener('datalytics:notification', handleAppNotification)
    return () => window.removeEventListener('datalytics:notification', handleAppNotification)
  }, [])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
      if (!notifRef.current?.contains(event.target)) setNotifOpen(false)
    }
    window.addEventListener('mousedown', handleOutsideClick)
    return () => window.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const markAllRead = () => {
    setNotifs(notifs.map(n => ({ ...n, unread: false })))
  }

  const handleNotificationClick = (id) => {
    setNotifs((current) => current.map(n => n.id === id ? { ...n, unread: false } : n))
    setNotifOpen(false)
  }

  const hasUnread = notifs.some(n => n.unread)
  const balanceLow = diamondBalance < 20

  return (
    <>
      {/* â”€â”€ WELCOME BACK TOAST â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '4.5rem',
          right: '1.5rem',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.55rem 1.1rem 0.55rem 0.75rem',
          borderRadius: '999px',
          background: 'rgba(15, 23, 36, 0.92)',
          border: '1px solid rgba(0, 212, 170, 0.25)',
          boxShadow: '0 4px 24px rgba(0,212,170,0.15), 0 2px 8px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(14px)',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#e2f8f0',
          letterSpacing: '0.01em',
          whiteSpace: 'normal',
          maxWidth: 'calc(100vw - 2rem)',
          lineHeight: 1.35,
          pointerEvents: 'none',
          transition: 'opacity 0.45s cubic-bezier(0.4,0,0.2,1), transform 0.45s cubic-bezier(0.4,0,0.2,1)',
          opacity: showWelcome ? 1 : 0,
          transform: showWelcome ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(0.95)',
        }}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00c977, #00a86b)',
          boxShadow: '0 0 8px rgba(0,210,120,0.5)',
          flexShrink: 0,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {welcomeType === 'new' ? (
          <span>Welcome, <span style={{ color: '#4fffbe' }}>{(profileName || '').split(' ')[0]}</span>! 🎉 Your account is ready!</span>
        ) : (
          <span>Welcome back, <span style={{ color: '#4fffbe' }}>{(profileName || '').split(' ')[0]}</span>! Your workspace is ready.</span>
        )}
      </div>

      <header className="ds-navbar">
        <div className="ds-navbar-left">
          {/* HAMBURGER — mobile only */}
          <button
            type="button"
            className="ds-navbar-hamburger"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
          >
            <HiOutlineBars3 />
          </button>

          <div className="ds-navbar-breadcrumb">
            <span className="ds-navbar-breadcrumb-root">Analytics Workspace</span>
            <HiOutlineChevronRight />
            <span className="ds-navbar-breadcrumb-current">{stepLabel}</span>
          </div>
        </div>

        <div className="ds-navbar-right">


          {/* DIAMOND BALANCE PILL */}
          <button
            type="button"
            onClick={onProfileOpen}
            title={balanceLow ? 'Low UC balance! Buy a plan to continue.' : `${diamondBalance} UC available`}
            className={`
              inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold
              border backdrop-blur-sm transition-all duration-300
              ${balanceLow
                ? 'border-rose-400/40 bg-rose-500/15 text-rose-300 shadow-[0_0_12px_rgba(248,113,113,0.2)] animate-pulse'
                : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100 shadow-[0_0_12px_rgba(0,212,255,0.18)] hover:bg-cyan-400/20 hover:border-cyan-400/50'
              }
            `}
            id="navbar-diamond-balance"
          >
            <span className="text-lg leading-none select-none" style={{ filter: 'drop-shadow(0 0 5px #00c6ff)' }}>🪙</span>
            <span className="tabular-nums text-base">{diamondBalance.toLocaleString()}</span>
            {balanceLow && <span className="text-xs opacity-80">Low!</span>}
          </button>


          {/* PROFILE */}
          <div className="ds-navbar-profile-wrap" ref={menuRef} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className={`ds-navbar-profile${menuOpen ? ' is-open' : ''}`}
              onClick={(e) => {
                // Direct access to profile page when clicking the profile block
                onProfileOpen?.()
              }}
              title="View Profile"
            >
              <span className="ds-navbar-avatar overflow-hidden">
                 {profileAvatar ? <img src={profileAvatar} alt="Avatar" className="w-full h-full object-cover" /> : profileInitials}
              </span>
              <span className="ds-navbar-profile-copy">
                <strong className="text-white drop-shadow-sm">{profileName}</strong>
                <small className="text-cyan-300/80">{profileRole}</small>
              </span>
            </button>

            {menuOpen && (
              <div className="ds-navbar-dropdown" role="menu">
                <button
                  type="button"
                  className="ds-navbar-dropdown-item hover:!text-cyan-300 hover:!bg-cyan-400/10"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onProfileOpen?.()
                  }}
                >
                  <HiOutlineUserCircle />
                  <span>View Profile</span>
                </button>

                <button
                  type="button"
                  className="ds-navbar-dropdown-item hover:!text-cyan-300 hover:!bg-cyan-400/10"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onOpenSettings?.()
                  }}
                >
                  <HiOutlineCog6Tooth />
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  className="ds-navbar-dropdown-item is-muted hover:!text-rose-400 hover:!bg-rose-500/10"
                  role="menuitem"
                  onClick={() => { 
                    setMenuOpen(false)
                    onLogout?.()
                  }}
                >
                  <HiOutlineArrowRightOnRectangle />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
