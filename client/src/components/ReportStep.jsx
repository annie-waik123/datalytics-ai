import { useEffect, useState, useMemo } from 'react'
import jsPDF from 'jspdf'
import { generateRecommendationInsights, syncInsightsDataset } from '../api/insights.js'
import { useToast } from '../hooks/useToast.js'
import client from '../api/client.js'
import { saveIndustryPdf } from '../utils/industryPdf.js'
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

const AI_STORY_PROMPT = `You are an expert Data Storyteller and Business Analyst.
Your task is to transform the dataset and analytical findings into a HIGHLY DETAILED, captivating, and comprehensive narrative-driven business story.
The story MUST be long, expansive, and deeply analytical (at least 800-1000 words).
DO NOT use any bullet points or short lists. Write strictly in flowing, beautifully structured paragraphs.

Structure it like a premium executive editorial:
- Catchy Title: A compelling, magazine-style headline.
- The Hook: Set the stage, explain the macro environment, and state the big picture.
- The Journey: Dive deep into the data exploration. What hidden patterns emerged? What were the surprises? Walk the reader through the metrics in paragraph form.
- The Climax: Highlight the most critical insight, bottleneck, or anomaly discovered in the data. Why does this matter profoundly?
- The Resolution: Provide expansive, strategic recommendations. What must the business do tomorrow, next month, and next year based on this data?

Make it sound human, highly insightful, strategic, and profoundly detailed. Use markdown headings (##) for sections.`

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
  let content = response?.generated_response?.content || response?.content || response?.answer || response?.generated_response?.answer || ''
  if (!content) return { sections: [] }
  
  // Clean up potential markdown blocks if AI wrapped the whole thing
  content = content.replace(/^```[a-z]*\n/i, '').replace(/\n```$/, '')
  
  const sections = []
  const parts = content.split(/===\s*(.*?)\s*===/)
  
  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim()
    let text = (parts[i+1] || '').replace(/={10,}/g, '').trim()
    
    // Clean up bold/italic markdown for cleaner UI display
    text = text.replace(/\*\*(.*?)\*\*/g, '$1')
    text = text.replace(/\*(.*?)\*/g, '$1')
    text = text.replace(/__(.*?)__/g, '$1')
    text = text.replace(/_(.*?)_/g, '$1')
    text = text.replace(/^#+\s+/gm, '') // Remove headers
    
    sections.push({ title, text })
  }
  
  if (sections.length === 0) {
    // If no section markers found, try to clean up the raw text
    let cleanRaw = content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    sections.push({ title: "Professional Report", text: cleanRaw })
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
  onBeforeGenerate,
  onJumpToUpload,
}) {
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false)
  const [loadingStory, setLoadingStory] = useState(false)
  const [storyContent, setStoryContent] = useState('')

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
    if (loading) return
    const charged = await onBeforeGenerate?.()
    if (charged === false) return

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

  const handleGenerateStory = async () => {
    setLoadingStory(true)
    setStoryContent('')
    try {
      await syncInsightsDataset(dataset)
      const decisionData = readDecisionInsights()
      const contextStr = `
DATASET CONTEXT: Rows: ${datasetProfile.rowCount}, Columns: ${datasetProfile.columnCount}
DECISIONS: ${decisionData?.top_decisions?.map(d => d.decision).join(', ') || 'None'}
`
      const fullPrompt = AI_STORY_PROMPT + "\n\n" + contextStr
      const res = await generateRecommendationInsights(fullPrompt, 'recommendation_insights')
      const content = res?.generated_response?.content || res?.content || res?.answer || 'Failed to generate story.'
      setStoryContent(content)
      client.post('/user-activities/log', {
        action: 'Report',
        category: 'reports',
        details: 'Generated Data Story',
        metadata: {},
      }).catch(() => {})
    } catch (err) {
      addToast(err.message || 'Failed to generate story', null, 'error')
    } finally {
      setLoadingStory(false)
    }
  }

  const handleDownloadStoryPdf = () => {
    if (!storyContent) return
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, 210, 297, 'F')
    
    doc.setFillColor(34, 197, 94)
    doc.rect(0, 0, 210, 35, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text('DATA NARRATIVE STORY', 15, 22)
    
    let yPosition = 50
    const marginX = 15
    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(226, 232, 240)
    
    const lines = storyContent.split('\n')
    lines.forEach(line => {
      let text = line.replace(/\*\*/g, '').replace(/#/g, '').trim()
      if (!text) { yPosition += 6; return }
      
      if (yPosition > 270) {
        doc.addPage()
        doc.setFillColor(15, 23, 42)
        doc.rect(0, 0, 210, 297, 'F')
        yPosition = 20
      }
      
      const textLines = doc.splitTextToSize(text, 180)
      textLines.forEach(l => {
        if (yPosition > 280) {
          doc.addPage()
          doc.setFillColor(15, 23, 42)
          doc.rect(0, 0, 210, 297, 'F')
          yPosition = 20
        }
        doc.text(l, marginX, yPosition)
        yPosition += 7
      })
      yPosition += 4
    })
    
    doc.save(`Data_Story_${Date.now()}.pdf`)
  }

  useEffect(() => {
    if (isStoryModalOpen && !storyContent && !loadingStory) {
      handleGenerateStory()
    }
  }, [isStoryModalOpen])

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
    saveIndustryPdf({
      title: 'End-to-End Analytics Report',
      subtitle: 'Complete stakeholder-ready report across upload, EDA, preparation, modeling, insights, and decisions.',
      datasetName: dataset?.name,
      filePrefix: `${COMPANY_NAME}_Analytics_Report`,
      metrics: [
        { label: 'Rows', value: (datasetProfile?.totalRowCount || datasetProfile?.rowCount || 0).toLocaleString() },
        { label: 'Columns', value: String(datasetProfile?.totalColumnCount || datasetProfile?.columnCount || 0) },
        { label: 'Missing Cells', value: String(datasetProfile?.missingTotal || 0) },
        { label: 'Sections', value: String(reportData.sections?.length || 0) },
        { label: 'Numeric Columns', value: String(datasetProfile?.numericColumns?.length || 0) },
        { label: 'Saved Charts', value: String(savedCharts?.length || 0) },
      ],
      sections: reportData.sections?.map((section) => ({
        title: section.title,
        body: section.text || 'Not performed.',
      })),
    })
    return

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
          <span className="report-story-action">
            <span className="report-beta-badge">Beta</span>
            <button 
              type="button" 
              className="btn btn-secondary report-story-btn" 
              onClick={() => setIsStoryModalOpen(true)}
            >
              ✨ Auto Story Generator
            </button>
          </span>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleGenerateAIReport}
            disabled={loading}
          >
            {loading ? 'AI Generating...' : reportData ? 'Regenerate Report' : 'Generate AI Report'}
          </button>
          {reportData && (
            <>
              <button type="button" className="btn btn-primary" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? 'Building PDF...' : 'Download PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-8 gap-3 text-slate-400" style={{ margin: '30px auto' }}>
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Synthesizing report...</span>
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

      {isStoryModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(16px)', zIndex: 99999,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px'
        }}>
          {/* Main Modal Box */}
          <div style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: '24px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 40px rgba(34, 197, 94, 0.05)',
            width: '100%',
            maxWidth: '1200px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header Bar */}
            <div style={{ 
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '20px 40px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              <div>
                <span style={{ 
                  color: '#4ade80', fontWeight: 'bold', letterSpacing: '0.15em', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                  EIGHTEEN AI NARRATIVE
                  <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', letterSpacing: 'normal' }}>BETA</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {!loadingStory && storyContent && (
                  <button 
                    onClick={handleDownloadStoryPdf} 
                    style={{ 
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', color: 'white', 
                      padding: '8px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                      boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)', transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform='translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform='translateY(0)'}
                  >
                    Download PDF
                  </button>
                )}
                <button 
                  onClick={() => setIsStoryModalOpen(false)} 
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                    color: 'white', padding: '8px 24px', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 'bold', transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                >
                  Close
                </button>
              </div>
            </div>
            
            {/* Scrollable Content Area */}
            <div style={{ 
              flex: 1, overflowY: 'auto', padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center'
            }}>
              <div style={{ maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                  <h1 style={{ 
                    fontSize: '3.5rem', margin: '0', color: '#4ade80', lineHeight: '1.2',
                    fontFamily: 'Georgia, serif', paddingBottom: '10px'
                  }}>
                    The Story of Your Data
                  </h1>
                  <div style={{ width: '60px', height: '4px', background: 'linear-gradient(90deg, #22c55e, transparent)', margin: '20px auto 0' }} />
                </div>
                
                {loadingStory ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px', flex: 1 }}>
                    <div style={{ 
                      width: '64px', height: '64px', borderRadius: '50%', border: '4px solid rgba(34, 197, 94, 0.2)', 
                      borderTopColor: '#4ade80', animation: 'spin 1s linear infinite' 
                    }}></div>
                    <p style={{ color: '#4ade80', fontStyle: 'italic', fontSize: '1.2rem', fontFamily: 'Georgia, serif' }}>Weaving the narrative threads...</p>
                  </div>
                ) : (
                  <div className="story-content" style={{ 
                    color: '#e2e8f0', fontSize: '1.2rem', lineHeight: '1.9', fontFamily: 'Georgia, serif', flex: 1
                  }}>
                    {storyContent.split('\n').map((para, i) => {
                      if (!para.trim()) return <div key={i} style={{ height: '1.5rem' }}></div>;
                      if (para.startsWith('###') || para.startsWith('##') || para.startsWith('#')) {
                        return <h3 key={i} style={{ 
                          color: '#fff', marginTop: '3rem', marginBottom: '1.2rem', 
                          fontFamily: 'Inter, sans-serif', fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.02em'
                        }}>{para.replace(/#/g, '').trim()}</h3>;
                      }
                      return <p key={i} style={{ marginBottom: '1.8rem', color: 'rgba(255,255,255,0.85)' }}>{para.replace(/\*\*/g, '').trim()}</p>;
                    })}
                  </div>
                )}
                
                {!loadingStory && storyContent && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '40px', paddingBottom: '20px' }}>
                    <button 
                      onClick={handleGenerateStory} 
                      style={{ 
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', 
                        color: '#94a3b8', padding: '10px 24px', borderRadius: '30px', cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: '600'
                      }} 
                      onMouseOver={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#fff'; }} 
                      onMouseOut={(e) => { e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='#94a3b8'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
                      Regenerate Narrative
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
