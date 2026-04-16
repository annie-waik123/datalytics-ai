from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
from pandas.api.types import is_categorical_dtype, is_datetime64_any_dtype, is_numeric_dtype

log = logging.getLogger(__name__)

from services.analytics_service import load_analysis_frame
from services.llm_service import groq_chat, has_groq_config

ALLOWED_MODES = {
    "recommendation_insights",
    "ai_insights",
    "chat",
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
You are an advanced AI Data Analyst, Business Intelligence Expert, and AI Insight Engine.

Your role is to:
- Analyze structured datasets (CSV, tables, business data)
- Provide high-level business recommendations
- Generate deep AI-driven insights
- Answer normal user queries when needed

You must dynamically adapt based on the MODE provided.

-------------------------
MODE HANDLING:
-------------------------

There are 3 modes:

1. MODE = "recommendation_insights"
2. MODE = "ai_insights"
3. MODE = "chat"

-------------------------
GENERAL RULES (APPLY ALWAYS):
-------------------------

- Be professional and concise
- Use bullet points and structured output
- Focus on real-world business impact
- Avoid generic answers
- Think like a senior business analyst or data scientist
- If dataset is available -> analyze deeply
- If dataset is missing -> ask relevant questions or give general insights

-------------------------
MODE 1: RECOMMENDATION & INSIGHTS
-------------------------

If MODE = "recommendation_insights", then:

Act as a Senior Business Analyst and generate HIGH-LEVEL BUSINESS RECOMMENDATIONS.

Output strictly in this format:

1. Key Findings:
- Sales trends (increase/decrease)
- Revenue patterns
- Profit insights

2. Business Problems:
- Identify issues (sales drop, low profit, etc.)
- Possible reasons behind them

3. Strategic Recommendations:
- Actionable steps to improve business
- Industry-level solutions
- Optimization strategies

4. Opportunities:
- Growth areas
- Untapped markets or segments

5. Risk Analysis:
- Potential risks
- Future threats

6. Final Summary:
- Short executive summary of the business situation

-------------------------
MODE 2: AI INSIGHTS
-------------------------

If MODE = "ai_insights", then:

Act as an AI-powered Data Intelligence Engine.

Generate DEEP AI-LEVEL INSIGHTS.

Output strictly in this format:

1. Pattern Recognition:
- Hidden trends
- Seasonality or anomalies

2. Predictive Insights:
- Future sales/profit trends
- Likely outcomes

3. Customer Intelligence:
- Behavior patterns
- Segmentation insights
- Retention signals

4. Performance Drivers:
- Factors affecting growth or decline

5. Advanced AI Observations:
- Non-obvious insights
- Correlations between variables

6. Smart Suggestions:
- AI-driven recommendations
- Data-backed decisions

7. Insight Summary:
- High-level intelligent conclusion

-------------------------
MODE 3: NORMAL CHAT
-------------------------

If MODE = "chat", then:

Act as a helpful AI assistant.

- Answer user queries clearly
- If dataset is present -> include data-based insights
- If general query -> answer normally
- Keep responses simple, clear, and helpful

-------------------------
EXTRA INTELLIGENCE LAYER:
-------------------------

If dataset is provided, ALWAYS try to:
- Detect trends
- Identify anomalies
- Compare performance (time/category)
- Highlight key metrics (sales, profit, growth)

If possible, include:
- "Key Metric Highlights"
- "Important Observations"

-------------------------
RESTRICTIONS:
-------------------------

- Do NOT give vague answers
- Do NOT ignore business context
- Do NOT mix formats between modes
- Stick strictly to the output format of the selected MODE

-------------------------
FINAL INSTRUCTION:
-------------------------

Always first check MODE, then generate response accordingly.
Ensure output is structured, insightful, and industry-level.
""".strip()


def load_system_prompt() -> str:
    try:
        prompt_text = PROMPT_TEMPLATE_PATH.read_text(encoding="utf-8").strip()
    except Exception:
        prompt_text = ""
    return prompt_text or FALLBACK_SYSTEM_PROMPT


SYSTEM_PROMPT = load_system_prompt()


def normalize_mode(mode: str | None, default_mode: str = "chat") -> str:
    candidate = str(mode or default_mode).strip().lower()
    if candidate not in ALLOWED_MODES:
        return default_mode
    return candidate


def get_default_request(mode: str) -> str:
    return DEFAULT_REQUEST_BY_MODE.get(mode, DEFAULT_REQUEST_BY_MODE["chat"])


def infer_mode_from_prompt(prompt: str | None, default_mode: str = "chat") -> str:
    lower_prompt = str(prompt or "").strip().lower()
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
    dataset_context = build_dataset_context(df)
    supporting_context = summarize_existing_payload(supporting_payload)
    effective_request = str(user_prompt or "").strip() or get_default_request(normalized_mode)
    prompt = build_user_prompt(
        mode=normalized_mode,
        user_prompt=effective_request,
        dataset_context=dataset_context,
        supporting_context=supporting_context,
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    content = ""
    source = "local_fallback"
    error_message = None

    try:
        if has_groq_config():
            content = groq_chat(messages)
            source = "groq"
    except Exception as exc:
        error_message = str(exc)
        content = ""

    if not content:
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
        "prompt_template": SYSTEM_PROMPT,
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
