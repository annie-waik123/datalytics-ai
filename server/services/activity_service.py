from __future__ import annotations

import datetime
from database import get_db


async def log_activity(
    email: str | None,
    action: str,
    category: str,
    details: str = "",
    metadata: dict = None,
) -> None:
    """
    Log an activity into the database if the user is authenticated.
    category must be one of: datasets | models | dashboards | reports | queries
    """
    if not email:
        return

    db = get_db()
    activity_doc = {
        "email": email,
        "action": action,              # e.g., "Upload", "Train", "Report"
        "category": category,          # e.g., "datasets", "models", "reports"
        "details": details,            # short summary like dataset name
        "metadata": metadata or {},    # extra properties like size, accuracy, etc.
        "timestamp": datetime.datetime.utcnow(),
    }

    await db["activities"].insert_one(activity_doc)


async def get_user_activities_summary(email: str) -> dict:
    """
    Retrieve full user activity history & daily counts for heatmap over the past 365 days.
    Returns a unified payload for the frontend workspace state.
    Only counts from TODAY onwards for the heatmap (fresh start semantics).
    """
    db = get_db()
    now = datetime.datetime.utcnow()
    one_year_ago = now - datetime.timedelta(days=365)

    # Fetch raw activities (last 365 days)
    cursor = db["activities"].find(
        {"email": email, "timestamp": {"$gte": one_year_ago}}
    ).sort("timestamp", -1)

    activities = await cursor.to_list(length=2000)

    # Generate Heatmap dict mapping: "YYYY-MM-DD" -> count
    heatmap_counts: dict[str, int] = {}

    # Generate categorised lists for Work Tables
    work: dict[str, list] = {
        "datasets": [],
        "models": [],
        "dashboards": [],
        "reports": [],
    }

    for act in activities:
        ts = act.get("timestamp")
        if ts:
            date_str = ts.strftime("%Y-%m-%d")
            heatmap_counts[date_str] = heatmap_counts.get(date_str, 0) + 1

        cat = act.get("category")
        if cat in work:
            work[cat].append(
                {
                    "id": str(act["_id"]),
                    "name": act.get("details", "Asset"),
                    "status": "Active",
                    "type": act.get("action", "unknown"),
                    "createdDate": ts.strftime("%b %d, %Y") if ts else "Unknown",
                    "lastModified": ts.strftime("%b %d, %Y") if ts else "Unknown",
                }
            )

    # Cap each table at 25 most-recent items
    for key in work:
        work[key] = work[key][:25]

    return {"work": work, "heatmap": heatmap_counts}


async def reset_user_activities(email: str) -> int:
    """
    Hard-delete ALL activity records for the given user from MongoDB.
    Returns the number of deleted documents.
    """
    db = get_db()
    result = await db["activities"].delete_many({"email": email})
    return result.deleted_count


async def get_user_kpi_counts(email: str) -> dict:
    """
    Return aggregated KPI counts per category for the given user.
    Aggregates directly from MongoDB — no localStorage, no mock data.
    Each KPI is counted by its SPECIFIC action type to prevent double counting.
    """
    db = get_db()

    def make_pipeline(action_filter: dict) -> list:
        return [
            {"$match": {"email": email, **action_filter}},
            {"$count": "total"},
        ]

    async def count_action(action_filter: dict) -> int:
        cursor = db["activities"].aggregate(make_pipeline(action_filter))
        docs = await cursor.to_list(length=1)
        return docs[0]["total"] if docs else 0

    # Count strictly by action name to prevent any category confusion
    datasets   = await count_action({"action": "Upload"})
    models     = await count_action({"action": "Train"})
    dashboards = await count_action({"action": {"$in": ["Visualize", "Dashboard"]}})
    reports    = await count_action({"action": "Report"})
    queries    = await count_action({"action": {"$in": ["Query", "Chat", "Decision"]}})

    acc = {
        "datasets":   datasets,
        "models":     models,
        "dashboards": dashboards,
        "reports":    reports,
        "queries":    queries,
    }

    # Pipeline completion: percentage of categories that have at least 1 entry
    filled = sum(1 for v in acc.values() if v > 0)
    acc["pipeline_completion"] = round((filled / 5) * 100, 1)

    return acc


async def get_last_session(email: str) -> dict:
    """
    Returns the most recent dataset upload and all pipeline actions
    performed after that upload (exploration, preparation, visualization,
    model training, dashboard, AI queries, reports, etc.)
    """
    db = get_db()

    # Find the last upload event
    last_upload = await db["activities"].find_one(
        {"email": email, "action": "Upload"},
        sort=[("timestamp", -1)],
    )

    if not last_upload:
        return {"has_session": False}

    upload_ts = last_upload.get("timestamp")

    # Fetch all activities after the last upload
    cursor = db["activities"].find(
        {"email": email, "timestamp": {"$gte": upload_ts}},
    ).sort("timestamp", 1)

    activities = await cursor.to_list(length=200)

    pipeline_steps = []
    for act in activities:
        ts = act.get("timestamp")
        action = act.get("action", "")
        category = act.get("category", "")
        details = act.get("details", "")

        # Map to friendly step label
        label_map = {
            "Upload":    ("📂", "Dataset Uploaded",       "datasets"),
            "Explore":   ("🔍", "Data Explored",           "datasets"),
            "Prepare":   ("🧹", "Data Prepared",           "datasets"),
            "Visualize": ("📊", "Chart Created",           "dashboards"),
            "Train":     ("🤖", "Model Trained",           "models"),
            "Dashboard": ("📈", "Dashboard Created",       "dashboards"),
            "Report":    ("📄", "Report Generated",        "reports"),
            "Chat":      ("💬", "Chatbot Query",           "queries"),
            "Query":     ("🧠", "AI Insight Query",        "queries"),
            "Decision":  ("🎯", "Decision Analysis",       "queries"),
        }
        icon, label, cat = label_map.get(action, ("⚡", action, category))

        pipeline_steps.append({
            "action": action,
            "icon": icon,
            "label": label,
            "details": details,
            "category": cat,
            "time": ts.strftime("%I:%M %p") if ts else "—",
            "timestamp_iso": ts.isoformat() if ts else None,
        })

    return {
        "has_session": True,
        "dataset_name": last_upload.get("details", "Dataset"),
        "upload_time": upload_ts.strftime("%b %d, %Y · %I:%M %p") if upload_ts else "—",
        "upload_timestamp_iso": upload_ts.isoformat() if upload_ts else None,
        "rows": last_upload.get("metadata", {}).get("rows", 0),
        "columns": last_upload.get("metadata", {}).get("columns", 0),
        "pipeline_steps": pipeline_steps,
        "total_actions": len(pipeline_steps),
    }
