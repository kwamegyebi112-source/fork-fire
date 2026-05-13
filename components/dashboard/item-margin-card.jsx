function formatCurrency(value) {
  return `GH\u20b5${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

// Per-item margin breakdown for the dashboard insights panel.
// Pure UI: it derives margin = (unit_price - unit_cost) * quantity per sale, grouped by item.
// Items without a unit_cost are excluded so the card only shows what we have data for.
export default function ItemMarginCard({ sales, menuItems }) {
  if (!sales?.length || !menuItems?.length) return null;

  // Build a lookup: item_id -> unit_cost. Falls back to 0 if a menu item was deleted.
  const costById = new Map(menuItems.map((item) => [item.id, Number(item.unitCost || 0)]));

  // Aggregate per item: revenue, est. cost, est. margin, quantity.
  const grouped = new Map();
  for (const sale of sales) {
    const unitCost = costById.get(sale.item_id);
    if (!unitCost || unitCost <= 0) continue; // skip items without a cost estimate
    const key = sale.item_id;
    const entry = grouped.get(key) || {
      name: sale.item_name,
      revenue: 0,
      cost: 0,
      margin: 0,
      quantity: 0,
    };
    const qty = Number(sale.quantity || 0);
    const price = Number(sale.unit_price || 0);
    entry.revenue += qty * price;
    entry.cost += qty * unitCost;
    entry.margin += qty * (price - unitCost);
    entry.quantity += qty;
    grouped.set(key, entry);
  }

  const rows = Array.from(grouped.values()).sort((a, b) => b.margin - a.margin);
  if (!rows.length) return null;

  // Use the top item's margin to scale the bar widths so visual ranking is obvious at a glance.
  const maxMargin = rows.reduce((max, row) => Math.max(max, Math.abs(row.margin)), 0) || 1;

  return (
    <div className="insights-card">
      <span className="insights-label">Most Profitable Items (estimated)</span>
      <div className="expense-cat-list" style={{ marginTop: "10px" }}>
        {rows.map((row) => {
          const positive = row.margin >= 0;
          const pct = Math.round((Math.abs(row.margin) / maxMargin) * 100);
          return (
            <div key={row.name} className="expense-cat-row">
              <div className="expense-cat-label-row">
                <span className="expense-cat-name">
                  {row.name}
                  <small style={{ opacity: 0.7, marginLeft: "6px" }}>
                    {row.quantity} sold
                  </small>
                </span>
                <span className="expense-cat-right">
                  <span className="expense-cat-amount">{formatCurrency(row.margin)}</span>
                </span>
              </div>
              <div className="expense-cat-track">
                <div
                  className="expense-cat-fill"
                  style={{
                    width: `${pct}%`,
                    background: positive ? "#4ab779" : "#c0392b",
                  }}
                />
              </div>
              <small style={{ opacity: 0.6, fontSize: "11px" }}>
                Revenue {formatCurrency(row.revenue)} \u00b7 cost {formatCurrency(row.cost)}
              </small>
            </div>
          );
        })}
      </div>
      <small style={{ opacity: 0.6, display: "block", marginTop: "10px", fontSize: "11px" }}>
        Estimates only \u2014 based on the cost-per-plate you set in Menu. Doesn\u2019t change your net profit.
      </small>
    </div>
  );
}
