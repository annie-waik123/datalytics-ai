from __future__ import annotations

import io
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Iterator

import numpy as np
import pandas as pd
from fastapi import UploadFile

from services.cache_service import cache
from services.ml_service import (
    _csv_encoding_candidates,
    _csv_read_attempts,
    _decode_csv_sample,
    _sniff_csv_delimiter,
    build_dataset_snapshot,
    optimize_memory,
    sanitize_for_json,
    serialize_dataframe,
)

try:
    import dask.dataframe as dd  # type: ignore

    DASK_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    dd = None
    DASK_AVAILABLE = False


DATASET_ROOT = Path(__file__).resolve().parents[1] / ".cache" / "datasets"
UPLOAD_ROOT = Path(__file__).resolve().parents[1] / ".cache" / "uploads"
STREAM_CHUNK_BYTES = 5 * 1024 * 1024  # Increased to 5MB for faster streaming
PROFILE_CHUNK_ROWS = 100_000          # Increased from 50k
FRONTEND_SAMPLE_ROWS = 2_000         # Reduced from 5k for faster frontend load
INTERACTIVE_SAMPLE_ROWS = 20_000     # Reduced from 50k for faster initial profiling
MEMORY_FILE_SIZE_BYTES = 15 * 1024 * 1024  # Reduced from 25MB to favor disk-mode/sampling earlier
MEMORY_ROW_THRESHOLD = 50_000        # Reduced from 75k
UNIQUE_TRACK_LIMIT = 5_000           # Reduced from 10k
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}


def ensure_dataset_directories() -> None:
    DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


def _safe_name(filename: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in {"-", "_", "."} else "_" for char in filename or "dataset")
    return cleaned or "dataset"


def _session_dir(session_id: str) -> Path:
    path = DATASET_ROOT / session_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _upload_dir(upload_id: str) -> Path:
    path = UPLOAD_ROOT / upload_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _manifest_path(upload_id: str) -> Path:
    return _upload_dir(upload_id) / "manifest.json"


def _cache_prefix(session_id: str) -> str:
    return f"dataset:{session_id}:"


def create_session_upload_path(session_id: str, filename: str) -> Path:
    ensure_dataset_directories()
    safe_name = _safe_name(filename)
    return _session_dir(session_id) / f"{uuid.uuid4().hex}_{safe_name}"


def clear_dataset_cache(session_id: str) -> None:
    cache.delete_prefix(_cache_prefix(session_id))


def _write_manifest(upload_id: str, payload: dict[str, Any]) -> None:
    _manifest_path(upload_id).write_text(json.dumps(payload), encoding="utf-8")


def _read_manifest(upload_id: str) -> dict[str, Any]:
    payload = _manifest_path(upload_id).read_text(encoding="utf-8")
    return json.loads(payload)


def start_chunked_upload(
    *,
    session_id: str,
    filename: str,
    total_size: int,
    content_type: str | None = None,
    chunk_size: int = 5 * 1024 * 1024,
) -> dict[str, Any]:
    ensure_dataset_directories()
    upload_id = uuid.uuid4().hex
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("Only CSV, Excel, or JSON files are supported.")

    manifest = {
        "upload_id": upload_id,
        "session_id": session_id,
        "filename": _safe_name(filename),
        "total_size": int(total_size or 0),
        "content_type": content_type or "",
        "chunk_size": int(chunk_size),
        "uploaded_chunks": [],
    }
    _write_manifest(upload_id, manifest)
    return sanitize_for_json(manifest)


def append_chunk(upload_id: str, index: int, total_chunks: int, chunk_bytes: bytes) -> dict[str, Any]:
    manifest = _read_manifest(upload_id)
    chunk_file = _upload_dir(upload_id) / f"chunk-{index:06d}.part"
    chunk_file.write_bytes(chunk_bytes)

    uploaded = set(manifest.get("uploaded_chunks", []))
    uploaded.add(int(index))
    manifest["uploaded_chunks"] = sorted(uploaded)
    manifest["total_chunks"] = int(total_chunks)
    _write_manifest(upload_id, manifest)

    return {
        "upload_id": upload_id,
        "uploaded_chunks": len(manifest["uploaded_chunks"]),
        "total_chunks": int(total_chunks),
        "complete": len(manifest["uploaded_chunks"]) >= int(total_chunks),
    }


async def stream_upload_to_path(upload: UploadFile, destination: Path) -> int:
    ensure_dataset_directories()
    total = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as handle:
        while True:
            chunk = await upload.read(STREAM_CHUNK_BYTES)
            if not chunk:
                break
            handle.write(chunk)
            total += len(chunk)
    return total


def _read_small_file_bytes(path: Path) -> bytes:
    return path.read_bytes()


def _read_head_bytes(path: Path, size: int = 65_536) -> bytes:
    with path.open("rb") as handle:
        return handle.read(size)


def _load_json_bytes(file_bytes: bytes) -> pd.DataFrame:
    for lines in (False, True):
        try:
            return optimize_memory(pd.read_json(io.BytesIO(file_bytes), lines=lines))
        except Exception:
            continue
    raise ValueError("Could not parse JSON file.")


def load_dataframe_from_path(path: Path) -> pd.DataFrame:
    ext = path.suffix.lower()
    if ext == ".csv":
        return _load_csv_from_path(path)
    if ext in {".xlsx", ".xls"}:
        return optimize_memory(pd.read_excel(path, engine="openpyxl"))
    if ext == ".json":
        return _load_json_bytes(_read_small_file_bytes(path))
    raise ValueError("Unsupported dataset format.")


def _detect_csv_read_kwargs(path: Path) -> dict[str, Any]:
    sample_bytes = _read_head_bytes(path)
    last_error: Exception | None = None

    for encoding in _csv_encoding_candidates(sample_bytes):
        try:
            sample_text = _decode_csv_sample(sample_bytes, encoding)
        except UnicodeDecodeError as exc:
            last_error = exc
            continue

        if not sample_text.strip():
            continue
        if sample_text.count("\x00") / max(len(sample_text), 1) > 0.02:
            continue

        delimiter = _sniff_csv_delimiter(sample_text)
        for read_kwargs in _csv_read_attempts(encoding, delimiter):
            try:
                pd.read_csv(path, nrows=10, **read_kwargs)
                return read_kwargs
            except UnicodeDecodeError as exc:
                last_error = exc
                break
            except Exception as exc:
                last_error = exc
                continue

    raise ValueError(f"Unsupported CSV encoding or malformed CSV. Last error: {last_error}")


def _iter_csv_chunks(path: Path, chunksize: int = PROFILE_CHUNK_ROWS, usecols: list[str] | None = None) -> Iterator[pd.DataFrame]:
    read_kwargs = _detect_csv_read_kwargs(path)
    chunk_kwargs = {key: value for key, value in read_kwargs.items() if key != "low_memory"}
    chunk_kwargs["chunksize"] = chunksize
    if usecols:
        chunk_kwargs["usecols"] = list(dict.fromkeys(str(column) for column in usecols))
    for chunk in pd.read_csv(path, **chunk_kwargs):
        yield optimize_memory(chunk)


def _load_csv_from_path(path: Path) -> pd.DataFrame:
    read_kwargs = _detect_csv_read_kwargs(path)
    df = pd.read_csv(path, **read_kwargs)
    return optimize_memory(df)


def _iter_json_chunks(path: Path, chunksize: int = PROFILE_CHUNK_ROWS, columns: list[str] | None = None) -> Iterator[pd.DataFrame]:
    try:
        reader = pd.read_json(path, lines=True, chunksize=chunksize)
        for chunk in reader:
            if columns:
                available = [column for column in columns if column in chunk.columns]
                chunk = chunk.loc[:, available].copy()
            yield optimize_memory(chunk)
        return
    except Exception:
        pass

    df = load_dataframe_from_path(path)
    if df.empty:
        return
    if columns:
        available = [column for column in columns if column in df.columns]
        df = df.loc[:, available].copy()
    for start in range(0, len(df), chunksize):
        yield optimize_memory(df.iloc[start:start + chunksize].copy())


def iter_dataset_chunks(path: Path, columns: list[str] | None = None, chunksize: int = PROFILE_CHUNK_ROWS) -> Iterator[pd.DataFrame]:
    ext = path.suffix.lower()
    if ext == ".csv":
        return _iter_csv_chunks(path, chunksize=chunksize, usecols=columns)
    if ext == ".json":
        return _iter_json_chunks(path, chunksize=chunksize, columns=columns)

    df = load_dataframe_from_path(path)
    if columns:
        available = [column for column in columns if column in df.columns]
        df = df.loc[:, available].copy()
    if df.empty:
        return iter([])
    return iter([optimize_memory(df)])


def _build_chunk_profile(chunks: Iterator[pd.DataFrame]) -> tuple[pd.DataFrame, dict[str, Any]]:
    total_rows = 0
    interactive_chunks: list[pd.DataFrame] = []
    stats: dict[str, dict[str, Any]] = {}
    column_order: list[str] = []

    MAX_PROFILE_CHUNKS = 10  # Limit profiling to first 10 chunks (~1M rows) for speed
    chunk_count = 0

    for chunk in chunks:
        if chunk is None or chunk.empty:
            continue

        chunk_count += 1
        total_rows += len(chunk)
        if not column_order:
            column_order = [str(column) for column in chunk.columns.tolist()]

        rows_remaining = INTERACTIVE_SAMPLE_ROWS - sum(len(frame) for frame in interactive_chunks)
        if rows_remaining > 0:
            interactive_chunks.append(chunk.head(rows_remaining).copy())

        # Speed up: Only do heavy profiling for the first few chunks
        if chunk_count > MAX_PROFILE_CHUNKS:
            continue

        for column in chunk.columns:
            key = str(column)
            series = chunk[column]
            column_stats = stats.setdefault(
                key,
                {
                    "dtype": str(series.dtype),
                    "non_null": 0,
                    "null": 0,
                    "unique_values": set(),
                    "unique_overflow": False,
                },
            )
            column_stats["non_null"] += int(series.notna().sum())
            column_stats["null"] += int(series.isna().sum())

            if not column_stats["unique_overflow"]:
                values = {str(value) for value in series.dropna().astype(str).head(UNIQUE_TRACK_LIMIT)}
                column_stats["unique_values"].update(values)
                if len(column_stats["unique_values"]) > UNIQUE_TRACK_LIMIT:
                    column_stats["unique_overflow"] = True
                    column_stats["unique_values"] = set(list(column_stats["unique_values"])[:UNIQUE_TRACK_LIMIT])

    interactive_df = pd.concat(interactive_chunks, ignore_index=True) if interactive_chunks else pd.DataFrame()
    interactive_df = optimize_memory(interactive_df)
    snapshot = build_dataset_snapshot(interactive_df)
    snapshot["rows"] = int(total_rows)
    snapshot["cols"] = int(len(column_order) or interactive_df.shape[1])
    snapshot["all_columns"] = column_order or snapshot.get("all_columns", [])
    snapshot["preview"] = serialize_dataframe(interactive_df, limit=20)
    snapshot["sample_rows"] = serialize_dataframe(interactive_df, limit=FRONTEND_SAMPLE_ROWS)
    snapshot["backend_managed"] = True
    snapshot["storage_mode"] = "disk"
    snapshot["columns_info"] = [
        {
            "column": column,
            "dtype": stats[column]["dtype"],
            "non_null": int(stats[column]["non_null"]),
            "null": int(stats[column]["null"]),
            "null_pct": round(stats[column]["null"] / max(total_rows, 1) * 100, 2),
            "unique": int(len(stats[column]["unique_values"])),
            "unique_is_sampled": bool(stats[column]["unique_overflow"]),
        }
        for column in snapshot["all_columns"]
    ]
    snapshot["missing_total"] = int(sum(item["null"] for item in snapshot["columns_info"]))
    return interactive_df, sanitize_for_json(snapshot)


def _profile_csv_dataset(path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    if DASK_AVAILABLE and path.stat().st_size >= 100 * 1024 * 1024:
        try:
            read_kwargs = _detect_csv_read_kwargs(path)
            ddf = dd.read_csv(path, blocksize="64MB", **{key: value for key, value in read_kwargs.items() if key != "low_memory"})
            total_rows = int(ddf.shape[0].compute())
            interactive_df = optimize_memory(ddf.head(INTERACTIVE_SAMPLE_ROWS, npartitions=-1))
            snapshot = build_dataset_snapshot(interactive_df)
            snapshot["rows"] = int(total_rows)
            snapshot["cols"] = int(len(ddf.columns))
            snapshot["all_columns"] = [str(column) for column in ddf.columns.tolist()]
            snapshot["preview"] = serialize_dataframe(interactive_df, limit=20)
            snapshot["sample_rows"] = serialize_dataframe(interactive_df, limit=FRONTEND_SAMPLE_ROWS)
            snapshot["backend_managed"] = True
            snapshot["storage_mode"] = "disk"
            return interactive_df, sanitize_for_json(snapshot)
        except Exception:
            pass

    return _build_chunk_profile(_iter_csv_chunks(path))


def _profile_json_dataset(path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    return _build_chunk_profile(_iter_json_chunks(path))


def _sample_if_needed(df: pd.DataFrame) -> pd.DataFrame:
    if len(df) <= INTERACTIVE_SAMPLE_ROWS:
        return optimize_memory(df.copy())
    return optimize_memory(df.sample(n=INTERACTIVE_SAMPLE_ROWS, random_state=42).reset_index(drop=True))


def store_dataframe_in_session(
    session: Any,
    df: pd.DataFrame,
    name: str = "Dataset",
    session_id: str | None = None,
) -> dict[str, Any]:
    interactive_df = _sample_if_needed(df)
    snapshot = build_dataset_snapshot(interactive_df)
    snapshot["rows"] = int(len(df))
    snapshot["cols"] = int(df.shape[1])
    snapshot["preview"] = serialize_dataframe(interactive_df, limit=20)
    snapshot["sample_rows"] = serialize_dataframe(interactive_df, limit=FRONTEND_SAMPLE_ROWS)
    snapshot["backend_managed"] = True
    snapshot["storage_mode"] = "memory"

    session.dataset_name = name
    session.dataset_path = None
    session.dataset_format = "memory"
    session.dataset_storage_mode = "memory"
    session.dataset_file_size = 0
    session.dataset_row_count = int(len(df))
    session.dataset_column_count = int(df.shape[1])
    session.dataset_columns = snapshot["all_columns"]
    session.dataset_snapshot = snapshot
    session.df = interactive_df.copy()
    session.df_original = interactive_df.copy()

    if session_id:
        clear_dataset_cache(session_id)

    return sanitize_for_json(snapshot)


def prepare_uploaded_dataset(session: Any, session_id: str, filename: str, source_path: Path, file_size: int) -> dict[str, Any]:
    ensure_dataset_directories()
    ext = source_path.suffix.lower()

    if ext == ".csv" and file_size > MEMORY_FILE_SIZE_BYTES:
        interactive_df, snapshot = _profile_csv_dataset(source_path)
        session.dataset_storage_mode = "disk"
    elif ext == ".json" and file_size > MEMORY_FILE_SIZE_BYTES:
        interactive_df, snapshot = _profile_json_dataset(source_path)
        session.dataset_storage_mode = "disk"
    else:
        full_df = load_dataframe_from_path(source_path)
        interactive_df = full_df.copy() if len(full_df) <= MEMORY_ROW_THRESHOLD else _sample_if_needed(full_df)
        snapshot = build_dataset_snapshot(interactive_df)
        snapshot["rows"] = int(len(full_df))
        snapshot["cols"] = int(full_df.shape[1])
        snapshot["preview"] = serialize_dataframe(interactive_df, limit=20)
        snapshot["sample_rows"] = serialize_dataframe(interactive_df, limit=FRONTEND_SAMPLE_ROWS)
        snapshot["backend_managed"] = True
        snapshot["storage_mode"] = "memory" if len(full_df) <= MEMORY_ROW_THRESHOLD and file_size <= MEMORY_FILE_SIZE_BYTES else "disk"
        session.dataset_storage_mode = snapshot["storage_mode"]

    session.dataset_name = filename or "Dataset"
    session.dataset_path = str(source_path)
    session.dataset_format = ext.lstrip(".")
    session.dataset_file_size = int(file_size)
    session.dataset_row_count = int(snapshot["rows"])
    session.dataset_column_count = int(snapshot["cols"])
    session.dataset_columns = list(snapshot.get("all_columns", []))
    session.dataset_snapshot = snapshot
    session.df = interactive_df.copy()
    session.df_original = interactive_df.copy()

    clear_dataset_cache(session_id)
    return sanitize_for_json(snapshot)


def finalize_chunked_upload(upload_id: str, session: Any, session_id: str) -> tuple[Path, dict[str, Any]]:
    manifest = _read_manifest(upload_id)
    filename = manifest["filename"]
    target_dir = _session_dir(session_id)
    target_path = target_dir / f"{uuid.uuid4().hex}_{filename}"

    with target_path.open("wb") as destination:
        for index in range(int(manifest.get("total_chunks") or 0)):
            chunk_path = _upload_dir(upload_id) / f"chunk-{index:06d}.part"
            if not chunk_path.exists():
                raise ValueError(f"Upload is missing chunk {index}.")
            with chunk_path.open("rb") as source:
                shutil.copyfileobj(source, destination)

    snapshot = prepare_uploaded_dataset(
        session=session,
        session_id=session_id,
        filename=filename,
        source_path=target_path,
        file_size=int(manifest.get("total_size") or target_path.stat().st_size),
    )
    shutil.rmtree(_upload_dir(upload_id), ignore_errors=True)
    return target_path, snapshot


def page_dataset(session: Any, session_id: str, page: int = 1, page_size: int = 50) -> dict[str, Any]:
    page = max(int(page or 1), 1)
    page_size = min(max(int(page_size or 50), 1), 500)
    cache_key = f"{_cache_prefix(session_id)}page:{page}:{page_size}"
    cached = cache.get_json(cache_key)
    if cached is not None:
        return cached

    total_rows = int(session.dataset_row_count or (len(session.df) if session.df is not None else 0))
    columns = list(session.dataset_columns or (session.df.columns.tolist() if session.df is not None else []))
    offset = (page - 1) * page_size

    if session.dataset_path and Path(session.dataset_path).exists() and session.dataset_storage_mode == "disk":
        path = Path(session.dataset_path)
        ext = path.suffix.lower()
        collected: list[pd.DataFrame] = []
        current = 0

        if ext == ".csv":
            iterator = _iter_csv_chunks(path)
        elif ext == ".json":
            iterator = _iter_json_chunks(path)
        else:
            df = load_dataframe_from_path(path)
            iterator = iter([df])

        for chunk in iterator:
            chunk_len = len(chunk)
            if current + chunk_len <= offset:
                current += chunk_len
                continue

            local_start = max(0, offset - current)
            local_end = min(chunk_len, offset + page_size - current)
            if local_end > local_start:
                collected.append(chunk.iloc[local_start:local_end].copy())
            current += chunk_len
            if current >= offset + page_size:
                break

        page_df = pd.concat(collected, ignore_index=True) if collected else pd.DataFrame(columns=columns)
    else:
        frame = session.df if session.df is not None else pd.DataFrame(columns=columns)
        page_df = frame.iloc[offset:offset + page_size].copy()

    payload = sanitize_for_json(
        {
            "page": page,
            "page_size": page_size,
            "total_rows": total_rows,
            "total_pages": max(1, int(np.ceil(total_rows / max(page_size, 1)))) if total_rows else 1,
            "columns": columns,
            "rows": serialize_dataframe(page_df, limit=None),
            "storage_mode": session.dataset_storage_mode,
        }
    )
    cache.set_json(cache_key, payload, ttl_seconds=300)
    return payload
