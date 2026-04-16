from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from services.cache_service import cache
from services.dashboard_service import suggest_dashboard_widget
from services.dataset_service import iter_dataset_chunks
from services.ml_service import optimize_memory, sanitize_for_json

SUMMARY_SAMPLE_ROWS = 4_000
CHART_SAMPLE_ROWS = 12_000
QUESTION_SAMPLE_ROWS = 24_000
SUMMARY_NUMERIC_LIMIT = 8
SUMMARY_CATEGORY_LIMIT = 6
TOP_VALUES_LIMIT = 5

NUMERIC_DTYPE_HINTS = ("int", "float", "double", "decimal", "number")
DATETIME_NAME_HINTS = ("date", "time", "month", "year", "day")
VISUAL_KEYWORDS = ("show", "plot", "chart", "graph", "visual", "trend", "dashboard", "compare")
STAT_QUERY_KEYWORDS = ("highest", "lowest", "max", "maximum", "min", "minimum", "average", "mean", "median", "sum", "total")
RANKING_QUERY_KEYWORDS = ("best", "top", "leading", "highest", "perform", "most common", "popular", "category", "segment", "region")
TREND_QUERY_KEYWORDS = ("trend", "over time", "monthly", "daily", "weekly", "timeline", "increase", "decrease", "drop", "growth")
MISSING_QUERY_KEYWORDS = ("missing", "null", "blank", "empty", "na")
UNIQUE_QUERY_KEYWORDS = ("unique", "distinct", "different")
SUM_QUERY_KEYWORDS = ("sum", "total")
CORRELATION_QUERY_KEYWORDS = ("correlation", "related", "relationship", "impact", "affect", "association")
SCHEMA_QUERY_KEYWORDS = ("columns", "features", "fields", "schema")
COUNT_QUERY_KEYWORDS = ("how many", "count", "number of")
ROW_COUNT_QUERY_KEYWORDS = ("rows", "row", "records", "record", "entries", "entry", "observations", "observation")
COLUMN_COUNT_QUERY_KEYWORDS = ("columns", "column", "fields", "field", "features", "feature", "schema")
DATASET_QUERY_KEYWORDS = ("dataset", "datasets", "data", "table")
MAX_QUERY_KEYWORDS = ("highest", "max", "maximum", "largest", "top")
MIN_QUERY_KEYWORDS = ("lowest", "min", "minimum", "smallest", "bottom")
AVERAGE_QUERY_KEYWORDS = ("average", "mean", "avg")
MEDIAN_QUERY_KEYWORDS = ("median",)
DROP_QUERY_KEYWORDS = ("drop", "decrease", "lowest month", "worst month")
PEAK_QUERY_KEYWORDS = ("peak", "highest month", "best month", "top month")
DIRECT_RESPONSE_KEYWORDS = (
    *COUNT_QUERY_KEYWORDS,
    *STAT_QUERY_KEYWORDS,
    *RANKING_QUERY_KEYWORDS,
    *TREND_QUERY_KEYWORDS,
    *MISSING_QUERY_KEYWORDS,
    *UNIQUE_QUERY_KEYWORDS,
    *CORRELATION_QUERY_KEYWORDS,
    *SCHEMA_QUERY_KEYWORDS,
    *ROW_COUNT_QUERY_KEYWORDS,
)
EXPLANATION_QUERY_KEYWORDS = ("why", "explain", "reason", "recommend", "insight", "suggest", "strategy")
FREQUENCY_RANK_QUERY_KEYWORDS = ("most common", "popular", "frequent", "highest count", "top")
CHART_TYPE_KEYWORDS = (
    ("line_chart", ("trend", "over time", "timeline", "monthly", "daily", "weekly", "time series", "line")),
    ("scatter_plot", ("correlation", "relationship", "versus", "vs", "scatter")),
    ("heatmap", ("heatmap", "matrix")),
    ("histogram", ("distribution", "histogram", "spread")),
    ("donut_chart", ("share", "composition", "percentage", "mix")),
    ("bar_chart", ("top", "best", "highest", "lowest", "compare", "category", "region", "segment")),
)


def dataset_signature(session: Any) -> str:
    raw = json.dumps(
        {
            "path": session.dataset_path,
            "storage_mode": session.dataset_storage_mode,
            "rows": session.dataset_row_count,
            "cols": session.dataset_column_count,
            "file_size": session.dataset_file_size,
            "snapshot_columns": session.dataset_snapshot.get("all_columns", []),
        },
        sort_keys=True,
        default=str,
    )
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _summary_cache_key(session_id: str, session: Any) -> str:
    return f"analytics:{session_id}:summary:{dataset_signature(session)}"


def _chart_cache_key(session_id: str, session: Any, prompt: str) -> str:
    normalized = " ".join(str(prompt or "").lower().split())
    token = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]
    return f"analytics:{session_id}:chart:{dataset_signature(session)}:{token}"


def _question_cache_key(session_id: str, session: Any, prompt: str) -> str:
    normalized = " ".join(str(prompt or "").lower().split())
    token = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]
    return f"analytics:{session_id}:question:{dataset_signature(session)}:{token}"


def _normalize(text: str) -> str:
    return "".join(character for character in str(text or "").lower() if character.isalnum())


def _prompt_tokens(prompt: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", str(prompt or "").lower())


def _fuzzy_token_match(token: str, keyword: str, threshold: float = 0.84) -> bool:
    if not token or not keyword:
        return False
    if token == keyword:
        return True
    if len(token) >= 5 and len(keyword) >= 5 and SequenceMatcher(None, token, keyword).ratio() >= threshold:
        return True
    return False


def _prompt_has_keyword(
    prompt: str,
    keywords: list[str] | tuple[str, ...],
    *,
    fuzzy_threshold: float = 0.84,
) -> bool:
    prompt_lower = str(prompt or "").lower()
    tokens = _prompt_tokens(prompt_lower)
    for keyword in keywords:
        normalized_keyword = str(keyword or "").strip().lower()
        if not normalized_keyword:
            continue
        if normalized_keyword in prompt_lower:
            return True
        if " " in normalized_keyword:
            phrase_size = len(normalized_keyword.split())
            if len(tokens) < phrase_size:
                continue
            for start in range(len(tokens) - phrase_size + 1):
                window = " ".join(tokens[start : start + phrase_size])
                if window == normalized_keyword:
                    return True
                if SequenceMatcher(None, window, normalized_keyword).ratio() >= max(0.9, fuzzy_threshold):
                    return True
            continue
        if any(_fuzzy_token_match(token, normalized_keyword, threshold=fuzzy_threshold) for token in tokens):
            return True
    return False


def _is_column_count_query(prompt: str) -> bool:
    has_count = _prompt_has_keyword(prompt, COUNT_QUERY_KEYWORDS)
    has_schema = _prompt_has_keyword(prompt, SCHEMA_QUERY_KEYWORDS, fuzzy_threshold=0.66)
    has_column_term = _prompt_has_keyword(prompt, COLUMN_COUNT_QUERY_KEYWORDS, fuzzy_threshold=0.66)
    return has_schema or (has_count and has_column_term)


def _is_row_count_query(prompt: str) -> bool:
    has_count = _prompt_has_keyword(prompt, COUNT_QUERY_KEYWORDS)
    has_row_term = _prompt_has_keyword(prompt, ROW_COUNT_QUERY_KEYWORDS, fuzzy_threshold=0.8)
    has_dataset_term = _prompt_has_keyword(prompt, DATASET_QUERY_KEYWORDS, fuzzy_threshold=0.78)
    return has_row_term or (has_count and has_dataset_term and not _is_column_count_query(prompt))


def _sample_frame(frame: pd.DataFrame, sample_size: int, seed: int = 42) -> pd.DataFrame:
    if frame.empty or len(frame) <= sample_size:
        return optimize_memory(frame.copy())
    return optimize_memory(frame.sample(n=sample_size, random_state=seed).reset_index(drop=True))


def _apply_filters(frame: pd.DataFrame, filters: list[dict[str, Any]] | None = None) -> pd.DataFrame:
    filtered = frame
    for item in filters or []:
        column = str(item.get("column") or "")
        value = item.get("value")
        if not column or column not in filtered.columns or value in {None, "", "All"}:
            continue
        filtered = filtered.loc[filtered[column].astype(str) == str(value)].copy()
    return filtered


def _resolve_columns(session: Any, columns: list[str] | None = None) -> list[str] | None:
    available = list(session.dataset_columns or session.dataset_snapshot.get("all_columns", []))
    if not columns:
        return None
    ordered = []
    for column in columns:
        if column in available and column not in ordered:
            ordered.append(column)
    return ordered or None


def load_analysis_frame(
    session: Any,
    *,
    columns: list[str] | None = None,
    filters: list[dict[str, Any]] | None = None,
    sample_size: int = CHART_SAMPLE_ROWS,
) -> pd.DataFrame:
    selected_columns = _resolve_columns(session, columns)

    if session.dataset_storage_mode != "disk" or not session.dataset_path or not Path(session.dataset_path).exists():
        frame = session.df.copy() if session.df is not None else pd.DataFrame(columns=selected_columns or [])
        if selected_columns:
            frame = frame.loc[:, [column for column in selected_columns if column in frame.columns]].copy()
        filtered = _apply_filters(frame, filters)
        return _sample_frame(filtered, sample_size)

    path = Path(session.dataset_path)
    target_columns = selected_columns or list(session.dataset_columns or session.dataset_snapshot.get("all_columns", []))
    total_rows = max(int(session.dataset_row_count or 0), 1)
    sample_fraction = min(1.0, max(sample_size / total_rows, 0.02) * 1.25)
    chunks: list[pd.DataFrame] = []

    for index, chunk in enumerate(iter_dataset_chunks(path, columns=target_columns)):
        if chunk is None or chunk.empty:
            continue

        filtered = _apply_filters(chunk, filters)
        if filtered.empty:
            continue

        if selected_columns:
            available = [column for column in selected_columns if column in filtered.columns]
            filtered = filtered.loc[:, available].copy()

        if sample_fraction < 1.0 and len(filtered) > 1:
            take = min(len(filtered), max(1, int(round(len(filtered) * sample_fraction))))
            sampled = filtered.sample(n=take, random_state=42 + index)
        else:
            sampled = filtered

        chunks.append(sampled)

    if not chunks:
        return pd.DataFrame(columns=selected_columns or target_columns)

    frame = pd.concat(chunks, ignore_index=True)
    return _sample_frame(frame, sample_size)


def _column_kind(column_meta: dict[str, Any], sample_series: pd.Series | None = None) -> str:
    dtype = str(column_meta.get("dtype") or "")
    if any(token in dtype.lower() for token in NUMERIC_DTYPE_HINTS):
        return "numeric"
    if sample_series is not None and pd.api.types.is_numeric_dtype(sample_series):
        return "numeric"
    return "categorical"


def _datetime_columns(frame: pd.DataFrame) -> list[str]:
    detected = []
    for column in frame.columns:
        normalized = _normalize(column)
        if any(hint in normalized for hint in DATETIME_NAME_HINTS):
            detected.append(str(column))
            continue
        series = frame[column]
        if series.empty:
            continue
        parsed = pd.to_datetime(series, errors="coerce")
        valid_ratio = float(parsed.notna().mean()) if len(parsed) else 0.0
        if valid_ratio >= 0.7:
            detected.append(str(column))
    return detected


def _top_counts(series: pd.Series, limit: int = TOP_VALUES_LIMIT) -> list[dict[str, Any]]:
    cleaned = series.dropna()
    if cleaned.empty:
        return []
    counts = cleaned.astype(str).value_counts().head(limit)
    return [{"label": label, "count": int(count)} for label, count in counts.items()]


def _correlation_pairs(frame: pd.DataFrame, numeric_columns: list[str]) -> list[dict[str, Any]]:
    pairs = []
    columns = numeric_columns[: min(6, len(numeric_columns))]
    for index, left in enumerate(columns):
        for right in columns[index + 1:]:
            pair = frame[[left, right]].apply(pd.to_numeric, errors="coerce").dropna()
            if len(pair) < 3:
                continue
            correlation = float(pair[left].corr(pair[right]))
            if not np.isfinite(correlation):
                continue
            pairs.append(
                {
                    "left": left,
                    "right": right,
                    "correlation": round(correlation, 3),
                    "absolute": round(abs(correlation), 3),
                }
            )
    pairs.sort(key=lambda item: item["absolute"], reverse=True)
    return pairs[:5]


def build_dataset_analysis_summary(session: Any, session_id: str) -> dict[str, Any]:
    cache_key = _summary_cache_key(session_id, session)
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    snapshot = sanitize_for_json(session.dataset_snapshot or {})
    column_meta = list(snapshot.get("columns_info", []))
    sample_columns = list(snapshot.get("all_columns", [])[: min(16, len(snapshot.get("all_columns", [])) or 16)])
    sample_frame = load_analysis_frame(session, columns=sample_columns or None, sample_size=SUMMARY_SAMPLE_ROWS)

    numeric_columns = []
    categorical_columns = []
    for item in column_meta:
        column = str(item.get("column") or "")
        if not column:
            continue
        sample_series = sample_frame[column] if column in sample_frame.columns else None
        if _column_kind(item, sample_series) == "numeric":
            numeric_columns.append(column)
        else:
            categorical_columns.append(column)

    datetime_columns = [column for column in _datetime_columns(sample_frame) if column not in numeric_columns]
    categorical_columns = [column for column in categorical_columns if column not in datetime_columns]

    numeric_summary = {}
    for column in numeric_columns[:SUMMARY_NUMERIC_LIMIT]:
        if column not in sample_frame.columns:
            continue
        series = pd.to_numeric(sample_frame[column], errors="coerce").dropna()
        if series.empty:
            continue
        numeric_summary[column] = {
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
        }

    categorical_summary = {}
    for column in categorical_columns[:SUMMARY_CATEGORY_LIMIT]:
        if column not in sample_frame.columns:
            continue
        categorical_summary[column] = _top_counts(sample_frame[column])

    correlation_pairs = _correlation_pairs(sample_frame, [column for column in numeric_columns if column in sample_frame.columns])
    insights = []

    first_numeric = next(iter(numeric_summary.items()), None)
    if first_numeric:
        column, stats = first_numeric
        insights.append(
            f"{column} ranges from {stats['min']:,} to {stats['max']:,} with an average of {stats['mean']:,}."
        )

    first_category = next(iter(categorical_summary.items()), None)
    if first_category and first_category[1]:
        top_value = first_category[1][0]
        insights.append(
            f"{top_value['label']} is the leading segment in {first_category[0]} with {top_value['count']:,} sampled rows."
        )

    if correlation_pairs:
        strongest = correlation_pairs[0]
        direction = "positive" if strongest["correlation"] >= 0 else "negative"
        insights.append(
            f"{strongest['left']} and {strongest['right']} show a {direction} correlation of {strongest['correlation']}."
        )

    if datetime_columns and numeric_columns:
        date_column = datetime_columns[0]
        value_column = next((column for column in numeric_columns if column in sample_frame.columns), None)
        if value_column and date_column in sample_frame.columns:
            trend_frame = sample_frame[[date_column, value_column]].copy()
            trend_frame[date_column] = pd.to_datetime(trend_frame[date_column], errors="coerce")
            trend_frame[value_column] = pd.to_numeric(trend_frame[value_column], errors="coerce")
            trend_frame = trend_frame.dropna()
            if len(trend_frame) >= 3:
                trend_frame["__bucket__"] = trend_frame[date_column].dt.to_period("M").astype(str)
                monthly = trend_frame.groupby("__bucket__")[value_column].sum().reset_index()
                monthly = monthly.sort_values("__bucket__")
                if len(monthly) >= 2:
                    trend = "upward" if float(monthly[value_column].iloc[-1]) >= float(monthly[value_column].iloc[0]) else "downward"
                    insights.append(f"{value_column} shows an overall {trend} trend across {date_column}.")

    payload = sanitize_for_json(
        {
            "dataset_name": session.dataset_name or "Dataset",
            "rows": int(snapshot.get("rows") or session.dataset_row_count or len(sample_frame)),
            "cols": int(snapshot.get("cols") or session.dataset_column_count or len(sample_frame.columns)),
            "missing_total": int(snapshot.get("missing_total") or 0),
            "storage_mode": session.dataset_storage_mode,
            "columns": list(snapshot.get("all_columns", []) or sample_frame.columns.tolist()),
            "column_meta": column_meta,
            "numeric_summary": numeric_summary,
            "categorical_summary": categorical_summary,
            "datetime_columns": datetime_columns,
            "correlations": correlation_pairs,
            "sample_rows": sanitize_for_json(sample_frame.head(8).to_dict(orient="records")),
            "insights": insights,
        }
    )
    cache.set_json(cache_key, payload, ttl_seconds=300)
    return payload


def _detect_chart_type(prompt: str) -> str:
    prompt_lower = str(prompt or "").lower()
    for chart_type, keywords in CHART_TYPE_KEYWORDS:
        if any(keyword in prompt_lower for keyword in keywords):
            return chart_type
    return "auto"


def _matched_columns(prompt: str, available_columns: list[str]) -> list[str]:
    prompt_lower = str(prompt or "").lower()
    prompt_tokens = re.findall(r"[a-z0-9]+", prompt_lower)
    prompt_token_set = set(prompt_tokens)
    matches = []

    for column in available_columns:
        normalized_column = _normalize(column)
        column_tokens = set(re.findall(r"[a-z0-9]+", str(column).lower()))
        if normalized_column and normalized_column in _normalize(prompt_lower):
            matches.append(column)
            continue
        if column_tokens and len(column_tokens & prompt_token_set) >= max(1, min(2, len(column_tokens))):
            matches.append(column)
            continue
        column_parts = [token for token in re.findall(r"[a-z0-9]+", str(column).lower()) if len(token) >= 3]
        if not column_parts:
            continue
        fuzzy_hits = 0
        for part in column_parts:
            if any(_fuzzy_token_match(token, part, threshold=0.88) for token in prompt_tokens):
                fuzzy_hits += 1
        if fuzzy_hits >= max(1, min(2, len(column_parts))):
            matches.append(column)

    return matches[:6]


def _format_metric(value: float | int | None) -> str:
    if value is None:
        return "n/a"
    numeric = float(value)
    if not np.isfinite(numeric):
        return "n/a"
    if abs(numeric) >= 1000:
        if float(numeric).is_integer():
            return f"{int(numeric):,}"
        return f"{numeric:,.2f}"
    if float(numeric).is_integer():
        return str(int(numeric))
    return f"{numeric:.4f}".rstrip("0").rstrip(".")


def _numeric_columns_from_summary(summary: dict[str, Any]) -> list[str]:
    numeric = []
    for item in summary.get("column_meta", []):
        column = str(item.get("column") or "")
        dtype = str(item.get("dtype") or "")
        if column and any(token in dtype.lower() for token in NUMERIC_DTYPE_HINTS):
            numeric.append(column)
    for column in summary.get("numeric_summary", {}).keys():
        if column not in numeric:
            numeric.append(column)
    return numeric


def _datetime_columns_from_summary(summary: dict[str, Any]) -> list[str]:
    return [str(column) for column in summary.get("datetime_columns", []) if column]


def _categorical_columns_from_summary(summary: dict[str, Any]) -> list[str]:
    numeric = set(_numeric_columns_from_summary(summary))
    datetime_columns = set(_datetime_columns_from_summary(summary))
    columns = [str(column) for column in summary.get("columns", []) if column]
    return [column for column in columns if column not in numeric and column not in datetime_columns]


def _column_meta_lookup(summary: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(item.get("column")): item
        for item in summary.get("column_meta", [])
        if item.get("column")
    }


def _column_hint(summary: dict[str, Any], columns: list[str]) -> str:
    if not columns:
        return ""
    preview = ", ".join(columns[:6])
    suffix = ", ..." if len(columns) > 6 else ""
    return f" Available options include: {preview}{suffix}."


def _clarification_message_for_prompt(
    prompt: str,
    summary: dict[str, Any],
    focus_columns: list[str],
) -> str:
    numeric_columns = _numeric_columns_from_summary(summary)
    categorical_columns = _categorical_columns_from_summary(summary)

    if _is_column_count_query(prompt) or _is_row_count_query(prompt):
        return ""

    if _prompt_has_keyword(prompt, CORRELATION_QUERY_KEYWORDS):
        if len([column for column in focus_columns if column in numeric_columns]) < 2:
            return (
                "I need two numeric column names to answer that correlation question exactly."
                f"{_column_hint(summary, numeric_columns)}"
            )

    if _prompt_has_keyword(prompt, MISSING_QUERY_KEYWORDS):
        if not focus_columns:
            return (
                "Tell me the exact column name for missing-value counts so I can answer precisely."
                f"{_column_hint(summary, summary.get('columns', []))}"
            )

    if _prompt_has_keyword(prompt, UNIQUE_QUERY_KEYWORDS):
        if not focus_columns:
            return (
                "Tell me the exact column name for the unique-count question so I can answer precisely."
                f"{_column_hint(summary, summary.get('columns', []))}"
            )

    if _prompt_has_keyword(prompt, STAT_QUERY_KEYWORDS):
        if not any(column in numeric_columns for column in focus_columns):
            return (
                "I need the exact numeric column name for that metric question."
                f"{_column_hint(summary, numeric_columns)}"
            )

    if _prompt_has_keyword(prompt, RANKING_QUERY_KEYWORDS):
        if not any(column in categorical_columns for column in focus_columns):
            return (
                "I need the exact category column name for that ranking question."
                f"{_column_hint(summary, categorical_columns)}"
            )
        if not _prompt_has_keyword(prompt, FREQUENCY_RANK_QUERY_KEYWORDS):
            return (
                "That ranking question needs an explicit metric column so I do not guess."
                f"{_column_hint(summary, numeric_columns)}"
            )

    if _prompt_has_keyword(prompt, TREND_QUERY_KEYWORDS):
        datetime_columns = _datetime_columns_from_summary(summary)
        if not datetime_columns:
            return "I could not find a reliable date/time column to answer that trend question exactly."
        if not any(column in datetime_columns for column in focus_columns):
            return (
                "I need the exact metric or date column for that trend question."
                f"{_column_hint(summary, datetime_columns + numeric_columns)}"
            )

    return ""


def _infer_focus_columns(prompt: str, summary: dict[str, Any]) -> list[str]:
    available_columns = [str(column) for column in summary.get("columns", []) if column]
    matched = _matched_columns(prompt, available_columns)
    numeric_columns = _numeric_columns_from_summary(summary)
    datetime_columns = _datetime_columns_from_summary(summary)
    selected = list(dict.fromkeys(column for column in matched if column))

    if _prompt_has_keyword(prompt, TREND_QUERY_KEYWORDS):
        if len(datetime_columns) == 1 and datetime_columns[0] not in selected:
            selected.append(datetime_columns[0])
        numeric_selected = [column for column in selected if column in numeric_columns]
        if not numeric_selected and len(numeric_columns) == 1:
            selected.append(numeric_columns[0])

    return list(dict.fromkeys(column for column in selected if column))[:6]


def _frame_iterator_for_columns(session: Any, columns: list[str]) -> list[pd.DataFrame] | Any:
    target_columns = list(dict.fromkeys(column for column in columns if column))
    if session.dataset_storage_mode == "disk" and session.dataset_path and Path(session.dataset_path).exists():
        return iter_dataset_chunks(Path(session.dataset_path), columns=target_columns)

    frame = session.df.copy() if session.df is not None else pd.DataFrame(columns=target_columns)
    if target_columns:
        available = [column for column in target_columns if column in frame.columns]
        frame = frame.loc[:, available].copy()
    return [frame]


def _exact_numeric_stats(session: Any, columns: list[str], sample_frame: pd.DataFrame) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    target_columns = list(dict.fromkeys(column for column in columns if column))
    if not target_columns:
        return stats

    for chunk in _frame_iterator_for_columns(session, target_columns):
        if chunk is None or chunk.empty:
            continue
        for column in target_columns:
            if column not in chunk.columns:
                continue
            series = pd.to_numeric(chunk[column], errors="coerce").dropna()
            if series.empty:
                continue
            entry = stats.setdefault(
                column,
                {
                    "min": None,
                    "max": None,
                    "sum": 0.0,
                    "count": 0,
                },
            )
            chunk_min = float(series.min())
            chunk_max = float(series.max())
            entry["min"] = chunk_min if entry["min"] is None else min(float(entry["min"]), chunk_min)
            entry["max"] = chunk_max if entry["max"] is None else max(float(entry["max"]), chunk_max)
            entry["sum"] += float(series.sum())
            entry["count"] += int(series.count())

    for column, entry in list(stats.items()):
        count = int(entry.get("count") or 0)
        if count <= 0:
            stats.pop(column, None)
            continue
        entry["mean"] = round(float(entry["sum"]) / count, 4)
        entry["sum"] = round(float(entry["sum"]), 4)
        if column in sample_frame.columns:
            sampled = pd.to_numeric(sample_frame[column], errors="coerce").dropna()
            if not sampled.empty:
                entry["median"] = round(float(sampled.median()), 4)
        entry["min"] = round(float(entry["min"]), 4) if entry["min"] is not None else None
        entry["max"] = round(float(entry["max"]), 4) if entry["max"] is not None else None

    return stats


def _exact_top_categories(session: Any, columns: list[str], limit: int = TOP_VALUES_LIMIT) -> dict[str, list[dict[str, Any]]]:
    counts_map: dict[str, Counter[str]] = {column: Counter() for column in columns if column}
    if not counts_map:
        return {}

    for chunk in _frame_iterator_for_columns(session, list(counts_map.keys())):
        if chunk is None or chunk.empty:
            continue
        for column, counter in counts_map.items():
            if column not in chunk.columns:
                continue
            series = chunk[column].dropna()
            if series.empty:
                continue
            counter.update({str(label): int(count) for label, count in series.astype(str).value_counts().items()})

    payload = {}
    for column, counter in counts_map.items():
        if not counter:
            continue
        payload[column] = [
            {"label": label, "count": int(count)}
            for label, count in counter.most_common(limit)
        ]
    return payload


def _exact_correlations(session: Any, pairs: list[tuple[str, str]]) -> list[dict[str, Any]]:
    unique_pairs = []
    seen = set()
    for left, right in pairs:
        if not left or not right or left == right:
            continue
        key = tuple(sorted((left, right)))
        if key in seen:
            continue
        seen.add(key)
        unique_pairs.append((left, right))

    if not unique_pairs:
        return []

    columns = list(dict.fromkeys([column for pair in unique_pairs for column in pair]))
    accumulators = {
        tuple(sorted((left, right))): {
            "left": left,
            "right": right,
            "count": 0,
            "sum_x": 0.0,
            "sum_y": 0.0,
            "sum_xx": 0.0,
            "sum_yy": 0.0,
            "sum_xy": 0.0,
        }
        for left, right in unique_pairs
    }

    for chunk in _frame_iterator_for_columns(session, columns):
        if chunk is None or chunk.empty:
            continue
        for left, right in unique_pairs:
            pair_key = tuple(sorted((left, right)))
            if left not in chunk.columns or right not in chunk.columns:
                continue
            pair_frame = chunk[[left, right]].apply(pd.to_numeric, errors="coerce").dropna()
            if pair_frame.empty:
                continue
            entry = accumulators[pair_key]
            x = pair_frame[left].astype(float)
            y = pair_frame[right].astype(float)
            entry["count"] += int(len(pair_frame))
            entry["sum_x"] += float(x.sum())
            entry["sum_y"] += float(y.sum())
            entry["sum_xx"] += float((x * x).sum())
            entry["sum_yy"] += float((y * y).sum())
            entry["sum_xy"] += float((x * y).sum())

    results = []
    for entry in accumulators.values():
        count = int(entry["count"])
        if count < 3:
            continue
        numerator = count * entry["sum_xy"] - entry["sum_x"] * entry["sum_y"]
        denominator_x = count * entry["sum_xx"] - entry["sum_x"] ** 2
        denominator_y = count * entry["sum_yy"] - entry["sum_y"] ** 2
        denominator = float(np.sqrt(max(denominator_x, 0.0) * max(denominator_y, 0.0)))
        if denominator <= 0:
            continue
        correlation = numerator / denominator
        if not np.isfinite(correlation):
            continue
        results.append(
            {
                "left": entry["left"],
                "right": entry["right"],
                "correlation": round(float(correlation), 4),
                "absolute": round(abs(float(correlation)), 4),
                "count": count,
            }
        )

    results.sort(key=lambda item: item["absolute"], reverse=True)
    return results


def _question_time_trend(
    prompt: str,
    summary: dict[str, Any],
    sample_frame: pd.DataFrame,
    focus_columns: list[str],
) -> dict[str, Any] | None:
    if not _prompt_has_keyword(prompt, TREND_QUERY_KEYWORDS):
        return None

    datetime_columns = _datetime_columns_from_summary(summary)
    numeric_columns = _numeric_columns_from_summary(summary)
    date_column = next((column for column in focus_columns if column in datetime_columns), None) or (datetime_columns[0] if datetime_columns else None)
    value_column = next((column for column in focus_columns if column in numeric_columns), None) or (numeric_columns[0] if numeric_columns else None)
    if not date_column or not value_column:
        return None
    if date_column not in sample_frame.columns or value_column not in sample_frame.columns:
        return None

    trend_frame = sample_frame[[date_column, value_column]].copy()
    trend_frame[date_column] = pd.to_datetime(trend_frame[date_column], errors="coerce")
    trend_frame[value_column] = pd.to_numeric(trend_frame[value_column], errors="coerce")
    trend_frame = trend_frame.dropna()
    if len(trend_frame) < 3:
        return None

    trend_frame["__bucket__"] = trend_frame[date_column].dt.to_period("M").astype(str)
    monthly = trend_frame.groupby("__bucket__")[value_column].sum().reset_index().sort_values("__bucket__")
    if len(monthly) < 2:
        return None

    start_value = float(monthly[value_column].iloc[0])
    end_value = float(monthly[value_column].iloc[-1])
    top_row = monthly.loc[monthly[value_column].idxmax()]
    low_row = monthly.loc[monthly[value_column].idxmin()]
    direction = "upward" if end_value >= start_value else "downward"

    return {
        "date_column": date_column,
        "value_column": value_column,
        "direction": direction,
        "start_period": str(monthly["__bucket__"].iloc[0]),
        "end_period": str(monthly["__bucket__"].iloc[-1]),
        "start_value": round(start_value, 4),
        "end_value": round(end_value, 4),
        "top_period": str(top_row["__bucket__"]),
        "top_value": round(float(top_row[value_column]), 4),
        "low_period": str(low_row["__bucket__"]),
        "low_value": round(float(low_row[value_column]), 4),
        "sample_based": True,
    }


def _direct_answer_for_prompt(
    prompt: str,
    summary: dict[str, Any],
    focus_columns: list[str],
    numeric_stats: dict[str, dict[str, Any]],
    categorical_rankings: dict[str, list[dict[str, Any]]],
    relevant_correlations: list[dict[str, Any]],
    time_trend: dict[str, Any] | None,
) -> str:
    dataset_name = summary.get("dataset_name", "Dataset")
    meta_lookup = _column_meta_lookup(summary)

    if _is_column_count_query(prompt):
        return f"{dataset_name} currently has {summary.get('cols', 0)} columns."

    if _is_row_count_query(prompt):
        return f"{dataset_name} currently has {summary.get('rows', 0):,} rows."

    if _prompt_has_keyword(prompt, SCHEMA_QUERY_KEYWORDS, fuzzy_threshold=0.66):
        columns = summary.get("columns", [])
        preview = ", ".join(columns[:10])
        suffix = "..." if len(columns) > 10 else ""
        return f"{dataset_name} includes {summary.get('cols', 0)} columns: {preview}{suffix}"

    if _prompt_has_keyword(prompt, MISSING_QUERY_KEYWORDS):
        matched_focus = focus_columns[0] if focus_columns else None
        if matched_focus:
            meta = meta_lookup.get(matched_focus) or {}
            missing = int(meta.get("missing", meta.get("null", 0)) or 0)
            return f"{matched_focus} has {missing:,} missing values."
        return f"{dataset_name} currently has {int(summary.get('missing_total') or 0):,} missing values in total."

    if _prompt_has_keyword(prompt, UNIQUE_QUERY_KEYWORDS):
        matched_focus = focus_columns[0] if focus_columns else None
        if matched_focus:
            meta = meta_lookup.get(matched_focus) or {}
            unique = int(meta.get("unique") or 0)
            return f"{matched_focus} has {unique:,} unique values."

    if relevant_correlations and _prompt_has_keyword(prompt, CORRELATION_QUERY_KEYWORDS):
        strongest = relevant_correlations[0]
        direction = "positive" if float(strongest.get("correlation", 0)) >= 0 else "negative"
        return (
            f"{strongest['left']} and {strongest['right']} have a {direction} correlation of "
            f"{_format_metric(strongest.get('correlation'))}."
        )

    matched_numeric = next((column for column in focus_columns if column in numeric_stats), None) or next(iter(numeric_stats.keys()), None)
    if matched_numeric:
        stats = numeric_stats[matched_numeric]
        if _prompt_has_keyword(prompt, MAX_QUERY_KEYWORDS):
            return f"The highest value for {matched_numeric} is {_format_metric(stats.get('max'))}."
        if _prompt_has_keyword(prompt, MIN_QUERY_KEYWORDS):
            return f"The lowest value for {matched_numeric} is {_format_metric(stats.get('min'))}."
        if _prompt_has_keyword(prompt, AVERAGE_QUERY_KEYWORDS):
            return f"The average value for {matched_numeric} is {_format_metric(stats.get('mean'))}."
        if _prompt_has_keyword(prompt, MEDIAN_QUERY_KEYWORDS) and stats.get("median") is not None:
            return f"The median sampled value for {matched_numeric} is {_format_metric(stats.get('median'))}."
        if _prompt_has_keyword(prompt, SUM_QUERY_KEYWORDS) and not _is_row_count_query(prompt) and not _is_column_count_query(prompt):
            return f"The total for {matched_numeric} is {_format_metric(stats.get('sum'))}."

    matched_category = next((column for column in focus_columns if column in categorical_rankings), None) or next(iter(categorical_rankings.keys()), None)
    if matched_category and _prompt_has_keyword(prompt, FREQUENCY_RANK_QUERY_KEYWORDS):
        top_value = categorical_rankings[matched_category][0]
        return f"{top_value['label']} is the leading value in {matched_category} with {top_value['count']:,} rows."

    if time_trend is not None:
        if _prompt_has_keyword(prompt, DROP_QUERY_KEYWORDS):
            return (
                f"The weakest sampled month for {time_trend['value_column']} is {time_trend['low_period']} "
                f"at {_format_metric(time_trend['low_value'])}."
            )
        if _prompt_has_keyword(prompt, PEAK_QUERY_KEYWORDS):
            return (
                f"The strongest sampled month for {time_trend['value_column']} is {time_trend['top_period']} "
                f"at {_format_metric(time_trend['top_value'])}."
            )
        return (
            f"{time_trend['value_column']} shows an overall {time_trend['direction']} trend from "
            f"{time_trend['start_period']} to {time_trend['end_period']} in the sampled time view."
        )

    return ""


def build_question_context(session: Any, session_id: str, prompt: str) -> dict[str, Any]:
    cache_key = _question_cache_key(session_id, session, prompt)
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    summary = build_dataset_analysis_summary(session, session_id)
    focus_columns = _infer_focus_columns(prompt, summary)
    meta_lookup = _column_meta_lookup(summary)
    sample_columns = focus_columns or list(summary.get("columns", [])[:8])
    sample_frame = load_analysis_frame(session, columns=sample_columns or None, sample_size=QUESTION_SAMPLE_ROWS)
    numeric_focus = [column for column in focus_columns if column in _numeric_columns_from_summary(summary)]
    if _prompt_has_keyword(prompt, STAT_QUERY_KEYWORDS):
        for column in focus_columns:
            if column not in numeric_focus:
                numeric_focus.append(column)
    numeric_focus = numeric_focus[:3]
    categorical_focus = [column for column in focus_columns if column in _categorical_columns_from_summary(summary)][:2]
    numeric_stats = _exact_numeric_stats(session, numeric_focus, sample_frame)
    categorical_rankings = _exact_top_categories(session, categorical_focus)
    time_trend = _question_time_trend(prompt, summary, sample_frame, focus_columns)

    correlation_pairs = summary.get("correlations", [])
    numeric_focus_pairs = []
    if _prompt_has_keyword(prompt, CORRELATION_QUERY_KEYWORDS):
        numeric_focus_columns = [column for column in focus_columns if column in _numeric_columns_from_summary(summary)]
        for index, left in enumerate(numeric_focus_columns):
            for right in numeric_focus_columns[index + 1:]:
                numeric_focus_pairs.append((left, right))
    relevant_correlations = _exact_correlations(session, numeric_focus_pairs)[:3] if numeric_focus_pairs else []
    if not relevant_correlations:
        relevant_correlations = [
            pair for pair in correlation_pairs
            if any(column in focus_columns for column in (pair.get("left"), pair.get("right")))
        ][:3]
    if not relevant_correlations and _prompt_has_keyword(prompt, CORRELATION_QUERY_KEYWORDS):
        relevant_correlations = correlation_pairs[:3]

    facts = []
    if focus_columns:
        facts.append(f"Matched columns for this question: {', '.join(focus_columns)}.")

    for column, stats in numeric_stats.items():
        parts = [
            f"{column} min { _format_metric(stats.get('min')) }",
            f"max { _format_metric(stats.get('max')) }",
            f"mean { _format_metric(stats.get('mean')) }",
        ]
        if stats.get("median") is not None:
            parts.append(f"sample median { _format_metric(stats.get('median')) }")
        facts.append(f"Exact stats for {column}: {', '.join(parts)}.")

    for column, values in categorical_rankings.items():
        if not values:
            continue
        preview = ", ".join(f"{item['label']} ({item['count']:,})" for item in values[:3])
        facts.append(f"Top values in {column}: {preview}.")

    for column in focus_columns:
        item = meta_lookup.get(column) or {}
        missing = int(item.get("missing", item.get("null", 0)) or 0)
        unique = int(item.get("unique") or 0)
        if missing or _prompt_has_keyword(prompt, MISSING_QUERY_KEYWORDS):
            facts.append(f"{column} has {missing:,} missing values and {unique:,} unique values.")

    for pair in relevant_correlations:
        direction = "positive" if float(pair.get("correlation", 0)) >= 0 else "negative"
        facts.append(
            f"{pair['left']} and {pair['right']} have a {direction} correlation of {pair['correlation']}."
        )

    if time_trend is not None:
        facts.append(
            f"Sampled monthly trend for {time_trend['value_column']}: {time_trend['direction']} from "
            f"{time_trend['start_period']} ({_format_metric(time_trend['start_value'])}) to "
            f"{time_trend['end_period']} ({_format_metric(time_trend['end_value'])})."
        )
        facts.append(
            f"Sampled peak month is {time_trend['top_period']} at {_format_metric(time_trend['top_value'])}; "
            f"lowest month is {time_trend['low_period']} at {_format_metric(time_trend['low_value'])}."
        )

    direct_answer = _direct_answer_for_prompt(
        prompt,
        summary,
        focus_columns,
        numeric_stats,
        categorical_rankings,
        relevant_correlations,
        time_trend,
    )
    clarification_message = _clarification_message_for_prompt(prompt, summary, focus_columns) if not direct_answer else ""
    payload = sanitize_for_json(
        {
            "focus_columns": focus_columns,
            "facts": facts[:10],
            "direct_answer": direct_answer,
            "clarification_message": clarification_message,
            "needs_clarification": bool(clarification_message),
            "numeric_stats": numeric_stats,
            "categorical_rankings": categorical_rankings,
            "relevant_correlations": relevant_correlations,
            "time_trend": time_trend,
        }
    )
    cache.set_json(cache_key, payload, ttl_seconds=180)
    return payload


def build_question_context_from_summary(summary: dict[str, Any], prompt: str) -> dict[str, Any]:
    focus_columns = _infer_focus_columns(prompt, summary)
    meta_lookup = _column_meta_lookup(summary)
    sample_frame = pd.DataFrame(summary.get("sample_rows", []) or [])
    if not sample_frame.empty:
        sample_frame = optimize_memory(sample_frame)

    numeric_stats = {}
    for column in focus_columns:
        if column in summary.get("numeric_summary", {}):
            numeric_stats[column] = summary["numeric_summary"][column]
            continue
        if column not in sample_frame.columns:
            continue
        series = pd.to_numeric(sample_frame[column], errors="coerce").dropna()
        if series.empty:
            continue
        numeric_stats[column] = {
            "min": round(float(series.min()), 4),
            "max": round(float(series.max()), 4),
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "sum": round(float(series.sum()), 4),
            "count": int(series.count()),
        }

    categorical_rankings = {}
    for column in focus_columns:
        if column in summary.get("categorical_summary", {}):
            categorical_rankings[column] = summary["categorical_summary"][column]
            continue
        if column not in sample_frame.columns:
            continue
        categorical_rankings[column] = _top_counts(sample_frame[column])

    time_trend = _question_time_trend(prompt, summary, sample_frame, focus_columns) if not sample_frame.empty else None

    relevant_correlations = [
        pair
        for pair in summary.get("correlations", [])
        if any(column in focus_columns for column in (pair.get("left"), pair.get("right")))
    ][:3]

    facts = []
    if focus_columns:
        facts.append(f"Matched columns for this question: {', '.join(focus_columns)}.")

    for column, stats in numeric_stats.items():
        parts = [
            f"{column} min {_format_metric(stats.get('min'))}",
            f"max {_format_metric(stats.get('max'))}",
            f"mean {_format_metric(stats.get('mean'))}",
        ]
        if stats.get("median") is not None:
            parts.append(f"sample median {_format_metric(stats.get('median'))}")
        facts.append(f"Sample-backed stats for {column}: {', '.join(parts)}.")

    for column, values in categorical_rankings.items():
        if not values:
            continue
        preview = ", ".join(f"{item['label']} ({item['count']:,})" for item in values[:3])
        facts.append(f"Top values in {column}: {preview}.")

    for column in focus_columns:
        item = meta_lookup.get(column) or {}
        missing = int(item.get("missing", item.get("null", 0)) or 0)
        unique = int(item.get("unique") or 0)
        if missing or _prompt_has_keyword(prompt, MISSING_QUERY_KEYWORDS):
            facts.append(f"{column} has {missing:,} missing values and {unique:,} unique values.")

    for pair in relevant_correlations:
        direction = "positive" if float(pair.get("correlation", 0)) >= 0 else "negative"
        facts.append(
            f"{pair['left']} and {pair['right']} have a {direction} correlation of {pair['correlation']}."
        )

    if time_trend is not None:
        facts.append(
            f"Sampled monthly trend for {time_trend['value_column']}: {time_trend['direction']} from "
            f"{time_trend['start_period']} ({_format_metric(time_trend['start_value'])}) to "
            f"{time_trend['end_period']} ({_format_metric(time_trend['end_value'])})."
        )

    direct_answer = _direct_answer_for_prompt(
        prompt,
        summary,
        focus_columns,
        numeric_stats,
        categorical_rankings,
        relevant_correlations,
        time_trend,
    )
    clarification_message = _clarification_message_for_prompt(prompt, summary, focus_columns) if not direct_answer else ""
    return sanitize_for_json(
        {
            "focus_columns": focus_columns,
            "facts": facts[:10],
            "direct_answer": direct_answer,
            "clarification_message": clarification_message,
            "needs_clarification": bool(clarification_message),
            "numeric_stats": numeric_stats,
            "categorical_rankings": categorical_rankings,
            "relevant_correlations": relevant_correlations,
            "time_trend": time_trend,
            "sample_based": True,
        }
    )


def should_use_direct_answer(prompt: str, question_context: dict[str, Any] | None = None) -> bool:
    prompt_text = str(prompt or "").strip()
    question_context = question_context or {}
    direct_answer = str(question_context.get("direct_answer") or "").strip()
    clarification_message = str(question_context.get("clarification_message") or "").strip()
    if clarification_message:
        return True
    if not direct_answer:
        return False
    if _prompt_has_keyword(prompt_text, EXPLANATION_QUERY_KEYWORDS):
        return False
    return _prompt_has_keyword(prompt_text, DIRECT_RESPONSE_KEYWORDS) or len(_prompt_tokens(prompt_text)) <= 14


def suggest_chart_request(session: Any, session_id: str, prompt: str) -> dict[str, Any] | None:
    if not _prompt_has_keyword(prompt, VISUAL_KEYWORDS):
        return None

    cache_key = _chart_cache_key(session_id, session, prompt)
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    summary = build_dataset_analysis_summary(session, session_id)
    matched_columns = _matched_columns(prompt, summary.get("columns", []))
    frame = load_analysis_frame(session, columns=matched_columns or None, sample_size=5_000)
    if frame.empty:
        return None

    chart_type = _detect_chart_type(prompt)
    suggestion = suggest_dashboard_widget(
        frame,
        {
            "chart_type": chart_type,
            "selected_columns": matched_columns,
            "theme": "dark",
        },
    )
    payload = sanitize_for_json(
        {
            "chart_type": suggestion.get("chart_type") or chart_type,
            "title": suggestion.get("title") or "Suggested chart",
            "mapping": suggestion.get("mapping") or {},
            "reason": suggestion.get("reason") or "Suggested from your question and detected dataset fields.",
            "selected_columns": matched_columns,
        }
    )
    cache.set_json(cache_key, payload, ttl_seconds=300)
    return payload


def fallback_chat_reply(
    prompt: str,
    summary: dict[str, Any],
    chart_request: dict[str, Any] | None = None,
    question_context: dict[str, Any] | None = None,
) -> str:
    prompt_lower = str(prompt or "").lower()
    numeric_summary = summary.get("numeric_summary", {})
    categorical_summary = summary.get("categorical_summary", {})
    question_context = question_context or {}
    direct_answer = str(question_context.get("direct_answer") or "").strip()
    clarification_message = str(question_context.get("clarification_message") or "").strip()
    question_facts = [str(item).strip() for item in question_context.get("facts", []) if str(item).strip()]

    matched_numeric = next((column for column in numeric_summary if _normalize(column) in _normalize(prompt_lower)), None)
    matched_category = next((column for column in categorical_summary if _normalize(column) in _normalize(prompt_lower)), None)

    if clarification_message:
        return clarification_message

    if direct_answer:
        reply_parts = [direct_answer]
        supporting_facts = [fact for fact in question_facts if fact != direct_answer][:2]
        reply_parts.extend(supporting_facts)
        if chart_request:
            reply_parts.append(f"I also prepared a {chart_request['title']} visual suggestion you can add to the dashboard.")
        return " ".join(reply_parts)

    if matched_numeric:
        stats = numeric_summary[matched_numeric]
        if _prompt_has_keyword(prompt, MAX_QUERY_KEYWORDS):
            return f"The highest sampled value for {matched_numeric} is {stats['max']:,}."
        if _prompt_has_keyword(prompt, MIN_QUERY_KEYWORDS):
            return f"The lowest sampled value for {matched_numeric} is {stats['min']:,}."
        if _prompt_has_keyword(prompt, AVERAGE_QUERY_KEYWORDS):
            return f"The average sampled value for {matched_numeric} is {stats['mean']:,}."

    if matched_category and categorical_summary.get(matched_category):
        top_value = categorical_summary[matched_category][0]
        if _prompt_has_keyword(prompt, RANKING_QUERY_KEYWORDS):
            return f"{top_value['label']} is currently the leading segment in {matched_category} with {top_value['count']:,} sampled rows."

    insights = summary.get("insights", [])
    reply_parts = []
    if question_facts:
        reply_parts.append("Here are the strongest facts I can confirm for that question:")
        reply_parts.extend(question_facts[:4])
    elif insights:
        reply_parts.append("Here are the strongest signals I can confirm from the current dataset context:")
        reply_parts.extend(insights[:3])
    else:
        reply_parts.append(f"{summary.get('dataset_name', 'Dataset')} is loaded with {summary.get('rows', 0):,} rows and {summary.get('cols', 0)} columns.")

    if chart_request:
        reply_parts.append(f"I also prepared a {chart_request['title']} visual suggestion you can add to the dashboard.")

    return " ".join(reply_parts)
