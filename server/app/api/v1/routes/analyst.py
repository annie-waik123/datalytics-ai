"""
AI Analyst agent router (Feature 1).

POST /api/analyst/execute            → run the agent, return the structured report.
POST /api/analyst/execute/stream     → same run, streamed as Server-Sent Events so the
                                       UI can show real per-step activity as it happens.

Both endpoints run the exact same agent toolchain against the session dataset.
"""
from __future__ import annotations

import asyncio
import json
import logging
import queue
import threading

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.models.schemas import AnalystExecuteRequest, AnalystReport
from app.services.agent_service import run_agent
from app.services.data_engine_service import ensure_live_dataset
from app.state.session_store import store

log = logging.getLogger(__name__)
router = APIRouter()


def _clean_request(body: AnalystExecuteRequest) -> str:
    request_text = str(body.request or "").strip()
    if not request_text:
        raise HTTPException(status_code=400, detail="Request cannot be empty.")
    if len(request_text) > 2000:
        raise HTTPException(status_code=400, detail="Request is too long (max 2000 characters).")
    return request_text


async def _prepare_session(x_session_id: str):
    session = store.get(x_session_id)
    ready = await ensure_live_dataset(session, x_session_id)
    if not ready:
        raise HTTPException(
            status_code=404,
            detail="No dataset is available for the AI Analyst. Upload or sync a dataset first.",
        )
    return session


@router.post("/analyst/execute", response_model=AnalystReport)
async def analyst_execute(
    body: AnalystExecuteRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """Run the AI Data Analyst and return the full structured report."""
    request_text = _clean_request(body)
    session = await _prepare_session(x_session_id)
    try:
        report = run_agent(
            session,
            x_session_id,
            request_text,
            mode=body.mode or "auto",
            include_ml=body.include_ml,
            include_charts=body.include_charts,
            max_charts=body.max_charts or 3,
        )
    except HTTPException:
        raise
    except Exception as exc:
        log.error("analyst_execute: unhandled error: %s", exc)
        raise HTTPException(status_code=500, detail=f"AI Analyst run failed: {exc}")
    return JSONResponse(report)


@router.post("/analyst/execute/stream")
async def analyst_execute_stream(
    body: AnalystExecuteRequest,
    x_session_id: str = Header(..., alias="X-Session-ID"),
):
    """Run the AI Data Analyst and stream real step events over Server-Sent Events."""
    request_text = _clean_request(body)
    session = await _prepare_session(x_session_id)

    events: queue.Queue = queue.Queue(maxsize=32)
    stop_event = threading.Event()

    def worker() -> None:
        try:
            run_agent(
                session,
                x_session_id,
                request_text,
                emit=lambda event: _emit_or_drop(events, event, stop_event),
                mode=body.mode or "auto",
                include_ml=body.include_ml,
                include_charts=body.include_charts,
                max_charts=body.max_charts or 3,
            )
        except Exception as exc:  # never let the worker die silently
            log.error("analyst stream worker failed: %s", exc)
            _emit_or_drop(events, {"type": "error", "message": str(exc)}, stop_event)
        finally:
            try:
                events.put(None, timeout=1)
            except Exception:
                pass

    threading.Thread(target=worker, daemon=True, name="analyst-agent-run").start()

    async def event_generator():
        yield ": connected\n\n"
        while True:
            try:
                event = await asyncio.to_thread(events.get)
            except asyncio.CancelledError:
                stop_event.set()
                raise
            if event is None:
                break
            if event.get("type") == "result":
                # Compact event; clients should treat "report" as authoritative.
                yield f"event: result\ndata: {json.dumps(event, default=str)}\n\n"
                break
            if event.get("type") == "error":
                yield f"event: error\ndata: {json.dumps(event, default=str)}\n\n"
                break
            yield f"data: {json.dumps(event, default=str)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _emit_or_drop(q: queue.Queue, event: dict, stop_event: threading.Event) -> None:
    if stop_event.is_set():
        return
    try:
        q.put(event, timeout=0.2)
    except Exception:
        pass
