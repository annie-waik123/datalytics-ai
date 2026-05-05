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

function buildNotice(source, provider = '') {
  if (source === 'local_fallback') {
    return 'Using backend recommendation_insights generation with local fallback because no live AI provider is configured.'
  }

  const label = String(provider || source || '').trim()
  if (label) {
    return `Using backend recommendation_insights generation with ${label.replace(/[_-]+/g, ' ')}.`
  }

  return 'Using backend recommendation_insights generation.'
}

export function normalizeRecommendationPayload(response, datasetName = 'Dataset') {
  const generated = response?.generated_response || response || {}
  let content = String(generated.content || response?.content || response?.answer || generated.answer || '').trim()
  const source = String(generated.source || response?.source || '').trim().toLowerCase()
  const provider = String(generated.provider || response?.provider || '').trim().toLowerCase()

  // Helper to safely extract a field from truncated JSON string
  const extractField = (str, field) => {
    const regex = new RegExp(`"${field}"\\s*:\\s*"(.*?)(?:"|$)`, 'i')
    const match = str.match(regex)
    return match ? match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : null
  }

  // Try parsing content as JSON first
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      let jsonStr = jsonMatch[0]
      
      // Attempt to fix truncated JSON by adding closing brackets
      let openBraces = (jsonStr.match(/\{/g) || []).length
      let closeBraces = (jsonStr.match(/\}/g) || []).length
      let openBrackets = (jsonStr.match(/\[/g) || []).length
      let closeBrackets = (jsonStr.match(/\]/g) || []).length
      
      if (openBraces > closeBraces) jsonStr += '}'.repeat(openBraces - closeBraces)
      if (openBrackets > closeBrackets) jsonStr += ']'.repeat(openBrackets - closeBrackets)

      try {
        const parsed = JSON.parse(jsonStr)
        return {
          dataset_name: datasetName,
          summary: parsed.summary || 'No summary available.',
          insights: (parsed.insights || []).map(i => ({ type: i.type || 'insight', message: i.message })),
          recommendations: (parsed.recommendations || []).map(r => ({ based_on: r.based_on || 'Analysis', action: r.action })),
          predictions: (parsed.predictions || []).map(p => ({ metric: p.metric, forecast: p.forecast, confidence: p.confidence })),
          alerts: (parsed.alerts || []).map(a => ({ level: a.level || 'info', message: a.message })),
          kpi_status: (parsed.kpi_status || []).map(k => ({ metric: k.metric, status: k.status || 'warning' })),
          decisions: (parsed.decisions || []).map(d => ({ suggestion: d.suggestion })),
          notice: buildNotice(source, provider),
          source,
          provider,
          raw_content: content,
          generated_response: generated,
        }
      } catch (e) {
        // If JSON.parse still fails, try manual extraction for at least the summary
        const summary = extractField(content, 'summary')
        if (summary) {
          return {
            dataset_name: datasetName,
            summary: summary,
            insights: [{ type: 'AI Insights', message: 'The AI response was partially truncated but summary was recovered.' }],
            recommendations: [],
            predictions: [],
            alerts: [],
            kpi_status: [],
            decisions: [],
            notice: buildNotice(source, provider) + ' (Partially Recovered)',
            source,
            provider,
            raw_content: content,
            generated_response: generated,
          }
        }
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
    notice: buildNotice(source, provider),
    source,
    provider,
    raw_content: content,
    generated_response: generated,
  }

  if (!parsedPayload.insights.length && content) {
    parsedPayload.insights = [{ type: 'recommendation_insights', message: content }]
  }

  return parsedPayload
}
