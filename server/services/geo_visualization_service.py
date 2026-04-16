"""
geo_visualization_service.py
Renders interactive geographical maps using Plotly Express.
Supports:
  - Lat/Lon scatter maps (if lat + lon columns are present)
  - Country / Region choropleth (if a country-name column is detected)
  - City/location scatter_geo (geocoded via pycountry fallback)
"""
from __future__ import annotations

import re
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# ── Keywords used to auto-detect geographic columns ──────────────────────────
_LAT_KEYWORDS  = re.compile(r"\b(lat(itude)?|y_coord)\b", re.I)
_LON_KEYWORDS  = re.compile(r"\b(lon(g(itude)?)?|lng|x_coord)\b", re.I)
_GEO_KEYWORDS  = re.compile(
    r"\b(country|nation|state|province|region|city|town|location|place|territory|continent|district)\b",
    re.I,
)

_DARK_GEO_STYLE = dict(
    bgcolor        = "#060b14",
    lakecolor      = "#0d1521",
    landcolor      = "#111a2c",
    oceancolor     = "#060b14",
    subunitcolor   = "#1e2d45",
    countrycolor   = "#1e2d45",
    coastlinecolor = "#1e2d45",
    showocean      = True,
    showlakes      = True,
    showframe      = False,
    showcoastlines = True,
    showland       = True,
    showcountries  = True,
    showsubunits   = True,
    projection_type= "natural earth",
)

_DARK_LAYOUT = dict(
    paper_bgcolor = "#060b14",
    plot_bgcolor  = "#060b14",
    font          = dict(color="#b7c6dc", family="Inter, sans-serif", size=12),
    margin        = dict(l=0, r=0, t=40, b=0),
)


def detect_geo_columns(df: pd.DataFrame) -> dict:
    """Return a dict describing detected geographic columns."""
    cols = list(df.columns)
    lat_col = next((c for c in cols if _LAT_KEYWORDS.search(c)), None)
    lon_col = next((c for c in cols if _LON_KEYWORDS.search(c)), None)
    geo_cols = [c for c in cols if _GEO_KEYWORDS.search(c)]
    numeric_cols = [c for c in cols if pd.api.types.is_numeric_dtype(df[c])]
    return {
        "lat": lat_col,
        "lon": lon_col,
        "geo_columns": geo_cols,
        "numeric_columns": numeric_cols,
        "mode": "latlon" if (lat_col and lon_col) else ("geo" if geo_cols else "none"),
    }


def render_geo_map(df: pd.DataFrame, config: dict) -> dict:
    """
    Render a Plotly geo map figure and return its JSON representation.

    config keys:
      location_col  – column with country/city/state names OR lat values
      lat_col       – explicit lat column (overrides auto-detect)
      lon_col       – explicit lon column (overrides auto-detect)
      value_col     – optional numeric column to colour markers/choropleth
      map_type      – "scatter" | "choropleth" | "auto"
    """
    detected   = detect_geo_columns(df)
    lat_col    = config.get("lat_col")    or detected["lat"]
    lon_col    = config.get("lon_col")    or detected["lon"]
    loc_col    = config.get("location_col") or (detected["geo_columns"][0] if detected["geo_columns"] else None)
    value_col  = config.get("value_col")
    map_type   = config.get("map_type", "auto")

    sample = df.sample(min(2000, len(df)), random_state=42).copy()

    # ── Lat / Lon scatter map ────────────────────────────────────────────────
    if lat_col and lon_col and lat_col in sample.columns and lon_col in sample.columns:
        sample[lat_col] = pd.to_numeric(sample[lat_col], errors="coerce")
        sample[lon_col] = pd.to_numeric(sample[lon_col], errors="coerce")
        sample = sample.dropna(subset=[lat_col, lon_col])

        hover_cols = [c for c in sample.columns if c not in (lat_col, lon_col)][:4]

        kw = dict(
            lat             = lat_col,
            lon             = lon_col,
            hover_data      = {c: True for c in hover_cols},
            color           = value_col if (value_col and value_col in sample.columns) else None,
            color_continuous_scale = "Plasma",
            opacity         = 0.75,
            title           = f"Geographic Map — {lat_col} / {lon_col}",
        )
        fig = px.scatter_geo(sample, **kw)
        fig.update_geos(**_DARK_GEO_STYLE)
        fig.update_layout(**_DARK_LAYOUT)
        fig.update_traces(marker=dict(size=6, line=dict(width=0.5, color="#ff6b35")))
        return {"figure": fig.to_dict(), "mode": "latlon"}

    # ── Named location scatter_geo / choropleth ──────────────────────────────
    if loc_col and loc_col in sample.columns:
        sample = sample.dropna(subset=[loc_col])

        if map_type == "choropleth" or (
            value_col and value_col in sample.columns and
            sample[loc_col].nunique() <= 200
        ):
            # Aggregate by location
            agg_col = value_col if (value_col and value_col in sample.columns) else None
            if agg_col:
                agg = sample.groupby(loc_col)[agg_col].sum().reset_index()
            else:
                agg = sample[loc_col].value_counts().reset_index()
                agg.columns = [loc_col, "count"]
                agg_col = "count"

            fig = px.choropleth(
                agg,
                locations           = loc_col,
                locationmode        = "country names",
                color               = agg_col,
                color_continuous_scale = "Plasma",
                title               = f"Choropleth Map — {loc_col}",
            )
            fig.update_geos(**_DARK_GEO_STYLE)
            fig.update_layout(**_DARK_LAYOUT)
            return {"figure": fig.to_dict(), "mode": "choropleth"}

        # Scatter_geo by location name
        counts = sample[loc_col].value_counts().reset_index()
        counts.columns = [loc_col, "count"]
        counts = counts.head(150)

        fig = px.scatter_geo(
            counts,
            locations       = loc_col,
            locationmode    = "country names",
            size            = "count",
            color           = "count",
            color_continuous_scale = "Plasma",
            hover_name      = loc_col,
            title           = f"Geographic Distribution — {loc_col}",
            size_max        = 40,
        )
        fig.update_geos(**_DARK_GEO_STYLE)
        fig.update_layout(**_DARK_LAYOUT)
        return {"figure": fig.to_dict(), "mode": "scatter_geo"}

    return {"figure": None, "error": "No geographic columns detected. Add lat/lon or country/city columns."}
