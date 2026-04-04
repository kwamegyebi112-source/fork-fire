import ExpenseCategoryChart from "@/components/dashboard/expense-category-chart";

function formatCurrency(value) {
  return `GH₵${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

const trendUpIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const trendDownIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M7 7L17 17M17 17H9M17 17V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const neutralIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const emptyInsightsIcon = (
  <svg className="tracker-empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="6" y="22" width="8" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="20" y="14" width="8" height="26" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="34" y="8" width="8" height="32" rx="2" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export default function InsightsPanel({ metrics, isLoading, expenses = [] }) {
  if (isLoading) {
    return (
      <section className="tracker-insights">
        <div className="tracker-section-intro">
          <div>
            <h2>Insights</h2>
          </div>
        </div>
        <div className="tracker-skeleton">
          <div className="tracker-skeleton-row" style={{ height: 72 }} />
          <div className="tracker-skeleton-row" style={{ height: 72 }} />
        </div>
      </section>
    );
  }

  const hasActivity = metrics.saleCount > 0 || metrics.expenseCount > 0;

  if (!hasActivity) {
    return (
      <section className="tracker-insights">
        <div className="tracker-section-intro">
          <div>
            <h2>Insights</h2>
          </div>
        </div>
        <div className="tracker-empty">
          {emptyInsightsIcon}
          <strong>No activity yet</strong>
          <p>Add sales or expenses to see insights here.</p>
        </div>
      </section>
    );
  }

  const marginAbs = Math.abs(Math.round(metrics.margin));
  const revenuePct = metrics.revenue + metrics.expenseTotal > 0
    ? Math.round((metrics.revenue / (metrics.revenue + metrics.expenseTotal)) * 100)
    : 50;
  const expensePct = 100 - revenuePct;

  return (
    <section className="tracker-insights">
      <div className="tracker-section-intro">
        <div>
          <h2>Insights</h2>
        </div>
      </div>

      {/* Profit margin bar */}
      <div className="insights-card insights-margin-card">
        <div className="insights-margin-head">
          <span className="insights-label">Profit Margin</span>
          <span className={`insights-margin-value insights-margin-value--${metrics.statusTone}`}>
            {metrics.margin > 0 ? trendUpIcon : metrics.margin < 0 ? trendDownIcon : neutralIcon}
            {metrics.margin > 0 ? "+" : ""}{marginAbs}%
          </span>
        </div>
        <div className="insights-margin-bar">
          <div
            className="insights-margin-fill"
            style={{ width: `${Math.min(100, Math.max(0, metrics.margin > 0 ? marginAbs : 0))}%` }}
            data-tone={metrics.statusTone}
          />
        </div>
        <p className="insights-margin-context">
          {metrics.margin > 0
            ? `You keep ${marginAbs}p of every GH₵1 earned.`
            : metrics.margin < 0
              ? `Expenses exceed revenue by ${marginAbs}%.`
              : "Revenue and expenses are equal."}
        </p>
      </div>

      {/* Revenue vs Expenses split */}
      <div className="insights-card">
        <span className="insights-label">Revenue vs Expenses</span>
        <div className="insights-split-bar">
          <div className="insights-split-revenue" style={{ width: `${revenuePct}%` }} />
          <div className="insights-split-expense" style={{ width: `${expensePct}%` }} />
        </div>
        <div className="insights-split-legend">
          <span className="insights-legend-item insights-legend-item--revenue">
            Revenue {formatCurrency(metrics.revenue)}
          </span>
          <span className="insights-legend-item insights-legend-item--expense">
            Expenses {formatCurrency(metrics.expenseTotal)}
          </span>
        </div>
      </div>

      {/* Stat blocks */}
      <div className="insights-stats">
        <div className="insights-stat">
          <span className="insights-label">Items Sold</span>
          <strong>{metrics.itemsSold}</strong>
        </div>
        <div className="insights-stat">
          <span className="insights-label">Transactions</span>
          <strong>{metrics.saleCount + metrics.expenseCount}</strong>
        </div>
      </div>

      {/* Top seller + biggest expense */}
      <div className="insights-highlights">
        {metrics.bestSeller ? (
          <div className="insights-highlight insights-highlight--positive">
            <span className="insights-label">Top Seller</span>
            <strong>{metrics.bestSeller.name}</strong>
            <small>{metrics.bestSeller.quantity} sold &middot; {formatCurrency(metrics.bestSellerRevenue)}</small>
          </div>
        ) : null}
        {metrics.biggestExpense ? (
          <div className="insights-highlight insights-highlight--negative">
            <span className="insights-label">Biggest Expense</span>
            <strong>{metrics.biggestExpense.name}</strong>
            <small>{formatCurrency(metrics.biggestExpense.amount)}</small>
          </div>
        ) : null}
      </div>

      <ExpenseCategoryChart expenses={expenses} />
    </section>
  );
}
