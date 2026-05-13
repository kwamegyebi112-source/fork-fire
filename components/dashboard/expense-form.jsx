import { useEffect, useState } from "react";
import { dateDiffDaysInclusive, shiftDateValue } from "@/lib/dashboard";
import {
  addExpenseFavorite,
  isExpenseFavorited,
  loadExpenseFavorites,
  removeExpenseFavorite,
} from "@/lib/favorites";

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
  history = [],
  onFieldChange,
  onSubmit,
  isEditing,
}) {
  // Pinned favorites live in localStorage. Loaded once on mount; mutations write through immediately
  // so closing/reopening the modal reflects the latest state.
  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    setFavorites(loadExpenseFavorites());
  }, []);

  function applyFavorite(fav) {
    // Tap-to-fill behavior: a favorite always sets all three fields, even if they had values — the user explicitly chose this preset, so overwriting is the desired action.
    onFieldChange("name", fav.name);
    onFieldChange("category", fav.category || "");
    onFieldChange("amount", fav.amount ? String(fav.amount) : "");
  }

  function togglePin() {
    const name = (expenseForm.name || "").trim();
    const category = (expenseForm.category || "").trim();
    const amount = Number.parseFloat(expenseForm.amount) || 0;
    if (!name) return;
    if (isExpenseFavorited(favorites, name)) {
      setFavorites(removeExpenseFavorite(favorites, name));
    } else {
      setFavorites(addExpenseFavorite(favorites, { name, category, amount }));
    }
  }

  function unpinFavorite(event, name) {
    event.stopPropagation();
    setFavorites(removeExpenseFavorite(favorites, name));
  }

  // When the user picks a name that matches a previous expense, gently pre-fill empty fields.
  // We never overwrite values she's already set — autocomplete is helpful, not pushy.
  function handleNameChange(rawValue) {
    onFieldChange("name", rawValue);
    const trimmed = (rawValue || "").trim().toLowerCase();
    if (!trimmed) return;
    const match = history.find((entry) => entry.name.toLowerCase() === trimmed);
    if (!match) return;
    if (!expenseForm.category && match.category) {
      onFieldChange("category", match.category);
    }
    if (!expenseForm.amount && match.amount) {
      onFieldChange("amount", String(match.amount));
    }
  }
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

  const trimmedName = (expenseForm.name || "").trim();
  const canPin = !isEditing && trimmedName.length > 0;
  const isPinned = canPin && isExpenseFavorited(favorites, trimmedName);

  return (
    <form className="tracker-entry-form tracker-entry-form--modal" onSubmit={onSubmit}>
      {/* Favorites: tap a chip to fill name+category+amount in one go. The small x unpins.
          Hidden when she's editing an existing row (favorites apply to fresh entries only). */}
      {!isEditing && favorites.length > 0 ? (
        <div className="tracker-field">
          <span>Quick add</span>
          <div className="tracker-utility-row" style={{ flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
            {favorites.map((fav) => (
              <span
                key={fav.name}
                className="tracker-utility-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", padding: "6px 10px" }}
                role="button"
                tabIndex={0}
                onClick={() => applyFavorite(fav)}
                onKeyDown={(event) => event.key === "Enter" && applyFavorite(fav)}
              >
                <span>{fav.name}</span>
                {fav.amount ? (
                  <small style={{ opacity: 0.7 }}>{formatGhs(fav.amount)}</small>
                ) : null}
                <button
                  type="button"
                  aria-label={`Unpin ${fav.name}`}
                  onClick={(event) => unpinFavorite(event, fav.name)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 2px",
                    fontSize: "14px",
                    lineHeight: 1,
                    opacity: 0.6,
                  }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

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
          onChange={(event) => handleNameChange(event.target.value)}
          list="expense-name-suggestions"
          autoComplete="off"
        />
        {/* Native datalist gives us a free autocomplete dropdown with no styling cost,
            keyboard support, and works on mobile. Limited to the most-recently-used 50 names
            to keep the menu tidy. */}
        <datalist id="expense-name-suggestions">
          {history.slice(0, 50).map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.category ? `${entry.category} \u00b7 GH\u20b5${entry.amount.toFixed(2)}` : ""}
            </option>
          ))}
        </datalist>
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

      {/* Pin/unpin the current entry as a Quick-add favorite. Disabled until a name is typed. */}
      {!isEditing ? (
        <button
          type="button"
          onClick={togglePin}
          disabled={!canPin}
          style={{
            marginTop: "8px",
            width: "100%",
            background: "transparent",
            border: "none",
            color: "var(--tracker-muted, #888)",
            fontSize: "13px",
            cursor: canPin ? "pointer" : "default",
            opacity: canPin ? 1 : 0.5,
            padding: "6px",
          }}
        >
          {isPinned ? "\u2605 Pinned to Quick add (tap to unpin)" : "\u2606 Pin to Quick add"}
        </button>
      ) : null}
    </form>
  );
}
