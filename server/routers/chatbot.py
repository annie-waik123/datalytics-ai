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
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import get_chat_history, get_dataset, save_chat_message
from services.data_engine_service import has_live_dataset, restore_live_dataset
from services.insight_generation_service import (
    generate_mode_response_from_session,
    infer_mode_from_prompt,
)
from services.llm_service import groq_chat, has_groq_config
from state.session_store import store

log = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_MODES = {"chat", "ai_insights", "recommendation_insights", "decision_making"}

# ─── System prompts per mode ─────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """You are a data analyst assistant for Datalytics, powered by LLaMA 3.3 70B.

The user has uploaded the dataset shown below. Answer their question precisely based on the data.

Rules:
- Use the actual column names and real data values from the dataset
- If asking for average/mean of a column → compute it from the sample rows provided
- If asking for count/max/min → answer from the data
- Be concise (2-4 sentences max for simple queries)
- Use bullet points for multi-part answers
- Include specific numbers from the dataset
- Never make up data — only use what's provided
- If the dataset doesn't have enough info, say so clearly
""".strip()

RECOMMENDATION_SYSTEM_PROMPT = """You are a Senior Business Intelligence Analyst and Strategic Advisor powered by LLaMA 3.3 70B.

The user has uploaded a dataset. Generate HIGH-LEVEL EXECUTIVE BUSINESS RECOMMENDATIONS.

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
""".strip()

AI_INSIGHTS_SYSTEM_PROMPT = """You are an AI-Powered Data Intelligence Engine running on LLaMA 3.3 70B.

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
""".strip()

DECISION_MAKING_SYSTEM_PROMPT = """You are an AI Decision Engine and Business Strategy Advisor powered by LLaMA 3.3 70B.

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
  "resource_decisions": {
    "increase": ["Item A -> reason"],
    "maintain": ["Item B -> reason"],
    "reduce": ["Item C -> reason"],
    "remove": ["Item D -> reason"]
  },
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
    document = await get_dataset(session_id)
    _ensure_dataset_in_session(session, session_id, document)

    # Build context: CSV for chat, full stats for insights/recommendations
    if mode == "chat":
        dataset_context = _build_csv_context(session, max_rows=1000)  # Increased to 1000 rows for better analysis
    else:
        dataset_context = _build_stats_context(session)

    has_data = bool(dataset_context)

    # Build the user prompt — exactly like the original app
    if has_data:
        user_content = (
            f"DATASET INFORMATION:\n{dataset_context}\n\n"
            f"USER QUESTION:\n{message}\n\n"
            f"Answer based strictly on the dataset above. "
            f"Use the actual column names and values."
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
        "recommendation_insights": 2000,
        "ai_insights": 1800,
        "decision_making": 2500,
        "chat": 800,
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
                "answer": result.get("content", _mode_fallback_message(mode)),
                "mode": mode,
                "source": "local_fallback",
                "dataset_available": has_data,
            }
        except Exception as exc:
            log.error("_call_groq_with_dataset: local fallback failed: %s", exc)
            return {
                "answer": _mode_fallback_message(mode),
                "mode": mode,
                "source": "error",
                "dataset_available": False,
            }

    try:
        content = groq_chat(
            groq_messages,
            max_tokens=max_tokens_map.get(mode, 1000),
            temperature=temperature_map.get(mode, 0.2),
        )
        return {
            "answer": content or _mode_fallback_message(mode),
            "mode": mode,
            "source": "groq",
            "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            "dataset_available": has_data,
        }
    except Exception as exc:
        log.error("_call_groq_with_dataset: Groq failed for mode=%s: %s", mode, exc)
        # Fallback to local
        try:
            result = generate_mode_response_from_session(
                mode=mode,
                user_prompt=message,
                session=session,
            )
            return {
                "answer": result.get("content", _mode_fallback_message(mode)),
                "mode": mode,
                "source": "local_fallback",
                "dataset_available": has_data,
                "error": "AI model temporarily unavailable. Showing local analysis.",
            }
        except Exception:
            return {
                "answer": _mode_fallback_message(mode),
                "mode": mode,
                "source": "error",
                "dataset_available": False,
                "error": "AI service temporarily unavailable. Please retry.",
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

    try:
        payload = await _call_groq_with_dataset(user_message, "recommendation_insights", x_session_id)
    except Exception as exc:
        log.error("chat_recommendations: %s", exc)
        payload = {
            "answer": _mode_fallback_message("recommendation_insights"),
            "mode": "recommendation_insights",
            "source": "error",
        }

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
        from database import get_db
        db = get_db()
        await db["chats"].delete_many({"session_id": x_session_id})
    except Exception as exc:
        log.warning("clear_chat: %s", exc)
    return JSONResponse({"message": "Chat history cleared."})


@router.get("/chat/modes")
async def get_supported_modes():
    return JSONResponse({
        "modes": [
            {"id": "chat", "label": "Chat", "description": "Dataset Q&A and AI assistant", "icon": "💬"},
            {"id": "ai_insights", "label": "AI Insights", "description": "Deep AI pattern recognition", "icon": "🧠"},
            {"id": "recommendation_insights", "label": "Recommendations", "description": "Executive business recommendations", "icon": "📊"},
            {"id": "decision_making", "label": "Decision Making", "description": "Clear business decisions and actions", "icon": "🎯"},
        ],
        "default_mode": "chat",
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
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
    return JSONResponse({
        "status": "ok",
        "groq_configured": has_groq_config(),
        "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        "modes_available": sorted(ALLOWED_MODES),
    })
