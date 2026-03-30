"""
Reports router — GET /api/report/download
Generates a full JSON + HTML analysis report.
"""
from __future__ import annotations

import json
import os
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import JSONResponse, HTMLResponse

from state.session_store import store
from services.recommendation_service import (
    get_data_quality_score,
    get_statistical_insights,
    get_business_insights,
    get_model_recommendations,
)

router = APIRouter()


def _build_report_data(session, session_id: str) -> dict:
    if session.df is None:
        raise HTTPException(status_code=404, detail="No dataset uploaded.")

    df = session.df
    results = session.model_results or []
    task_type = session.task_type or "N/A"
    best_model_name = session.best_model_name or "N/A"
    feature_columns = session.feature_columns or []

    quality = get_data_quality_score(df)
    stat_insights = get_statistical_insights(df)
    biz_insights = get_business_insights(df)
    model_recs = get_model_recommendations(results, task_type, best_model_name) if results else []

    # Dataset summary
    num_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    missing_total = int(df.isnull().sum().sum())

    desc = {}
    try:
        desc_df = df.describe().round(3)
        desc = desc_df.to_dict()
    except Exception:
        pass

    return {
        "report_id": f"RPT-{session_id[:8].upper()}",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "dataset_summary": {
            "rows": len(df),
            "cols": df.shape[1],
            "numeric_columns": num_cols,
            "categorical_columns": cat_cols,
            "missing_values": missing_total,
            "missing_pct": round(missing_total / max(df.size, 1) * 100, 2),
        },
        "quality_score": quality,
        "descriptive_stats": desc,
        "statistical_insights": stat_insights,
        "business_insights": biz_insights,
        "model_results": results,
        "model_recommendations": model_recs,
        "best_model": best_model_name,
        "task_type": task_type,
        "feature_columns": feature_columns,
    }


@router.get("/report/json")
async def report_json(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    data = _build_report_data(session, x_session_id)
    return JSONResponse(data)


@router.get("/report/html")
async def report_html(
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    session = store.get(x_session_id)
    data = _build_report_data(session, x_session_id)

    # Generate severity badge colors
    sev_color = {"critical": "#ef4444", "warning": "#f59e0b", "info": "#3b82f6", "success": "#10b981"}

    insights_html = ""
    for ins in data["statistical_insights"] + data["business_insights"]:
        color = sev_color.get(ins.get("severity", "info"), "#3b82f6")
        insights_html += f"""
        <div style="border-left:4px solid {color};padding:12px 16px;margin:8px 0;background:#1e293b;border-radius:0 8px 8px 0">
          <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">{ins.get('category','')} &nbsp;|&nbsp; {ins.get('icon','')} {ins.get('severity','').upper()}</div>
          <div style="font-weight:600;color:#f1f5f9;margin-bottom:4px">{ins.get('title','')}</div>
          <div style="color:#cbd5e1;font-size:13px">{ins.get('description','')}</div>
          <div style="color:#7dd3fc;font-size:12px;margin-top:6px">→ {ins.get('action','')}</div>
        </div>"""

    models_html = ""
    for r in data["model_results"]:
        model_name = r.get("Model", "")
        metrics = {k: v for k, v in r.items() if k != "Model"}
        metric_cells = "".join(
            f"<td style='padding:8px 12px;color:#94a3b8;font-size:13px'>{v}</td>"
            for k, v in metrics.items() if v is not None
        )
        metric_heads = "".join(
            f"<th style='padding:8px 12px;color:#7dd3fc;font-size:12px;font-weight:600;text-transform:uppercase'>{k}</th>"
            for k in metrics.keys() if metrics[k] is not None
        )
        models_html += f"<tr><td style='padding:8px 12px;color:#f1f5f9;font-weight:600'>{model_name}</td>{metric_cells}</tr>"

    quality = data["quality_score"]
    grade_color = {"A": "#10b981", "B": "#3b82f6", "C": "#f59e0b", "D": "#ef4444", "F": "#7f1d1d"}.get(quality.get("grade", "F"), "#94a3b8")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Datalytics Report — {data['report_id']}</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px}}
  .header{{background:linear-gradient(135deg,#1e40af,#7c3aed);padding:32px;border-radius:16px;margin-bottom:24px}}
  .title{{font-size:28px;font-weight:800;color:#fff;margin-bottom:4px}}
  .subtitle{{color:#bfdbfe;font-size:14px}}
  .card{{background:#1e293b;border-radius:12px;padding:24px;margin-bottom:20px;border:1px solid #334155}}
  .card-title{{font-size:16px;font-weight:700;color:#f1f5f9;margin-bottom:16px;border-bottom:1px solid #334155;padding-bottom:10px}}
  .grade-badge{{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;border-radius:50%;font-size:28px;font-weight:900;background:{grade_color};color:#fff;margin-right:16px}}
  .metric-grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}}
  .metric-box{{background:#0f172a;border-radius:8px;padding:12px 16px;text-align:center}}
  .metric-val{{font-size:24px;font-weight:800;color:#7dd3fc}}
  .metric-label{{font-size:11px;color:#64748b;text-transform:uppercase;margin-top:4px}}
  table{{width:100%;border-collapse:collapse}}
  th{{background:#0f172a;text-align:left}}
  tr:nth-child(even){{background:#0f172a30}}
  .footer{{text-align:center;color:#475569;font-size:12px;margin-top:32px;padding-top:16px;border-top:1px solid #1e293b}}
</style>
</head>
<body>
<div class="header">
  <div class="title">📊 Datalytics Analysis Report</div>
  <div class="subtitle">Report ID: {data['report_id']} &nbsp;|&nbsp; Generated: {data['generated_at']} &nbsp;|&nbsp; Best Model: {data['best_model']}</div>
</div>

<div class="card">
  <div class="card-title">📁 Dataset Summary</div>
  <div class="metric-grid">
    <div class="metric-box"><div class="metric-val">{data['dataset_summary']['rows']:,}</div><div class="metric-label">Total Rows</div></div>
    <div class="metric-box"><div class="metric-val">{data['dataset_summary']['cols']}</div><div class="metric-label">Columns</div></div>
    <div class="metric-box"><div class="metric-val">{len(data['dataset_summary']['numeric_columns'])}</div><div class="metric-label">Numeric Cols</div></div>
    <div class="metric-box"><div class="metric-val">{len(data['dataset_summary']['categorical_columns'])}</div><div class="metric-label">Categorical Cols</div></div>
    <div class="metric-box"><div class="metric-val">{data['dataset_summary']['missing_pct']}%</div><div class="metric-label">Missing Values</div></div>
    <div class="metric-box"><div class="metric-val">{data['task_type']}</div><div class="metric-label">Task Type</div></div>
  </div>
</div>

<div class="card">
  <div class="card-title">🏅 Data Quality Score</div>
  <div style="display:flex;align-items:center;margin-bottom:16px">
    <div class="grade-badge">{quality.get('grade','?')}</div>
    <div>
      <div style="font-size:22px;font-weight:800;color:#f1f5f9">{quality.get('overall_score',0)}/100</div>
      <div style="color:#64748b;font-size:13px">Overall Quality Score</div>
    </div>
  </div>
  <div class="metric-grid">
    <div class="metric-box"><div class="metric-val">{quality.get('completeness',0)}</div><div class="metric-label">Completeness</div></div>
    <div class="metric-box"><div class="metric-val">{quality.get('uniqueness',0)}</div><div class="metric-label">Uniqueness</div></div>
    <div class="metric-box"><div class="metric-val">{quality.get('consistency',0)}</div><div class="metric-label">Consistency</div></div>
    <div class="metric-box"><div class="metric-val">{quality.get('duplicate_rows',0)}</div><div class="metric-label">Duplicate Rows</div></div>
  </div>
</div>

<div class="card">
  <div class="card-title">💡 Insights & Recommendations ({len(data['statistical_insights']) + len(data['business_insights'])} found)</div>
  {insights_html if insights_html else '<div style="color:#64748b">No issues detected. Dataset looks clean!</div>'}
</div>

{'<div class="card"><div class="card-title">🤖 Model Results</div><div style="overflow-x:auto"><table>' + models_html + '</table></div></div>' if data['model_results'] else ''}

<div class="footer">
  Generated by Datalytics AI Platform &nbsp;|&nbsp; {data['generated_at']}
</div>
</body>
</html>"""

    return HTMLResponse(content=html, media_type="text/html")
