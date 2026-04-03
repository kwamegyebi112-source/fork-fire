const entryTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function formatCurrency(value) {
  return `GHS ${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

function formatTime(value) {
  if (!value) {
    return "--:--";
  }

  return entryTime.format(new Date(value));
}

export default function ExpenseList({
  title,
  description,
  expenses,
  isLoading,
  pendingDelete,
  busyAction,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  return (
    <section className="tracker-log-card">
      <div className="tracker-section-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{expenses.length}</span>
      </div>

      {isLoading ? (
        <div className="tracker-empty">
          <strong>Loading expenses</strong>
          <p>Fetching the latest expenses for this date filter.</p>
        </div>
      ) : expenses.length ? (
        <div className="tracker-log-list">
          {expenses.map((expense) => {
            const isPending = pendingDelete?.type === "expenses" && pendingDelete.id === expense.id;

            return (
              <article className="tracker-log-row" key={expense.id}>
                <div className="tracker-log-main">
                  <strong>{expense.expense_name}</strong>
                  <small>
                    {expense.category} | {formatTime(expense.created_at)}
                  </small>
                </div>
                <div className="tracker-log-side">
                  <span>{formatCurrency(expense.amount)}</span>
                  {isPending ? (
                    <div className="tracker-inline-actions">
                      <button
                        className="tracker-inline-button tracker-inline-button--danger"
                        type="button"
                        disabled={busyAction === "expenses-delete"}
                        onClick={() => onConfirmDelete("expenses", expense.id)}
                      >
                        Delete
                      </button>
                      <button className="tracker-inline-button" type="button" onClick={onCancelDelete}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="tracker-icon-button tracker-icon-button--small"
                      type="button"
                      aria-label="Delete expense"
                      onClick={() => onRequestDelete({ type: "expenses", id: expense.id })}
                    >
                      x
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="tracker-empty">
          <strong>No expenses yet</strong>
          <p>Expenses entered for this date will appear here.</p>
        </div>
      )}
    </section>
  );
}
