import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import './dashboard-shell.css'

const root = document.getElementById('root')
const isAppRoute = window.location.pathname.startsWith('/app')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {isAppRoute ? (
      <BrowserRouter>
        <Routes>
          <Route path="/app" element={<App />} />
          <Route path="/app/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    ) : null}
  </React.StrictMode>
)
