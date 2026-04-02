import {
  DEFAULT_DATASET_INTELLIGENCE_PROMPT,
  buildDatasetIntelligenceMessages as buildDatasetIntelligencePromptMessages,
  buildLocalIntelligence as buildLocalStructuredIntelligence,
  normalizeIntelligencePayload as normalizeDatasetIntelligencePayload,
} from "./aiIntelligence.js";

const GROQ_API_KEY = process.env.NEXT_PUBLIC_GROQ_API_KEY?.trim() || "";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-70b-8192";

function hasConfiguredGroqKey() {
  return Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "YOUR_GROQ_API_KEY_HERE";
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function toSentenceList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

function normalizeInsightPayload(payload, meta = {}) {
  return {
    insights: Array.isArray(payload?.insights) ? payload.insights.filter(Boolean) : [],
    quality_recs: Array.isArray(payload?.quality_recs) ? payload.quality_recs.filter(Boolean) : [],
    anomalies: Array.isArray(payload?.anomalies) ? payload.anomalies.filter(Boolean) : [],
    exec_summary: payload?.exec_summary || "No executive summary returned.",
    source: meta.source || payload?.source || "groq",
    notice: meta.notice || payload?.notice || "",
  };
}

function parseGroqError(detail) {
  if (!detail) return "Groq API error";
  try {
    const parsed = JSON.parse(detail);
    return parsed?.error?.message || detail;
  } catch {
    return detail;
  }
}

async function groqRequest(payload) {
  if (!hasConfiguredGroqKey()) {
    throw new Error("Groq API key is not configured.");
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(parseGroqError(detail));
  }

  return response.json();
}

function safeJsonParse(content) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function getSchemaCounts(summary) {
  const entries = Object.entries(summary?.types || {});
  const numeric = entries.filter(([, type]) => type === "number").map(([name]) => name);
  const dates = entries.filter(([, type]) => type === "date").map(([name]) => name);
  const categorical = entries
    .filter(([, type]) => type !== "number" && type !== "date")
    .map(([name]) => name);

  return { numeric, dates, categorical };
}

function getTopMissing(summary, limit = 3) {
  const rows = Math.max(summary?.rows || 0, 1);
  return Object.entries(summary?.missing || {})
    .map(([name, count]) => ({
      name,
      count,
      pct: count / rows,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function getNumericHighlights(summary, limit = 3) {
  return Object.entries(summary?.numeric_stats || {})
    .map(([name, stats]) => {
      const min = Number(stats?.min);
      const max = Number(stats?.max);
      const mean = Number(stats?.mean);
      const std = Number(stats?.std);
      const median = Number(stats?.median);
      const range = Number.isFinite(min) && Number.isFinite(max) ? max - min : 0;
      const coeffVar = Number.isFinite(mean) && Math.abs(mean) > 0.0001 ? std / Math.abs(mean) : 0;
      return {
        name,
        min,
        max,
        mean,
        std,
        median,
        range,
        coeffVar,
        zeroVariance: Number.isFinite(std) ? std === 0 : false,
      };
    })
    .sort((a, b) => b.range - a.range)
    .slice(0, limit);
}

function getCategoricalHighlights(summary, limit = 2) {
  return Object.entries(summary?.categorical_top_values || {})
    .map(([name, values]) => ({
      name,
      values: Array.isArray(values) ? values.filter(Boolean).slice(0, 4) : [],
    }))
    .filter((item) => item.values.length > 0)
    .slice(0, limit);
}

function buildFallbackNotice(reason) {
  if (!reason) {
    return "Using built-in local analysis. Add NEXT_PUBLIC_GROQ_API_KEY to enable live Groq responses.";
  }

  if (/not configured/i.test(reason)) {
    return "Using built-in local analysis because no Groq API key is configured. Add NEXT_PUBLIC_GROQ_API_KEY to enable live Groq responses.";
  }

  if (/invalid api key/i.test(reason)) {
    return "Using built-in local analysis because Groq rejected the current API key. Update NEXT_PUBLIC_GROQ_API_KEY to re-enable live responses.";
  }

  return `Using built-in local analysis because Groq is unavailable right now (${reason}).`;
}

function buildLocalInsights(summary, reason = "") {
  const schema = getSchemaCounts(summary);
  const missing = getTopMissing(summary, 3);
  const numeric = getNumericHighlights(summary, 3);
  const categorical = getCategoricalHighlights(summary, 2);

  const insights = [
    `The dataset contains ${summary?.rows || 0} rows across ${summary?.columns || 0} columns, with ${schema.numeric.length} numeric, ${schema.categorical.length} categorical, and ${schema.dates.length} date fields.`,
  ];

  if (missing.length) {
    insights.push(
      `Missing data is concentrated in ${toSentenceList(
        missing.map((item) => `${item.name} (${item.count}, ${formatPercent(item.pct)})`)
      )}, so cleanup should focus there first.`
    );
  } else {
    insights.push("The current profile shows no missing-value hotspots, which lowers data-cleaning risk before analysis.");
  }

  if (numeric.length) {
    const topRange = numeric[0];
    insights.push(
      `${topRange.name} has the widest spread, ranging from ${compactNumber(topRange.min)} to ${compactNumber(topRange.max)}, which makes it a strong candidate for segmentation, anomaly review, or feature engineering.`
    );
  }

  if (categorical.length) {
    insights.push(
      `Useful segmentation fields are already present, including ${toSentenceList(
        categorical.map((item) => `${item.name} (${item.values.join(", ")})`)
      )}.`
    );
  }

  insights.push(
    schema.numeric.length >= 2
      ? "The dataset is structurally ready for trend charts, outlier scans, and multi-metric comparisons."
      : "Numeric coverage is limited, so descriptive summaries and categorical drill-downs are likely to be more reliable than advanced modeling."
  );

  const qualityRecs = [];
  if (missing.length) {
    qualityRecs.push(
      `Impute, flag, or remove missing values in ${toSentenceList(missing.map((item) => item.name))} before training models or publishing dashboards.`
    );
  } else {
    qualityRecs.push("Keep the current validation checks in place because the profile does not show missing-value concentration.");
  }

  if (numeric.some((item) => item.coeffVar > 1.5 || item.range > 1000)) {
    qualityRecs.push("Standardize high-variance numeric columns before clustering, distance-based models, or side-by-side chart comparisons.");
  } else if (schema.numeric.length) {
    qualityRecs.push("Review numeric units and scaling so metrics remain comparable across visualizations and modeling steps.");
  }

  if (schema.categorical.length) {
    qualityRecs.push("Normalize category labels and collapse rare values to reduce noisy segments in recommendations and dashboards.");
  }

  if (schema.dates.length) {
    qualityRecs.push("Keep date columns in a true date format and derive time features such as month, week, or quarter for richer trend analysis.");
  }

  while (qualityRecs.length < 3) {
    qualityRecs.push("Document expected value ranges and required fields so future uploads can be checked automatically.");
  }

  const anomalies = [];
  missing
    .filter((item) => item.pct >= 0.1)
    .forEach((item) => {
      anomalies.push(`${item.name} is missing in ${formatPercent(item.pct)} of rows (${item.count} records), which is unusually high.`);
    });

  numeric
    .filter((item) => item.zeroVariance)
    .forEach((item) => {
      anomalies.push(`${item.name} has effectively no variance, which may indicate a duplicate, placeholder, or non-informative field.`);
    });

  numeric
    .filter((item) => !item.zeroVariance && item.coeffVar > 2)
    .forEach((item) => {
      anomalies.push(`${item.name} shows very high variability relative to its mean, so it is worth checking for outliers or mixed units.`);
    });

  if (!anomalies.length) {
    anomalies.push(
      numeric.length
        ? `${numeric[0].name} has the broadest numeric range, so it is the best first column to inspect for extreme values.`
        : "No obvious anomalies are visible from the current profile summary alone."
    );
  }

  const execSummary = [
    `${summary?.name || "This dataset"} includes ${summary?.rows || 0} rows and ${summary?.columns || 0} columns.`,
    missing.length
      ? `The main data-quality risk is missingness in ${toSentenceList(missing.map((item) => item.name))}.`
      : "Missing-value risk appears low based on the current profile.",
    numeric.length
      ? `${numeric[0].name} stands out as the most variable numeric field and should be reviewed early in analysis.`
      : "Most immediate value will likely come from descriptive and categorical analysis.",
  ].join(" ");

  return normalizeInsightPayload(
    {
      insights: insights.slice(0, 5),
      quality_recs: qualityRecs.slice(0, 3),
      anomalies: anomalies.slice(0, 3),
      exec_summary: execSummary,
    },
    {
      source: "local",
      notice: buildFallbackNotice(reason),
    }
  );
}

function buildLocalChatReply(summary, question, reason = "") {
  const prompt = String(question || "").trim();
  const lower = prompt.toLowerCase();
  const schema = getSchemaCounts(summary);
  const missing = getTopMissing(summary, 3);
  const numeric = getNumericHighlights(summary, 3);
  const categorical = getCategoricalHighlights(summary, 2);

  const lines = [];

  if (/summar|overview|describe/.test(lower)) {
    lines.push(
      `${summary?.name || "This dataset"} has ${summary?.rows || 0} rows and ${summary?.columns || 0} columns. It includes ${schema.numeric.length} numeric fields, ${schema.categorical.length} categorical fields, and ${schema.dates.length} date fields.`
    );
    lines.push(
      missing.length
        ? `The main cleanup priority is ${toSentenceList(missing.map((item) => `${item.name} (${formatPercent(item.pct)} missing)`))}.`
        : "The profile does not show any major missing-value concentration."
    );
  } else if (/anom|outlier|issue|quality|missing/.test(lower)) {
    lines.push(
      missing.length
        ? `The clearest data-quality issue is missingness in ${toSentenceList(missing.map((item) => `${item.name} (${item.count} rows)`))}.`
        : "I do not see a missing-data hotspot in the current profile."
    );
    lines.push(
      numeric.length
        ? `${numeric[0].name} has the widest numeric spread, so it is the best candidate for an outlier review.`
        : "There are not enough numeric summary fields here to call out a strong outlier candidate."
    );
  } else if (/churn|risk|predict|forecast/.test(lower)) {
    lines.push("I cannot predict a business outcome from the summary alone because there is no confirmed target variable or trained model in this step.");
    lines.push(
      numeric.length
        ? `A practical next move is to test whether ${numeric[0].name}${numeric[1] ? ` and ${numeric[1].name}` : ""} correlate with the outcome you care about.`
        : "A practical next move is to identify the target column and build a supervised model using the cleaned dataset."
    );
  } else if (/trend|pattern|driver|segment/.test(lower)) {
    lines.push(
      numeric.length
        ? `${numeric[0].name} appears to be a strong driver candidate because it has the broadest observed range in the dataset summary.`
        : "The strongest patterns are likely to come from segmenting the dataset by categorical columns."
    );
    lines.push(
      categorical.length
        ? `For segmentation, start with ${toSentenceList(categorical.map((item) => item.name))}.`
        : "There are no strong categorical segmentation hints in the current summary."
    );
  } else {
    lines.push(
      `${summary?.name || "This dataset"} looks ready for exploration with ${summary?.rows || 0} rows, ${summary?.columns || 0} columns, and ${schema.numeric.length} numeric fields.`
    );
    lines.push(
      missing.length
        ? `Before going deeper, clean ${toSentenceList(missing.map((item) => item.name))} because those columns hold most of the missing data.`
        : "Before going deeper, the best next step is to inspect the highest-variance numeric columns and categorical segments."
    );
  }

  if (numeric.length) {
    lines.push(
      `Most informative numeric field right now: ${numeric[0].name} (mean ${compactNumber(numeric[0].mean)}, median ${compactNumber(numeric[0].median)}, range ${compactNumber(numeric[0].min)} to ${compactNumber(numeric[0].max)}).`
    );
  }

  return {
    content: lines.join("\n\n"),
    source: "local",
    notice: buildFallbackNotice(reason),
  };
}

export async function generateInsights(summary, userPrompt = DEFAULT_DATASET_INTELLIGENCE_PROMPT) {
  const payload = {
    model: GROQ_MODEL,
    messages: buildDatasetIntelligencePromptMessages(summary, userPrompt),
    temperature: 0.2,
    max_tokens: 1400,
  };

  try {
    const data = await groqRequest(payload);
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = safeJsonParse(content);
    if (!parsed) {
      throw new Error("Groq response was not valid JSON.");
    }
    return normalizeDatasetIntelligencePayload(parsed, {
      source: "groq",
      promptUsed: userPrompt,
    });
  } catch (error) {
    return buildLocalStructuredIntelligence(summary, userPrompt, error?.message || "");
  }
}

export async function chatWithGroq(messages, summary) {
  const payload = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.3,
    max_tokens: 800,
  };

  try {
    const data = await groqRequest(payload);
    return {
      content: data.choices?.[0]?.message?.content || "",
      source: "groq",
      notice: "",
    };
  } catch (error) {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    return buildLocalChatReply(summary, lastUserMessage?.content || "", error?.message || "");
  }
}
