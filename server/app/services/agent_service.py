"""
AI Data Analyst agent service (Feature 1).

The agent interprets a free-form request (e.g. "Why are customers churning?",
"Find the biggest business opportunities", "Find unusual patterns") and then
executes a toolchain of REAL analysis operations against the session dataset:

  request understanding → dataset inspection → quality/missing analysis →
  EDA + correlations → distributions/outliers → visualizations →
  (optional) ML task detection + model comparison → recommendations.

Rules:
  - The LLM never fabricates numbers. Every metric, finding and recommendation
    is computed by pandas/plotly/sklearn from the actual dataset. The LLM is
    only used at the very end to write a plain-English narrative of the
    computed digest (and is skipped entirely when no LLM is configured).
  - ML model comparison only runs when the request is explicitly predictive
    (or a strong target is obvious, e.g. a churn column) and the dataset is
    manageable; it never mutates the user's canonical training session state.
  - Analysis is read-only: the user's uploaded DataFrame is never modified.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Callable, Optional

import pandas as pd

from app.services.analytics_service import load_analysis_frame
from app.services.dashboard_service import render_dashboard_widget
from app.services.eda_service import build_eda_summary, detect_datetime_columns
from app.services.llm_service import groq_chat, has_llm_config
from app.services.ml_service import sanitize_for_json, preprocess, train_supervised
from app.services.nl_analytics_service import _group_rows, _monthly_bucket_series
from app.services.recommendation_service import get_data_quality_score, get_statistical_insights
from app.services.visualization_service import render_visualization_chart

log = logging.getLogger(__name__)

AGENT_ANALYSIS_SAMPLE_ROWS = 20_000
AGENT_ML_SAMPLE_ROWS = 6_000
MAX_CHARTS = 3
MAX_FINDINGS = 9
MAX_RECOMMENDATIONS = 6

CHURN_WORDS = ("churn", "attrition", "left the", "left us", "cancel", "why leave", "why are customers", "exited")
OPPORTUNITY_WORDS = ("opportunit", "growth", "grow", "improve", "optim", "invest", "untapped", "biggest",
                     "best segment", "upsell", "cross-sell", "expand")
ANOMALY_WORDS = ("unusual", "anomal", "outlier", "strange", "irregular", "pattern", "suspicious", "abnormal")
TREND_WORDS = ("trend", "falling", "declining", "decline", "rising", "growth", "monthly", "over time", "drop")
ML_EXPLICIT_WORDS = ("predict", "prediction", "forecast", "model", "train", "classify", "regression",
                     "risk score", "churn drivers", "drivers of churn", "what drives", "ml")
TARGET_NAME_HINTS = ("churn", "attrition", "left", "exited", "exit", "is_cancel", "canceled", "cancelled",
                     "churned", "response", "converted", "bought", "purchased", "default", "survived")

STEPS: list[dict[str, str]] = [
    {"key": "understanding", "label": "Understanding request"},
    {"key": "dataset", "label": "Inspecting dataset"},
    {"key": "quality", "label": "Profiling data quality"},
    {"key": "eda", "label": "Running EDA & checking correlations"},
    {"key": "outliers", "label": "Analyzing distributions & outliers"},
    {"key": "charts", "label": "Generating visualizations"},
    {"key": "ml", "label": "Comparing relevant models"},
    {"key": "recommendations", "label": "Generating recommendations"},
    {"key": "summary", "label": "Writing summary"},
]


# ── Request understanding (deterministic; no fake state) ────────────────────

def _detect_focus(request: str) -> dict[str, Any]:
    lower = str(request or "").lower()
    focus = "overview"
    if any(word in lower for word in CHURN_WORDS):
        focus = "churn"
    elif any(word in lower for word in ANOMALY_WORDS):
        focus = "anomaly"
    elif any(word in lower for word in TREND_WORDS):
        focus = "trend"
    elif any(word in lower for word in OPPORTUNITY_WORDS):
        focus = "opportunity"
    if any(word in lower for word in ML_EXPLICIT_WORDS):
        focus = "prediction" if focus == "overview" else focus
    if focus in {"churn", "prediction"}:
        wants_ml = True
    else:
        wants_ml = bool(any(word in lower for word in ML_EXPLICIT_WORDS))
    return {"focus": focus, "wants_ml": wants_ml}


def _format(value: Any) -> str:
    try:
        number = float(value)
    except Exception:
        return str(value)
    if number != number or number in (float("inf"), float("-inf")):
        return "N/A"
    if abs(number) >= 1000:
        return f"{number:,.1f}"
    if abs(number) >= 100:
        return f"{number:,.2f}"
    return f"{number:,.3f}".rstrip("0").rstrip(".")


def _json_object(text: str) -> Optional[dict[str, Any]]:
    cleaned = str(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    match = re.search(r"\{[\s\S]*\}", cleaned)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            return None
    return None


def _llm_narrative(request: str, digest: list[str], metrics: list[dict[str, Any]]) -> str:
    if not has_llm_config():
        return ""
    system_prompt = (
        "You are the explanation engine of an AI data analyst. Write a short, human, confident "
        "summary of the analysis just completed. STRICT RULES: never invent a number or a fact — "
        "only restate figures that appear in the COMPUTED FACTS section. If you need a detail that "
        "is not present, phrase it generally. Keep it to 2-4 sentences."
    )
    metric_facts = "; ".join(f"{item.get('label')}: {item.get('formatted') or item.get('value')}" for item in metrics[:10])
    try:
        content = groq_chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": (
                    f"USER REQUEST: {request}\n\n"
                    f"COMPUTED FACTS:\n" + "\n".join(digest[:28]) + f"\n{metric_facts}\n\n"
                    "Write the summary now."
                )},
            ],
            max_tokens=420,
            temperature=0.25,
        )
    except Exception as exc:
        log.warning("agent_service: narrative generation failed: %s", exc)
        return ""
    return str(content or "").strip()


# ── Public entry point ───────────────────────────────────────────────────────

def run_agent(
    session,
    session_id: str,
    request: str,
    *,
    emit: Optional[Callable[[dict[str, Any]], None]] = None,
    mode: str = "auto",
    include_ml: Optional[bool] = None,
    include_charts: Optional[bool] = None,
    max_charts: int = MAX_CHARTS,
) -> dict[str, Any]:
    """
    Execute the agent toolchain and return the structured report.

    `emit` receives progress events while running:
      {"type": "plan", "steps": [...]}
      {"type": "step", "key", "status": running|done|skipped|error, "detail", "duration_ms"}
      {"type": "result", "report": {...}}
    """
    started = time.monotonic()
    events: list[dict[str, Any]] = []

    def out(event: dict[str, Any]) -> None:
        if emit is not None:
            try:
                emit(event)
            except Exception:
                pass
        else:
            events.append(event)

    def step_start(key: str) -> None:
        out({"type": "step", "key": key, "status": "running"})

    def step_done(key: str, *, status: str = "done", detail: Optional[str] = None,
                  error: Optional[str] = None, elapsed: Optional[float] = None) -> None:
        out({"type": "step", "key": key, "status": status, "detail": detail,
             "error": error, "duration_ms": elapsed})

    actions: list[dict[str, Any]] = []
    findings: list[dict[str, Any]] = []
    recommendations: list[dict[str, Any]] = []
    metrics: list[dict[str, Any]] = []
    visualizations: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    limitations: list[str] = []
    warnings: list[str] = []
    digest: list[str] = []
    summary: dict[str, Any] = {}
    schema_info: dict[str, Any] = {}
    chart_ids_by_label: dict[str, list[str]] = {}
    total_rows = 0

    out({"type": "plan", "steps": STEPS})

    # ── 1. Understanding request ─────────────────────────────────────────────
    step_start("understanding")
    t0 = time.monotonic()
    focus_meta = _detect_focus(request)
    understanding_detail = (
        f"Request categorized as {focus_meta['focus']} analysis."
        if focus_meta["focus"] != "overview"
        else "Open-ended request — running a full dataset review."
    )
    step_done("understanding", detail=understanding_detail, elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("understanding", "Understanding request", "done", understanding_detail, start=t0))

    # ── 2. Inspecting dataset ────────────────────────────────────────────────
    step_start("dataset")
    t0 = time.monotonic()
    try:
        if session.df is None and not session.dataset_snapshot:
            raise ValueError("No dataset is loaded in this session. Upload a dataset first.")
        frame = load_analysis_frame(session, sample_size=AGENT_ANALYSIS_SAMPLE_ROWS)
        if frame is None or frame.empty:
            raise ValueError("The dataset is empty — nothing to analyze yet.")
        total_rows = int(session.dataset_row_count or 0) or int(len(frame))
        sampled = total_rows > len(frame)
        if sampled:
            limitations.append(
                f"Analyses use a {len(frame):,}-row sample of the {total_rows:,}-row dataset for speed."
            )
        numeric_cols = [str(c) for c in frame.select_dtypes(include=["number"]).columns.tolist()]
        datetime_cols = [str(c) for c in detect_datetime_columns(frame)]
        categorical_cols = [str(c) for c in frame.columns if str(c) not in numeric_cols and str(c) not in datetime_cols]
        schema_info = {
            "name": session.dataset_name or "Dataset",
            "rows": total_rows,
            "cols": int(frame.shape[1]),
            "sampled": sampled,
            "numeric": numeric_cols,
            "categorical": categorical_cols,
            "datetime": datetime_cols,
            "all": [str(c) for c in frame.columns.tolist()],
        }
        metrics.append({"label": "Rows", "value": total_rows, "formatted": f"{total_rows:,}"})
        metrics.append({"label": "Columns", "value": frame.shape[1], "formatted": str(frame.shape[1])})
        detail = (
            f"{total_rows:,} rows × {frame.shape[1]} columns — {len(numeric_cols)} numeric, "
            f"{len(categorical_cols)} categorical, {len(datetime_cols)} date."
        )
        digest.append(f"Dataset '{schema_info['name']}' has {total_rows:,} rows and {frame.shape[1]} columns.")
        step_done("dataset", detail=detail, elapsed=(time.monotonic() - t0) * 1000)
    except Exception as exc:
        step_done("dataset", status="error", error=str(exc), elapsed=(time.monotonic() - t0) * 1000)
        actions.append(_action("dataset", "Inspecting dataset", "error", error=str(exc), start=t0))
        return _final_report(request, "auto", actions, findings, recommendations, metrics,
                             visualizations, tables, limitations, warnings, summary,
                             schema_info, digest, events, out, emit, started)
    actions.append(_action("dataset", "Inspecting dataset", "done", detail, start=t0))

    # ── 3. Profiling data quality ────────────────────────────────────────────
    step_start("quality")
    t0 = time.monotonic()
    quality_detail = ""
    quality_status = "done"
    quality_error: Optional[str] = None
    try:
        summary = build_eda_summary(frame)
        quality = summary.get("quality", {})
        missing_total = int(quality.get("missing_total", 0))
        duplicate_rows = int(quality.get("duplicate_rows", 0))
        constant_columns = quality.get("constant_columns", []) or []
        quality_detail = (
            f"Missing cells: {missing_total:,} | duplicate rows: {duplicate_rows:,}"
            + (f" | constant columns: {', '.join(str(c) for c in constant_columns[:3])}" if constant_columns else "")
        )
        if missing_total:
            digest.append(f"{missing_total:,} missing cells detected; top columns: "
                          + ", ".join(f"{item['column']} ({item['missing_pct']}%)"
                                      for item in (quality.get("missing_by_column") or [])[:3]))
            top_missing = (quality.get("missing_by_column") or [{}])[0]
            findings.append({
                "title": f"'{top_missing.get('column', 'a column')}' has the most missing values",
                "summary": (f"{top_missing.get('missing', 0):,} cells ({top_missing.get('missing_pct', 0)}%) are empty in "
                            f"'{top_missing.get('column')}', the highest of {len(quality.get('missing_by_column') or [])} "
                            f"affected column(s)."),
                "category": "Data quality", "severity": "warning",
                "evidence": [f"missing_total={missing_total}",
                             f"top_missing_column={top_missing.get('column')}",
                             f"missing_pct={top_missing.get('missing_pct', 0)}%"],
            })
        if duplicate_rows:
            digest.append(f"{duplicate_rows:,} exact duplicate rows exist ({quality.get('duplicate_pct', 0)}%).")
            findings.append({
                "title": "Duplicate records may distort the analysis",
                "summary": f"{duplicate_rows:,} rows ({quality.get('duplicate_pct', 0)}%) are exact duplicates.",
                "category": "Data quality", "severity": "warning",
                "evidence": [f"duplicate_rows={duplicate_rows}"],
            })
        if constant_columns:
            digest.append(f"Constant (single-value) columns: {', '.join(map(str, constant_columns[:5]))}.")
        metrics.append({"label": "Missing cells", "value": missing_total, "formatted": f"{missing_total:,}"})
        metrics.append({"label": "Duplicate rows", "value": duplicate_rows, "formatted": f"{duplicate_rows:,}"})
    except Exception as exc:
        quality_status = "error"
        quality_error = str(exc)
        log.warning("agent quality step failed: %s", exc)
    step_done("quality", status=quality_status, detail=quality_detail or quality_error,
              error=quality_error, elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("quality", "Profiling data quality", quality_status, quality_detail or quality_error,
                           error=quality_error, start=t0))

    # ── 4. EDA + correlations ────────────────────────────────────────────────
    step_start("eda")
    t0 = time.monotonic()
    eda_detail = ""
    eda_status = "done"
    eda_error: Optional[str] = None
    try:
        if not summary:
            summary = build_eda_summary(frame)
        high_pairs = (summary.get("correlation") or {}).get("high_pairs", []) or []
        insight_cards = (summary.get("insights") or {}).get("cards", []) or []
        highlights = summary.get("highlights", {}) or {}
        eda_parts = []
        if high_pairs:
            top_pair = high_pairs[0]
            eda_parts.append(f"strongest correlation {top_pair['left']}–{top_pair['right']} = {top_pair['correlation']:.3f}")
            digest.append(f"{top_pair['left']} and {top_pair['right']} correlate at "
                          f"{float(top_pair['correlation']):+.3f} (strongest pair).")
            findings.append({
                "title": f"'{top_pair['left']}' and '{top_pair['right']}' move together",
                "summary": (f"They share a correlation of {float(top_pair['correlation']):+.3f}. Treat them as "
                            f"related signals — including both as model features can inflate multicollinearity."),
                "category": "Correlation", "severity": "info",
                "evidence": [f"correlation={float(top_pair['correlation']):.3f}"],
            })
        if len(high_pairs) > 1:
            for pair in high_pairs[1:3]:
                digest.append(f"{pair['left']}–{pair['right']} correlation {float(pair['correlation']):+.3f}.")
        top_skew = (highlights.get("high_skew") or [{}])[0]
        if top_skew and abs(float(top_skew.get("skewness") or 0)) >= 1:
            eda_parts.append(f"most skewed column {top_skew['column']} ({top_skew['skewness']:.2f})")
            digest.append(f"{top_skew['column']} is highly skewed ({top_skew['skewness']:.2f}).")
        for card in insight_cards[:3]:
            digest.append(f"{card.get('title')}: {card.get('summary')} — {card.get('action')}")
        eda_detail = "; ".join(eda_parts) or "No standout signals in sampled rows."
        if not eda_parts and not high_pairs:
            eda_detail = "EDA completed — no extreme correlations or skew in the sample."
        # Statistical insights (quality/service reuse) for extra evidence.
        stat_insights = get_statistical_insights(frame)[:4]
        for item in stat_insights:
            digest.append(f"{item.get('title')} — {item.get('description')}")
        summary["_stat_insights"] = stat_insights
    except Exception as exc:
        eda_status = "error"
        eda_error = str(exc)
        log.warning("agent eda step failed: %s", exc)
    step_done("eda", status=eda_status, detail=eda_detail or eda_error, error=eda_error,
              elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("eda", "Running EDA & checking correlations", eda_status, eda_detail or eda_error,
                           error=eda_error, start=t0))

    # ── 5. Distributions & outliers ──────────────────────────────────────────
    step_start("outliers")
    t0 = time.monotonic()
    outlier_detail = ""
    outlier_status = "done"
    outlier_error: Optional[str] = None
    try:
        outlier_report = (summary.get("outliers") or {})
        iqr_rows = outlier_report.get("iqr", []) or []
        flagged = [row for row in iqr_rows if int(row.get("count", 0)) > 0]
        zscore_rows = outlier_report.get("zscore", []) or []
        zscore_flagged = [row for row in zscore_rows if int(row.get("count", 0)) > 0]
        distribution = summary.get("distribution", []) or []
        skew_rows = [row for row in distribution if abs(float(row.get("skewness") or 0)) >= 1]
        parts = []
        if flagged:
            top_outlier = max(flagged, key=lambda row: int(row.get("count", 0)))
            parts.append(f"outliers in {top_outlier['column']} ({top_outlier['count']} IQR) in {len(flagged)} column(s)")
            digest.append(f"{len(flagged)} numeric column(s) contain IQR outliers; "
                          f"{top_outlier['column']} has {top_outlier['count']}.")
            findings.append({
                "title": f"'{top_outlier['column']}' contains the most outliers",
                "summary": (f"{top_outlier['count']} values sit outside the 1.5×IQR bounds "
                            f"[{_format(top_outlier.get('lower_bound'))}, {_format(top_outlier.get('upper_bound'))}]. "
                            f"Verify whether they are data errors or genuine extremes worth investigating."),
                "category": "Outliers", "severity": "warning" if int(top_outlier.get("count", 0)) > 5 else "info",
                "evidence": [f"iqr_outlier_count={top_outlier['count']}",
                             f"lower_bound={_format(top_outlier.get('lower_bound'))}",
                             f"upper_bound={_format(top_outlier.get('upper_bound'))}"],
            })
        if zscore_flagged:
            extreme = max(zscore_flagged, key=lambda row: int(row.get("count", 0)))
            digest.append(f"{extreme['column']} has {extreme['count']} values beyond 3 standard deviations.")
        if skew_rows:
            parts.append(f"{len(skew_rows)} skewed column(s)")
            top_skew_row = max(skew_rows, key=lambda row: abs(float(row.get("skewness") or 0)))
            digest.append(f"Skewed distributions: {', '.join(row['column'] for row in skew_rows[:4])}.")
            findings.append({
                "title": f"'{top_skew_row['column']}' has a skewed distribution",
                "summary": (f"Skewness is {float(top_skew_row.get('skewness', 0)):.2f}. Averages can be misleading here — "
                            f"consider the median or a log-style transform before modeling."),
                "category": "Distribution", "severity": "info",
                "evidence": [f"skewness={float(top_skew_row.get('skewness', 0)):.2f}"],
            })
        if not flagged and not skew_rows:
            parts.append("no significant outliers or skew in the sample")
        outlier_detail = "; ".join(parts) if parts else "No outlier or skew issues found in the sample."
    except Exception as exc:
        outlier_status = "error"
        outlier_error = str(exc)
        log.warning("agent outlier step failed: %s", exc)
    step_done("outliers", status=outlier_status, detail=outlier_detail or outlier_error, error=outlier_error,
              elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("outliers", "Analyzing distributions & outliers", outlier_status,
                           outlier_detail or outlier_error, error=outlier_error, start=t0))

    # ── 6. Visualizations (real figures from existing renderers) ─────────────
    step_start("charts")
    t0 = time.monotonic()
    chart_detail = ""
    chart_status = "done"
    chart_error: Optional[str] = None
    should_chart = True
    if include_charts is False:
        should_chart = False
        chart_status = "skipped"
        chart_detail = "Chart generation disabled for this request."
    try:
        if should_chart:
            chart_count = 0
            numeric_cols = schema_info.get("numeric", [])
            categorical_cols = schema_info.get("categorical", [])
            datetime_cols = schema_info.get("datetime", [])

            # A) Top segments by a numeric measure.
            if numeric_cols and categorical_cols and chart_count < max_charts:
                try:
                    dimension = _pick_dimension(frame, request, categorical_cols, numeric_cols, schema_info)
                    metric = _pick_metric(frame, request, numeric_cols, dimension, schema_info)
                    rows = _group_rows(frame, dimension, metric, "sum", 10)
                    if rows:
                        total_for_share = float(sum(float(row["value"]) for row in rows)) or 1.0
                        tables.append({
                            "title": f"Top groups by {metric or 'count'} — {dimension}",
                            "columns": ["Rank", "Group", metric or "count", "% of shown total"],
                            "rows": [{"Rank": index + 1, "Group": row["label"],
                                      metric or "count": _format(row["value"]),
                                      "% share": row["share_pct"]}
                                     for index, row in enumerate(rows)],
                        })
                        chart_frame = pd.DataFrame([{"__label__": row["label"], "__metric__": row["value"]} for row in rows])
                        chart_result = render_visualization_chart(chart_frame, {
                            "chart_key": "bar_chart", "chart_type": "bar_chart",
                            "x_column": "__label__", "y_column": "__metric__", "theme": "dark",
                        })
                        if not chart_result.get("figure"):
                            raise RuntimeError(chart_result.get("error") or "bar chart returned no figure")
                        visualizations.append({
                            "id": "agent-chart-1",
                            "title": f"{metric or 'Records'} by {dimension}",
                            "chart_type": "bar_chart",
                            "figure": chart_result["figure"],
                            "insight": chart_result.get("note"),
                        })
                        chart_ids_by_label["top_group"] = ["agent-chart-1"]
                        chart_count += 1
                        digest.append(f"Top group in {dimension}: {rows[0]['label']} at {_format(rows[0]['value'])} "
                                      f"({rows[0]['share_pct']}% of the shown total).")
                        _segment_finding(rows, dimension, metric, findings, digest, "agent-chart-1")
                except Exception as exc:
                    warnings.append(f"Segment chart skipped: {exc}")

            # B) Time trend when a date column exists.
            if datetime_cols and numeric_cols and chart_count < max_charts:
                try:
                    date_column = datetime_cols[0]
                    metric = _pick_metric(frame, request, numeric_cols, None, schema_info, fallback_first=True)
                    series = _monthly_bucket_series(frame, date_column, metric, "sum")
                    if len(series) >= 2:
                        chart_frame = series.rename(columns={"value": "__metric__"})
                        chart_result = render_visualization_chart(chart_frame, {
                            "chart_key": "line_chart", "chart_type": "line_chart",
                            "x_column": "__period__", "y_column": "__metric__", "theme": "dark",
                        })
                        if not chart_result.get("figure"):
                            raise RuntimeError(chart_result.get("error") or "line chart returned no figure")
                        visualizations.append({
                            "id": "agent-chart-2",
                            "title": f"{metric or 'Records'} over time ({date_column})",
                            "chart_type": "line_chart",
                            "figure": chart_result["figure"],
                            "insight": chart_result.get("note"),
                        })
                        chart_ids_by_label["trend"] = ["agent-chart-2"]
                        chart_count += 1
                        values = pd.to_numeric(series["value"], errors="coerce").dropna()
                        first_v, last_v = float(values.iloc[0]), float(values.iloc[-1])
                        direction = "upward" if last_v >= first_v else "downward"
                        change = ((last_v - first_v) / max(abs(first_v), 1e-9)) * 100
                        digest.append(f"Overall {direction} trend in {metric or 'records'}: {change:+.1f}% "
                                      f"across the sampled date range.")
                        if focus_meta["focus"] == "trend":
                            findings.append({
                                "title": f"{metric or 'Records'} trend is {direction}",
                                "summary": (f"Between the first and last sampled periods the measure moved "
                                            f"{change:+.1f}%. Inspect the line chart for the exact turning point."),
                                "category": "Trend", "severity": "info",
                                "evidence": [f"direction={direction}", f"change_pct={change:+.1f}"],
                                "chart_ids": ["agent-chart-2"],
                            })
                except Exception as exc:
                    warnings.append(f"Trend chart skipped: {exc}")

            # C) Correlation matrix / histogram for the third slot.
            if len(numeric_cols) >= 3 and chart_count < max_charts:
                try:
                    result = render_visualization_chart(frame, {
                        "chart_key": "correlation_matrix", "chart_type": "correlation_matrix",
                        "selected_columns": numeric_cols[:10], "theme": "dark",
                    })
                    if result.get("figure"):
                        visualizations.append({
                            "id": "agent-chart-3",
                            "title": "Correlation matrix",
                            "chart_type": "correlation_matrix",
                            "figure": result["figure"],
                            "insight": result.get("note"),
                        })
                        chart_ids_by_label["correlation"] = ["agent-chart-3"]
                        chart_count += 1
                    elif result.get("error"):
                        warnings.append(f"Correlation matrix chart failed: {result['error']}")
                except Exception as exc:
                    warnings.append(f"Correlation matrix chart skipped: {exc}")
            elif numeric_cols and chart_count < max_charts and summary.get("statistics", {}).get("numeric"):
                try:
                    top_var = sorted(summary["statistics"]["numeric"],
                                     key=lambda item: abs(float(item.get("std") or 0)), reverse=True)[0]
                    result = render_visualization_chart(frame, {
                        "chart_key": "histogram", "chart_type": "histogram",
                        "column": top_var["column"], "bins": 30, "theme": "dark",
                    })
                    if result.get("figure"):
                        visualizations.append({
                            "id": "agent-chart-3",
                            "title": f"Distribution — {top_var['column']}",
                            "chart_type": "histogram",
                            "figure": result["figure"],
                            "insight": result.get("note"),
                        })
                        chart_count += 1
                except Exception as exc:
                    warnings.append(f"Distribution chart skipped: {exc}")

            if visualizations:
                chart_detail = f"{len(visualizations)} chart(s) generated on real sampled data."
            else:
                chart_status = "skipped"
                if warnings:
                    chart_detail = "No chart could be generated. Issues: " + "; ".join(warnings[-2:])
                else:
                    chart_detail = "Dataset has no plottable numeric/categorical mix for an automatic chart."
    except Exception as exc:
        chart_status = "error"
        chart_error = str(exc)
        log.warning("agent charts step failed: %s", exc)
    step_done("charts", status=chart_status, detail=chart_detail or chart_error, error=chart_error,
              elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("charts", "Generating visualizations", chart_status, chart_detail or chart_error,
                           error=chart_error, start=t0))

    # ── 7. ML task detection + model comparison (only when appropriate) ──────
    step_start("ml")
    t0 = time.monotonic()
    ml_detail = ""
    ml_status = "skipped"
    ml_error: Optional[str] = None
    ml_payload: dict[str, Any] = {}
    run_ml = include_ml if include_ml is not None else focus_meta.get("wants_ml", False)
    target_column: Optional[str] = None
    if run_ml:
        target_column = _detect_target(frame, schema_info, request)
        if not target_column:
            run_ml = False
            ml_detail = "No obvious target column for supervised modeling (skipped)."
    if run_ml and total_rows > 200_000:
        run_ml = False
        ml_detail = "Dataset is very large — model comparison skipped (use the Prediction pipeline for full training)."
        limitations.append("Model comparison was skipped on the full dataset; use the Prediction workspace for large-scale training.")
    try:
        if run_ml:
            ml_frame = load_analysis_frame(session, sample_size=AGENT_ML_SAMPLE_ROWS)
            if ml_frame is None or ml_frame.empty or target_column not in ml_frame.columns:
                raise ValueError(f"Target column '{target_column}' is not available in the training sample.")
            if focus_meta.get("focus") == "churn" or _looks_like_outcome(target_column):
                _append_churn_signal(ml_frame, target_column, metrics, findings, digest)
            ml_detail_parts = []
            result = preprocess(
                df=ml_frame,
                target_col=str(target_column),
                task_type="Auto",
                missing_strategy="Drop rows with missing values",
                encode_method="Auto",
                scaling_method="None",
                test_size=0.2,
                random_state=42,
            )
            task_type = str(result.get("task_type") or "Classification")
            train_result = train_supervised(
                X_train=result["X_train"], y_train=result["y_train"],
                X_test=result["X_test"], y_test=result["y_test"],
                task_type=task_type,
            )
            model_results = train_result.get("model_results")
            primary_metric = train_result.get("primary_metric") or (
                "Accuracy" if task_type == "Classification" else "R2 Score"
            )
            rows = []
            for _, row in model_results.iterrows():
                entry = {"Model": str(row.get("Model", ""))}
                for column in model_results.columns:
                    if column == "Model":
                        continue
                    entry[str(column)] = _format(row[column]) if column != "Model" else row[column]
                rows.append(entry)
            tables.append({"title": f"Model comparison — {task_type} (target: {target_column})",
                           "columns": [str(column) for column in model_results.columns if column != "Model"],
                           "rows": rows})
            best_name = str(train_result.get("best_model_name") or "")
            best_metrics = dict(train_result.get("best_metrics") or {})
            best_score = best_metrics.get(primary_metric)
            ml_payload = {
                "task_type": task_type,
                "target_column": target_column,
                "best_model": best_name,
                "primary_metric": primary_metric,
                "best_score": best_score,
                "train_rows_used": train_result.get("train_rows_used"),
                "test_rows_used": train_result.get("test_rows_used"),
                "models_compared": train_result.get("models_considered") or [],
                "errors": train_result.get("errors") or [],
            }
            metrics.append({"label": f"Best model ({primary_metric})",
                            "value": best_score,
                            "formatted": f"{best_name}: {_format(best_score)}",
                            "hint": f"{task_type} on target '{target_column}'"})
            ml_detail_parts.append(f"trained {len(rows)} models ({task_type}, target '{target_column}')")
            ml_detail_parts.append(f"best: {best_name} ({primary_metric} {_format(best_score)})")
            ml_detail = "; ".join(ml_detail_parts)
            digest.append(f"Auto-selected '{target_column}' as target ({task_type}). "
                          f"Best model: {best_name} with {primary_metric} {_format(best_score)} on the sampled test set.")
            findings.append({
                "title": f"'{target_column}' can be predicted — best model {best_name}",
                "summary": (f"Comparing models for the task, the best reached {primary_metric} {_format(best_score)} "
                            f"on held-out rows. Drivers worth investigating are in the feature analysis."),
                "category": "Machine learning", "severity": "success",
                "evidence": [f"task_type={task_type}", f"primary_metric={primary_metric}",
                             f"best_score={_format(best_score)}"],
            })
            # Feature importance for interpretable models.
            best_model = train_result.get("best_model")
            if best_model is not None and hasattr(best_model, "feature_importances_"):
                try:
                    importances = best_model.feature_importances_
                    feature_cols = list(result.get("feature_columns") or [])
                    ranked = sorted(zip(feature_cols, importances), key=lambda item: item[1], reverse=True)[:8]
                    digest.append("Top predictive features: " +
                                  ", ".join(f"{feature} ({float(imp):.3f})" for feature, imp in ranked))
                except Exception:
                    pass
            ml_status = "done"
    except Exception as exc:
        ml_status = "error"
        ml_error = str(exc)
        log.warning("agent ml step failed: %s", exc)
        ml_detail = f"Model comparison could not complete: {exc}"
        limitations.append("ML comparison was skipped because it failed on this dataset — the Prediction "
                           "workspace can run it with explicit settings.")
    step_done("ml", status=ml_status, detail=ml_detail, error=ml_error, elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("ml", "Comparing relevant models", ml_status, ml_detail, error=ml_error, start=t0))

    # ── 8. Recommendations (computed from real signals) ──────────────────────
    step_start("recommendations")
    t0 = time.monotonic()
    rec_detail = ""
    rec_status = "done"
    rec_error: Optional[str] = None
    try:
        recommendations, rec_detail = _build_recommendations(
            request=request,
            frame=frame,
            schema_info=schema_info,
            focus=focus_meta.get("focus", "overview"),
            summary=summary,
            ml_payload=ml_payload,
            findings=findings,
            digest=digest,
        )
    except Exception as exc:
        rec_status = "error"
        rec_error = str(exc)
        log.warning("agent recommendations step failed: %s", exc)
    step_done("recommendations", status=rec_status, detail=rec_detail or rec_error, error=rec_error,
              elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("recommendations", "Generating recommendations", rec_status,
                           rec_detail or rec_error, error=rec_error, start=t0))

    # ── 9. Summary narrative ─────────────────────────────────────────────────
    step_start("summary")
    t0 = time.monotonic()
    narrative = ""
    summary_status = "done"
    summary_error: Optional[str] = None
    try:
        narrative = _llm_narrative(request, digest, metrics)
    except Exception as exc:
        summary_error = str(exc)
        log.warning("agent summary step failed: %s", exc)
    if not narrative:
        narrative = _template_narrative(request, focus_meta, findings, recommendations, metrics, ml_payload)
    summary_status = "done" if narrative else "skipped"
    step_done("summary", status=summary_status,
              detail="Executive summary written." if narrative else "No summary could be produced.",
              elapsed=(time.monotonic() - t0) * 1000)
    actions.append(_action("summary", "Writing summary", summary_status,
                           "Executive summary written." if narrative else "Summary skipped.", start=t0))

    quality_obj = get_data_quality_score(frame)
    dataset_payload = {
        "name": schema_info.get("name", "Dataset"),
        "rows": schema_info.get("rows", 0),
        "cols": schema_info.get("cols", 0),
        "sampled": schema_info.get("sampled", False),
        "quality_score": quality_obj.get("overall_score"),
        "quality_grade": quality_obj.get("grade"),
        "columns": {"numeric": schema_info.get("numeric", []),
                    "categorical": schema_info.get("categorical", []),
                    "datetime": schema_info.get("datetime", [])},
    }
    if quality_obj.get("overall_score") is not None:
        metrics.append({"label": "Data quality score", "value": quality_obj.get("overall_score"),
                        "formatted": f"{quality_obj.get('overall_score')}/100 ({quality_obj.get('grade')})"})
    digest.append(f"Data quality grade: {quality_obj.get('grade')} ({quality_obj.get('overall_score')}/100).")

    for item in warnings:
        limitations.append(item)

    llm_used = bool(narrative) and has_llm_config() and narrative != _template_narrative(request, focus_meta,
                                                                                          findings, recommendations,
                                                                                          metrics, ml_payload)

    return _final_report(request, mode or "auto", actions, findings, recommendations, metrics,
                         visualizations, tables, limitations, warnings, {"narrative": narrative, **summary},
                         schema_info, digest, events, out, emit, started, dataset_payload=dataset_payload,
                         llm_used=llm_used)


# ── Internal helpers ─────────────────────────────────────────────────────────

def _action(key: str, label: str, status: str, detail: Optional[str] = None, *,
            error: Optional[str] = None, start: Optional[float] = None) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "status": status,
        "detail": detail,
        "error": error,
        "duration_ms": round((time.monotonic() - (start or time.monotonic())) * 1000, 1),
    }


def _final_report(request: str, mode: str, actions: list[dict[str, Any]],
                  findings: list[dict[str, Any]], recommendations: list[dict[str, Any]],
                  metrics: list[dict[str, Any]], visualizations: list[dict[str, Any]],
                  tables: list[dict[str, Any]], limitations: list[str], warnings: list[str],
                  summary: dict[str, Any], schema_info: dict[str, Any], digest: list[str],
                  events: list[dict[str, Any]], out: Any, emit: Any, started: float, *,
                  dataset_payload: Optional[dict[str, Any]] = None, llm_used: bool = False) -> dict[str, Any]:
    report = sanitize_for_json({
        "request": request,
        "mode": mode,
        "plan": STEPS,
        "actions": actions,
        "findings": findings[:MAX_FINDINGS],
        "recommendations": recommendations[:MAX_RECOMMENDATIONS],
        "metrics": metrics,
        "visualizations": visualizations,
        "tables": tables,
        "limitations": limitations[:10],
        "dataset": dataset_payload or {
            "name": schema_info.get("name", "Dataset"),
            "rows": schema_info.get("rows", 0),
            "cols": schema_info.get("cols", 0),
            "sampled": schema_info.get("sampled", False),
        },
        "confidence": _confidence(findings, actions, schema_info),
        "narrative": summary.get("narrative") or _template_narrative(request, {"focus": "overview", "wants_ml": False},
                                                                     findings, recommendations, metrics, {}),
        "llm_used": llm_used,
        "source": "agent",
        "error": None,
        "duration_ms": round((time.monotonic() - started) * 1000, 1),
    })
    out({"type": "result", "report": report})
    return report


def _confidence(findings: list[dict[str, Any]], actions: list[dict[str, Any]],
                schema_info: dict[str, Any]) -> str:
    errored = sum(1 for action in actions if action.get("status") == "error")
    if errored > len(actions) // 2 or not schema_info.get("cols"):
        return "low"
    if schema_info.get("sampled"):
        return "medium"
    return "high"


def _template_narrative(request: str, focus_meta: dict[str, Any], findings: list[dict[str, Any]],
                        recommendations: list[dict[str, Any]], metrics: list[dict[str, Any]],
                        ml_payload: dict[str, Any]) -> str:
    parts = [f"Analysis of “{request}” completed."]
    if findings:
        parts.append("Key signals: " + "; ".join(finding["title"] for finding in findings[:3] if finding))
    if metrics:
        lead = [metric for metric in metrics if metric.get("formatted")][:3]
        if lead:
            parts.append("Highlights: " + " | ".join(str(item.get("formatted")) for item in lead) + ".")
    if ml_payload.get("best_model"):
        parts.append(f"Best model for {ml_payload.get('target_column')}: {ml_payload.get('best_model')} "
                     f"({ml_payload.get('primary_metric')} {_format(ml_payload.get('best_score'))}).")
    return " ".join(parts)


OUTCOME_COLUMN_HINTS = ("churn", "attrition", "status", "flag", "response", "result", "outcome",
                        "converted", "purchased", "bought", "won", "lost", "left", "exited")
YES_WORDS = ("yes", "y", "1", "true", "churned", "left", "exited", "cancelled", "canceled")


def _looks_like_outcome(column: str) -> bool:
    normalized = _normalize(column)
    return any(hint in normalized for hint in OUTCOME_COLUMN_HINTS)


def _is_binary_outcome(frame: pd.DataFrame, column: str) -> bool:
    values = frame[column].dropna().astype(str).str.strip().str.lower()
    if values.nunique() != 2:
        return False
    return bool(values.isin(list(YES_WORDS)).any() or any(hint in _normalize(column) for hint in OUTCOME_COLUMN_HINTS))


def _pick_dimension(frame: pd.DataFrame, request: str, categorical_cols: list[str],
                    numeric_cols: list[str], schema_info: dict[str, Any]) -> Optional[str]:
    request_normalized = _normalize(request)
    request_lower = str(request or "").lower()
    mentions_outcome = any(word in request_lower for word in ("churn", "attrition", "status", "conversion"))
    scored: list[tuple[float, str]] = []
    for column in categorical_cols:
        unique = int(frame[column].astype(str).nunique(dropna=True))
        if not (2 <= unique <= 30):
            continue
        score = 0.0
        if _normalize(column) and _normalize(column) in request_normalized:
            score += 20.0
        tokens = set(re.findall(r"[a-z0-9]+", str(column).lower()))
        score += sum(1 for token in tokens if token in request_normalized) * 4.0
        # Binary outcome flags (churn=Yes/No) are poor generic chart dimensions.
        if _looks_like_outcome(column) and not mentions_outcome:
            score -= 35.0
        # Prefer lower-cardinality segmentable fields.
        score += max(0.0, 12.0 - unique)
        scored.append((score, str(column)))
    if scored:
        scored.sort(key=lambda item: item[0], reverse=True)
        best = scored[0]
        if best[0] > 0:
            return best[1]
    # Fall back to the categorical column with the most interesting numeric spread.
    best_column, best_score = None, -1.0
    for column in categorical_cols:
        unique = int(frame[column].astype(str).nunique(dropna=True))
        if not (2 <= unique <= 30):
            continue
        if _looks_like_outcome(column) and not mentions_outcome and _is_binary_outcome(frame, column):
            continue
        for metric in numeric_cols[:3]:
            try:
                values = pd.to_numeric(frame[metric], errors="coerce").dropna()
                if len(values) < 5:
                    continue
                grouped = values.groupby(frame[column].astype(str)).mean()
                if len(grouped) < 2:
                    continue
                score = float(grouped.max() - grouped.min()) / max(float(values.mean()), 1e-9)
            except Exception:
                continue
            if score > best_score:
                best_score, best_column = score, column
    return best_column or next((c for c in categorical_cols if not _is_binary_outcome(frame, c)),
                               (categorical_cols[0] if categorical_cols else None))


def _append_churn_signal(frame: pd.DataFrame, target_column: str, metrics: list[dict[str, Any]],
                         findings: list[dict[str, Any]], digest: list[str]) -> None:
    """Compute the actual outcome rate for a churn-style target from the real data."""
    try:
        series = frame[target_column].dropna().astype(str).str.strip()
        if series.empty:
            return
        counts = series.value_counts()
        total = int(counts.sum()) or 1
        positive = next((label for label in counts.index
                         if str(label).strip().lower() in YES_WORDS), None)
        label_used = positive or str(counts.index[0])
        rate = float(counts.get(label_used, 0)) / total * 100
        if positive is not None:
            metrics.append({"label": f"'{target_column}' = {label_used} rate", "value": rate,
                            "formatted": f"{rate:.1f}% ({counts.get(label_used, 0):,} of {total:,} sampled rows)"})
            findings.append({
                "title": f"{rate:.1f}% of sampled rows are flagged '{label_used}' in '{target_column}'",
                "summary": f"{counts.get(label_used, 0):,} of {total:,} sampled rows carry the positive flag. "
                            "Contrast this group against the rest to find what drives the outcome.",
                "category": "Target analysis", "severity": "warning" if rate >= 10 else "info",
                "evidence": [f"positive_rate={rate:.1f}%", f"positive_rows={int(counts.get(label_used, 0))}",
                             f"sampled_rows={total}"],
            })
            digest.append(f"{rate:.1f}% of sampled rows have '{target_column}' = '{label_used}'.")
    except Exception as exc:
        log.warning("churn signal computation failed: %s", exc)


def _pick_metric(frame: pd.DataFrame, request: str, numeric_cols: list[str],
                 dimension: Optional[str], schema_info: dict[str, Any],
                 fallback_first: bool = False) -> Optional[str]:
    request_normalized = _normalize(request)
    scored = []
    for column in numeric_cols:
        score = 0.0
        if _normalize(column) and _normalize(column) in request_normalized:
            score += 24.0
        tokens = set(re.findall(r"[a-z0-9]+", str(column).lower()))
        score += sum(1 for token in tokens if token in request_normalized) * 6.0
        scored.append((score, str(column)))
    if scored:
        scored.sort(key=lambda item: item[0], reverse=True)
        best_score = scored[0][0]
        if best_score > 0:
            return scored[0][1]
    if fallback_first and numeric_cols:
        return numeric_cols[0]
    # Prefer the numeric column with the most spread for segmenting.
    best_column, best_spread = None, -1.0
    for column in numeric_cols:
        try:
            values = pd.to_numeric(frame[column], errors="coerce").dropna()
            if len(values) < 5:
                continue
            spread = float(values.max() - values.min()) / max(float(values.mean()), 1e-9)
        except Exception:
            continue
        if spread > best_spread:
            best_spread, best_column = spread, column
    return best_column


def _normalize(value: Any) -> str:
    return "".join(character for character in str(value or "").lower() if character.isalnum())


def _segment_finding(rows: list[dict[str, Any]], dimension: str, metric: Optional[str],
                     findings: list[dict[str, Any]], digest: list[str], chart_id: str) -> None:
    if not rows:
        return
    top = rows[0]
    if len(rows) >= 2:
        last = rows[-1]
        gap = (float(top["value"]) - float(last["value"])) / max(abs(float(last["value"])), 1e-9)
        findings.append({
            "title": f"'{top['label']}' dominates {dimension}",
            "summary": (f"It represents {top['share_pct']}% of the shown total for {metric or 'records'} and leads the "
                        f"last shown group by {gap * 100:.1f}%. This is the strongest concentration signal in the sample."),
            "category": "Segments", "severity": "success" if top["share_pct"] >= 30 else "info",
            "evidence": [f"top_group={top['label']}", f"share_pct={top['share_pct']}%",
                         f"lead_vs_last={gap * 100:.1f}%"],
            "chart_ids": [chart_id],
        })
    digest.append(f"{dimension} breakdown available; '{top['label']}' leads at {_format(top['value'])}.")


def _detect_target(frame: pd.DataFrame, schema_info: dict[str, Any], request: str) -> Optional[str]:
    """Find the best supervised target (churn-style column or explicit user mention)."""
    request_normalized = _normalize(request)
    categorical = schema_info.get("categorical", [])
    numeric = schema_info.get("numeric", [])

    def score(column: str) -> float:
        series = frame[column]
        non_null = series.dropna()
        if non_null.empty:
            return -100.0
        unique = int(non_null.astype(str).nunique(dropna=True))
        if unique > 20 or unique < 2:
            return -100.0
        name_normalized = _normalize(column)
        score_value = 0.0
        if any(hint in name_normalized for hint in TARGET_NAME_HINTS):
            score_value += 60.0
        if name_normalized and name_normalized in request_normalized:
            score_value += 30.0
        score_value += 25.0 - min(unique, 25)
        # Prefer categorical flags & small integer classes.
        if str(series.dtype) == "object" or str(series.dtype) == "bool":
            score_value += 15.0
        return score_value

    ranked = sorted(categorical + numeric, key=score, reverse=True)
    for column in ranked[:3]:
        if score(column) > 0:
            return column
    # No obvious named target — require an explicit ML request.
    if any(word in str(request).lower() for word in ML_EXPLICIT_WORDS):
        return ranked[0] if ranked else None
    return None


def _build_recommendations(*, request: str, frame: pd.DataFrame, schema_info: dict[str, Any],
                           focus: str, summary: dict[str, Any], ml_payload: dict[str, Any],
                           findings: list[dict[str, Any]], digest: list[str]) -> tuple[list[dict[str, Any]], str]:
    recommendations: list[dict[str, Any]] = []
    evidence_pool = digest[-8:]
    categorical = schema_info.get("categorical", [])
    numeric = schema_info.get("numeric", [])
    datetime_cols = schema_info.get("datetime", [])

    def add(action: str, why: str, *, evidence: Optional[list[str]] = None,
            priority: str = "medium", category: str = "Action") -> None:
        recommendations.append({
            "action": action,
            "why": why,
            "evidence": (evidence or evidence_pool)[:3],
            "priority": priority,
            "category": category,
        })

    if focus == "churn":
        add(
            "Investigate the churn / at-risk segment profile before launching retention offers",
            "Churn-style analysis was requested; identify shared attributes of the churned cohort and "
            "target the highest-risk combination first.",
            priority="high", category="Retention",
        )
        add(
            "Compare churned vs. retained groups on every numeric and categorical feature",
            "The fastest path to churn drivers is a group contrast — differences in usage, tenure, or plan "
            "are the features a model would rely on.",
            priority="high", category="Retention",
        )
    elif focus == "opportunity":
        add(
            "Double down on the leading segment(s) shown in the charts",
            "The top group carries the largest share of the measured metric; protect it while scaling "
            "the fastest-growing runner-ups.",
            priority="high", category="Growth",
        )
        add(
            "Review the bottom or shrinking groups for reposition or prune decisions",
            "Concentration in the top group while the tail lags suggests low-hanging repositioning or cost savings.",
            priority="medium", category="Growth",
        )
    elif focus == "anomaly":
        add(
            "Audit flagged outliers before modeling or reporting",
            "Outliers can be errors or genuine extremes — either way they dominate averages and skew models.",
            priority="high", category="Data quality",
        )
        add(
            "Set up alerts on the columns with the most abnormal values",
            "Continuous monitoring turns the detected anomalies into early-warning signals.",
            priority="medium", category="Monitoring",
        )
    elif focus == "trend":
        add(
            "Identify the turning point behind the trend shift and quantify its drivers",
            "Understanding what changed at the turning point explains the current trajectory better than the average.",
            priority="high", category="Strategy",
        )

    # Data-driven universal recommendations from computed signals.
    top_finding = next((item for item in findings if item.get("category") == "Segments"), None)
    if top_finding:
        add(
            f"Prioritize '{top_finding.get('title', 'the leading segment')}' in planning",
            f"{top_finding.get('summary', 'The leading segment concentrates the measured outcome.')}",
            priority="high", category="Growth",
        )
    corr_finding = next((item for item in findings if item.get("category") == "Correlation"), None)
    if corr_finding:
        add(
            "Monitor the strongly correlated pair as one combined signal",
            "Strongly correlated features should not both be treated as independent drivers.",
            priority="low", category="Analytics",
        )
    if datetime_cols and numeric:
        add(
            "Refresh the time-series view periodically to catch regime changes early",
            "The dataset supports time-aware analysis; ongoing tracking turns static charts into an early-warning system.",
            priority="low", category="Monitoring",
        )
    if ml_payload.get("best_model"):
        add(
            "Adopt the best model for scoring and add the top predictive features to dashboards",
            f"Best model {ml_payload.get('best_model')} reached {ml_payload.get('primary_metric')} "
            f"{_format(ml_payload.get('best_score'))} on held-out rows for target '{ml_payload.get('target_column')}'.",
            priority="high", category="Machine learning",
        )
    if not recommendations:
        add(
            "Run a structured drill-down on the strongest signals found in this review",
            "The dataset did not reveal a dominant business lever yet — the next step is a contrast analysis "
            "between the top and bottom cohorts of the key metric.",
            priority="medium", category="Analytics",
        )

    detail = f"{len(recommendations)} recommendation(s) generated from computed signals."
    return recommendations, detail
