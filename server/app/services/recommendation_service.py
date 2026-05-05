"""
Recommendation Service — auto-generates insights from dataset and model results.
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# DATA QUALITY
# ─────────────────────────────────────────────────────────────────────────────

def get_data_quality_score(df: pd.DataFrame) -> dict:
    """Return an A–F grade + component breakdown."""
    total_cells = df.size
    missing_cells = int(df.isnull().sum().sum())
    missing_pct = round(missing_cells / max(total_cells, 1) * 100, 2)

    dup_rows = int(df.duplicated().sum())
    dup_pct = round(dup_rows / max(len(df), 1) * 100, 2)

    # Score components (0–100 each)
    completeness = max(0, 100 - missing_pct * 2)
    uniqueness   = max(0, 100 - dup_pct * 3)
    consistency  = _consistency_score(df)
    overall      = round((completeness * 0.4 + uniqueness * 0.3 + consistency * 0.3), 1)

    grade = "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D" if overall >= 40 else "F"

    return {
        "overall_score": overall,
        "grade": grade,
        "completeness": round(completeness, 1),
        "uniqueness": round(uniqueness, 1),
        "consistency": round(consistency, 1),
        "missing_pct": missing_pct,
        "duplicate_rows": dup_rows,
        "duplicate_pct": dup_pct,
        "total_rows": len(df),
        "total_cols": df.shape[1],
    }


def _consistency_score(df: pd.DataFrame) -> float:
    """Penalise columns where >50% values are the same constant."""
    if df.empty:
        return 100.0
    low_var = sum(
        1 for col in df.columns
        if df[col].value_counts(normalize=True, dropna=False).iloc[0] > 0.95
    )
    return max(0.0, 100 - (low_var / df.shape[1]) * 100)


# ─────────────────────────────────────────────────────────────────────────────
# STATISTICAL INSIGHTS
# ─────────────────────────────────────────────────────────────────────────────

def get_statistical_insights(df: pd.DataFrame) -> List[dict]:
    insights = []

    num_df = df.select_dtypes(include=np.number)

    # Missing value warnings
    missing = df.isnull().sum()
    for col, cnt in missing[missing > 0].items():
        pct = round(cnt / len(df) * 100, 1)
        severity = "critical" if pct > 40 else "warning" if pct > 15 else "info"
        insights.append({
            "category": "Missing Data",
            "severity": severity,
            "icon": "⚠️" if severity != "info" else "ℹ️",
            "title": f"'{col}' has {pct}% missing values",
            "description": f"{cnt} out of {len(df)} rows are null in column '{col}'. "
                           f"Consider {'dropping or imputing' if pct < 50 else 'dropping'} this column.",
            "action": "Handle in Preprocessing step",
        })

    # Outlier detection (IQR method)
    for col in num_df.columns:
        q1, q3 = num_df[col].quantile(0.25), num_df[col].quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        outliers = ((num_df[col] < q1 - 1.5 * iqr) | (num_df[col] > q3 + 1.5 * iqr)).sum()
        if outliers > 0:
            pct = round(outliers / len(df) * 100, 1)
            insights.append({
                "category": "Outliers",
                "severity": "warning" if pct > 5 else "info",
                "icon": "📊",
                "title": f"'{col}' has {outliers} outliers ({pct}%)",
                "description": f"IQR range: [{round(q1,2)}, {round(q3,2)}]. "
                               f"Values outside [{round(q1-1.5*iqr,2)}, {round(q3+1.5*iqr,2)}] are flagged.",
                "action": "Review in Visualization step",
            })

    # Duplicate rows
    dup = df.duplicated().sum()
    if dup > 0:
        insights.append({
            "category": "Data Quality",
            "severity": "warning",
            "icon": "🔄",
            "title": f"{dup} duplicate rows detected",
            "description": f"{round(dup/len(df)*100,1)}% rows are exact duplicates. "
                           f"These may skew model training results.",
            "action": "Drop duplicates before preprocessing",
        })

    # High-cardinality categoricals
    cat_df = df.select_dtypes(include=["object", "category"])
    for col in cat_df.columns:
        n_unique = cat_df[col].nunique()
        if n_unique > 50:
            insights.append({
                "category": "Encoding",
                "severity": "warning",
                "icon": "🔤",
                "title": f"'{col}' has {n_unique} unique categories",
                "description": "High-cardinality categorical columns can cause memory issues with One-Hot Encoding. "
                               "Label Encoding is recommended.",
                "action": "Use Label Encoding in Preprocessing",
            })

    # Constant columns
    for col in df.columns:
        if df[col].nunique() <= 1:
            insights.append({
                "category": "Feature Selection",
                "severity": "critical",
                "icon": "🚫",
                "title": f"'{col}' is a constant column",
                "description": f"Column '{col}' has only 1 unique value and provides no predictive value.",
                "action": "Consider dropping this column",
            })

    # Highly correlated features
    if len(num_df.columns) > 1:
        try:
            corr = num_df.corr().abs()
            upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
            high_corr = [(col, row, round(upper.loc[row, col], 3))
                         for col in upper.columns
                         for row in upper.index
                         if pd.notna(upper.loc[row, col]) and upper.loc[row, col] > 0.9]
            for c1, c2, val in high_corr[:3]:
                insights.append({
                    "category": "Feature Selection",
                    "severity": "info",
                    "icon": "🔗",
                    "title": f"High correlation: '{c1}' ↔ '{c2}' ({val})",
                    "description": f"These features are {val*100:.0f}% correlated. "
                                   f"Consider keeping only one to reduce multicollinearity.",
                    "action": "Review feature importance after training",
                })
        except Exception:
            pass

    # Class imbalance hint (for numeric target-like columns)
    for col in num_df.columns:
        if df[col].nunique() <= 20 and df[col].nunique() > 1:
            dist = df[col].value_counts(normalize=True)
            if dist.min() < 0.1:
                insights.append({
                    "category": "Class Imbalance",
                    "severity": "warning",
                    "icon": "⚖️",
                    "title": f"Possible class imbalance in '{col}'",
                    "description": f"The smallest class has only {round(dist.min()*100,1)}% of samples. "
                                   f"Model may be biased toward majority class.",
                    "action": "Check task type — model will auto-handle imbalance",
                })
            break

    return insights[:15]  # cap at 15


# ─────────────────────────────────────────────────────────────────────────────
# MODEL RECOMMENDATIONS (post-training)
# ─────────────────────────────────────────────────────────────────────────────

def get_model_recommendations(results: List[dict], task_type: str, best_model_name: str) -> List[dict]:
    recs = []

    if not results:
        return recs

    best = next((r for r in results if r.get("Model") == best_model_name), None)

    if task_type == "Classification":
        metric = "Accuracy"
        threshold_good = 0.85
        threshold_ok = 0.70
    else:
        metric = "R2 Score"
        threshold_good = 0.80
        threshold_ok = 0.60

    if best:
        val = float(best.get(metric, 0) or 0)
        if val >= threshold_good:
            recs.append({
                "category": "Model Performance",
                "severity": "success",
                "icon": "🏆",
                "title": f"Excellent performance! {metric}: {round(val*100,1)}%",
                "description": f"{best_model_name} is performing excellently. "
                               f"The model is ready for deployment.",
                "action": "Proceed to Prediction & Download",
            })
        elif val >= threshold_ok:
            recs.append({
                "category": "Model Performance",
                "severity": "warning",
                "icon": "📈",
                "title": f"Moderate performance. {metric}: {round(val*100,1)}%",
                "description": f"{best_model_name} has acceptable performance but may improve with "
                               f"more feature engineering or hyperparameter tuning.",
                "action": "Try different preprocessing or feature selection",
            })
        else:
            recs.append({
                "category": "Model Performance",
                "severity": "critical",
                "icon": "⚠️",
                "title": f"Low performance. {metric}: {round(val*100,1)}%",
                "description": f"The model is underperforming. Check for insufficient data, "
                               f"poor feature selection, or wrong task type.",
                "action": "Review preprocessing and feature engineering",
            })

    # Suggest tuned models
    tuned = [r for r in results if r.get("Tuned") == "Yes"]
    not_tuned = [r for r in results if r.get("Tuned") == "No"]
    if not tuned:
        recs.append({
            "category": "Hyperparameter Tuning",
            "severity": "info",
            "icon": "🔧",
            "title": "Tuned XGBoost/CatBoost not available",
            "description": "Install xgboost and catboost for automated hyperparameter tuning "
                           "which typically improves performance by 3-8%.",
            "action": "Run: pip install xgboost catboost",
        })

    # Compare top 3
    sorted_results = sorted(results, key=lambda x: float(x.get(metric, 0) or 0), reverse=True)
    if len(sorted_results) >= 2:
        top = sorted_results[0]
        second = sorted_results[1]
        diff = round((float(top.get(metric, 0) or 0) - float(second.get(metric, 0) or 0)) * 100, 2)
        recs.append({
            "category": "Model Comparison",
            "severity": "info",
            "icon": "📊",
            "title": f"{top.get('Model')} leads by {diff}% over {second.get('Model')}",
            "description": f"Top model: {top.get('Model')} ({metric}: {round(float(top.get(metric,0) or 0)*100,1)}%) "
                           f"vs {second.get('Model')} ({round(float(second.get(metric,0) or 0)*100,1)}%)",
            "action": "Both models are saved — you can predict with either",
        })

    return recs


# ─────────────────────────────────────────────────────────────────────────────
# BUSINESS INSIGHTS (dataset-level patterns)
# ─────────────────────────────────────────────────────────────────────────────

def get_business_insights(df: pd.DataFrame) -> List[dict]:
    insights = []
    num_df = df.select_dtypes(include=np.number)

    # Dataset size insight
    n = len(df)
    if n < 500:
        insights.append({
            "category": "Dataset Size",
            "severity": "warning",
            "icon": "📉",
            "title": f"Small dataset ({n} rows)",
            "description": "Datasets under 500 rows risk overfitting. Models may not generalise well. "
                           "Consider collecting more data or using cross-validation.",
            "action": "Enable cross-validation in training",
        })
    elif n > 100_000:
        insights.append({
            "category": "Dataset Size",
            "severity": "info",
            "icon": "🚀",
            "title": f"Large dataset ({n:,} rows) — sampling enabled",
            "description": "Smart sampling is active to keep training fast. "
                           "Full dataset quality is preserved with stratified sampling.",
            "action": "Training will auto-sample to optimal size",
        })

    # Numeric summary
    if not num_df.empty:
        skewed = []
        for col in num_df.columns:
            try:
                sk = num_df[col].skew()
                if abs(sk) > 2:
                    skewed.append((col, round(sk, 2)))
            except Exception:
                pass
        if skewed:
            col_list = ", ".join(f"'{c}' ({s})" for c, s in skewed[:3])
            insights.append({
                "category": "Distribution",
                "severity": "info",
                "icon": "📐",
                "title": f"{len(skewed)} skewed columns detected",
                "description": f"Columns {col_list} have high skewness. "
                               f"Consider log transformation for better model performance.",
                "action": "Apply log transform before preprocessing",
            })

    # Feature count
    n_cols = df.shape[1]
    if n_cols > 50:
        insights.append({
            "category": "Dimensionality",
            "severity": "warning",
            "icon": "🔢",
            "title": f"High dimensionality ({n_cols} columns)",
            "description": "Many features can cause the curse of dimensionality. "
                           "Feature selection or PCA may improve performance.",
            "action": "Review feature importance after training",
        })

    return insights


# ─────────────────────────────────────────────────────────────────────────────
# AI INSIGHTS (post-training)
# ─────────────────────────────────────────────────────────────────────────────

def get_ai_insights(
    df: pd.DataFrame,
    results: List[dict],
    task_type: str,
    best_model_name: str,
    feature_columns: List[str],
    best_model: Any = None,
    X_test: Any = None,
    y_test: Any = None,
) -> dict:
    """Comprehensive post-training AI insights."""

    quality = get_data_quality_score(df)
    stat_insights = get_statistical_insights(df)
    model_recs = get_model_recommendations(results, task_type, best_model_name)
    biz_insights = get_business_insights(df)

    # Feature importance (if model supports it)
    feature_importance = []
    if best_model is not None and hasattr(best_model, "feature_importances_"):
        try:
            importances = best_model.feature_importances_
            fi = sorted(
                zip(feature_columns, importances),
                key=lambda x: x[1],
                reverse=True,
            )[:10]
            feature_importance = [
                {"feature": f, "importance": round(float(imp), 4)}
                for f, imp in fi
            ]
        except Exception:
            pass

    # Best model metrics
    best_metrics = {}
    if results:
        best_result = next((r for r in results if r.get("Model") == best_model_name), {})
        best_metrics = best_result

    return {
        "quality_score": quality,
        "statistical_insights": stat_insights,
        "model_recommendations": model_recs,
        "business_insights": biz_insights,
        "feature_importance": feature_importance,
        "best_model_name": best_model_name,
        "best_metrics": best_metrics,
        "task_type": task_type,
        "total_models_trained": len(results),
    }
