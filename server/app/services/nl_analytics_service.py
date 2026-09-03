"""
Natural-Language Analytics service (Feature 2).

Interprets a free-form request such as "Compare revenue by region" or
"Show monthly sales" into a validated, schema-bound intent, then executes it
with the existing analytics/visualization stack on the real session dataset.

Safety rules:
  - The LLM never computes numbers and never chooses operations outside a
    fixed whitelist. It only suggests an intent; every field is validated
    against the actual dataset schema before anything runs.
  - Column names, aggregations, chart types and operations are validated.
  - If the LLM is unavailable (or returns garbage), a deterministic
    keyword/column-matching interpreter is used instead.
"""
from __future__ import annotations

import json
import logging
import math
import re
from difflib import SequenceMatcher
from typing import Any, Optional

import pandas as pd

from app.services.analytics_service import load_analysis_frame
from app.services.dashboard_service import render_dashboard_widget
from app.services.eda_service import detect_datetime_columns
from app.services.llm_service import groq_chat, has_llm_config
from app.services.ml_service import sanitize_for_json
from app.services.visualization_service import render_visualization_chart

log = logging.getLogger(__name__)

# ── Whitelists ───────────────────────────────────────────────────────────────

OPERATIONS = {
    "groupby", "top", "compare", "time_series", "trend_break",
    "scatter", "correlation", "distribution", "missing", "filter",
}
AGGREGATIONS = {"sum", "avg", "min", "max", "count"}
VISUALIZATIONS = {"auto", "bar", "line", "pie", "scatter", "histogram", "heatmap", "table"}
DATE_HINT_WORDS = ("monthly", "weekly", "daily", "yearly", "quarterly", "month", "week", "day",
                   "date", "over time", "trend", "timeline", "time series", "per month", "per day")
TIME_SERIES_WORDS = ("monthly", "weekly", "daily", "yearly", "quarterly", "over time", "trend",
                     "timeline", "time series", "by month", "by day", "by week", "per month",
                     "per week", "per day", "per year")
AGG_WORDS = (
    ("avg", ("average", "avg", "mean")),
    ("min", ("min", "minimum", "lowest value", "smallest")),
    ("max", ("max", "maximum", "highest value", "largest value", "peak value")),
    ("count", ("count", "how many", "number of records", "records count")),
)
TOP_WORDS = ("top", "highest", "best", "leading", "most", "largest", "strongest", "biggest")
COMPARE_WORDS = ("compare", "comparison", "versus", " vs ", "against", "by region", "by category",
                 "by country", "per region", "per category", "per country", "breakdown")
DISTRIBUTION_WORDS = ("distribution", "histogram", "spread", "bell curve")
CORRELATION_WORDS = ("correlation", "correlated", "relationship", "related", "association", "linked")
MISSING_WORDS = ("missing", "null", "blank", "empty", "na values", "absent")
SCATTER_WORDS = ("plot", "graph", "scatter", "against", " versus ", " vs ")
EXPLAIN_AGG_WORDS = ("total", "sum", "revenue", "sales", "spend", "cost", "amount", "profit", "count")
DEFAULT_SAMPLE_ROWS = 60_000
CHART_CATEGORY_CAP = 16
MAX_TABLE_LIMIT = 25

JSON_INSTRUCTIONS = (
    "Return ONLY a single valid JSON object. No markdown fences, no prose before or after.\n"
    'Format: {"operation": "<one of: groupby, top, compare, time_series, trend_break, scatter, '
    'correlation, distribution, missing, filter>", "dimension": "<exact column name or null>", '
    '"metric": "<exact numeric column name or null>", "date_column": "<exact date column name or null>", '
    '"aggregation": "<sum|avg|min|max|count>", "visualization": "<auto|bar|line|pie|scatter|histogram|heatmap|table>", '
    '"limit": <integer or null>, "note": "<one short line explaining the interpretation>"}'
)


# ── Column schema helpers ────────────────────────────────────────────────────

def _normalize(value: Any) -> str:
    return "".join(character for character in str(value or "").lower() if character.isalnum())


def _tokens(value: Any) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(value or "").lower())


def build_schema(frame: pd.DataFrame, *, name: str = "Dataset", sampled: bool = False) -> dict[str, Any]:
    """Compact schema + per-column metadata used for interpretation and LLM context."""
    datetime_columns = [str(column) for column in detect_datetime_columns(frame)]
    numeric_columns = []
    categorical_columns = []
    columns: list[dict[str, Any]] = []

    for column in frame.columns:
        series = frame[column]
        name_str = str(column)
        if name_str in datetime_columns:
            kind = "datetime"
        elif pd.api.types.is_numeric_dtype(series):
            kind = "numeric"
        else:
            kind = "categorical"

        missing = int(series.isna().sum())
        entry: dict[str, Any] = {
            "name": name_str,
            "kind": kind,
            "missing_pct": round(missing / max(len(frame), 1) * 100, 1),
        }
        non_null = series.dropna()
        if kind == "numeric":
            numeric_columns.append(name_str)
            values = pd.to_numeric(non_null, errors="coerce").dropna()
            if len(values):
                entry.update({
                    "min": _round(values.min()),
                    "max": _round(values.max()),
                    "mean": _round(values.mean()),
                    "median": _round(values.median()),
                })
        elif kind == "categorical":
            categorical_columns.append(name_str)
            counts = non_null.astype(str).value_counts().head(4)
            entry["top"] = [{"value": str(key), "count": int(value)} for key, value in counts.items()]
            entry["unique"] = int(non_null.astype(str).nunique(dropna=True)) if len(non_null) else 0
        else:
            try:
                parsed = pd.to_datetime(non_null, errors="coerce")
                valid = parsed.dropna()
                if len(valid):
                    entry["range"] = [str(valid.min()), str(valid.max())]
            except Exception:
                pass
        columns.append(entry)

    columns.sort(key=lambda item: (item["kind"], item["name"]))
    return {
        "dataset_name": name,
        "rows": int(len(frame)),
        "sampled": bool(sampled),
        "numeric": numeric_columns,
        "categorical": categorical_columns,
        "datetime": datetime_columns,
        "columns": columns,
    }


def _round(value: Any) -> float:
    try:
        return round(float(value), 4)
    except Exception:
        return float("nan")


def _schema_columns_lookup(schema: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(item.get("name")): item for item in schema.get("columns", [])}


def _resolve_column(value: Any, candidates: list[str], *, prompt: str = "") -> tuple[Optional[str], float]:
    """Resolve a free-text reference to the closest real column (validated against the schema)."""
    if not candidates:
        return None, 0.0
    wanted = str(value or "").strip()
    normalized_wanted = _normalize(wanted)
    prompt_normalized = _normalize(prompt)
    prompt_tokens = set(_tokens(prompt))
    best_name: Optional[str] = None
    best_score = 0.0

    for candidate in candidates:
        candidate_str = str(candidate)
        if not wanted:
            # Prompt-only matching: candidate column literally named inside the prompt.
            score = 0.0
            candidate_normalized = _normalize(candidate_str)
            if candidate_normalized and candidate_normalized in prompt_normalized:
                score += 24.0
            tokens = set(_tokens(candidate_str.replace("_", " ").replace("-", " ")))
            overlap = len(tokens & prompt_tokens)
            if overlap:
                score += overlap * 6.0
            if score > best_score:
                best_score = score
                best_name = candidate_str
            continue

        normalized = _normalize(candidate_str)
        if normalized == normalized_wanted:
            return candidate_str, 1.0
        # Substring both ways (column "region_name" vs user "region").
        if normalized and (normalized in normalized_wanted or normalized_wanted in normalized):
            score = 0.85
        else:
            left_tokens = _tokens(candidate_str.replace("_", " ").replace("-", " "))
            right_tokens = _tokens(wanted)
            if not left_tokens or not right_tokens:
                continue
            overlap = len(set(left_tokens) & set(right_tokens))
            if not overlap:
                continue
            ratio = SequenceMatcher(None, "".join(left_tokens), "".join(right_tokens)).ratio()
            score = max(0.4 + overlap * 0.12, ratio * 0.8)
        if score > best_score:
            best_score = score
            best_name = candidate_str

    return (best_name, best_score) if best_name is not None else (None, 0.0)


def _best_column(value: Any, candidates: list[str], *, prompt: str = "") -> Optional[str]:
    resolved, _ = _resolve_column(value, candidates, prompt=prompt)
    return resolved


def _extract_number(text: str) -> Optional[int]:
    match = re.search(r"\b(top|first)\s+(\d{1,3})\b|\b(\d{1,3})\s+(?:top|best|leading)\b", str(text), re.IGNORECASE)
    if match:
        raw = next((group for group in match.groups() if group and group.isdigit()), None)
        if raw:
            return min(max(int(raw), 1), MAX_TABLE_LIMIT)
    return None


def _detect_aggregation(query: str, metric: Optional[str]) -> str:
    lower = str(query or "").lower()
    for aggregation, keywords in AGG_WORDS:
        if any(keyword in lower for keyword in keywords):
            return aggregation
    return "sum"


def _detect_filters(query: str, schema: dict[str, Any], columns_by_kind: dict[str, list[str]]) -> list[dict[str, Any]]:
    """Parse simple `column = value` / `column: value` style filters mentioned in the prompt."""
    filters: list[dict[str, Any]] = []
    text = str(query or "")
    for candidate in columns_by_kind.get("categorical", []):
        pattern = re.compile(
            re.escape(str(candidate)) + r"\s*(?:=|is|:)\s*['\"]?([A-Za-z0-9][A-Za-z0-9 _\-\.]*)['\"]?",
            re.IGNORECASE,
        )
        match = pattern.search(text)
        if not match:
            continue
        raw_value = match.group(1).strip()
        if len(raw_value) < 2 or raw_value.lower() in {"the", "which", "what"}:
            continue
        # Do not swallow another column name.
        if any(_normalize(raw_value) == _normalize(other) for other in schema.get("columns", []) if other.get("name") != candidate):
            continue
        filters.append({"column": str(candidate), "value": raw_value})
        if len(filters) >= 2:
            break
    return filters


# ── Rule-based interpreter (deterministic fallback, no LLM) ─────────────────

def _rule_interpret(query: str, schema: dict[str, Any]) -> dict[str, Any]:
    lower = str(query or "").lower()
    numeric = schema.get("numeric", [])
    categorical = schema.get("categorical", [])
    datetime_cols = schema.get("datetime", [])
    corrections: list[str] = []
    filters: list[dict[str, Any]] = []
    note = ""

    matched_numeric = _best_column("", numeric, prompt=query)
    matched_categorical = _best_column("", categorical, prompt=query)

    # Filters first (region = US) — they apply to whatever operation is chosen.
    candidate_filters = _detect_filters(query, schema, {"categorical": categorical, "datetime": datetime_cols})
    if candidate_filters:
        filters = candidate_filters

    has_time_words = any(word in lower for word in TIME_SERIES_WORDS)
    date_column = None
    if datetime_cols:
        date_column = _best_column("", datetime_cols, prompt=query) or datetime_cols[0]
    elif has_time_words:
        # A column that looks like a date but was typed as text.
        for item in schema.get("columns", []):
            if item.get("kind") == "categorical" and item.get("name") and _normalize(item["name"]) in _normalize(query):
                date_column = item["name"]
                break

    has_missing = any(word in lower for word in MISSING_WORDS)
    has_correlation = any(word in lower for word in CORRELATION_WORDS)
    has_distribution = any(word in lower for word in DISTRIBUTION_WORDS)
    has_top = any(word in lower for word in TOP_WORDS) or bool(_extract_number(query))
    has_compare = any(word in lower for word in COMPARE_WORDS)
    is_scatter = any(word in lower for word in ("plot", "scatter", " against ")) or " vs " in f" {lower} "

    limit = _extract_number(query) or 10
    metric = matched_numeric
    aggregation = _detect_aggregation(query, metric)
    if aggregation == "count":
        metric = None

    dimension = matched_categorical
    operation = "groupby"
    visualization = "auto"

    # Direct plot requests: numeric x and y columns (e.g. "plot age against income").
    numeric_matched = [_best_column("", numeric, prompt=query)]
    if is_scatter and len(numeric) >= 2 and not dimension:
        picked = [column for column in numeric if _normalize(column) in _normalize(query)][:2]
        if len(picked) >= 2:
            operation = "scatter"
            metric = picked[1]
            dimension = picked[0]
            visualization = "scatter"
            note = "Scatter plot of the two numeric fields mentioned in the request."
            return _package_intent(operation, query, schema, dimension=dimension, metric=metric,
                                   visualization="scatter", limit=None, filters=filters,
                                   note=note, corrections=corrections)

    if has_missing:
        operation = "missing"
        visualization = "table"
        note = "Missing-value report across columns."
    elif has_correlation:
        operation = "correlation"
        visualization = "heatmap"
        note = "Correlation analysis across numeric columns."
    elif has_distribution:
        operation = "distribution"
        visualization = "histogram"
        metric = metric or (numeric[0] if numeric else None)
        note = "Distribution analysis of a numeric column."
    elif has_time_words and (date_column or datetime_cols):
        operation = "trend_break" if ("when did" in lower or "start" in lower and any(
            word in lower for word in ("declin", "fall", "drop", "decreas"))) else "time_series"
        visualization = "line"
        note = "Time-series aggregation over the detected date column."
        metric = metric or (numeric[0] if numeric else None)
    elif has_compare:
        operation = "top" if (has_top and dimension) else "compare"
        visualization = "bar"
        note = "Grouped comparison across the dimension."
        if not dimension and categorical:
            dimension = categorical[0]
            corrections.append(f"Assumed the dimension column is '{dimension}'.")
    elif has_top or (not dimension and operation == "groupby"):
        operation = "top" if has_top or dimension else "groupby"
        visualization = "bar"
        if not dimension and categorical:
            dimension = categorical[0]
            corrections.append(f"Assumed the grouping column is '{dimension}'.")
    elif has_correlation is False and not dimension and categorical:
        dimension = categorical[0]
        corrections.append(f"Assumed the grouping column is '{dimension}'.")
    else:
        operation = "groupby"
        visualization = "bar"
        if not dimension and categorical:
            dimension = categorical[0]
            corrections.append(f"Assumed the grouping column is '{dimension}'.")

    # If the user explicitly said count and no numeric column is interesting.
    if dimension is None and not numeric and categorical:
        operation = "groupby"
        metric = None
        aggregation = "count"
        dimension = categorical[0]
        corrections.append("No numeric column was found — using record counts instead.")

    if visualization == "auto":
        visualization = "pie" if any(word in lower for word in ("share", "composition", "percentage", "mix", "split")) else "bar"

    return _package_intent(operation, query, schema, dimension=dimension, metric=metric,
                           aggregation=aggregation, visualization=visualization, limit=limit,
                           filters=filters, note=note, corrections=corrections)


def _package_intent(operation: str, query: str, schema: dict[str, Any], *,
                    dimension: Optional[str], metric: Optional[str],
                    visualization: str = "auto", aggregation: str = "sum",
                    limit: Optional[int] = None, filters: Optional[list[dict[str, Any]]] = None,
                    note: Optional[str] = None, corrections: Optional[list[str]] = None,
                    date_column: Optional[str] = None) -> dict[str, Any]:
    return {
        "operation": operation if operation in OPERATIONS else "groupby",
        "dimension": dimension,
        "metric": metric,
        "date_column": date_column,
        "aggregation": aggregation if aggregation in AGGREGATIONS else "sum",
        "visualization": visualization if visualization in VISUALIZATIONS else "auto",
        "limit": limit,
        "filters": filters or [],
        "note": note or "",
        "corrections": corrections or [],
    }


# ── LLM-assisted interpreter ────────────────────────────────────────────────

def _schema_context(schema: dict[str, Any]) -> str:
    lines = [
        f"Dataset: {schema.get('dataset_name', 'Dataset')} "
        f"({schema.get('rows', 0):,} rows, sampled={schema.get('sampled', False)})",
        "",
        "Available columns (use these EXACT names):",
    ]
    for item in schema.get("columns", []):
        name = item.get("name")
        kind = item.get("kind")
        meta = []
        if item.get("top"):
            meta.append("top: " + ", ".join(f"{entry['value']} ({entry['count']})" for entry in item["top"][:3]))
        if item.get("mean") is not None:
            meta.append(f"mean={item['mean']}, min={item['min']}, max={item['max']}")
        suffix = f" | {', '.join(meta)}" if meta else ""
        lines.append(f"- [{kind}] {name}{suffix}")
    lines.append("")
    lines.append("A column is only usable for a role if it exists above: a metric must be in [numeric] "
                 "columns, a dimension in [categorical] columns, a date in [datetime] columns. "
                 "Pick 'dimension'/'metric'/'date_column' as the EXACT column names above (or null).")
    lines.append(f"JSON rules: {JSON_INSTRUCTIONS}")
    return "\n".join(lines)


def _llm_interpret(query: str, schema: dict[str, Any]) -> Optional[dict[str, Any]]:
    if not has_llm_config():
        return None
    system_prompt = (
        "You are the intent interpreter inside a safe data-analysis platform.\n"
        "You convert a user's analytics request into ONE supported operation.\n"
        "You may only reference columns that are listed in the user message below. "
        "Never invent column names, numbers or results. If a column role is not clear, use null "
        "and explain in 'note'. 'trend_break' means 'when did the trend start declining'.\n"
    )
    try:
        content = groq_chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{_schema_context(schema)}\n\nUSER REQUEST:\n{query}"},
            ],
            max_tokens=700,
            temperature=0,
        )
    except Exception as exc:
        log.warning("nl_analytics: LLM interpretation failed: %s", exc)
        return None
    if not content:
        return None
    payload = _extract_json_object(content)
    if not payload or not str(payload.get("operation") or "").strip():
        return None
    return payload


def _extract_json_object(text: str) -> Optional[dict[str, Any]]:
    """Pull the first JSON object out of model text, tolerating fences and prose."""
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
            pass
    return None


# ── Public interpretation API ────────────────────────────────────────────────

def interpret_query(query: str, schema: dict[str, Any]) -> dict[str, Any]:
    """
    Interpret + validate a request into an intent.

    Returns intent fields that are ALREADY resolved to real column names,
    plus corrections, confidence and the interpretation source.
    """
    query = str(query or "").strip()
    numeric = schema.get("numeric", [])
    categorical = schema.get("categorical", [])
    datetime_cols = schema.get("datetime", [])

    raw: Optional[dict[str, Any]] = _llm_interpret(query, schema)
    source = "llm"
    if raw is None:
        raw = _rule_interpret(query, schema)
        source = "rules"
    elif not raw.get("operation"):
        raw = _rule_interpret(query, schema)
        source = "rules"

    corrections: list[str] = []
    operation = str(raw.get("operation") or "groupby").strip().lower()
    if operation not in OPERATIONS:
        corrections.append(f"'{operation}' is not a supported operation; using 'groupby'.")
        operation = "groupby"

    if operation == "time_series":
        # Date column may sit in categorical when not detected automatically.
        dt_columns = datetime_cols + [str(item["name"]) for item in schema.get("columns", [])
                                      if item.get("kind") == "categorical"
                                      and item.get("unique", 0) and item["unique"] <= len(schema.get("columns", [])) * 3]
        dt_columns = list(dict.fromkeys(dt_columns))
        date_column, score = _resolve_column(raw.get("date_column"), dt_columns, prompt=query)
        if date_column is None:
            date_column = _best_column("", datetime_cols, prompt=query) or (datetime_cols[0] if datetime_cols else None)
        if date_column is None:
            # Try numeric years ("year" column).
            date_column = _best_column("", numeric, prompt=query) if any(
                word in str(query).lower() for word in ("year", "yearly")
            ) else None
        raw["date_column"] = date_column
        metric = _resolve_metric(raw.get("metric"), numeric, query)
        raw["metric"] = metric or (numeric[0] if numeric else None)
        if not raw.get("date_column"):
            return {
                **raw, "operation": "groupby",
                "dimension": _resolve_dimension(raw.get("dimension"), categorical, query) or (categorical[0] if categorical else None),
                "metric": _resolve_metric(raw.get("metric"), numeric, query),
                "status": "needs_clarification",
                "message": "I could not find a date/time column for a time-series request. "
                           "Detected columns: " + ", ".join(datetime_cols or categorical[:6] or ["none"]),
                "source": source,
                "corrections": corrections,
                "confidence": "low",
            }
        raw["metric"] = raw.get("metric") or (numeric[0] if numeric else None)
    elif operation == "scatter":
        raw["dimension"], raw["metric"] = _resolve_scatter_axes(raw, numeric, query, schema)
        if not raw["dimension"] or not raw["metric"] or raw["dimension"] == raw["metric"]:
            return {**raw, "status": "needs_clarification",
                    "message": "A scatter plot needs two distinct numeric columns. Detected numeric columns: "
                               + ", ".join(numeric[:8] or ["none"]),
                    "source": source, "corrections": corrections, "confidence": "low"}
    elif operation == "correlation":
        raw["dimension"], raw["metric"] = None, None
        if len(numeric) < 2:
            return {**raw, "status": "needs_clarification",
                    "message": "Correlation analysis needs at least two numeric columns. Detected numeric columns: "
                               + ", ".join(numeric[:8] or ["none"]),
                    "source": source, "corrections": corrections, "confidence": "low"}
    elif operation == "distribution":
        raw["metric"] = _resolve_metric(raw.get("metric"), numeric, query) or (numeric[0] if numeric else None)
        raw["dimension"] = None
        if not raw["metric"]:
            return {**raw, "status": "needs_clarification",
                    "message": "Distribution analysis needs a numeric column. Detected numeric columns: "
                               + ", ".join(numeric[:8] or ["none"]),
                    "source": source, "corrections": corrections, "confidence": "low"}
    elif operation == "missing":
        raw["dimension"], raw["metric"] = None, None
    elif operation in {"groupby", "top", "compare"}:
        raw["dimension"] = _resolve_dimension(raw.get("dimension"), categorical, query)
        if raw["dimension"] is None and categorical:
            candidate = _best_column("", categorical, prompt=query) or categorical[0]
            corrections.append(f"Using '{candidate}' as the grouping column.")
            raw["dimension"] = candidate
        if raw["dimension"] is None:
            return {**raw, "status": "needs_clarification",
                    "message": "I could not find a categorical column to group by. Detected categorical columns: "
                               + ", ".join(categorical[:8] or ["none"]),
                    "source": source, "corrections": corrections, "confidence": "low"}
        raw["metric"] = _resolve_metric(raw.get("metric"), numeric, query)
        if raw["metric"] is None:
            raw["aggregation"] = "count"
            raw["metric"] = None
            corrections.append("No numeric metric was detected — counting records per group.")
        elif _detect_aggregation(query, raw["metric"]) == "count":
            raw["metric"] = None
            raw["aggregation"] = "count"
    elif operation == "filter":
        raw["dimension"] = _resolve_dimension(raw.get("dimension"), categorical, query)
        raw["metric"] = _resolve_metric(raw.get("metric"), numeric, query)
        if not raw.get("filters"):
            raw["filters"] = _detect_filters(query, schema, {"categorical": categorical, "datetime": datetime_cols})
    else:  # groupby default path
        raw["dimension"] = _resolve_dimension(raw.get("dimension"), categorical, query) or (
            categorical[0] if categorical else None
        )

    aggregation = str(raw.get("aggregation") or "sum").lower()
    if aggregation not in AGGREGATIONS:
        aggregation = "sum"
    raw["aggregation"] = aggregation
    visualization = str(raw.get("visualization") or "auto").lower()
    if visualization not in VISUALIZATIONS:
        visualization = "auto"
    raw["visualization"] = visualization
    limit = _extract_number(query) or raw.get("limit")
    try:
        limit = int(limit) if limit is not None else 10
        raw["limit"] = min(max(limit, 1), MAX_TABLE_LIMIT)
    except Exception:
        raw["limit"] = 10

    # Filters must reference real columns.
    validated_filters: list[dict[str, Any]] = []
    all_columns = schema.get("categorical", []) + schema.get("datetime", [])
    for item in raw.get("filters", []) or []:
        column, _ = _resolve_column(item.get("column"), all_columns, prompt=query)
        value = item.get("value")
        if column and value not in {None, "", "All"}:
            validated_filters.append({"column": column, "value": str(value)})
    raw["filters"] = validated_filters[:2]

    resolved_metric = raw.get("metric")
    raw["status"] = "ready"
    confidence = "high" if source == "llm" else "medium"
    raw["message"] = None
    raw["source"] = source
    raw["confidence"] = confidence
    raw["corrections"] = corrections
    return raw


def _resolve_dimension(value: Any, categorical: list[str], query: str) -> Optional[str]:
    resolved = _best_column(value, categorical, prompt=query) if value else None
    if resolved is None and not value:
        resolved = _best_column("", categorical, prompt=query)
    return resolved


def _resolve_metric(value: Any, numeric: list[str], query: str) -> Optional[str]:
    if value:
        return _best_column(value, numeric, prompt=query)
    return _best_column("", numeric, prompt=query)


def _resolve_scatter_axes(raw: dict[str, Any], numeric: list[str], query: str,
                          schema: dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    # 1) Prefer columns that are explicitly named in the prompt (e.g. "plot age against income").
    lower = str(query or "").lower()
    named_in_prompt: list[str] = []
    for column in numeric:
        normalized = _normalize(column)
        if not normalized:
            continue
        if normalized in _normalize(lower):
            named_in_prompt.append(column)
            continue
        tokens = set(_tokens(column.replace("_", " ").replace("-", " ")))
        if tokens and tokens.issubset(set(_tokens(lower))):
            named_in_prompt.append(column)
    if len(named_in_prompt) >= 2:
        # Order matters for x/y phrasing like "plot A against B".
        first, second = named_in_prompt[0], named_in_prompt[1]
        against = re.search(r"against\s+([a-z0-9_\- ]+)", lower) or re.search(r"\bvs?\s*([a-z0-9_\- ]+)", lower)
        if against:
            tail = against.group(1).strip()
            second = _best_column(tail, numeric, prompt=query) or second
            first = next((column for column in named_in_prompt if column != second), first)
        return first, second

    # 2) Fall back to the model's suggestion, validated against the schema.
    first = _best_column(raw.get("dimension"), numeric, prompt=query)
    second = _best_column(raw.get("metric") or raw.get("metric2"), numeric, prompt=query)
    if first is None and named_in_prompt:
        first = named_in_prompt[0]
    if second is None and named_in_prompt:
        for column in named_in_prompt:
            if column != first:
                second = column
                break
    if first and not second and len(numeric) > 1:
        second = next((column for column in numeric if column != first), None)
    if first and second and first == second and len(numeric) > 1:
        second = next((column for column in numeric if column != first), None)
    return first, second


def summarize_schema_for_ui(schema: dict[str, Any]) -> dict[str, Any]:
    return {
        "columns": schema.get("columns", []),
        "numeric": schema.get("numeric", []),
        "categorical": schema.get("categorical", []),
        "datetime": schema.get("datetime", []),
        "rows": schema.get("rows", 0),
        "sampled": schema.get("sampled", False),
        "operations": sorted(OPERATIONS),
        "aggregations": sorted(AGGREGATIONS),
    }


# ── Execution ────────────────────────────────────────────────────────────────

def _as_numeric(frame: pd.DataFrame, metric: Optional[str]) -> pd.Series:
    if metric is None or metric not in frame.columns:
        return pd.Series(dtype=float)
    return pd.to_numeric(frame[metric], errors="coerce")


def _format_number(value: Any) -> str:
    try:
        number = float(value)
    except Exception:
        return str(value)
    if math.isnan(number) or math.isinf(number):
        return "N/A"
    if abs(number) >= 1000:
        return f"{number:,.1f}"
    if abs(number) >= 100:
        return f"{number:,.2f}"
    return f"{number:,.3f}".rstrip("0").rstrip(".")


def _format_currency_like(value: Any) -> str:
    return _format_number(value)


def _agg_label(aggregation: str) -> str:
    return {"sum": "Total", "avg": "Average", "min": "Minimum", "max": "Maximum", "count": "Count"}.get(aggregation, aggregation.capitalize())


def _group_rows(frame: pd.DataFrame, dimension: str, metric: Optional[str], aggregation: str,
                limit: int) -> list[dict[str, Any]]:
    if aggregation == "count" or metric is None:
        counts = frame[dimension].astype(str).value_counts(dropna=False).head(limit)
        rows = []
        total = int(counts.sum()) or 1
        for label, count in counts.items():
            rows.append({"label": "N/A" if pd.isna(label) or str(label) == "nan" else str(label),
                         "value": float(count), "share_pct": round(float(count) / total * 100, 2)})
        return rows
    values = _as_numeric(frame, metric)
    working = frame.assign(__metric__=values).dropna(subset=["__metric__"])
    if working.empty:
        return []
    if aggregation == "avg":
        aggregated = working.groupby(working[dimension].astype(str).fillna("N/A"))["__metric__"].mean()
    elif aggregation == "min":
        aggregated = working.groupby(working[dimension].astype(str).fillna("N/A"))["__metric__"].min()
    elif aggregation == "max":
        aggregated = working.groupby(working[dimension].astype(str).fillna("N/A"))["__metric__"].max()
    else:
        aggregated = working.groupby(working[dimension].astype(str).fillna("N/A"))["__metric__"].sum()
    aggregated = aggregated.sort_values(ascending=False).head(limit)
    total = float(aggregated.sum()) or 1.0
    return [{"label": str(label), "value": float(value),
             "share_pct": round(float(value) / total * 100, 2)}
            for label, value in aggregated.items()]


def _monthly_bucket_series(frame: pd.DataFrame, date_column: str, metric: Optional[str],
                           aggregation: str) -> pd.DataFrame:
    """Aggregate by a date bucket (day/month) so charts get a clean chronological series."""
    parsed = pd.to_datetime(frame[date_column], errors="coerce")
    working = frame.assign(__date__=parsed).dropna(subset=["__date__"])
    if working.empty:
        return pd.DataFrame(columns=["__period__", "value"])
    span_days = max((working["__date__"].max() - working["__date__"].min()).days, 1)
    if span_days <= 45:
        working["__period__"] = working["__date__"].dt.strftime("%Y-%m-%d")
    elif span_days <= 370:
        working["__period__"] = working["__date__"].dt.to_period("M").astype(str)
    elif span_days <= 1600:
        working["__period__"] = working["__date__"].dt.to_period("Q").astype(str)
    else:
        working["__period__"] = working["__date__"].dt.year.astype(str)
    if aggregation == "count" or metric is None:
        series = working.groupby("__period__").size().rename("value")
    else:
        values = pd.to_numeric(working[metric], errors="coerce")
        working = working.assign(__value__=values).dropna(subset=["__value__"])
        if working.empty:
            return pd.DataFrame(columns=["__period__", "value"])
        grouped = working.groupby("__period__")["__value__"]
        if aggregation == "avg":
            series = grouped.mean()
        elif aggregation == "min":
            series = grouped.min()
        elif aggregation == "max":
            series = grouped.max()
        else:
            series = grouped.sum()
    out = series.rename("value").reset_index()
    out = out.sort_values("__period__").reset_index(drop=True)
    return out


def _trend_break_point(series: pd.DataFrame) -> Optional[dict[str, Any]]:
    if len(series) < 3:
        return None
    values = pd.to_numeric(series["value"], errors="coerce").dropna()
    if len(values) < 3:
        return None
    peak_index = int(values.idxmax())
    peak_period = str(series.iloc[peak_index]["__period__"])
    peak_value = float(values.iloc[peak_index])
    # First period after the peak where the value drops and stays meaningfully below.
    drop_from = float(series.iloc[peak_index]["value"])
    for index in range(peak_index + 1, len(series)):
        current = float(series.iloc[index]["value"])
        previous = float(series.iloc[index - 1]["value"])
        if previous > 0 and current < previous:
            change = (current - previous) / previous * 100
            if index == peak_index + 1 or change <= -2.0 or current < drop_from * 0.97:
                return {
                    "period": str(series.iloc[index]["__period__"]),
                    "previous_period": str(series.iloc[index - 1]["__period__"]),
                    "value": current,
                    "change_pct": round(change, 2),
                    "peak_period": peak_period,
                    "peak_value": peak_value,
                }
    return None


def _series_rows(series: pd.DataFrame, metric_label: str) -> list[dict[str, Any]]:
    return [{"label": str(row["__period__"]), "value": float(row["value"]),
             "label_name": metric_label} for _, row in series.iterrows()]


def _series_chart(series: pd.DataFrame, title: str, x_title: str, metric: Optional[str],
                  aggregation: str) -> dict[str, Any]:
    frame = series.rename(columns={"value": "__value__"})
    if frame.empty:
        raise ValueError("The time-series aggregation produced no data.")
    # Chronological series are already aggregated per period — the visualization
    # service's line renderer draws them in order without legend duplication.
    result = render_visualization_chart(frame, {
        "chart_key": "line_chart", "chart_type": "line_chart",
        "x_column": "__period__", "y_column": "__value__", "theme": "dark",
    })
    result["title"] = title
    return result


def execute_intent(query: str, intent: dict[str, Any], frame: pd.DataFrame, schema: dict[str, Any],
                   *, include_explanation: bool = True) -> dict[str, Any]:
    """
    Run a validated intent on a real (sampled) dataframe.

    All numbers below are computed from `frame` — nothing is invented by the LLM.
    """
    operation = intent.get("operation", "groupby")
    aggregation = intent.get("aggregation", "sum")
    visualization = intent.get("visualization", "auto")
    limit = min(int(intent.get("limit") or 10), MAX_TABLE_LIMIT)
    dimension = intent.get("dimension")
    metric = intent.get("metric")
    date_column = intent.get("date_column")
    filters = intent.get("filters") or []
    warnings: list[str] = []
    limitations: list[str] = []
    charts: list[dict[str, Any]] = []
    tables: list[dict[str, Any]] = []
    metrics: list[dict[str, Any]] = []
    metric_label = metric or "records"

    # Every filter must reference a real column; apply validated equality filters first.
    applied_filters: list[dict[str, Any]] = []
    if filters:
        for item in filters:
            column = str(item.get("column") or "")
            value = item.get("value")
            if column not in frame.columns or value in {None, "", "All"}:
                continue
            masked = frame.loc[frame[column].astype(str).str.strip() == str(value).strip()]
            if masked.empty:
                raise ValueError(
                    f"No rows matched the filter {column} = {value}. Check the value or remove the filter."
                )
            frame = masked.reset_index(drop=True)
            applied_filters.append({"column": column, "value": str(value)})
        if applied_filters:
            limitations.append(
                "Filters applied: " + ", ".join(f"{f['column']} = {f['value']}" for f in applied_filters) + "."
            )
    filters = applied_filters

    if schema.get("sampled"):
        limitations.append(f"Analyses are computed on a sample of {schema.get('rows', 0):,} rows for speed.")

    if operation in {"groupby", "top", "compare"}:
        if not dimension or dimension not in frame.columns:
            raise ValueError(f"Grouping column '{dimension}' is not available in the dataset.")
        rows = _group_rows(frame, dimension, metric, aggregation, limit)
        if not rows:
            raise ValueError(f"'{dimension}' has no usable {'numeric values' if metric else 'values'} to aggregate.")
        total_value = float(sum(float(row["value"]) for row in rows))
        tables.append({"title": f"{_agg_label(aggregation)} of {metric_label} by {dimension} (top {len(rows)})",
                       "columns": ["Rank", "Group", metric_label, f"% of shown {_agg_label(aggregation).lower()}"],
                       "rows": [{"Rank": index + 1, "Group": row["label"], metric_label: _format_number(row["value"]),
                                 "% share": row["share_pct"]} for index, row in enumerate(rows)]})
        if operation == "compare" or (operation == "groupby" and len(rows) >= 2):
            pass
        top_row = rows[0]
        bottom_row = rows[-1]
        top_percent = round(top_row["share_pct"], 1)
        lead_over_last = (float(top_row["value"]) - float(bottom_row["value"])) / max(abs(float(bottom_row["value"])), 1e-9)
        metrics.append({"label": f"Top {dimension}", "value": top_row["label"], "formatted": top_row["label"]})
        metrics.append({"label": f"{_agg_label(aggregation)} {metric_label or 'records'} — top", "value": top_row["value"],
                        "formatted": _format_number(top_row["value"]), "hint": f"{top_percent}% of the shown {_agg_label(aggregation).lower()}"})
        if len(rows) >= 2:
            metrics.append({"label": "Lead vs. last shown", "value": lead_over_last,
                            "formatted": f"{lead_over_last * 100:.1f}%"})

        chart_type = "pie" if visualization == "pie" else "bar"
        chart_frame = pd.DataFrame([{"__label__": row["label"], "__metric__": row["value"]} for row in rows])
        try:
            if chart_type == "pie":
                widget = render_dashboard_widget(chart_frame, {
                    "chart_type": "pie_chart",
                    "mapping": {"x_axis": "__label__", "values": ["__metric__"], "aggregation": "sum",
                                "title": f"{_agg_label(aggregation)} {metric_label or 'records'} by {dimension}"},
                    "theme": "dark",
                })
                charts.append({"id": "nl-chart-1", "title": widget.get("title") or f"{metric_label or 'Records'} by {dimension}",
                               "chart_type": "pie_chart", "figure": widget.get("figure") or {},
                               "insight": widget.get("insight")})
            else:
                # Pre-aggregated rows → use the visualization renderer (bar) which does not
                # re-inject a default legend equal to the x-axis.
                result = render_visualization_chart(chart_frame, {
                    "chart_key": "bar_chart", "chart_type": "bar_chart",
                    "x_column": "__label__", "y_column": "__metric__", "theme": "dark",
                })
                if result.get("figure"):
                    charts.append({"id": "nl-chart-1",
                                   "title": f"{_agg_label(aggregation)} {metric_label or 'records'} by {dimension}",
                                   "chart_type": "bar_chart", "figure": result["figure"],
                                   "insight": result.get("note")})
                elif result.get("error"):
                    warnings.append(f"Bar chart could not be built ({result['error']}).")
        except Exception as exc:
            warnings.append(f"Chart could not be built ({exc}).")
        if len(rows) > CHART_CATEGORY_CAP:
            warnings.append(f"Chart shows the top {CHART_CATEGORY_CAP} categories while the table lists {len(rows)}.")

    elif operation == "time_series":
        if not date_column or date_column not in frame.columns:
            raise ValueError(f"Date column '{date_column}' is not available in the dataset.")
        series = _monthly_bucket_series(frame, date_column, metric, aggregation)
        if series.empty:
            raise ValueError("No valid date values were found for the time-series request.")
        rows = _series_rows(series, metric_label)
        period_label = "period"
        tables.append({"title": f"{_agg_label(aggregation)} of {metric_label or 'records'} over time",
                       "columns": [period_label, metric_label], "rows": rows})
        try:
            chart = _series_chart(series, f"{_agg_label(aggregation)} {metric_label or 'records'} over time",
                                  period_label, metric, aggregation)
            charts.append({"id": "nl-chart-1", "title": chart.get("title") or f"{metric_label or 'Records'} over time",
                           "chart_type": "line_chart", "figure": chart.get("figure") or {},
                           "insight": chart.get("insight")})
        except Exception as exc:
            warnings.append(f"Time-series chart could not be built ({exc}).")
        if len(series) >= 2:
            values = pd.to_numeric(series["value"], errors="coerce").dropna()
            first_value, last_value = float(values.iloc[0]), float(values.iloc[-1])
            first_period, last_period = str(series.iloc[0]["__period__"]), str(series.iloc[-1]["__period__"])
            direction = "upward" if last_value >= first_value else "downward"
            change_pct = ((last_value - first_value) / max(abs(first_value), 1e-9)) * 100
            metrics.append({"label": "Overall trend", "value": direction,
                            "formatted": f"{direction} {change_pct:+.1f}% from {first_period} to {last_period}"})
            peak = series.loc[values.idxmax()]
            metrics.append({"label": f"Peak {period_label}", "value": str(peak["__period__"]),
                            "formatted": f"{str(peak['__period__'])} ({_format_number(peak['value'])})"})
            if direction == "downward":
                metrics.append({"label": "Latest vs first", "value": change_pct, "formatted": f"{change_pct:+.1f}%"})

    elif operation == "trend_break":
        if not date_column or date_column not in frame.columns:
            raise ValueError(f"Date column '{date_column}' is not available in the dataset.")
        series = _monthly_bucket_series(frame, date_column, metric, aggregation)
        if series.empty:
            raise ValueError("No valid date values were found for the trend request.")
        rows = _series_rows(series, metric_label)
        tables.append({"title": f"{_agg_label(aggregation)} of {metric_label or 'records'} over time",
                       "columns": [period_label := "period", metric_label], "rows": rows})
        break_point = _trend_break_point(series)
        try:
            chart = _series_chart(series, f"{metric_label or 'Records'} over time — trend", period_label, metric, aggregation)
            charts.append({"id": "nl-chart-1", "title": chart.get("title") or "Trend over time",
                           "chart_type": "line_chart", "figure": chart.get("figure") or {},
                           "insight": chart.get("insight")})
        except Exception as exc:
            warnings.append(f"Trend chart could not be built ({exc}).")
        if break_point is not None:
            metrics.append({"label": "Decline started", "value": break_point["period"],
                            "formatted": f"{break_point['period']} ({break_point['change_pct']:+.1f}% vs previous {period_label})"})
        elif len(series) >= 2:
            values = pd.to_numeric(series["value"], errors="coerce").dropna()
            first_value, last_value = float(values.iloc[0]), float(values.iloc[-1])
            direction = "upward" if last_value >= first_value else "downward"
            if direction == "upward":
                metrics.append({"label": "Trend direction", "value": "upward",
                                "formatted": "No sustained decline detected — the series trends upward overall."})
            else:
                metrics.append({"label": "Trend direction", "value": "downward",
                                "formatted": "Overall downward trend; earliest period already sits at a relative high."})

    elif operation == "scatter":
        x_column, y_column = dimension, metric
        if x_column not in frame.columns or y_column not in frame.columns:
            raise ValueError("The scatter request references columns that are not available in the dataset.")
        values = frame[[x_column, y_column]].apply(pd.to_numeric, errors="coerce").dropna()
        correlation = float(values[x_column].corr(values[y_column])) if len(values) >= 3 else float("nan")
        tables.append({"title": f"Correlation between {x_column} and {y_column}",
                       "columns": ["Metric", "Value"],
                       "rows": [{"Metric": "Pearson correlation", "Value": _format_number(correlation)},
                                {"Metric": "Valid pairs", "Value": f"{len(values):,}"},
                                {"Metric": "Range (X)", "Value": f"{_format_number(values[x_column].min())} – {_format_number(values[x_column].max())}"},
                                {"Metric": "Range (Y)", "Value": f"{_format_number(values[y_column].min())} – {_format_number(values[y_column].max())}"}]})
        if not math.isnan(correlation):
            metrics.append({"label": "Correlation", "value": round(correlation, 4),
                            "formatted": f"{correlation:+.3f}", "hint": "Pearson r on the sampled rows"})
        try:
            widget = render_dashboard_widget(frame, {
                "chart_type": "scatter_plot",
                "mapping": {"x_axis": x_column, "y_axis": y_column, "title": f"{y_column} vs {x_column}"},
                "theme": "dark",
            })
            charts.append({"id": "nl-chart-1", "title": widget.get("title") or f"{y_column} vs {x_column}",
                           "chart_type": "scatter_plot", "figure": widget.get("figure") or {},
                           "insight": widget.get("insight")})
        except Exception as exc:
            warnings.append(f"Scatter chart could not be built ({exc}).")

    elif operation == "correlation":
        numeric = schema.get("numeric", [])
        numeric = [column for column in numeric if column in frame.columns]
        if len(numeric) < 2:
            raise ValueError("Correlation analysis needs at least two numeric columns.")
        numeric = numeric[:12]
        pairs = []
        for index, left in enumerate(numeric):
            for right in numeric[index + 1:]:
                pair = frame[[left, right]].apply(pd.to_numeric, errors="coerce").dropna()
                if len(pair) < 3:
                    continue
                correlation = float(pair[left].corr(pair[right]))
                if math.isnan(correlation):
                    continue
                pairs.append({"left": left, "right": right, "correlation": round(correlation, 4),
                              "strength": "strong" if abs(correlation) >= 0.6 else "moderate" if abs(correlation) >= 0.4 else "weak"})
        pairs.sort(key=lambda item: abs(item["correlation"]), reverse=True)
        tables.append({"title": "Strongest correlations (sampled)",
                       "columns": ["Column A", "Column B", "Correlation", "Strength"],
                       "rows": pairs[:10]})
        if pairs:
            top_pair = pairs[0]
            metrics.append({"label": "Strongest correlation", "value": f"{top_pair['left']} ↔ {top_pair['right']}",
                            "formatted": f"{top_pair['correlation']:+.3f} ({top_pair['strength']})"})
        if len(pairs) >= 2:
            top_pair = pairs[0]
            opposite = next((pair for pair in pairs if (pair["correlation"] < 0) != (top_pair["correlation"] < 0)), None)
            if opposite:
                metrics.append({"label": "Notable inverse relationship",
                                "value": f"{opposite['left']} ↔ {opposite['right']}",
                                "formatted": f"{opposite['correlation']:+.3f}"})
        try:
            result = render_visualization_chart(frame, {"chart_key": "correlation_matrix",
                                                        "chart_type": "correlation_matrix",
                                                        "selected_columns": numeric, "theme": "dark"})
            if result.get("figure"):
                charts.append({"id": "nl-chart-1", "title": "Correlation matrix",
                               "chart_type": "correlation_matrix", "figure": result["figure"],
                               "insight": result.get("note")})
            elif result.get("error"):
                warnings.append(f"Correlation matrix chart failed: {result['error']}")
        except Exception as exc:
            warnings.append(f"Correlation chart could not be built ({exc}).")

    elif operation == "distribution":
        if not metric or metric not in frame.columns:
            raise ValueError("Distribution analysis needs a numeric column.")
        values = pd.to_numeric(frame[metric], errors="coerce").dropna()
        if values.empty:
            raise ValueError(f"'{metric}' has no usable numeric values.")
        stats = {
            "Column": metric, "Count": f"{len(values):,}", "Mean": _format_number(values.mean()),
            "Median": _format_number(values.median()), "Std": _format_number(values.std()),
            "Min": _format_number(values.min()), "Max": _format_number(values.max()),
            "Skewness": _format_number(values.skew()),
        }
        tables.append({"title": f"Distribution statistics — {metric}", "columns": list(stats.keys()),
                       "rows": [stats]})
        metrics.append({"label": f"{metric} — mean", "value": values.mean(), "formatted": _format_number(values.mean())})
        metrics.append({"label": f"{metric} — median", "value": values.median(), "formatted": _format_number(values.median())})
        metrics.append({"label": "Skewness", "value": values.skew(), "formatted": _format_number(values.skew()),
                        "hint": "|skew| ≥ 1 suggests a non-normal distribution"})
        try:
            result = render_visualization_chart(frame, {"chart_key": "histogram", "chart_type": "histogram",
                                                        "column": metric, "bins": 30, "theme": "dark"})
            if result.get("figure"):
                charts.append({"id": "nl-chart-1", "title": f"Histogram — {metric}", "chart_type": "histogram",
                               "figure": result["figure"], "insight": result.get("note")})
            elif result.get("error"):
                warnings.append(f"Histogram failed: {result['error']}")
        except Exception as exc:
            warnings.append(f"Histogram could not be built ({exc}).")

    elif operation == "missing":
        missing_report = []
        for column in frame.columns:
            missing = int(frame[column].isna().sum())
            if missing:
                missing_report.append({"column": str(column), "missing": missing,
                                       "missing_pct": round(missing / max(len(frame), 1) * 100, 2)})
        missing_report.sort(key=lambda item: item["missing"], reverse=True)
        tables.append({"title": "Missing-value summary (sampled)",
                       "columns": ["Column", "Missing", "%"],
                       "rows": missing_report[:20]})
        if missing_report:
            top = missing_report[0]
            metrics.append({"label": "Columns with missing values", "value": len(missing_report),
                            "formatted": f"{len(missing_report)} of {frame.shape[1]}"})
            metrics.append({"label": "Most incomplete column", "value": top["column"],
                            "formatted": f"{top['column']} — {top['missing_pct']}%"})
        else:
            metrics.append({"label": "Missing values", "value": 0, "formatted": "None detected"})

    elif operation == "filter":
        count = int(len(frame))
        sample = frame.head(12).where(pd.notnull(frame.head(12)), None).to_dict(orient="records")
        filter_desc = ", ".join(f"{item['column']} = {item['value']}" for item in filters) or "no explicit filter"
        tables.append({"title": f"Matching rows preview (filtered on {filter_desc})",
                       "columns": [str(column) for column in frame.columns[:6]],
                       "rows": [{str(column): row.get(column) for column in frame.columns[:6]} for row in sample]})
        metrics.append({"label": "Rows after filter", "value": count, "formatted": f"{count:,}"})

    explanation_parts = _computed_explanation(query, operation, metrics, tables, metric, dimension, date_column, aggregation)
    narrative = ""
    if include_explanation:
        narrative = _llm_narrative(query, explanation_parts, metrics) if has_llm_config() else ""

    detected_columns = {}
    for role, value in (("dimension", dimension), ("metric", metric), ("date_column", date_column)):
        if value:
            detected_columns[role] = value

    return sanitize_for_json({
        "charts": charts,
        "tables": tables,
        "metrics": metrics,
        "explanation": {"computed": explanation_parts, "narrative": narrative},
        "detected_columns": detected_columns,
        "warnings": warnings,
        "limitations": limitations,
        "filters": filters,
    })


def _computed_explanation(query: str, operation: str, metrics: list[dict[str, Any]],
                          tables: list[dict[str, Any]], metric: Optional[str],
                          dimension: Optional[str], date_column: Optional[str],
                          aggregation: str) -> str:
    """Deterministic explanation assembled from computed values only."""
    parts: list[str] = []
    if operation in {"groupby", "top", "compare"} and tables:
        table = tables[0]
        rows = table.get("rows", [])
        if rows and dimension:
            top = rows[0]
            parts.append(f"{top.get('Group')} leads with {top.get(metric or table['columns'][2])} "
                         f"({top.get('% share', 0)}% of the shown total).")
        if len(rows) >= 2:
            parts.append(f"The {dimension} breakdown shows the top {len(rows)} groups.")
    elif operation in {"time_series", "trend_break"}:
        trend_metric = next((item for item in metrics if item.get("label") == "Overall trend"), None)
        if trend_metric:
            parts.append(str(trend_metric["formatted"]))
        peak = next((item for item in metrics if item.get("label", "").startswith("Peak")), None)
        if peak:
            parts.append(f"The peak period was {peak['value']}.")
        decline = next((item for item in metrics if item.get("label") == "Decline started"), None)
        if decline:
            parts.append(f"A sustained decline began in {decline['formatted']}.")
    elif operation == "scatter":
        correlation = next((item for item in metrics if item.get("label") == "Correlation"), None)
        if correlation:
            parts.append(f"The sampled correlation between the two plotted fields is {correlation['formatted']}.")
    elif operation == "correlation" and tables:
        rows = tables[0].get("rows", [])[:3]
        if rows:
            parts.append("Strongest sampled relationships: " +
                         "; ".join(f"{row['left']}–{row['right']} ({row['correlation']:+.3f})" for row in rows))
    elif operation == "distribution" and tables:
        row = (tables[0].get("rows") or [{}])[0]
        if row:
            parts.append(f"{row.get('Column')} has mean {row.get('Mean')}, median {row.get('Median')} and "
                         f"skewness {row.get('Skewness')} across {row.get('Count')} sampled values.")
    elif operation == "missing" and tables:
        rows = tables[0].get("rows", [])[:3]
        if rows:
            parts.append("Missing values were found in: " +
                         ", ".join(f"{row.get('column')} ({row.get('missing_pct')}%)" for row in rows))
        else:
            parts.append("No missing values were detected in the sampled rows.")
    if not parts:
        parts.append("The analysis ran successfully on the sampled rows.")
    return " ".join(parts)


def _llm_narrative(query: str, computed_explanation: str, metrics: list[dict[str, Any]]) -> str:
    if not has_llm_config():
        return ""
    system_prompt = (
        "You write a short data explanation for a business user. STRICT RULES: "
        "do not invent any number — you may only restate numbers that appear in the facts below. "
        "If you need a figure that is not listed, describe it in words. Keep it to 2-3 sentences."
    )
    metric_facts = "; ".join(f"{item.get('label')}: {item.get('formatted') or item.get('value')}" for item in metrics[:6])
    try:
        content = groq_chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": (
                    f"USER REQUEST:\n{query}\n\n"
                    f"COMPUTED FACTS:\n{computed_explanation}\n{metric_facts}\n\n"
                    "Write 2-3 sentences of plain-English explanation."
                )},
            ],
            max_tokens=300,
            temperature=0.2,
        )
    except Exception as exc:
        log.warning("nl_analytics: narrative generation failed: %s", exc)
        return ""
    return str(content or "").strip()


# ── Top-level query handlers used by the routes ─────────────────────────────

def load_session_frame(session, session_id: str) -> tuple[pd.DataFrame, dict[str, Any], int, bool]:
    """Return (frame, schema, total_rows, sampled) for the session dataset."""
    if session.df is None and not session.dataset_snapshot:
        raise ValueError("No dataset is loaded. Upload a dataset first, then ask Datalytics anything about it.")

    frame = load_analysis_frame(session, sample_size=DEFAULT_SAMPLE_ROWS)
    if frame is None or frame.empty:
        raise ValueError("The dataset is empty — there is nothing to analyze yet.")

    total_rows = int(session.dataset_row_count or 0) or int(len(frame))
    sampled = total_rows > len(frame)
    schema = build_schema(frame, name=session.dataset_name or "Dataset", sampled=sampled)
    if not schema.get("columns"):
        raise ValueError("No usable columns were found in the dataset.")
    return frame, schema, total_rows, sampled


def interpret_only(session, session_id: str, query: str) -> dict[str, Any]:
    """Interpret a request against the real schema (no execution, no chart)."""
    _frame, schema, total_rows, sampled = load_session_frame(session, session_id)
    interpreted = interpret_query(str(query or "").strip(), schema)
    intent = {key: interpreted.get(key) for key in (
        "operation", "dimension", "metric", "date_column", "aggregation",
        "visualization", "limit", "filters", "note", "corrections", "source", "confidence",
    )}
    return {
        "query": str(query or "").strip(),
        "intent": intent,
        "status": "ready" if interpreted.get("status") == "ready" else "needs_clarification",
        "corrections": interpreted.get("corrections") or [],
        "confidence": interpreted.get("confidence") or "medium",
        "source": interpreted.get("source") or "rules",
        "available": summarize_schema_for_ui(schema),
        "message": interpreted.get("message"),
        "dataset": {"name": schema["dataset_name"], "rows": total_rows, "sampled": sampled},
    }


def handle_nl_query(session, session_id: str, query: str, *, mode: str = "auto",
                    include_explanation: bool = True) -> dict[str, Any]:
    frame, schema, total_rows, sampled = load_session_frame(session, session_id)

    interpreted = interpret_query(query, schema)
    intent = {key: interpreted.get(key) for key in (
        "operation", "dimension", "metric", "date_column", "aggregation",
        "visualization", "limit", "filters", "note", "corrections", "source", "confidence",
    )}

    if interpreted.get("status") == "needs_clarification":
        return {
            "query": query,
            "intent": intent,
            "status": "needs_clarification",
            "charts": [], "tables": [], "metrics": [], "explanation": {},
            "detected_columns": {}, "filters": intent.get("filters") or [], "warnings": [],
            "limitations": [], "dataset": {"name": schema["dataset_name"], "rows": total_rows, "sampled": sampled},
            "message": interpreted.get("message"),
        }

    try:
        executed = execute_intent(query, intent, frame, schema, include_explanation=include_explanation)
    except ValueError as exc:
        return {
            "query": query,
            "intent": intent,
            "status": "error",
            "charts": [], "tables": [], "metrics": [],
            "explanation": {"computed": str(exc), "narrative": ""},
            "detected_columns": {}, "filters": intent.get("filters") or [], "warnings": [],
            "limitations": [], "dataset": {"name": schema["dataset_name"], "rows": total_rows, "sampled": sampled},
            "message": str(exc),
        }

    return {
        "query": query,
        "intent": intent,
        "status": "ok",
        **executed,
        "dataset": {"name": schema["dataset_name"], "rows": total_rows, "sampled": sampled},
    }
