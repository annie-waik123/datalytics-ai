"""
ML Analytics Platform - Industry-level Machine Learning Analytics
A comprehensive single-file Streamlit application for data analysis, ML modeling, and insights.
"""

import streamlit as st
import pandas as pd
import numpy as np
import pickle
import io
import warnings
import gc
import base64
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Tuple, Any, Optional

# Data processing and ML
from sklearn.model_selection import train_test_split, cross_val_score, learning_curve
from sklearn.preprocessing import (
    StandardScaler, MinMaxScaler, LabelEncoder, OneHotEncoder, RobustScaler
)
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report,
    mean_absolute_error, mean_squared_error, r2_score,
    silhouette_score, davies_bouldin_score
)

# Supervised models
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
)
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.svm import SVC, SVR
from sklearn.naive_bayes import GaussianNB
from sklearn.cluster import KMeans, AgglomerativeClustering, DBSCAN
from sklearn.decomposition import PCA
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis

# Advanced models
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# Visualization
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# PDF and Excel
try:
    from fpdf import FPDF
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import openpyxl
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

# AI Insights
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

# Imbalanced learning
try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    SMOTE_AVAILABLE = False

# Suppress warnings
warnings.filterwarnings('ignore')

# Set page configuration
st.set_page_config(
    layout="wide",
    page_icon="🧠",
    page_title="ML Analytics Platform",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
.metric-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem;
    border-radius: 10px;
    color: white;
    margin: 0.5rem 0;
}
.progress-step {
    background: #f0f2f6;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    margin: 0.25rem 0;
    border-left: 4px solid #6366f1;
}
.progress-step.completed {
    background: #dcfce7;
    border-left-color: #22c55e;
}
.progress-step.active {
    background: #fef3c7;
    border-left-color: #f59e0b;
}
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
}
.status-ready { background: #dcfce7; color: #166534; }
.status-pending { background: #fef3c7; color: #92400e; }
.status-error { background: #fee2e2; color: #991b1b; }
.chat-message {
    padding: 1rem;
    border-radius: 10px;
    margin: 0.5rem 0;
}
.user-message { background: #eff6ff; border-left: 4px solid #3b82f6; }
.ai-message { background: #f0fdf4; border-left: 4px solid #22c55e; }
</style>
""", unsafe_allow_html=True)

# Initialize session state
def init_session_state():
    """Initialize all session state variables"""
    defaults = {
        'raw_df': None,
        'cleaned_df': None,
        'target_col': None,
        'feature_cols': [],
        'preprocessing_config': {},
        'X_train': None,
        'X_test': None,
        'y_train': None,
        'y_test': None,
        'trained_models': {},
        'best_model_name': None,
        'best_model': None,
        'cluster_labels': None,
        'pca_result': None,
        'predictions_df': None,
        'groq_api_key': 'your_groq_api_key_here',
        'chat_history': [],
        'active_section': 'Upload & Clean',
        'data_health_score': 0,
        'prediction_step': 0,
        'model_type': None,  # 'classification' or 'regression'
        'original_categorical_maps': {},
        'model_metrics': {}
    }
    
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

# Sidebar Navigation
def render_sidebar():
    """Render sidebar with navigation and dataset info"""
    st.sidebar.markdown("## 🧠 ML Analytics Platform")
    
    # Navigation
    sections = [
        'Upload & Clean'
    ]
    
    st.session_state.active_section = st.sidebar.radio(
        "Navigate to:",
        sections,
        key='nav_radio'
    )
    
    # Dataset Info Card
    if st.session_state.cleaned_df is not None:
        st.sidebar.markdown("---")
        st.sidebar.markdown("### 📊 Dataset Info")
        df = st.session_state.cleaned_df
        st.sidebar.metric("Rows", f"{df.shape[0]:,}")
        st.sidebar.metric("Columns", f"{df.shape[1]:,}")
        st.sidebar.metric("Health Score", f"{st.session_state.data_health_score:.1f}%")
        
        if st.session_state.target_col:
            st.sidebar.metric("Target", st.session_state.target_col)

# Utility Functions
@st.cache_data
def load_sample_data():
    """Load sample dataset for demo mode"""
    from sklearn.datasets import load_iris
    try:
        # Try to load iris dataset
        data = load_iris()
        df = pd.DataFrame(data.data, columns=data.feature_names)
        df['target'] = data.target
        return df
    except:
        # Fallback to create synthetic data
        np.random.seed(42)
        df = pd.DataFrame({
            'feature_1': np.random.normal(0, 1, 1000),
            'feature_2': np.random.normal(0, 1, 1000),
            'feature_3': np.random.choice(['A', 'B', 'C'], 1000),
            'target': np.random.choice([0, 1], 1000)
        })
        return df

def calculate_data_health_score(df):
    """Calculate data health score based on missing values and duplicates"""
    missing_ratio = df.isnull().sum().sum() / (df.shape[0] * df.shape[1])
    duplicate_ratio = df.duplicated().sum() / df.shape[0]
    
    # Health score: 100% - (missing_ratio * 50) - (duplicate_ratio * 50)
    health_score = max(0, 100 - (missing_ratio * 50) - (duplicate_ratio * 50))
    return health_score

def auto_clean_data(df):
    """Automatically clean the dataset"""
    # Remove duplicates
    df_clean = df.drop_duplicates().copy()
    
    # Calculate missing values
    missing_percentages = (df_clean.isnull().sum() / len(df_clean) * 100).round(2)
    
    # Auto-impute missing values
    for col in df_clean.columns:
        if df_clean[col].isnull().sum() > 0:
            if df_clean[col].dtype in ['int64', 'float64']:
                # Numeric: median imputation
                df_clean[col].fillna(df_clean[col].median(), inplace=True)
            else:
                # Categorical: mode imputation
                mode_val = df_clean[col].mode()
                if not mode_val.empty:
                    df_clean[col].fillna(mode_val[0], inplace=True)
    
    return df_clean, missing_percentages

def detect_column_types(df):
    """Detect column types automatically"""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    datetime_cols = df.select_dtypes(include=['datetime64']).columns.tolist()
    
    return {
        'numeric': numeric_cols,
        'categorical': categorical_cols,
        'datetime': datetime_cols
    }

def get_model_metrics(model, X_test, y_test, model_type):
    """Get model performance metrics"""
    y_pred = model.predict(X_test)
    
    if model_type == 'classification':
        return {
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred, average='weighted', zero_division=0),
            'recall': recall_score(y_test, y_pred, average='weighted', zero_division=0),
            'f1': f1_score(y_test, y_pred, average='weighted', zero_division=0)
        }
    else:
        return {
            'mae': mean_absolute_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred)
        }

# Section 01: Dataset Upload & Auto Cleaning
def render_upload_clean():
    """Render dataset upload and cleaning section"""
    st.markdown("## 📁 Dataset Upload & Auto Cleaning")
    
    # File upload
    uploaded_file = st.file_uploader(
        "Upload your dataset (CSV or Excel):",
        type=['csv', 'xlsx', 'xls']
    )
    
    if uploaded_file is not None:
        try:
            # Load data
            if uploaded_file.name.endswith('.csv'):
                df = pd.read_csv(uploaded_file)
            else:
                df = pd.read_excel(uploaded_file)
            
            st.session_state.raw_df = df
            st.success(f"✅ Dataset loaded successfully! Shape: {df.shape}")
            
            # Auto preview dataset immediately after upload
            st.markdown("### 📊 Dataset Preview")
            st.dataframe(df.head(), use_container_width=True)
            
            # Show basic dataset info
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Rows", f"{df.shape[0]:,}")
            with col2:
                st.metric("Columns", f"{df.shape[1]:,}")
            with col3:
                missing_count = df.isnull().sum().sum()
                st.metric("Missing Values", f"{missing_count:,}")
            
        except Exception as e:
            st.error(f"❌ Error loading file: {str(e)}")
            return
    
    # Demo mode
    if st.session_state.raw_df is None:
        st.markdown("---")
        st.markdown("### 🎯 Demo Mode")
        if st.button("Load Sample Dataset"):
            st.session_state.raw_df = load_sample_data()
            st.success("✅ Sample dataset loaded!")
    
    # Show preview for demo mode dataset
    if st.session_state.raw_df is not None and st.session_state.cleaned_df is None:
        df = st.session_state.raw_df
        st.markdown("### 📊 Dataset Preview")
        st.dataframe(df.head(), use_container_width=True)
        
        # Show basic dataset info
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Rows", f"{df.shape[0]:,}")
        with col2:
            st.metric("Columns", f"{df.shape[1]:,}")
        with col3:
            missing_count = df.isnull().sum().sum()
            st.metric("Missing Values", f"{missing_count:,}")
    
    # Auto cleaning
    if st.session_state.raw_df is not None:
        st.markdown("### 🧹 Auto Cleaning Results")
        
        with st.spinner("Cleaning dataset..."):
            cleaned_df, missing_percentages = auto_clean_data(st.session_state.raw_df)
            st.session_state.cleaned_df = cleaned_df
            st.session_state.data_health_score = calculate_data_health_score(cleaned_df)
        
        # Show cleaning results
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Original Rows", f"{st.session_state.raw_df.shape[0]:,}")
        with col2:
            st.metric("Cleaned Rows", f"{cleaned_df.shape[0]:,}")
        with col3:
            st.metric("Health Score", f"{st.session_state.data_health_score:.1f}%")
        
        # Missing values table
        if missing_percentages.sum() > 0:
            st.markdown("#### Missing Values (Before Cleaning)")
            missing_df = pd.DataFrame({
                'Column': missing_percentages.index,
                'Missing %': missing_percentages.values
            })
            missing_df = missing_df[missing_df['Missing %'] > 0]
            st.dataframe(missing_df, use_container_width=True)
        
        # Column types
        col_types = detect_column_types(cleaned_df)
        st.markdown("#### Detected Column Types")
        
        type_cols = st.columns(3)
        with type_cols[0]:
            st.write("**Numeric:**")
            for col in col_types['numeric']:
                st.write(f"• {col}")
        
        with type_cols[1]:
            st.write("**Categorical:**")
            for col in col_types['categorical']:
                st.write(f"• {col}")
        
        with type_cols[2]:
            st.write("**Datetime:**")
            for col in col_types['datetime']:
                st.write(f"• {col}")
        
        # Show cleaned data preview
        st.markdown("#### Cleaned Data Preview")
        st.dataframe(cleaned_df.head(), use_container_width=True)

# Main application
def main():
    """Main application function"""
    # Initialize session state
    init_session_state()
    
    # Render sidebar
    render_sidebar()
    
    # Main content based on active section
    if st.session_state.active_section == 'Upload & Clean':
        render_upload_clean()
    
    # Footer
    st.markdown("---")
    st.markdown(
        "<center><small>🧠 ML Analytics Platform | Built with Streamlit</small></center>",
        unsafe_allow_html=True
    )

if __name__ == "__main__":
    main()
