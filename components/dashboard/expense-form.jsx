import { dateDiffDaysInclusive, shiftDateValue } from "@/lib/dashboard";

const EXPENSE_CATEGORIES = ["Food Production", "Branding", "Packaging", "Logistical services (T&T)"];

// Preset spans the user can pick with one tap. 'single' = today only (legacy behavior).
// 'custom' reveals two date pickers so she can cover any arbitrary range.
const COVER_PRESETS = [
  { mode: "single", label: "Just today", days: 1 },
  { mode: "3", label: "3 days", days: 3 },
  { mode: "7", label: "7 days", days: 7 },
  { mode: "14", label: "14 days", days: 14 },
  { mode: "30", label: "30 days", days: 30 },
  { mode: "custom", label: "Custom", days: null },
];

function formatGhs(value) {
  return `GH₵${(Number(value) || 0).toFixed(2)}`;
}

export default function ExpenseForm({
  expenseForm,
  busyAction,
  selectedDate,
  onFieldChange,
  onSubmit,
  isEditing,
}) {
  const mode = expenseForm.coversMode || "single";
  // Fall back to selectedDate so the preview is always meaningful even before the user touches the chip row.
  const coversFrom = expenseForm.coversFrom || selectedDate;
  const coversTo = expenseForm.coversTo || coversFrom;
  const spanDays = Math.max(1, dateDiffDaysInclusive(coversFrom, coversTo));
  const amountNumber = Number.parseFloat(expenseForm.amount) || 0;
  const dailyShare = spanDays > 0 ? amountNumber / spanDays : 0;

  function selectPreset(preset) {
    if (preset.mode === "custom") {
      onFieldChange("coversMode", "custom");
      // Seed custom dates from whatever was active so the user has a starting point.
      if (!expenseForm.coversFrom) onFieldChange("coversFrom", selectedDate);
      if (!expenseForm.coversTo) onFieldChange("coversTo", expenseForm.coversFrom || selectedDate);
      return;
    }
    const from = selectedDate;
    const to = preset.days === 1 ? selectedDate : shiftDateValue(selectedDate, preset.days - 1);
    onFieldChange("coversMode", preset.mode);
    onFieldChange("coversFrom", from);
    onFieldChange("coversTo", to);
  }

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

      <div className="tracker-field">
        <span>Covers</span>
        <div className="tracker-utility-row" style={{ flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
          {COVER_PRESETS.map((preset) => {
            const active = mode === preset.mode;
            return (
              <button
                key={preset.mode}
                type="button"
                className={`tracker-utility-button${active ? " tracker-utility-button--primary" : ""}`}
                onClick={() => selectPreset(preset)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {mode === "custom" ? (
          <div style={{ display: "flex", gap: "12px", marginTop: "10px", flexWrap: "wrap" }}>
            <label className="tracker-field" style={{ flex: 1, minWidth: "140px" }}>
              <span>From</span>
              <input
                type="date"
                value={coversFrom}
                onChange={(event) => onFieldChange("coversFrom", event.target.value)}
              />
            </label>
            <label className="tracker-field" style={{ flex: 1, minWidth: "140px" }}>
              <span>To</span>
              <input
                type="date"
                value={coversTo}
                min={coversFrom}
                onChange={(event) => onFieldChange("coversTo", event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="tracker-form-meta tracker-form-meta--single">
        <div className="tracker-preview">
          <span>{spanDays === 1 ? "Date" : "Period"}</span>
          <strong>
            {spanDays === 1 ? coversFrom : `${coversFrom} → ${coversTo}`}
          </strong>
        </div>
        {spanDays > 1 ? (
          <div className="tracker-preview">
            <span>Per day</span>
            <strong>
              {formatGhs(dailyShare)} <small style={{ opacity: 0.7, fontWeight: 400 }}>· {spanDays} days</small>
            </strong>
          </div>
        ) : null}
      </div>

      <button
        name="save"
        className="tracker-primary-button tracker-primary-button--full"
        type="submit"
        disabled={busyAction === "expense"}
      >
        {busyAction === "expense" ? "Saving..." : isEditing ? "Update expense" : "Save expense"}
      </button>

      {/* 'Add another' lets her rapid-fire items from one shopping trip: the cover period and
          category stay set, only name + amount reset. Hidden in edit mode (doesn't apply there). */}
      {!isEditing ? (
        <button
          name="add-another"
          className="tracker-utility-button"
          type="submit"
          disabled={busyAction === "expense"}
          style={{ marginTop: "8px", width: "100%" }}
        >
          Save &amp; add another item
        </button>
      ) : null}
    </form>
  );
}
