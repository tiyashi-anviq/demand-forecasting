"""PDF forecast-summary report for any model type whose Predictor exposes: forecast_all(horizon), X, df, last_hist, test_weeks, health().
build_pdf(p, series_ids, model, title, scope, horizon) -> bytes.  Series are summed (e.g. all national products, or the depot rows)."""
import io
from datetime import date
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK, MUTED, ACC, ACC2, GRID = "#1f2937", "#6b7280", "#0f62fe", "#d97706", "#e5e7eb"
MODEL_LABEL = {"lightgbm_stacked": "LightGBM stacked", "lightgbm_base": "LightGBM base"}
HN = {"M1": "M1 · 4 weeks ahead", "M2": "M2 · 9 weeks ahead", "M3": "M3 · 13 weeks ahead"}


def _f(v):
    return "–" if v is None or (isinstance(v, float) and np.isnan(v)) else f"{v:,.0f}"


def _pct(a, b):
    return "–" if not b else f"{(a / b - 1) * 100:+.1f}%"


def collect(p, series_ids, horizon=None):
    """Weekly table summed over the series: forecast p10/p50/p90, sales-team forecast, seasonal baseline, budget, last year; plus actual history."""
    allf = p.forecast_all(horizon)
    ids = [s for s in series_ids if s in allf]
    if not ids:
        raise ValueError("none of the requested series has a forecast")
    rows = {}
    for sid in ids:
        for pt in allf[sid]:
            wk = pt["week_start"]
            X = p.X[pt["horizon"]]
            key = (sid, pd.Timestamp(wk))
            r = rows.setdefault(wk, dict(week=wk, horizon=pt["horizon"], p10=0.0, p50=0.0, p90=0.0, sales=0.0, seasonal=0.0, budget=0.0, ly=0.0))
            r["p10"] += pt["p10"]; r["p50"] += pt["p50"]; r["p90"] += pt["p90"]
            r["sales"] += pt["sales_forecast"] or 0; r["seasonal"] += pt["seasonal_baseline"] or 0
            if key in X.index:
                r["budget"] += float(X.at[key, "budget_units"]); r["ly"] += float(X.at[key, "ly_actual_sales_units"])
    fc = pd.DataFrame(sorted(rows.values(), key=lambda r: r["week"]))
    h = p.df[(p.df.split == "history") & p.df.series_id.isin(ids)]
    hist = h.groupby("week_start").actual_demand_units.sum().sort_index()
    return fc, hist, len(ids)


def _chart(fc, hist, n_hist=26):
    fig, ax = plt.subplots(figsize=(7.6, 3.1), dpi=200)
    hh = hist.iloc[-n_hist:]
    fw = pd.to_datetime(fc.week)
    ax.plot(hh.index, hh.values, color=INK, lw=1.8, label="Actual demand")
    ax.fill_between(fw, fc.p10, fc.p90, color=ACC, alpha=0.15, lw=0, label="P10 – P90 (sum of series)")
    ax.plot(fw, fc.p50, color=ACC, lw=2.2, label="Model forecast (P50)")
    ax.plot(fw, fc.sales, color=ACC2, lw=1.3, ls="--", label="Sales team forecast")
    ax.plot(fw, fc.budget, color=MUTED, lw=1.2, ls=":", label="Budget")
    ax.axvline(pd.Timestamp(hist.index.max()), color=GRID, lw=1)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color(GRID)
    ax.tick_params(colors=MUTED, labelsize=7); ax.grid(axis="y", color=GRID, lw=0.6)
    ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda v, _: f"{v/1000:,.0f}k" if v >= 1000 else f"{v:,.0f}"))
    ax.set_ylim(bottom=0)
    ax.legend(frameon=False, fontsize=7, ncol=3, loc="upper left", labelcolor=INK)
    fig.tight_layout()
    b = io.BytesIO(); fig.savefig(b, format="png"); plt.close(fig); b.seek(0)
    return b


def _tbl(data, widths, align_right_from=1, head_bg=INK):
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7.5), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(head_bg)),
        ("FONT", (0, 1), (-1, -1), "Helvetica", 7.5), ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor(INK)),
        ("ALIGN", (align_right_from, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f6f7f9")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor(GRID)), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return t


def build_pdf(p, series_ids, model, title="National total", scope="", horizon=None):
    fc, hist, n = collect(p, series_ids, horizon)
    ss = getSampleStyleSheet()
    H1 = ParagraphStyle("h1", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=18, textColor=colors.HexColor(INK), alignment=0, spaceAfter=2)
    H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=11, textColor=colors.HexColor(INK), spaceBefore=10, spaceAfter=4)
    B = ParagraphStyle("b", parent=ss["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=colors.HexColor(INK))
    S = ParagraphStyle("s", parent=B, fontSize=7.5, textColor=colors.HexColor(MUTED), leading=10)

    tot = {k: float(fc[k].sum()) for k in ("p50", "p10", "p90", "sales", "seasonal", "budget", "ly")}
    w0, w1 = fc.week.iloc[0], fc.week.iloc[-1]
    hl = p.health()
    mlabel = MODEL_LABEL.get(model, model)
    peak = fc.loc[fc.p50.idxmax()]
    low = fc.loc[fc.p50.idxmin()]
    last13 = float(hist.iloc[-len(fc):].sum()) if len(hist) >= len(fc) else None

    story = [Paragraph("Demand forecast summary", H1),
             Paragraph(f"{title}{' · ' + scope if scope else ''}", ParagraphStyle("sub", parent=B, fontSize=11, textColor=colors.HexColor(ACC))),
             Paragraph(f"Model: {mlabel} · {n} series summed · data to {hl['history_end']} · forecast {w0} to {w1} · generated {date.today():%d %b %Y}", S), Spacer(1, 8)]

    kp = [["Forecast total", "vs last year", "vs budget", "vs sales team"],
          [_f(tot["p50"]) + " units", _pct(tot["p50"], tot["ly"]), _pct(tot["p50"], tot["budget"]), _pct(tot["p50"], tot["sales"])],
          [f"{len(fc)} weeks", f"LY {_f(tot['ly'])}", f"Budget {_f(tot['budget'])}", f"Sales team {_f(tot['sales'])}"]]
    k = Table(kp, colWidths=[46 * mm] * 4)
    k.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "Helvetica", 7.5), ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(MUTED)),
                           ("FONT", (0, 1), (-1, 1), "Helvetica-Bold", 14), ("TEXTCOLOR", (0, 1), (-1, 1), colors.HexColor(INK)),
                           ("FONT", (0, 2), (-1, 2), "Helvetica", 7.5), ("TEXTCOLOR", (0, 2), (-1, 2), colors.HexColor(MUTED)),
                           ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(GRID)), ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor(GRID)),
                           ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f6f7f9")), ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    story += [k, Spacer(1, 6)]

    txt = (f"The model expects <b>{_f(tot['p50'])} units</b> over the {len(fc)} forecast weeks, {_pct(tot['p50'], tot['ly'])} against the same weeks last year "
           f"and {_pct(tot['p50'], tot['budget'])} against budget. The peak week is <b>{peak.week}</b> ({_f(peak.p50)} units) and the lowest is {low.week} ({_f(low.p50)} units).")
    if last13:
        txt += f" The previous {len(fc)} weeks of actual demand totalled {_f(last13)} units ({_pct(tot['p50'], last13)} change)."
    story += [Paragraph(txt, B), Spacer(1, 6), Image(_chart(fc, hist), width=180 * mm, height=73.5 * mm)]

    story.append(Paragraph("By horizon", H2))
    hd = [["Horizon", "Weeks", "Forecast", "P10", "P90", "Sales team", "Budget", "Last year"]]
    for hn in ("M1", "M2", "M3"):
        g = fc[fc.horizon == hn]
        if len(g):
            hd.append([HN[hn], len(g), _f(g.p50.sum()), _f(g.p10.sum()), _f(g.p90.sum()), _f(g.sales.sum()), _f(g.budget.sum()), _f(g.ly.sum())])
    story.append(_tbl(hd, [38 * mm, 12 * mm, 22 * mm, 20 * mm, 20 * mm, 22 * mm, 22 * mm, 22 * mm]))
    story.append(Paragraph("Each week uses the freshest usable model: M1 for weeks within 4 weeks of the data cut-off, then M2, then M3.", S))

    fc["month"] = pd.to_datetime(fc.week).dt.strftime("%b %Y")
    md = [["Month", "Forecast", "Last year", "vs LY", "Budget", "vs budget", "Sales team", "vs sales team"]]
    for m, g in fc.groupby("month", sort=False):
        a = {k: float(g[k].sum()) for k in ("p50", "ly", "budget", "sales")}
        md.append([m, _f(a["p50"]), _f(a["ly"]), _pct(a["p50"], a["ly"]), _f(a["budget"]), _pct(a["p50"], a["budget"]), _f(a["sales"]), _pct(a["p50"], a["sales"])])
    story += [Paragraph("By month", H2), _tbl(md, [24 * mm] + [22.3 * mm] * 7)]

    wd = [["Week", "Horizon", "P10", "Forecast (P50)", "P90", "Sales team", "Seasonal", "Budget", "Last year"]]
    for r in fc.itertuples():
        wd.append([r.week, r.horizon, _f(r.p10), _f(r.p50), _f(r.p90), _f(r.sales), _f(r.seasonal), _f(r.budget), _f(r.ly)])
    story += [PageBreak(), Paragraph("Week by week", H2), _tbl(wd, [22 * mm, 16 * mm, 19 * mm, 25 * mm, 19 * mm, 21 * mm, 19 * mm, 19 * mm, 19 * mm], 2)]

    uses_sf = any(c in ("log_sales_fc", "sf_vs_budget") for c in getattr(p, "cols", []))
    sfnote = ("This model takes the sales team forecast as one of its inputs, so the comparison with it is not independent." if uses_sf
              else "This model does not use the sales team forecast; it is shown only as a benchmark.")
    story += [Spacer(1, 8), Paragraph(sfnote + " Notes: units are demand units. P10 and P90 are the sums of each series' own P10 and P90, so for many series the true range of the total is narrower. "
                                      "Data is a synthetic mock dataset. Accuracy figures are on the Forecast screen and are not part of this summary.", S)]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm, topMargin=14 * mm, bottomMargin=14 * mm, title=f"Demand forecast summary - {title}", author="AnvIQ Labs")

    def foot(c, d):
        c.saveState(); c.setFont("Helvetica", 7); c.setFillColor(colors.HexColor(MUTED))
        c.drawString(15 * mm, 8 * mm, "Eveready demand forecasting · AnvIQ Labs"); c.drawRightString(A4[0] - 15 * mm, 8 * mm, f"Page {d.page}"); c.restoreState()
    doc.build(story, onFirstPage=foot, onLaterPages=foot)
    return buf.getvalue()
