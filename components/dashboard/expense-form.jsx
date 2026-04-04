const EXPENSE_CATEGORIES = ["Food Production", "Branding", "Packaging", "Logistical services (T&T)"];

export default function ExpenseForm({
  expenseForm,
  busyAction,
  selectedDate,
  onFieldChange,
  onSubmit,
  isEditing,
}) {
  return (
    <form className="tracker-entry-form tracker-entry-form--modal" onSubmit={onSubmit}>
      <label className="tracker-field">
        <span>Category</span>
        <select
          value={expenseForm.category}
          onChange={(event) => onFieldChange("category", event.target.value)}
          required
        >
          <option value="" disabled>Select a category</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </label>

      <label className="tracker-field">
        <span>Expense name</span>
        <input
          type="text"
          placeholder="Describe the expense"
          value={expenseForm.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
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
        {busyAction === "expense" ? "Saving..." : isEditing ? "Update expense" : "Save expense"}
      </button>
    </form>
  );
}
