import client from './client.js'

export async function fetchChatHistory() {
  const response = await client.get('/chat/history')
  return response.data
}

export async function sendChatMessage(message) {
  const response = await client.post('/chat', { message })
  return response.data
}

export async function clearChatHistory() {
  const response = await client.delete('/chat/clear')
  return response.data
}
