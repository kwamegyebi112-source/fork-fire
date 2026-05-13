function formatCurrency(value) {
  return `GH₵${new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

export default function SalesForm({
  menuItems,
  saleForm,
  busyAction,
  total,
  selectedDate,
  onItemChange,
  onFieldChange,
  onSubmit,
  isEditing,
}) {
  return (
    <form className="tracker-entry-form tracker-entry-form--modal" onSubmit={onSubmit}>
      <label className="tracker-field">
        <span>Item</span>
        <select value={saleForm.itemId} onChange={(event) => onItemChange(event.target.value)}>
          {menuItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <div className="tracker-inline-grid">
        <label className="tracker-field">
          <span>Quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={saleForm.quantity}
            onChange={(event) => onFieldChange("quantity", event.target.value)}
          />
        </label>
        <label className="tracker-field">
          <span>Price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={saleForm.unitPrice}
            onChange={(event) => onFieldChange("unitPrice", event.target.value)}
          />
        </label>
      </div>

      {(() => {
        // Margin preview is purely informational - it appears only when the menu item has a
        // unit_cost set. It never blocks save and never affects what gets stored.
        const selected = menuItems.find((item) => item.id === saleForm.itemId);
        const unitCost = Number(selected?.unitCost || 0);
        const unitPrice = Number.parseFloat(saleForm.unitPrice) || 0;
        const quantity = Math.max(0, Number.parseInt(saleForm.quantity, 10) || 0);
        const marginPerUnit = unitPrice - unitCost;
        const marginTotal = marginPerUnit * quantity;
        const showMargin = unitCost > 0 && unitPrice > 0;

        return (
          <div className="tracker-form-meta">
            <div className="tracker-preview">
              <span>Date</span>
              <strong>{selectedDate}</strong>
            </div>
            <div className="tracker-preview">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            {showMargin ? (
              <div className="tracker-preview">
                <span>Est. margin</span>
                <strong style={{ color: marginPerUnit >= 0 ? undefined : "var(--tracker-danger, #c0392b)" }}>
                  {formatCurrency(marginTotal)}
                  <small style={{ opacity: 0.7, fontWeight: 400 }}>
                    {" · "}{formatCurrency(marginPerUnit)}/plate
                  </small>
                </strong>
              </div>
            ) : null}
          </div>
        );
      })()}

      <button className="tracker-primary-button tracker-primary-button--full" type="submit" disabled={busyAction === "sale"}>
        {busyAction === "sale" ? "Saving..." : isEditing ? "Update sale" : "Save sale"}
      </button>
    </form>
  );
}
