'use client'

import React, { useState } from 'react'

export default function OrangeDashboard() {
  const [expandedPrediction, setExpandedPrediction] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [activePage, setActivePage] = useState('upload')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setUploadedFiles(prev => [...prev, ...files])
  }

  const handleFileUpload = (e, type) => {
    const files = Array.from(e.target.files)
    setUploadedFiles(prev => [...prev, ...files])
  }

  const showPage = (pageId) => {
    setActivePage(pageId)
  }

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const toggleChat = () => {
    setChatOpen(!chatOpen)
  }

  const navItems = [
    { id: 'upload', label: 'Upload CSV/Excel', icon: '📤', section: 'DATA IMPORT' },
    { id: 'connect', label: 'Connect Data Sources', icon: '🔗', section: 'DATA IMPORT' },
    { id: 'home', label: 'Home', icon: '🏠', section: 'NAVIGATION' },
    { id: 'dashboard', label: 'Dashboard', icon: '📈', section: 'NAVIGATION' },
    { id: 'predictions', label: 'Predictions', icon: '🤖', section: 'NAVIGATION' },
    { id: 'analytics', label: 'Analytics', icon: '📊', section: 'NAVIGATION' },
    { id: 'tables', label: 'Data Tables', icon: '📋', section: 'NAVIGATION' },
    { id: 'reports', label: 'Reports', icon: '📄', section: 'NAVIGATION' },
    { id: 'ai', label: 'AI Assistant', icon: '🧠', section: 'NAVIGATION' },
  ]

  const renderPageContent = () => {
    switch (activePage) {
      case 'upload':
        return (
          <div>
            <div className="breadcrumb">
              <span>Home</span>
              <span>›</span>
              <span>Upload Data</span>
            </div>
            <h1 className="page-title">Upload CSV & Excel Files</h1>
            <p className="page-subtitle">Import your data files to start analyzing</p>
            
            <div className="top-buttons">
              <button className="btn btn-outlined">Clear All</button>
              <button className="btn btn-orange">
                ✨ Process All Files
              </button>
            </div>
            
            <div className="content-grid">
              <div>
                <div 
                  className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="upload-icon">
                    <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m17-4l-7-7-7 7m14 0v8"/>
                    </svg>
                  </div>
                  <div className="upload-text">
                    <h3>Drag & drop files here</h3>
                    <p>or <span className="browse-link">browse to select files</span></p>
                  </div>
                  <div className="upload-buttons">
                    <label className="btn btn-green">
                      📁 CSV Files
                      <input
                        type="file"
                        accept=".csv"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'csv')}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <label className="btn btn-green">
                      📊 Excel Files
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'excel')}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  <p className="upload-note">Maximum file size: 250MB • Supported formats: .csv, .xlsx, .xls</p>
                </div>
              </div>
              
              <div className="right-panel">
                <div className="panel-card orange-gradient">
                  <h3 className="panel-title">Upload Summary</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">Total Files</span>
                      <span className="stat-value">{uploadedFiles.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Ready</span>
                      <span className="stat-value">{uploadedFiles.length}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Processing</span>
                      <span className="stat-value">0</span>
                    </div>
                  </div>
                </div>
                
                <div className="panel-card">
                  <h3 className="panel-title">Supported Formats</h3>
                  <div className="format-item">
                    <div className="format-icon csv">CSV</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>CSV Files</div>
                      <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>Comma-separated values</div>
                    </div>
                  </div>
                  <div className="format-item">
                    <div className="format-icon excel">XLS</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>Excel (.xlsx)</div>
                      <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>Microsoft Excel format</div>
                    </div>
                  </div>
                </div>
                
                <div className="panel-card">
                  <h3 className="panel-title">Quick Actions</h3>
                  <button className="btn btn-outlined" style={{ width: '100%' }}>Download Sample CSV</button>
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'exploration':
        return (
          <div>
            <div className="breadcrumb">
              <span>Home</span>
              <span>›</span>
              <span>Data Exploration</span>
            </div>
            <h1 className="page-title">Data Exploration</h1>
            <p className="page-subtitle">Analyze your data structure and statistics</p>
            
            <div className="panel-card">
              <h3 className="panel-title">Dataset Preview</h3>
              <p style={{ color: '#6B7280', marginBottom: '1rem' }}>Table preview, column statistics, and data types will appear here</p>
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
                <svg width="48" height="48" fill="none" stroke="#D1D5DB" strokeWidth="2" style={{ margin: '0 auto' }}>
                  <rect x="4" y="4" width="40" height="32" rx="2"/>
                  <path d="M4 12h40m-8 8h8m-8 8h8"/>
                </svg>
                <p style={{ marginTop: '1rem', color: '#6B7280' }}>No data loaded yet</p>
              </div>
            </div>
          </div>
        )
      
      case 'visualization':
        return (
          <div>
            <div className="breadcrumb">
              <span>Home</span>
              <span>›</span>
              <span>Visualization</span>
            </div>
            <h1 className="page-title">Data Visualization</h1>
            <p className="page-subtitle">Create charts and graphs from your data</p>
            
            <div className="panel-card">
              <h3 className="panel-title">Chart Type Selector</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button className="btn btn-outlined">Bar</button>
                <button className="btn btn-outlined">Line</button>
                <button className="btn btn-outlined">Scatter</button>
                <button className="btn btn-outlined">Pie</button>
                <button className="btn btn-outlined">Heatmap</button>
              </div>
              <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '3rem', textAlign: 'center' }}>
                <svg width="48" height="48" fill="none" stroke="#D1D5DB" strokeWidth="2" style={{ margin: '0 auto' }}>
                  <path d="M4 20h6m6 0h6m6 0h6M4 12h6m6 0h6m6 0h6M4 4h6m6 0h6m6 0h6"/>
                </svg>
                <p style={{ marginTop: '1rem', color: '#6B7280' }}>Select chart type to visualize data</p>
              </div>
            </div>
          </div>
        )
      
      default:
        return (
          <div>
            <div className="breadcrumb">
              <span>Home</span>
              <span>›</span>
              <span>{activePage}</span>
            </div>
            <h1 className="page-title">{activePage.charAt(0).toUpperCase() + activePage.slice(1)}</h1>
            <p className="page-subtitle">Page content for {activePage}</p>
            
            <div className="panel-card">
              <p style={{ color: '#6B7280' }}>This page is under development. Content will be added soon.</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo">
          <div className="logo-icon">📊</div>
          <span className="logo-text">Datalytics</span>
          <button className="collapse-btn" onClick={toggleSidebar}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            </svg>
          </button>
        </div>
        
        {['DATA IMPORT', 'NAVIGATION'].map(section => (
          <div key={section}>
            <div className="section-label">{section}</div>
            {navItems
              .filter(item => item.section === section)
              .map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => showPage(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
          </div>
        ))}
        
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => showPage('profile')}>
            <span className="nav-icon">👤</span>
            <span>Profile</span>
          </button>
          <button className="nav-item" onClick={() => showPage('settings')}>
            <span className="nav-icon">⚙️</span>
            <span>Settings</span>
          </button>
          <button className="nav-item logout">
            <span className="nav-icon">🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="main-content">
        {/* Top Navbar */}
        <nav className="top-navbar">
          <div className="search-bar">
            <div className="search-wrapper">
              <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="7" cy="7" r="6"/>
                <path d="M13 13l4 4"/>
              </svg>
              <input type="text" className="search-input" placeholder="Search anything..."/>
            </div>
          </div>
          
          <div className="navbar-right">
            <button className="icon-btn">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2m0 16v2m11-9h-2M3 12H1m16.48-6.36l-1.42 1.42M6.05 6.05L4.63 4.63m12.74 12.74l-1.42-1.42M6.05 17.95l-1.42 1.42"/>
              </svg>
            </button>
            <button className="icon-btn">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="notification-badge"></span>
            </button>
            <div className="profile-info">
              <div className="profile-avatar">SS</div>
              <span className="profile-name">SANGAM SINGH</span>
            </div>
            <button className="icon-btn logout">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9"/>
              </svg>
            </button>
          </div>
        </nav>
        
        {/* Page Content */}
        <div className="page-content">
          {renderPageContent()}
        </div>
      </main>
      
      {/* Chatbot */}
      <div className="chatbot-fab" onClick={toggleChat}>
        <svg width="24" height="24" fill="white" stroke="white" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
      </div>
      
      <div className={`chat-panel ${chatOpen ? 'open' : ''}`}>
        <div className="chat-header">AI Assistant</div>
        <div className="chat-messages">
          <div style={{ backgroundColor: '#F3F4F6', padding: '0.75rem', borderRadius: '8px', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: '0.875rem' }}>Hello! I'm your AI assistant. How can I help you today?</p>
          </div>
        </div>
        <div className="chat-input-area">
          <input type="text" className="chat-input" placeholder="Type your message..."/>
          <button className="chat-send">Send</button>
        </div>
      </div>
      
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        .app-container {
          display: flex;
          height: 100vh;
          font-family: 'Outfit', sans-serif;
          background-color: #F3F4F6;
          color: #1F2937;
        }
        
        .sidebar {
          width: 200px;
          background-color: white;
          border-right: 1px solid #E5E7EB;
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
        }
        
        .sidebar.collapsed {
          width: 60px;
        }
        
        .logo {
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid #E5E7EB;
        }
        
        .logo-icon {
          width: 24px;
          height: 24px;
          background-color: #F97316;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }
        
        .logo-text {
          font-weight: 600;
          font-size: 1.1rem;
          color: #1F2937;
        }
        
        .sidebar.collapsed .logo-text {
          display: none;
        }
        
        .collapse-btn {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          color: #6B7280;
        }
        
        .section-label {
          padding: 0.75rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .nav-item {
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          font-size: 0.9rem;
        }
        
        .nav-item:hover {
          background-color: #F9FAFB;
        }
        
        .nav-item.active {
          background-color: #F97316;
          color: white;
        }
        
        .nav-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .sidebar-bottom {
          margin-top: auto;
          border-top: 1px solid #E5E7EB;
        }
        
        .nav-item.logout {
          color: #EF4444;
        }
        
        .nav-item.logout:hover {
          background-color: #FEE2E2;
        }
        
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          background-color: #F3F4F6;
        }
        
        .top-navbar {
          background-color: white;
          border-bottom: 1px solid #E5E7EB;
          padding: 0.75rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        
        .search-bar {
          flex: 1;
          max-width: 400px;
          margin: 0 auto;
        }
        
        .search-wrapper {
          position: relative;
        }
        
        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #6B7280;
        }
        
        .search-input {
          width: 100%;
          padding: 0.5rem 1rem 0.5rem 2.5rem;
          border: 1px solid #E5E7EB;
          border-radius: 8px;
          background-color: #F9FAFB;
          font-size: 0.9rem;
        }
        
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .icon-btn {
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
          border-radius: 8px;
          color: #6B7280;
          position: relative;
        }
        
        .icon-btn:hover {
          background-color: #F9FAFB;
        }
        
        .notification-badge {
          position: absolute;
          top: 0.25rem;
          right: 0.25rem;
          width: 8px;
          height: 8px;
          background-color: #F97316;
          border-radius: 50%;
        }
        
        .profile-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .profile-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: #F97316;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 0.8rem;
        }
        
        .profile-name {
          font-weight: 500;
          font-size: 0.9rem;
        }
        
        .page-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
        }
        
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          color: #6B7280;
        }
        
        .page-title {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
          color: #1F2937;
        }
        
        .page-subtitle {
          font-size: 1rem;
          color: #6B7280;
          margin-bottom: 2rem;
        }
        
        .upload-zone {
          border: 2px dashed #D1D5DB;
          border-radius: 12px;
          padding: 3rem 2rem;
          text-align: center;
          background-color: white;
          margin-bottom: 2rem;
          transition: all 0.2s ease;
        }
        
        .upload-zone.dragging {
          border-color: #F97316;
          background-color: #FFFBEB;
        }
        
        .upload-zone:hover {
          border-color: #F97316;
          background-color: #FFFBEB;
        }
        
        .upload-icon {
          width: 64px;
          height: 64px;
          background-color: #FED7AA;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          color: #F97316;
        }
        
        .upload-text {
          margin-bottom: 1.5rem;
        }
        
        .upload-text h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .browse-link {
          color: #F97316;
          text-decoration: underline;
          cursor: pointer;
        }
        
        .upload-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 1rem;
        }
        
        .btn {
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid #D1D5DB;
          background-color: white;
          transition: all 0.2s ease;
          font-family: 'Outfit', sans-serif;
        }
        
        .btn-green {
          border-color: #10B981;
          color: #10B981;
        }
        
        .btn-green:hover {
          background-color: #ECFDF5;
        }
        
        .btn-outlined {
          background-color: white;
          border: 1px solid #D1D5DB;
          color: #374151;
        }
        
        .btn-outlined:hover {
          background-color: #F9FAFB;
        }
        
        .btn-orange {
          background: linear-gradient(135deg, #F97316, #EA580C);
          color: white;
          border: none;
        }
        
        .btn-orange:hover {
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
        }
        
        .upload-note {
          font-size: 0.875rem;
          color: #6B7280;
        }
        
        .top-buttons {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
          margin-bottom: 2rem;
        }
        
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 2rem;
        }
        
        .right-panel {
          width: 320px;
        }
        
        .panel-card {
          background-color: white;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .panel-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        
        .stats-grid {
          display: grid;
          gap: 1rem;
        }
        
        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .stat-label {
          color: #6B7280;
          font-size: 0.9rem;
        }
        
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
        }
        
        .orange-gradient {
          background: linear-gradient(135deg, #F97316, #EA580C);
          color: white;
        }
        
        .orange-gradient .panel-title,
        .orange-gradient .stat-label {
          color: white;
        }
        
        .format-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .format-icon {
          width: 40px;
          height: 40px;
          background-color: #F3F4F6;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.8rem;
        }
        
        .format-icon.csv {
          background-color: #D1FAE5;
          color: #10B981;
        }
        
        .format-icon.excel {
          background-color: #DBEAFE;
          color: #2563EB;
        }
        
        .chatbot-fab {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 56px;
          height: 56px;
          background-color: #F97316;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
          transition: all 0.2s ease;
        }
        
        .chatbot-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(249, 115, 22, 0.4);
        }
        
        .chat-panel {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          width: 300px;
          height: 400px;
          background-color: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          display: none;
          flex-direction: column;
        }
        
        .chat-panel.open {
          display: flex;
        }
        
        .chat-header {
          padding: 1rem;
          border-bottom: 1px solid #E5E7EB;
          font-weight: 600;
          background-color: #F97316;
          color: white;
          border-radius: 12px 12px 0 0;
        }
        
        .chat-messages {
          flex: 1;
          padding: 1rem;
          overflow-y: auto;
        }
        
        .chat-input-area {
          padding: 1rem;
          border-top: 1px solid #E5E7EB;
          display: flex;
          gap: 0.5rem;
        }
        
        .chat-input {
          flex: 1;
          padding: 0.5rem;
          border: 1px solid #E5E7EB;
          border-radius: 6px;
        }
        
        .chat-send {
          background-color: #F97316;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
        }
        
        @media (max-width: 768px) {
          .sidebar {
            width: 60px;
          }
          
          .logo-text,
          .section-label,
          .nav-item span:not(.nav-icon),
          .profile-name {
            display: none;
          }
          
          .content-grid {
            grid-template-columns: 1fr;
          }
          
          .right-panel {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
