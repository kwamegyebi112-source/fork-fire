// Lightweight per-device favorites for the expense modal.
// Stored in localStorage so they persist across sessions without needing a Supabase table.
// A favorite is { name, category, amount } \u2014 covers period is intentionally NOT stored:
// stock-up windows are usually trip-specific, so the user picks them per save.

const STORAGE_KEY = "fork-n-fire-expense-favorites";

export function loadExpenseFavorites() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sanitize: drop any malformed entries from older builds.
    return parsed
      .filter((entry) => entry && typeof entry.name === "string" && entry.name.trim())
      .map((entry) => ({
        name: entry.name.trim(),
        category: typeof entry.category === "string" ? entry.category : "",
        amount: Number(entry.amount) || 0,
      }));
  } catch {
    return [];
  }
}

function persist(favorites) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // Quota errors etc. are swallowed \u2014 favorites are a convenience, not critical data.
  }
}

// Idempotent add: if a favorite with the same (case-insensitive) name exists, replace it.
// Newest favorites bubble to the top so most-recent pins appear first in the chip row.
export function addExpenseFavorite(favorites, item) {
  const name = (item?.name || "").trim();
  if (!name) return favorites;
  const next = [
    { name, category: item.category || "", amount: Number(item.amount) || 0 },
    ...favorites.filter((f) => f.name.toLowerCase() !== name.toLowerCase()),
  ];
  persist(next);
  return next;
}

export function removeExpenseFavorite(favorites, name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return favorites;
  const next = favorites.filter((f) => f.name.toLowerCase() !== target);
  persist(next);
  return next;
}

export function isExpenseFavorited(favorites, name) {
  const target = (name || "").trim().toLowerCase();
  if (!target) return false;
  return favorites.some((f) => f.name.toLowerCase() === target);
}
