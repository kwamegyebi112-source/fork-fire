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

export default function SalesList({
  title,
  description,
  sales,
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
        <span>{sales.length}</span>
      </div>

      {isLoading ? (
        <div className="tracker-empty">
          <strong>Loading sales</strong>
          <p>Fetching the latest sales for this date filter.</p>
        </div>
      ) : sales.length ? (
        <div className="tracker-log-list">
          {sales.map((sale) => {
            const isPending = pendingDelete?.type === "sales" && pendingDelete.id === sale.id;

            return (
              <article className="tracker-log-row" key={sale.id}>
                <div className="tracker-log-main">
                  <strong>{sale.item_name}</strong>
                  <small>
                    Qty {sale.quantity} | {formatTime(sale.created_at)}
                  </small>
                </div>
                <div className="tracker-log-side">
                  <span>{formatCurrency(sale.total)}</span>
                  {isPending ? (
                    <div className="tracker-inline-actions">
                      <button
                        className="tracker-inline-button tracker-inline-button--danger"
                        type="button"
                        disabled={busyAction === "sales-delete"}
                        onClick={() => onConfirmDelete("sales", sale.id)}
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
                      aria-label="Delete sale"
                      onClick={() => onRequestDelete({ type: "sales", id: sale.id })}
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
          <strong>No sales yet</strong>
          <p>Sales entered for this date will appear here.</p>
        </div>
      )}
    </section>
  );
}
