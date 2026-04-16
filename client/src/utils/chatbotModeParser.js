const SECTION_HEADER_RE = /^\s*\**\s*\d+\.\s+\**\s*(.+?)\s*\**:\s*\**\s*$/
const BULLET_RE = /^\s*[-*]\s+(.*\S)\s*$/

function normalizeSectionTitle(title) {
  return String(title || '').replace(/\**/g, '').trim().toLowerCase()
}

function splitSections(content) {
  const sections = {}
  let currentTitle = ''

  String(content || '')
    .replace(/\r/g, '')
    .split('\n')
    .forEach((line) => {
      const headerMatch = line.match(SECTION_HEADER_RE)
      if (headerMatch) {
        currentTitle = normalizeSectionTitle(headerMatch[1])
        sections[currentTitle] = sections[currentTitle] || []
        return
      }

      if (!currentTitle) return
      sections[currentTitle].push(line)
    })

  return sections
}

function sectionItems(lines = []) {
  const items = []
  let paragraphBuffer = []

  lines.forEach((line) => {
    const trimmed = String(line || '').trim()
    if (!trimmed) {
      if (paragraphBuffer.length) {
        items.push(paragraphBuffer.join(' ').trim())
        paragraphBuffer = []
      }
      return
    }

    const bulletMatch = trimmed.match(BULLET_RE)
    if (bulletMatch) {
      if (paragraphBuffer.length) {
        items.push(paragraphBuffer.join(' ').trim())
        paragraphBuffer = []
      }
      items.push(bulletMatch[1].trim())
      return
    }

    paragraphBuffer.push(trimmed)
  })

  if (paragraphBuffer.length) {
    items.push(paragraphBuffer.join(' ').trim())
  }

  return items.filter(Boolean)
}

function buildNotice(source) {
  if (source === 'groq') {
    return 'Using backend recommendation_insights generation with Groq.'
  }

  if (source === 'local_fallback') {
    return 'Using backend recommendation_insights generation with local fallback because Groq is not configured.'
  }

  return 'Using backend recommendation_insights generation.'
}

export function normalizeRecommendationPayload(response, datasetName = 'Dataset') {
  const generated = response?.generated_response || response || {}
  const content = String(generated.content || response?.content || '').trim()
  const source = String(generated.source || response?.source || '').trim().toLowerCase()

  // Try parsing content as JSON first
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        dataset_name: datasetName,
        summary: parsed.summary || 'No summary available.',
        insights: (parsed.insights || []).map(i => ({ type: i.type || 'insight', message: i.message })),
        recommendations: (parsed.recommendations || []).map(r => ({ based_on: r.based_on || 'Analysis', action: r.action })),
        predictions: (parsed.predictions || []).map(p => ({ metric: p.metric, forecast: p.forecast, confidence: p.confidence })),
        alerts: (parsed.alerts || []).map(a => ({ level: a.level || 'info', message: a.message })),
        kpi_status: (parsed.kpi_status || []).map(k => ({ metric: k.metric, status: k.status || 'warning' })),
        decisions: (parsed.decisions || []).map(d => ({ suggestion: d.suggestion })),
        notice: buildNotice(source),
        source,
        raw_content: content,
        generated_response: generated,
      }
    }
  } catch (e) {
    console.warn("Failed to parse AI response as JSON, falling back to regex", e)
  }

  const sections = splitSections(content)
  const findings = sectionItems(sections['key findings'])
  const problems = sectionItems(sections['business problems'])
  const recommendations = sectionItems(sections['strategic recommendations'])
  const opportunities = sectionItems(sections['opportunities'])
  const risks = sectionItems(sections['risk analysis'])
  const finalSummary = sectionItems(sections['final summary'])

  const parsedPayload = {
    dataset_name: datasetName,
    summary: finalSummary.join(' ') || content || 'No summary available.',
    insights: [
      ...findings.map((message) => ({ type: 'finding', message })),
      ...problems.map((message) => ({ type: 'problem', message })),
      ...opportunities.map((message) => ({ type: 'opportunity', message })),
      ...risks.map((message) => ({ type: 'risk', message })),
    ],
    recommendations: recommendations.map((action) => ({
      based_on: 'Strategic recommendation',
      action,
    })),
    predictions: [],
    alerts: risks.map((message) => ({
      level: 'warning',
      message,
    })),
    kpi_status: [],
    decisions: finalSummary.map((suggestion) => ({ suggestion })),
    notice: buildNotice(source),
    source,
    raw_content: content,
    generated_response: generated,
  }

  if (!parsedPayload.insights.length && content) {
    parsedPayload.insights = [{ type: 'recommendation_insights', message: content }]
  }

  return parsedPayload
}
