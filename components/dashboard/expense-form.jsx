export default function ExpenseForm({
  expenseForm,
  busyAction,
  selectedDate,
  onFieldChange,
  onSubmit,
}) {
  return (
    <form className="tracker-entry-form tracker-entry-form--modal" onSubmit={onSubmit}>
      <label className="tracker-field">
        <span>Expense name</span>
        <input
          type="text"
          placeholder="Vegetables, packaging, fuel"
          value={expenseForm.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
        />
      </label>

      <label className="tracker-field">
        <span>Category</span>
        <input
          type="text"
          placeholder="Food supplies, transport, packaging"
          value={expenseForm.category}
          onChange={(event) => onFieldChange("category", event.target.value)}
        />
      </label>

      <label className="tracker-field">
        <span>Amount</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={expenseForm.amount}
          onChange={(event) => onFieldChange("amount", event.target.value)}
        />
      </label>

      <div className="tracker-form-meta tracker-form-meta--single">
        <div className="tracker-preview">
          <span>Date</span>
          <strong>{selectedDate}</strong>
        </div>
      </div>

      <button
        className="tracker-primary-button tracker-primary-button--full"
        type="submit"
        disabled={busyAction === "expense"}
      >
        {busyAction === "expense" ? "Saving..." : "Save expense"}
      </button>
    </form>
  );
}
