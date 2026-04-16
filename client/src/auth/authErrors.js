const AUTH_ERROR_MAP = {
  'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The password you entered is incorrect.',
  'auth/user-not-found': 'No account was found for this email.',
  'auth/weak-password': 'Use a stronger password with at least 6 characters.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in popup.',
  'auth/network-request-failed': 'Network issue detected. Please try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
}

export function getAuthErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const code = error?.code || error?.response?.data?.detail?.code
  if (code && AUTH_ERROR_MAP[code]) {
    return AUTH_ERROR_MAP[code]
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallback
}
