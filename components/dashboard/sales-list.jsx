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

const editIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M15.232 5.232l3.536 3.536M9 13l-2 6 6-2 9.373-9.373a2.5 2.5 0 00-3.536-3.536L9 13z"
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
  return `GH₵${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

function formatTime(value) {
  if (!value) return "--:--";
  return entryTime.format(new Date(value));
}

export default function SalesList({
  title,
  description,
  sales,
  isLoading,
  onEdit,
  onDelete,
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
        <div className="tracker-skeleton">
          <div className="tracker-skeleton-row" />
          <div className="tracker-skeleton-row" />
          <div className="tracker-skeleton-row" />
        </div>
      ) : sales.length ? (
        <div className="tracker-log-list">
          {sales.map((sale) => (
            <article className="tracker-log-row" key={sale.id}>
              <div className="tracker-log-main tracker-log-main--tappable" role="button" tabIndex={0} onClick={() => onEdit(sale)} onKeyDown={(e) => e.key === "Enter" && onEdit(sale)}>
                <strong>{sale.item_name}</strong>
                <small>
                  Qty {sale.quantity} | {formatTime(sale.created_at)}
                </small>
              </div>
              <div className="tracker-log-side">
                <span>{formatCurrency(sale.total)}</span>
                <div className="tracker-log-actions">
                  <button
                    className="tracker-icon-button tracker-icon-button--small tracker-icon-button--edit"
                    type="button"
                    aria-label="Edit sale"
                    onClick={() => onEdit(sale)}
                  >
                    {editIcon}
                  </button>
                  <button
                    className="tracker-icon-button tracker-icon-button--small"
                    type="button"
                    aria-label="Delete sale"
                    onClick={() => onDelete(sale.id)}
                  >
                    {deleteIcon}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="tracker-empty">
          {emptyIcon}
          <strong>No sales yet</strong>
          <p>Sales entered for this date will appear here.</p>
        </div>
      )}
    </section>
  );
}
