import { getDateBounds } from "@/lib/dashboard";

const summaryDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatCurrency(value) {
  return `GHS ${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

export default function SnapshotCard({ metrics, dateFilter, isLoading, view }) {
  const { from, to } = getDateBounds(dateFilter);
  const summaryLabel =
    from === to
      ? summaryDateFormatter.format(new Date(from))
      : `${summaryDateFormatter.format(new Date(from))} - ${summaryDateFormatter.format(new Date(to))}`;

  if (view === "sales") {
    return (
      <section className="tracker-snapshot tracker-snapshot--sales">
        <div className="tracker-snapshot-head">
          <div>
            <p className="tracker-kicker">Total Sales</p>
            <h2>{formatCurrency(metrics.revenue)}</h2>
          </div>
          <span className="tracker-snapshot-date">{summaryLabel}</span>
        </div>

        <div className="tracker-snapshot-stack">
          <p>{isLoading ? "Refreshing sales..." : `${metrics.itemsSold} items sold`}</p>
          <p>Best seller: {metrics.bestSeller?.name || "No sales yet"}</p>
        </div>
      </section>
    );
  }

  if (view === "expenses") {
    return (
      <section className="tracker-snapshot tracker-snapshot--expenses">
        <div className="tracker-snapshot-head">
          <div>
            <p className="tracker-kicker">Total Expenses</p>
            <h2>{formatCurrency(metrics.expenseTotal)}</h2>
          </div>
          <span className="tracker-snapshot-date">{summaryLabel}</span>
        </div>

        <div className="tracker-snapshot-stack">
          <p>{isLoading ? "Refreshing expenses..." : `${metrics.expenseCount} expenses logged`}</p>
          <p>Expenses for the selected date filter.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`tracker-snapshot tracker-snapshot--dashboard tracker-snapshot--${metrics.statusTone}`}>
      <div className="tracker-snapshot-head">
        <div>
          <p className="tracker-kicker">{metrics.statusLabel.toUpperCase()}</p>
          <h2>{formatCurrency(metrics.net)}</h2>
        </div>
        <span className="tracker-snapshot-date">{summaryLabel}</span>
      </div>

      <p className="tracker-snapshot-subcopy">Revenue: {formatCurrency(metrics.revenue)}</p>

      <div className="tracker-snapshot-foot">
        <div>
          <small>Revenue</small>
          <strong>{formatCurrency(metrics.revenue)}</strong>
        </div>
        <div>
          <small>Expenses</small>
          <strong>{formatCurrency(metrics.expenseTotal)}</strong>
        </div>
      </div>
    </section>
  );
}
