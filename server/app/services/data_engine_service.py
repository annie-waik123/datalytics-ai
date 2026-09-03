from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

import pandas as pd

from app.services.analytics_service import (
    build_dataset_analysis_summary,
    build_question_context,
    load_analysis_frame,
)
from app.services.dataset_service import iter_dataset_chunks, prepare_uploaded_dataset
from app.services.ml_service import sanitize_for_json, serialize_dataframe

DEFAULT_EXPORT_LIMIT = 5_000
MAX_EXPORT_LIMIT = 50_000
TOP_RESULT_LIMIT = 10
CHART_POINT_LIMIT = 12
INSIGHT_NUMERIC_LIMIT = 3
NUMERIC_DTYPE_HINTS = ("int", "float", "double", "decimal", "number")
DATETIME_DTYPE_HINTS = ("datetime", "date", "time")
DATETIME_NAME_HINTS = ("date", "time", "month", "year", "day")

COUNT_KEYWORDS = ("count", "how many", "number of")
AVERAGE_KEYWORDS = ("average", "avg", "mean")
SUM_KEYWORDS = ("sum", "total")
MAX_KEYWORDS = ("highest", "max", "maximum", "largest", "best")
MIN_KEYWORDS = ("lowest", "min", "minimum", "smallest", "worst")
TREND_KEYWORDS = ("trend", "over time", "timeline", "monthly", "daily", "weekly")
COMPARISON_KEYWORDS = ("compare", "comparison", "versus", " vs ", "against")
DIRECT_CONTEXT_KEYWORDS = ("missing", "null", "blank", "unique", "distinct", "correlation", "related", "schema", "columns")
STOPWORDS = {
    "the",
    "a",
    "an",
    "of",
    "to",
    "for",
    "in",
    "on",
    "by",
    "with",
    "show",
    "get",
    "find",
    "what",
    "which",
    "is",
    "are",
    "this",
    "that",
    "dataset",
    "data",
}


@dataclass
class FilterSpec:
    column: str
    operator: str
    value: Any
    raw_value: str = ""


@dataclass
class QueryPlan:
    intent: str
    metric: str | None = None
    top_n: int = 5
    matched_columns: list[str] = field(default_factory=list)
    filters: list[FilterSpec] = field(default_factory=list)


def has_live_dataset(session: Any) -> bool:
    return session.df is not None or bool(session.dataset_snapshot)


def saved_dataset_path(session_id: str, document: dict[str, Any] | None) -> Path | None:
    dataset_dir = Path(__file__).resolve().parents[1] / ".cache" / "datasets" / session_id
    if not dataset_dir.exists():
        return None

    candidates = [path for path in dataset_dir.iterdir() if path.is_file()]
    if not candidates:
        return None

    candidates.sort(key=lambda item: item.stat().st_mtime, reverse=True)
    filename = str((document or {}).get("filename") or (document or {}).get("meta", {}).get("filename") or "").strip().lower()
    if filename:
        matched = next((path for path in candidates if path.name.lower().endswith(filename)), None)
        if matched is not None:
            return matched
    return candidates[0]


def restore_live_dataset(session: Any, session_id: str, document: dict[str, Any] | None) -> bool:
    if has_live_dataset(session):
        return True

    source_path = saved_dataset_path(session_id, document)
    if source_path is None or not source_path.exists():
        return False

    filename = str((document or {}).get("filename") or (document or {}).get("meta", {}).get("filename") or "").strip()
    if not filename:
        filename = source_path.name.split("_", 1)[-1] if "_" in source_path.name else source_path.name

    try:
        prepare_uploaded_dataset(
            session=session,
            session_id=session_id,
            filename=filename,
            source_path=source_path,
            file_size=int(source_path.stat().st_size),
        )
    except Exception:
        return False
    return has_live_dataset(session)


async def ensure_live_dataset(session: Any, session_id: str) -> bool:
    """
    Ensure the session has a live DataFrame (restoring from the saved dataset
    file when the session was recreated after a restart).
    """
    if has_live_dataset(session):
        return True
    try:
        from app.core.database import get_dataset
        document = await get_dataset(session_id)
        if document is not None:
            return restore_live_dataset(session, session_id, document)
    except Exception:
        pass
    return has_live_dataset(session)


def build_dataset_json_payload(session: Any, row_limit: int = DEFAULT_EXPORT_LIMIT) -> dict[str, Any]:
    columns = _available_columns(session)
    limit = max(1, min(int(row_limit or DEFAULT_EXPORT_LIMIT), MAX_EXPORT_LIMIT))
    rows: list[dict[str, Any]] = []

    for chunk in _iter_dataset_chunks(session, columns=columns):
        if chunk is None or chunk.empty:
            continue
        remaining = limit - len(rows)
        if remaining <= 0:
            break
        rows.extend(serialize_dataframe(chunk.head(remaining), limit=None))

    total_rows = int(session.dataset_row_count or len(rows))
    schema = _schema_info(session)
    return sanitize_for_json(
        {
            "metadata": {
                "dataset_name": session.dataset_name or "Dataset",
                "columns": columns,
                "column_types": schema["types"],
                "total_rows": total_rows,
                "exported_rows": len(rows),
                "sampled_export": total_rows > len(rows),
                "storage_mode": session.dataset_storage_mode or "memory",
            },
            "data": rows,
        }
    )


def build_query_response(session: Any, session_id: str, prompt: str) -> dict[str, Any]:
    if not has_live_dataset(session):
        return {
            "answer": "Upload a dataset first.",
            "insights": {},
            "chart": {},
        }

    question = str(prompt or "").strip()
    if not question:
        return {
            "answer": "Ask a dataset question to begin.",
            "insights": {},
            "chart": {},
        }

    summary = build_dataset_analysis_summary(session, session_id)
    question_context = build_question_context(session, session_id, question)
    schema = _schema_info(session)
    plan = _plan_query(question, schema)

    answer = ""
    chart: dict[str, Any] = {}

    if _use_custom_query_engine(question, plan):
        answer, chart = _execute_custom_plan(session, schema, plan)

    if not answer:
        direct_answer = str(question_context.get("direct_answer") or "").strip()
        clarification = str(question_context.get("clarification_message") or "").strip()
        if direct_answer:
            answer = direct_answer
        elif clarification:
            answer = clarification
        else:
            answer = _fallback_answer(summary, question_context)

    if not chart:
        chart = _default_chart(session, schema, plan.filters)

    insights = _build_insights(session, summary, schema, plan)
    return sanitize_for_json(
        {
            "answer": answer,
            "insights": insights,
            "chart": chart,
        }
    )


def _use_custom_query_engine(prompt: str, plan: QueryPlan) -> bool:
    prompt_lower = str(prompt or "").lower()
    if any(keyword in prompt_lower for keyword in DIRECT_CONTEXT_KEYWORDS):
        return False
    return bool(plan.filters or plan.metric or plan.intent in {"trend", "comparison", "ranking", "filter"})


def _fallback_answer(summary: dict[str, Any], question_context: dict[str, Any]) -> str:
    facts = [str(item).strip() for item in question_context.get("facts", []) if str(item).strip()]
    if facts:
        return facts[0]

    insights = [str(item).strip() for item in summary.get("insights", []) if str(item).strip()]
    if insights:
        return insights[0]

    return (
        f"{summary.get('dataset_name', 'Dataset')} has "
        f"{int(summary.get('rows', 0)):,} rows and {int(summary.get('cols', 0))} columns."
    )


def _available_columns(session: Any) -> list[str]:
    columns = list(session.dataset_columns or session.dataset_snapshot.get("all_columns", []))
    if columns:
        return [str(column) for column in columns]
    if session.df is not None:
        return [str(column) for column in session.df.columns.tolist()]
    return []


def _iter_dataset_chunks(session: Any, columns: list[str] | None = None) -> Iterator[pd.DataFrame]:
    selected_columns = list(dict.fromkeys(str(column) for column in (columns or []) if column))
    if session.dataset_storage_mode == "disk" and session.dataset_path and Path(session.dataset_path).exists():
        yield from iter_dataset_chunks(Path(session.dataset_path), columns=selected_columns or None)
        return

    frame = session.df.copy() if session.df is not None else pd.DataFrame(columns=selected_columns)
    if selected_columns:
        available = [column for column in selected_columns if column in frame.columns]
        frame = frame.loc[:, available].copy()
    yield frame


def _iter_filtered_chunks(
    session: Any,
    columns: list[str] | None = None,
    filters: list[FilterSpec] | None = None,
) -> Iterator[pd.DataFrame]:
    target_columns = list(dict.fromkeys(
        [str(column) for column in (columns or []) if column]
        + [filter_spec.column for filter_spec in (filters or []) if filter_spec.column]
    ))
    for chunk in _iter_dataset_chunks(session, columns=target_columns or None):
        if chunk is None or chunk.empty:
            continue
        filtered = _apply_filters(chunk, filters or [])
        if filtered.empty:
            continue
        if columns:
            available = [column for column in columns if column in filtered.columns]
            filtered = filtered.loc[:, available].copy()
        yield filtered


def _schema_info(session: Any) -> dict[str, Any]:
    columns = _available_columns(session)
    snapshot = session.dataset_snapshot or {}
    meta_lookup = {
        str(item.get("column")): item
        for item in snapshot.get("columns_info", [])
        if item.get("column")
    }
    sample_frame = load_analysis_frame(session, columns=columns[: min(len(columns), 20)] or None, sample_size=2_000)
    types: dict[str, str] = {}
    numeric_columns: list[str] = []
    categorical_columns: list[str] = []
    datetime_columns: list[str] = []

    for column in columns:
        meta = meta_lookup.get(column) or {}
        dtype = str(meta.get("dtype") or "")
        series = sample_frame[column] if column in sample_frame.columns else None
        kind = "categorical"

        if any(token in dtype.lower() for token in DATETIME_DTYPE_HINTS):
            kind = "datetime"
        elif any(token in dtype.lower() for token in NUMERIC_DTYPE_HINTS):
            kind = "numeric"
        elif series is not None and pd.api.types.is_numeric_dtype(series):
            kind = "numeric"
        elif _looks_like_datetime(column, series):
            kind = "datetime"

        types[column] = kind
        if kind == "numeric":
            numeric_columns.append(column)
        elif kind == "datetime":
            datetime_columns.append(column)
        else:
            categorical_columns.append(column)

    return {
        "columns": columns,
        "types": types,
        "numeric_columns": numeric_columns,
        "categorical_columns": categorical_columns,
        "datetime_columns": datetime_columns,
    }


def _looks_like_datetime(column: str, series: pd.Series | None) -> bool:
    normalized = _normalize_identifier(column)
    if any(hint in normalized for hint in DATETIME_NAME_HINTS):
        return True
    if series is None or series.empty:
        return False
    parsed = pd.to_datetime(series, errors="coerce")
    return float(parsed.notna().mean()) >= 0.7


def _normalize_identifier(value: str) -> str:
    return "".join(character for character in str(value or "").lower() if character.isalnum())


def _match_columns(prompt: str, columns: list[str]) -> list[str]:
    prompt_lower = str(prompt or "").lower()
    prompt_normalized = _normalize_identifier(prompt)
    prompt_tokens = set(re.findall(r"[a-z0-9]+", prompt_lower))
    scored: list[tuple[int, str]] = []

    for column in columns:
        score = 0
        lower = column.lower()
        normalized = _normalize_identifier(column)
        tokens = [token for token in re.findall(r"[a-z0-9]+", lower) if token not in STOPWORDS]

        if lower and re.search(rf"(?<!\w){re.escape(lower)}(?!\w)", prompt_lower):
            score += 100 + len(lower)
        if normalized and len(normalized) >= 4 and normalized in prompt_normalized:
            score += 80 + len(normalized)
        overlap = sum(1 for token in tokens if token in prompt_tokens)
        score += overlap * 12

        if score > 0:
            scored.append((score, column))

    scored.sort(key=lambda item: (-item[0], item[1]))
    ordered: list[str] = []
    for _, column in scored:
        if column not in ordered:
            ordered.append(column)
    return ordered[:6]


def _parse_filters(prompt: str, columns: list[str]) -> list[FilterSpec]:
    filters: list[FilterSpec] = []
    prompt_text = str(prompt or "")
    ordered_columns = sorted(columns, key=len, reverse=True)

    for column in ordered_columns:
        escaped = re.escape(column)
        boundary = rf"(?<!\w){escaped}(?!\w)"
        patterns = [
            (rf"{boundary}\s*(>=|<=|!=|=|>|<)\s*([^,;\n\?]+)", None),
            (rf"{boundary}\s+greater than or equal to\s+([^,;\n\?]+)", ">="),
            (rf"{boundary}\s+less than or equal to\s+([^,;\n\?]+)", "<="),
            (rf"{boundary}\s+greater than\s+([^,;\n\?]+)", ">"),
            (rf"{boundary}\s+less than\s+([^,;\n\?]+)", "<"),
            (rf"{boundary}\s+not equal to\s+([^,;\n\?]+)", "!="),
            (rf"{boundary}\s+(?:equals?|is)\s+([^,;\n\?]+)", "="),
        ]

        for pattern, fixed_operator in patterns:
            match = re.search(pattern, prompt_text, flags=re.IGNORECASE)
            if not match:
                continue

            operator = fixed_operator or match.group(1)
            raw_value = match.group(2) if fixed_operator is None else match.group(1)
            cleaned_value = _clean_filter_value(raw_value)
            if not cleaned_value:
                continue

            filter_spec = FilterSpec(
                column=column,
                operator=operator,
                value=_parse_filter_value(cleaned_value),
                raw_value=cleaned_value,
            )
            if not any(existing.column == filter_spec.column and existing.operator == filter_spec.operator and existing.raw_value == filter_spec.raw_value for existing in filters):
                filters.append(filter_spec)
            break

    return filters


def _clean_filter_value(raw_value: str) -> str:
    text = str(raw_value or "").strip()
    text = re.split(
        r"\b(?:and|then|with|where|show|count|average|mean|sum|total|compare|versus|vs|trend)\b",
        text,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0]
    return text.strip(" .?,'\"")


def _parse_filter_value(raw_value: str) -> Any:
    text = str(raw_value or "").strip()
    lower = text.lower()
    if lower in {"true", "false"}:
        return lower == "true"
    if re.fullmatch(r"-?\d+", text):
        try:
            return int(text)
        except Exception:
            return text
    if re.fullmatch(r"-?\d+(?:\.\d+)?", text):
        try:
            return float(text)
        except Exception:
            return text
    parsed = pd.to_datetime(text, errors="coerce")
    if not pd.isna(parsed):
        return parsed
    return text


def _apply_filters(frame: pd.DataFrame, filters: list[FilterSpec]) -> pd.DataFrame:
    filtered = frame
    for filter_spec in filters:
        if filter_spec.column not in filtered.columns:
            continue

        series = filtered[filter_spec.column]
        operator = filter_spec.operator
        value = filter_spec.value

        if operator in {">", ">=", "<", "<="}:
            numeric_series = pd.to_numeric(series, errors="coerce")
            if isinstance(value, (int, float)):
                if operator == ">":
                    filtered = filtered.loc[numeric_series > float(value)]
                elif operator == ">=":
                    filtered = filtered.loc[numeric_series >= float(value)]
                elif operator == "<":
                    filtered = filtered.loc[numeric_series < float(value)]
                else:
                    filtered = filtered.loc[numeric_series <= float(value)]
                continue

            datetime_series = pd.to_datetime(series, errors="coerce")
            target_value = pd.to_datetime(value, errors="coerce")
            if not pd.isna(target_value):
                if operator == ">":
                    filtered = filtered.loc[datetime_series > target_value]
                elif operator == ">=":
                    filtered = filtered.loc[datetime_series >= target_value]
                elif operator == "<":
                    filtered = filtered.loc[datetime_series < target_value]
                else:
                    filtered = filtered.loc[datetime_series <= target_value]
                continue

        normalized_series = series.astype(str).str.strip().str.lower()
        normalized_value = str(value).strip().lower()
        if operator == "!=":
            filtered = filtered.loc[normalized_series != normalized_value]
        else:
            filtered = filtered.loc[normalized_series == normalized_value]

    return filtered


def _plan_query(prompt: str, schema: dict[str, Any]) -> QueryPlan:
    prompt_lower = str(prompt or "").lower()
    matched_columns = _match_columns(prompt, schema["columns"])
    filters = _parse_filters(prompt, schema["columns"])
    top_match = re.search(r"\btop\s+(\d+)\b", prompt_lower)
    top_n = int(top_match.group(1)) if top_match else 5

    metric = None
    if any(keyword in prompt_lower for keyword in AVERAGE_KEYWORDS):
        metric = "mean"
    elif any(keyword in prompt_lower for keyword in COUNT_KEYWORDS):
        metric = "count"
    elif any(keyword in prompt_lower for keyword in SUM_KEYWORDS) and "summary" not in prompt_lower:
        metric = "sum"
    elif any(keyword in prompt_lower for keyword in MAX_KEYWORDS):
        metric = "max"
    elif any(keyword in prompt_lower for keyword in MIN_KEYWORDS):
        metric = "min"

    intent = "overview"
    if any(keyword in prompt_lower for keyword in TREND_KEYWORDS):
        intent = "trend"
    elif any(keyword in prompt_lower for keyword in COMPARISON_KEYWORDS):
        intent = "comparison"
    elif top_match or "perform" in prompt_lower:
        intent = "ranking"
    elif metric in {"max", "min"} and any(column in schema["categorical_columns"] for column in matched_columns):
        intent = "ranking"
    elif metric is not None:
        intent = "aggregation"
    elif filters:
        intent = "filter"

    return QueryPlan(
        intent=intent,
        metric=metric,
        top_n=max(1, min(top_n, TOP_RESULT_LIMIT)),
        matched_columns=matched_columns,
        filters=filters,
    )


def _execute_custom_plan(session: Any, schema: dict[str, Any], plan: QueryPlan) -> tuple[str, dict[str, Any]]:
    if plan.intent == "trend":
        return _answer_trend_query(session, schema, plan)
    if plan.intent == "comparison":
        return _answer_comparison_query(session, schema, plan)
    if plan.intent == "ranking":
        return _answer_ranking_query(session, schema, plan)
    if plan.intent == "filter":
        return _answer_filter_query(session, plan)
    return _answer_aggregation_query(session, schema, plan)


def _answer_aggregation_query(session: Any, schema: dict[str, Any], plan: QueryPlan) -> tuple[str, dict[str, Any]]:
    if plan.metric == "count":
        count = _count_rows(session, plan.filters)
        if plan.filters:
            answer = f"{count:,} rows match {_describe_filters(plan.filters)}."
        else:
            answer = f"The dataset contains {count:,} rows."
        return answer, _filter_chart(session, plan.filters, count)

    target = _select_numeric_column(schema, plan.matched_columns)
    if target is None:
        return _numeric_clarification(schema), {}

    stats = _numeric_stats(session, [target], plan.filters).get(target)
    if not stats:
        return f"I could not compute {target} for the current selection.", {}

    metric_label = plan.metric or "mean"
    if metric_label == "mean":
        value = stats["mean"]
        answer = f"The average {target} is {_format_metric(value)} across {stats['count']:,} matching rows."
        chart = _single_value_chart(target, "average", value)
    elif metric_label == "sum":
        value = stats["sum"]
        answer = f"The total {target} is {_format_metric(value)} across {stats['count']:,} matching rows."
        chart = _single_value_chart(target, "total", value)
    elif metric_label == "max":
        answer = f"The highest {target} value is {_format_metric(stats['max'])}."
        chart = _stats_chart(target, stats)
    elif metric_label == "min":
        answer = f"The lowest {target} value is {_format_metric(stats['min'])}."
        chart = _stats_chart(target, stats)
    else:
        answer = f"{target} averages {_format_metric(stats['mean'])}."
        chart = _single_value_chart(target, "average", stats["mean"])

    return answer, chart


def _answer_filter_query(session: Any, plan: QueryPlan) -> tuple[str, dict[str, Any]]:
    count = _count_rows(session, plan.filters)
    answer = f"{count:,} rows match {_describe_filters(plan.filters)}."
    return answer, _filter_chart(session, plan.filters, count)


def _answer_comparison_query(session: Any, schema: dict[str, Any], plan: QueryPlan) -> tuple[str, dict[str, Any]]:
    matched_numeric = [column for column in plan.matched_columns if column in schema["numeric_columns"]]
    matched_categorical = [column for column in plan.matched_columns if column in schema["categorical_columns"]]

    if len(matched_numeric) >= 2:
        targets = matched_numeric[:2]
        stats = _numeric_stats(session, targets, plan.filters)
        available = [(column, stats.get(column)) for column in targets if stats.get(column)]
        if len(available) < 2:
            return "I could not compute both numeric comparisons for that question.", {}

        left, left_stats = available[0]
        right, right_stats = available[1]
        left_mean = float(left_stats["mean"])
        right_mean = float(right_stats["mean"])
        leader = left if left_mean >= right_mean else right
        answer = (
            f"On average, {leader} is higher. "
            f"{left} averages {_format_metric(left_mean)} and {right} averages {_format_metric(right_mean)}."
        )
        chart = {
            "type": "bar",
            "x": "column",
            "y": "average",
            "data": [
                {"column": left, "average": left_mean},
                {"column": right, "average": right_mean},
            ],
        }
        return answer, sanitize_for_json(chart)

    if matched_categorical:
        group_column = matched_categorical[0]
        metric_column = _select_numeric_column(schema, plan.matched_columns)
        grouped = _group_metric(
            session,
            group_column=group_column,
            value_column=metric_column,
            filters=plan.filters,
            agg="mean" if plan.metric == "mean" else "sum",
            limit=plan.top_n,
        )
        if grouped:
            leader = grouped[0]
            metric_name = metric_column or "count"
            metric_label = "average" if plan.metric == "mean" and metric_column else ("count" if metric_column is None else "total")
            answer = (
                f"{leader['label']} leads {group_column} by {metric_label} {metric_name} "
                f"at {_format_metric(leader['value'])}."
            )
            chart = {
                "type": "bar",
                "x": group_column,
                "y": metric_name,
                "data": [{group_column: item["label"], metric_name: item["value"]} for item in grouped],
            }
            return answer, sanitize_for_json(chart)

    return "I need two numeric columns or one category plus one metric column to compare.", {}


def _answer_ranking_query(session: Any, schema: dict[str, Any], plan: QueryPlan) -> tuple[str, dict[str, Any]]:
    group_column = _select_group_column(schema, plan.matched_columns)
    if group_column is None:
        return _category_clarification(schema), {}

    metric_column = _select_numeric_column(schema, plan.matched_columns)
    descending = plan.metric != "min"
    agg = "mean" if plan.metric == "mean" else "sum"

    if metric_column:
        grouped = _group_metric(
            session,
            group_column=group_column,
            value_column=metric_column,
            filters=plan.filters,
            agg=agg,
            limit=plan.top_n,
            descending=descending,
        )
        if not grouped:
            return f"I could not rank {group_column} by {metric_column}.", {}

        leader = grouped[0]
        qualifier = "average" if agg == "mean" else "total"
        if plan.top_n > 1:
            preview = ", ".join(f"{item['label']} ({_format_metric(item['value'])})" for item in grouped[: plan.top_n])
            answer = f"Top {min(plan.top_n, len(grouped))} {group_column} values by {qualifier} {metric_column}: {preview}."
        else:
            answer = f"{leader['label']} is the top {group_column} by {qualifier} {metric_column} at {_format_metric(leader['value'])}."
        chart = {
            "type": "bar",
            "x": group_column,
            "y": metric_column,
            "data": [{group_column: item["label"], metric_column: item["value"]} for item in grouped],
        }
        return answer, sanitize_for_json(chart)

    counts = _top_categories(session, group_column, plan.filters, limit=plan.top_n, descending=descending)
    if not counts:
        return f"I could not rank values for {group_column}.", {}

    leader = counts[0]
    if plan.top_n > 1:
        preview = ", ".join(f"{item['label']} ({item['count']:,})" for item in counts[: plan.top_n])
        answer = f"Top {min(plan.top_n, len(counts))} values in {group_column}: {preview}."
    else:
        answer = f"{leader['label']} is the top value in {group_column} with {leader['count']:,} rows."
    chart_type = "pie" if len(counts) <= 5 else "bar"
    chart = {
        "type": chart_type,
        "x": group_column,
        "y": "count",
        "data": [{group_column: item["label"], "count": item["count"]} for item in counts],
    }
    return answer, sanitize_for_json(chart)


def _answer_trend_query(session: Any, schema: dict[str, Any], plan: QueryPlan) -> tuple[str, dict[str, Any]]:
    date_column = _select_date_column(schema, plan.matched_columns)
    if date_column is None:
        return "I need a date or time column to answer that trend question.", {}

    value_column = _select_numeric_column(schema, plan.matched_columns)
    trend = _trend_metric(
        session,
        date_column=date_column,
        value_column=value_column,
        filters=plan.filters,
        agg="count" if value_column is None else ("mean" if plan.metric == "mean" else "sum"),
    )
    if not trend:
        return f"I could not build a trend from {date_column}.", {}

    start = trend[0]
    end = trend[-1]
    metric_name = value_column or "count"
    direction = "upward" if float(end["value"]) >= float(start["value"]) else "downward"
    peak = max(trend, key=lambda item: item["value"])
    answer = (
        f"{metric_name} shows an overall {direction} trend from {start['period']} "
        f"to {end['period']}, with the highest point in {peak['period']} "
        f"at {_format_metric(peak['value'])}."
    )
    chart = {
        "type": "line",
        "x": date_column,
        "y": metric_name,
        "data": [{date_column: item["period"], metric_name: item["value"]} for item in trend],
    }
    return answer, sanitize_for_json(chart)


def _numeric_stats(
    session: Any,
    columns: list[str],
    filters: list[FilterSpec] | None = None,
) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    target_columns = list(dict.fromkeys(str(column) for column in columns if column))
    if not target_columns:
        return stats

    for chunk in _iter_filtered_chunks(session, columns=target_columns, filters=filters):
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
        entry["min"] = round(float(entry["min"]), 4) if entry["min"] is not None else None
        entry["max"] = round(float(entry["max"]), 4) if entry["max"] is not None else None

    return sanitize_for_json(stats)


def _count_rows(session: Any, filters: list[FilterSpec] | None = None) -> int:
    total = 0
    for chunk in _iter_filtered_chunks(session, columns=None, filters=filters):
        total += int(len(chunk))
    return total


def _top_categories(
    session: Any,
    column: str,
    filters: list[FilterSpec] | None = None,
    *,
    limit: int = TOP_RESULT_LIMIT,
    descending: bool = True,
) -> list[dict[str, Any]]:
    counter: Counter[str] = Counter()
    for chunk in _iter_filtered_chunks(session, columns=[column], filters=filters):
        if column not in chunk.columns:
            continue
        counter.update({str(label): int(count) for label, count in chunk[column].dropna().astype(str).value_counts().items()})

    items = counter.most_common()
    if not descending:
        items = list(reversed(items))
    return sanitize_for_json([{"label": label, "count": int(count)} for label, count in items[:limit]])


def _group_metric(
    session: Any,
    *,
    group_column: str,
    value_column: str | None,
    filters: list[FilterSpec] | None = None,
    agg: str = "sum",
    limit: int = TOP_RESULT_LIMIT,
    descending: bool = True,
) -> list[dict[str, Any]]:
    aggregates: dict[str, dict[str, float]] = defaultdict(lambda: {"sum": 0.0, "count": 0.0})
    target_columns = [group_column] + ([value_column] if value_column else [])

    for chunk in _iter_filtered_chunks(session, columns=target_columns, filters=filters):
        if group_column not in chunk.columns:
            continue

        working = chunk.copy()
        working[group_column] = working[group_column].astype(str)
        if value_column:
            if value_column not in working.columns:
                continue
            working[value_column] = pd.to_numeric(working[value_column], errors="coerce")
            working = working.dropna(subset=[value_column])
            if working.empty:
                continue
            grouped = working.groupby(group_column)[value_column].agg(["sum", "count"]).reset_index()
            for _, row in grouped.iterrows():
                label = str(row[group_column])
                aggregates[label]["sum"] += float(row["sum"])
                aggregates[label]["count"] += float(row["count"])
        else:
            grouped = working[group_column].value_counts()
            for label, count in grouped.items():
                aggregates[str(label)]["count"] += float(count)

    rows = []
    for label, values in aggregates.items():
        if value_column:
            metric_value = values["sum"] / max(values["count"], 1.0) if agg == "mean" else values["sum"]
        else:
            metric_value = values["count"]
        rows.append(
            {
                "label": label,
                "value": round(float(metric_value), 4),
                "count": int(values["count"]),
            }
        )

    rows.sort(key=lambda item: item["value"], reverse=descending)
    return sanitize_for_json(rows[:limit])


def _trend_metric(
    session: Any,
    *,
    date_column: str,
    value_column: str | None,
    filters: list[FilterSpec] | None = None,
    agg: str = "sum",
) -> list[dict[str, Any]]:
    aggregates: dict[str, dict[str, float]] = defaultdict(lambda: {"sum": 0.0, "count": 0.0})
    target_columns = [date_column] + ([value_column] if value_column else [])

    for chunk in _iter_filtered_chunks(session, columns=target_columns, filters=filters):
        if date_column not in chunk.columns:
            continue

        working = chunk.copy()
        working[date_column] = pd.to_datetime(working[date_column], errors="coerce")
        working = working.dropna(subset=[date_column])
        if working.empty:
            continue

        working["__period__"] = working[date_column].dt.to_period("M").astype(str)
        if value_column:
            if value_column not in working.columns:
                continue
            working[value_column] = pd.to_numeric(working[value_column], errors="coerce")
            working = working.dropna(subset=[value_column])
            if working.empty:
                continue
            grouped = working.groupby("__period__")[value_column].agg(["sum", "count"]).reset_index()
            for _, row in grouped.iterrows():
                period = str(row["__period__"])
                aggregates[period]["sum"] += float(row["sum"])
                aggregates[period]["count"] += float(row["count"])
        else:
            grouped = working["__period__"].value_counts()
            for period, count in grouped.items():
                aggregates[str(period)]["count"] += float(count)

    rows = []
    for period, values in aggregates.items():
        metric_value = values["sum"] / max(values["count"], 1.0) if value_column and agg == "mean" else (values["sum"] if value_column else values["count"])
        rows.append(
            {
                "period": period,
                "value": round(float(metric_value), 4),
            }
        )

    rows.sort(key=lambda item: item["period"])
    return sanitize_for_json(rows[-CHART_POINT_LIMIT:])


def _select_numeric_column(schema: dict[str, Any], matched_columns: list[str]) -> str | None:
    matched_numeric = [column for column in matched_columns if column in schema["numeric_columns"]]
    if matched_numeric:
        return matched_numeric[0]
    if len(schema["numeric_columns"]) == 1:
        return schema["numeric_columns"][0]
    return None


def _select_group_column(schema: dict[str, Any], matched_columns: list[str]) -> str | None:
    matched_groups = [column for column in matched_columns if column in schema["categorical_columns"]]
    if matched_groups:
        return matched_groups[0]
    if len(schema["categorical_columns"]) == 1:
        return schema["categorical_columns"][0]
    return None


def _select_date_column(schema: dict[str, Any], matched_columns: list[str]) -> str | None:
    matched_dates = [column for column in matched_columns if column in schema["datetime_columns"]]
    if matched_dates:
        return matched_dates[0]
    if len(schema["datetime_columns"]) == 1:
        return schema["datetime_columns"][0]
    return None


def _numeric_clarification(schema: dict[str, Any]) -> str:
    preview = ", ".join(schema["numeric_columns"][:5]) or "no numeric columns detected"
    return f"I need the exact numeric column name for that question. Available numeric columns: {preview}."


def _category_clarification(schema: dict[str, Any]) -> str:
    preview = ", ".join(schema["categorical_columns"][:5]) or "no categorical columns detected"
    return f"I need the exact category column name for that question. Available categorical columns: {preview}."


def _describe_filters(filters: list[FilterSpec]) -> str:
    return " and ".join(f"{item.column} {item.operator} {item.raw_value}" for item in filters)


def _format_metric(value: Any) -> str:
    try:
        numeric = float(value)
    except Exception:
        return str(value)

    if numeric.is_integer():
        return f"{int(numeric):,}"
    if abs(numeric) >= 100:
        return f"{numeric:,.2f}".rstrip("0").rstrip(".")
    if abs(numeric) >= 1:
        return f"{numeric:,.3f}".rstrip("0").rstrip(".")
    return f"{numeric:,.4f}".rstrip("0").rstrip(".")


def _single_value_chart(y_axis: str, label: str, value: Any) -> dict[str, Any]:
    return sanitize_for_json(
        {
            "type": "bar",
            "x": "metric",
            "y": y_axis,
            "data": [{"metric": label, y_axis: value}],
        }
    )


def _stats_chart(column: str, stats: dict[str, Any]) -> dict[str, Any]:
    return sanitize_for_json(
        {
            "type": "bar",
            "x": "metric",
            "y": column,
            "data": [
                {"metric": "min", column: stats.get("min")},
                {"metric": "average", column: stats.get("mean")},
                {"metric": "max", column: stats.get("max")},
            ],
        }
    )


def _filter_chart(session: Any, filters: list[FilterSpec], matched_count: int) -> dict[str, Any]:
    total_rows = int(session.dataset_row_count or matched_count)
    remaining = max(total_rows - int(matched_count), 0)
    return sanitize_for_json(
        {
            "type": "pie",
            "x": "segment",
            "y": "rows",
            "data": [
                {"segment": "Matched", "rows": int(matched_count)},
                {"segment": "Remaining", "rows": int(remaining)},
            ],
        }
    )


def _default_chart(session: Any, schema: dict[str, Any], filters: list[FilterSpec] | None = None) -> dict[str, Any]:
    if schema["datetime_columns"]:
        date_column = schema["datetime_columns"][0]
        value_column = schema["numeric_columns"][0] if schema["numeric_columns"] else None
        trend = _trend_metric(session, date_column=date_column, value_column=value_column, filters=filters)
        if trend:
            metric_name = value_column or "count"
            return sanitize_for_json(
                {
                    "type": "line",
                    "x": date_column,
                    "y": metric_name,
                    "data": [{date_column: item["period"], metric_name: item["value"]} for item in trend],
                }
            )

    if schema["categorical_columns"]:
        category = schema["categorical_columns"][0]
        counts = _top_categories(session, category, filters, limit=5)
        if counts:
            return sanitize_for_json(
                {
                    "type": "bar",
                    "x": category,
                    "y": "count",
                    "data": [{category: item["label"], "count": item["count"]} for item in counts],
                }
            )

    if schema["numeric_columns"]:
        numeric = schema["numeric_columns"][0]
        stats = _numeric_stats(session, [numeric], filters).get(numeric)
        if stats:
            return _stats_chart(numeric, stats)

    return {}


def _build_insights(
    session: Any,
    summary: dict[str, Any],
    schema: dict[str, Any],
    plan: QueryPlan,
) -> dict[str, Any]:
    numeric_summary = summary.get("numeric_summary", {})
    numeric_items = list(numeric_summary.items())[:INSIGHT_NUMERIC_LIMIT]
    summary_block = {
        "dataset_name": summary.get("dataset_name", session.dataset_name or "Dataset"),
        "total_rows": int(summary.get("rows", session.dataset_row_count or 0)),
        "total_columns": int(summary.get("cols", session.dataset_column_count or 0)),
        "averages": {column: stats.get("mean") for column, stats in numeric_items},
        "min": {column: stats.get("min") for column, stats in numeric_items},
        "max": {column: stats.get("max") for column, stats in numeric_items},
    }

    key_insights: list[str] = []
    for item in summary.get("insights", []):
        text = str(item).strip()
        if text and text not in key_insights:
            key_insights.append(text)
        if len(key_insights) >= 2:
            break

    anomaly = _anomaly_insight(session, schema)
    if anomaly:
        key_insights.append(anomaly)

    while len(key_insights) < 3:
        if schema["categorical_columns"]:
            category = schema["categorical_columns"][0]
            top_values = _top_categories(session, category, limit=1)
            if top_values:
                leader = top_values[0]
                insight = f"{leader['label']} is the top value in {category} with {leader['count']:,} rows."
                if insight not in key_insights:
                    key_insights.append(insight)
                    continue
        break

    return sanitize_for_json(
        {
            "summary": summary_block,
            "query": {
                "intent": plan.intent,
                "metric": plan.metric,
                "matched_columns": plan.matched_columns,
                "filters": [_describe_filters([filter_spec]) for filter_spec in plan.filters],
            },
            "key_insights": key_insights[:3],
        }
    )


def _anomaly_insight(session: Any, schema: dict[str, Any]) -> str:
    numeric_columns = schema["numeric_columns"][:2]
    if not numeric_columns:
        return ""

    sample = load_analysis_frame(session, columns=numeric_columns, sample_size=3_000)
    for column in numeric_columns:
        if column not in sample.columns:
            continue
        series = pd.to_numeric(sample[column], errors="coerce").dropna()
        if len(series) < 8:
            continue
        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        if iqr <= 0:
            continue
        lower = q1 - (1.5 * iqr)
        upper = q3 + (1.5 * iqr)
        outlier_count = int(((series < lower) | (series > upper)).sum())
        if outlier_count > 0:
            return f"Sampled review found {outlier_count:,} potential outliers in {column}."
    return ""
