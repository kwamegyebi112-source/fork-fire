const entryTime = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const deleteIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M8 6V4.5C8 3.67 8.67 3 9.5 3H14.5C15.33 3 16 3.67 16 4.5V6M3 6H21M5 6V20C5 21.1 5.9 22 7 22H17C18.1 22 19 21.1 19 20V6M10 10V17M14 10V17"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const emptyIcon = (
  <svg className="tracker-empty-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <rect x="8" y="10" width="32" height="28" rx="5" stroke="currentColor" strokeWidth="2" />
    <path d="M16 20H32M16 28H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

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
        <div className="tracker-skeleton">
          <div className="tracker-skeleton-row" />
          <div className="tracker-skeleton-row" />
          <div className="tracker-skeleton-row" />
        </div>
      ) : expenses.length ? (
        <div className="tracker-log-list">
          {expenses.map((expense) => {
            const isPending = pendingDelete?.type === "expenses" && pendingDelete.id === expense.id;

            return (
              <article className={`tracker-log-row${isPending ? " is-pending-delete" : ""}`} key={expense.id}>
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
                      {deleteIcon}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="tracker-empty">
          {emptyIcon}
          <strong>No expenses yet</strong>
          <p>Expenses entered for this date will appear here.</p>
        </div>
      )}
    </section>
  );
}
