from __future__ import annotations

import math
from typing import Any, Optional

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from services.eda_service import build_dataset_payload, dataframe_from_payload, detect_datetime_columns
from services.ml_service import sanitize_for_json

ORANGE = "#ff6a00"
ORANGE_LIGHT = "#ff9b54"
GREEN = "#22c55e"
BLUE = "#38bdf8"
SLATE = "#94a3b8"
PURPLE = "#a855f7"

MAX_GENERAL_ROWS = 12_000
MAX_SCATTER_ROWS = 8_000
MAX_PAIR_ROWS = 1_400
MAX_HEATMAP_ROWS = 180
MAX_TIME_ROWS = 4_000
MAX_CATEGORY_VALUES = 16
MAX_MULTI_COLUMNS = 8
MAX_TREEMAP_LEVELS = 4

CHART_DEFINITIONS = [
    {"id": "histogram", "label": "Histogram", "mode": "single", "kind": "numeric"},
    {"id": "bar_chart", "label": "Bar Chart", "mode": "double", "kind": "xy"},
    {"id": "line_chart", "label": "Line Chart", "mode": "double", "kind": "xy"},
    {"id": "scatter_plot", "label": "Scatter Plot", "mode": "double", "kind": "numeric_xy"},
    {"id": "box_plot", "label": "Box Plot", "mode": "single", "kind": "numeric"},
    {"id": "count_plot", "label": "Count Plot", "mode": "single", "kind": "categorical"},
    {"id": "area_chart", "label": "Area Chart", "mode": "double", "kind": "xy"},
    {"id": "kde_plot", "label": "KDE Plot", "mode": "single", "kind": "numeric"},
    {"id": "violin_plot", "label": "Violin Plot", "mode": "single", "kind": "numeric"},
    {"id": "pie_chart", "label": "Pie Chart", "mode": "single", "kind": "categorical"},
    {"id": "regression_plot", "label": "Regression Plot", "mode": "double", "kind": "numeric_xy"},
    {"id": "joint_plot", "label": "Joint Plot", "mode": "multi", "kind": "numeric_multi"},
    {"id": "pair_plot", "label": "Pair Plot", "mode": "multi", "kind": "numeric_multi"},
    {"id": "heatmap", "label": "Heatmap", "mode": "multi", "kind": "numeric_multi"},
    {"id": "correlation_matrix", "label": "Correlation Matrix", "mode": "multi", "kind": "numeric_multi"},
    {"id": "time_series_line", "label": "Time Series Line Chart", "mode": "time", "kind": "time"},
    {"id": "rolling_mean_chart", "label": "Rolling Mean Chart", "mode": "time", "kind": "time"},
    {"id": "bubble_chart", "label": "Bubble Chart", "mode": "double", "kind": "numeric_xy"},
    {"id": "treemap", "label": "Treemap", "mode": "multi", "kind": "treemap"},
    {"id": "stacked_bar_chart", "label": "Stacked Bar Chart", "mode": "double", "kind": "xy"},
]


def _figure_json(figure: go.Figure) -> dict[str, Any]:
    return sanitize_for_json(figure.to_plotly_json())


def _sample_frame(df: pd.DataFrame, max_rows: int) -> tuple[pd.DataFrame, Optional[str]]:
    if len(df) <= max_rows:
        return df.copy(), None
    sampled = df.sample(n=max_rows, random_state=42).reset_index(drop=True)
    return sampled, f"Rendered on a {max_rows:,}-row sample for performance."


def _coerce_datetime(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def _all_columns(df: pd.DataFrame) -> list[str]:
    return [str(column) for column in df.columns.tolist()]


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    return [str(column) for column in df.select_dtypes(include=np.number).columns.tolist()]


def _datetime_columns(df: pd.DataFrame) -> list[str]:
    return detect_datetime_columns(df)


def _categorical_columns(df: pd.DataFrame) -> list[str]:
    numeric = set(_numeric_columns(df))
    datetime_cols = set(_datetime_columns(df))
    return [str(column) for column in df.columns if str(column) not in numeric and str(column) not in datetime_cols]


def _column_type_map(df: pd.DataFrame) -> dict[str, str]:
    numeric = set(_numeric_columns(df))
    datetime_cols = set(_datetime_columns(df))
    mapping: dict[str, str] = {}
    for column in df.columns:
        name = str(column)
        if name in numeric:
            mapping[name] = "numeric"
        elif name in datetime_cols:
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


def _default_multi(chart_id: str, numeric: list[str], categorical: list[str]) -> list[str]:
    if chart_id == "treemap":
        columns = categorical[: max(1, min(MAX_TREEMAP_LEVELS - 1, len(categorical)))]
        numeric_value = _first(numeric)
        if numeric_value:
            return [*columns, numeric_value]
        return columns
    if chart_id == "joint_plot":
        return numeric[:2]
    if chart_id == "pair_plot":
        return numeric[: min(4, len(numeric))]
    return numeric[: min(5, len(numeric))]


def _default_request(chart_id: str, df: pd.DataFrame) -> dict[str, Any]:
    numeric = _numeric_columns(df)
    categorical = _categorical_columns(df)
    datetime_cols = _datetime_columns(df)
    all_columns = _all_columns(df)

    x_numeric = _first(numeric)
    y_numeric = _first(numeric, exclude=[x_numeric] if x_numeric else [])
    if not y_numeric:
        y_numeric = x_numeric
    x_general = _first(categorical) or _first(datetime_cols) or _first(all_columns)
    y_general = _first(numeric) or _first(all_columns)
    group_column = _first(categorical, exclude=[x_general] if x_general else [])
    size_column = _first(numeric, exclude=[x_numeric, y_numeric] if x_numeric and y_numeric else [])

    if chart_id in {"histogram", "box_plot", "kde_plot", "violin_plot"}:
        return {"column": x_numeric}
    if chart_id in {"count_plot", "pie_chart"}:
        return {"column": _first(categorical) or _first(all_columns)}
    if chart_id in {"scatter_plot", "regression_plot", "bubble_chart"}:
        return {"x_column": x_numeric, "y_column": y_numeric, "size_column": size_column}
    if chart_id in {"bar_chart", "line_chart", "area_chart", "stacked_bar_chart"}:
        return {"x_column": x_general, "y_column": y_general, "group_column": group_column}
    if chart_id in {"time_series_line", "rolling_mean_chart"}:
        return {"date_column": _first(datetime_cols), "value_column": _first(numeric)}
    return {
        "columns": _default_multi(chart_id, numeric, categorical),
        "group_column": group_column,
        "size_column": size_column,
    }


def _chart_support(chart_id: str, df: pd.DataFrame) -> tuple[bool, Optional[str]]:
    numeric = len(_numeric_columns(df))
    categorical = len(_categorical_columns(df))
    datetime_cols = len(_datetime_columns(df))
    total = len(_all_columns(df))

    if chart_id in {"histogram", "box_plot", "kde_plot", "violin_plot"} and numeric < 1:
        return False, "This chart needs at least one numeric column."
    if chart_id in {"scatter_plot", "regression_plot", "joint_plot"} and numeric < 2:
        return False, "This chart needs at least two numeric columns."
    if chart_id == "bubble_chart" and numeric < 2:
        return False, "This chart needs at least two numeric columns."
    if chart_id in {"pair_plot", "heatmap", "correlation_matrix"} and numeric < 2:
        return False, "This chart needs at least two numeric columns."
    if chart_id in {"time_series_line", "rolling_mean_chart"} and (datetime_cols < 1 or numeric < 1):
        return False, "This chart needs one datetime column and one numeric column."
    if chart_id in {"count_plot", "pie_chart"} and total < 1:
        return False, "No columns are available for this chart."
    if chart_id in {"bar_chart", "line_chart", "area_chart", "stacked_bar_chart"} and (total < 1 or numeric < 1):
        return False, "This chart needs one value column and at least one other field."
    if chart_id == "treemap" and (categorical < 1 and total < 1):
        return False, "This chart needs at least one usable column."
    return True, None


def build_visualization_metadata(df: pd.DataFrame) -> dict[str, Any]:
    types = _column_type_map(df)
    column_meta = []

    for column in df.columns:
        series = df[column]
        name = str(column)
        column_meta.append(
            {
                "column": name,
                "kind": types[name],
                "dtype": str(series.dtype),
                "missing": int(series.isna().sum()),
                "unique": int(series.nunique(dropna=True)),
            }
        )

    supported = []
    defaults = {}
    for definition in CHART_DEFINITIONS:
        enabled, reason = _chart_support(definition["id"], df)
        supported.append({**definition, "enabled": enabled, "reason": reason})
        defaults[definition["id"]] = _default_request(definition["id"], df)

    return {
        "columns": {
            "all": _all_columns(df),
            "numeric": _numeric_columns(df),
            "categorical": _categorical_columns(df),
            "datetime": _datetime_columns(df),
        },
        "column_meta": column_meta,
        "supported_charts": supported,
        "defaults": defaults,
    }


def sync_visualization_dataset(
    rows: list[dict[str, Any]],
    columns: Optional[list[str]] = None,
    name: Optional[str] = None,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    frame = dataframe_from_payload(rows, columns)
    payload = {
        "dataset": build_dataset_payload(frame, name or "Dataset"),
        "metadata": build_visualization_metadata(frame),
    }
    return frame, payload


def _resolve_columns(raw_columns: Optional[list[str]], available: list[str], fallback: list[str], limit: int = MAX_MULTI_COLUMNS) -> list[str]:
    selected = [str(column) for column in (raw_columns or []) if str(column) in available]
    if selected:
        return selected[:limit]
    return fallback[:limit]


def _prepare_xy_frame(df: pd.DataFrame, x_column: str, y_column: str, sample_rows: int = MAX_GENERAL_ROWS) -> tuple[pd.DataFrame, Optional[str]]:
    frame = df[[x_column, y_column]].copy()
    frame[y_column] = pd.to_numeric(frame[y_column], errors="coerce")
    frame = frame.dropna(subset=[y_column])
    sampled, note = _sample_frame(frame, sample_rows)
    return sampled, note


def _value_counts_frame(series: pd.Series, max_items: int = MAX_CATEGORY_VALUES) -> tuple[pd.DataFrame, Optional[str]]:
    counts = series.astype(str).fillna("Missing").value_counts(dropna=False)
    note = None
    if len(counts) > max_items:
        other = int(counts.iloc[max_items:].sum())
        counts = counts.iloc[:max_items]
        counts.loc["Other"] = other
        note = f"Showing the top {max_items} categories."
    frame = counts.reset_index()
    frame.columns = ["label", "value"]
    return frame, note


def _bucket_numeric_series(series: pd.Series, bins: int = 6) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if numeric.notna().sum() < 2:
        return series.astype(str)
    unique_values = numeric.nunique(dropna=True)
    bucket_count = max(2, min(bins, int(unique_values)))
    try:
        buckets = pd.qcut(numeric, q=bucket_count, duplicates="drop")
    except Exception:
        buckets = pd.cut(numeric, bins=bucket_count, duplicates="drop")
    return buckets.astype(str).fillna("Missing")


def _gaussian_kde(values: np.ndarray, points: int = 200) -> tuple[np.ndarray, np.ndarray]:
    if len(values) < 2:
        return values, np.ones(len(values))
    minimum = float(values.min())
    maximum = float(values.max())
    if math.isclose(minimum, maximum):
        xs = np.linspace(minimum - 1, maximum + 1, points)
        ys = np.zeros(points)
        ys[points // 2] = 1
        return xs, ys

    xs = np.linspace(minimum, maximum, points)
    std = float(values.std(ddof=1)) or 1.0
    bandwidth = max(1e-6, 1.06 * std * (len(values) ** (-1 / 5)))
    kernel = np.exp(-0.5 * ((xs[:, None] - values[None, :]) / bandwidth) ** 2)
    density = kernel.sum(axis=1) / (len(values) * bandwidth * math.sqrt(2 * math.pi))
    return xs, density


def _apply_theme(figure: go.Figure, theme: str, height: int = 400) -> None:
    is_light = theme == "light"
    figure.update_layout(
        height=height,
        template="plotly_white" if is_light else "plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin={"l": 52, "r": 24, "t": 56, "b": 48},
        legend={"orientation": "h", "yanchor": "bottom", "y": 1.02, "x": 0},
        hoverlabel={"bgcolor": "#0f172a" if not is_light else "#ffffff"},
        font={"family": "Inter, system-ui, sans-serif", "color": "#0f172a" if is_light else "#eef4ff"},
    )


def _sorted_time_frame(df: pd.DataFrame, date_column: str, value_column: str) -> pd.DataFrame:
    frame = df[[date_column, value_column]].copy()
    frame[date_column] = _coerce_datetime(frame[date_column])
    frame[value_column] = pd.to_numeric(frame[value_column], errors="coerce")
    frame = frame.dropna().sort_values(date_column)
    return frame


def render_visualization_chart(df: pd.DataFrame, payload: dict[str, Any]) -> dict[str, Any]:
    chart_type = payload.get("chart_type") or payload.get("viz_type") or payload.get("chart_key")
    if not chart_type:
        raise ValueError("chart_type is required.")

    chart_key = payload.get("chart_key") or chart_type
    metadata = build_visualization_metadata(df)
    defaults = metadata["defaults"].get(chart_type, {})
    all_columns = metadata["columns"]["all"]
    numeric_columns = metadata["columns"]["numeric"]
    categorical_columns = metadata["columns"]["categorical"]
    datetime_columns = metadata["columns"]["datetime"]

    column = payload.get("column")
    if column not in all_columns:
        column = defaults.get("column")

    x_column = payload.get("x_column")
    if x_column not in all_columns:
        x_column = defaults.get("x_column")

    y_column = payload.get("y_column")
    if y_column not in all_columns:
        y_column = defaults.get("y_column")

    date_column = payload.get("date_column")
    if date_column not in all_columns:
        date_column = defaults.get("date_column")

    value_column = payload.get("value_column")
    if value_column not in all_columns:
        value_column = defaults.get("value_column")

    group_column = payload.get("group_column")
    if group_column not in all_columns:
        group_column = defaults.get("group_column")

    size_column = payload.get("size_column")
    if size_column not in all_columns:
        size_column = defaults.get("size_column")

    selected_columns = _resolve_columns(
        payload.get("columns") or payload.get("selected_columns"),
        all_columns,
        defaults.get("columns", []),
    )

    bins = int(payload.get("bins") or 24)
    rolling_window = max(2, int(payload.get("rolling_window") or 7))
    theme = payload.get("theme") or "dark"

    note = None
    warning = None
    figure: go.Figure

    if chart_type == "histogram":
        if column not in numeric_columns:
            raise ValueError("Histogram requires a numeric column.")
        frame, note = _sample_frame(df[[column]].dropna(), MAX_GENERAL_ROWS)
        figure = px.histogram(frame, x=column, nbins=bins, marginal="box", color_discrete_sequence=[ORANGE])
        figure.update_traces(marker_line_width=0)
        figure.update_layout(title=f"Histogram - {column}")

    elif chart_type == "bar_chart":
        if not x_column or not y_column:
            raise ValueError("Bar Chart requires X and Y columns.")
        frame, note = _prepare_xy_frame(df, x_column, y_column)
        grouped = frame.groupby(x_column, dropna=False)[y_column].sum().reset_index()
        grouped = grouped.sort_values(y_column, ascending=False).head(MAX_CATEGORY_VALUES)
        figure = px.bar(grouped, x=x_column, y=y_column, color=y_column, color_continuous_scale=["#ffd2b0", ORANGE])
        figure.update_layout(title=f"Bar Chart - {y_column} by {x_column}", coloraxis_showscale=False)

    elif chart_type == "line_chart":
        if not x_column or not y_column:
            raise ValueError("Line Chart requires X and Y columns.")
        frame, note = _prepare_xy_frame(df, x_column, y_column)
        if x_column in datetime_columns:
            frame[x_column] = _coerce_datetime(frame[x_column])
            frame = frame.dropna().sort_values(x_column)
        else:
            frame = frame.groupby(x_column, dropna=False)[y_column].sum().reset_index()
        figure = px.line(frame, x=x_column, y=y_column)
        figure.update_traces(line={"color": ORANGE, "width": 3}, mode="lines+markers", marker={"size": 7})
        figure.update_layout(title=f"Line Chart - {y_column} vs {x_column}")

    elif chart_type == "scatter_plot":
        if x_column not in numeric_columns or y_column not in numeric_columns:
            raise ValueError("Scatter Plot requires numeric X and Y columns.")
        frame, note = _sample_frame(df[[x_column, y_column]].dropna(), MAX_SCATTER_ROWS)
        figure = px.scatter(frame, x=x_column, y=y_column, opacity=0.72)
        figure.update_traces(marker={"color": ORANGE, "size": 8, "line": {"width": 0}})
        figure.update_layout(title=f"Scatter Plot - {y_column} vs {x_column}")

    elif chart_type == "box_plot":
        if column not in numeric_columns:
            raise ValueError("Box Plot requires a numeric column.")
        frame, note = _sample_frame(df[[column]].dropna(), MAX_GENERAL_ROWS)
        figure = px.box(frame, y=column, points="suspectedoutliers", color_discrete_sequence=[ORANGE])
        figure.update_layout(title=f"Box Plot - {column}", showlegend=False)

    elif chart_type == "count_plot":
        if column is None:
            raise ValueError("Count Plot requires a column.")
        series = df[column]
        if column in numeric_columns and len(categorical_columns) == 0:
            series = _bucket_numeric_series(series, bins=8)
            warning = f"{column} was bucketed into ranges to create a count plot."
        counts, count_note = _value_counts_frame(series.rename(column))
        note = count_note
        figure = px.bar(counts, x="label", y="value", color="value", color_continuous_scale=["#ffd2b0", ORANGE])
        figure.update_layout(title=f"Count Plot - {column}", xaxis_title=column, yaxis_title="Count", coloraxis_showscale=False)

    elif chart_type == "area_chart":
        if not x_column or not y_column:
            raise ValueError("Area Chart requires X and Y columns.")
        frame, note = _prepare_xy_frame(df, x_column, y_column)
        if x_column in datetime_columns:
            frame[x_column] = _coerce_datetime(frame[x_column])
            frame = frame.dropna().sort_values(x_column)
        else:
            frame = frame.groupby(x_column, dropna=False)[y_column].sum().reset_index()
        figure = px.area(frame, x=x_column, y=y_column)
        figure.update_traces(line={"color": ORANGE, "width": 3}, fillcolor="rgba(255,106,0,0.22)")
        figure.update_layout(title=f"Area Chart - {y_column} vs {x_column}")

    elif chart_type == "kde_plot":
        if column not in numeric_columns:
            raise ValueError("KDE Plot requires a numeric column.")
        values = pd.to_numeric(df[column], errors="coerce").dropna()
        if values.empty:
            raise ValueError("Selected column does not contain valid numeric values.")
        sampled, note = _sample_frame(values.to_frame(name=column), MAX_GENERAL_ROWS)
        xs, density = _gaussian_kde(sampled[column].to_numpy(dtype=float))
        figure = go.Figure()
        figure.add_trace(go.Histogram(x=sampled[column], histnorm="probability density", opacity=0.22, marker_color=ORANGE_LIGHT, nbinsx=bins, name="Distribution"))
        figure.add_trace(go.Scatter(x=xs, y=density, mode="lines", line={"color": ORANGE, "width": 3}, fill="tozeroy", fillcolor="rgba(255,106,0,0.16)", name="Density"))
        figure.update_layout(title=f"KDE Plot - {column}", barmode="overlay")

    elif chart_type == "violin_plot":
        if column not in numeric_columns:
            raise ValueError("Violin Plot requires a numeric column.")
        frame, note = _sample_frame(df[[column]].dropna(), MAX_GENERAL_ROWS)
        figure = go.Figure(data=[go.Violin(y=frame[column], box_visible=True, meanline_visible=True, fillcolor="rgba(255,106,0,0.2)", line_color=ORANGE, marker_color=ORANGE, opacity=0.9, name=column)])
        figure.update_layout(title=f"Violin Plot - {column}", showlegend=False)

    elif chart_type == "pie_chart":
        if column is None:
            raise ValueError("Pie Chart requires a column.")
        series = df[column]
        if column in numeric_columns and len(categorical_columns) == 0:
            series = _bucket_numeric_series(series, bins=6)
            warning = f"{column} was bucketed into ranges to build a pie chart."
        counts, count_note = _value_counts_frame(series.rename(column), max_items=8)
        note = count_note
        figure = px.pie(counts, values="value", names="label", hole=0.38)
        figure.update_traces(textposition="inside", textinfo="percent+label")
        figure.update_layout(title=f"Pie Chart - {column}")

    elif chart_type == "regression_plot":
        if x_column not in numeric_columns or y_column not in numeric_columns:
            raise ValueError("Regression Plot requires numeric X and Y columns.")
        frame, note = _sample_frame(df[[x_column, y_column]].dropna(), MAX_SCATTER_ROWS)
        if frame[x_column].nunique() < 2:
            raise ValueError("Regression Plot needs at least two unique X values.")
        coefficients = np.polyfit(frame[x_column], frame[y_column], 1)
        trend_x = np.linspace(frame[x_column].min(), frame[x_column].max(), 200)
        trend_y = coefficients[0] * trend_x + coefficients[1]
        figure = go.Figure()
        figure.add_trace(go.Scatter(x=frame[x_column], y=frame[y_column], mode="markers", marker={"color": ORANGE, "size": 8, "opacity": 0.68}, name="Observed"))
        figure.add_trace(go.Scatter(x=trend_x, y=trend_y, mode="lines", line={"color": GREEN, "width": 3}, name="Regression"))
        figure.update_layout(title=f"Regression Plot - {y_column} vs {x_column}")

    elif chart_type == "joint_plot":
        columns = [column for column in selected_columns if column in numeric_columns][:2]
        if len(columns) < 2:
            raise ValueError("Joint Plot needs two numeric columns.")
        x_value, y_value = columns
        frame, note = _sample_frame(df[[x_value, y_value]].dropna(), MAX_SCATTER_ROWS)
        figure = make_subplots(
            rows=2,
            cols=2,
            row_heights=[0.24, 0.76],
            column_widths=[0.76, 0.24],
            specs=[[{"type": "histogram"}, {"type": "scatter"}], [{"type": "scatter"}, {"type": "histogram"}]],
            horizontal_spacing=0.04,
            vertical_spacing=0.05,
        )
        figure.add_trace(go.Histogram(x=frame[x_value], marker_color=ORANGE, showlegend=False, name=x_value), row=1, col=1)
        figure.add_trace(go.Scatter(x=frame[x_value], y=frame[y_value], mode="markers", marker={"color": BLUE, "size": 7, "opacity": 0.7}, name="Joint"), row=2, col=1)
        figure.add_trace(go.Histogram(y=frame[y_value], marker_color=PURPLE, showlegend=False, name=y_value), row=2, col=2)
        figure.update_xaxes(title_text=x_value, row=2, col=1)
        figure.update_yaxes(title_text=y_value, row=2, col=1)
        figure.update_layout(title=f"Joint Plot - {x_value} and {y_value}", showlegend=False)

    elif chart_type == "pair_plot":
        columns = [column for column in selected_columns if column in numeric_columns][:5]
        if len(columns) < 2:
            raise ValueError("Pair Plot needs at least two numeric columns.")
        frame, note = _sample_frame(df[columns].dropna(), MAX_PAIR_ROWS)
        figure = px.scatter_matrix(frame, dimensions=columns, color_discrete_sequence=[ORANGE])
        figure.update_traces(diagonal_visible=False)
        figure.update_layout(title="Pair Plot")

    elif chart_type == "heatmap":
        columns = [column for column in selected_columns if column in numeric_columns][:MAX_MULTI_COLUMNS]
        if len(columns) < 2:
            raise ValueError("Heatmap needs at least two numeric columns.")
        frame = df[columns].copy()
        frame = frame.apply(pd.to_numeric, errors="coerce")
        frame = frame.dropna(how="all")
        frame, note = _sample_frame(frame, MAX_HEATMAP_ROWS)
        scaled = frame.fillna(frame.median(numeric_only=True)).copy()
        for current in columns:
            col = scaled[current]
            span = col.max() - col.min()
            scaled[current] = 0 if pd.isna(span) or span == 0 else (col - col.min()) / span
        figure = px.imshow(
            scaled.transpose(),
            aspect="auto",
            color_continuous_scale=["#1f2937", "#374151", "#ff6a00"],
            labels={"x": "Sampled rows", "y": "Columns", "color": "Scaled value"},
        )
        figure.update_layout(title="Heatmap")

    elif chart_type == "correlation_matrix":
        columns = [column for column in selected_columns if column in numeric_columns][:MAX_MULTI_COLUMNS]
        if len(columns) < 2:
            raise ValueError("Correlation Matrix needs at least two numeric columns.")
        frame, note = _sample_frame(df[columns].apply(pd.to_numeric, errors="coerce"), MAX_GENERAL_ROWS)
        corr = frame.corr(numeric_only=True).fillna(0)
        figure = px.imshow(corr, text_auto=".2f", aspect="auto", color_continuous_scale="RdBu_r")
        figure.update_layout(title="Correlation Matrix")

    elif chart_type == "time_series_line":
        if date_column not in datetime_columns or value_column not in numeric_columns:
            raise ValueError("Time Series Line Chart needs one datetime column and one numeric column.")
        frame = _sorted_time_frame(df, date_column, value_column)
        frame, note = _sample_frame(frame, MAX_TIME_ROWS)
        figure = px.line(frame, x=date_column, y=value_column)
        figure.update_traces(line={"color": ORANGE, "width": 3})
        figure.update_layout(title=f"Time Series Line Chart - {value_column}")

    elif chart_type == "rolling_mean_chart":
        if date_column not in datetime_columns or value_column not in numeric_columns:
            raise ValueError("Rolling Mean Chart needs one datetime column and one numeric column.")
        frame = _sorted_time_frame(df, date_column, value_column)
        if frame.empty:
            raise ValueError("The selected time-series columns do not contain valid values.")
        frame = frame.assign(rolling_mean=frame[value_column].rolling(window=rolling_window, min_periods=1).mean())
        frame, note = _sample_frame(frame, MAX_TIME_ROWS)
        figure = go.Figure()
        figure.add_trace(go.Scatter(x=frame[date_column], y=frame[value_column], mode="lines", line={"color": BLUE, "width": 2}, name="Observed"))
        figure.add_trace(go.Scatter(x=frame[date_column], y=frame["rolling_mean"], mode="lines", line={"color": ORANGE, "width": 3}, name=f"Rolling Mean ({rolling_window})"))
        figure.update_layout(title=f"Rolling Mean Chart - {value_column}")

    elif chart_type == "bubble_chart":
        if x_column not in numeric_columns or y_column not in numeric_columns:
            raise ValueError("Bubble Chart requires numeric X and Y columns.")
        frame = df.copy()
        frame[x_column] = pd.to_numeric(frame[x_column], errors="coerce")
        frame[y_column] = pd.to_numeric(frame[y_column], errors="coerce")
        chosen_size = size_column if size_column in numeric_columns and size_column not in {x_column, y_column} else None
        if chosen_size:
            frame[chosen_size] = pd.to_numeric(frame[chosen_size], errors="coerce")
            frame = frame[[x_column, y_column, chosen_size]].dropna()
        else:
            frame = frame[[x_column, y_column]].dropna()
            frame["__bubble_size"] = frame[y_column].abs().clip(lower=1)
            chosen_size = "__bubble_size"
            warning = "Bubble size was auto-derived from the Y column because no third numeric column was available."
        frame, note = _sample_frame(frame, MAX_SCATTER_ROWS)
        figure = px.scatter(frame, x=x_column, y=y_column, size=chosen_size, color=y_column, color_continuous_scale=["#66d9ff", ORANGE], size_max=32)
        figure.update_layout(title=f"Bubble Chart - {y_column} vs {x_column}")

    elif chart_type == "treemap":
        columns = selected_columns[:MAX_TREEMAP_LEVELS]
        if not columns:
            raise ValueError("Treemap needs at least one selected column.")
        categorical_path = [column for column in columns if column in categorical_columns]
        numeric_value = next((column for column in reversed(columns) if column in numeric_columns and column not in categorical_path), None)
        frame = df.copy()

        if not categorical_path:
            fallback_numeric = next((column for column in columns if column in numeric_columns), None)
            if fallback_numeric is None:
                raise ValueError("Treemap needs at least one categorical or numeric column.")
            frame["__bucket__"] = _bucket_numeric_series(frame[fallback_numeric], bins=6)
            categorical_path = ["__bucket__"]
            warning = f"{fallback_numeric} was bucketed to build the treemap hierarchy."

        if numeric_value:
            agg = frame.groupby(categorical_path, dropna=False)[numeric_value].sum().reset_index()
            value_field = numeric_value
        else:
            agg = frame.groupby(categorical_path, dropna=False).size().reset_index(name="count")
            value_field = "count"

        figure = px.treemap(agg, path=categorical_path, values=value_field, color=value_field, color_continuous_scale=["#ffe3cf", ORANGE])
        figure.update_layout(title="Treemap", coloraxis_showscale=False)

    elif chart_type == "stacked_bar_chart":
        if not x_column or not y_column:
            raise ValueError("Stacked Bar Chart requires X and Y columns.")
        chosen_group = group_column if group_column in categorical_columns and group_column != x_column else None
        if chosen_group:
            frame = df[[x_column, y_column, chosen_group]].copy()
            frame[y_column] = pd.to_numeric(frame[y_column], errors="coerce")
            frame = frame.dropna(subset=[y_column])
            frame[chosen_group] = frame[chosen_group].astype(str)
        else:
            frame = df[[x_column, y_column]].copy()
            frame[y_column] = pd.to_numeric(frame[y_column], errors="coerce")
            frame = frame.dropna(subset=[y_column])
            frame["__group__"] = "All"
            chosen_group = "__group__"
            warning = "Only one stack segment was available because no secondary categorical column was found."
        frame, note = _sample_frame(frame, MAX_GENERAL_ROWS)
        grouped = frame.groupby([x_column, chosen_group], dropna=False)[y_column].sum().reset_index()
        grouped = grouped.sort_values(y_column, ascending=False).head(MAX_CATEGORY_VALUES * 4)
        figure = px.bar(grouped, x=x_column, y=y_column, color=chosen_group, barmode="stack")
        figure.update_layout(title=f"Stacked Bar Chart - {y_column} by {x_column}")

    else:
        raise ValueError(f"Unsupported chart type: {chart_type}")

    _apply_theme(figure, theme)
    return sanitize_for_json({
        "chart_key": chart_key,
        "chart_type": chart_type,
        "figure": _figure_json(figure),
        "note": note,
        "warning": warning,
        "resolved": {
            "column": column,
            "x_column": x_column,
            "y_column": y_column,
            "date_column": date_column,
            "value_column": value_column,
            "group_column": group_column,
            "size_column": size_column,
            "columns": selected_columns,
        },
    })


def render_visualization_batch(df: pd.DataFrame, charts: list[dict[str, Any]]) -> dict[str, Any]:
    results = []
    for chart in charts:
        try:
            results.append(render_visualization_chart(df, chart))
        except Exception as exc:
            chart_type = chart.get("chart_type") or chart.get("viz_type") or chart.get("chart_key")
            results.append(
                {
                    "chart_key": chart.get("chart_key") or chart_type,
                    "chart_type": chart_type,
                    "error": str(exc),
                }
            )
    return sanitize_for_json({"results": results})
