'use client'

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export const ROLE_OPTIONS = [
  'Data Analyst',
  'Data Engineer',
  'ML Engineer',
  'Business Analyst',
  'Product Manager',
  'Founder',
]

export const DEFAULT_ROLE = ROLE_OPTIONS[0]
export const PROFILE_CACHE_KEY = 'datalytics-auth-profile'

function readProfileCache() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeProfileCache(profile) {
  if (typeof window === 'undefined') return

  try {
    if (!profile) {
      window.localStorage.removeItem(PROFILE_CACHE_KEY)
      return
    }
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    // Ignore cache write failures so auth still works.
  }
}

export function getInitials(value = '') {
  const parts = value
    .split(' ')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (!parts.length) return 'DL'
  return parts.map((chunk) => chunk[0]?.toUpperCase() || '').join('')
}

export function buildProfileFromAuthUser(user, overrides = {}) {
  const fullName =
    overrides.fullName ||
    user?.displayName ||
    user?.email?.split('@')?.[0]?.replace(/[._-]/g, ' ') ||
    'Datalytics User'

  const role = overrides.role || DEFAULT_ROLE

  return {
    uid: user?.uid || overrides.uid || '',
    fullName,
    email: overrides.email || user?.email || '',
    role,
    photoURL: overrides.photoURL ?? user?.photoURL ?? '',
    provider: overrides.provider || user?.providerData?.[0]?.providerId || 'password',
    verified: Boolean(overrides.verified),
    joinDate: overrides.joinDate || new Date().toISOString(),
    headline:
      overrides.headline ||
      `${role} building AI-powered analytics workflows with Datalytics.`,
    initials: overrides.initials || getInitials(fullName),
    plan: overrides.plan || 'Pro',
    status: overrides.status || 'Active',
    welcomeEmailSent: Boolean(overrides.welcomeEmailSent),
  }
}

export async function loadProfile(uid) {
  const cached = readProfileCache()
  if (!uid) {
    writeProfileCache(null)
    return null
  }

  if (!db) {
    return cached?.uid === uid ? cached : null
  }

  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) {
    return cached?.uid === uid ? cached : null
  }

  const data = snapshot.data()
  const normalized = {
    ...data,
    uid,
    initials: data.initials || getInitials(data.fullName || ''),
  }
  writeProfileCache(normalized)
  return normalized
}

export async function saveProfile(uid, nextProfile) {
  if (!uid) return nextProfile

  const profile = {
    ...nextProfile,
    uid,
    initials: nextProfile.initials || getInitials(nextProfile.fullName || ''),
  }

  writeProfileCache(profile)

  if (!db) {
    return profile
  }

  const now = serverTimestamp()
  await setDoc(
    doc(db, 'users', uid),
    {
      ...profile,
      updatedAt: now,
      createdAt: profile.createdAt || now,
    },
    { merge: true }
  )

  return profile
}

export function clearProfileCache() {
  writeProfileCache(null)
}

export function getCachedProfile() {
  return readProfileCache()
}
