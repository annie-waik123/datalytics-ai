export const DEFAULT_DATASET_INTELLIGENCE_PROMPT =
  'Give me full recommendation and insight for this dataset. Include trends, anomalies, comparisons, root causes, predictions, alerts, KPI health, and business decisions in strict JSON.';

function compactNumber(value) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(digits)}%`;
}

function toSentenceList(items) {
  const safeItems = items.filter(Boolean);
  if (!safeItems.length) return '';
  if (safeItems.length === 1) return safeItems[0];
  if (safeItems.length === 2) return `${safeItems[0]} and ${safeItems[1]}`;
  return `${safeItems.slice(0, -1).join(', ')}, and ${safeItems[safeItems.length - 1]}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    return String(value.message || value.title || value.detail || value.action || value.forecast || value.suggestion || '').trim();
  }
  return '';
}

function normalizeInsightItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { type: 'insight', message: item };
  }
  const message = normalizeText(item);
  if (!message) return null;
  return {
    type: item.type || 'insight',
    message,
  };
}

function normalizeRecommendationItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { based_on: 'AI insight', action: item };
  }
  const action = normalizeText(item.action || item.message || item.detail || item.title || item);
  if (!action) return null;
  return {
    based_on: normalizeText(item.based_on || item.reason || item.source || 'AI insight'),
    action,
  };
}

function normalizePredictionItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { metric: 'Forecast', forecast: item, confidence: 'Unknown' };
  }
  const forecast = normalizeText(item.forecast || item.message || item.detail || item);
  if (!forecast) return null;
  return {
    metric: normalizeText(item.metric || item.target || 'Forecast'),
    forecast,
    confidence: normalizeText(item.confidence || item.confidence_level || 'Unknown'),
  };
}

function normalizeAlertItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { level: 'warning', message: item };
  }
  const message = normalizeText(item.message || item.detail || item.title || item);
  if (!message) return null;
  return {
    level: normalizeText(item.level || item.severity || 'warning').toLowerCase() || 'warning',
    message,
  };
}

function normalizeKpiItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { metric: item, status: 'Warning' };
  }
  const metric = normalizeText(item.metric || item.name || item.title || 'KPI');
  if (!metric) return null;
  return {
    metric,
    status: normalizeText(item.status || item.health || 'Warning') || 'Warning',
  };
}

function normalizeDecisionItem(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { suggestion: item };
  }
  const suggestion = normalizeText(item.suggestion || item.action || item.message || item.detail || item);
  if (!suggestion) return null;
  return { suggestion };
}

export function buildFallbackNotice(reason) {
  if (!reason) {
    return 'Using built-in local intelligence. Add NEXT_PUBLIC_GROQ_API_KEY to enable live AI responses.';
  }

  if (/not configured/i.test(reason)) {
    return 'Using built-in local intelligence because no Groq API key is configured. Add NEXT_PUBLIC_GROQ_API_KEY to enable live AI responses.';
  }

  if (/invalid api key/i.test(reason)) {
    return 'Using built-in local intelligence because Groq rejected the current API key. Update NEXT_PUBLIC_GROQ_API_KEY to re-enable live AI responses.';
  }

  return `Using built-in local intelligence because Groq is unavailable right now (${reason}).`;
}

export function normalizeIntelligencePayload(payload, meta = {}) {
  const anomalies = asArray(payload?.anomalies).map((item) => normalizeInsightItem(
    typeof item === 'string' ? { type: 'anomaly', message: item } : { ...item, type: item?.type || 'anomaly' }
  )).filter(Boolean);

  const recommendations = [
    ...asArray(payload?.recommendations).map(normalizeRecommendationItem),
    ...asArray(payload?.quality_recs).map((item) => normalizeRecommendationItem({ based_on: 'Data quality', action: item })),
  ].filter(Boolean);

  return {
    summary: normalizeText(payload?.summary || payload?.exec_summary || 'No summary available.'),
    insights: [
      ...asArray(payload?.insights).map(normalizeInsightItem),
      ...anomalies,
    ].filter(Boolean),
    recommendations,
    predictions: asArray(payload?.predictions).map(normalizePredictionItem).filter(Boolean),
    alerts: asArray(payload?.alerts).map(normalizeAlertItem).filter(Boolean),
    kpi_status: asArray(payload?.kpi_status).map(normalizeKpiItem).filter(Boolean),
    decisions: asArray(payload?.decisions).map(normalizeDecisionItem).filter(Boolean),
    source: meta.source || payload?.source || 'groq',
    notice: meta.notice || payload?.notice || '',
    prompt_used: meta.promptUsed || payload?.prompt_used || DEFAULT_DATASET_INTELLIGENCE_PROMPT,
  };
}

function buildSystemPrompt() {
  return [
    'You are an Advanced AI Data Intelligence Engine for a Recommendations & Insights section.',
    'Analyze CSV or JSON/API-style dataset summaries with minimal visualization and maximum business intelligence.',
    'Use only the provided dataset summary. Do not invent columns, dates, values, or external facts.',
    'Keep every message concise, business-focused, and directly data-backed.',
    'If evidence is insufficient, say so briefly inside the relevant item rather than guessing.',
    'Return valid JSON only with this exact top-level shape:',
    '{',
    '  "summary": "string",',
    '  "insights": [{"type": "trend|drop|comparison|anomaly|root_cause|what_if|behavior|external", "message": "string"}],',
    '  "recommendations": [{"based_on": "string", "action": "string"}],',
    '  "predictions": [{"metric": "string", "forecast": "string", "confidence": "string"}],',
    '  "alerts": [{"level": "critical|warning|info", "message": "string"}],',
    '  "kpi_status": [{"metric": "string", "status": "Good|Warning|Critical"}],',
    '  "decisions": [{"suggestion": "string"}]',
    '}',
    'Do not include markdown, code fences, or explanatory text outside the JSON object.',
    'Prefer 4-8 insights, 4-8 recommendations, 1-4 predictions, 0-4 alerts, 3-6 KPI items, and 2-5 decisions.',
  ].join(' ');
}

export function buildDatasetIntelligenceMessages(summary, userPrompt = DEFAULT_DATASET_INTELLIGENCE_PROMPT) {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(),
    },
    {
      role: 'user',
      content: `${userPrompt}\n\nDataset summary:\n${JSON.stringify(summary)}`,
    },
  ];
}

function getMissingColumns(summary, limit = 3) {
  const rows = Math.max(Number(summary?.rows) || 0, 1);
  return Object.entries(summary?.missing || {})
    .map(([column, count]) => ({
      column,
      count: Number(count) || 0,
      pct: ((Number(count) || 0) / rows) * 100,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

function getLeadingTrend(summary) {
  return asArray(summary?.time_series)[0] || null;
}

function getLeadingBreakdown(summary) {
  return asArray(summary?.category_breakdowns)[0] || null;
}

function getLeadingCorrelation(summary) {
  return asArray(summary?.correlation_pairs)[0] || null;
}

function getOutlierLeader(summary) {
  const stats = summary?.numeric_stats || {};
  return Object.entries(summary?.outliers || {})
    .map(([column, count]) => {
      const denominator = Math.max(Number(stats?.[column]?.count) || 0, 1);
      return {
        column,
        count: Number(count) || 0,
        pct: ((Number(count) || 0) / denominator) * 100,
      };
    })
    .sort((left, right) => right.pct - left.pct)[0] || null;
}

function toStatus(score) {
  if (score >= 80) return 'Good';
  if (score >= 55) return 'Warning';
  return 'Critical';
}

function estimateForecast(points = []) {
  if (points.length < 3) return null;
  const deltas = [];
  for (let index = 1; index < points.length; index += 1) {
    deltas.push(Number(points[index].value) - Number(points[index - 1].value));
  }
  const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  const lastValue = Number(points[points.length - 1].value);
  const nextValue = lastValue + averageDelta;
  const avgAbsDelta = deltas.reduce((sum, value) => sum + Math.abs(value), 0) / deltas.length;
  const variance = deltas.reduce((sum, value) => sum + Math.pow(value - averageDelta, 2), 0) / deltas.length;
  const volatility = Math.sqrt(variance);
  const signal = avgAbsDelta <= 0.0001 ? 1 : Math.max(0, 1 - (volatility / (avgAbsDelta + 1)));
  const confidence = Math.max(52, Math.min(92, Math.round(56 + (points.length * 3) + signal * 24)));

  return {
    nextValue,
    averageDelta,
    confidence,
  };
}

export function buildLocalIntelligence(summary, userPrompt = DEFAULT_DATASET_INTELLIGENCE_PROMPT, reason = '') {
  const missingColumns = getMissingColumns(summary, 3);
  const leadingTrend = getLeadingTrend(summary);
  const leadingBreakdown = getLeadingBreakdown(summary);
  const leadingCorrelation = getLeadingCorrelation(summary);
  const outlierLeader = getOutlierLeader(summary);
  const duplicateRows = Number(summary?.duplicate_rows) || 0;
  const totalRows = Math.max(Number(summary?.rows) || 0, 1);
  const missingTotal = Number(summary?.missing_total) || missingColumns.reduce((sum, item) => sum + item.count, 0);
  const completenessPct = Math.max(0, 100 - ((missingTotal / Math.max(totalRows * Math.max(Number(summary?.columns) || 1, 1), 1)) * 100));
  const duplicatePct = (duplicateRows / totalRows) * 100;

  const insights = [];
  const recommendations = [];
  const predictions = [];
  const alerts = [];
  const kpiStatus = [];
  const decisions = [];

  if (leadingTrend) {
    const directionWord = leadingTrend.delta >= 0 ? 'increased' : 'decreased';
    insights.push({
      type: leadingTrend.delta >= 0 ? 'trend' : 'drop',
      message: `${leadingTrend.value_column} ${directionWord} by ${formatPercent(Math.abs(leadingTrend.delta_pct || 0), 1)} in the latest ${leadingTrend.date_column} period.`,
    });
    recommendations.push({
      based_on: `${leadingTrend.value_column} ${directionWord}`,
      action: leadingTrend.delta >= 0
        ? `Identify what is driving the recent ${leadingTrend.value_column} lift and replicate it in similar periods or segments.`
        : `Review the most recent ${leadingTrend.date_column} period to find what changed in ${leadingTrend.value_column} before the decline deepens.`,
    });

    const forecast = estimateForecast(leadingTrend.points || []);
    if (forecast) {
      const changePct = leadingTrend.last_value === 0 ? 0 : ((forecast.nextValue - leadingTrend.last_value) / Math.abs(leadingTrend.last_value || 1)) * 100;
      predictions.push({
        metric: leadingTrend.value_column,
        forecast: `Next ${leadingTrend.date_column} period is expected to land near ${compactNumber(forecast.nextValue)} (${changePct >= 0 ? '+' : ''}${formatPercent(changePct, 1)} vs current run-rate).`,
        confidence: `${forecast.confidence}%`,
      });
    }

    if (leadingTrend.delta_pct <= -15) {
      alerts.push({
        level: 'critical',
        message: `ALERT: ${leadingTrend.value_column} dropped by ${formatPercent(Math.abs(leadingTrend.delta_pct), 1)} in the latest ${leadingTrend.date_column} period.`,
      });
    } else if (leadingTrend.delta_pct >= 25) {
      alerts.push({
        level: 'warning',
        message: `ALERT: ${leadingTrend.value_column} spiked by ${formatPercent(leadingTrend.delta_pct, 1)} in the latest ${leadingTrend.date_column} period.`,
      });
    }
  }

  if (leadingBreakdown?.leader && leadingBreakdown?.runner_up) {
    const ratio = leadingBreakdown.spread_ratio || 0;
    insights.push({
      type: 'comparison',
      message: `${leadingBreakdown.leader.label} outperforms ${leadingBreakdown.runner_up.label} by ${ratio ? `${ratio.toFixed(1)}x` : 'a clear margin'} on ${leadingBreakdown.value_column}.`,
    });
    recommendations.push({
      based_on: `${leadingBreakdown.group_column} performance gap`,
      action: `Prioritize the playbook used by ${leadingBreakdown.leader.label} and test it against weaker ${leadingBreakdown.group_column} segments.`,
    });

    const impactPct = (leadingBreakdown.leader_share || 0) * 10 * 100;
    insights.push({
      type: 'what_if',
      message: `If ${leadingBreakdown.leader.label} improves another 10%, overall ${leadingBreakdown.value_column} could move by roughly ${formatPercent(impactPct, 1)} based on its current share.`,
    });
    decisions.push({
      suggestion: `Invest more in ${leadingBreakdown.leader.label} while building a recovery plan for weaker ${leadingBreakdown.group_column} segments.`,
    });
  }

  if (leadingCorrelation && Math.abs(Number(leadingCorrelation.value)) >= 0.6) {
    insights.push({
      type: 'root_cause',
      message: `${leadingCorrelation.left} and ${leadingCorrelation.right} move together strongly (correlation ${Number(leadingCorrelation.value).toFixed(2)}), making them a likely shared driver pair.`,
    });
    recommendations.push({
      based_on: `${leadingCorrelation.left} x ${leadingCorrelation.right} correlation`,
      action: `Track ${leadingCorrelation.left} and ${leadingCorrelation.right} together in the same operating review so changes in one are not interpreted in isolation.`,
    });
  }

  if (missingColumns.length) {
    insights.push({
      type: 'anomaly',
      message: `Missing data is concentrated in ${toSentenceList(missingColumns.map((item) => `${item.column} (${formatPercent(item.pct, 1)})`))}.`,
    });
    recommendations.push({
      based_on: 'Missing-value concentration',
      action: `Apply validation or imputation rules to ${toSentenceList(missingColumns.map((item) => item.column))} before using this dataset for automation or executive reporting.`,
    });
    if (missingColumns[0].pct >= 15) {
      alerts.push({
        level: 'critical',
        message: `ALERT: ${missingColumns[0].column} is missing in ${formatPercent(missingColumns[0].pct, 1)} of records.`,
      });
    }
  }

  if (outlierLeader?.pct >= 5) {
    insights.push({
      type: 'anomaly',
      message: `${outlierLeader.column} contains unusually high-value variance with ${formatPercent(outlierLeader.pct, 1)} suspected outliers.`,
    });
    recommendations.push({
      based_on: `${outlierLeader.column} outlier exposure`,
      action: `Review extreme ${outlierLeader.column} records for bad units, duplicate events, or genuine high-value cases before forecasting from this field.`,
    });
  }

  if (duplicateRows > 0) {
    insights.push({
      type: 'root_cause',
      message: `${duplicateRows} duplicate rows were detected, which can distort aggregates and KPI trend comparisons.`,
    });
    recommendations.push({
      based_on: 'Duplicate row risk',
      action: 'Deduplicate repeated records before publishing KPI packs or downstream model outputs.',
    });
  }

  if (summary?.external_context) {
    insights.push({
      type: 'external',
      message: 'External API context is attached to this dataset summary, so business interpretation should consider those outside signals alongside the raw metrics.',
    });
  }

  if (summary?.user_behavior) {
    const focusMetric = normalizeText(summary.user_behavior.focus_metric || summary.user_behavior.primary_metric || summary.user_behavior);
    if (focusMetric) {
      insights.push({
        type: 'behavior',
        message: `User activity suggests frequent focus on ${focusMetric}, so recommendations should prioritize that metric first.`,
      });
      decisions.push({
        suggestion: `Surface ${focusMetric} higher in summaries because it appears to be the most-used decision metric.`,
      });
    }
  }

  const trendHealthScore = !leadingTrend
    ? 70
    : leadingTrend.delta_pct >= 0
      ? Math.min(95, 75 + Math.min(leadingTrend.delta_pct, 20))
      : Math.max(20, 75 - Math.min(Math.abs(leadingTrend.delta_pct), 40));
  const completenessScore = Math.max(10, Math.min(100, completenessPct));
  const duplicateScore = Math.max(10, Math.min(100, 100 - duplicatePct * 5));
  const stabilityScore = outlierLeader ? Math.max(20, 100 - outlierLeader.pct * 4) : 82;

  kpiStatus.push(
    { metric: 'Data Completeness', status: toStatus(completenessScore) },
    { metric: 'Duplicate Integrity', status: toStatus(duplicateScore) },
    { metric: leadingTrend?.value_column || 'Trend Stability', status: toStatus(trendHealthScore) },
    { metric: outlierLeader?.column || 'Outlier Stability', status: toStatus(stabilityScore) },
  );

  if (leadingBreakdown?.value_column) {
    const dominanceScore = leadingBreakdown.spread_ratio && leadingBreakdown.spread_ratio > 2 ? 88 : 68;
    kpiStatus.push({
      metric: `${leadingBreakdown.group_column} Performance`,
      status: toStatus(dominanceScore),
    });
  }

  if (leadingTrend && leadingTrend.delta_pct < 0) {
    decisions.push({
      suggestion: `Protect ${leadingTrend.value_column} first, because the latest ${leadingTrend.date_column} movement is negative and could affect downstream KPIs.`,
    });
  }

  if (missingColumns.length) {
    decisions.push({
      suggestion: 'Clean the highest-missing fields before relying on this dataset for automated recommendations or predictive workflows.',
    });
  }

  if (!decisions.length) {
    decisions.push({
      suggestion: 'Maintain the current operating approach while monitoring the leading trend and segment performance shifts.',
    });
  }

  const summaryText = [
    `${summary?.name || 'This dataset'} contains ${Number(summary?.rows) || 0} rows across ${Number(summary?.columns) || 0} columns.`,
    leadingTrend
      ? `${leadingTrend.value_column} is the clearest current movement signal, with a ${leadingTrend.delta >= 0 ? 'positive' : 'negative'} shift of ${formatPercent(Math.abs(leadingTrend.delta_pct || 0), 1)} in the latest ${leadingTrend.date_column} period.`
      : 'No reliable time trend was detected from the available date fields.',
    leadingBreakdown?.leader
      ? `${leadingBreakdown.leader.label} is currently the strongest ${leadingBreakdown.group_column} segment for ${leadingBreakdown.value_column}.`
      : 'No strong segment dominance was detected from the available categorical fields.',
    missingColumns.length
      ? `The main data quality risk sits in ${toSentenceList(missingColumns.map((item) => item.column))}.`
      : 'Data quality looks stable enough for business interpretation from a missing-value perspective.',
  ].join(' ');

  return normalizeIntelligencePayload(
    {
      summary: summaryText,
      insights: insights.slice(0, 8),
      recommendations: recommendations.slice(0, 8),
      predictions: predictions.slice(0, 4),
      alerts: alerts.slice(0, 4),
      kpi_status: kpiStatus.slice(0, 6),
      decisions: decisions.slice(0, 5),
    },
    {
      source: 'local',
      notice: buildFallbackNotice(reason),
      promptUsed: userPrompt,
    }
  );
}
