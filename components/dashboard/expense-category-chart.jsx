const CATEGORIES = ["Food Production", "Branding", "Packaging", "Logistical services (T&T)"];

const CATEGORY_COLORS = {
  "Food Production": "#ff6a2c",
  "Branding": "#1e3a5f",
  "Packaging": "#f5a623",
  "Logistical services (T&T)": "#4ab779",
};

function formatCurrency(value) {
  return `GHS ${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

export default function ExpenseCategoryChart({ expenses }) {
  if (!expenses.length) return null;

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals = CATEGORIES.map((cat) => {
    const amount = expenses
      .filter((e) => e.category === cat)
      .reduce((sum, e) => sum + e.amount, 0);
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
    return { name: cat, amount, pct, color: CATEGORY_COLORS[cat] };
  });

  const activeCats = categoryTotals.filter((c) => c.amount > 0);
  if (!activeCats.length) return null;

  return (
    <div className="insights-card expense-cat-card">
      <span className="insights-label">Expenses by Category</span>

      <div className="expense-cat-stack">
        {activeCats.map((cat) => (
          <div
            key={cat.name}
            className="expense-cat-stack-seg"
            style={{ width: `${cat.pct}%`, background: cat.color }}
            title={`${cat.name}: ${cat.pct}%`}
          />
        ))}
      </div>

      <div className="expense-cat-list">
        {categoryTotals.map((cat) => (
          <div key={cat.name} className="expense-cat-row">
            <div className="expense-cat-label-row">
              <span className="expense-cat-dot" style={{ background: cat.color }} />
              <span className="expense-cat-name">{cat.name}</span>
              <span className="expense-cat-right">
                <span className="expense-cat-amount">{formatCurrency(cat.amount)}</span>
                <span className="expense-cat-pct">{cat.pct}%</span>
              </span>
            </div>
            <div className="expense-cat-track">
              <div
                className="expense-cat-fill"
                style={{ width: `${cat.pct}%`, background: cat.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
