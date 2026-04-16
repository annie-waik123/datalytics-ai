from __future__ import annotations

from typing import Any, Optional

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

from services.eda_service import detect_datetime_columns
from services.ml_service import sanitize_for_json

ORANGE = "#ff6a00"
ORANGE_LIGHT = "#ff9b54"
BLUE = "#38bdf8"
GREEN = "#22c55e"
SLATE = "#94a3b8"
ROSE = "#fb7185"
PURPLE = "#a855f7"

GRID_WIDGETS = [
    {"id": "bar_chart", "label": "Bar Chart", "category": "axis"},
    {"id": "stacked_bar_chart", "label": "Stacked Bar Chart", "category": "axis"},
    {"id": "line_chart", "label": "Line Chart", "category": "axis"},
    {"id": "area_chart", "label": "Area Chart", "category": "axis"},
    {"id": "pie_chart", "label": "Pie Chart", "category": "part_to_whole"},
    {"id": "donut_chart", "label": "Donut Chart", "category": "part_to_whole"},
    {"id": "scatter_plot", "label": "Scatter Plot", "category": "relationship"},
    {"id": "bubble_chart", "label": "Bubble Chart", "category": "relationship"},
    {"id": "histogram", "label": "Histogram", "category": "distribution"},
    {"id": "box_plot", "label": "Box Plot", "category": "distribution"},
    {"id": "heatmap", "label": "Heatmap", "category": "matrix"},
    {"id": "treemap", "label": "Treemap", "category": "part_to_whole"},
    {"id": "funnel_chart", "label": "Funnel Chart", "category": "flow"},
    {"id": "waterfall_chart", "label": "Waterfall Chart", "category": "flow"},
    {"id": "table", "label": "Table", "category": "tabular"},
    {"id": "matrix", "label": "Matrix", "category": "tabular"},
    {"id": "kpi_card", "label": "KPI Card", "category": "summary"},
    {"id": "choropleth_map", "label": "Filled Map", "category": "map"},
]

AGGREGATIONS = ["sum", "avg", "count", "min", "max"]
MAX_GENERAL_ROWS = 10_000
MAX_SCATTER_ROWS = 6_000
MAX_CATEGORY_ITEMS = 16


def _figure_json(figure: go.Figure) -> dict[str, Any]:
    return sanitize_for_json(figure.to_plotly_json())


def _all_columns(df: pd.DataFrame) -> list[str]:
    return [str(column) for column in df.columns.tolist()]


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    return [str(column) for column in df.select_dtypes(include=np.number).columns.tolist()]


def _datetime_columns(df: pd.DataFrame) -> list[str]:
    return detect_datetime_columns(df)


def _categorical_columns(df: pd.DataFrame) -> list[str]:
    numeric = set(_numeric_columns(df))
    datetime_columns = set(_datetime_columns(df))
    return [str(column) for column in df.columns.tolist() if str(column) not in numeric and str(column) not in datetime_columns]


def _column_type_map(df: pd.DataFrame) -> dict[str, str]:
    numeric = set(_numeric_columns(df))
    datetime_columns = set(_datetime_columns(df))
    mapping: dict[str, str] = {}
    for column in df.columns:
        name = str(column)
        if name in numeric:
            mapping[name] = "numeric"
        elif name in datetime_columns:
            mapping[name] = "datetime"
        else:
            mapping[name] = "categorical"
    return mapping


def _first(items: list[str], exclude: Optional[list[str]] = None) -> Optional[str]:
    excluded = set(exclude or [])
    for item in items:
        if item not in excluded:
            return item
    return None


def _safe_mapping(mapping: Optional[dict[str, Any]]) -> dict[str, Any]:
    raw = mapping or {}
    return {
        "x_axis": raw.get("x_axis"),
        "y_axis": raw.get("y_axis"),
        "values": [str(value) for value in raw.get("values", []) if value],
        "legend": raw.get("legend"),
        "tooltip": [str(value) for value in raw.get("tooltip", []) if value],
        "size": raw.get("size"),
        "color": raw.get("color"),
        "details": raw.get("details"),
        "rows": [str(value) for value in raw.get("rows", []) if value],
        "columns": [str(value) for value in raw.get("columns", []) if value],
        "aggregation": str(raw.get("aggregation") or "sum").lower(),
        "title": raw.get("title"),
    }


def _sample_frame(df: pd.DataFrame, max_rows: int) -> tuple[pd.DataFrame, Optional[str]]:
    if len(df) <= max_rows:
        return df.copy(), None
    sampled = df.sample(n=max_rows, random_state=42).reset_index(drop=True)
    return sampled, f"Rendered on a {max_rows:,}-row sample for performance."


def _coerce_datetime(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def _apply_theme(figure: go.Figure, theme: str, height: int = 360) -> None:
    is_light = theme == "light"
    figure.update_layout(
        height=height,
        template="plotly_white" if is_light else "plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 44, "r": 20, "t": 54, "b": 44},
        legend={"orientation": "h", "yanchor": "bottom", "y": 1.02, "x": 0},
        hoverlabel={"bgcolor": "#0f172a" if not is_light else "#ffffff"},
        font={"family": "Inter, system-ui, sans-serif", "color": "#0f172a" if is_light else "#eef4ff"},
    )


def _apply_filters(df: pd.DataFrame, filters: list[dict[str, Any]]) -> pd.DataFrame:
    filtered = df.copy()
    for item in filters or []:
        column = str(item.get("column") or "")
        value = item.get("value")
        if not column or column not in filtered.columns or value in {None, "", "All"}:
            continue
        filtered = filtered.loc[filtered[column].astype(str) == str(value)].copy()
    return filtered


def _resolve_single(value: Optional[str], allowed: list[str], fallback: Optional[str] = None) -> Optional[str]:
    if value in allowed:
        return value
    if fallback in allowed:
        return fallback
    return _first(allowed)


def _resolve_many(values: list[str], allowed: list[str], fallback: Optional[list[str]] = None, limit: int = 8) -> list[str]:
    fallback_values = fallback or []
    chosen = [str(value) for value in values if str(value) in allowed]
    if chosen:
        return chosen[:limit]
    return [str(value) for value in fallback_values if str(value) in allowed][:limit]


def _aggregation_label(aggregation: str) -> str:
    if aggregation == "avg":
        return "Average"
    return aggregation.capitalize()


def _custom_data(frame: pd.DataFrame, mapping: dict[str, Any]) -> Optional[list[str]]:
    columns = [column for column in mapping.get("tooltip", []) if column in frame.columns]
    return columns or None


def _aggregate_series(frame: pd.DataFrame, dimension_columns: list[str], value_column: Optional[str], aggregation: str) -> pd.DataFrame:
    if not dimension_columns:
        return pd.DataFrame()

    group = frame.groupby(dimension_columns, dropna=False)

    if aggregation == "count" or value_column is None:
        return group.size().reset_index(name="metric")

    numeric = pd.to_numeric(frame[value_column], errors="coerce")
    working = frame.assign(__metric__=numeric).dropna(subset=["__metric__"])
    if working.empty:
        return group.size().reset_index(name="metric")

    grouped = working.groupby(dimension_columns, dropna=False)["__metric__"]
    if aggregation == "avg":
        return grouped.mean().reset_index(name="metric")
    if aggregation == "min":
        return grouped.min().reset_index(name="metric")
    if aggregation == "max":
        return grouped.max().reset_index(name="metric")
    return grouped.sum().reset_index(name="metric")


def _value_measure(mapping: dict[str, Any], numeric_columns: list[str]) -> Optional[str]:
    preferred = mapping.get("y_axis") or _first(mapping.get("values", [])) or mapping.get("size")
    return preferred if preferred in numeric_columns else _first(numeric_columns)


def _title_for_chart(chart_type: str, mapping: dict[str, Any]) -> str:
    base = next((chart["label"] for chart in GRID_WIDGETS if chart["id"] == chart_type), chart_type.replace("_", " ").title())
    if mapping.get("title"):
        return str(mapping["title"])

    if chart_type == "kpi_card":
        metric = _first(mapping.get("values", [])) or mapping.get("y_axis") or "Metric"
        return f"{metric} KPI"
    if chart_type in {"table", "matrix"}:
        return base

    x_axis = mapping.get("x_axis")
    value = _first(mapping.get("values", [])) or mapping.get("y_axis")
    if x_axis and value:
        return f"{base}: {value} by {x_axis}"
    if value:
        return f"{base}: {value}"
    if x_axis:
        return f"{base}: {x_axis}"
    return base


def _chart_support(chart_id: str, df: pd.DataFrame) -> tuple[bool, Optional[str]]:
    numeric = len(_numeric_columns(df))
    categorical = len(_categorical_columns(df))
    total = len(_all_columns(df))

    if chart_id in {"bar_chart", "stacked_bar_chart", "line_chart", "area_chart", "funnel_chart", "waterfall_chart"} and total < 2:
        return False, "This chart needs at least one dimension and one value field."
    if chart_id in {"pie_chart", "donut_chart", "treemap", "table", "matrix"} and total < 1:
        return False, "No columns are available for this chart."
    if chart_id in {"scatter_plot", "bubble_chart"} and numeric < 2:
        return False, "This chart needs at least two numeric columns."
    if chart_id in {"histogram", "box_plot", "kpi_card"} and numeric < 1:
        return False, "This chart needs at least one numeric column."
    if chart_id == "heatmap" and (categorical < 2 or numeric < 1):
        return False, "This chart needs two categorical columns and one numeric column."
    if chart_id == "choropleth_map" and (categorical < 1 or numeric < 1):
        return False, "This chart needs one categorical (location) and one numeric column."
    return True, None


def _default_mapping(chart_type: str, df: pd.DataFrame, selected_columns: Optional[list[str]] = None) -> dict[str, Any]:
    selected_columns = [str(value) for value in (selected_columns or [])]
    all_columns = _all_columns(df)
    numeric = _numeric_columns(df)
    categorical = _categorical_columns(df)
    datetime_columns = _datetime_columns(df)

    selected_numeric = [column for column in selected_columns if column in numeric]
    selected_categorical = [column for column in selected_columns if column in categorical]
    selected_datetime = [column for column in selected_columns if column in datetime_columns]

    first_numeric = _first(selected_numeric) or _first(numeric)
    second_numeric = _first(selected_numeric, exclude=[first_numeric] if first_numeric else []) or _first(numeric, exclude=[first_numeric] if first_numeric else [])
    first_categorical = _first(selected_categorical) or _first(categorical)
    second_categorical = _first(selected_categorical, exclude=[first_categorical] if first_categorical else []) or _first(categorical, exclude=[first_categorical] if first_categorical else [])
    first_datetime = _first(selected_datetime) or _first(datetime_columns)
    first_dimension = first_datetime or first_categorical or _first(all_columns)

    if chart_type == "auto":
        if first_datetime and first_numeric:
            chart_type = "line_chart"
        elif first_categorical and first_numeric:
            chart_type = "bar_chart"
        elif len(numeric) >= 2:
            chart_type = "scatter_plot"
        elif first_categorical:
            chart_type = "donut_chart"
        elif first_numeric:
            chart_type = "histogram"
        else:
            chart_type = "table"

    aggregation = "sum"
    if chart_type in {"pie_chart", "donut_chart", "table"}:
        aggregation = "count" if not first_numeric else "sum"
    if chart_type == "kpi_card":
        aggregation = "sum"

    mapping = {
        "x_axis": first_dimension,
        "y_axis": first_numeric,
        "values": [first_numeric] if first_numeric else [],
        "legend": first_categorical if chart_type not in {"pie_chart", "donut_chart"} else first_categorical or first_dimension,
        "tooltip": [column for column in [first_categorical, second_categorical, first_datetime] if column][:2],
        "size": second_numeric if chart_type == "bubble_chart" else None,
        "color": first_categorical if chart_type in {"bubble_chart", "scatter_plot", "stacked_bar_chart"} else None,
        "details": second_categorical,
        "rows": [first_categorical] if first_categorical else [],
        "columns": [second_categorical] if second_categorical else [],
        "aggregation": aggregation,
        "title": None,
    }

    if chart_type in {"scatter_plot", "bubble_chart"}:
        mapping["x_axis"] = first_numeric
        mapping["y_axis"] = second_numeric or first_numeric
        mapping["values"] = [second_numeric or first_numeric] if (second_numeric or first_numeric) else []
    elif chart_type in {"histogram", "box_plot", "kpi_card"}:
        mapping["values"] = [first_numeric] if first_numeric else []
        mapping["x_axis"] = first_categorical
        mapping["y_axis"] = first_numeric
    elif chart_type in {"pie_chart", "donut_chart"}:
        mapping["legend"] = first_categorical or first_dimension
        mapping["values"] = [first_numeric] if first_numeric else []
    elif chart_type == "heatmap":
        mapping["x_axis"] = first_categorical or first_dimension
        mapping["y_axis"] = second_categorical or first_categorical
        mapping["values"] = [first_numeric] if first_numeric else []
    elif chart_type == "treemap":
        mapping["legend"] = first_categorical or first_dimension
        mapping["details"] = second_categorical
        mapping["values"] = [first_numeric] if first_numeric else []
    elif chart_type == "choropleth_map":
        mapping["x_axis"] = first_categorical or first_dimension
        mapping["y_axis"] = first_numeric
        mapping["values"] = [first_numeric] if first_numeric else []
    elif chart_type == "table":
        preferred = selected_columns or [column for column in [first_categorical, first_datetime, first_numeric, second_numeric] if column]
        mapping["values"] = [column for column in preferred if column][:6]
    elif chart_type == "matrix":
        mapping["rows"] = [first_categorical] if first_categorical else ([first_dimension] if first_dimension else [])
        mapping["columns"] = [second_categorical] if second_categorical else []
        mapping["values"] = [first_numeric] if first_numeric else []

    return {"chart_type": chart_type, "mapping": sanitize_for_json(mapping)}


def _insight_for_chart(chart_type: str, frame: pd.DataFrame, mapping: dict[str, Any], aggregation: str) -> str:
    if frame.empty:
        return "No rows matched the current selection."

    if chart_type == "kpi_card":
        value_column = _first(mapping.get("values", [])) or mapping.get("y_axis") or "Metric"
        return f"{_aggregation_label(aggregation)} of {value_column} is shown as the lead KPI."
    if chart_type in {"bar_chart", "stacked_bar_chart", "pie_chart", "donut_chart", "funnel_chart", "waterfall_chart"} and "metric" in frame.columns:
        top_row = frame.sort_values("metric", ascending=False).iloc[0]
        dimension = next((column for column in frame.columns if column != "metric"), None)
        if dimension:
            return f"{top_row[dimension]} is currently the strongest segment by {_aggregation_label(aggregation).lower()}."
    if chart_type in {"line_chart", "area_chart"} and "metric" in frame.columns and len(frame) >= 2:
        start_value = float(frame["metric"].iloc[0])
        end_value = float(frame["metric"].iloc[-1])
        trend = "upward" if end_value >= start_value else "downward"
        return f"The series is trending {trend} across the selected dimension."
    if chart_type in {"scatter_plot", "bubble_chart"}:
        x_axis = mapping.get("x_axis")
        y_axis = mapping.get("y_axis")
        if x_axis in frame.columns and y_axis in frame.columns and len(frame) > 3:
            corr = frame[[x_axis, y_axis]].corr(numeric_only=True).fillna(0)
            correlation = float(corr.iloc[0, 1]) if corr.shape == (2, 2) else 0.0
            return f"{x_axis} and {y_axis} show a correlation of {correlation:.2f}."
    if chart_type == "heatmap" and "metric" in frame.columns:
        top_row = frame.sort_values("metric", ascending=False).iloc[0]
        return f"The hottest cell combines {top_row.iloc[0]} and {top_row.iloc[1]}."
    if chart_type in {"table", "matrix"}:
        return "Tabular widgets refresh with filters, aggregations, and drill selections."
    return "This widget updates automatically as fields and filters change."


def _widget_reason(chart_type: str, mapping: dict[str, Any]) -> str:
    x_axis = mapping.get("x_axis")
    value_column = _first(mapping.get("values", [])) or mapping.get("y_axis")
    if chart_type == "kpi_card" and value_column:
        return f"KPI cards are best for showcasing the headline value of {value_column}."
    if chart_type in {"line_chart", "area_chart"} and x_axis:
        return f"{chart_type.replace('_', ' ').title()} works well because {x_axis} behaves like a trend dimension."
    if chart_type in {"bar_chart", "stacked_bar_chart"} and x_axis and value_column:
        return f"{chart_type.replace('_', ' ').title()} highlights how {value_column} changes by {x_axis}."
    if chart_type in {"pie_chart", "donut_chart"} and (mapping.get("legend") or x_axis):
        return f"{chart_type.replace('_', ' ').title()} reveals composition across {mapping.get('legend') or x_axis}."
    if chart_type in {"scatter_plot", "bubble_chart"} and x_axis and value_column:
        return f"{chart_type.replace('_', ' ').title()} compares {x_axis} against {value_column} to reveal relationships."
    return "The chart was suggested from the detected field types and current dashboard context."


def _support_payload(chart_id: str, df: pd.DataFrame) -> dict[str, Any]:
    enabled, reason = _chart_support(chart_id, df)
    return {
        "id": chart_id,
        "label": next((item["label"] for item in GRID_WIDGETS if item["id"] == chart_id), chart_id.replace("_", " ").title()),
        "enabled": enabled,
        "reason": reason,
    }


def suggest_dashboard_widget(df: pd.DataFrame, payload: dict[str, Any]) -> dict[str, Any]:
    chart_type = str(payload.get("chart_type") or "auto")
    selected_columns = [str(value) for value in payload.get("selected_columns", [])]
    suggested = _default_mapping(chart_type, df, selected_columns)
    chart_type = suggested["chart_type"]
    mapping = suggested["mapping"]
    title = _title_for_chart(chart_type, mapping)
    return sanitize_for_json({
        "chart_type": chart_type,
        "mapping": mapping,
        "title": title,
        "reason": _widget_reason(chart_type, mapping),
    })


def build_dashboard_metadata(df: pd.DataFrame) -> dict[str, Any]:
    types = _column_type_map(df)
    column_meta = []
    for column in df.columns:
        series = df[column]
        column_meta.append(
            {
                "column": str(column),
                "kind": types[str(column)],
                "dtype": str(series.dtype),
                "missing": int(series.isna().sum()),
                "unique": int(series.nunique(dropna=True)),
            }
        )

    starter_ids = ["kpi_card", "bar_chart"]
    if _datetime_columns(df) and _numeric_columns(df):
        starter_ids.append("line_chart")
    elif _numeric_columns(df):
        starter_ids.append("histogram")
    if len(_numeric_columns(df)) >= 2:
        starter_ids.append("scatter_plot")
    elif _categorical_columns(df):
        starter_ids.append("donut_chart")
    if len(_categorical_columns(df)) >= 2 and _numeric_columns(df):
        starter_ids.append("treemap")

    starters = []
    seen = set()
    for chart_id in starter_ids:
        if chart_id in seen:
            continue
        seen.add(chart_id)
        support = _support_payload(chart_id, df)
        if support["enabled"]:
            starters.append(suggest_dashboard_widget(df, {"chart_type": chart_id}))

    return sanitize_for_json({
        "columns": {
            "all": _all_columns(df),
            "numeric": _numeric_columns(df),
            "categorical": _categorical_columns(df),
            "datetime": _datetime_columns(df),
        },
        "column_meta": column_meta,
        "chart_catalog": [_support_payload(item["id"], df) for item in GRID_WIDGETS],
        "aggregations": AGGREGATIONS,
        "starter_widgets": starters[:5],
    })


def _prepare_axis_frame(frame: pd.DataFrame, x_axis: str, measure: Optional[str], aggregation: str, legend: Optional[str]) -> pd.DataFrame:
    dimensions = [x_axis]
    if legend and legend != x_axis and legend in frame.columns:
        dimensions.append(legend)
    aggregated = _aggregate_series(frame, dimensions, measure, aggregation)
    if "metric" in aggregated.columns:
        aggregated["metric"] = pd.to_numeric(aggregated["metric"], errors="coerce").fillna(0)
    return aggregated


def render_dashboard_widget(df: pd.DataFrame, payload: dict[str, Any]) -> dict[str, Any]:
    if df is None or df.empty:
        raise ValueError("Dataset is not available.")

    chart_type = str(payload.get("chart_type") or "auto")
    suggestion = _default_mapping(chart_type, df)
    if chart_type == "auto":
        chart_type = suggestion["chart_type"]

    metadata = build_dashboard_metadata(df)
    support = next((item for item in metadata["chart_catalog"] if item["id"] == chart_type), None)
    if support and not support["enabled"]:
        raise ValueError(support["reason"] or "This chart is not supported for the current dataset.")

    all_columns = metadata["columns"]["all"]
    numeric_columns = metadata["columns"]["numeric"]
    categorical_columns = metadata["columns"]["categorical"]
    default_mapping = suggestion["mapping"]
    mapping = _safe_mapping(payload.get("mapping"))

    mapping["x_axis"] = _resolve_single(mapping.get("x_axis"), all_columns, default_mapping.get("x_axis"))
    mapping["y_axis"] = _resolve_single(mapping.get("y_axis"), all_columns, default_mapping.get("y_axis"))
    mapping["legend"] = _resolve_single(mapping.get("legend"), all_columns, default_mapping.get("legend"))
    mapping["size"] = _resolve_single(mapping.get("size"), numeric_columns, default_mapping.get("size"))
    mapping["color"] = _resolve_single(mapping.get("color"), all_columns, default_mapping.get("color"))
    mapping["details"] = _resolve_single(mapping.get("details"), all_columns, default_mapping.get("details"))
    mapping["values"] = _resolve_many(mapping.get("values", []), all_columns, default_mapping.get("values", []), limit=6)
    mapping["tooltip"] = _resolve_many(mapping.get("tooltip", []), all_columns, default_mapping.get("tooltip", []), limit=6)
    mapping["rows"] = _resolve_many(mapping.get("rows", []), all_columns, default_mapping.get("rows", []), limit=3)
    mapping["columns"] = _resolve_many(mapping.get("columns", []), all_columns, default_mapping.get("columns", []), limit=3)
    mapping["aggregation"] = mapping.get("aggregation") if mapping.get("aggregation") in AGGREGATIONS else default_mapping.get("aggregation", "sum")

    theme = str(payload.get("theme") or "dark")
    frame = _apply_filters(df, [sanitize_for_json(item) for item in payload.get("filters", [])])

    drill_column = str(payload.get("drill_column") or "")
    drill_value = payload.get("drill_value")
    if drill_column and drill_column in frame.columns and drill_value not in {None, "", "All"}:
        frame = frame.loc[frame[drill_column].astype(str) == str(drill_value)].copy()
        if mapping.get("details") in all_columns:
            mapping["x_axis"] = mapping.get("details")

    if frame.empty:
        frame = df.copy()

    title = _title_for_chart(chart_type, mapping)
    value_column = _value_measure(mapping, numeric_columns)
    note = None
    warning = None
    interaction: dict[str, Any] = {"filter_column": None, "drill_column": mapping.get("details")}
    insight_frame = frame.copy()

    if chart_type in {"bar_chart", "stacked_bar_chart", "line_chart", "area_chart", "funnel_chart", "waterfall_chart"}:
        x_axis = mapping.get("x_axis") or _first(categorical_columns) or _first(all_columns)
        if not x_axis:
            raise ValueError("This chart needs a valid dimension field.")
        source_columns = [column for column in [x_axis, mapping.get("legend"), value_column] if column in frame.columns]
        sampled, note = _sample_frame(frame[source_columns].copy(), MAX_GENERAL_ROWS)
        aggregated = _prepare_axis_frame(sampled, x_axis, value_column, mapping["aggregation"], mapping.get("legend"))
        aggregated = aggregated.sort_values("metric", ascending=False).head(MAX_CATEGORY_ITEMS * (2 if chart_type == "stacked_bar_chart" else 1))
        interaction["filter_column"] = x_axis
        insight_frame = aggregated
        custom_data = _custom_data(aggregated, mapping)

        if chart_type == "bar_chart":
            figure = px.bar(aggregated, x=x_axis, y="metric", color=mapping.get("legend") if mapping.get("legend") in aggregated.columns else None, custom_data=custom_data)
        elif chart_type == "stacked_bar_chart":
            # Fix: Group by both x_axis AND legend for stacked bar
            group_cols = [x_axis]
            legend = mapping.get("legend")
            if legend and legend != x_axis and legend in aggregated.columns:
                group_cols.append(legend)
            
            # Re-aggregate if necessary to ensure both dimensions are present
            if len(group_cols) > 1:
                aggregated = _prepare_axis_frame(sampled, x_axis, value_column, mapping["aggregation"], legend)
            
            figure = px.bar(aggregated, x=x_axis, y="metric", color=legend if legend in aggregated.columns else None, barmode="stack", custom_data=custom_data)
        elif chart_type == "line_chart":
            ordered = aggregated.sort_values(x_axis)
            figure = px.line(ordered, x=x_axis, y="metric", color=mapping.get("legend") if mapping.get("legend") in ordered.columns else None, markers=True, custom_data=_custom_data(ordered, mapping))
        elif chart_type == "area_chart":
            ordered = aggregated.sort_values(x_axis)
            figure = px.area(ordered, x=x_axis, y="metric", color=mapping.get("legend") if mapping.get("legend") in ordered.columns else None, custom_data=_custom_data(ordered, mapping))
        elif chart_type == "funnel_chart":
            figure = px.funnel(aggregated, x="metric", y=x_axis, color=mapping.get("legend") if mapping.get("legend") in aggregated.columns else None, custom_data=custom_data)
        else:
            figure = go.Figure(go.Waterfall(x=aggregated[x_axis].astype(str), y=aggregated["metric"], measure=["relative"] * len(aggregated), connector={"line": {"color": SLATE}}))

    elif chart_type in {"pie_chart", "donut_chart"}:
        dimension = mapping.get("legend") or mapping.get("x_axis") or _first(categorical_columns) or _first(all_columns)
        if not dimension:
            raise ValueError("This chart needs a valid category field.")
        sampled, note = _sample_frame(frame[[column for column in [dimension, value_column] if column in frame.columns]].copy(), MAX_GENERAL_ROWS)
        aggregated = _aggregate_series(sampled, [dimension], value_column, mapping["aggregation"]).sort_values("metric", ascending=False).head(MAX_CATEGORY_ITEMS)
        interaction["filter_column"] = dimension
        insight_frame = aggregated
        figure = px.pie(aggregated, names=dimension, values="metric", hole=0.52 if chart_type == "donut_chart" else 0.0)
        figure.update_traces(textposition="inside", textinfo="percent+label")

    elif chart_type in {"scatter_plot", "bubble_chart"}:
        x_axis = _resolve_single(mapping.get("x_axis"), numeric_columns, default_mapping.get("x_axis"))
        y_axis = _resolve_single(mapping.get("y_axis"), numeric_columns, default_mapping.get("y_axis"))
        if x_axis and y_axis and x_axis == y_axis:
            y_axis = _first([column for column in numeric_columns if column != x_axis]) or y_axis
        if not x_axis or not y_axis:
            raise ValueError("This chart needs two numeric fields.")
        columns = []
        for column in [x_axis, y_axis]:
            if column and column not in columns:
                columns.append(column)
        color_column = mapping.get("color") if mapping.get("color") in all_columns else None
        size_column = mapping.get("size") if mapping.get("size") in numeric_columns else None
        if color_column and color_column not in columns:
            columns.append(color_column)
        if size_column and size_column not in columns:
            columns.append(size_column)
        columns.extend([column for column in mapping["tooltip"] if column in frame.columns and column not in columns])
        sampled, note = _sample_frame(frame[columns].dropna(subset=[x_axis, y_axis]), MAX_SCATTER_ROWS)
        if chart_type == "bubble_chart" and not size_column:
            sampled = sampled.assign(__auto_size__=pd.to_numeric(sampled[y_axis], errors="coerce").abs().clip(lower=1))
            size_column = "__auto_size__"
            warning = "Bubble size was auto-derived from the Y axis because no size field was mapped."
        interaction["filter_column"] = color_column if color_column in categorical_columns else None
        insight_frame = sampled
        figure = px.scatter(sampled, x=x_axis, y=y_axis, color=color_column, size=size_column if chart_type == "bubble_chart" else None, size_max=34, opacity=0.75, custom_data=_custom_data(sampled, mapping))

    elif chart_type == "histogram":
        measure = _resolve_single(_first(mapping["values"]) or mapping.get("y_axis"), numeric_columns, _first(default_mapping.get("values", [])))
        if not measure:
            raise ValueError("Histogram needs one numeric field.")
        sampled, note = _sample_frame(frame[[measure]].dropna(), MAX_GENERAL_ROWS)
        insight_frame = sampled
        figure = px.histogram(sampled, x=measure, nbins=24, marginal="box", color_discrete_sequence=[ORANGE])

    elif chart_type == "box_plot":
        measure = _resolve_single(_first(mapping["values"]) or mapping.get("y_axis"), numeric_columns, _first(default_mapping.get("values", [])))
        if not measure:
            raise ValueError("Box plot needs one numeric field.")
        x_axis = mapping.get("x_axis") if mapping.get("x_axis") in all_columns else None
        sampled, note = _sample_frame(frame[[column for column in [x_axis, measure] if column in frame.columns]].dropna(subset=[measure]), MAX_GENERAL_ROWS)
        interaction["filter_column"] = x_axis if x_axis in categorical_columns else None
        insight_frame = sampled
        figure = px.box(sampled, x=x_axis, y=measure, color=x_axis if x_axis in sampled.columns else None, points="suspectedoutliers")

    elif chart_type == "heatmap":
        x_axis = mapping.get("x_axis") or _first(categorical_columns) or _first(all_columns)
        y_axis = mapping.get("y_axis") or _first(categorical_columns, exclude=[x_axis] if x_axis else []) or _first(all_columns, exclude=[x_axis] if x_axis else [])
        if not x_axis or not y_axis:
            raise ValueError("Heatmap needs two dimension fields.")
        sampled, note = _sample_frame(frame[[column for column in [x_axis, y_axis, value_column] if column in frame.columns]].copy(), MAX_GENERAL_ROWS)
        aggregated = _aggregate_series(sampled, [x_axis, y_axis], value_column, mapping["aggregation"]).copy()
        if aggregated.empty:
            raise ValueError("Heatmap data is empty.")
        aggregated[x_axis] = aggregated[x_axis].astype(str)
        aggregated[y_axis] = aggregated[y_axis].astype(str)
        pivot = aggregated.pivot(index=y_axis, columns=x_axis, values="metric").fillna(0).iloc[:12, :12]
        insight_frame = aggregated
        figure = px.imshow(pivot, aspect="auto", color_continuous_scale=[[0, "#1f2937"], [0.5, "#475569"], [1, ORANGE]])

    elif chart_type == "treemap":
        legend = mapping.get("legend") or _first(categorical_columns) or _first(all_columns)
        details = mapping.get("details") if mapping.get("details") in all_columns else None
        if not legend:
            raise ValueError("Treemap needs at least one grouping field.")
        group_columns = [legend]
        if details and details != legend:
            group_columns.append(details)
        sampled, note = _sample_frame(frame[[column for column in [*group_columns, value_column] if column in frame.columns]].copy(), MAX_GENERAL_ROWS)
        aggregated = _aggregate_series(sampled, group_columns, value_column, mapping["aggregation"]).sort_values("metric", ascending=False).head(MAX_CATEGORY_ITEMS * 2)
        interaction["filter_column"] = legend
        insight_frame = aggregated
        figure = px.treemap(aggregated, path=group_columns, values="metric", color="metric", color_continuous_scale=[BLUE, ORANGE])

    elif chart_type == "table":
        table_columns = _resolve_many(mapping["values"], all_columns, all_columns[:6], limit=8)
        preview = frame[table_columns].head(14).copy() if table_columns else frame.head(14).copy()
        preview = preview.where(pd.notnull(preview), None)
        insight_frame = preview
        figure = go.Figure(data=[go.Table(header={"values": [str(column) for column in preview.columns.tolist()], "fill_color": ORANGE, "align": "left"}, cells={"values": [preview[column].astype(str).tolist() for column in preview.columns], "fill_color": "rgba(15,23,42,0.08)", "align": "left"})])

    elif chart_type == "matrix":
        row_field = _first(mapping["rows"]) or mapping.get("legend") or _first(categorical_columns) or _first(all_columns)
        column_field = _first(mapping["columns"]) or mapping.get("details") or _first(categorical_columns, exclude=[row_field] if row_field else [])
        if not row_field:
            raise ValueError("Matrix needs at least one row field.")
        value_field = _value_measure(mapping, numeric_columns)
        base_columns = [column for column in [row_field, column_field, value_field] if column]
        working = frame[base_columns].copy()
        if column_field:
            aggregated = _aggregate_series(working, [row_field, column_field], value_field, mapping["aggregation"])
            if aggregated.empty:
                preview = pd.DataFrame(columns=[row_field, column_field, "metric"])
            else:
                preview = aggregated.pivot(index=row_field, columns=column_field, values="metric").fillna(0).iloc[:12, :10].reset_index()
        else:
            preview = _aggregate_series(working, [row_field], value_field, mapping["aggregation"]).head(12)
        insight_frame = preview
        preview = preview.where(pd.notnull(preview), None)
        figure = go.Figure(data=[go.Table(header={"values": [str(column) for column in preview.columns.tolist()], "fill_color": ORANGE, "align": "left"}, cells={"values": [preview[column].astype(str).tolist() for column in preview.columns], "fill_color": "rgba(15,23,42,0.08)", "align": "left"})])
        interaction["filter_column"] = row_field

    elif chart_type == "kpi_card":
        measure = _resolve_single(_first(mapping["values"]) or mapping.get("y_axis"), numeric_columns, _first(default_mapping.get("values", [])))
        if not measure:
            raise ValueError("KPI card needs one numeric field.")
        series = pd.to_numeric(frame[measure], errors="coerce").dropna()
        if series.empty:
            raise ValueError("KPI card could not find usable numeric values.")
        if mapping["aggregation"] == "avg":
            metric = float(series.mean())
        elif mapping["aggregation"] == "min":
            metric = float(series.min())
        elif mapping["aggregation"] == "max":
            metric = float(series.max())
        elif mapping["aggregation"] == "count":
            metric = float(series.count())
        else:
            metric = float(series.sum())
        reference = float(series.mean()) if len(series) else metric
        figure = go.Figure(go.Indicator(mode="number+delta", value=metric, delta={"reference": reference, "relative": True}, number={"font": {"size": 40}}, title={"text": title}))
        insight_frame = pd.DataFrame({"metric": [metric], "reference": [reference]})

    elif chart_type == "choropleth_map":
        location_field = mapping.get("x_axis") or _first(categorical_columns) or _first(all_columns)
        if not location_field:
            raise ValueError("Choropleth map needs a location field.")
        
        # Ensure we only pick columns that actually exist in the frame
        valid_columns = [column for column in [location_field, value_column] if column and column in frame.columns]
        sampled, note = _sample_frame(frame[valid_columns].copy(), MAX_GENERAL_ROWS)
        
        # Clean location strings
        sampled[location_field] = sampled[location_field].astype(str).str.strip()
        
        aggregated = _aggregate_series(sampled, [location_field], value_column, mapping["aggregation"])
        interaction["filter_column"] = location_field
        insight_frame = aggregated
        figure = px.choropleth(
            aggregated,
            locations=location_field,
            locationmode="country names",
            color="metric",
            color_continuous_scale=[BLUE, ORANGE],
            title=title
        )
        figure.update_layout(
            geo=dict(
                showframe=False,
                showcoastlines=True,
                projection_type='equirectangular'
            )
        )

    else:
        raise ValueError(f"Unsupported chart type: {chart_type}")

    figure.update_layout(title=title)
    _apply_theme(figure, theme, height=360 if chart_type != "kpi_card" else 250)
    if chart_type == "waterfall_chart":
        figure.update_traces(increasing={"marker": {"color": GREEN}}, decreasing={"marker": {"color": ROSE}}, totals={"marker": {"color": BLUE}})

    return sanitize_for_json({
        "widget_id": payload.get("widget_id"),
        "chart_type": chart_type,
        "title": title,
        "figure": _figure_json(figure),
        "resolved_mapping": mapping,
        "warning": warning,
        "note": note,
        "insight": _insight_for_chart(chart_type, insight_frame, mapping, mapping["aggregation"]),
        "interaction": interaction,
        "row_count": int(len(frame)),
    })
