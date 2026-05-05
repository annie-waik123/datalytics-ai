import React from 'react';
import { SiMysql, SiPostgresql, SiGooglesheets, SiJson } from 'react-icons/si';
import { DiMsqlServer } from 'react-icons/di';
import { FaFilePdf } from 'react-icons/fa';

const SOURCES = [
  { id: 'googlesheets', name: 'Google Sheets', desc: 'Sync spreadsheet data', icon: SiGooglesheets, color: '#34A853' },
  { id: 'json', name: 'JSON', desc: 'JSON API Endpoint', icon: SiJson, color: '#FFFFFF' },
  { id: 'mysql', name: 'MySQL', desc: 'Relational database', icon: SiMysql, color: '#4479A1' },
  { id: 'postgresql', name: 'PostgreSQL', desc: 'Advanced SQL database', icon: SiPostgresql, color: '#336791' },
  { id: 'mssql', name: 'Microsoft SQL Server', desc: 'Enterprise database', icon: DiMsqlServer, color: '#CC292B' },
  { id: 'pdf', name: 'PDF Document', desc: 'Extract data from PDF', icon: FaFilePdf, color: '#E11D48' },
];

export default function DataSourcesModal({ isOpen, onClose, onSelectSource }) {
  if (!isOpen) return null;

  return (
    <div className="data-sources-overlay">
      <div className="data-sources-modal">
        <div className="data-sources-header">
          <h2>Data Sources</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div className="data-sources-list">
          {SOURCES.map((source) => (
            <div 
              key={source.id} 
              className="data-source-item"
              onClick={() => {
                if (onSelectSource) onSelectSource(source);
                onClose();
              }}
            >
              <div className="source-icon" style={{ color: source.color }}>
                <source.icon size={48} />
              </div>
              <div className="source-info">
                <h3>{source.name}</h3>
                <p>{source.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
