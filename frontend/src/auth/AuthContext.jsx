'use client'

import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { getAuthErrorMessage } from './authErrors'
import { auth, firebaseReady, getFirebaseSetupMessage } from './firebase'
import {
  buildProfileFromAuthUser,
  clearProfileCache,
  DEFAULT_ROLE,
  getCachedProfile,
  loadProfile,
  saveProfile,
} from './profileStore'

const AuthContext = createContext(null)

async function postAuthRequest(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.detail || data?.message || 'Request failed.')
  }

  return data
}

function ensureFirebaseConfigured() {
  if (!firebaseReady || !auth) {
    throw new Error(getFirebaseSetupMessage())
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(() => getCachedProfile())
  const [initialized, setInitialized] = useState(false)
  const [loadingAction, setLoadingAction] = useState('')
  const latestProfileRef = useRef(profile)

  useEffect(() => {
    latestProfileRef.current = profile
  }, [profile])

  useEffect(() => {
    if (!auth || !firebaseReady) {
      setInitialized(true)
      return undefined
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser)

      if (!nextUser) {
        setProfile(null)
        clearProfileCache()
        setInitialized(true)
        return
      }

      try {
        const existingProfile = await loadProfile(nextUser.uid)
        const nextProfile = existingProfile || buildProfileFromAuthUser(nextUser)
        if (!existingProfile) {
          await saveProfile(nextUser.uid, nextProfile)
        }
        setProfile(nextProfile)
      } catch (error) {
        setProfile(buildProfileFromAuthUser(nextUser))
      } finally {
        setInitialized(true)
      }
    })

    return unsubscribe
  }, [])

  async function persistUserProfile(nextUser, updates = {}) {
    const baseProfile = buildProfileFromAuthUser(nextUser, {
      ...latestProfileRef.current,
      ...updates,
    })
    const savedProfile = await saveProfile(nextUser.uid, baseProfile)
    setProfile(savedProfile)
    return savedProfile
  }

  async function signUpWithEmail(form) {
    ensureFirebaseConfigured()
    setLoadingAction('signup')

    try {
      const result = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(result.user, { displayName: form.fullName })

      const nextProfile = await persistUserProfile(result.user, {
        fullName: form.fullName,
        role: form.role || DEFAULT_ROLE,
        provider: 'password',
        verified: false,
        headline: `${form.role || DEFAULT_ROLE} exploring smarter analytics workflows.`,
      })

      const otpResult = await postAuthRequest('/api/auth/request-otp', {
        uid: result.user.uid,
        name: nextProfile.fullName,
        email: nextProfile.email,
        role: nextProfile.role,
        provider: nextProfile.provider,
      })

      return {
        profile: nextProfile,
        otpResult,
      }
    } catch (error) {
      throw new Error(getAuthErrorMessage(error))
    } finally {
      setLoadingAction('')
    }
  }

  async function loginWithEmail(form) {
    ensureFirebaseConfigured()
    setLoadingAction('login')

    try {
      const result = await signInWithEmailAndPassword(auth, form.email, form.password)
      const storedProfile = (await loadProfile(result.user.uid)) || buildProfileFromAuthUser(result.user)
      const nextProfile = await persistUserProfile(result.user, storedProfile)

      if (!nextProfile.verified) {
        const otpResult = await postAuthRequest('/api/auth/request-otp', {
          uid: result.user.uid,
          name: nextProfile.fullName,
          email: nextProfile.email,
          role: nextProfile.role,
          provider: nextProfile.provider,
        })

        return {
          profile: nextProfile,
          requiresOtp: true,
          otpResult,
        }
      }

      return {
        profile: nextProfile,
        requiresOtp: false,
      }
    } catch (error) {
      throw new Error(getAuthErrorMessage(error))
    } finally {
      setLoadingAction('')
    }
  }

  async function loginWithGoogle(role = DEFAULT_ROLE) {
    ensureFirebaseConfigured()
    setLoadingAction('google')

    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })

      const result = await signInWithPopup(auth, provider)
      const authInfo = getAdditionalUserInfo(result)
      const nextProfile = await persistUserProfile(result.user, {
        role: latestProfileRef.current?.role || role || DEFAULT_ROLE,
        provider: 'google',
        verified: true,
      })

      await postAuthRequest('/api/auth/welcome-email', {
        uid: result.user.uid,
        name: nextProfile.fullName,
        email: nextProfile.email,
        role: nextProfile.role,
        provider: 'google',
        firstTime: Boolean(authInfo?.isNewUser),
      })

      return {
        profile: nextProfile,
        isNewUser: Boolean(authInfo?.isNewUser),
      }
    } catch (error) {
      throw new Error(getAuthErrorMessage(error))
    } finally {
      setLoadingAction('')
    }
  }

  async function verifyOtp(code) {
    if (!user) {
      throw new Error('Log in again before verifying your OTP.')
    }

    setLoadingAction('verify-otp')

    try {
      const currentProfile =
        latestProfileRef.current ||
        buildProfileFromAuthUser(user, { verified: false })

      const response = await postAuthRequest('/api/auth/verify-otp', {
        uid: user.uid,
        email: currentProfile.email,
        otp: code,
        name: currentProfile.fullName,
        role: currentProfile.role,
      })

      const verifiedProfile = await persistUserProfile(user, {
        ...currentProfile,
        verified: true,
        welcomeEmailSent: true,
      })

      return {
        profile: verifiedProfile,
        response,
      }
    } catch (error) {
      throw new Error(getAuthErrorMessage(error, 'OTP could not be verified.'))
    } finally {
      setLoadingAction('')
    }
  }

  async function resendOtp() {
    if (!user) {
      throw new Error('Log in again before requesting a new OTP.')
    }

    setLoadingAction('resend-otp')

    try {
      const currentProfile =
        latestProfileRef.current ||
        buildProfileFromAuthUser(user, { verified: false })

      return await postAuthRequest('/api/auth/resend-otp', {
        uid: user.uid,
        name: currentProfile.fullName,
        email: currentProfile.email,
        role: currentProfile.role,
        provider: currentProfile.provider,
      })
    } catch (error) {
      throw new Error(getAuthErrorMessage(error, 'Unable to resend OTP right now.'))
    } finally {
      setLoadingAction('')
    }
  }

  async function sendResetLink(email) {
    ensureFirebaseConfigured()
    setLoadingAction('forgot-password')

    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (error) {
      throw new Error(getAuthErrorMessage(error))
    } finally {
      setLoadingAction('')
    }
  }

  async function logout() {
    if (!auth) return
    setLoadingAction('logout')

    try {
      await signOut(auth)
      clearProfileCache()
      setProfile(null)
      setUser(null)
    } finally {
      setLoadingAction('')
    }
  }

  const value = {
    user,
    profile,
    initialized,
    loadingAction,
    isAuthenticated: Boolean(user),
    isVerified: Boolean(profile?.verified),
    firebaseReady,
    firebaseSetupMessage: getFirebaseSetupMessage(),
    signUpWithEmail,
    loginWithEmail,
    loginWithGoogle,
    verifyOtp,
    resendOtp,
    sendResetLink,
    logout,
    refreshProfile: async () => {
      if (!user) return null
      const freshProfile = await loadProfile(user.uid)
      if (freshProfile) {
        setProfile(freshProfile)
      }
      return freshProfile
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.')
  }

  return context
}
