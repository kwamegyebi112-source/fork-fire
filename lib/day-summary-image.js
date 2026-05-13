// Renders a clean, shareable day-summary card onto a Canvas using only the native 2D API.
// Returns the canvas so the caller can convert to a Blob for the Web Share API or download.
//
// Keeping this dependency-free instead of pulling in html-to-image: the layout is simple text
// + numbers, so plain canvas drawing is faster, smaller, and renders identically across browsers.

const COLORS = {
  bg: "#fff7ee",         // cream background, matches Fork & Fire's warm brand
  card: "#ffffff",
  border: "#f1d9b8",
  brand: "#ff6a2c",      // primary orange
  text: "#1f2937",
  muted: "#6b7280",
  positive: "#157a3d",
  negative: "#b91c1c",
  divider: "#f3e7d3",
};

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

// Public entry point. data shape: { businessName, dateLabel, metrics, dateRangeLabel? }.
// Returns the same canvas (caller is expected to call .toBlob() on it).
export function drawDaySummary(canvas, data) {
  const { metrics, businessName = "Fork & Fire", dateLabel = "", dateRangeLabel = "" } = data;

  // Logical pixel dimensions; a 2x DPR multiplier is applied so the PNG looks crisp on phones.
  const W = 900;
  const H = 1100;
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";

  // Background
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Header band
  ctx.fillStyle = COLORS.brand;
  ctx.fillRect(0, 0, W, 14);

  // Brand row
  ctx.fillStyle = COLORS.brand;
  ctx.font = "700 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(businessName, 60, 90);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText("Daily summary", 60, 120);

  // Date
  ctx.fillStyle = COLORS.text;
  ctx.font = "600 22px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
  ctx.fillText(dateRangeLabel || formatLongDate(dateLabel), 60, 170);

  // Card panel
  const cardX = 60;
  const cardY = 210;
  const cardW = W - 120;
  const cardH = 760;
  ctx.fillStyle = COLORS.card;
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24, true, true);

  // Hero: net profit
  const netTone = metrics.statusTone === "positive" ? COLORS.positive : metrics.statusTone === "negative" ? COLORS.negative : COLORS.muted;

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 16px system-ui, sans-serif";
  ctx.fillText("Net profit", cardX + 40, cardY + 60);

  ctx.fillStyle = netTone;
  ctx.font = "800 60px system-ui, sans-serif";
  ctx.fillText(formatGhs(metrics.net), cardX + 40, cardY + 120);

  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 16px system-ui, sans-serif";
  const marginLabel = metrics.margin > 0
    ? `+${Math.round(metrics.margin)}% margin`
    : metrics.margin < 0
      ? `${Math.round(metrics.margin)}% margin`
      : "Break even";
  ctx.fillText(`${metrics.statusLabel} \u00b7 ${marginLabel}`, cardX + 40, cardY + 150);

  // Divider
  ctx.strokeStyle = COLORS.divider;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 40, cardY + 190);
  ctx.lineTo(cardX + cardW - 40, cardY + 190);
  ctx.stroke();

  // Two-column stats
  const stats = [
    { label: "Revenue", value: formatGhs(metrics.revenue) },
    { label: "Expenses", value: formatGhs(metrics.expenseTotal) },
    { label: "Items sold", value: String(metrics.itemsSold || 0) },
    { label: "Transactions", value: String((metrics.saleCount || 0) + (metrics.expenseCount || 0)) },
  ];
  const colW = (cardW - 80) / 2;
  stats.forEach((stat, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = cardX + 40 + col * colW;
    const y = cardY + 240 + row * 100;
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText(stat.label, x, y);
    ctx.fillStyle = COLORS.text;
    ctx.font = "700 28px system-ui, sans-serif";
    ctx.fillText(stat.value, x, y + 36);
  });

  // Divider 2
  ctx.strokeStyle = COLORS.divider;
  ctx.beginPath();
  ctx.moveTo(cardX + 40, cardY + 470);
  ctx.lineTo(cardX + cardW - 40, cardY + 470);
  ctx.stroke();

  // Highlights
  let yCursor = cardY + 510;
  if (metrics.bestSeller) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText("Top seller", cardX + 40, yCursor);
    ctx.fillStyle = COLORS.positive;
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText(metrics.bestSeller.name, cardX + 40, yCursor + 32);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText(
      `${metrics.bestSeller.quantity} sold \u00b7 ${formatGhs(metrics.bestSellerRevenue)}`,
      cardX + 40,
      yCursor + 56
    );
    yCursor += 110;
  }

  if (metrics.biggestExpense) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText("Biggest expense", cardX + 40, yCursor);
    ctx.fillStyle = COLORS.negative;
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.fillText(metrics.biggestExpense.name, cardX + 40, yCursor + 32);
    ctx.fillStyle = COLORS.muted;
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillText(formatGhs(metrics.biggestExpense.amount), cardX + 40, yCursor + 56);
  }

  // Footer
  ctx.fillStyle = COLORS.muted;
  ctx.font = "500 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Generated by Fork & Fire", W / 2, H - 40);
  ctx.textAlign = "start";

  return canvas;
}

// Small helper for rounded rectangles since the Canvas API didn't have a built-in one for years.
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
