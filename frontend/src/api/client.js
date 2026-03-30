/**
 * Axios API client.
 * Reads/writes X-Session-ID from localStorage so the backend
 * can use an in-memory session keyed by UUID.
 */
import axios from 'axios'

const SESSION_KEY = 'ml_dashboard_session_id'

function getBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:8000/api'
  }

  return `http://${window.location.hostname || '127.0.0.1'}:8000/api`
}

function getSessionId() {
  if (typeof window === 'undefined') {
    return 'server-session'
  }

  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function clearSessionId() {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(SESSION_KEY)
}

const client = axios.create({
  baseURL: getBaseUrl(),
  timeout: 300_000,   // 5 min for large training jobs
})

// Attach session ID to every request
client.interceptors.request.use((config) => {
  config.headers['X-Session-ID'] = getSessionId()
  return config
})

// Persist session ID if the server returns a new one
client.interceptors.response.use((response) => {
  const sid = response.headers['x-session-id']
  if (sid && typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, sid)
  }
  return response
})

export default client
export { clearSessionId, getSessionId }
