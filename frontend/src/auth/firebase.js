'use client'

import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}

const requiredFirebaseKeys = ['apiKey', 'authDomain', 'projectId', 'appId']
const missingFirebaseKeys = requiredFirebaseKeys.filter((key) => !firebaseConfig[key])
const firebaseReady = missingFirebaseKeys.length === 0

const app = firebaseReady ? (getApps()[0] || initializeApp(firebaseConfig)) : null
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null

function getFirebaseSetupMessage() {
  if (firebaseReady) return ''
  return `Firebase setup incomplete. Add ${missingFirebaseKeys.join(', ')} to the frontend environment.`
}

export {
  auth,
  db,
  firebaseConfig,
  firebaseReady,
  missingFirebaseKeys,
  getFirebaseSetupMessage,
}
