import React, { useState } from 'react'

export default function DataAnalyticsDashboard() {
  const [expandedPrediction, setExpandedPrediction] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)

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

  const sidebarSections = [
    {
      title: 'Data Import',
      items: [
        { id: 'upload', label: 'Upload CSV/Excel', icon: '📤' },
        { id: 'connect', label: 'Connect Data Sources', icon: '🔗' }
      ]
    },
    {
      title: 'Navigation',
      items: [
        { id: 'dataset', label: '01. Dataset Upload', icon: '📁' },
        { id: 'exploration', label: '02. Data Exploration', icon: '🔍' },
        { id: 'visualization', label: '03. Visualization', icon: '📊' },
        { 
          id: 'prediction', 
          label: '04. Prediction', 
          icon: '🤖',
          hasSubmenu: true,
          submenu: [
            { id: 'preprocessing', label: 'Data Preprocessing' },
            { id: 'supervised', label: 'Supervised Models' },
            { id: 'unsupervised', label: 'Unsupervised Models' },
            { id: 'best-model', label: 'Best Model Selection' },
            { id: 'prediction', label: 'Prediction' },
            { id: 'download', label: 'Download Results' }
          ]
        },
        { id: 'dashboard', label: '05. Auto BI Dashboard', icon: '📈' },
        { id: 'recommendations', label: '06. Recommendations & Insights', icon: '💡' },
        { id: 'reports', label: '07. Reports', icon: '📄' },
        { id: 'insights', label: '08. AI Insights', icon: '🧠' }
      ]
    }
  ]

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Datalytics
          </h1>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          {sidebarSections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <div key={itemIdx}>
                    <button
                      onClick={() => {
                        if (item.hasSubmenu) {
                          setExpandedPrediction(!expandedPrediction)
                        }
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-gray-100 text-gray-700"
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                      {item.hasSubmenu && (
                        <svg 
                          className={`w-4 h-4 transition-transform ${expandedPrediction ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>

                    {/* Submenu */}
                    {item.hasSubmenu && expandedPrediction && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.submenu.map((subItem, subIdx) => (
                          <button
                            key={subIdx}
                            onClick={() => {}}
                            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all duration-200"
                          >
                            {subItem.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200">
            <span>👤</span>
            <span>Profile</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200">
            <span>⚙️</span>
            <span>Settings</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200">
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Search Bar */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">John Doe</span>
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  JD
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          <div className="flex-1 p-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-600 mb-6">
              <span>Home</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Upload Data</span>
            </nav>

            {/* Title Section */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload CSV & Excel Files</h1>
              <p className="text-gray-600">Import your data files to start analyzing</p>
            </div>

            {/* Upload Section */}
            <div className="mb-8">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
                  isDragging 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-300 hover:border-gray-400 bg-white'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Drag & drop files here or browse</h3>
                  
                  <div className="flex gap-4 mb-4">
                    <label className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer font-medium">
                      CSV Files
                      <input
                        type="file"
                        accept=".csv"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'csv')}
                        className="hidden"
                      />
                    </label>
                    <label className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer font-medium">
                      Excel Files
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        multiple
                        onChange={(e) => handleFileUpload(e, 'excel')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  
                  <p className="text-sm text-gray-500">
                    Maximum file size: 250MB | Supported formats: .csv, .xlsx, .xls
                  </p>
                </div>
              </div>
            </div>

            {/* Top Right Buttons */}
            <div className="flex gap-4 mb-8">
              <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                Clear All
              </button>
              <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium">
                Process All Files
              </button>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Uploaded Files</h3>
                <div className="space-y-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📄</span>
                        <div>
                          <p className="font-medium text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button className="text-red-500 hover:text-red-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="w-80 p-6 space-y-6">
            {/* Upload Summary Card */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Upload Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-purple-100">Total Files</span>
                  <span className="font-bold text-xl">{uploadedFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-100">Ready</span>
                  <span className="font-bold text-xl">{uploadedFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-100">Processing</span>
                  <span className="font-bold text-xl">0</span>
                </div>
              </div>
            </div>

            {/* Supported Formats Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Supported Formats</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">CSV</span>
                  </div>
                  <span className="text-gray-700">CSV Files</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 font-bold">XLS</span>
                  </div>
                  <span className="text-gray-700">Excel (.xlsx)</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900">Quick Actions</h3>
              <button className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 font-medium">
                Download Sample CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <button className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-white hover:scale-110">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  )
}
