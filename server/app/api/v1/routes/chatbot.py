"""
Chatbot router — supports 3 AI modes:
  - chat                   → general Q&A / dataset queries (like original standalone app)
  - ai_insights            → deep AI pattern recognition & predictions
  - recommendation_insights → executive business recommendations

KEY DESIGN: For 'chat' mode, we send the ACTUAL CSV data rows directly to Groq
in the prompt — exactly how the original standalone chatbot worked.
This gives accurate, column-aware answers instead of the buggy local data engine.
"""
from __future__ import annotations

import logging
import os
import pathlib
import re
from typing import Optional

# Force-load .env so GROQ_API_KEY is always available
from dotenv import load_dotenv
_ENV = pathlib.Path(__file__).parent.parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=_ENV, override=True)

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import get_chat_history, get_dataset, save_chat_message
from app.services.data_engine_service import has_live_dataset, restore_live_dataset
from app.services.insight_generation_service import (
    generate_mode_response_from_session,
    infer_mode_from_prompt,
)
from app.services.llm_service import get_active_llm_summary, groq_chat, has_groq_config
from app.state.session_store import store
from app.core.ai_feature_flags import require_ai_feature

log = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_MODES = {"chat", "ai_insights", "recommendation_insights", "decision_making"}

CHAT_CONTEXT_MAX_ROWS = int(os.getenv("CHATBOT_CHAT_CONTEXT_ROWS", "48"))
CHAT_CONTEXT_MAX_COLUMNS = int(os.getenv("CHATBOT_CHAT_CONTEXT_COLUMNS", "12"))
CHAT_CONTEXT_MAX_CHARS = int(os.getenv("CHATBOT_CHAT_CONTEXT_CHARS", "12000"))
INSIGHT_CONTEXT_MAX_ROWS = int(os.getenv("CHATBOT_INSIGHT_CONTEXT_ROWS", "28"))
INSIGHT_CONTEXT_MAX_COLUMNS = int(os.getenv("CHATBOT_INSIGHT_CONTEXT_COLUMNS", "14"))
INSIGHT_CONTEXT_MAX_CHARS = int(os.getenv("CHATBOT_INSIGHT_CONTEXT_CHARS", "14000"))
ANALYSIS_SAMPLE_ROWS = int(os.getenv("CHATBOT_ANALYSIS_SAMPLE_ROWS", "2500"))
SUMMARY_NUMERIC_LIMIT = int(os.getenv("CHATBOT_SUMMARY_NUMERIC_LIMIT", "6"))
SUMMARY_CATEGORICAL_LIMIT = int(os.getenv("CHATBOT_SUMMARY_CATEGORICAL_LIMIT", "4"))
SUMMARY_CORRELATION_LIMIT = int(os.getenv("CHATBOT_SUMMARY_CORRELATION_LIMIT", "5"))
CHAT_CACHE_VERSION = "strict-full-row-2026-05-04"

# ─── System prompts per mode ─────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """You are a data analyst assistant for Datalytics.

The user has uploaded a dataset. Answer their question precisely based on the data context.

Rules:
- Use the actual column names and real data values from the dataset
- If exact matching rows are provided, treat them as authoritative full-dataset matches
- If asking for average/mean/count/max/min → answer from computed dataset statistics when present
- Be detailed for row/entity detail questions; be concise for simple count/summary questions
- Use bullet points for multi-part answers
- Include specific numbers from the dataset
- Never make up data; only use what's provided
- If the dataset doesn't have enough info, say so clearly
""".strip()

RECOMMENDATION_SYSTEM_PROMPT = """You are an industry-level Senior Business Intelligence Analyst, data analyst, and Strategic Advisor.

The user has uploaded a dataset. Generate board-ready executive business recommendations.

ALWAYS respond in this exact structured format:

1. Key Findings:
   - [Finding about sales/revenue/growth trends]
   - [Finding about performance patterns]
   - [Finding about data quality or completeness]

2. Business Problems Identified:
   - [Specific issue with evidence from data]
   - [Root cause analysis]

3. Strategic Recommendations:
   - [Actionable step 1 with rationale]
   - [Actionable step 2 with rationale]
   - [Optimization or cost-saving strategy]

4. Growth Opportunities:
   - [Market or segment opportunity]
   - [Untapped potential area]

5. Risk Analysis:
   - [Risk 1 with likelihood and impact]
   - [Mitigation strategy]

6. Executive Summary:
   [2-3 sentence high-level conclusion for C-suite decision makers]

Rules:
- Be specific — reference actual column names and data values
- Think like a McKinsey consultant
- Base every recommendation on the actual dataset provided
- Include KPI impact, owner, timeline, and priority when recommending actions.
- Cover at least 5 findings, 5 recommendations, 3 risks, 3 opportunities, and 5 next actions when data exists.
- Think like a senior data analyst preparing an executive business review.
""".strip()

AI_INSIGHTS_SYSTEM_PROMPT = """You are an industry-level AI-Powered Data Intelligence Engine and senior data scientist.

The user has uploaded a dataset. Generate DEEP AI-LEVEL INSIGHTS — patterns, anomalies, predictions, and correlations.

ALWAYS respond in this exact structured format:

1. Pattern Recognition:
   - [Hidden trend or seasonality detected]
   - [Anomaly or outlier observation]
   - [Distribution insight]

2. Predictive Insights:
   - [Near-term forecast based on observed trends]
   - [Likely future outcome with confidence reasoning]

3. Customer / Segment Intelligence:
   - [Behavioral cluster or cohort insight]
   - [Retention or churn signal]

4. Performance Drivers:
   - [Top driver of growth/decline with evidence]
   - [Feature correlation finding]

5. Advanced AI Observations:
   - [Non-obvious cross-variable correlation]
   - [Statistical anomaly worth investigating]

6. Smart AI Suggestions:
   - [Data-backed decision recommendation]
   - [Model or analytics action to take next]

7. Insight Summary:
   [High-level AI conclusion in 2-3 sentences]

Rules:
- Think like a data scientist + ML engineer
- Reference specific column names and actual values from the data
- Identify non-obvious patterns from the provided dataset
- Include confidence, business impact, and next analytical action for major insights
- Cover patterns, anomalies, drivers, predictive signals, segment intelligence, and monitoring suggestions
""".strip()

DECISION_MAKING_SYSTEM_PROMPT = """You are an industry-level AI Decision Engine, Business Strategy Advisor, and senior data analyst.

Your job is NOT just to analyze data — but to GIVE CLEAR DECISIONS on what should be DONE.

========================
OUTPUT FORMAT (STRICT - JSON ONLY)
==================================
You MUST return ONLY a valid JSON object. Do not include any text before or after the JSON.
{
  "top_decisions": [
    {
      "decision": "clear action",
      "reason": "data-based reason",
      "expected_outcome": "outcome",
      "priority": "High | Medium | Low"
    }
  ],
  "inventory_decisions": [
    {
      "category": "Increase | Maintain | Reduce | Remove",
      "entities": "Products, segments, teams, regions, resources, or metrics affected",
      "action": "Specific action and reason"
    }
  ],
  "growth_opportunities": [
    { "area": "Where to invest more?", "action": "What to scale?" }
  ],
  "losses_problems": [
    { "problem": "What is causing loss or inefficiency?", "fix": "Which areas need fixing?" }
  ],
  "key_insights": [
    "Important patterns only (no long explanation)"
  ],
  "future_strategy": [
    { "prediction": "What will likely happen next?", "preparation": "What should be prepared in advance?" }
  ],
  "smart_actions": [
    "Automation ideas, Optimization steps, Process improvements"
  ]
}

Rules:
- Return at least 5 top decisions and 5 smart actions when dataset context exists.
- Every decision should include dataset evidence, business impact, priority, and action language.
- Use concrete action verbs: Scale, Invest, Fix, Reduce, Remove, Automate, Monitor, Investigate.
- Avoid generic decisions. If evidence is weak, state what data is needed.
""".strip()

SYSTEM_PROMPTS = {
    "chat": CHAT_SYSTEM_PROMPT,
    "ai_insights": AI_INSIGHTS_SYSTEM_PROMPT,
    "recommendation_insights": RECOMMENDATION_SYSTEM_PROMPT,
    "decision_making": DECISION_MAKING_SYSTEM_PROMPT,
}


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    mode: Optional[str] = None
    source: Optional[str] = "chatbot"


# ─── Dataset Context Builder ──────────────────────────────────────────────────

def _build_csv_context(session, max_rows: int = 1000) -> str:
    """
    Build comprehensive context from the session's dataset for reproduction-grade analysis.
    Provides full dataset information with statistics, distributions, and sample data.
    """
    try:
        import pandas as pd
        import numpy as np

        df = None

        # Try in-memory DataFrame first
        if session.df is not None and not session.df.empty:
            df = session.df
        elif session.dataset_snapshot:
            # Reconstruct from snapshot columns info if df not in memory
            pass

        if df is None or df.empty:
            return ""

        total_rows = len(df)
        total_cols = len(df.columns)
        col_types = {str(c): str(t) for c, t in df.dtypes.items()}
        
        # Build comprehensive dataset info
        context_lines = [
            f"Dataset: {session.dataset_name or 'Uploaded Dataset'}",
            f"Total rows: {total_rows:,} | Total columns: {total_cols}",
            f"Memory usage: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB",
            f"Column types: {col_types}",
            ""
        ]
        
        # Add missing data analysis
        missing_data = df.isnull().sum()
        if missing_data.sum() > 0:
            context_lines.append("Missing data analysis:")
            for col, missing_count in missing_data[missing_data > 0].items():
                missing_pct = (missing_count / total_rows) * 100
                context_lines.append(f"  {col}: {missing_count:,} ({missing_pct:.1f}%)")
            context_lines.append("")
        
        # Add numeric column statistics
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            context_lines.append("Numeric columns statistics:")
            for col in numeric_cols[:10]:  # Limit to first 10 numeric columns
                series = df[col]
                context_lines.append(f"  {col}:")
                context_lines.append(f"    Mean: {series.mean():.4f}")
                context_lines.append(f"    Std: {series.std():.4f}")
                context_lines.append(f"    Min: {series.min():.4f}")
                context_lines.append(f"    Max: {series.max():.4f}")
                context_lines.append(f"    Median: {series.median():.4f}")
                context_lines.append(f"    Skewness: {series.skew():.4f}")
                context_lines.append(f"    Kurtosis: {series.kurtosis():.4f}")
            context_lines.append("")
        
        # Add categorical column distributions
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        if cat_cols:
            context_lines.append("Categorical columns distributions:")
            for col in cat_cols[:8]:  # Limit to first 8 categorical columns
                value_counts = df[col].value_counts()
                context_lines.append(f"  {col}: {len(value_counts)} unique values")
                for value, count in value_counts.head(5).items():
                    pct = (count / total_rows) * 100
                    context_lines.append(f"    {value}: {count:,} ({pct:.1f}%)")
            context_lines.append("")
        
        # Add correlation analysis for numeric columns
        if len(numeric_cols) >= 2:
            context_lines.append("Correlation analysis (top 10 correlations):")
            corr_matrix = df[numeric_cols].corr()
            high_corr_pairs = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if not np.isnan(corr_val):
                        high_corr_pairs.append({
                            'col1': corr_matrix.columns[i],
                            'col2': corr_matrix.columns[j],
                            'correlation': round(corr_val, 3)
                        })
            high_corr_pairs.sort(key=lambda x: abs(x['correlation']), reverse=True)
            for pair in high_corr_pairs[:10]:
                context_lines.append(f"  {pair['col1']} - {pair['col2']}: {pair['correlation']}")
            context_lines.append("")
        
        # Add sample data with proper formatting
        sample_rows = min(max_rows, total_rows)
        context_lines.append(f"Sample data (first {sample_rows} rows in CSV format):")
        
        # convert Categoricals to str to ensure safe serialization
        sample = df.head(sample_rows).copy()
        for col in sample.columns:
            try:
                if hasattr(sample[col], "cat"):
                    sample[col] = sample[col].astype(str)
                elif sample[col].dtype == 'object':
                    sample[col] = sample[col].astype(str)
            except Exception:
                sample[col] = sample[col].astype(str)
        
        csv_text = sample.fillna("N/A").to_csv(index=False)
        context_lines.append(csv_text)
        
        return "\n".join(context_lines)
        
    except Exception as exc:
        log.warning("_build_csv_context: failed: %s", exc)
        return ""


def _build_stats_context(session) -> str:
    """
    Build comprehensive stats summary for reproduction-grade analysis.
    Includes advanced statistics, data quality assessment, and working condition validation.
    """
    try:
        import pandas as pd
        import numpy as np
        from scipy import stats

        df = session.df
        if df is None or df.empty:
            return ""

        total_rows = len(df)
        total_cols = len(df.columns)
        
        lines = [
            f"COMPREHENSIVE DATASET ANALYSIS FOR REPRODUCTION-GRADE INSIGHTS",
            f"Dataset: {session.dataset_name or 'Dataset'}",
            f"Dimensions: {total_rows:,} rows × {total_cols} columns",
            f"Memory: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB",
            f"Columns: {', '.join(str(c) for c in df.columns)}",
            ""
        ]
        
        # Data Quality Assessment
        lines.append("DATA QUALITY ASSESSMENT:")
        missing_data = df.isnull().sum()
        total_missing = missing_data.sum()
        missing_pct = (total_missing / (total_rows * total_cols)) * 100
        
        lines.append(f"  Overall completeness: {(100 - missing_pct):.2f}%")
        lines.append(f"  Total missing values: {total_missing:,}")
        
        # Column-specific quality
        complete_cols = (missing_data == 0).sum()
        lines.append(f"  Complete columns: {complete_cols}/{total_cols}")
        
        # Duplicate analysis
        duplicate_rows = df.duplicated().sum()
        duplicate_pct = (duplicate_rows / total_rows) * 100
        lines.append(f"  Duplicate rows: {duplicate_rows:,} ({duplicate_pct:.2f}%)")
        lines.append("")
        
        # Advanced Numeric Analysis
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if numeric_cols:
            lines.append("ADVANCED NUMERIC ANALYSIS:")
            for col in numeric_cols[:12]:  # Analyze up to 12 numeric columns
                series = df[col].dropna()
                if len(series) == 0:
                    continue
                    
                lines.append(f"  {col}:")
                
                # Basic statistics
                lines.append(f"    Count: {len(series):,}")
                lines.append(f"    Mean: {series.mean():.6f}")
                lines.append(f"    Std Dev: {series.std():.6f}")
                lines.append(f"    Min/Max: {series.min():.6f} / {series.max():.6f}")
                lines.append(f"    Median: {series.median():.6f}")
                lines.append(f"    25th/75th percentile: {series.quantile(0.25):.6f} / {series.quantile(0.75):.6f}")
                
                # Distribution characteristics
                skewness = series.skew()
                kurtosis = series.kurtosis()
                lines.append(f"    Skewness: {skewness:.4f} ({'Right-skewed' if skewness > 0.5 else 'Left-skewed' if skewness < -0.5 else 'Normal'})")
                lines.append(f"    Kurtosis: {kurtosis:.4f} ({'Heavy-tailed' if kurtosis > 3 else 'Light-tailed' if kurtosis < -3 else 'Normal'})")
                
                # Outlier detection using IQR method
                Q1 = series.quantile(0.25)
                Q3 = series.quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                outliers = series[(series < lower_bound) | (series > upper_bound)]
                outlier_pct = (len(outliers) / len(series)) * 100
                lines.append(f"    Outliers: {len(outliers):,} ({outlier_pct:.2f}% using IQR method)")
                
                # Coefficient of variation
                cv = (series.std() / series.mean()) * 100 if series.mean() != 0 else float('inf')
                lines.append(f"    Coefficient of Variation: {cv:.2f}% ({'High variability' if cv > 30 else 'Moderate' if cv > 15 else 'Low'})")
                
                # Normality test (if enough data)
                if len(series) >= 8:
                    try:
                        shapiro_stat, shapiro_p = stats.shapiro(series[:5000])  # Limit for performance
                        lines.append(f"    Normality test (Shapiro-Wilk): p={shapiro_p:.6f} ({'Normal' if shapiro_p > 0.05 else 'Not normal'})")
                    except:
                        lines.append(f"    Normality test: Unable to compute")
                
                lines.append("")
        
        # Categorical Analysis
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        if cat_cols:
            lines.append("CATEGORICAL ANALYSIS:")
            for col in cat_cols[:8]:  # Analyze up to 8 categorical columns
                value_counts = df[col].value_counts(dropna=False)
                unique_count = len(value_counts)
                missing_count = value_counts.get(np.nan if np.nan in value_counts.index else 'NaN', 0)
                valid_count = total_rows - missing_count
                
                lines.append(f"  {col}:")
                lines.append(f"    Unique values: {unique_count:,}")
                lines.append(f"    Cardinality ratio: {(unique_count / valid_count):.4f} ({'High' if unique_count / valid_count > 0.5 else 'Medium' if unique_count / valid_count > 0.1 else 'Low'})")
                lines.append(f"    Missing: {missing_count:,} ({(missing_count/total_rows)*100:.2f}%)")
                
                # Top values
                lines.append(f"    Top 5 values:")
                for value, count in value_counts.head(5).items():
                    pct = (count / total_rows) * 100
                    lines.append(f"      {value}: {count:,} ({pct:.1f}%)")
                
                # Entropy (measure of diversity)
                if valid_count > 0:
                    probabilities = value_counts[~value_counts.index.isin([np.nan, 'NaN', None])] / valid_count
                    entropy = -np.sum(probabilities * np.log2(probabilities))
                    max_entropy = np.log2(min(unique_count, valid_count))
                    entropy_ratio = entropy / max_entropy if max_entropy > 0 else 0
                    lines.append(f"    Entropy: {entropy:.4f} ({entropy_ratio:.2f} of max possible)")
                
                lines.append("")
        
        # Correlation Matrix Analysis
        if len(numeric_cols) >= 2:
            lines.append("CORRELATION ANALYSIS:")
            corr_matrix = df[numeric_cols].corr()
            
            # Find strongest correlations
            correlations = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i+1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if not np.isnan(corr_val):
                        correlations.append({
                            'col1': corr_matrix.columns[i],
                            'col2': corr_matrix.columns[j],
                            'correlation': corr_val,
                            'abs_correlation': abs(corr_val)
                        })
            
            correlations.sort(key=lambda x: x['abs_correlation'], reverse=True)
            
            lines.append(f"  Strongest correlations:")
            for corr in correlations[:15]:
                strength = "Very Strong" if abs(corr['correlation']) > 0.8 else "Strong" if abs(corr['correlation']) > 0.6 else "Moderate" if abs(corr['correlation']) > 0.4 else "Weak"
                lines.append(f"    {corr['col1']} - {corr['col2']}: {corr['correlation']:.4f} ({strength})")
            
            # Multicollinearity check
            high_corr_pairs = [c for c in correlations if abs(c['correlation']) > 0.8]
            if high_corr_pairs:
                lines.append(f"  Multicollinearity warning: {len(high_corr_pairs)} pairs with |r| > 0.8")
            else:
                lines.append(f"  Multicollinearity: No significant correlations detected")
            
            lines.append("")
        
        # Time Series Analysis (if date columns exist)
        date_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
        if date_cols:
            lines.append("TIME SERIES ANALYSIS:")
            for col in date_cols[:3]:  # Analyze up to 3 date columns
                dates = pd.to_datetime(df[col], errors='coerce').dropna()
                if len(dates) > 0:
                    lines.append(f"  {col}:")
                    lines.append(f"    Date range: {dates.min()} to {dates.max()}")
                    lines.append(f"    Span: {(dates.max() - dates.min()).days} days")
                    lines.append(f"    Missing dates: {len(df[col]) - len(dates)} ({(len(df[col]) - len(dates))/len(df[col])*100:.1f}%)")
                    
                    # Check for regular intervals
                    if len(dates) > 1:
                        intervals = dates.diff().dropna()
                        lines.append(f"    Average interval: {intervals.mean().days:.1f} days")
                        lines.append(f"    Interval std: {intervals.std().days:.1f} days")
                
                lines.append("")
        
        # Sample data for context
        sample_size = min(100, total_rows)
        lines.append(f"SAMPLE DATA ({sample_size} rows for context):")
        sample = df.head(sample_size).copy()
        
        # Convert all to string for safe serialization
        for col in sample.columns:
            try:
                if hasattr(sample[col], "cat"):
                    sample[col] = sample[col].astype(str)
                elif sample[col].dtype == 'datetime64[ns]':
                    sample[col] = sample[col].dt.strftime('%Y-%m-%d %H:%M:%S')
                elif sample[col].dtype == 'object' or hasattr(sample[col], "cat"):
                    sample[col] = sample[col].astype(str)
                else:
                    sample[col] = sample[col].astype(str)
            except Exception:
                sample[col] = sample[col].astype(str)
        
        lines.append(sample.fillna("N/A").to_csv(index=False))
        
        return "\n".join(lines)
        
    except Exception as exc:
        log.warning("_build_stats_context: failed: %s", exc)
        return ""


def _normalize_identifier(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _summarize_columns(columns, limit: int = 20) -> str:
    names = [str(column) for column in columns]
    if len(names) <= limit:
        return ", ".join(names)
    return f"{', '.join(names[:limit])}, ... (+{len(names) - limit} more)"


def _select_relevant_columns(df, prompt: str, *, limit: int) -> list[str]:
    prompt_lower = str(prompt or "").lower()
    prompt_normalized = _normalize_identifier(prompt)
    prompt_tokens = set(re.findall(r"[a-z0-9]+", prompt_lower))
    columns = [str(column) for column in df.columns]
    scored: list[tuple[int, str]] = []

    for column in columns:
        normalized = _normalize_identifier(column)
        tokens = re.findall(r"[a-z0-9]+", column.lower().replace("_", " ").replace("-", " "))
        score = 0

        if normalized and normalized in prompt_normalized:
            score += 24

        overlap = sum(1 for token in tokens if token in prompt_tokens)
        if overlap:
            score += overlap * 8
            if overlap == len(set(tokens)):
                score += 6

        if score:
            scored.append((score, column))

    ordered = [column for _, column in sorted(scored, key=lambda item: (-item[0], item[1]))]
    selected: list[str] = []
    for column in ordered + columns:
        if column in selected:
            continue
        selected.append(column)
        if len(selected) >= min(limit, len(columns)):
            break
    return selected


def _prepare_sample_frame(df):
    sample = df.copy()
    for column in sample.columns:
        try:
            sample[column] = sample[column].astype(str)
        except Exception:
            sample[column] = sample[column].map(lambda value: str(value))
    return sample.fillna("N/A")


def _csv_with_char_limit(df, max_chars: int) -> str:
    if df.empty:
        return ""

    csv_lines = _prepare_sample_frame(df).to_csv(index=False).splitlines()
    if not csv_lines:
        return ""

    output = [csv_lines[0]]
    current_len = len(output[0]) + 1
    included_rows = 0

    for line in csv_lines[1:]:
        next_len = len(line) + 1
        if included_rows and current_len + next_len > max_chars:
            break
        output.append(line)
        current_len += next_len
        included_rows += 1

    remaining_rows = max(0, len(csv_lines) - 1 - included_rows)
    if remaining_rows:
        output.append(f"... truncated {remaining_rows} more rows")

    return "\n".join(output)


def _analysis_sample_frame(df, max_rows: int = ANALYSIS_SAMPLE_ROWS):
    if df is None or df.empty:
        return df
    return df.head(min(len(df), max_rows)).copy()


def _session_columns(session) -> list[str]:
    if session.df is not None and not session.df.empty:
        return [str(column) for column in session.df.columns.tolist()]
    if session.dataset_columns:
        return [str(column) for column in session.dataset_columns]

    snapshot = session.dataset_snapshot or {}
    columns_info = snapshot.get("columns_info") or []
    if columns_info:
        columns = [str(item.get("column")) for item in columns_info if item.get("column")]
        if columns:
            return columns

    for key in ("all_columns", "columns"):
        raw_columns = snapshot.get(key) or []
        if raw_columns:
            return [str(column) for column in raw_columns]
    return []


def _match_question_columns(question: str, columns: list[str], limit: int = 4) -> list[str]:
    prompt_lower = str(question or "").lower()
    prompt_normalized = _normalize_identifier(question)
    prompt_tokens = set(re.findall(r"[a-z0-9]+", prompt_lower))
    scored: list[tuple[int, str]] = []

    for column in columns:
        normalized = _normalize_identifier(column)
        tokens = re.findall(r"[a-z0-9]+", str(column).lower().replace("_", " ").replace("-", " "))
        score = 0

        if normalized and normalized in prompt_normalized:
            score += 24

        overlap = sum(1 for token in tokens if token in prompt_tokens)
        if overlap:
            score += overlap * 8
            if overlap == len(set(tokens)):
                score += 6

        if score:
            scored.append((score, str(column)))

    return [column for _, column in sorted(scored, key=lambda item: (-item[0], item[1]))[:limit]]


def _sanitize_answer_text(content: str) -> str:
    lines = str(content or "").splitlines()
    while lines and re.match(r'^\s*MODE\s*:\s*["\']?.+["\']?\s*$', lines[0].strip(), re.IGNORECASE):
        lines.pop(0)
    while lines and not lines[0].strip():
        lines.pop(0)
    return "\n".join(lines).strip()


def _format_cell_value(value) -> str:
    try:
        import pandas as pd
        if pd.isna(value):
            return "N/A"
    except Exception:
        if value is None:
            return "N/A"
    if isinstance(value, float):
        return f"{value:,.4f}".rstrip("0").rstrip(".")
    if isinstance(value, int):
        return f"{value:,}"
    return str(value)


def _extract_lookup_values(message: str, columns: list[str]) -> list[str]:
    text = str(message or "")
    values: list[str] = []

    for pattern in (r"`([^`]+)`", r"'([^']+)'", r'"([^"]+)"'):
        values.extend(match.strip() for match in re.findall(pattern, text) if match.strip())

    for column in columns:
        column_pattern = re.escape(str(column))
        for match in re.finditer(column_pattern + r"\s*(?:=|is|:)?\s*([A-Za-z0-9_.-]+)", text, re.IGNORECASE):
            candidate = match.group(1).strip()
            if candidate and _normalize_identifier(candidate) != _normalize_identifier(column):
                values.append(candidate)

    # Capture standalone IDs such as 1025 or SKU-1025, but skip tiny words.
    for token in re.findall(r"\b[A-Za-z]{1,12}[-_]\d+[A-Za-z0-9_.-]*\b|\b\d+(?:\.\d+)?\b", text):
        values.append(token.strip())

    deduped: list[str] = []
    seen = set()
    for value in values:
        key = value.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(value)
    return deduped[:6]


def _is_id_like_column(column: str) -> bool:
    lowered = str(column).lower()
    return any(token in lowered for token in ("id", "code", "sku", "product", "item", "order", "customer"))


def _find_exact_rows(df, message: str, matched_columns: list[str]) -> tuple[str | None, str | None, object | None]:
    columns = [str(column) for column in df.columns]
    lookup_values = _extract_lookup_values(message, columns)
    if not lookup_values:
        return None, None, None

    candidate_columns: list[str] = []
    for column in matched_columns:
        if column in columns and column not in candidate_columns:
            candidate_columns.append(column)
    for column in columns:
        if _is_id_like_column(column) and column not in candidate_columns:
            candidate_columns.append(column)
    for column in columns:
        if column not in candidate_columns:
            candidate_columns.append(column)

    for value in lookup_values:
        normalized_value = str(value).strip().lower()
        numeric_value = None
        try:
            numeric_value = float(str(value).replace(",", ""))
        except Exception:
            numeric_value = None

        for column in candidate_columns:
            series = df[column]
            try:
                mask = series.astype(str).str.strip().str.lower().eq(normalized_value)
            except Exception:
                continue

            if numeric_value is not None:
                try:
                    numeric_series = series.astype(float)
                    mask = mask | numeric_series.eq(numeric_value)
                except Exception:
                    pass

            matches = df.loc[mask]
            if not matches.empty:
                return column, value, matches
    return None, None, None


def _row_detail_response(df, column: str, value: str, matches) -> str:
    total_matches = len(matches)
    shown = matches.head(5)
    lines = [
        f"Found {total_matches:,} matching row{'s' if total_matches != 1 else ''} where `{column}` = `{value}` in the full dataset.",
        "",
    ]

    for display_index, (row_index, row) in enumerate(shown.iterrows(), start=1):
        lines.append(f"Match {display_index} (dataset row index {row_index}):")
        for col in df.columns:
            lines.append(f"- `{col}`: {_format_cell_value(row[col])}")
        lines.append("")

    if total_matches > len(shown):
        lines.append(
            f"I showed the first {len(shown)} matches. There are {total_matches - len(shown):,} additional matching rows in the full dataset."
        )
    return "\n".join(lines).strip()


def _strict_chat_response(message: str, session) -> str | None:
    lower = str(message or "").strip().lower()
    if not lower:
        return None

    columns = _session_columns(session)
    total_columns = len(columns) or int(session.dataset_column_count or 0)
    total_rows = int(session.dataset_row_count or 0)
    df = session.df if session.df is not None and not session.df.empty else None

    if df is not None and total_rows <= 0:
        total_rows = len(df)
    if df is not None and total_columns <= 0:
        total_columns = len(df.columns)

    if re.search(r"\b(key columns|which columns|what columns|column names|fields|headers|schema)\b", lower):
        if not columns:
            return None
        preview = columns[:12]
        suffix = f", and {len(columns) - len(preview)} more" if len(columns) > len(preview) else ""
        return (
            f"This dataset has {total_columns:,} columns. "
            f"The columns are: {', '.join(preview)}{suffix}."
        )

    if re.search(r"\b(how many columns|number of columns|total columns)\b", lower) and total_columns:
        return f"The dataset has {total_columns:,} columns."

    if re.search(r"\b(how many|count|number of|rows)\b", lower) and total_rows:
        return f"The dataset contains {total_rows:,} rows."

    if df is None:
        return None

    matched_columns = _match_question_columns(message, columns)
    numeric_columns = [str(column) for column in df.select_dtypes(include=["number"]).columns.tolist()]
    matched_numeric = next((column for column in matched_columns if column in numeric_columns), None)

    if re.search(r"\b(detail|details|show|find|lookup|row|record|transaction|product|customer|order|sku|id)\b", lower):
        lookup_column, lookup_value, exact_matches = _find_exact_rows(df, message, matched_columns)
        if lookup_column and exact_matches is not None:
            return _row_detail_response(df, lookup_column, lookup_value or "", exact_matches)

    if re.search(r"\b(average|mean|avg)\b", lower):
        if re.search(r"\b(numeric columns|all numeric|all numbers)\b", lower) and numeric_columns:
            summary = []
            for column in numeric_columns[:5]:
                series = df[column].dropna()
                if series.empty:
                    continue
                summary.append(f"{column}: {series.mean():.2f}")
            if summary:
                return f"Average values for numeric columns: {', '.join(summary)}."
        if matched_numeric:
            series = df[matched_numeric].dropna()
            if not series.empty:
                return f"The average {matched_numeric} is {series.mean():.2f}."

    if re.search(r"\b(highest|max|maximum|largest)\b", lower) and matched_numeric:
        series = df[matched_numeric].dropna()
        if not series.empty:
            return f"The highest {matched_numeric} value is {series.max():.2f}."

    if re.search(r"\b(lowest|min|minimum|smallest)\b", lower) and matched_numeric:
        series = df[matched_numeric].dropna()
        if not series.empty:
            return f"The lowest {matched_numeric} value is {series.min():.2f}."

    return None


def _build_compact_csv_context(
    session,
    message: str,
    *,
    max_rows: int = CHAT_CONTEXT_MAX_ROWS,
    max_columns: int = CHAT_CONTEXT_MAX_COLUMNS,
    max_chars: int = CHAT_CONTEXT_MAX_CHARS,
) -> str:
    """Build a compact question-aware dataset snapshot for fast chat replies."""
    try:
        import numpy as np
        from pandas.api.types import is_numeric_dtype

        df = None
        if session.df is not None and not session.df.empty:
            df = session.df

        if df is None or df.empty:
            return ""

        analysis_frame = _analysis_sample_frame(df)
        total_rows = len(df)
        total_cols = len(df.columns)
        selected_columns = _select_relevant_columns(analysis_frame, message, limit=max_columns)
        selected_frame = analysis_frame.loc[:, selected_columns].head(min(max_rows, len(analysis_frame))).copy()
        numeric_cols = [
            column for column in selected_columns
            if column in analysis_frame.columns and is_numeric_dtype(analysis_frame[column])
        ][:SUMMARY_NUMERIC_LIMIT]
        categorical_cols = [
            column for column in selected_columns if column not in numeric_cols
        ][:SUMMARY_CATEGORICAL_LIMIT]

        context_lines = [
            f"Dataset: {session.dataset_name or 'Uploaded Dataset'}",
            f"Rows: {total_rows:,} | Columns: {total_cols}",
            f"Analysis sample used for broad statistics: first {len(analysis_frame):,} rows",
            f"Relevant columns for this question: {', '.join(selected_columns)}",
            f"Column overview: {_summarize_columns(analysis_frame.columns)}",
            "",
        ]

        lookup_column, lookup_value, exact_matches = _find_exact_rows(df, message, selected_columns)
        if lookup_column and exact_matches is not None:
            context_lines.extend([
                "FULL-DATASET EXACT MATCHES FOR THIS QUESTION:",
                f"Matched `{lookup_column}` = `{lookup_value}` across the full {total_rows:,}-row dataset.",
                f"Matching row count: {len(exact_matches):,}",
                _csv_with_char_limit(exact_matches.head(8), max_chars),
                "",
            ])

        missing_data = analysis_frame[selected_columns].isnull().sum()
        if missing_data.sum() > 0:
            context_lines.append("Missing values in relevant columns:")
            for column, missing_count in missing_data[missing_data > 0].head(6).items():
                missing_pct = (missing_count / max(1, len(analysis_frame))) * 100
                context_lines.append(f"  {column}: {missing_count:,} ({missing_pct:.1f}%)")
            context_lines.append("")

        if numeric_cols:
            context_lines.append("Relevant numeric summary:")
            for column in numeric_cols:
                series = analysis_frame[column].dropna()
                if series.empty:
                    continue
                context_lines.append(
                    f"  {column}: mean={series.mean():.3f}, median={series.median():.3f}, "
                    f"min={series.min():.3f}, max={series.max():.3f}"
                )
            context_lines.append("")

        if categorical_cols:
            context_lines.append("Relevant categorical summary:")
            for column in categorical_cols:
                counts = analysis_frame[column].astype(str).value_counts(dropna=False).head(3)
                breakdown = ", ".join(f"{value} ({count:,})" for value, count in counts.items())
                context_lines.append(f"  {column}: {breakdown}")
            context_lines.append("")

        if len(numeric_cols) >= 2:
            context_lines.append("Top correlations from relevant numeric columns:")
            corr_matrix = analysis_frame[numeric_cols].corr()
            pairs = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if np.isnan(corr_val):
                        continue
                    pairs.append((abs(corr_val), corr_matrix.columns[i], corr_matrix.columns[j], corr_val))
            for _, col1, col2, corr_val in sorted(pairs, reverse=True)[:SUMMARY_CORRELATION_LIMIT]:
                context_lines.append(f"  {col1} - {col2}: {corr_val:.3f}")
            context_lines.append("")

        context_lines.append(
            f"Sample rows for relevant columns (broad context only, up to {min(max_rows, total_rows)} rows, CSV):"
        )
        context_lines.append(_csv_with_char_limit(selected_frame, max_chars))
        return "\n".join(context_lines)

    except Exception as exc:
        log.warning("_build_compact_csv_context: failed: %s", exc)
        return ""


def _build_compact_stats_context(
    session,
    message: str,
    *,
    max_rows: int = INSIGHT_CONTEXT_MAX_ROWS,
    max_columns: int = INSIGHT_CONTEXT_MAX_COLUMNS,
    max_chars: int = INSIGHT_CONTEXT_MAX_CHARS,
) -> str:
    """Build a concise dataset summary for insight and recommendation modes."""
    try:
        import pandas as pd
        import numpy as np

        df = session.df
        if df is None or df.empty:
            return ""

        analysis_frame = _analysis_sample_frame(df)
        total_rows = len(df)
        total_cols = len(df.columns)
        selected_columns = _select_relevant_columns(analysis_frame, message, limit=max_columns)
        selected_frame = analysis_frame.loc[:, selected_columns].head(min(max_rows, len(analysis_frame))).copy()
        numeric_cols = analysis_frame.select_dtypes(include=[np.number]).columns.tolist()
        focus_numeric_cols = [
            column for column in selected_columns if column in numeric_cols
        ] or numeric_cols[:SUMMARY_NUMERIC_LIMIT]
        focus_numeric_cols = focus_numeric_cols[:SUMMARY_NUMERIC_LIMIT]
        focus_categorical_cols = [
            column for column in selected_columns if column not in focus_numeric_cols
        ][:SUMMARY_CATEGORICAL_LIMIT]
        datetime_cols = analysis_frame.select_dtypes(include=["datetime64[ns]", "datetime64"]).columns.tolist()[:2]

        missing_data = analysis_frame.isnull().sum()
        total_missing = int(missing_data.sum())
        missing_pct = (total_missing / max(1, len(analysis_frame) * total_cols)) * 100
        duplicate_rows = int(analysis_frame.duplicated().sum())

        lines = [
            f"Dataset: {session.dataset_name or 'Dataset'}",
            f"Dimensions: {total_rows:,} rows x {total_cols} columns",
            f"Analysis sample used for speed: first {len(analysis_frame):,} rows",
            f"Column overview: {_summarize_columns(analysis_frame.columns)}",
            f"Missing cells: {total_missing:,} ({missing_pct:.2f}%) | Duplicate rows: {duplicate_rows:,}",
            f"Highlighted columns for this request: {', '.join(selected_columns)}",
            "",
        ]

        if focus_numeric_cols:
            lines.append("Numeric highlights:")
            for column in focus_numeric_cols:
                series = analysis_frame[column].dropna()
                if series.empty:
                    continue
                q1 = series.quantile(0.25)
                q3 = series.quantile(0.75)
                iqr = q3 - q1
                outliers = series[(series < (q1 - 1.5 * iqr)) | (series > (q3 + 1.5 * iqr))]
                lines.append(
                    f"  {column}: mean={series.mean():.3f}, median={series.median():.3f}, "
                    f"p25={q1:.3f}, p75={q3:.3f}, outliers={len(outliers):,}"
                )
            lines.append("")

        if focus_categorical_cols:
            lines.append("Categorical highlights:")
            for column in focus_categorical_cols:
                counts = analysis_frame[column].astype(str).value_counts(dropna=False).head(3)
                breakdown = ", ".join(f"{value} ({count:,})" for value, count in counts.items())
                lines.append(f"  {column}: {breakdown}")
            lines.append("")

        if len(focus_numeric_cols) >= 2:
            lines.append("Top correlations:")
            corr_matrix = analysis_frame[focus_numeric_cols].corr()
            pairs = []
            for i in range(len(corr_matrix.columns)):
                for j in range(i + 1, len(corr_matrix.columns)):
                    corr_val = corr_matrix.iloc[i, j]
                    if np.isnan(corr_val):
                        continue
                    pairs.append((abs(corr_val), corr_matrix.columns[i], corr_matrix.columns[j], corr_val))
            for _, col1, col2, corr_val in sorted(pairs, reverse=True)[:SUMMARY_CORRELATION_LIMIT]:
                lines.append(f"  {col1} - {col2}: {corr_val:.3f}")
            lines.append("")

        if datetime_cols:
            lines.append("Date coverage:")
            for column in datetime_cols:
                dates = pd.to_datetime(analysis_frame[column], errors="coerce").dropna()
                if dates.empty:
                    continue
                lines.append(f"  {column}: {dates.min()} to {dates.max()}")
            lines.append("")

        lines.append(
            f"Sample rows for highlighted columns (up to {min(max_rows, total_rows)} rows, CSV):"
        )
        lines.append(_csv_with_char_limit(selected_frame, max_chars))
        return "\n".join(lines)

    except Exception as exc:
        log.warning("_build_compact_stats_context: failed: %s", exc)
        return ""


def _ensure_dataset_in_session(session, session_id: str, document) -> bool:
    """Ensure session has live DataFrame."""
    if has_live_dataset(session):
        return True
    if document is not None:
        return restore_live_dataset(session, session_id, document)
    return False


# ─── Core LLM caller ─────────────────────────────────────────────────────────

async def _call_groq_with_dataset(
    message: str,
    mode: str,
    session_id: str,
) -> dict:
    """
    The MAIN chat function.

    Sends: system_prompt + dataset CSV + user question → Groq.
    This matches exactly what the original standalone chatbot did.
    """
    session = store.get(session_id)
    llm_meta = get_active_llm_summary()
    document = await get_dataset(session_id)
    _ensure_dataset_in_session(session, session_id, document)
    dataset_signature = (
        session.dataset_name or "",
        session.dataset_row_count,
        session.dataset_column_count,
    )
    cache_key = (CHAT_CACHE_VERSION, mode, message.strip().lower(), dataset_signature)
    cached_response = session.chat_cache.get(cache_key)
    if cached_response:
        return cached_response

    if mode == "chat":
        strict_answer = _strict_chat_response(message, session)
        if strict_answer:
            payload = {
                "answer": strict_answer,
                "mode": mode,
                "source": "strict_local",
                "provider": "local",
                "model": "local_dataset_rules",
                "dataset_available": bool(_session_columns(session)),
            }
            session.chat_cache[cache_key] = payload
            return payload

    # Build compact context so Groq receives a much smaller prompt.
    if mode == "chat":
        dataset_context = _build_compact_csv_context(session, message)
    else:
        dataset_context = _build_compact_stats_context(session, message)

    has_data = bool(dataset_context)

    # Build the user prompt — exactly like the original app
    if has_data:
        user_content = (
            f"DATASET INFORMATION:\n{dataset_context}\n\n"
            f"USER QUESTION:\n{message}\n\n"
            f"Answer based strictly on the dataset above. "
            f"Use the actual column names and values. "
            f"Keep the reply concise unless the user explicitly asks for detail."
        )
    else:
        user_content = (
            f"No dataset is currently loaded.\n\n"
            f"USER QUESTION:\n{message}\n\n"
            f"Answer helpfully and suggest the user upload a dataset for data-specific questions."
        )

    system_prompt = SYSTEM_PROMPTS.get(mode, CHAT_SYSTEM_PROMPT)
    groq_messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    # Token budget
    max_tokens_map = {
        "recommendation_insights": 5000,
        "ai_insights": 5000,
        "decision_making": 4500,
        "chat": 1200,
    }
    retry_map = {
        "recommendation_insights": 0,
        "ai_insights": 0,
        "decision_making": 0,
        "chat": 0,
    }
    temperature_map = {
        "recommendation_insights": 0.3,
        "ai_insights": 0.4,
        "decision_making": 0.2,
        "chat": 0.1,  # Low temp for factual accuracy
    }

    if not has_groq_config():
        # Local fallback
        try:
            result = generate_mode_response_from_session(
                mode=mode,
                user_prompt=message,
                session=session,
            )
            return {
                "answer": _sanitize_answer_text(result.get("content", _mode_fallback_message(mode))),
                "mode": mode,
                "source": "local_fallback",
                "provider": "local",
                "dataset_available": has_data,
            }
        except Exception as exc:
            log.error("_call_groq_with_dataset: local fallback failed: %s", exc)
            return {
                "answer": _mode_fallback_message(mode),
                "mode": mode,
                "source": "error",
                "provider": "local",
                "dataset_available": False,
            }

    try:
        content = groq_chat(
            groq_messages,
            max_tokens=max_tokens_map.get(mode, 1000),
            temperature=temperature_map.get(mode, 0.2),
            retries=retry_map.get(mode, 1),
        )
        payload = {
            "answer": _sanitize_answer_text(content or _mode_fallback_message(mode)),
            "mode": mode,
            "source": str(llm_meta.get("provider") or "openai"),
            "provider": str(llm_meta.get("provider") or "openai"),
            "model": str(llm_meta.get("model") or "gpt-4o"),
            "dataset_available": has_data,
        }
        session.chat_cache[cache_key] = payload
        if len(session.chat_cache) > 100:
            oldest_key = next(iter(session.chat_cache))
            session.chat_cache.pop(oldest_key, None)
        return payload
    except Exception as exc:
        log.error("_call_groq_with_dataset: OpenAI failed for mode=%s: %s", mode, exc)
        api_error_msg = (
            f"\u26a0\ufe0f **Eighteen AI (OpenAI) could not respond.**\n\n"
            f"Error: `{exc}`\n\n"
            "Please check:\n"
            "- `OPEN_AI_KEY` in `server/.env` is a valid OpenAI API key\n"
            "- You have sufficient OpenAI API credits\n"
            f"- Model `{llm_meta.get('model') or 'gpt-4o-mini'}` is available on your plan\n\n"
            "Restart the backend after updating `.env`."
        )
        return {
            "answer": api_error_msg,
            "mode": mode,
            "source": "api_error",
            "provider": "openai",
            "dataset_available": has_data,
            "error": str(exc),
        }


def _mode_fallback_message(mode: str) -> str:
    if mode == "recommendation_insights":
        return (
            "1. Key Findings:\n- Unable to generate insights at this time.\n\n"
            "6. Executive Summary:\n- Please ensure a dataset is uploaded and retry."
        )
    if mode == "ai_insights":
        return (
            "1. Pattern Recognition:\n- Unable to analyze patterns at this time.\n\n"
            "7. Insight Summary:\n- Please upload a dataset and retry."
        )
    if mode == "decision_making":
        return '{"top_decisions":[{"decision":"Retry later","reason":"System unavailable","expected_outcome":"N/A","priority":"Low"}]}'
    return "I'm unable to generate a response right now. Please ensure your dataset is uploaded and try again."


def _resolve_mode(requested: Optional[str], message: str) -> str:
    if requested and requested.strip().lower() in ALLOWED_MODES:
        return requested.strip().lower()
    return infer_mode_from_prompt(message, "chat")


async def _persist_chat(session_id: str, user_msg: str, answer: str) -> None:
    try:
        await save_chat_message(session_id, "user", user_msg)
        await save_chat_message(session_id, "assistant", answer)
    except Exception as exc:
        log.warning("_persist_chat: %s", exc)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(
    body: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """
    Main chat endpoint — all 3 modes.
    Always sends actual dataset CSV to Groq for accurate answers.
    """
    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    await require_ai_feature("chatbot")

    resolved_mode = _resolve_mode(body.mode, user_message)

    try:
        payload = await _call_groq_with_dataset(user_message, resolved_mode, x_session_id)
    except Exception as exc:
        log.error("chat endpoint: unhandled error: %s", exc)
        payload = {
            "answer": _mode_fallback_message(resolved_mode),
            "mode": resolved_mode,
            "source": "error",
        }

    if body.source != "page":
        await _persist_chat(x_session_id, user_message, str(payload.get("answer") or ""))
    return JSONResponse(payload)


@router.post("/chat/ai-insights")
async def chat_ai_insights(
    body: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """Dedicated AI insights endpoint — always uses ai_insights mode."""
    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        payload = await _call_groq_with_dataset(user_message, "ai_insights", x_session_id)
    except Exception as exc:
        log.error("chat_ai_insights: %s", exc)
        payload = {
            "answer": _mode_fallback_message("ai_insights"),
            "mode": "ai_insights",
            "source": "error",
        }

    if body.source != "page":
        await _persist_chat(x_session_id, user_message, str(payload.get("answer") or ""))
    return JSONResponse(payload)


@router.post("/chat/recommendations")
async def chat_recommendations(
    body: ChatRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """Dedicated recommendations endpoint — always uses recommendation_insights mode."""
    user_message = body.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    await require_ai_feature("chatbot")

    resolved_mode = _resolve_mode(body.mode, user_message)
    if resolved_mode not in {"recommendation_insights", "decision_making", "ai_insights"}:
        resolved_mode = "recommendation_insights"

    try:
        payload = await _call_groq_with_dataset(user_message, resolved_mode, x_session_id)
    except Exception as exc:
        log.error("chat_recommendations: %s", exc)
        payload = {
            "answer": _mode_fallback_message(resolved_mode),
            "mode": resolved_mode,
            "source": "error",
        }

    if body.source != "page":
        await _persist_chat(x_session_id, user_message, str(payload.get("answer") or ""))
    return JSONResponse(payload)


@router.get("/chat/history")
async def chat_history(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    try:
        history = await get_chat_history(x_session_id, limit=50)
    except Exception as exc:
        log.warning("chat_history: %s", exc)
        history = []
    return JSONResponse({"messages": history})


@router.delete("/chat/clear")
async def clear_chat(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    try:
        from app.core.database import get_db
        db = get_db()
        await db["chats"].delete_many({"session_id": x_session_id})
    except Exception as exc:
        log.warning("clear_chat: %s", exc)
    return JSONResponse({"message": "Chat history cleared."})


@router.get("/chat/modes")
async def get_supported_modes():
    llm_meta = get_active_llm_summary()
    return JSONResponse({
        "modes": [
            {"id": "chat", "label": "Chat", "description": "Dataset Q&A and AI assistant", "icon": "💬"},
            {"id": "ai_insights", "label": "AI Insights", "description": "Deep AI pattern recognition", "icon": "🧠"},
            {"id": "recommendation_insights", "label": "Recommendations", "description": "Executive business recommendations", "icon": "📊"},
            {"id": "decision_making", "label": "Decision Making", "description": "Clear business decisions and actions", "icon": "🎯"},
        ],
        "default_mode": "chat",
        "provider": llm_meta.get("provider"),
        "model": llm_meta.get("model"),
        "configured": llm_meta.get("configured"),
        "groq_configured": has_groq_config(),
    })


@router.get("/chat/dataset-health")
async def dataset_health_check(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """Comprehensive dataset health check and working condition validation."""
    try:
        import pandas as pd
        import numpy as np
        from scipy import stats
        
        session = store.get(x_session_id)
        if session.df is None or session.df.empty:
            return JSONResponse({
                "status": "no_data",
                "message": "No dataset loaded",
                "health_score": 0,
                "working_condition": "failed"
            })
        
        df = session.df
        total_rows = len(df)
        total_cols = len(df.columns)
        
        # Health assessment metrics
        health_metrics = {
            "completeness": 0,
            "consistency": 0,
            "validity": 0,
            "uniqueness": 0,
            "overall_score": 0
        }
        
        issues = []
        warnings = []
        
        # Completeness assessment
        missing_data = df.isnull().sum()
        total_missing = missing_data.sum()
        completeness = 100 - ((total_missing / (total_rows * total_cols)) * 100)
        health_metrics["completeness"] = round(completeness, 2)
        
        if completeness < 90:
            issues.append(f"Low completeness: {completeness:.1f}%")
        elif completeness < 95:
            warnings.append(f"Moderate completeness: {completeness:.1f}%")
        
        # Consistency assessment
        duplicate_rows = df.duplicated().sum()
        uniqueness = 100 - ((duplicate_rows / total_rows) * 100)
        health_metrics["uniqueness"] = round(uniqueness, 2)
        
        if uniqueness < 95:
            issues.append(f"High duplicate rate: {duplicate_rows:,} rows ({(duplicate_rows/total_rows)*100:.1f}%)")
        elif uniqueness < 98:
            warnings.append(f"Moderate duplicate rate: {duplicate_rows:,} rows")
        
        # Validity assessment
        invalid_count = 0
        for col in df.select_dtypes(include=[np.number]).columns:
            series = df[col].dropna()
            if len(series) > 0:
                # Check for impossible values (negative where shouldn't be, etc.)
                if 'age' in col.lower() or 'count' in col.lower() or 'quantity' in col.lower():
                    invalid_count += len(series[series < 0])
        
        validity = 100 - ((invalid_count / total_rows) * 100)
        health_metrics["validity"] = round(validity, 2)
        
        # Consistency check for categorical data
        cat_cols = df.select_dtypes(include=['object', 'category']).columns
        consistency_issues = 0
        for col in cat_cols[:5]:  # Check first 5 categorical columns
            value_counts = df[col].value_counts()
            # Check for similar values that might be the same (e.g., "USA" vs "United States")
            if len(value_counts) > 10:
                consistency_issues += 1
        
        consistency = 100 - ((consistency_issues / len(cat_cols)) * 20) if len(cat_cols) > 0 else 100
        health_metrics["consistency"] = round(consistency, 2)
        
        # Calculate overall health score
        health_metrics["overall_score"] = round(
            (health_metrics["completeness"] + health_metrics["consistency"] + 
             health_metrics["validity"] + health_metrics["uniqueness"]) / 4, 2
        )
        
        # Determine working condition
        if health_metrics["overall_score"] >= 95:
            working_condition = "excellent"
        elif health_metrics["overall_score"] >= 85:
            working_condition = "good"
        elif health_metrics["overall_score"] >= 70:
            working_condition = "fair"
        else:
            working_condition = "poor"
        
        # Additional dataset info
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
        date_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
        
        return JSONResponse({
            "status": "ok",
            "dataset_name": session.dataset_name or "Uploaded Dataset",
            "dimensions": f"{total_rows:,} × {total_cols}",
            "memory_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
            "column_types": {
                "numeric": len(numeric_cols),
                "categorical": len(cat_cols),
                "datetime": len(date_cols),
                "other": total_cols - len(numeric_cols) - len(cat_cols) - len(date_cols)
            },
            "health_metrics": health_metrics,
            "working_condition": working_condition,
            "issues": issues,
            "warnings": warnings,
            "recommendations": _generate_health_recommendations(health_metrics, issues, warnings)
        })
        
    except Exception as exc:
        log.error("dataset_health_check: %s", exc)
        return JSONResponse({
            "status": "error",
            "message": "Unable to assess dataset health",
            "health_score": 0,
            "working_condition": "failed"
        })


def _generate_health_recommendations(health_metrics, issues, warnings):
    """Generate actionable recommendations based on dataset health."""
    recommendations = []
    
    if health_metrics["completeness"] < 95:
        recommendations.append("Consider data imputation strategies for missing values")
    
    if health_metrics["uniqueness"] < 98:
        recommendations.append("Review and remove duplicate records")
    
    if health_metrics["validity"] < 95:
        recommendations.append("Validate data ranges and remove invalid entries")
    
    if health_metrics["consistency"] < 90:
        recommendations.append("Standardize categorical values and fix inconsistencies")
    
    if not recommendations:
        recommendations.append("Dataset quality is excellent - ready for advanced analysis")
    
    return recommendations


@router.get("/chat/health")
async def chat_health():
    llm_meta = get_active_llm_summary()
    return JSONResponse({
        "status": "ok",
        "provider": llm_meta.get("provider"),
        "model": llm_meta.get("model"),
        "configured": llm_meta.get("configured"),
        "groq_configured": has_groq_config(),
        "modes_available": sorted(ALLOWED_MODES),
    })
