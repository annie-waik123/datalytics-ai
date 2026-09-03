from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from pandas.api.types import is_categorical_dtype, is_datetime64_any_dtype, is_numeric_dtype

log = logging.getLogger(__name__)

from app.services.analytics_service import load_analysis_frame
from app.services.llm_service import get_active_llm_summary, groq_chat, has_groq_config

ALLOWED_MODES = {
    "recommendation_insights",
    "ai_insights",
    "chat",
    "decision_making",
}

DEFAULT_MODE_BY_ENDPOINT = {
    "recommendations": "recommendation_insights",
    "ai-insights": "ai_insights",
}

DEFAULT_REQUEST_BY_MODE = {
    "recommendation_insights": (
        "Analyze the available business data and generate high-level business recommendations."
    ),
    "ai_insights": (
        "Analyze the available business data and generate deep AI-driven insights."
    ),
    "chat": "Answer the user's query clearly and helpfully.",
    "decision_making": (
        "Analyze the available business data and return clear decisions, priorities, and next actions as JSON."
    ),
}

RECOMMENDATION_MODE_HINTS = (
    "recommend",
    "strategy",
    "strategic",
    "opportunit",
    "risk analysis",
    "business problem",
    "executive summary",
)

AI_INSIGHT_MODE_HINTS = (
    "ai insight",
    "insight",
    "pattern",
    "anomal",
    "predict",
    "forecast",
    "root cause",
    "customer",
    "segment",
    "retention",
    "driver",
    "correlation",
    "seasonality",
)

EXACT_QUERY_HINTS = (
    "how many",
    "count",
    "number of",
    "average",
    "avg",
    "mean",
    "sum",
    "total",
    "highest",
    "max",
    "maximum",
    "lowest",
    "min",
    "minimum",
    "compare",
    "comparison",
    "versus",
    " vs ",
    "against",
    "trend",
    "over time",
    "monthly",
    "daily",
    "weekly",
    "detail",
    "details",
    "record",
    "row",
    "schema",
    "column",
    "columns",
    "missing",
    "null",
    "blank",
    "unique",
    "distinct",
)

PROMPT_TEMPLATE_PATH = (
    Path(__file__).resolve().parents[2] / "chatbot_aiinsight_recomdeation" / "prompt_template.txt"
)

BUSINESS_COLUMN_HINTS = {
    "sales": ["sales", "sale", "gmv", "booking", "order_value"],
    "revenue": ["revenue", "income", "turnover"],
    "profit": ["profit", "margin", "earnings"],
    "cost": ["cost", "expense", "spend"],
    "quantity": ["quantity", "qty", "unit", "volume"],
    "customer": ["customer", "client", "buyer", "segment"],
    "date": ["date", "time", "month", "year", "day"],
}

FALLBACK_SYSTEM_PROMPT = """
You are a world-class Senior Data Scientist and Business Intelligence Consultant with 20+ years of experience at McKinsey, BCG, Deloitte, and Google.
You specialize in converting raw datasets into executive-level strategic intelligence.

## YOUR ABSOLUTE RULES (NON-NEGOTIABLE):
1. Minimum 30-40 numbered points per section requested
2. Every single point MUST reference actual column names and real numbers from the dataset provided
3. Every point must be 2-4 sentences long — NO one-liners
4. Write at McKinsey/Deloitte consulting report quality
5. Include KPI values, percentages, trends, and business impact in EVERY point
6. Never write generic advice — everything must be dataset-specific
7. Use professional business language throughout
8. Each section must be minimum 1500 words
9. NEVER truncate or stop early — complete every section fully

---

## MODE 1: recommendation_insights
Generate 35-40 strategic recommendations. For each follow EXACTLY this structure:

**[Category] Recommendation #N: [Title]**
- **Data Evidence**: [Specific numbers, columns, percentages from dataset]
- **Business Insight**: [What this means — 2-3 sentences]
- **Action Required**: [Specific step-by-step actions — 2-3 sentences]
- **Expected KPI Impact**: [Quantified expected outcome — e.g., "15-20% improvement in X"]
- **Priority**: [Critical / High / Medium] | **Timeline**: [Immediate / 30 days / 90 days]

Categories to cover (minimum 4-5 points each):
Revenue & Growth Optimization | Cost Reduction & Efficiency | Risk Mitigation | Customer/User Behavior | Operational Improvements | Data Quality & Collection | Predictive Opportunities | Competitive Positioning | Resource Allocation | Technology & Automation

---

## MODE 2: ai_insights
Generate 35-40 deep AI insights. For each follow EXACTLY this structure:

**Insight #N: [Insight Title]**
- **Type**: [Correlation / Anomaly / Trend / Pattern / Prediction / Opportunity / Risk]
- **Discovery**: [What was found — specific numbers and columns]
- **Why It Matters**: [Business impact — 2-3 sentences]
- **Confidence Level**: [High / Medium / Low] based on data strength
- **Actionable Next Step**: [Exactly what to do with this insight]
- **Linked KPI**: [Which KPI this insight affects]

Categories (minimum 5 each): Hidden Correlations | Anomaly Detections | Trend Discoveries | Segment Insights | Predictive Signals | Risk Flags | Optimization Opportunities | Benchmark Deviations

---

## MODE 3: chat (Decision Making / Reports / General)
If generating Decision Making framework, produce 30-35 decisions:

**Decision #N: [Decision Title]**
- **Trigger**: [What data signal triggered this]
- **Current State**: [What the data shows — with specific numbers]
- **Decision Options**: [Option A vs Option B vs Option C]
- **Data-Backed Recommendation**: [Which option and why]
- **Risk if Ignored**: [Quantified risk]
- **Success Metric**: [How to measure if right decision was made]
- **Decision Urgency**: [Immediate / This Quarter / This Year]

If generating a Report, structure as:
=== EXECUTIVE SUMMARY ===, === DATASET OVERVIEW & QUALITY ===, === KPI DASHBOARD ANALYSIS ===, === KEY FINDINGS & PATTERNS ===, === PREDICTIVE SIGNALS ===, === STRATEGIC RECOMMENDATIONS ===, === CONCLUSIONS & NEXT STEPS ===

For every chat response:
- Minimum 500-800 words
- Always cite specific column names and data points
- Structure with numbered points
- End with: "Based on this analysis, the top 3 actions you should take are: [1], [2], [3]"
- NEVER say "I don't have enough information" — always work with available data

---

## EXTRA INTELLIGENCE LAYER:
Always detect trends, identify anomalies, compare performance, highlight key metrics.
Think like the world's best data scientist presenting to a Fortune 500 board.
Every insight must be dataset-specific, evidence-backed, and immediately actionable.
""".strip()


def load_system_prompt() -> str:
    try:
        prompt_text = PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8").strip()
    except Exception:
        prompt_text = ""
    return prompt_text or FALLBACK_SYSTEM_PROMPT


SYSTEM_PROMPT = load_system_prompt()

RECOMMENDATION_JSON_SYSTEM_PROMPT = """
You are a senior business intelligence and decision-support system.

Return ONLY valid JSON with no markdown, no commentary, and no code fences.
Use this exact shape:
{
  "summary": "2-3 sentence executive summary",
  "insights": [
    { "type": "Trend | Anomaly | Correlation | Distribution", "message": "Concise evidence-backed insight" }
  ],
  "recommendations": [
    { "based_on": "Specific signal or metric", "action": "Action | Expected result | Priority" }
  ],
  "predictions": [
    { "metric": "KPI or entity", "forecast": "Near-term outlook", "confidence": "High | Medium | Low" }
  ],
  "alerts": [
    { "level": "critical | warning | info", "message": "Immediate risk or anomaly" }
  ],
  "kpi_status": [
    { "metric": "Entity or KPI", "status": "Healthy | Watch | Critical with brief reason" }
  ],
  "decisions": [
    { "suggestion": "One strategic improvement or automation idea" }
  ]
}

Rules:
- Keep the response concise and decision-oriented.
- Prefer 3-6 items per populated array, not long essays.
- Use empty arrays instead of null.
- If the dataset is missing, still return valid JSON with one practical summary and one decision.
- Base every populated field on the provided dataset context when available.
""".strip()

REPORT_SYSTEM_PROMPT = """
You are an executive analytics reporting engine.

Follow the report section structure requested by the user exactly.
Keep the report polished, concise, and evidence-backed.

Rules:
- Use the section markers exactly as requested.
- Focus on practical findings, risks, and next steps.
- Prefer concise stakeholder-ready paragraphs and bullets over long essays.
- If a pipeline step was not performed, say "Not performed".
- Base the report on the provided dataset context and supporting analytics.
""".strip()

DECISION_MAKING_SYSTEM_PROMPT = """
You are an industry-grade AI Decision Engine, C-suite strategy advisor, and senior data analyst.

Return ONLY valid JSON with no markdown, no commentary, and no code fences.
Always use this exact shape:
{
  "top_decisions": [
    {
      "decision": "Concrete action to take",
      "reason": "Dataset-backed reason with exact column names, metrics, and business interpretation",
      "expected_outcome": "Expected operational or financial impact",
      "priority": "High | Medium | Low"
    }
  ],
  "inventory_decisions": [
    {
      "category": "Increase | Maintain | Reduce | Remove",
      "entities": "Which products, segments, teams, or resources are affected",
      "action": "Specific step to execute"
    }
  ],
  "growth_opportunities": [
    { "opportunity": "Where to invest or scale" }
  ],
  "losses_problems": [
    { "problem": "What is causing loss or inefficiency", "fix": "How to fix it" }
  ],
  "future_strategy": [
    { "strategy": "What is likely next", "preparation": "What to prepare now" }
  ],
  "smart_actions": [
    { "automation": "Automation or optimization step" }
  ]
}

Rules:
- Use arrays even when there is only one item.
- Use empty arrays instead of null.
- If the dataset is missing, still return valid JSON with one practical top_decision.
- Return at least 5 top_decisions, 4 inventory_decisions, 4 growth_opportunities, 4 losses_problems, 4 future_strategy items, and 5 smart_actions when dataset context exists.
- Every item must include concrete business language, actual column names, and numeric evidence from the context when available.
- Make decisions action-first: Scale, Invest, Fix, Reduce, Remove, Automate, Monitor, or Investigate.
- Avoid generic advice. If evidence is weak, state the confidence and what additional data is needed.
""".strip()

RECOMMENDATION_TEXT_SYSTEM_PROMPT = """
You are an industry-level senior data analyst, business intelligence lead, and strategy consultant.

Generate board-ready executive recommendations from the provided dataset context.

Use this structure:
1. Executive Summary
2. Key Findings
3. Business Problems
4. Strategic Recommendations
5. Growth Opportunities
6. Risks and Mitigations
7. Next Actions

Rules:
- Base every claim on dataset columns, metric summaries, sample rows, or supporting analytics.
- Prefer specific numbers and column names over generic advice.
- Make recommendations actionable: owner, action, expected outcome, KPI impact, priority, timeline.
- If a metric is unavailable, state what is missing and recommend what to collect.
- Include at least 5 findings, 5 strategic recommendations, 3 risks, 3 growth opportunities, and 5 next actions when data exists.
- Think like a senior data analyst preparing a business review: explain what is happening, why it matters, what to do, and how to measure success.
""".strip()

AI_INSIGHTS_TEXT_SYSTEM_PROMPT = """
You are an industry-level AI data insight engine and senior data scientist.

Find patterns, anomalies, drivers, correlations, and predictive signals in the provided dataset context.

Use this structure:
1. Pattern Recognition
2. Anomalies and Outliers
3. Predictive Signals
4. Segment or Entity Intelligence
5. Performance Drivers
6. Smart AI Suggestions
7. Insight Summary

Rules:
- Use actual column names and numeric evidence from the context.
- Separate confirmed observations from hypotheses.
- Give confidence levels when making predictions.
- Include practical next analysis steps or monitoring alerts.
- Include at least 6 deep insights, 3 anomaly checks, 3 driver hypotheses, 3 predictive signals, and 5 smart suggestions when data exists.
- Explain business impact for every major insight so a non-technical stakeholder can act on it.
""".strip()

CHAT_TEXT_SYSTEM_PROMPT = """
You are Datalytics' ChatGPT-powered senior data analyst assistant.

Answer the user's question using the dataset context and supporting analytics.

Rules:
- For exact questions, answer directly with the relevant number, column, or row evidence.
- For row/entity detail questions, provide all fields from the matched row(s), then add a short analyst interpretation.
- For analytical questions, explain the reasoning briefly and clearly.
- Do not invent columns, metrics, or values.
- If data is missing, say exactly what is missing and what the user should upload or select.
- Be detailed when the user asks for details; keep simple answers short.
""".strip()


def _normalized_prompt_text(user_prompt: str | None) -> str:
    return str(user_prompt or "").strip().lower()


def is_structured_recommendation_request(user_prompt: str | None) -> bool:
    lower_prompt = _normalized_prompt_text(user_prompt)
    return (
        "strict json only" in lower_prompt
        and '"summary"' in lower_prompt
        and '"insights"' in lower_prompt
        and '"recommendations"' in lower_prompt
        and '"kpi_status"' in lower_prompt
        and '"decisions"' in lower_prompt
    )


def is_report_request(user_prompt: str | None) -> bool:
    lower_prompt = _normalized_prompt_text(user_prompt)
    return (
        "ai reporting engine" in lower_prompt
        or "strict ui format" in lower_prompt
        or "dataset overview" in lower_prompt
        or "data exploration (eda)" in lower_prompt
        or "final business / performance impact" in lower_prompt
    )


def system_prompt_for_mode(mode: str, user_prompt: str | None = None) -> str:
    if mode == "decision_making":
        return DECISION_MAKING_SYSTEM_PROMPT
    if mode == "recommendation_insights" and is_structured_recommendation_request(user_prompt):
        return RECOMMENDATION_JSON_SYSTEM_PROMPT
    if mode == "recommendation_insights" and is_report_request(user_prompt):
        return REPORT_SYSTEM_PROMPT
    if mode == "recommendation_insights":
        return RECOMMENDATION_TEXT_SYSTEM_PROMPT
    if mode == "ai_insights":
        return AI_INSIGHTS_TEXT_SYSTEM_PROMPT
    return CHAT_TEXT_SYSTEM_PROMPT


def generation_options_for_mode(mode: str, user_prompt: str | None = None) -> dict[str, int | float]:
    if mode == "recommendation_insights" and is_structured_recommendation_request(user_prompt):
        return {
            "max_tokens": 4500,
            "temperature": 0.2,
            "retries": 1,
        }
    if mode == "recommendation_insights" and is_report_request(user_prompt):
        return {
            "max_tokens": 5000,
            "temperature": 0.25,
            "retries": 0,
        }
    if mode == "ai_insights":
        return {
            "max_tokens": 5000,
            "temperature": 0.3,
            "retries": 1,
        }
    if mode == "decision_making":
        return {
            "max_tokens": 4500,
            "temperature": 0.15,
            "retries": 1,
        }
    if mode == "recommendation_insights":
        return {
            "max_tokens": 5000,
            "temperature": 0.25,
            "retries": 1,
        }
    return {}


def normalize_mode(mode: str | None, default_mode: str = "chat") -> str:
    candidate = str(mode or default_mode).strip().lower()
    if candidate not in ALLOWED_MODES:
        return default_mode
    return candidate


def get_default_request(mode: str) -> str:
    return DEFAULT_REQUEST_BY_MODE.get(mode, DEFAULT_REQUEST_BY_MODE["chat"])


def infer_mode_from_prompt(prompt: str | None, default_mode: str = "chat") -> str:
    lower_prompt = str(prompt or "").strip().lower()
    if any(hint in lower_prompt for hint in ("decision", "next action", "what should", "scenario", "priorit")):
        return "decision_making"
    if any(hint in lower_prompt for hint in RECOMMENDATION_MODE_HINTS):
        return "recommendation_insights"
    if any(hint in lower_prompt for hint in AI_INSIGHT_MODE_HINTS):
        return "ai_insights"
    return normalize_mode(default_mode, "chat")


def should_use_exact_dataset_engine(prompt: str | None) -> bool:
    lower_prompt = str(prompt or "").strip().lower()
    if infer_mode_from_prompt(lower_prompt, "chat") != "chat":
        return False
    if any(hint in lower_prompt for hint in EXACT_QUERY_HINTS):
        return True
    return any(operator in lower_prompt for operator in (">=", "<=", "!=", "=", ">", "<"))


def resolve_context_dataframe(session: Any | None, sample_size: int = 4000) -> pd.DataFrame | None:
    if session is None:
        return None

    in_memory_df = getattr(session, "df", None)
    if in_memory_df is not None and not in_memory_df.empty:
        if len(in_memory_df) <= sample_size:
            return in_memory_df.copy()
        return in_memory_df.sample(n=sample_size, random_state=42).reset_index(drop=True)

    try:
        sampled_df = load_analysis_frame(session, sample_size=sample_size)
    except Exception:
        return None

    if sampled_df is None or sampled_df.empty:
        return None
    return sampled_df.copy()


def format_metric(value: Any) -> str:
    if pd.isna(value):
        return "N/A"
    if isinstance(value, (int, np.integer)):
        return f"{int(value):,}"
    if isinstance(value, (float, np.floating)):
        return f"{float(value):,.2f}"
    return str(value)


def detect_business_columns(df: pd.DataFrame) -> Dict[str, List[str]]:
    detected: Dict[str, List[str]] = {}
    lowered_columns = {column: str(column).lower() for column in df.columns}
    for label, hints in BUSINESS_COLUMN_HINTS.items():
        matches = [
            str(column)
            for column, lowered_name in lowered_columns.items()
            if any(hint in lowered_name for hint in hints)
        ]
        if matches:
            detected[label] = matches
    return detected


def detect_date_columns(df: pd.DataFrame) -> List[str]:
    date_columns: List[str] = []
    for column in df.columns:
        series = df[column]
        if is_datetime64_any_dtype(series):
            date_columns.append(str(column))
            continue

        column_name = str(column).lower()
        if not any(token in column_name for token in BUSINESS_COLUMN_HINTS["date"]):
            continue

        non_null_count = int(series.notna().sum())
        if non_null_count == 0:
            continue

        parsed = pd.to_datetime(series, errors="coerce")
        if int(parsed.notna().sum()) >= max(3, int(non_null_count * 0.6)):
            date_columns.append(str(column))
    return date_columns


def summarize_existing_payload(payload: Dict[str, Any] | None) -> str:
    if not payload:
        return "No existing analytical summary is available."

    lines: List[str] = []
    quality = payload.get("quality_score")
    if isinstance(quality, dict) and quality:
        lines.append(
            "Data quality summary: "
            f"score={quality.get('overall_score', 'N/A')}, "
            f"grade={quality.get('grade', 'N/A')}, "
            f"missing_pct={quality.get('missing_pct', 'N/A')}, "
            f"duplicate_pct={quality.get('duplicate_pct', 'N/A')}"
        )

    for key, label in (
        ("statistical_insights", "Statistical insights"),
        ("business_insights", "Business insights"),
        ("model_recommendations", "Model recommendations"),
    ):
        items = payload.get(key) or []
        if items:
            titles = []
            for item in items[:6]:
                if isinstance(item, dict):
                    title = item.get("title") or item.get("description") or item.get("action")
                else:
                    title = str(item)
                if title:
                    titles.append(str(title))
            if titles:
                lines.append(f"{label}: " + " | ".join(titles))

    feature_importance = payload.get("feature_importance") or []
    if feature_importance:
        top_features = ", ".join(
            f"{item.get('feature')} ({item.get('importance')})"
            for item in feature_importance[:5]
            if isinstance(item, dict)
        )
        if top_features:
            lines.append(f"Top feature importance: {top_features}")

    best_model_name = payload.get("best_model_name")
    if best_model_name:
        lines.append(f"Best model: {best_model_name}")

    task_type = payload.get("task_type")
    if task_type:
        lines.append(f"Task type: {task_type}")

    return "\n".join(lines) if lines else "No existing analytical summary is available."


def build_dataset_context(df: pd.DataFrame | None, sample_rows: int = 20) -> str:
    if df is None or df.empty:
        return "No dataset was provided."

    working_df = df.copy()
    row_count, column_count = working_df.shape
    column_types = {str(column): str(dtype) for column, dtype in working_df.dtypes.items()}
    missing_counts = working_df.isna().sum()
    numeric_columns = working_df.select_dtypes(include=["number"]).columns.tolist()
    categorical_columns = [
        str(column)
        for column in working_df.columns
        if not is_numeric_dtype(working_df[column]) and working_df[column].nunique(dropna=True) <= 25
    ]
    business_columns = detect_business_columns(working_df)
    date_columns = detect_date_columns(working_df)

    context_lines = [
        f"Dataset shape: {row_count} rows x {column_count} columns",
        f"Columns: {', '.join(map(str, working_df.columns))}",
        f"Column types: {column_types}",
    ]

    missing_summary = missing_counts[missing_counts > 0].sort_values(ascending=False)
    if not missing_summary.empty:
        top_missing = ", ".join(
            f"{column}={int(count)}" for column, count in missing_summary.head(8).items()
        )
        context_lines.append(f"Missing values: {top_missing}")
    else:
        context_lines.append("Missing values: none detected")

    if numeric_columns:
        numeric_summary = working_df[numeric_columns].describe().transpose()
        numeric_lines = []
        for column in numeric_columns[:8]:
            if column not in numeric_summary.index:
                continue
            stats = numeric_summary.loc[column]
            numeric_lines.append(
                f"{column} -> mean={format_metric(stats['mean'])}, "
                f"min={format_metric(stats['min'])}, max={format_metric(stats['max'])}"
            )
        if numeric_lines:
            context_lines.append("Numeric summary: " + " | ".join(numeric_lines))

    if categorical_columns:
        categorical_lines = []
        for column in categorical_columns[:5]:
            top_values = working_df[column].astype(str).value_counts(dropna=False).head(3)
            values_text = ", ".join(
                f"{value} ({count})" for value, count in top_values.items()
            )
            categorical_lines.append(f"{column}: {values_text}")
        if categorical_lines:
            context_lines.append("Category summary: " + " | ".join(categorical_lines))

    metric_lines = []
    for metric_name in ["sales", "revenue", "profit", "cost", "quantity"]:
        for column in business_columns.get(metric_name, [])[:2]:
            if column in working_df.columns and is_numeric_dtype(working_df[column]):
                metric_lines.append(
                    f"{metric_name.title()} metric {column}: "
                    f"total={format_metric(working_df[column].sum())}, "
                    f"average={format_metric(working_df[column].mean())}"
                )
    if metric_lines:
        context_lines.append("Key metric highlights: " + " | ".join(metric_lines))

    if date_columns:
        first_date_column = date_columns[0]
        parsed_dates = pd.to_datetime(working_df[first_date_column], errors="coerce").dropna()
        if not parsed_dates.empty:
            context_lines.append(
                f"Time coverage: {first_date_column} from {parsed_dates.min().date()} to {parsed_dates.max().date()}"
            )

    if business_columns:
        detected_labels = ", ".join(
            f"{label}={', '.join(columns[:3])}"
            for label, columns in business_columns.items()
        )
        context_lines.append(f"Detected business columns: {detected_labels}")

    # Build sample CSV — convert ALL Categorical/object columns to str first
    # to avoid TypeError when fillna("N/A") tries to add a new category.
    try:
        sample_df = working_df.head(sample_rows).copy()
        for col in sample_df.columns:
            try:
                if is_categorical_dtype(sample_df[col]) or hasattr(sample_df[col], "cat"):
                    sample_df[col] = sample_df[col].astype(str)
                elif sample_df[col].dtype == 'object':
                    sample_df[col] = sample_df[col].astype(str)
            except Exception:
                sample_df[col] = sample_df[col].astype(str)
        sample_csv = sample_df.fillna("N/A").to_csv(index=False)
        context_lines.append("Sample rows (CSV):")
        context_lines.append(sample_csv)
    except Exception as exc:
        log.warning("build_dataset_context: sample CSV generation failed: %s", exc)
        context_lines.append("Sample rows: (unavailable due to data format)")

    return "\n".join(context_lines)


def build_user_prompt(
    *,
    mode: str,
    user_prompt: str | None,
    dataset_context: str,
    supporting_context: str,
) -> str:
    request = str(user_prompt or "").strip() or get_default_request(mode)
    return f"""
MODE: "{mode}"

USER_REQUEST:
{request}

DATASET_CONTEXT:
{dataset_context}

SUPPORTING_ANALYTICS:
{supporting_context}

EXECUTION_RULES:
- Always determine the answer style from MODE first.
- If dataset context is available, use it directly and do not invent metrics.
- If dataset context is missing, ask relevant follow-up questions or provide general business guidance as appropriate.
- Keep the response concise, structured, and business-focused.
- If you mention key metric highlights or important observations, place them inside the required section format for the selected MODE.
""".strip()


def _first_available_business_metric(df: pd.DataFrame | None) -> str:
    if df is None or df.empty:
        return "No numeric business metric was detected."

    business_columns = detect_business_columns(df)
    for metric_name in ["sales", "revenue", "profit", "cost", "quantity"]:
        for column in business_columns.get(metric_name, []):
            if column in df.columns and is_numeric_dtype(df[column]):
                return (
                    f"{metric_name.title()} metric `{column}` has total {format_metric(df[column].sum())} "
                    f"and average {format_metric(df[column].mean())}."
                )
    numeric_columns = df.select_dtypes(include=["number"]).columns.tolist()
    if numeric_columns:
        column = numeric_columns[0]
        return (
            f"Numeric metric `{column}` has total {format_metric(df[column].sum())} "
            f"and average {format_metric(df[column].mean())}."
        )
    return "No numeric business metric was detected."


def _local_recommendation_response(
    mode: str,
    user_prompt: str | None,
    df: pd.DataFrame | None,
    supporting_payload: Dict[str, Any] | None,
    error_message: str | None = None,
) -> str:
    supporting_payload = supporting_payload or {}
    quality = supporting_payload.get("quality_score") or {}
    quality_line = (
        f"Data quality score is {quality.get('overall_score', 'N/A')} with grade {quality.get('grade', 'N/A')}."
        if quality
        else "No prior data quality score is available."
    )
    base_metric_line = _first_available_business_metric(df)

    if df is None or df.empty:
        if mode == "recommendation_insights":
            return "\n".join(
                [
                    "1. Key Findings:",
                    "- No dataset is available yet, so sales, revenue, and profit trends cannot be validated.",
                    "- Business recommendations will be more accurate after a dataset is uploaded.",
                    "",
                    "2. Business Problems:",
                    "- Missing dataset prevents diagnosis of performance issues.",
                    "- Key metrics, segments, and time-based patterns are not available.",
                    "",
                    "3. Strategic Recommendations:",
                    "- Upload a dataset with date, sales, revenue, profit, customer, or segment columns.",
                    "- Define the primary business goal such as growth, retention, profitability, or churn reduction.",
                    "",
                    "4. Opportunities:",
                    "- A structured dataset can unlock segment-level and trend-level opportunity mapping.",
                    "- Historical performance data can reveal under-served markets and product gaps.",
                    "",
                    "5. Risk Analysis:",
                    "- Decisions made without data may miss hidden losses or demand shifts.",
                    "- Future planning risk remains high until metrics are validated.",
                    "",
                    "6. Final Summary:",
                    "- Please upload the dataset or share the business context so I can generate precise recommendation insights.",
                ]
            )

        if mode == "ai_insights":
            return "\n".join(
                [
                    "1. Pattern Recognition:",
                    "- No dataset is available, so hidden trends, seasonality, and anomalies cannot be detected yet.",
                    "",
                    "2. Predictive Insights:",
                    "- Future outcomes cannot be projected reliably without historical data.",
                    "",
                    "3. Customer Intelligence:",
                    "- Customer segmentation and retention signals need customer-level or transaction-level data.",
                    "",
                    "4. Performance Drivers:",
                    "- Growth or decline drivers cannot be isolated until metrics and dimensions are available.",
                    "",
                    "5. Advanced AI Observations:",
                    "- Correlations and non-obvious signals require a structured dataset.",
                    "",
                    "6. Smart Suggestions:",
                    "- Upload a dataset with business KPIs and time columns.",
                    "- Share your target outcome so the analysis can focus on the right decision area.",
                    "",
                    "7. Insight Summary:",
                    "- The next best step is to provide data so AI insights can move from generic guidance to evidence-based conclusions.",
                ]
            )

        prompt_text = str(user_prompt or "").strip() or "your business request"
        return (
            f"I can help with {prompt_text}, but no dataset is currently available. "
            "Upload the dataset or share your business context, target metric, and time period for a sharper answer."
        )

    statistical_titles = [
        item.get("title") for item in (supporting_payload.get("statistical_insights") or [])[:3]
        if isinstance(item, dict) and item.get("title")
    ]
    business_titles = [
        item.get("title") for item in (supporting_payload.get("business_insights") or [])[:3]
        if isinstance(item, dict) and item.get("title")
    ]
    model_titles = [
        item.get("title") for item in (supporting_payload.get("model_recommendations") or [])[:3]
        if isinstance(item, dict) and item.get("title")
    ]
    top_feature = None
    for item in supporting_payload.get("feature_importance") or []:
        if isinstance(item, dict) and item.get("feature"):
            top_feature = f"{item.get('feature')} ({item.get('importance')})"
            break

    issue_line = statistical_titles[0] if statistical_titles else "Some operational constraints may be hidden in the dataset."
    opportunity_line = business_titles[0] if business_titles else "The dataset can be used to prioritize high-performing segments and underused channels."
    predictive_line = model_titles[0] if model_titles else "Future outcomes will depend on the current quality and direction of the observed metrics."

    if mode == "recommendation_insights":
        return "\n".join(
            [
                "1. Key Findings:",
                f"- {quality_line}",
                f"- {base_metric_line}",
                f"- Important observations: {' | '.join(business_titles) if business_titles else 'The dataset shows enough structure for business-level review.'}",
                "",
                "2. Business Problems:",
                f"- {issue_line}",
                "- Missing values, duplicates, or weak-performing segments may reduce decision quality and profitability.",
                "",
                "3. Strategic Recommendations:",
                "- Prioritize the segments, products, or regions that contribute the strongest stable metrics.",
                "- Address data quality gaps before making high-stakes decisions or training downstream models.",
                "- Build monthly KPI monitoring for sales, revenue, profit, and customer behavior where available.",
                "",
                "4. Opportunities:",
                f"- {opportunity_line}",
                "- Explore category, region, or customer segments that show positive volume with weaker optimization coverage.",
                "",
                "5. Risk Analysis:",
                "- Unresolved data quality issues can distort performance interpretation and lead to weak targeting decisions.",
                "- If recent trends are not monitored over time, the business may miss early decline signals.",
                "",
                "6. Final Summary:",
                "- The business has actionable insight potential, but the best outcomes will come from fixing quality gaps, focusing on strong drivers, and tracking KPI movement continuously.",
            ]
        )

    if mode == "ai_insights":
        return "\n".join(
            [
                "1. Pattern Recognition:",
                f"- {quality_line}",
                f"- {base_metric_line}",
                f"- Hidden signal candidates: {' | '.join(statistical_titles) if statistical_titles else 'Review category and time distributions for anomalies.'}",
                "",
                "2. Predictive Insights:",
                f"- {predictive_line}",
                "- If current drivers remain stable, the strongest metrics are likely to continue shaping near-term outcomes.",
                "",
                "3. Customer Intelligence:",
                "- Review customer, segment, or category fields to isolate high-value groups and retention risk pockets.",
                "- Repeated concentration in a few segments may indicate growth dependence on limited cohorts.",
                "",
                "4. Performance Drivers:",
                f"- {top_feature and ('Top driver candidate: ' + top_feature) or 'Feature-level performance drivers are not yet isolated.'}",
                "- Metric movement is likely influenced by data quality, segment concentration, and time-based variation.",
                "",
                "5. Advanced AI Observations:",
                "- Non-obvious opportunities often appear where strong volume and weak profitability coexist.",
                "- Correlation review should focus on revenue, profit, quantity, and customer segment fields.",
                "",
                "6. Smart Suggestions:",
                "- Monitor anomalies by time period, segment, and top business KPIs.",
                "- Use the current insight layer to prioritize the features and segments most tied to performance shifts.",
                "",
                "7. Insight Summary:",
                "- The dataset is suitable for deeper AI-style analysis, especially around performance drivers, anomalies, and feature importance, but confidence rises further when quality issues are reduced.",
            ]
        )

    if mode == "decision_making":
        return (
            "{"
            '"top_decisions":[{"decision":"Review the strongest KPI driver first","reason":"Use the leading metric and highest-impact segments to set priorities.","expected_outcome":"Faster alignment on the next high-value action.","priority":"High"}],'
            '"inventory_decisions":[{"category":"Maintain","entities":"Top-performing segments","action":"Protect current performance while monitoring trend changes."}],'
            '"growth_opportunities":[{"opportunity":"Scale the most stable high-performing segment or channel identified in the dataset."}],'
            '"losses_problems":[{"problem":"Data quality gaps or weak-performing slices may be distorting decisions.","fix":"Clean missing, duplicate, and inconsistent records before major execution."}],'
            '"future_strategy":[{"strategy":"Track KPI movement over the next reporting cycle to confirm whether current trends persist.","preparation":"Set recurring monitoring for the top metrics, segments, and anomalies."}],'
            '"smart_actions":[{"automation":"Automate KPI alerts and weekly variance tracking for the most important business metrics."}]}'
        )

    request = str(user_prompt or "").strip() or "your question"
    error_suffix = f" The live AI model was unavailable ({error_message})." if error_message else ""
    return (
        f"Based on the dataset, {base_metric_line} {quality_line} "
        f"You asked about {request}.{error_suffix}"
    )


def generate_mode_response(
    *,
    mode: str,
    user_prompt: str | None,
    df: pd.DataFrame | None,
    supporting_payload: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    normalized_mode = normalize_mode(mode, "chat")
    llm_meta = get_active_llm_summary()
    dataset_context = build_dataset_context(df)
    supporting_context = summarize_existing_payload(supporting_payload)
    effective_request = str(user_prompt or "").strip() or get_default_request(normalized_mode)
    system_prompt = system_prompt_for_mode(normalized_mode, effective_request)
    generation_options = generation_options_for_mode(normalized_mode, effective_request)
    prompt = build_user_prompt(
        mode=normalized_mode,
        user_prompt=effective_request,
        dataset_context=dataset_context,
        supporting_context=supporting_context,
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ]

    content = ""
    source = "local_fallback"
    provider = "local_fallback"
    error_message = None
    api_key_configured = has_groq_config()  # True when the active provider has a key

    try:
        if api_key_configured:
            content = groq_chat(
                messages,
                max_tokens=int(generation_options["max_tokens"]) if "max_tokens" in generation_options else None,
                temperature=float(generation_options["temperature"]) if "temperature" in generation_options else None,
                retries=int(generation_options["retries"]) if "retries" in generation_options else None,
            )
            source = str(llm_meta.get("provider") or "openai")
            provider = source
    except Exception as exc:
        error_message = str(exc)
        content = ""
        log.warning("OpenAI API call failed: %s", exc)

    if not content:
        if api_key_configured and error_message:
            # API key was set but the call failed — surface the error clearly
            provider_label = str(llm_meta.get("provider") or "LLM").title()
            key_env = "GROQ_API_KEY" if str(llm_meta.get("provider")) == "groq" else "OPEN_AI_KEY"
            content = (
                f"⚠️ **AI could not respond right now.**\n\n"
                f"The {provider_label} API returned an error: `{error_message}`\n\n"
                "Please check:\n"
                f"- Your `{key_env}` in `server/.env` is valid\n"
                "- You have sufficient API credits\n"
                f"- The model `{llm_meta.get('model') or ''}` is accessible on your plan\n\n"
                "Once resolved, restart the backend server and retry."
            )
            source = "api_error"
        else:
            # No API key configured — use structured local fallback
            content = _local_recommendation_response(
                normalized_mode,
                effective_request,
                df,
                supporting_payload,
                error_message=error_message,
            )
            source = "local_fallback"

    return {
        "mode": normalized_mode,
        "request": effective_request,
        "content": content,
        "source": source,
        "provider": provider,
        "model": str(llm_meta.get("model") or ""),
        "prompt_template": system_prompt,
        "dataset_available": bool(df is not None and not df.empty),
        "supported_modes": sorted(ALLOWED_MODES),
    }



def generate_mode_response_from_session(
    *,
    mode: str,
    user_prompt: str | None,
    session: Any | None,
    supporting_payload: Dict[str, Any] | None = None,
    sample_size: int = 4000,
) -> Dict[str, Any]:
    return generate_mode_response(
        mode=mode,
        user_prompt=user_prompt,
        df=resolve_context_dataframe(session, sample_size=sample_size),
        supporting_payload=supporting_payload,
    )


def build_generate_options(endpoint_name: str) -> Dict[str, Any]:
    default_mode = DEFAULT_MODE_BY_ENDPOINT.get(endpoint_name, "chat")
    return {
        "supported_modes": sorted(ALLOWED_MODES),
        "default_mode": default_mode,
        "query_flag": "generate=true",
        "prompt_param": "prompt",
        "mode_param": "mode",
        "examples": [
            f"/api/{endpoint_name}?generate=true",
            f"/api/{endpoint_name}?generate=true&mode={default_mode}",
            f"/api/{endpoint_name}?generate=true&mode=chat&prompt=Summarize%20this%20dataset",
        ],
    }
