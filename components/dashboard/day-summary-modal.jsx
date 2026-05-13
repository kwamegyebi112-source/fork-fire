"use client";

import { useEffect, useRef, useState } from "react";
import { drawDaySummary } from "@/lib/day-summary-image";

function formatGhs(value) {
  return `GH\u20b5${(Number(value) || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLongDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Day-summary modal: shows a clean review of the active window's metrics with one-tap share.
// Renders the canvas off-screen and converts to a Blob on demand so the share/download is fast.
export default function DaySummaryModal({ metrics, dateLabel, dateRangeLabel, onClose }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);
  // Whether the browser supports navigator.share with file payloads. Computed once on mount
  // because navigator.canShare is only safe to call client-side.
  const [canShareFile, setCanShareFile] = useState(false);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
      try {
        // We construct a tiny dummy file just to test capability \u2014 not shared anywhere.
        const probe = new File([new Blob([""])], "probe.png", { type: "image/png" });
        setCanShareFile(navigator.canShare({ files: [probe] }));
      } catch {
        setCanShareFile(false);
      }
    }
  }, []);

  async function buildBlob() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    drawDaySummary(canvas, { metrics, dateLabel, dateRangeLabel });
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.95));
  }

  async function handleDownload() {
    setBusy(true);
    try {
      const blob = await buildBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fork-n-fire-summary-${dateLabel || "day"}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await buildBlob();
      if (!blob) return;
      const file = new File([blob], `fork-n-fire-summary-${dateLabel || "day"}.png`, {
        type: "image/png",
      });
      // navigator.share rejects on user cancel \u2014 swallow that silently so the modal stays usable.
      try {
        await navigator.share({
          files: [file],
          title: "Daily summary",
          text: `Fork & Fire \u2014 ${dateRangeLabel || formatLongDate(dateLabel)}`,
        });
      } catch {
        // user cancelled or share failed; do nothing
      }
    } finally {
      setBusy(false);
    }
  }

  const marginLabel =
    metrics.margin > 0
      ? `+${Math.round(metrics.margin)}% margin`
      : metrics.margin < 0
        ? `${Math.round(metrics.margin)}% margin`
        : "Break even";

  return (
    <div className="tracker-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tracker-modal tracker-composer-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Daily summary"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tracker-modal-header">
          <div>
            <h2>Daily summary</h2>
            <p>{dateRangeLabel || formatLongDate(dateLabel)}</p>
          </div>
          <button className="tracker-modal-close" type="button" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </div>

        <div className="tracker-entry-form tracker-entry-form--modal">
          <div className="tracker-form-meta">
            <div className="tracker-preview">
              <span>Net profit</span>
              <strong
                style={{
                  color:
                    metrics.statusTone === "positive"
                      ? "#157a3d"
                      : metrics.statusTone === "negative"
                        ? "#b91c1c"
                        : undefined,
                }}
              >
                {formatGhs(metrics.net)}
              </strong>
            </div>
            <div className="tracker-preview">
              <span>{metrics.statusLabel}</span>
              <strong>{marginLabel}</strong>
            </div>
          </div>

          <div className="tracker-form-meta">
            <div className="tracker-preview">
              <span>Revenue</span>
              <strong>{formatGhs(metrics.revenue)}</strong>
            </div>
            <div className="tracker-preview">
              <span>Expenses</span>
              <strong>{formatGhs(metrics.expenseTotal)}</strong>
            </div>
          </div>

          <div className="tracker-form-meta">
            <div className="tracker-preview">
              <span>Items sold</span>
              <strong>{metrics.itemsSold || 0}</strong>
            </div>
            <div className="tracker-preview">
              <span>Transactions</span>
              <strong>{(metrics.saleCount || 0) + (metrics.expenseCount || 0)}</strong>
            </div>
          </div>

          {metrics.bestSeller ? (
            <div className="tracker-preview">
              <span>Top seller</span>
              <strong>
                {metrics.bestSeller.name}
                <small style={{ opacity: 0.7, fontWeight: 400 }}>
                  {" "}
                  &middot; {metrics.bestSeller.quantity} sold &middot; {formatGhs(metrics.bestSellerRevenue)}
                </small>
              </strong>
            </div>
          ) : null}

          {metrics.biggestExpense ? (
            <div className="tracker-preview">
              <span>Biggest expense</span>
              <strong>
                {metrics.biggestExpense.name}
                <small style={{ opacity: 0.7, fontWeight: 400 }}>
                  {" "}
                  &middot; {formatGhs(metrics.biggestExpense.amount)}
                </small>
              </strong>
            </div>
          ) : null}

          {/* Hidden canvas \u2014 only painted on demand when the user shares or downloads. */}
          <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden="true" />

          {canShareFile ? (
            <button
              className="tracker-primary-button tracker-primary-button--full"
              type="button"
              onClick={handleShare}
              disabled={busy}
            >
              {busy ? "Preparing..." : "Share to WhatsApp / other apps"}
            </button>
          ) : null}

          <button
            className="tracker-utility-button"
            type="button"
            onClick={handleDownload}
            disabled={busy}
            style={{ marginTop: "8px", width: "100%" }}
          >
            {busy ? "Preparing..." : "Download as image"}
          </button>
        </div>
      </div>
    </div>
  );
}
