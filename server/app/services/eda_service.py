from __future__ import annotations

import base64
import io
import math
from typing import Any, Optional

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from sklearn.preprocessing import MinMaxScaler, StandardScaler

from app.services.ml_service import build_dataset_snapshot, sanitize_for_json, serialize_dataframe


MAX_HEAD_ROWS = 20
MAX_TAIL_ROWS = 20
MAX_CORR_ROWS = 20_000
MAX_PAIR_ROWS = 2_500
MAX_CHART_ROWS = 15_000
MAX_STATIC_ROWS = 5_000

AGGREGATIONS = {"mean", "median", "sum", "count", "min", "max"}


def _sample_frame(df: pd.DataFrame, max_rows: int) -> pd.DataFrame:
    if len(df) <= max_rows:
        return df.copy()
    return df.sample(n=max_rows, random_state=42).reset_index(drop=True)


def _coerce_datetime_series(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def detect_datetime_columns(df: pd.DataFrame, threshold: float = 0.7) -> list[str]:
    datetime_columns: list[str] = []
    for column in df.columns:
        series = df[column]
        if pd.api.types.is_datetime64_any_dtype(series):
            datetime_columns.append(str(column))
            continue
        if pd.api.types.is_numeric_dtype(series):
            continue
        converted = _coerce_datetime_series(series)
        valid_ratio = float(converted.notna().mean()) if len(series) else 0.0
        if valid_ratio >= threshold:
            datetime_columns.append(str(column))
    return datetime_columns


def _safe_mode(series: pd.Series) -> Any:
    try:
        mode = series.mode(dropna=True)
        if not mode.empty:
            return mode.iloc[0]
    except Exception:
        return None
    return None


def _json_figure(fig: Any) -> dict[str, Any]:
    return sanitize_for_json(fig.to_plotly_json())


def _dedupe_name(columns: list[str], desired: str) -> str:
    if desired not in columns:
        return desired
    counter = 2
    while f"{desired}_{counter}" in columns:
        counter += 1
    return f"{desired}_{counter}"


def _looks_like_boolean(series: pd.Series) -> bool:
    values = {str(value).strip().lower() for value in series.dropna().unique().tolist()}
    return bool(values) and values.issubset({"true", "false", "yes", "no", "1", "0"})


def _normalise_frame_types(df: pd.DataFrame) -> pd.DataFrame:
    frame = df.copy()
    frame = frame.replace({"": np.nan})

    for column in frame.columns:
        series = frame[column]
        if pd.api.types.is_bool_dtype(series) or pd.api.types.is_numeric_dtype(series) or pd.api.types.is_datetime64_any_dtype(series):
            continue

        non_null = series.dropna()
        if non_null.empty:
            continue

        if _looks_like_boolean(non_null):
            mapping = {
                "true": True,
                "yes": True,
                "1": True,
                "false": False,
                "no": False,
                "0": False,
            }
            frame[column] = series.map(lambda value: mapping.get(str(value).strip().lower()) if pd.notna(value) else np.nan)
            continue

        numeric = pd.to_numeric(non_null, errors="coerce")
        if float(numeric.notna().mean()) >= 0.9:
            frame[column] = pd.to_numeric(series, errors="coerce")
            continue

        datelike = _coerce_datetime_series(non_null)
        if float(datelike.notna().mean()) >= 0.9:
            frame[column] = _coerce_datetime_series(series)

    return frame


def dataframe_from_payload(rows: list[dict[str, Any]], columns: Optional[list[str]] = None) -> pd.DataFrame:
    records = rows or []
    frame = pd.DataFrame(records)
    if columns:
        for column in columns:
            if column not in frame.columns:
                frame[column] = np.nan
        frame = frame[columns]
    return _normalise_frame_types(frame)


def build_dataset_payload(df: pd.DataFrame, name: str = "Dataset") -> dict[str, Any]:
    return {
        "name": name,
        "rows": serialize_dataframe(df, limit=None),
        "columns": [str(column) for column in df.columns.tolist()],
        "meta": build_dataset_snapshot(df),
    }


def _build_column_overview(df: pd.DataFrame, datetime_columns: list[str]) -> list[dict[str, Any]]:
    total_rows = max(len(df), 1)
    columns: list[dict[str, Any]] = []

    for column in df.columns:
        series = df[column]
        missing = int(series.isna().sum())
        dtype = "datetime" if str(column) in datetime_columns else str(series.dtype)
        columns.append(
            {
                "column": str(column),
                "dtype": dtype,
                "non_null": int(series.notna().sum()),
                "missing": missing,
                "missing_pct": round(missing / total_rows * 100, 2),
                "unique": int(series.nunique(dropna=True)),
            }
        )
    return columns


def _build_quality_report(df: pd.DataFrame, datetime_columns: list[str]) -> dict[str, Any]:
    total_rows = len(df)
    duplicate_rows = int(df.duplicated().sum())
    missing_by_column = []
    invalid_entries = []
    constant_columns = []

    for column in df.columns:
        series = df[column]
        missing = int(series.isna().sum())
        missing_pct = round(missing / max(total_rows, 1) * 100, 2)
        missing_by_column.append(
            {
                "column": str(column),
                "missing": missing,
                "missing_pct": missing_pct,
            }
        )

        if series.nunique(dropna=True) <= 1:
            constant_columns.append(str(column))

        if pd.api.types.is_numeric_dtype(series) or pd.api.types.is_bool_dtype(series):
            continue

        non_null = series.dropna().astype(str)
        if non_null.empty:
            continue

        whitespace_count = int(non_null.str.contains(r"^\\s+|\\s+$", regex=True).sum())
        if whitespace_count:
            invalid_entries.append(
                {
                    "column": str(column),
                    "issue": "Leading or trailing whitespace",
                    "count": whitespace_count,
                }
            )

        lowered = non_null.str.strip().str.lower()
        variant_count = 0
        for _, bucket in non_null.groupby(lowered):
            raw_unique = bucket.dropna().unique().tolist()
            if len(raw_unique) > 1:
                variant_count += len(raw_unique)
        if variant_count:
            invalid_entries.append(
                {
                    "column": str(column),
                    "issue": "Potential inconsistent casing or text variants",
                    "count": int(variant_count),
                }
            )

        if str(column) in datetime_columns:
            converted = _coerce_datetime_series(series)
            invalid_dates = int(series.notna().sum() - converted.notna().sum())
            if invalid_dates:
                invalid_entries.append(
                    {
                        "column": str(column),
                        "issue": "Unparseable datetime values",
                        "count": invalid_dates,
                    }
                )

    missing_by_column.sort(key=lambda item: item["missing"], reverse=True)
    invalid_entries.sort(key=lambda item: item["count"], reverse=True)

    return {
        "missing_total": int(df.isna().sum().sum()),
        "duplicate_rows": duplicate_rows,
        "duplicate_pct": round(duplicate_rows / max(total_rows, 1) * 100, 2),
        "missing_by_column": missing_by_column,
        "invalid_entries": invalid_entries,
        "constant_columns": constant_columns,
    }


def _build_numeric_statistics(df: pd.DataFrame, numeric_columns: list[str]) -> list[dict[str, Any]]:
    statistics = []
    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            continue
        statistics.append(
            {
                "column": str(column),
                "mean": round(float(series.mean()), 6),
                "median": round(float(series.median()), 6),
                "mode": sanitize_for_json(_safe_mode(series)),
                "min": round(float(series.min()), 6),
                "max": round(float(series.max()), 6),
                "std": round(float(series.std(ddof=0)), 6),
                "q25": round(float(series.quantile(0.25)), 6),
                "q50": round(float(series.quantile(0.5)), 6),
                "q75": round(float(series.quantile(0.75)), 6),
                "skewness": round(float(series.skew()), 6),
                "kurtosis": round(float(series.kurtosis()), 6),
            }
        )
    return statistics


def _build_categorical_statistics(df: pd.DataFrame, categorical_columns: list[str]) -> list[dict[str, Any]]:
    details = []
    for column in categorical_columns:
        series = df[column].dropna().astype(str)
        if series.empty:
            continue
        top_values = series.value_counts().head(5)
        details.append(
            {
                "column": str(column),
                "unique": int(series.nunique()),
                "mode": sanitize_for_json(_safe_mode(series)),
                "top_values": [
                    {"value": str(key), "count": int(value)}
                    for key, value in top_values.items()
                ],
            }
        )
    return details


def _build_outlier_report(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, Any]:
    iqr_rows = []
    zscore_rows = []

    for column in numeric_columns:
        series = pd.to_numeric(df[column], errors="coerce").dropna()
        if series.empty:
            continue

        q1 = float(series.quantile(0.25))
        q3 = float(series.quantile(0.75))
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        iqr_outliers = int(((series < lower) | (series > upper)).sum())
        iqr_rows.append(
            {
                "column": str(column),
                "method": "IQR",
                "count": iqr_outliers,
                "lower_bound": round(lower, 6),
                "upper_bound": round(upper, 6),
            }
        )

        std = float(series.std(ddof=0))
        mean = float(series.mean())
        if std == 0:
            zscore_count = 0
        else:
            zscores = np.abs((series - mean) / std)
            zscore_count = int((zscores > 3).sum())
        zscore_rows.append(
            {
                "column": str(column),
                "method": "Z-Score",
                "count": zscore_count,
                "threshold": 3,
            }
        )

    return {"iqr": iqr_rows, "zscore": zscore_rows}


def _build_correlation_report(df: pd.DataFrame, numeric_columns: list[str]) -> dict[str, Any]:
    if len(numeric_columns) < 2:
        return {"matrix": [], "labels": [], "high_pairs": [], "multicollinearity": []}

    corr_df = _sample_frame(df[numeric_columns], MAX_CORR_ROWS).corr(numeric_only=True).fillna(0)
    high_pairs = []
    for index, left in enumerate(corr_df.columns.tolist()):
        for right in corr_df.columns.tolist()[index + 1:]:
            corr_value = float(corr_df.loc[left, right])
            if abs(corr_value) >= 0.75:
                high_pairs.append(
                    {
                        "left": str(left),
                        "right": str(right),
                        "correlation": round(corr_value, 6),
                    }
                )

    high_pairs.sort(key=lambda item: abs(item["correlation"]), reverse=True)
    return {
        "matrix": sanitize_for_json(corr_df.values.tolist()),
        "labels": [str(column) for column in corr_df.columns.tolist()],
        "high_pairs": high_pairs[:15],
        "multicollinearity": high_pairs[:10],
    }


def _build_distribution_report(statistics: list[dict[str, Any]]) -> list[dict[str, Any]]:
    report = []
    for item in statistics:
        skew = float(item["skewness"])
        kurt = float(item["kurtosis"])
        if abs(skew) < 0.5:
            skew_label = "Approximately symmetric"
        elif skew > 0:
            skew_label = "Positively skewed"
        else:
            skew_label = "Negatively skewed"

        if kurt > 1:
            kurt_label = "Heavy-tailed"
        elif kurt < -1:
            kurt_label = "Light-tailed"
        else:
            kurt_label = "Near-normal tails"

        report.append(
            {
                "column": item["column"],
                "skewness": item["skewness"],
                "kurtosis": item["kurtosis"],
                "skew_label": skew_label,
                "kurtosis_label": kurt_label,
            }
        )
    return report


def _build_grouping_report(df: pd.DataFrame, categorical_columns: list[str], numeric_columns: list[str]) -> dict[str, Any]:
    if not categorical_columns or not numeric_columns:
        return {
            "groupby_preview": [],
            "pivot_preview": [],
            "group_column": None,
            "value_column": None,
        }

    group_column = categorical_columns[0]
    value_column = numeric_columns[0]

    group_df = (
        df.groupby(group_column, dropna=False)[value_column]
        .agg(["count", "mean", "median", "sum"])
        .reset_index()
        .head(12)
    )
    groupby_preview = serialize_dataframe(group_df, limit=None)

    pivot_preview = []
    pivot_columns = categorical_columns[1:2]
    if pivot_columns:
        try:
            pivot_df = pd.pivot_table(
                df,
                index=group_column,
                columns=pivot_columns[0],
                values=value_column,
                aggfunc="mean",
            ).reset_index().head(12)
            pivot_preview = serialize_dataframe(pivot_df, limit=None)
        except Exception:
            pivot_preview = []

    return {
        "groupby_preview": groupby_preview,
        "pivot_preview": pivot_preview,
        "group_column": group_column,
        "value_column": value_column,
    }


def _build_time_series_report(df: pd.DataFrame, datetime_columns: list[str], numeric_columns: list[str]) -> dict[str, Any]:
    if not datetime_columns or not numeric_columns:
        return {"detected": False}

    datetime_column = datetime_columns[0]
    numeric_column = numeric_columns[0]

    ts_df = df[[datetime_column, numeric_column]].copy()
    ts_df[datetime_column] = _coerce_datetime_series(ts_df[datetime_column])
    ts_df[numeric_column] = pd.to_numeric(ts_df[numeric_column], errors="coerce")
    ts_df = ts_df.dropna().sort_values(datetime_column)

    if ts_df.empty:
        return {"detected": False}

    window = min(7, max(len(ts_df) // 5, 2))
    ts_df["rolling_mean"] = ts_df[numeric_column].rolling(window=window, min_periods=1).mean()
    preview = serialize_dataframe(ts_df.head(50), limit=None)

    return {
        "detected": True,
        "datetime_column": datetime_column,
        "numeric_column": numeric_column,
        "rolling_window": window,
        "preview": preview,
    }


def _build_feature_highlights(
    statistics: list[dict[str, Any]],
    correlation_report: dict[str, Any],
    quality_report: dict[str, Any],
) -> dict[str, Any]:
    by_variance = sorted(statistics, key=lambda item: abs(float(item["std"])), reverse=True)
    by_skew = sorted(statistics, key=lambda item: abs(float(item["skewness"])), reverse=True)

    return {
        "high_variance": by_variance[:5],
        "high_skew": by_skew[:5],
        "high_correlation_pairs": correlation_report.get("high_pairs", [])[:5],
        "quality_risks": quality_report.get("invalid_entries", [])[:5],
    }


def _default_columns(
    numeric_columns: list[str],
    categorical_columns: list[str],
    datetime_columns: list[str],
) -> dict[str, Optional[str]]:
    return {
        "numeric": numeric_columns[0] if numeric_columns else None,
        "numeric_y": numeric_columns[1] if len(numeric_columns) > 1 else (numeric_columns[0] if numeric_columns else None),
        "categorical": categorical_columns[0] if categorical_columns else None,
        "group": categorical_columns[1] if len(categorical_columns) > 1 else (categorical_columns[0] if categorical_columns else None),
        "datetime": datetime_columns[0] if datetime_columns else None,
        "third_numeric": numeric_columns[2] if len(numeric_columns) > 2 else None,
    }


def _build_insights(
    shape: dict[str, Any],
    quality: dict[str, Any],
    distribution: list[dict[str, Any]],
    correlation: dict[str, Any],
    outliers: dict[str, Any],
    time_series: dict[str, Any],
    highlights: dict[str, Any],
) -> dict[str, Any]:
    cards: list[dict[str, Any]] = []

    if quality["missing_total"] > 0:
        top_missing = quality["missing_by_column"][:3]
        cards.append(
            {
                "title": "Missing data needs attention",
                "severity": "warning",
                "summary": f"{quality['missing_total']:,} missing cells were detected across the dataset.",
                "action": f"Prioritize columns: {', '.join(item['column'] for item in top_missing if item['missing'] > 0) or 'review missing values'}",
            }
        )

    if quality["duplicate_rows"] > 0:
        cards.append(
            {
                "title": "Duplicate records detected",
                "severity": "warning",
                "summary": f"{quality['duplicate_rows']:,} duplicate rows could distort aggregates and models.",
                "action": "Review and remove duplicates before training or reporting.",
            }
        )

    if correlation.get("high_pairs"):
        pair = correlation["high_pairs"][0]
        cards.append(
            {
                "title": "Strong multicollinearity risk",
                "severity": "info",
                "summary": f"{pair['left']} and {pair['right']} are highly correlated ({pair['correlation']}).",
                "action": "Consider dropping one of the correlated features or using regularization.",
            }
        )

    skew_candidates = [item for item in distribution if abs(float(item["skewness"])) >= 1][:2]
    if skew_candidates:
        cards.append(
            {
                "title": "Feature transformation opportunity",
                "severity": "info",
                "summary": f"{', '.join(item['column'] for item in skew_candidates)} show strong skew and may benefit from scaling or log transforms.",
                "action": "Use the transformation panel to normalize these distributions.",
            }
        )

    outlier_candidates = [item for item in outliers.get("iqr", []) if int(item["count"]) > 0][:2]
    if outlier_candidates:
        cards.append(
            {
                "title": "Outliers may affect stability",
                "severity": "warning",
                "summary": f"{', '.join(item['column'] for item in outlier_candidates)} contain IQR outliers.",
                "action": "Inspect boxplots and apply capping or row removal where appropriate.",
            }
        )

    if time_series.get("detected"):
        cards.append(
            {
                "title": "Time-series patterns available",
                "severity": "success",
                "summary": f"{time_series['datetime_column']} can be used for trend and rolling-mean analysis.",
                "action": "Open the visualization section and explore line or rolling mean charts.",
            }
        )

    if not cards:
        cards.append(
            {
                "title": "Dataset looks healthy",
                "severity": "success",
                "summary": "No major quality issues were detected in the current snapshot.",
                "action": "Proceed to visualization and feature engineering.",
            }
        )

    executive = (
        f"This dataset contains {shape['rows']:,} rows and {shape['columns']} columns. "
        f"It includes {shape['numeric_columns']} numeric, {shape['categorical_columns']} categorical, "
        f"and {shape['datetime_columns']} datetime features. "
        f"Top priorities are {cards[0]['title'].lower()} and reviewing highlighted features such as "
        f"{', '.join(item['column'] for item in highlights.get('high_variance', [])[:3]) or 'the strongest drivers'}."
    )

    return {"executive_summary": executive, "cards": cards[:6]}


def _apply_plot_theme(fig: Any, theme: str) -> None:
    is_light = theme == "light"
    fig.update_layout(
        template="plotly_white" if is_light else "plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"color": "#0f172a" if is_light else "#edf3ff"},
        margin={"l": 40, "r": 20, "t": 56, "b": 40},
    )


def _create_static_chart_image(
    df: pd.DataFrame,
    chart_type: str,
    *,
    x_column: Optional[str],
    y_column: Optional[str],
    color_column: Optional[str],
    z_column: Optional[str],
    bins: int,
    aggregation: str,
    rolling_window: int,
) -> Optional[str]:
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import seaborn as sns
    except Exception:
        return None

    frame = _sample_frame(df, MAX_STATIC_ROWS)
    numeric_columns = [str(column) for column in frame.select_dtypes(include=np.number).columns.tolist()]
    datetime_columns = detect_datetime_columns(frame)
    categorical_columns = [
        str(column)
        for column in frame.columns
        if str(column) not in numeric_columns and str(column) not in datetime_columns
    ]

    sns.set_theme(style="whitegrid")

    if chart_type == "pairplot":
        columns = numeric_columns[: min(5, len(numeric_columns))]
        if len(columns) < 2:
            return None
        pair_df = _sample_frame(frame[columns + ([color_column] if color_column in frame.columns else [])], min(MAX_PAIR_ROWS, len(frame)))
        grid = sns.pairplot(pair_df, hue=color_column if color_column in pair_df.columns else None, corner=True)
        grid.fig.suptitle("Pairplot", y=1.02)
        buffer = io.BytesIO()
        grid.fig.savefig(buffer, format="png", bbox_inches="tight", facecolor="white")
        plt.close(grid.fig)
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("utf-8")

    fig, ax = plt.subplots(figsize=(8.4, 5.2), dpi=140)
    try:
        if chart_type == "histogram" and x_column in frame.columns:
            sns.histplot(frame[x_column].dropna(), bins=bins, kde=True, ax=ax, color="#2563eb")
            ax.set_title(f"Histogram - {x_column}")
        elif chart_type == "boxplot" and y_column in frame.columns:
            x_value = x_column if x_column in categorical_columns else None
            sns.boxplot(data=frame, x=x_value, y=y_column, ax=ax, color="#93c5fd")
            ax.set_title(f"Boxplot - {y_column}")
        elif chart_type == "countplot" and x_column in frame.columns:
            counts = frame[x_column].astype(str).value_counts().head(20)
            sns.barplot(x=counts.index, y=counts.values, ax=ax, color="#3b82f6")
            ax.set_title(f"Countplot - {x_column}")
            ax.tick_params(axis="x", rotation=35)
        elif chart_type in {"bar", "groupby_bar"} and x_column in frame.columns and y_column in frame.columns:
            agg = aggregation if aggregation in AGGREGATIONS else "mean"
            grouped = (
                frame.groupby(x_column, dropna=False)[y_column]
                .agg(agg)
                .reset_index()
                .sort_values(y_column, ascending=False)
                .head(20)
            )
            sns.barplot(data=grouped, x=x_column, y=y_column, ax=ax, palette="Blues_d")
            ax.set_title(f"{agg.title()} {y_column} by {x_column}")
            ax.tick_params(axis="x", rotation=35)
        elif chart_type == "scatter" and x_column in frame.columns and y_column in frame.columns:
            sns.scatterplot(data=frame, x=x_column, y=y_column, hue=color_column if color_column in frame.columns else None, ax=ax)
            ax.set_title(f"{y_column} vs {x_column}")
        elif chart_type == "line" and x_column in frame.columns and y_column in frame.columns:
            line_df = frame[[x_column, y_column]].copy()
            if x_column in datetime_columns:
                line_df[x_column] = _coerce_datetime_series(line_df[x_column])
                line_df = line_df.dropna().sort_values(x_column)
            else:
                agg = aggregation if aggregation in AGGREGATIONS else "mean"
                line_df = line_df.groupby(x_column, dropna=False)[y_column].agg(agg).reset_index()
            sns.lineplot(data=line_df, x=x_column, y=y_column, ax=ax, color="#2563eb")
            ax.set_title(f"Trend - {y_column} vs {x_column}")
            ax.tick_params(axis="x", rotation=25)
        elif chart_type == "grouped_box" and x_column in frame.columns and y_column in frame.columns:
            sns.boxplot(data=frame, x=x_column, y=y_column, hue=color_column if color_column in categorical_columns else None, ax=ax)
            ax.set_title(f"Grouped Boxplot - {y_column} by {x_column}")
            ax.tick_params(axis="x", rotation=30)
        elif chart_type in {"heatmap", "pivot_heatmap"}:
            if chart_type == "heatmap":
                if len(numeric_columns) < 2:
                    plt.close(fig)
                    return None
                corr = _sample_frame(frame[numeric_columns], MAX_CORR_ROWS).corr(numeric_only=True).fillna(0)
                sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", ax=ax)
                ax.set_title("Correlation Heatmap")
            else:
                if not (x_column and y_column and color_column):
                    plt.close(fig)
                    return None
                agg = aggregation if aggregation in AGGREGATIONS else "mean"
                pivot = pd.pivot_table(frame, index=y_column, columns=x_column, values=color_column, aggfunc=agg)
                if pivot.empty:
                    plt.close(fig)
                    return None
                sns.heatmap(pivot.fillna(0), cmap="crest", ax=ax)
                ax.set_title(f"Pivot Heatmap - {color_column}")
        elif chart_type == "normal_curve" and x_column in frame.columns:
            series = pd.to_numeric(frame[x_column], errors="coerce").dropna()
            if series.empty:
                plt.close(fig)
                return None
            sns.histplot(series, bins=bins, stat="density", ax=ax, color="#60a5fa", alpha=0.7)
            mean = float(series.mean())
            std = float(series.std(ddof=0))
            if std != 0:
                xs = np.linspace(series.min(), series.max(), 200)
                coeff = 1 / (std * math.sqrt(2 * math.pi))
                ys = coeff * np.exp(-0.5 * ((xs - mean) / std) ** 2)
                ax.plot(xs, ys, color="#dc2626", linewidth=2)
            ax.set_title(f"Distribution vs Normal Curve - {x_column}")
        elif chart_type == "rolling_mean" and x_column in frame.columns and y_column in frame.columns:
            ts_df = frame[[x_column, y_column]].copy()
            ts_df[x_column] = _coerce_datetime_series(ts_df[x_column])
            ts_df[y_column] = pd.to_numeric(ts_df[y_column], errors="coerce")
            ts_df = ts_df.dropna().sort_values(x_column)
            if ts_df.empty:
                plt.close(fig)
                return None
            ts_df["rolling_mean"] = ts_df[y_column].rolling(window=max(2, rolling_window), min_periods=1).mean()
            ax.plot(ts_df[x_column], ts_df[y_column], label="Observed", color="#60a5fa")
            ax.plot(ts_df[x_column], ts_df["rolling_mean"], label="Rolling Mean", color="#dc2626")
            ax.set_title(f"Rolling Mean - {y_column}")
            ax.legend()
        else:
            plt.close(fig)
            return None

        buffer = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buffer, format="png", bbox_inches="tight", facecolor="white")
        return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("utf-8")
    finally:
        plt.close(fig)


def create_eda_chart(
    df: pd.DataFrame,
    chart_type: str,
    x_column: Optional[str] = None,
    y_column: Optional[str] = None,
    color_column: Optional[str] = None,
    z_column: Optional[str] = None,
    bins: int = 24,
    aggregation: str = "mean",
    rolling_window: int = 7,
    theme: str = "dark",
) -> dict[str, Any]:
    all_columns = [str(column) for column in df.columns]
    numeric_columns = [str(column) for column in df.select_dtypes(include=np.number).columns.tolist()]
    datetime_columns = detect_datetime_columns(df)
    categorical_columns = [
        str(column)
        for column in df.columns
        if str(column) not in numeric_columns and str(column) not in datetime_columns
    ]
    defaults = _default_columns(numeric_columns, categorical_columns, datetime_columns)

    aggregation = aggregation if aggregation in AGGREGATIONS else "mean"
    x_column = x_column if x_column in all_columns else defaults["numeric"] or defaults["categorical"] or defaults["datetime"]
    y_column = y_column if y_column in all_columns else defaults["numeric_y"]
    color_column = color_column if color_column in all_columns else defaults["categorical"]
    z_column = z_column if z_column in all_columns else defaults["third_numeric"]

    frame = _sample_frame(df, MAX_CHART_ROWS)
    figure = None
    note = None

    if chart_type == "histogram":
        if x_column is None:
            raise ValueError("A numeric column is required for histogram.")
        figure = px.histogram(frame, x=x_column, nbins=bins, title=f"Histogram - {x_column}", marginal="box")
    elif chart_type == "boxplot":
        if y_column is None and x_column in numeric_columns:
            y_column = x_column
            x_column = color_column if color_column in categorical_columns else None
        if y_column is None:
            raise ValueError("A numeric column is required for boxplot.")
        figure = px.box(
            frame,
            y=y_column,
            x=x_column if x_column in categorical_columns else None,
            color=x_column if x_column in categorical_columns else None,
            title=f"Boxplot - {y_column}",
        )
    elif chart_type == "countplot":
        if x_column is None:
            raise ValueError("A categorical column is required for countplot.")
        counts = frame[x_column].astype(str).value_counts().head(20).reset_index()
        counts.columns = [x_column, "count"]
        figure = px.bar(counts, x=x_column, y="count", title=f"Countplot - {x_column}", color="count")
    elif chart_type == "bar":
        if x_column is None or y_column is None:
            raise ValueError("Both x and y columns are required for bar chart.")
        grouped = (
            frame.groupby(x_column, dropna=False)[y_column]
            .agg(aggregation)
            .reset_index()
            .sort_values(y_column, ascending=False)
            .head(20)
        )
        figure = px.bar(grouped, x=x_column, y=y_column, color=x_column, title=f"{aggregation.title()} {y_column} by {x_column}")
    elif chart_type == "scatter":
        if x_column is None or y_column is None:
            raise ValueError("Both x and y numeric columns are required for scatter plot.")
        figure = px.scatter(frame, x=x_column, y=y_column, color=color_column if color_column in all_columns else None, title=f"{y_column} vs {x_column}")
    elif chart_type == "line":
        if x_column is None or y_column is None:
            raise ValueError("Both x and y columns are required for line plot.")
        line_df = frame[[x_column, y_column]].copy()
        if x_column in datetime_columns:
            line_df[x_column] = _coerce_datetime_series(line_df[x_column])
            line_df = line_df.dropna().sort_values(x_column)
        else:
            line_df = line_df.groupby(x_column, dropna=False)[y_column].agg(aggregation).reset_index()
        figure = px.line(line_df, x=x_column, y=y_column, title=f"Trend - {y_column} vs {x_column}")
    elif chart_type == "grouped_box":
        if x_column is None or y_column is None:
            raise ValueError("A categorical x column and numeric y column are required for grouped boxplot.")
        figure = px.box(
            frame,
            x=x_column,
            y=y_column,
            color=color_column if color_column in categorical_columns else x_column,
            title=f"Grouped Boxplot - {y_column} by {x_column}",
        )
    elif chart_type == "pairplot":
        columns = numeric_columns[: min(5, len(numeric_columns))]
        if len(columns) < 2:
            raise ValueError("At least two numeric columns are required for pairplot.")
        pair_df = _sample_frame(df, MAX_PAIR_ROWS)
        figure = px.scatter_matrix(pair_df, dimensions=columns, color=color_column if color_column in all_columns else None, title="Pairplot")
        note = f"Pairplot rendered on {len(pair_df):,} sampled rows for performance."
    elif chart_type == "heatmap":
        if len(numeric_columns) < 2:
            raise ValueError("At least two numeric columns are required for heatmap.")
        corr_df = _sample_frame(df[numeric_columns], MAX_CORR_ROWS).corr(numeric_only=True).fillna(0)
        figure = px.imshow(corr_df, text_auto=".2f", aspect="auto", color_continuous_scale="RdBu_r", title="Correlation Heatmap")
    elif chart_type == "scatter3d":
        if not (x_column and y_column and z_column):
            raise ValueError("Three numeric columns are required for 3D scatter.")
        figure = px.scatter_3d(frame, x=x_column, y=y_column, z=z_column, color=color_column if color_column in all_columns else None, title=f"3D Scatter - {x_column}, {y_column}, {z_column}")
    elif chart_type == "normal_curve":
        if x_column is None:
            raise ValueError("A numeric column is required for normal distribution view.")
        series = pd.to_numeric(frame[x_column], errors="coerce").dropna()
        if series.empty:
            raise ValueError("Selected column does not contain numeric values.")
        hist = go.Histogram(x=series, histnorm="probability density", name="Observed", opacity=0.7, nbinsx=bins)
        mean = float(series.mean())
        std = float(series.std(ddof=0))
        if std == 0:
            xs = np.array([mean])
            ys = np.array([1.0])
        else:
            xs = np.linspace(series.min(), series.max(), 200)
            coeff = 1 / (std * math.sqrt(2 * math.pi))
            ys = coeff * np.exp(-0.5 * ((xs - mean) / std) ** 2)
        curve = go.Scatter(x=xs, y=ys, mode="lines", name="Normal Curve")
        figure = go.Figure(data=[hist, curve])
        figure.update_layout(title=f"Distribution vs Normal Curve - {x_column}")
    elif chart_type == "rolling_mean":
        if x_column is None or y_column is None:
            raise ValueError("A datetime column and numeric column are required for rolling mean.")
        ts_df = df[[x_column, y_column]].copy()
        ts_df[x_column] = _coerce_datetime_series(ts_df[x_column])
        ts_df[y_column] = pd.to_numeric(ts_df[y_column], errors="coerce")
        ts_df = ts_df.dropna().sort_values(x_column)
        if ts_df.empty:
            raise ValueError("The selected time-series columns do not contain valid values.")
        ts_df["rolling_mean"] = ts_df[y_column].rolling(window=max(2, rolling_window), min_periods=1).mean()
        figure = go.Figure()
        figure.add_trace(go.Scatter(x=ts_df[x_column], y=ts_df[y_column], mode="lines", name="Observed"))
        figure.add_trace(go.Scatter(x=ts_df[x_column], y=ts_df["rolling_mean"], mode="lines", name=f"Rolling Mean ({rolling_window})"))
        figure.update_layout(title=f"Rolling Mean - {y_column} over {x_column}")
    elif chart_type == "groupby_bar":
        group_column = x_column if x_column in all_columns else defaults["categorical"]
        value_column = y_column if y_column in all_columns else defaults["numeric"]
        if not group_column or not value_column:
            raise ValueError("A group column and numeric value column are required.")
        grouped = (
            frame.groupby(group_column, dropna=False)[value_column]
            .agg(aggregation)
            .reset_index()
            .sort_values(value_column, ascending=False)
            .head(15)
        )
        figure = px.bar(grouped, x=group_column, y=value_column, color=value_column, title=f"GroupBy {aggregation.title()} - {value_column} by {group_column}")
    elif chart_type == "pivot_heatmap":
        if not x_column or not y_column or not color_column:
            raise ValueError("Two categorical columns and one numeric column are required for pivot heatmap.")
        pivot_df = pd.pivot_table(frame, index=y_column, columns=x_column, values=color_column, aggfunc=aggregation)
        if pivot_df.empty:
            raise ValueError("Pivot table is empty for the selected columns.")
        figure = px.imshow(pivot_df.fillna(0), aspect="auto", title=f"Pivot Heatmap - {color_column}")
    else:
        raise ValueError(f"Unsupported chart type: {chart_type}")

    _apply_plot_theme(figure, theme)
    static_image = _create_static_chart_image(
        df,
        chart_type,
        x_column=x_column,
        y_column=y_column,
        color_column=color_column,
        z_column=z_column,
        bins=bins,
        aggregation=aggregation,
        rolling_window=rolling_window,
    )
    return {
        "figure": _json_figure(figure),
        "note": note,
        "defaults": defaults,
        "static_image": static_image,
    }


def _numeric_columns(df: pd.DataFrame) -> list[str]:
    return [str(column) for column in df.select_dtypes(include=np.number).columns.tolist()]


def _datetime_columns(df: pd.DataFrame) -> list[str]:
    return detect_datetime_columns(df)


def _categorical_columns(df: pd.DataFrame) -> list[str]:
    datetime_columns = set(_datetime_columns(df))
    numeric_columns = set(_numeric_columns(df))
    return [
        str(column)
        for column in df.columns
        if str(column) not in datetime_columns and str(column) not in numeric_columns
    ]


def _resolve_columns(df: pd.DataFrame, raw_columns: Any, kind: str = "all") -> list[str]:
    all_columns = [str(column) for column in df.columns.tolist()]
    numeric_columns = _numeric_columns(df)
    categorical_columns = _categorical_columns(df)
    datetime_columns = _datetime_columns(df)

    if raw_columns is None or raw_columns == []:
        if kind == "numeric":
            return numeric_columns
        if kind == "categorical":
            return categorical_columns
        if kind == "datetime":
            return datetime_columns
        return all_columns

    if isinstance(raw_columns, str):
        raw_columns = [raw_columns]

    selected = [str(column) for column in raw_columns if str(column) in all_columns]
    if kind == "numeric":
        return [column for column in selected if column in numeric_columns]
    if kind == "categorical":
        return [column for column in selected if column in categorical_columns]
    if kind == "datetime":
        return [column for column in selected if column in datetime_columns]
    return selected


def _fill_missing_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), options.get("kind", "all"))
    strategy = str(options.get("strategy") or "mean").lower()
    fill_value = options.get("fill_value")

    if not columns:
        raise ValueError("Select at least one column for missing-value handling.")

    if strategy == "drop":
        before = len(frame)
        frame = frame.dropna(subset=columns)
        removed = before - len(frame)
        return {"df": frame, "changed_count": removed, "message": f"Removed {removed} row(s) with missing values."}

    changed_count = 0
    for column in columns:
        missing_mask = frame[column].isna()
        if not bool(missing_mask.any()):
            continue

        if strategy == "mean":
            numeric = pd.to_numeric(frame[column], errors="coerce")
            replacement = numeric.mean()
        elif strategy == "median":
            numeric = pd.to_numeric(frame[column], errors="coerce")
            replacement = numeric.median()
        elif strategy == "mode":
            replacement = _safe_mode(frame[column])
        elif strategy == "constant":
            replacement = fill_value
        else:
            raise ValueError(f"Unsupported missing-value strategy: {strategy}")

        if pd.isna(replacement):
            continue
        frame.loc[missing_mask, column] = replacement
        changed_count += int(missing_mask.sum())

    return {"df": frame, "changed_count": changed_count, "message": f"Updated {changed_count} missing cell(s) using {strategy}."}


def _remove_duplicates_action(df: pd.DataFrame) -> dict[str, Any]:
    frame = df.copy()
    before = len(frame)
    frame = frame.drop_duplicates()
    removed = before - len(frame)
    return {"df": frame, "changed_count": removed, "message": f"Removed {removed} duplicate row(s)."}


def _trim_whitespace_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "categorical")
    changed_count = 0

    for column in columns:
        series = frame[column]
        trimmed = series.map(lambda value: value.strip() if isinstance(value, str) else value)
        changed_count += int((trimmed != series).fillna(False).sum())
        frame[column] = trimmed

    return {"df": frame, "changed_count": changed_count, "message": f"Trimmed whitespace in {changed_count} cell(s)."}


def _find_replace_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "categorical")
    find_value = str(options.get("find_value") or "")
    replace_value = options.get("replace_value", "")
    match_mode = str(options.get("match_mode") or "contains").lower()

    if not columns:
        raise ValueError("Select at least one text column for find and replace.")
    if not find_value:
        raise ValueError("Provide a value to find before replacing.")

    changed_count = 0
    for column in columns:
        series = frame[column]
        if match_mode == "exact":
            mask = series.astype(str) == find_value
            changed_count += int(mask.sum())
            frame.loc[mask, column] = replace_value
        else:
            mask = series.astype(str).str.contains(find_value, regex=False, na=False)
            changed_count += int(mask.sum())
            frame.loc[mask, column] = series.loc[mask].astype(str).str.replace(find_value, str(replace_value), regex=False)

    return {"df": frame, "changed_count": changed_count, "message": f"Updated {changed_count} matching cell(s)."}


def _convert_dtype_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    column = options.get("column")
    target_dtype = str(options.get("target_dtype") or "").lower()

    if column not in frame.columns:
        raise ValueError("Choose a valid column to convert.")
    if target_dtype not in {"integer", "float", "string", "category", "datetime", "boolean"}:
        raise ValueError("Choose a supported target dtype.")

    if target_dtype == "integer":
        frame[column] = pd.to_numeric(frame[column], errors="coerce").round().astype("Int64")
    elif target_dtype == "float":
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    elif target_dtype == "string":
        frame[column] = frame[column].astype("string")
    elif target_dtype == "category":
        frame[column] = frame[column].astype("category")
    elif target_dtype == "datetime":
        frame[column] = _coerce_datetime_series(frame[column])
    elif target_dtype == "boolean":
        mapping = {"true": True, "yes": True, "1": True, "false": False, "no": False, "0": False}
        frame[column] = frame[column].map(lambda value: mapping.get(str(value).strip().lower()) if pd.notna(value) else np.nan)

    return {"df": frame, "changed_count": int(frame[column].notna().sum()), "message": f"Converted {column} to {target_dtype}."}


def _handle_outliers_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "numeric")
    method = str(options.get("method") or "iqr").lower()
    mode = str(options.get("mode") or "remove").lower()
    z_threshold = float(options.get("z_threshold") or 3.0)
    iqr_multiplier = float(options.get("iqr_multiplier") or 1.5)

    if not columns:
        raise ValueError("Choose at least one numeric column for outlier handling.")

    if mode not in {"remove", "cap"}:
        raise ValueError("Outlier mode must be remove or cap.")

    mask_remove = pd.Series(False, index=frame.index)
    changed_count = 0

    for column in columns:
        series = pd.to_numeric(frame[column], errors="coerce")
        if series.dropna().empty:
            continue

        if method == "zscore":
            mean = float(series.mean())
            std = float(series.std(ddof=0))
            if std == 0:
                continue
            zscores = (series - mean) / std
            lower = mean - z_threshold * std
            upper = mean + z_threshold * std
            outlier_mask = zscores.abs() > z_threshold
        else:
            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - iqr_multiplier * iqr
            upper = q3 + iqr_multiplier * iqr
            outlier_mask = (series < lower) | (series > upper)

        if mode == "remove":
            mask_remove = mask_remove | outlier_mask.fillna(False)
        else:
            capped = series.clip(lower=lower, upper=upper)
            changed_count += int((capped != series).fillna(False).sum())
            frame[column] = capped

    if mode == "remove":
        removed = int(mask_remove.sum())
        frame = frame.loc[~mask_remove].copy()
        changed_count = removed

    return {"df": frame, "changed_count": changed_count, "message": f"{'Removed' if mode == 'remove' else 'Capped'} {changed_count} outlier value(s) using {method}."}


def _label_encode_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "categorical")
    output_mode = str(options.get("output_mode") or "append").lower()

    if not columns:
        raise ValueError("Choose at least one categorical column to label encode.")

    changed_count = 0
    for column in columns:
        codes, _ = pd.factorize(frame[column].astype(str), sort=True)
        encoded = pd.Series(np.where(frame[column].isna(), np.nan, codes), index=frame.index)
        if output_mode == "replace":
            frame[column] = encoded
        else:
            new_column = _dedupe_name([str(value) for value in frame.columns.tolist()], f"{column}_label")
            frame[new_column] = encoded
        changed_count += int(frame[column].notna().sum())

    return {"df": frame, "changed_count": changed_count, "message": f"Label encoded {len(columns)} column(s)."}


def _one_hot_encode_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "categorical")
    drop_first = bool(options.get("drop_first", False))

    if not columns:
        raise ValueError("Choose at least one categorical column to one-hot encode.")

    before_columns = set(frame.columns.tolist())
    frame = pd.get_dummies(frame, columns=columns, drop_first=drop_first, dummy_na=False)
    created = len(set(frame.columns.tolist()) - before_columns)
    return {"df": frame, "changed_count": created, "message": f"Created {created} one-hot encoded feature(s)."}


def _create_feature_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    mode = str(options.get("mode") or "arithmetic").lower()

    if mode == "datetime_part":
        column = options.get("column")
        component = str(options.get("component") or "month").lower()
        if column not in frame.columns:
            raise ValueError("Choose a valid datetime column.")
        series = _coerce_datetime_series(frame[column])
        if series.dropna().empty:
            raise ValueError("Selected datetime column does not contain valid dates.")
        accessors = {
            "year": series.dt.year,
            "month": series.dt.month,
            "day": series.dt.day,
            "dayofweek": series.dt.dayofweek,
            "quarter": series.dt.quarter,
        }
        if component not in accessors:
            raise ValueError("Choose a supported datetime component.")
        desired = options.get("new_column") or f"{column}_{component}"
        new_column = _dedupe_name([str(value) for value in frame.columns.tolist()], str(desired))
        frame[new_column] = accessors[component]
        return {"df": frame, "changed_count": int(frame[new_column].notna().sum()), "message": f"Created datetime feature {new_column}."}

    left_column = options.get("left_column")
    right_column = options.get("right_column")
    operation = str(options.get("operation") or "add").lower()
    if left_column not in frame.columns or right_column not in frame.columns:
        raise ValueError("Choose valid source columns for the new feature.")

    left = pd.to_numeric(frame[left_column], errors="coerce")
    right = pd.to_numeric(frame[right_column], errors="coerce")
    if operation == "add":
        result = left + right
    elif operation == "subtract":
        result = left - right
    elif operation == "multiply":
        result = left * right
    elif operation == "divide":
        result = left / right.replace(0, np.nan)
    else:
        raise ValueError("Choose a supported arithmetic operation.")

    desired = options.get("new_column") or f"{left_column}_{operation}_{right_column}"
    new_column = _dedupe_name([str(value) for value in frame.columns.tolist()], str(desired))
    frame[new_column] = result
    return {"df": frame, "changed_count": int(frame[new_column].notna().sum()), "message": f"Created new feature {new_column}."}


def _transform_feature_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "numeric")
    transformation = str(options.get("transformation") or "log1p").lower()
    output_mode = str(options.get("output_mode") or "append").lower()

    if not columns:
        raise ValueError("Choose at least one numeric column to transform.")

    changed_count = 0
    for column in columns:
        series = pd.to_numeric(frame[column], errors="coerce")
        if transformation == "log1p":
            transformed = np.log1p(series.clip(lower=0))
        elif transformation == "sqrt":
            transformed = np.sqrt(series.clip(lower=0))
        elif transformation == "square":
            transformed = np.square(series)
        elif transformation == "abs":
            transformed = np.abs(series)
        elif transformation == "reciprocal":
            transformed = 1 / series.replace(0, np.nan)
        else:
            raise ValueError("Choose a supported transformation.")

        if output_mode == "replace":
            frame[column] = transformed
        else:
            new_column = _dedupe_name([str(value) for value in frame.columns.tolist()], f"{column}_{transformation}")
            frame[new_column] = transformed
        changed_count += int(transformed.notna().sum())

    return {"df": frame, "changed_count": changed_count, "message": f"Applied {transformation} to {len(columns)} column(s)."}


def _select_features_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "all")
    mode = str(options.get("mode") or "keep").lower()

    if not columns:
        raise ValueError("Choose at least one feature for selection.")

    before = frame.shape[1]
    if mode == "drop":
        frame = frame.drop(columns=columns)
    else:
        frame = frame[columns]
    removed = before - frame.shape[1]
    return {"df": frame, "changed_count": removed, "message": f"{'Dropped' if mode == 'drop' else 'Selected'} {len(columns)} feature(s)."}


def _scale_features_action(df: pd.DataFrame, options: dict[str, Any]) -> dict[str, Any]:
    frame = df.copy()
    columns = _resolve_columns(frame, options.get("columns"), "numeric")
    scaler_name = str(options.get("scaler") or "minmax").lower()

    if not columns:
        raise ValueError("Choose at least one numeric column to scale.")

    scaler = MinMaxScaler() if scaler_name == "minmax" else StandardScaler()
    numeric_frame = frame[columns].apply(pd.to_numeric, errors="coerce")
    frame[columns] = scaler.fit_transform(numeric_frame.fillna(numeric_frame.mean()))
    return {"df": frame, "changed_count": int(len(columns) * len(frame)), "message": f"Applied {scaler_name} scaling to {len(columns)} column(s)."}


def apply_eda_action(
    df: pd.DataFrame,
    action: str,
    options: dict[str, Any],
    *,
    df_original: Optional[pd.DataFrame] = None,
) -> dict[str, Any]:
    current = df.copy()
    normalized_action = str(action or "").lower()

    if normalized_action == "fill_missing":
        return _fill_missing_action(current, options)
    if normalized_action == "remove_duplicates":
        return _remove_duplicates_action(current)
    if normalized_action == "trim_whitespace":
        return _trim_whitespace_action(current, options)
    if normalized_action == "find_replace":
        return _find_replace_action(current, options)
    if normalized_action == "convert_dtype":
        return _convert_dtype_action(current, options)
    if normalized_action == "handle_outliers":
        return _handle_outliers_action(current, options)
    if normalized_action == "label_encode":
        return _label_encode_action(current, options)
    if normalized_action == "one_hot_encode":
        return _one_hot_encode_action(current, options)
    if normalized_action == "create_feature":
        return _create_feature_action(current, options)
    if normalized_action == "transform_feature":
        return _transform_feature_action(current, options)
    if normalized_action == "select_features":
        return _select_features_action(current, options)
    if normalized_action == "scale_features":
        return _scale_features_action(current, options)
    if normalized_action == "reset_dataset":
        if df_original is None:
            raise ValueError("No original dataset snapshot is available to reset.")
        frame = df_original.copy()
        changed_count = abs(len(frame) - len(current)) + abs(frame.shape[1] - current.shape[1])
        return {"df": frame, "changed_count": changed_count, "message": "Reset the working dataset back to the original upload."}

    raise ValueError(f"Unsupported EDA action: {action}")


def build_eda_summary(df: pd.DataFrame) -> dict[str, Any]:
    snapshot = build_dataset_snapshot(df)
    datetime_columns = _datetime_columns(df)
    numeric_columns = _numeric_columns(df)
    categorical_columns = _categorical_columns(df)

    overview = {
        "shape": {
            "rows": int(len(df)),
            "columns": int(df.shape[1]),
            "numeric_columns": int(len(numeric_columns)),
            "categorical_columns": int(len(categorical_columns)),
            "datetime_columns": int(len(datetime_columns)),
        },
        "columns": _build_column_overview(df, datetime_columns),
        "head": serialize_dataframe(df, limit=MAX_HEAD_ROWS),
        "tail": serialize_dataframe(df.tail(MAX_TAIL_ROWS), limit=None),
        "snapshot": snapshot,
    }

    quality = _build_quality_report(df, datetime_columns)
    numeric_statistics = _build_numeric_statistics(df, numeric_columns)
    categorical_statistics = _build_categorical_statistics(df, categorical_columns)
    correlation = _build_correlation_report(df, numeric_columns)
    outliers = _build_outlier_report(df, numeric_columns)
    distribution = _build_distribution_report(numeric_statistics)
    grouping = _build_grouping_report(df, categorical_columns, numeric_columns)
    time_series = _build_time_series_report(df, datetime_columns, numeric_columns)
    highlights = _build_feature_highlights(numeric_statistics, correlation, quality)
    defaults = _default_columns(numeric_columns, categorical_columns, datetime_columns)
    insights = _build_insights(overview["shape"], quality, distribution, correlation, outliers, time_series, highlights)

    return sanitize_for_json(
        {
            "overview": overview,
            "quality": quality,
            "statistics": {"numeric": numeric_statistics, "categorical": categorical_statistics},
            "distribution": distribution,
            "correlation": correlation,
            "outliers": outliers,
            "grouping": grouping,
            "time_series": time_series,
            "highlights": highlights,
            "insights": insights,
            "defaults": defaults,
            "available_columns": {
                "all": [str(column) for column in df.columns.tolist()],
                "numeric": numeric_columns,
                "categorical": categorical_columns,
                "datetime": datetime_columns,
            },
        }
    )


def build_eda_report_html(df: pd.DataFrame) -> str:
    summary = build_eda_summary(df)
    shape = summary["overview"]["shape"]
    quality = summary["quality"]
    highlights = summary["highlights"]
    high_pairs = summary["correlation"]["high_pairs"]
    numeric_stats = summary["statistics"]["numeric"][:10]
    distribution = summary["distribution"][:10]
    insight_cards = summary["insights"]["cards"]

    def _rows(items: list[dict[str, Any]], keys: list[str], empty_text: str) -> str:
        if not items:
            return f'<tr><td colspan="{len(keys)}">{empty_text}</td></tr>'
        html_rows = []
        for item in items:
            cells = "".join(f"<td>{item.get(key, '')}</td>" for key in keys)
            html_rows.append(f"<tr>{cells}</tr>")
        return "".join(html_rows)

    insights_html = "".join(
        f"""
        <div class="insight">
          <strong>{card['title']}</strong>
          <p>{card['summary']}</p>
          <span>{card['action']}</span>
        </div>
        """
        for card in insight_cards
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Datalytics EDA Report</title>
  <style>
    body {{ font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }}
    .hero {{ background: #0f172a; color: #f8fafc; border-radius: 18px; padding: 24px; margin-bottom: 20px; }}
    .hero h1 {{ margin: 0 0 8px; font-size: 28px; }}
    .hero p {{ margin: 0; color: #cbd5e1; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 18px; }}
    .metric {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; }}
    .metric strong {{ display: block; font-size: 24px; margin-bottom: 4px; color: #020617; }}
    .section {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 20px; margin-bottom: 18px; }}
    .section h2 {{ margin-top: 0; font-size: 20px; }}
    .chips {{ display: flex; flex-wrap: wrap; gap: 8px; }}
    .chip {{ background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 6px 10px; border-radius: 999px; font-size: 12px; }}
    .insights {{ display: grid; gap: 10px; }}
    .insight {{ border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #f8fafc; }}
    .insight strong {{ display: block; margin-bottom: 6px; }}
    .insight p {{ margin: 0 0 4px; color: #334155; }}
    .insight span {{ color: #2563eb; font-size: 13px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ border-bottom: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 13px; }}
    th {{ color: #475569; text-transform: uppercase; font-size: 11px; letter-spacing: .08em; }}
    .muted {{ color: #64748b; }}
  </style>
</head>
<body>
  <div class="hero">
    <h1>Datalytics EDA Report</h1>
    <p>{summary['insights']['executive_summary']}</p>
  </div>
  <div class="grid">
    <div class="metric"><strong>{shape['rows']:,}</strong><span class="muted">Rows</span></div>
    <div class="metric"><strong>{shape['columns']}</strong><span class="muted">Columns</span></div>
    <div class="metric"><strong>{shape['numeric_columns']}</strong><span class="muted">Numeric</span></div>
    <div class="metric"><strong>{shape['categorical_columns']}</strong><span class="muted">Categorical</span></div>
    <div class="metric"><strong>{quality['missing_total']}</strong><span class="muted">Missing Cells</span></div>
    <div class="metric"><strong>{quality['duplicate_rows']}</strong><span class="muted">Duplicate Rows</span></div>
  </div>
  <div class="section">
    <h2>Important Insights</h2>
    <div class="insights">{insights_html}</div>
  </div>
  <div class="section">
    <h2>Important Feature Highlights</h2>
    <div class="chips">
      {''.join(f"<span class='chip'>{item['column']} (std {item['std']})</span>" for item in highlights['high_variance']) or "<span class='muted'>No standout variance features found.</span>"}
    </div>
  </div>
  <div class="section">
    <h2>Multicollinearity Risks</h2>
    <table>
      <thead><tr><th>Left</th><th>Right</th><th>Correlation</th></tr></thead>
      <tbody>{_rows(high_pairs, ['left', 'right', 'correlation'], 'No high-correlation pairs detected.')}</tbody>
    </table>
  </div>
  <div class="section">
    <h2>Numeric Statistics</h2>
    <table>
      <thead><tr><th>Column</th><th>Mean</th><th>Median</th><th>Std</th><th>Min</th><th>Max</th><th>Q25</th><th>Q75</th></tr></thead>
      <tbody>{_rows(numeric_stats, ['column', 'mean', 'median', 'std', 'min', 'max', 'q25', 'q75'], 'No numeric statistics available.')}</tbody>
    </table>
  </div>
  <div class="section">
    <h2>Distribution Analysis</h2>
    <table>
      <thead><tr><th>Column</th><th>Skewness</th><th>Kurtosis</th><th>Skew Label</th><th>Kurtosis Label</th></tr></thead>
      <tbody>{_rows(distribution, ['column', 'skewness', 'kurtosis', 'skew_label', 'kurtosis_label'], 'No distribution analysis available.')}</tbody>
    </table>
  </div>
</body>
</html>"""
