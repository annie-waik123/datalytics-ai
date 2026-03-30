"""
ML Model Comparison Dashboard
A fully interactive Streamlit app for uploading datasets, training/comparing
supervised & unsupervised ML models, making predictions, and downloading results.
Optimized for large datasets (1,000,000+ rows).
"""

import streamlit as st
import pandas as pd
import numpy as np
import pickle
import io
import warnings
import gc
from concurrent.futures import ThreadPoolExecutor, as_completed

import matplotlib
matplotlib.use("Agg")
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

from sklearn.model_selection import train_test_split, cross_val_score, learning_curve
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, LabelEncoder,
)
from sklearn.impute import SimpleImputer

# Supervised – Classification & Regression
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.naive_bayes import GaussianNB

# Supervised – Metrics
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix,
    mean_absolute_error, mean_squared_error, r2_score,
)

# Unsupervised
from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score, davies_bouldin_score
from sklearn.decomposition import PCA

warnings.filterwarnings("ignore")


# ──────────────────────────────────────────────
# OPTIMIZATION UTILITIES
# ──────────────────────────────────────────────

def optimize_memory(df: pd.DataFrame) -> pd.DataFrame:
    """Downcast numerics and convert low-cardinality objects to categoricals."""
    for col in df.select_dtypes(include=["int64", "int32"]).columns:
        df[col] = pd.to_numeric(df[col], downcast="integer")
    for col in df.select_dtypes(include=["float64"]).columns:
        df[col] = pd.to_numeric(df[col], downcast="float")
    for col in df.select_dtypes(include=["object"]).columns:
        if df[col].nunique() / max(len(df), 1) < 0.5:
            df[col] = df[col].astype("category")
    return df


def smart_sample(df: pd.DataFrame, target_col: str = None, task_type: str = None) -> pd.DataFrame:
    """
    Stratified or random sampling based on dataset size:
      0–100k    → full data
      100k–500k → 50k–100k sample
      500k+     → max 100k sample
    """
    n = len(df)
    if n <= 100_000:
        return df.copy()
    elif n <= 500_000:
        sample_size = min(max(50_000, n // 5), 100_000)
    else:
        sample_size = 100_000

    if (
        task_type == "Classification"
        and target_col is not None
        and target_col in df.columns
        and df[target_col].nunique() <= 100
    ):
        try:
            sampled, _ = train_test_split(
                df, train_size=sample_size, stratify=df[target_col], random_state=42
            )
            return sampled.reset_index(drop=True)
        except Exception:
            pass
    return df.sample(n=sample_size, random_state=42).reset_index(drop=True)


def get_sampling_info(n_total: int) -> dict:
    if n_total <= 100_000:
        return {"sampled": False, "sample_size": n_total, "ratio": 1.0}
    elif n_total <= 500_000:
        sample_size = min(max(50_000, n_total // 5), 100_000)
    else:
        sample_size = 100_000
    return {"sampled": True, "sample_size": sample_size, "ratio": round(sample_size / n_total, 3)}


@st.cache_data(show_spinner=False)
def load_csv_chunked(file_bytes: bytes, filename: str) -> pd.DataFrame:
    """Cache-aware CSV loader with chunked reading for large files."""
    buf = io.BytesIO(file_bytes)
    try:
        line_count = sum(1 for _ in buf) - 1
        buf.seek(0)
    except Exception:
        line_count = None
        buf.seek(0)

    CHUNK_THRESHOLD = 200_000

    if line_count is None or line_count <= CHUNK_THRESHOLD:
        df = pd.read_csv(buf)
    else:
        chunks = []
        for chunk in pd.read_csv(buf, chunksize=50_000):
            chunks.append(optimize_memory(chunk))
        df = pd.concat(chunks, ignore_index=True)
        gc.collect()
        return df

    return optimize_memory(df)


@st.cache_data(show_spinner=False)
def cached_describe(cache_key: str, df: pd.DataFrame):
    return df.describe(include="all").T


@st.cache_data(show_spinner=False)
def cached_correlation(cache_key: str, df: pd.DataFrame, num_cols: list):
    return df[num_cols].corr()


# ──────────────────────────────────────────────
# Page config
# ──────────────────────────────────────────────
st.set_page_config(
    page_title="ML Model Comparison Dashboard",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

    .main-header {
        font-size: 2.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #6C63FF, #3F8EFC, #00D2FF);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        margin-bottom: 0.5rem;
        letter-spacing: -0.5px;
    }
    .sub-header {
        text-align: center;
        color: #888;
        font-size: 1.05rem;
        margin-bottom: 2rem;
        line-height: 1.6;
    }
    div[data-testid="stMetric"] {
        background: linear-gradient(135deg, #1A1F2E, #252B3B);
        border: 1px solid rgba(108, 99, 255, 0.2);
        border-radius: 14px;
        padding: 18px;
        box-shadow: 0 4px 20px rgba(108, 99, 255, 0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    div[data-testid="stMetric"]:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 30px rgba(108, 99, 255, 0.18);
    }
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #0a0e18, #111827);
    }
    section[data-testid="stSidebar"] .stRadio > label { display: none; }
    section[data-testid="stSidebar"] .stRadio > div { gap: 2px; }
    section[data-testid="stSidebar"] .stRadio > div > label {
        padding: 10px 14px;
        border-radius: 10px;
        transition: all 0.2s ease;
        font-size: 0.92rem;
    }
    section[data-testid="stSidebar"] .stRadio > div > label:hover {
        background: rgba(108, 99, 255, 0.1);
    }
    section[data-testid="stSidebar"] .stRadio > div > label[data-checked="true"] {
        background: linear-gradient(135deg, rgba(108, 99, 255, 0.2), rgba(63, 142, 252, 0.15));
        border-left: 3px solid #6C63FF;
    }
    .stButton > button {
        background: linear-gradient(135deg, #6C63FF, #3F8EFC);
        color: white;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        padding: 0.6rem 1.5rem;
        font-size: 0.95rem;
        transition: all 0.3s ease;
        letter-spacing: 0.3px;
    }
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(108, 99, 255, 0.4);
    }
    .success-box {
        background: linear-gradient(135deg, #0d2818, #132a1c);
        border-left: 4px solid #00D26A;
        padding: 1rem 1.2rem;
        border-radius: 10px;
        margin: 1rem 0;
        font-size: 0.95rem;
    }
    .info-box {
        background: linear-gradient(135deg, #0d1b2a, #1a2332);
        border-left: 4px solid #3F8EFC;
        padding: 1rem 1.2rem;
        border-radius: 10px;
        margin: 1rem 0;
        font-size: 0.95rem;
    }
    .warning-box {
        background: linear-gradient(135deg, #2a1f0d, #332a1a);
        border-left: 4px solid #FFB020;
        padding: 1rem 1.2rem;
        border-radius: 10px;
        margin: 1rem 0;
        font-size: 0.95rem;
    }
    .tip-box {
        background: linear-gradient(135deg, #1a1a2e, #252540);
        border-left: 4px solid #A78BFA;
        padding: 1rem 1.2rem;
        border-radius: 10px;
        margin: 1rem 0;
        font-size: 0.9rem;
        color: #ccc;
    }
    .section-divider {
        border: none;
        height: 2px;
        background: linear-gradient(90deg, transparent, #6C63FF, transparent);
        margin: 2rem 0;
    }
    .glass-card {
        background: rgba(26, 31, 46, 0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(108, 99, 255, 0.15);
        border-radius: 16px;
        padding: 1.5rem;
        margin: 1rem 0;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .streamlit-expanderHeader { font-weight: 600; font-size: 0.95rem; }
</style>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────
# Session-state helpers
# ──────────────────────────────────────────────
_DEFAULTS = dict(
    df=None, df_processed=None, target_col=None, task_type=None,
    X_train=None, X_test=None, y_train=None, y_test=None,
    trained_models={}, model_results=None, best_model_name=None,
    best_model=None, cluster_results=None, prediction_history=[],
    feature_columns=None, scaler=None, label_encoders={},
    preprocessing_done=False, supervised_done=False, unsupervised_done=False,
)
for k, v in _DEFAULTS.items():
    if k not in st.session_state:
        st.session_state[k] = v


# ──────────────────────────────────────────────
# Sidebar navigation with progress tracker
# ──────────────────────────────────────────────
st.sidebar.markdown(
    '<div style="text-align:center;padding:1rem 0 0.5rem;">'
    '<span style="font-size:2rem;">🤖</span><br>'
    '<span style="font-size:1.15rem;font-weight:700;'
    'background:linear-gradient(135deg,#6C63FF,#00D2FF);'
    '-webkit-background-clip:text;-webkit-text-fill-color:transparent;">'
    'ML Dashboard</span></div>', unsafe_allow_html=True,
)

steps_status = {
    "data":        "✅" if st.session_state.df is not None else "1️⃣",
    "preprocess":  "✅" if st.session_state.preprocessing_done else ("2️⃣" if st.session_state.df is not None else "🔒"),
    "supervised":  "✅" if st.session_state.supervised_done else ("3️⃣" if st.session_state.preprocessing_done else "🔒"),
    "unsupervised":"✅" if st.session_state.unsupervised_done else ("4️⃣" if st.session_state.preprocessing_done else "🔒"),
    "best":        "✅" if st.session_state.best_model is not None else "🔒",
}

completed = sum(1 for v in steps_status.values() if v == "✅")
st.sidebar.markdown(
    f'<div style="text-align:center;padding:0.3rem;margin:0.5rem 0.8rem;'
    f'background:linear-gradient(135deg,#1A1F2E,#252B3B);border-radius:10px;'
    f'border:1px solid #333;">'
    f'<span style="font-size:0.8rem;color:#888;">Progress</span><br>'
    f'<span style="font-size:1.1rem;font-weight:700;color:#6C63FF;">{completed}/5</span>'
    f'<span style="font-size:0.8rem;color:#666;"> steps done</span></div>',
    unsafe_allow_html=True,
)

# Memory / sampling badge
if st.session_state.df is not None:
    mem_mb = st.session_state.df.memory_usage(deep=True).sum() / 1e6
    n_rows = len(st.session_state.df)
    samp_info = get_sampling_info(n_rows)
    badge_color = "#00D26A" if not samp_info["sampled"] else "#FFB020"
    badge_label = "Full Data" if not samp_info["sampled"] else "Sampling Active"
    st.sidebar.markdown(
        f'<div style="text-align:center;padding:0.3rem;margin:0.3rem 0.8rem 0.5rem;'
        f'background:#1A1F2E;border-radius:10px;border:1px solid {badge_color}33;">'
        f'<span style="font-size:0.75rem;color:{badge_color};font-weight:600;">{badge_label}</span><br>'
        f'<span style="font-size:0.72rem;color:#666;">{n_rows:,} rows · {mem_mb:.1f} MB</span></div>',
        unsafe_allow_html=True,
    )

st.sidebar.markdown("---")

SECTIONS = [
    f"{steps_status['data']} Dataset Upload",
    "🔍 Data Exploration",
    "📊 Visualization",
    f"{steps_status['preprocess']} Preprocessing",
    f"{steps_status['supervised']} Supervised Models",
    f"{steps_status['unsupervised']} Unsupervised Models",
    f"{steps_status['best']} Best Model",
    "🎯 Prediction",
    "📥 Download Results",
]
section = st.sidebar.radio("Navigate", SECTIONS, label_visibility="collapsed")

st.sidebar.markdown("---")
st.sidebar.markdown(
    '<div style="padding:0.8rem;margin:0 0.3rem;background:#1A1F2E;'
    'border-radius:10px;border:1px solid #252B3B;">'
    '<span style="font-size:0.82rem;color:#A78BFA;font-weight:600;">💡 Quick Tip</span><br>'
    '<span style="font-size:0.78rem;color:#888;line-height:1.5;">'
    'Follow the steps in order: Upload → Preprocess → Train for best results.</span></div>',
    unsafe_allow_html=True,
)
st.sidebar.markdown(
    '<p style="text-align:center;color:#444;font-size:0.75rem;margin-top:1rem;">'
    'Built with ❤️ by sangam 18</p>',
    unsafe_allow_html=True,
)

def _sec(s):
    for token in ["✅","1️⃣","2️⃣","3️⃣","4️⃣","🔒","🔍","📊","🎯","📥"]:
        s = s.replace(token, "")
    return s.strip()

section_key = _sec(section)


# ══════════════════════════════════════════════
# 1. DATASET UPLOAD
# ══════════════════════════════════════════════
if section_key == "Dataset Upload":
    st.markdown('<h1 class="main-header">ML Model Comparison Dashboard</h1>', unsafe_allow_html=True)
    st.markdown('<p class="sub-header">Upload → Explore → Preprocess → Train → Compare → Predict → Download</p>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    st.markdown(
        '<div class="tip-box">💡 <strong>Getting started:</strong> Upload any CSV file to begin. '
        'The app will auto-detect column types, show missing values, and guide you through '
        'the entire ML workflow step by step. Large datasets (100k+ rows) are handled with '
        'smart sampling to keep training fast without sacrificing accuracy.</div>',
        unsafe_allow_html=True,
    )

    uploaded = st.file_uploader("Upload your CSV dataset", type=["csv"], help="Maximum 200 MB")

    if uploaded is not None:
        try:
            file_bytes = uploaded.read()
            with st.spinner("Loading dataset…"):
                df = load_csv_chunked(file_bytes, uploaded.name)
            st.session_state.df = df

            n_total = len(df)
            samp_info = get_sampling_info(n_total)

            st.success(f"✅ Dataset loaded — **{n_total:,}** rows × **{df.shape[1]}** columns")

            if samp_info["sampled"]:
                st.markdown(
                    f'<div class="warning-box">⚡ <strong>Large Dataset Detected:</strong> '
                    f'Training will use a representative sample of <strong>{samp_info["sample_size"]:,}</strong> rows '
                    f'({samp_info["ratio"]*100:.1f}% of full data) for speed. '
                    f'Evaluation metrics use the full test split.</div>',
                    unsafe_allow_html=True,
                )

            st.markdown("### 📋 Dataset Preview")
            st.dataframe(df.head(20), use_container_width=True, height=350)

            col1, col2, col3, col4 = st.columns(4)
            col1.metric("Rows", f"{df.shape[0]:,}")
            col2.metric("Columns", f"{df.shape[1]:,}")
            col3.metric("Numeric Cols", f"{df.select_dtypes(include=np.number).shape[1]}")
            col4.metric("Categorical Cols", f"{df.select_dtypes(include=['object','category']).shape[1]}")

            st.markdown("### 📑 Column Information")
            info_df = pd.DataFrame({
                "Column":    df.columns,
                "Data Type": df.dtypes.astype(str).values,
                "Non-Null":  df.notnull().sum().values,
                "Null":      df.isnull().sum().values,
                "Null %":    (df.isnull().sum().values / len(df) * 100).round(2),
                "Unique":    df.nunique().values,
            })
            st.dataframe(info_df, use_container_width=True, hide_index=True)

            if df.isnull().sum().sum() > 0:
                st.warning(f"⚠️ Dataset contains **{df.isnull().sum().sum()}** missing values across **{(df.isnull().sum() > 0).sum()}** columns.")
            else:
                st.markdown('<div class="success-box">✅ No missing values detected!</div>', unsafe_allow_html=True)

        except Exception as e:
            st.error(f"Error reading CSV: {e}")
    else:
        st.markdown(
            '<div class="info-box">👆 <strong>Drag & drop</strong> a CSV file above, '
            'or click <strong>Browse files</strong> to select one from your computer.</div>',
            unsafe_allow_html=True,
        )


# ══════════════════════════════════════════════
# 2. DATA EXPLORATION
# ══════════════════════════════════════════════
elif section_key == "Data Exploration":
    st.markdown('<h1 class="main-header">Data Exploration</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    if st.session_state.df is None:
        st.warning("⚠️ Please upload a dataset first.")
    else:
        df = st.session_state.df
        cache_key = str(len(df)) + str(list(df.columns))

        st.markdown("### 📈 Statistical Summary")
        st.dataframe(cached_describe(cache_key, df), use_container_width=True)

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        if cat_cols:
            st.markdown("### 🏷️ Categorical Column Analysis")
            sel_cat = st.selectbox("Select a categorical column", cat_cols)
            vc = df[sel_cat].value_counts().head(20)
            fig = px.bar(
                x=vc.index.astype(str), y=vc.values,
                labels={"x": sel_cat, "y": "Count"},
                title=f"Value Counts — {sel_cat}",
                color=vc.values,
                color_continuous_scale="Viridis",
            )
            fig.update_layout(template="plotly_dark", showlegend=False)
            st.plotly_chart(fig, use_container_width=True)

        num_cols = df.select_dtypes(include=np.number).columns.tolist()
        if num_cols:
            st.markdown("### 🔎 Outlier Detection (IQR Method)")
            # Sample for performance on large datasets
            df_sample = df[num_cols].sample(n=min(50_000, len(df)), random_state=42)
            outlier_info = []
            for c in num_cols:
                q1 = df_sample[c].quantile(0.25)
                q3 = df_sample[c].quantile(0.75)
                iqr = q3 - q1
                lower = q1 - 1.5 * iqr
                upper = q3 + 1.5 * iqr
                n_outliers = ((df_sample[c] < lower) | (df_sample[c] > upper)).sum()
                outlier_info.append({"Column": c, "Q1": round(q1, 2), "Q3": round(q3, 2),
                                     "IQR": round(iqr, 2), "Lower": round(lower, 2),
                                     "Upper": round(upper, 2), "Outliers": n_outliers})
            if len(df) > 50_000:
                st.caption("📊 Outlier detection computed on a 50,000-row sample for speed.")
            st.dataframe(pd.DataFrame(outlier_info), use_container_width=True, hide_index=True)

        st.markdown("### ⚖️ Class Balance Check")
        potential_target = st.selectbox("Select potential target column", df.columns.tolist(), key="class_bal")
        if df[potential_target].nunique() <= 30:
            vc = df[potential_target].value_counts()
            fig = px.pie(values=vc.values, names=vc.index.astype(str),
                         title=f"Class Distribution — {potential_target}",
                         color_discrete_sequence=px.colors.qualitative.Set2)
            fig.update_layout(template="plotly_dark")
            st.plotly_chart(fig, use_container_width=True)
        else:
            df_hist = df.sample(n=min(50_000, len(df)), random_state=42)
            fig = px.histogram(df_hist, x=potential_target, title=f"Distribution — {potential_target}",
                               color_discrete_sequence=["#6C63FF"])
            fig.update_layout(template="plotly_dark")
            st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════
# 3. VISUALIZATION
# ══════════════════════════════════════════════
elif section_key == "Visualization":
    st.markdown('<h1 class="main-header">Data Visualization</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    if st.session_state.df is None:
        st.warning("⚠️ Please upload a dataset first.")
    else:
        df = st.session_state.df
        num_cols = df.select_dtypes(include=np.number).columns.tolist()
        all_cols = df.columns.tolist()
        cache_key = str(len(df)) + str(list(df.columns))

        viz_type = st.selectbox(
            "Select Visualization",
            ["Correlation Heatmap", "Feature Distributions", "Pair Plot",
             "Histogram", "Scatter Plot", "Box Plot"],
        )

        if viz_type == "Correlation Heatmap":
            if len(num_cols) < 2:
                st.warning("Need at least 2 numeric columns.")
            else:
                df_viz = df[num_cols].sample(n=min(10_000, len(df)), random_state=42)
                corr = cached_correlation(cache_key, df_viz, num_cols)
                if len(df) > 10_000:
                    st.caption(f"📊 Correlation computed on a {min(10_000, len(df)):,}-row sample for speed.")
                fig = px.imshow(
                    corr, text_auto=".2f", aspect="auto",
                    color_continuous_scale="RdBu_r",
                    title="Correlation Heatmap",
                )
                fig.update_layout(template="plotly_dark", height=600)
                st.plotly_chart(fig, use_container_width=True)

        elif viz_type == "Feature Distributions":
            sel_cols = st.multiselect("Select numeric columns", num_cols, default=num_cols[:4])
            if sel_cols:
                df_viz = df[sel_cols].sample(n=min(20_000, len(df)), random_state=42)
                fig = make_subplots(rows=1, cols=len(sel_cols), subplot_titles=sel_cols)
                colors = px.colors.qualitative.Set2
                for i, c in enumerate(sel_cols):
                    fig.add_trace(
                        go.Histogram(x=df_viz[c], name=c,
                                     marker_color=colors[i % len(colors)]),
                        row=1, col=i + 1,
                    )
                fig.update_layout(template="plotly_dark", height=400,
                                  showlegend=False, title="Feature Distributions")
                st.plotly_chart(fig, use_container_width=True)

        elif viz_type == "Pair Plot":
            sel_cols = st.multiselect("Select columns (max 5 recommended)", num_cols,
                                      default=num_cols[:min(4, len(num_cols))])
            color_col = st.selectbox("Color by (optional)", [None] + all_cols)
            if sel_cols and len(sel_cols) >= 2:
                df_pair = df.sample(n=min(5_000, len(df)), random_state=42)
                if len(df) > 5_000:
                    st.caption("📊 Pair plot rendered on a 5,000-row sample for speed.")
                fig = px.scatter_matrix(
                    df_pair, dimensions=sel_cols,
                    color=color_col if color_col else None,
                    title="Pair Plot",
                    color_continuous_scale="Viridis",
                )
                fig.update_layout(template="plotly_dark", height=700)
                st.plotly_chart(fig, use_container_width=True)

        elif viz_type == "Histogram":
            col = st.selectbox("Select column", all_cols)
            nbins = st.slider("Number of bins", 10, 100, 30)
            df_hist = df.sample(n=min(50_000, len(df)), random_state=42)
            fig = px.histogram(df_hist, x=col, nbins=nbins, title=f"Histogram — {col}",
                               color_discrete_sequence=["#6C63FF"],
                               marginal="box")
            fig.update_layout(template="plotly_dark")
            st.plotly_chart(fig, use_container_width=True)

        elif viz_type == "Scatter Plot":
            c1, c2 = st.columns(2)
            x_col = c1.selectbox("X axis", all_cols, index=0)
            y_col = c2.selectbox("Y axis", all_cols, index=min(1, len(all_cols) - 1))
            color_col = st.selectbox("Color by (optional)", [None] + all_cols, key="scatter_color")
            df_scatter = df.sample(n=min(20_000, len(df)), random_state=42)
            if len(df) > 20_000:
                st.caption("📊 Scatter plot rendered on a 20,000-row sample for speed.")
            fig = px.scatter(df_scatter, x=x_col, y=y_col,
                             color=color_col if color_col else None,
                             title=f"{y_col} vs {x_col}",
                             color_continuous_scale="Viridis")
            fig.update_layout(template="plotly_dark")
            st.plotly_chart(fig, use_container_width=True)

        elif viz_type == "Box Plot":
            col = st.selectbox("Select numeric column", num_cols)
            group_col = st.selectbox("Group by (optional)", [None] + all_cols, key="box_group")
            df_box = df.sample(n=min(20_000, len(df)), random_state=42)
            fig = px.box(df_box, y=col, x=group_col if group_col else None,
                         title=f"Box Plot — {col}",
                         color=group_col if group_col else None,
                         color_discrete_sequence=px.colors.qualitative.Set2)
            fig.update_layout(template="plotly_dark")
            st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════
# 4. PREPROCESSING
# ══════════════════════════════════════════════
elif section_key == "Preprocessing":
    st.markdown('<h1 class="main-header">Data Preprocessing</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    if st.session_state.df is None:
        st.warning("⚠️ Please upload a dataset first.")
    else:
        df = st.session_state.df.copy()
        num_cols = df.select_dtypes(include=np.number).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

        st.markdown("### 🎯 Target Column")
        target_col = st.selectbox("Select target column", df.columns.tolist())
        st.session_state.target_col = target_col

        if df[target_col].nunique() <= 20 or df[target_col].dtype in ["object", "category"]:
            task_type = "Classification"
        else:
            task_type = "Regression"
        task_override = st.radio("Task type", ["Classification", "Regression"],
                                  index=0 if task_type == "Classification" else 1)
        st.session_state.task_type = task_override

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        st.markdown("### 🩹 Handle Missing Values")
        missing_total = df.isnull().sum().sum()
        if missing_total > 0:
            miss_strategy = st.selectbox(
                "Strategy",
                ["Drop rows with missing values", "Fill with mean (numeric)",
                 "Fill with median (numeric)", "Fill with mode (all)"],
            )
        else:
            st.markdown('<div class="success-box">✅ No missing values — nothing to do.</div>', unsafe_allow_html=True)
            miss_strategy = None

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        st.markdown("### 🔤 Encode Categorical Variables")
        if cat_cols:
            encode_method = st.radio("Encoding method", ["Label Encoding", "One-Hot Encoding"])
        else:
            st.markdown('<div class="success-box">✅ No categorical columns detected.</div>', unsafe_allow_html=True)
            encode_method = None

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        st.markdown("### 📏 Feature Scaling")
        scaling_method = st.radio("Scaler", ["None", "StandardScaler", "MinMaxScaler"])

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        st.markdown("### ✂️ Train-Test Split")
        test_size = st.slider("Test size (%)", 10, 50, 20) / 100
        random_state = st.number_input("Random state", value=42, step=1)

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        if st.button("🚀 Apply Preprocessing", use_container_width=True):
            with st.spinner("Processing…"):
                # Convert categories back to object for processing
                for col in df.select_dtypes(include="category").columns:
                    df[col] = df[col].astype(str)
                cat_cols = df.select_dtypes(include="object").columns.tolist()

                # 1. Missing values
                if miss_strategy == "Drop rows with missing values":
                    df.dropna(inplace=True)
                elif miss_strategy == "Fill with mean (numeric)":
                    for c in num_cols:
                        if c in df.columns:
                            df[c].fillna(df[c].mean(), inplace=True)
                    for c in cat_cols:
                        df[c].fillna(df[c].mode()[0] if not df[c].mode().empty else "Unknown", inplace=True)
                elif miss_strategy == "Fill with median (numeric)":
                    for c in num_cols:
                        if c in df.columns:
                            df[c].fillna(df[c].median(), inplace=True)
                    for c in cat_cols:
                        df[c].fillna(df[c].mode()[0] if not df[c].mode().empty else "Unknown", inplace=True)
                elif miss_strategy == "Fill with mode (all)":
                    for c in df.columns:
                        if not df[c].mode().empty:
                            df[c].fillna(df[c].mode()[0], inplace=True)

                # 2. Encode categoricals
                label_encoders = {}
                cat_cols_current = df.select_dtypes(include="object").columns.tolist()
                if encode_method == "Label Encoding" and cat_cols_current:
                    for c in cat_cols_current:
                        le = LabelEncoder()
                        df[c] = le.fit_transform(df[c].astype(str))
                        label_encoders[c] = le
                elif encode_method == "One-Hot Encoding" and cat_cols_current:
                    # Prevent memory errors on high-cardinality columns
                    low_card_cols = []
                    high_card_cols = []
                    for c in cat_cols_current:
                        if c == target_col:
                            continue
                        if df[c].nunique() > 20:
                            high_card_cols.append(c)
                        else:
                            low_card_cols.append(c)
                    
                    if high_card_cols:
                        st.warning(f"⚠️ Columns {high_card_cols} have too many unique values. Applied Label Encoding instead to prevent memory crash.")
                        for c in high_card_cols:
                            le = LabelEncoder()
                            df[c] = le.fit_transform(df[c].astype(str))
                            label_encoders[c] = le
                            
                    if low_card_cols:
                        df = pd.get_dummies(df, columns=low_card_cols, drop_first=True)
                        
                    if df[target_col].dtype == "object":
                        le = LabelEncoder()
                        df[target_col] = le.fit_transform(df[target_col].astype(str))
                        label_encoders[target_col] = le

                st.session_state.label_encoders = label_encoders

                # 3. Split (on full data — sampling applied to train split only)
                X = df.drop(columns=[target_col])
                y = df[target_col]
                X = X.apply(pd.to_numeric, errors="coerce").fillna(0)
                y = pd.to_numeric(y, errors="coerce").fillna(0) if task_override == "Regression" else y

                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=test_size, random_state=int(random_state),
                )

                # ── Smart sampling on training split only ──────────────
                n_train = len(X_train)
                samp_info = get_sampling_info(n_train)
                if samp_info["sampled"]:
                    sample_n = samp_info["sample_size"]
                    if task_override == "Classification":
                        try:
                            X_train, _, y_train, _ = train_test_split(
                                X_train, y_train,
                                train_size=sample_n,
                                stratify=y_train,
                                random_state=42,
                            )
                        except Exception:
                            X_train = X_train.sample(n=sample_n, random_state=42)
                            y_train = y_train.loc[X_train.index]
                    else:
                        X_train = X_train.sample(n=sample_n, random_state=42)
                        y_train = y_train.loc[X_train.index]
                    X_train = X_train.reset_index(drop=True)
                    y_train = y_train.reset_index(drop=True)
                    st.info(
                        f"⚡ Training set sampled: **{sample_n:,}** rows used "
                        f"(of {n_train:,} available). Test set: **{len(X_test):,}** rows (full)."
                    )
                # ───────────────────────────────────────────────────────

                # 4. Scaling
                if scaling_method == "StandardScaler":
                    scaler = StandardScaler()
                    X_train = pd.DataFrame(scaler.fit_transform(X_train), columns=X.columns, index=X_train.index)
                    X_test  = pd.DataFrame(scaler.transform(X_test),      columns=X.columns, index=X_test.index)
                    st.session_state.scaler = scaler
                elif scaling_method == "MinMaxScaler":
                    scaler = MinMaxScaler()
                    X_train = pd.DataFrame(scaler.fit_transform(X_train), columns=X.columns, index=X_train.index)
                    X_test  = pd.DataFrame(scaler.transform(X_test),      columns=X.columns, index=X_test.index)
                    st.session_state.scaler = scaler
                else:
                    st.session_state.scaler = None

                # Apply memory optimization to arrays
                X_train = optimize_memory(X_train.copy())
                X_test  = optimize_memory(X_test.copy())

                st.session_state.df_processed    = df
                st.session_state.feature_columns = X.columns.tolist()
                st.session_state.X_train         = X_train
                st.session_state.X_test          = X_test
                st.session_state.y_train         = y_train
                st.session_state.y_test          = y_test
                st.session_state.preprocessing_done = True
                gc.collect()

            st.success("✅ Preprocessing complete!")

            c1, c2, c3 = st.columns(3)
            c1.metric("Total Samples", f"{len(df):,}")
            c2.metric("Train Samples", f"{len(X_train):,}")
            c3.metric("Test Samples",  f"{len(X_test):,}")

            st.markdown("### Processed Dataset Preview")
            st.dataframe(df.head(10), use_container_width=True)


# ══════════════════════════════════════════════
# 5. SUPERVISED MODELS
# ══════════════════════════════════════════════
elif section_key == "Supervised Models":
    st.markdown('<h1 class="main-header">Supervised Learning</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    if not st.session_state.preprocessing_done:
        st.warning("⚠️ Please complete preprocessing first.")
    else:
        X_train = st.session_state.X_train
        X_test  = st.session_state.X_test
        y_train = st.session_state.y_train
        y_test  = st.session_state.y_test
        task    = st.session_state.task_type

        st.markdown(f'<div class="info-box">📌 Task type: <strong>{task}</strong></div>', unsafe_allow_html=True)

        if task == "Classification":
            models = {
                "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
                "Decision Tree":       DecisionTreeClassifier(random_state=42),
                "Random Forest":       RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1),
                "KNN":                 KNeighborsClassifier(n_jobs=-1),
                "SVM":                 SVC(probability=True, random_state=42),
                "Naive Bayes":         GaussianNB(),
                "Gradient Boosting":   GradientBoostingClassifier(n_estimators=100, random_state=42),
            }
        else:
            models = {
                "Linear Regression": LinearRegression(n_jobs=-1),
                "Decision Tree":     DecisionTreeRegressor(random_state=42),
                "Random Forest":     RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1),
                "KNN":               KNeighborsRegressor(n_jobs=-1),
                "SVM":               SVR(),
                "Gradient Boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
            }

        if st.button("🚀 Train All Models", use_container_width=True):
            results = []
            trained = {}
            progress = st.progress(0, text="Training models…")
            total = len(models)

            if task == "Classification":
                min_class_size = int(y_train.value_counts().min())
                n_cv = max(2, min(5, min_class_size))
            else:
                n_cv = 5

            # Convert to numpy for thread-safe sharing
            X_tr_np = X_train.values
            y_tr_np = y_train.values
            X_te_np = X_test.values
            y_te_np = y_test.values
            feat_cols = X_train.columns.tolist()

            def _train_single(args):
                name, model, X_tr, y_tr, X_te, y_te, _task, _n_cv = args
                try:
                    model.fit(X_tr, y_tr)
                    y_pred = model.predict(X_te)
                    if _task == "Classification":
                        acc  = accuracy_score(y_te, y_pred)
                        prec = precision_score(y_te, y_pred, average="weighted", zero_division=0)
                        rec  = recall_score(y_te, y_pred, average="weighted", zero_division=0)
                        f1   = f1_score(y_te, y_pred, average="weighted", zero_division=0)
                        try:
                            cv_s = cross_val_score(model, X_tr, y_tr, cv=_n_cv, scoring="accuracy")
                            cv_mean, cv_std = round(cv_s.mean(), 4), round(cv_s.std(), 4)
                        except Exception:
                            cv_mean, cv_std = None, None
                        metrics = {"Model": name, "Accuracy": round(acc, 4),
                                   "Precision": round(prec, 4), "Recall": round(rec, 4),
                                   "F1 Score": round(f1, 4),
                                   "CV Mean": cv_mean, "CV Std": cv_std}
                    else:
                        mae = mean_absolute_error(y_te, y_pred)
                        mse = mean_squared_error(y_te, y_pred)
                        r2  = r2_score(y_te, y_pred)
                        try:
                            cv_s = cross_val_score(model, X_tr, y_tr, cv=_n_cv, scoring="r2")
                            cv_mean, cv_std = round(cv_s.mean(), 4), round(cv_s.std(), 4)
                        except Exception:
                            cv_mean, cv_std = None, None
                        metrics = {"Model": name, "MAE": round(mae, 4),
                                   "MSE": round(mse, 4), "R² Score": round(r2, 4),
                                   "CV Mean R²": cv_mean, "CV Std": cv_std}
                    return name, model, metrics, None
                except Exception as e:
                    return name, None, None, str(e)

            train_args = [
                (name, model, X_tr_np, y_tr_np, X_te_np, y_te_np, task, n_cv)
                for name, model in models.items()
            ]

            completed_count = 0
            with ThreadPoolExecutor(max_workers=min(4, len(models))) as executor:
                futures = {executor.submit(_train_single, args): args[0] for args in train_args}
                for future in as_completed(futures):
                    model_name = futures[future]
                    completed_count += 1
                    progress.progress(completed_count / total, text=f"✅ {model_name} done…")
                    m_name, m_obj, m_metrics, m_err = future.result()
                    if m_err:
                        st.warning(f"⚠️ {m_name} failed: {m_err}")
                    else:
                        results.append(m_metrics)
                        trained[m_name] = m_obj

            gc.collect()
            progress.progress(1.0, text="✅ All models trained!")

            st.session_state.trained_models = trained
            results_df = pd.DataFrame(results)
            st.session_state.model_results = results_df
            st.session_state.supervised_done = True

            if results_df.empty:
                st.error("❌ All models failed to train. Try adjusting preprocessing or using a different dataset.")
            else:
                if task == "Classification":
                    best_idx      = results_df["Accuracy"].idxmax()
                    primary_metric = "Accuracy"
                else:
                    best_idx      = results_df["R² Score"].idxmax()
                    primary_metric = "R² Score"

                best_name = results_df.loc[best_idx, "Model"]
                st.session_state.best_model_name = best_name
                st.session_state.best_model      = trained[best_name]

                st.markdown("### 📊 Model Comparison Table")
                st.dataframe(
                    results_df.style.highlight_max(
                        subset=[primary_metric], color="#2d6a4f"
                    ).format(precision=4),
                    use_container_width=True, hide_index=True,
                )

                st.markdown("### 📈 Performance Comparison")
                fig = px.bar(
                    results_df, x="Model", y=primary_metric,
                    color=primary_metric,
                    color_continuous_scale="Viridis",
                    title=f"Model Comparison — {primary_metric}",
                    text=primary_metric,
                )
                fig.update_layout(template="plotly_dark", height=450)
                fig.update_traces(texttemplate="%{text:.4f}", textposition="outside")
                st.plotly_chart(fig, use_container_width=True)

                if task == "Classification":
                    st.markdown("### 🔢 Confusion Matrices")
                    n_display = min(3, len(trained))
                    if n_display > 0:
                        cols = st.columns(n_display)
                        for idx, (name, model) in enumerate(list(trained.items())[:n_display]):
                            with cols[idx % n_display]:
                                y_pred = model.predict(X_te_np)
                                cm = confusion_matrix(y_te_np, y_pred)
                                fig_cm = px.imshow(cm, text_auto=True,
                                                   color_continuous_scale="Blues",
                                                   title=name, aspect="auto")
                                fig_cm.update_layout(template="plotly_dark", height=300,
                                                     margin=dict(t=40, b=10))
                                st.plotly_chart(fig_cm, use_container_width=True)

                st.markdown("### 🌲 Feature Importance (Tree-Based Models)")
                tree_models = {n: m for n, m in trained.items() if hasattr(m, "feature_importances_")}
                if tree_models:
                    sel_tree = st.selectbox("Select model", list(tree_models.keys()))
                    importances = tree_models[sel_tree].feature_importances_
                    feat_imp_df = pd.DataFrame({
                        "Feature":    feat_cols,
                        "Importance": importances,
                    }).sort_values("Importance", ascending=True).tail(15)

                    fig = px.bar(feat_imp_df, x="Importance", y="Feature",
                                 orientation="h", title=f"Feature Importance — {sel_tree}",
                                 color="Importance", color_continuous_scale="Viridis")
                    fig.update_layout(template="plotly_dark", height=500)
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("No tree-based models available for feature importance.")


# ══════════════════════════════════════════════
# 6. UNSUPERVISED MODELS
# ══════════════════════════════════════════════
elif section_key == "Unsupervised Models":
    st.markdown('<h1 class="main-header">Unsupervised Learning</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    if not st.session_state.preprocessing_done:
        st.warning("⚠️ Please complete preprocessing first.")
    else:
        X_full = pd.concat([st.session_state.X_train, st.session_state.X_test])

        # Sample for clustering if very large
        MAX_CLUSTER_ROWS = 50_000
        if len(X_full) > MAX_CLUSTER_ROWS:
            X_cluster = X_full.sample(n=MAX_CLUSTER_ROWS, random_state=42).reset_index(drop=True)
            st.markdown(
                f'<div class="warning-box">⚡ Clustering uses a <strong>{MAX_CLUSTER_ROWS:,}</strong>-row '
                f'sample of the full {len(X_full):,}-row dataset for speed.</div>',
                unsafe_allow_html=True,
            )
        else:
            X_cluster = X_full.reset_index(drop=True)

        st.markdown("### ⚙️ Clustering Parameters")
        c1, c2 = st.columns(2)
        n_clusters  = c1.slider("Number of clusters (K-Means, Hierarchical, GMM)", 2, 10, 3)
        eps_val     = c2.slider("DBSCAN eps", 0.1, 5.0, 0.5, 0.1)
        min_samples = c2.slider("DBSCAN min_samples", 2, 20, 5)

        if st.button("🚀 Train Clustering Models", use_container_width=True):
            cluster_results    = []
            cluster_labels_all = {}

            with st.spinner("Training clustering models…"):
                # K-Means
                try:
                    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                    km_labels = km.fit_predict(X_cluster)
                    cluster_labels_all["K-Means"] = km_labels
                    sil = silhouette_score(X_cluster, km_labels)
                    db  = davies_bouldin_score(X_cluster, km_labels)
                    cluster_results.append({"Model": "K-Means", "Silhouette": round(sil, 4),
                                            "Davies-Bouldin": round(db, 4), "Clusters": n_clusters})
                except Exception as e:
                    st.warning(f"K-Means failed: {e}")

                # Hierarchical
                try:
                    hc = AgglomerativeClustering(n_clusters=n_clusters)
                    hc_labels = hc.fit_predict(X_cluster)
                    cluster_labels_all["Hierarchical"] = hc_labels
                    sil = silhouette_score(X_cluster, hc_labels)
                    db  = davies_bouldin_score(X_cluster, hc_labels)
                    cluster_results.append({"Model": "Hierarchical", "Silhouette": round(sil, 4),
                                            "Davies-Bouldin": round(db, 4), "Clusters": n_clusters})
                except Exception as e:
                    st.warning(f"Hierarchical failed: {e}")

                # DBSCAN
                try:
                    dbs = DBSCAN(eps=eps_val, min_samples=min_samples)
                    dbs_labels = dbs.fit_predict(X_cluster)
                    n_found = len(set(dbs_labels) - {-1})
                    cluster_labels_all["DBSCAN"] = dbs_labels
                    if n_found >= 2:
                        mask = dbs_labels != -1
                        sil = silhouette_score(X_cluster[mask], dbs_labels[mask]) if mask.sum() > 1 else -1
                        db  = davies_bouldin_score(X_cluster[mask], dbs_labels[mask]) if mask.sum() > 1 else -1
                    else:
                        sil, db = -1, -1
                    cluster_results.append({"Model": "DBSCAN", "Silhouette": round(sil, 4),
                                            "Davies-Bouldin": round(db, 4), "Clusters": n_found})
                except Exception as e:
                    st.warning(f"DBSCAN failed: {e}")

                # Gaussian Mixture
                try:
                    gmm = GaussianMixture(n_components=n_clusters, random_state=42)
                    gmm_labels = gmm.fit_predict(X_cluster)
                    cluster_labels_all["Gaussian Mixture"] = gmm_labels
                    sil = silhouette_score(X_cluster, gmm_labels)
                    db  = davies_bouldin_score(X_cluster, gmm_labels)
                    cluster_results.append({"Model": "Gaussian Mixture", "Silhouette": round(sil, 4),
                                            "Davies-Bouldin": round(db, 4), "Clusters": n_clusters})
                except Exception as e:
                    st.warning(f"GMM failed: {e}")

            cr_df = pd.DataFrame(cluster_results)
            st.session_state.cluster_results  = cr_df
            st.session_state.unsupervised_done = True

            st.markdown("### 📊 Clustering Comparison")
            st.dataframe(
                cr_df.style.highlight_max(subset=["Silhouette"],     color="#2d6a4f")
                     .highlight_min(subset=["Davies-Bouldin"],       color="#2d6a4f")
                     .format(precision=4),
                use_container_width=True, hide_index=True,
            )

            fig = px.bar(cr_df, x="Model", y="Silhouette",
                         color="Silhouette", color_continuous_scale="Viridis",
                         title="Silhouette Score Comparison", text="Silhouette")
            fig.update_layout(template="plotly_dark")
            fig.update_traces(texttemplate="%{text:.4f}", textposition="outside")
            st.plotly_chart(fig, use_container_width=True)

            st.markdown("### 🗺️ Cluster Visualization (PCA 2D)")
            if X_cluster.shape[1] >= 2:
                pca   = PCA(n_components=2)
                X_pca = pca.fit_transform(X_cluster)
                cols  = st.columns(2)
                for idx, (name, labels) in enumerate(cluster_labels_all.items()):
                    with cols[idx % 2]:
                        scatter_df = pd.DataFrame({
                            "PC1": X_pca[:, 0], "PC2": X_pca[:, 1],
                            "Cluster": labels.astype(str),
                        })
                        fig = px.scatter(scatter_df, x="PC1", y="PC2", color="Cluster",
                                         title=name,
                                         color_discrete_sequence=px.colors.qualitative.Set2)
                        fig.update_layout(template="plotly_dark", height=400)
                        st.plotly_chart(fig, use_container_width=True)


# ══════════════════════════════════════════════
# 7. BEST MODEL
# ══════════════════════════════════════════════
elif section_key == "Best Model":
    st.markdown('<h1 class="main-header">Best Model Selection</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    if not st.session_state.supervised_done:
        st.warning("⚠️ Please train supervised models first.")
    else:
        best_name  = st.session_state.best_model_name
        results_df = st.session_state.model_results
        task       = st.session_state.task_type

        st.markdown(f"""
        <div style="text-align:center; padding: 2rem; background: linear-gradient(135deg, #1A1F2E, #252B3B);
                    border-radius: 16px; border: 2px solid #6C63FF; margin: 1rem 0;">
            <h2 style="color:#6C63FF; margin-bottom: 0.5rem;">🏆 Best Model</h2>
            <h1 style="color:#00D2FF; font-size: 2.5rem;">{best_name}</h1>
        </div>
        """, unsafe_allow_html=True)

        best_row = results_df[results_df["Model"] == best_name].iloc[0]
        if task == "Classification":
            c1, c2, c3, c4 = st.columns(4)
            c1.metric("Accuracy",  f"{best_row['Accuracy']:.4f}")
            c2.metric("Precision", f"{best_row['Precision']:.4f}")
            c3.metric("Recall",    f"{best_row['Recall']:.4f}")
            c4.metric("F1 Score",  f"{best_row['F1 Score']:.4f}")
        else:
            c1, c2, c3 = st.columns(3)
            c1.metric("MAE",      f"{best_row['MAE']:.4f}")
            c2.metric("MSE",      f"{best_row['MSE']:.4f}")
            c3.metric("R² Score", f"{best_row['R² Score']:.4f}")

        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

        st.markdown("### 📈 Learning Curve")
        with st.spinner("Generating learning curve…"):
            best_model = st.session_state.best_model
            X_full = pd.concat([st.session_state.X_train, st.session_state.X_test])
            y_full = pd.concat([st.session_state.y_train, st.session_state.y_test])

            # Sample for learning curve if large
            MAX_LC_ROWS = 20_000
            if len(X_full) > MAX_LC_ROWS:
                lc_idx = np.random.default_rng(42).choice(len(X_full), MAX_LC_ROWS, replace=False)
                X_lc = X_full.iloc[lc_idx]
                y_lc = y_full.iloc[lc_idx]
            else:
                X_lc, y_lc = X_full, y_full

            scoring = "accuracy" if task == "Classification" else "r2"
            if task == "Classification":
                min_class_size = int(y_lc.value_counts().min())
                lc_cv = max(2, min(5, min_class_size))
            else:
                lc_cv = 5

            try:
                train_sizes, train_scores, val_scores = learning_curve(
                    best_model, X_lc, y_lc, cv=lc_cv,
                    train_sizes=np.linspace(0.1, 1.0, 10),
                    scoring=scoring, n_jobs=-1,
                )
                lc_df = pd.DataFrame({
                    "Training Size": np.tile(train_sizes, 2),
                    "Score": np.concatenate([train_scores.mean(axis=1), val_scores.mean(axis=1)]),
                    "Type": ["Train"] * len(train_sizes) + ["Validation"] * len(train_sizes),
                })
                fig = px.line(lc_df, x="Training Size", y="Score", color="Type",
                              title=f"Learning Curve — {best_name}",
                              color_discrete_map={"Train": "#6C63FF", "Validation": "#00D2FF"})
                fig.update_layout(template="plotly_dark", height=400)
                st.plotly_chart(fig, use_container_width=True)
            except Exception as e:
                st.warning(f"Could not generate learning curve: {e}")

        st.markdown("### 📋 All Model Results")
        st.dataframe(results_df, use_container_width=True, hide_index=True)

        if st.session_state.cluster_results is not None:
            st.markdown("### 🔮 Clustering Results")
            st.dataframe(st.session_state.cluster_results, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════
# 8. PREDICTION  (UPDATED – smart dropdowns + number inputs)
# ══════════════════════════════════════════════
elif section_key == "Prediction":
    st.markdown('<h1 class="main-header">Make Predictions</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
 
    if st.session_state.best_model is None:
        st.warning("⚠️ Please train models to enable predictions.")
    else:
        best     = st.session_state.best_model
        features = st.session_state.feature_columns
        task     = st.session_state.task_type
 
        st.markdown(
            f'<div class="info-box">Using <strong>{st.session_state.best_model_name}</strong> '
            f'for {task.lower()} predictions.</div>',
            unsafe_allow_html=True,
        )
 
        # ── Recover original (pre-encoding) dataframe for unique values ──
        # We need the RAW df so we can show real category labels.
        raw_df = st.session_state.df          # original uploaded df (may still be category dtype)
        label_encoders = st.session_state.label_encoders   # {col: LabelEncoder}
 
        # Build a lookup: feature_name → list of original string labels (only for categoricals)
        # We also need to know which one-hot columns map back to which original column + value.
        original_cat_cols = {}   # feature col name (after encoding) → ("orig_col", "value") or None
 
        # Detect one-hot columns: they follow the pattern  {orig_col}_{value}
        # We check if the prefix matches a column in the raw df.
        raw_cols = set(raw_df.columns.tolist())
 
        def _find_ohe_origin(feat_name, raw_cols):
            """Return (orig_col, category_value) if feat_name is a one-hot column, else None."""
            for rc in raw_cols:
                prefix = rc + "_"
                if feat_name.startswith(prefix):
                    value = feat_name[len(prefix):]
                    return rc, value
            return None
 
        # Categorise every feature column
        ohe_groups = {}           # orig_col → list of (feat_name, value)
        label_encoded_feats = {}  # feat_name → LabelEncoder
        plain_numeric_feats = []  # feat_name  (truly numeric, no encoding)
 
        for feat in features:
            if feat in label_encoders:
                label_encoded_feats[feat] = label_encoders[feat]
            else:
                ohe_info = _find_ohe_origin(feat, raw_cols)
                if ohe_info is not None:
                    orig_col, val = ohe_info
                    ohe_groups.setdefault(orig_col, []).append((feat, val))
                else:
                    plain_numeric_feats.append(feat)
 
        # ── Build the UI ──────────────────────────────────────────────────
        st.markdown("### ✏️ Enter Feature Values")
 
        input_values = {}   # feat_name → numeric value ready for model
 
        # -- 1. Label-encoded categoricals → selectbox showing original labels --
        if label_encoded_feats:
            st.markdown("#### 🏷️ Categorical Features")
            cols_le = st.columns(3)
            for idx, (feat, le) in enumerate(label_encoded_feats.items()):
                with cols_le[idx % 3]:
                    options = list(le.classes_)
                    # Default to the most-frequent class in training data if possible
                    try:
                        train_series = st.session_state.X_train[feat]
                        mode_code    = int(train_series.mode()[0])
                        default_lbl  = le.inverse_transform([mode_code])[0]
                        default_idx  = options.index(default_lbl)
                    except Exception:
                        default_idx = 0
 
                    chosen = st.selectbox(
                        feat, options=options, index=default_idx, key=f"pred_le_{feat}"
                    )
                    input_values[feat] = int(le.transform([chosen])[0])
 
        # -- 2. One-hot-encoded groups → one selectbox per original column --
        if ohe_groups:
            st.markdown("#### 🗂️ Category Features (One-Hot Encoded)")
            cols_ohe = st.columns(3)
            ohe_col_idx = 0
            for orig_col, feat_val_pairs in ohe_groups.items():
                with cols_ohe[ohe_col_idx % 3]:
                    # Collect the possible values for this original column
                    # Also add the "drop_first" baseline (the dropped category) if we can detect it
                    ohe_values = [v for _, v in feat_val_pairs]
 
                    # Try to get the full list from the raw df to add the baseline category
                    if orig_col in raw_df.columns:
                        all_raw_vals = raw_df[orig_col].dropna().astype(str).unique().tolist()
                        # Baseline = values in raw df not present in ohe_values
                        baselines = [v for v in all_raw_vals if v not in ohe_values]
                        full_options = baselines + ohe_values   # baseline first
                    else:
                        # Fallback: add a generic "Other (baseline)" option
                        full_options = ["(baseline / other)"] + ohe_values
 
                    chosen_val = st.selectbox(
                        orig_col, options=full_options, index=0, key=f"pred_ohe_{orig_col}"
                    )
                    # Set all one-hot features for this group
                    for feat_name, val in feat_val_pairs:
                        input_values[feat_name] = 1.0 if chosen_val == val else 0.0
 
                ohe_col_idx += 1
 
        # -- 3. Numeric features → number_input (same as before) --
        if plain_numeric_feats:
            st.markdown("#### 🔢 Numeric Features")
            cols_num = st.columns(3)
            for idx, feat in enumerate(plain_numeric_feats):
                with cols_num[idx % 3]:
                    col_data = st.session_state.X_train[feat]
                    default  = float(col_data.median())
                    mn, mx   = float(col_data.min()), float(col_data.max())
                    input_values[feat] = st.number_input(
                        feat, value=default, format="%.4f", key=f"pred_num_{feat}"
                    )
 
        st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
 
        if st.button("🎯 Predict", use_container_width=True):
            # Build the input in the correct column order
            input_df = pd.DataFrame([[input_values[f] for f in features]], columns=features)
 
            if st.session_state.scaler is not None:
                input_df = pd.DataFrame(
                    st.session_state.scaler.transform(input_df),
                    columns=features,
                )
 
            prediction = best.predict(input_df)[0]
 
            # Decode target if it was label-encoded
            target_col = st.session_state.target_col
            if target_col in st.session_state.label_encoders:
                le = st.session_state.label_encoders[target_col]
                try:
                    prediction = le.inverse_transform([int(prediction)])[0]
                except Exception:
                    pass
 
            st.markdown(f"""
            <div style="text-align:center; padding: 2rem;
                        background: linear-gradient(135deg, #1a3a2a, #1A1F2E);
                        border-radius: 16px; border: 2px solid #00D26A; margin: 1rem 0;">
                <h3 style="color:#888;">Prediction Result</h3>
                <h1 style="color:#00D26A; font-size: 3rem;">{prediction}</h1>
            </div>
            """, unsafe_allow_html=True)
 
            record = {f: input_values[f] for f in features}
            record["Prediction"] = prediction
            st.session_state.prediction_history.append(record)
 
        if st.session_state.prediction_history:
            st.markdown("### 📜 Prediction History")
            hist_df = pd.DataFrame(st.session_state.prediction_history)
            st.dataframe(hist_df, use_container_width=True, hide_index=True)


# ══════════════════════════════════════════════
# 9. DOWNLOAD RESULTS
# ══════════════════════════════════════════════
elif section_key == "Download Results":
    st.markdown('<h1 class="main-header">Download Results</h1>', unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    st.markdown("### 📦 Available Downloads")

    c1, c2 = st.columns(2)

    with c1:
        st.markdown("#### 🤖 Best Trained Model (.pkl)")
        if st.session_state.best_model is not None:
            model_bytes = pickle.dumps(st.session_state.best_model)
            st.download_button(
                "⬇️ Download Model",
                data=model_bytes,
                file_name=f"{st.session_state.best_model_name.replace(' ', '_')}_model.pkl",
                mime="application/octet-stream",
                use_container_width=True,
            )
        else:
            st.info("Train models first.")

    with c2:
        st.markdown("#### 📄 Processed Dataset (.csv)")
        if st.session_state.df_processed is not None:
            csv_data = st.session_state.df_processed.to_csv(index=False)
            st.download_button(
                "⬇️ Download Processed Data",
                data=csv_data,
                file_name="processed_dataset.csv",
                mime="text/csv",
                use_container_width=True,
            )
        else:
            st.info("Process data first.")

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    c3, c4 = st.columns(2)

    with c3:
        st.markdown("#### 🎯 Prediction Results (.csv)")
        if st.session_state.prediction_history:
            pred_df  = pd.DataFrame(st.session_state.prediction_history)
            csv_pred = pred_df.to_csv(index=False)
            st.download_button(
                "⬇️ Download Predictions",
                data=csv_pred,
                file_name="prediction_results.csv",
                mime="text/csv",
                use_container_width=True,
            )
        else:
            st.info("Make some predictions first.")

    with c4:
        st.markdown("#### 📊 Model Comparison Report (.csv)")
        if st.session_state.model_results is not None:
            report_csv = st.session_state.model_results.to_csv(index=False)
            st.download_button(
                "⬇️ Download Report",
                data=report_csv,
                file_name="model_comparison_report.csv",
                mime="text/csv",
                use_container_width=True,
            )
        else:
            st.info("Train models first.")

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)
    st.markdown("#### 🔮 Clustering Report (.csv)")
    if st.session_state.cluster_results is not None:
        clust_csv = st.session_state.cluster_results.to_csv(index=False)
        st.download_button(
            "⬇️ Download Clustering Report",
            data=clust_csv,
            file_name="clustering_report.csv",
            mime="text/csv",
            use_container_width=True,
        )
    else:
        st.info("Train clustering models first.")
        