import { useEffect, useState, useMemo } from 'react'
import jsPDF from 'jspdf'
import { generateRecommendationInsights, syncInsightsDataset } from '../api/insights.js'
import { useToast } from '../hooks/useToast.js'
import client from '../api/client.js'
import '../report.css'

const STORAGE_KEY = 'datalytics_ai_report'
const COMPANY_NAME = 'DATALYTICS'

const AI_REPORT_PROMPT = `You are an AI Reporting Engine.

Your task is to generate a COMPLETE END-TO-END REPORT based on the user's dataset and all pipeline steps performed.

The report must include EVERYTHING the user has done in the platform.

========================
GOAL
====

Generate a PROFESSIONAL REPORT that explains:
👉 What was done
👉 What was found
👉 What decisions should be taken

========================
OUTPUT FORMAT (STRICT UI FORMAT)
================================

=== 📊 DATASET OVERVIEW ===
* Total rows, columns
* Data types
* Key variables

=== 🔍 DATA EXPLORATION (EDA) ===
* Key patterns discovered
* Distribution insights
* Correlations
* Important observations

=== 🧹 DATA CLEANING SUMMARY ===
* Missing values handled (how?)
* Duplicate rows removed
* Outliers treated
* Columns removed (if any)

=== 🔧 DATA TRANSFORMATIONS ===
* Encoding applied
* Scaling applied
* Data type fixes

=== 📈 VISUAL INSIGHTS ===
* Important trends observed in charts
* Comparisons and patterns

=== 🤖 MODEL / PREDICTION (IF AVAILABLE) ===
* Model used
* Key results
* Accuracy / performance (if available)

=== 💡 RECOMMENDATIONS ===
* Key actionable suggestions generated

=== 🚀 DECISION SUMMARY ===
* What should be done next (top decisions)

=== ⚠️ RISKS & LIMITATIONS ===
* Data issues
* Limitations (small dataset, missing data, etc.)

=== 📈 FINAL BUSINESS / PERFORMANCE IMPACT ===
* Expected improvements
* Benefits of actions taken

=== 🧠 CONCLUSION ===
* Final summary in 2–3 lines

========================
STRICT RULES
============
* Cover ALL pipeline steps
* Use simple language
* No repetition
* Make it structured and clean
* If any step not available → mention "Not performed"

========================
FINAL INSTRUCTION
=================
Act like generating a professional report for stakeholders.
`

function readAiInsights() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('datalytics_ai_insights')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function readDecisionInsights() {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('datalytics_decision_making_json')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function normalizeReportPayload(response) {
  let content = response?.generated_response?.content || response?.content || ''
  if (!content) return { sections: [] }
  
  const sections = []
  const parts = content.split(/===\s*(.*?)\s*===/)
  
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim()
    let text = (parts[i+1] || '').replace(/={10,}/g, '').trim()
    sections.push({ title, text })
  }
  
  if (sections.length === 0) {
    sections.push({ title: "Professional Report", text: content })
  }
  
  return { sections, rawText: content }
}

export default function ReportStep({
  dataset,
  datasetProfile,
  predictionStatus,
  vizConfig,
  savedCharts,
  onComplete,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setReportData(JSON.parse(raw))
      }
    } catch {}
  }, [])

  if (!dataset || !datasetProfile) {
    return (
      <div className="empty-state">
        <h2>Upload a dataset to generate reports</h2>
        <p>Reports include charts, insights, and model performance.</p>
        <button className="btn btn-primary" type="button" onClick={onJumpToUpload}>Go to Upload</button>
      </div>
    )
  }

  const handleGenerateAIReport = async () => {
    setLoading(true)
    try {
      await syncInsightsDataset(dataset)

      // Collect Context
      const aiInsights = readAiInsights()
      const decisionData = readDecisionInsights()
      const missingPct = (((datasetProfile.missingTotal ?? 0) / Math.max(1, (datasetProfile.rowCount ?? 0) * (datasetProfile.columnCount ?? 0))) * 100).toFixed(1)

      const contextStr = `
DATASET CONTEXT:
Rows: ${datasetProfile.rowCount}, Columns: ${datasetProfile.columnCount}
Missing Data %: ${missingPct}
Numeric Cols: ${datasetProfile.numericColumns?.join(', ')}
Categorical Cols: ${datasetProfile.categoricalColumns?.join(', ')}

PREDICTION CONTEXT:
Task: ${predictionStatus?.preprocess_data?.task_type || 'None'}
Best Model: ${predictionStatus?.best_model_name || 'None'}

DECISION CONTEXT:
${decisionData ? 'Decisions applied and evaluated by AI.' : 'No decisions evaluated.'}
${decisionData?.top_decisions?.map(d => d.decision).join(', ')}

Please generate the report based on this exact context combined with the raw dataset distribution.
`
      const fullPrompt = AI_REPORT_PROMPT + "\n\n" + contextStr

      const res = await generateRecommendationInsights(fullPrompt, 'recommendation_insights')
      const parsed = normalizeReportPayload(res)
      
      if (parsed?.sections?.length > 0) {
        setReportData(parsed)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        addToast('AI Report generated successfully.', null, 'success')
        // Log to MongoDB
        client.post('/user-activities/log', {
          action: 'Report',
          category: 'reports',
          details: dataset?.name || 'Pipeline Report',
          metadata: { sections: parsed.sections.length },
        }).catch(() => {})
      } else {
        throw new Error("Failed to parse report")
      }
    } catch (err) {
      console.error(err)
      addToast(err.message || 'Failed to generate AI Report', null, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!reportData) {
      addToast("Generate the report first!", null, "warning")
      return
    }
    
    setIsGeneratingPdf(true)
    try {
      generateFrontendPdf()
    } catch (error) {
      console.error('Frontend PDF generation failed:', error)
    } finally {
      setIsGeneratingPdf(false)
      onComplete('reports')
    }
  }
  
  function generateFrontendPdf() {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Helper to strip emojis and non-ASCII chars that break jsPDF text
    const cleanText = (str) => {
      if (!str) return ''
      return str.replace(/[^\x00-\x7F]/g, "").trim()
    }
    
    const addPageLayout = (pageNum) => {
      // Full page dark background
      doc.setFillColor(15, 23, 42)
      doc.rect(0, 0, 210, 297, 'F')
      
      // Top Green Header
      doc.setFillColor(32, 201, 151) // Teal / Green
      doc.rect(0, 0, 210, 35, 'F')
      
      // Header text (Black)
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(18)
      doc.setFont(undefined, 'bold')
      doc.text(COMPANY_NAME.toUpperCase(), 15, 22)
      
      doc.setFontSize(12)
      doc.text('End-to-End Analytics Report', 195, 22, { align: 'right' })
    }

    addPageLayout(1)
    
    let yPosition = 50
    const marginX = 15
    
    // Add ASCII Art Intro Block
    doc.setTextColor(150, 150, 150) // Gray
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text('=========================================================', marginX, yPosition)
    yPosition += 7
    doc.text(`     ${COMPANY_NAME.toUpperCase()} — ANALYTICS REPORT`, marginX, yPosition)
    yPosition += 6
    doc.text('     Powered by Datalytics Analytics Platform', marginX, yPosition)
    yPosition += 6
    doc.text('=========================================================', marginX, yPosition)
    yPosition += 10
    
    const generatedDate = new Date().toLocaleString()
    doc.text(`Generated: ${generatedDate}`, marginX, yPosition)
    yPosition += 15
    
    reportData.sections.forEach(sec => {
      if (yPosition > 270) {
        doc.addPage()
        addPageLayout(doc.internal.getNumberOfPages())
        yPosition = 50
      }
      
      // Extract title and remove emojis that break jsPDF
      const titleCleaned = cleanText(sec.title).toUpperCase()
      
      // Render Section Title (Teal color)
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(32, 201, 151) 
      doc.text(titleCleaned, marginX, yPosition)
      yPosition += 8
      
      // Render Content
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(226, 232, 240) // Light grey text
      
      let bodyCleaned = cleanText(sec.text)
      if (!bodyCleaned) bodyCleaned = 'Not performed.'
      
      // Convert list indicators to standard dashes since symbols break
      bodyCleaned = bodyCleaned.replace(/[*]/g, '-')
      
      const textLines = doc.splitTextToSize(bodyCleaned, 180)
      
      textLines.forEach(line => {
        if (yPosition > 275) {
          doc.addPage()
          addPageLayout(doc.internal.getNumberOfPages())
          yPosition = 50
        }
        
        doc.text(line, marginX, yPosition)
        yPosition += 6
      })
      
      yPosition += 8
    })
    
    doc.save(`${COMPANY_NAME.replace(/\s+/g, '_')}_Analytics_Report_${Date.now()}.pdf`)
  }

  async function handleCopy() {
    if (!reportData) return
    await navigator.clipboard.writeText(reportData.rawText)
    addToast("Report copied to clipboard!", null, "success")
    onComplete('reports')
  }

  return (
    <div className="report-container">
      <div className="report-header">
        <div>
          <h2 className="report-title">End-to-End Reporting</h2>
          <p className="report-subtitle">Generate a comprehensive AI report synthesizing all pipeline activities.</p>
        </div>
        <div className="report-download-group">
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleGenerateAIReport}
            disabled={loading}
            style={{ marginRight: '10px' }}
          >
            {loading ? 'AI Generating...' : reportData ? 'Regenerate Report' : 'Generate AI Report'}
          </button>
          {reportData && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleCopy} style={{ marginRight: '10px' }}>Copy</button>
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? 'Building PDF...' : 'Download PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="typing-indicator" style={{ margin: '30px auto' }}>
          <span />
          <span />
          <span />
          <span className="typing-label">The AI Reporting Engine is summarizing your pipeline...</span>
        </div>
      )}

      {reportData && !loading && (
        <div className="insight-grid" style={{ marginTop: '2rem' }}>
          {reportData.sections.map((sec, idx) => (
             <div key={`rep-${idx}`} className="insight-card intelligence-card">
               <div className="intelligence-card-head">
                 <span className="intelligence-chip is-info">{sec.title}</span>
               </div>
               <div className="insight-body" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', marginTop: '0.5rem' }}>
                 {sec.text}
               </div>
             </div>
          ))}
        </div>
      )}
      
      {!reportData && !loading && (
         <div className="insight-card" style={{ marginTop: '2rem', textAlign: 'center', padding: '3rem' }}>
           <p className="text-muted">Click "Generate AI Report" to synthesize your end-to-end dataset journey.</p>
         </div>
      )}
    </div>
  )
}
