"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/bottom-nav";
import DateBar from "@/components/dashboard/date-bar";
import DaySummaryModal from "@/components/dashboard/day-summary-modal";
import ExpenseCategoryChart from "@/components/dashboard/expense-category-chart";
import ExpenseForm from "@/components/dashboard/expense-form";
import ExpenseList from "@/components/dashboard/expense-list";
import InsightsPanel from "@/components/dashboard/insights-panel";
import MenuManager from "@/components/dashboard/menu-manager";
import SalesForm from "@/components/dashboard/sales-form";
import SalesList from "@/components/dashboard/sales-list";
import SnapshotCard from "@/components/dashboard/snapshot-card";
import Topbar from "@/components/dashboard/topbar";
import {
  allocateExpensesToWindow,
  buildExpenseExportRows,
  buildExpensePayload,
  buildExpenseUploadRows,
  buildSalePayload,
  buildSalesExportRows,
  computeMetrics,
  createAllTimeFilter,
  createThisMonthFilter,
  createThisWeekFilter,
  createTodayFilter,
  createYesterdayFilter,
  dedupeExpenseHistory,
  filterByDate,
  filterExpensesByWindow,
  getDateBounds,
  normalizeDate,
  normalizeExpenseRows,
  normalizeSalesRows,
  parseCSVRows,
  shiftDateFilter,
} from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/client";

const defaultMenuItems = [
  { id: "fried-yam", name: "Fried Yam + Pork/Chicken", currentPrice: 40, unitCost: 0, archived: false },
  { id: "jollof-rice", name: "Jollof Rice + Pork/Chicken", currentPrice: 40, unitCost: 0, archived: false },
  { id: "loaded-angwamo", name: "Loaded Angwamo", currentPrice: 50, unitCost: 0, archived: false },
  { id: "kenkey-fish", name: "Kenkey + Fish", currentPrice: 20, unitCost: 0, archived: false },
];

const MENU_STORAGE_KEY = "fork-n-fire-menu-items";

function loadMenuItemsLocal() {
  try {
    const stored = localStorage.getItem(MENU_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return defaultMenuItems;
}

function saveMenuItemsLocal(items) {
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

const emptyExpenseForm = {
  name: "",
  amount: "",
  category: "",
  coversMode: "single",
  coversFrom: "",
  coversTo: "",
};

const UNDO_TIMEOUT = 5000;
const AUTO_SYNC_INTERVAL_MS = 3000;
const SALES_SELECT_FIELDS = "id, item_id, item_name, quantity, unit_price, total, notes, sold_on, created_at";
const EXPENSES_SELECT_FIELDS = "id, category, amount, notes, spent_on, covers_from, covers_to, created_at";

export default function DashboardApp({ displayName, userId }) {
  const router = useRouter();
  const supabase = createClient();
  const expenseUploadInputRef = useRef(null);
  const undoTimerRef = useRef(null);
  const loadRequestRef = useRef(0);

  const [activeView, setActiveView] = useState("dashboard");
  const [prevView, setPrevView] = useState("dashboard");
  const [transitioning, setTransitioning] = useState(false);
  // Default to All-time so a fresh open shows the full picture (lifetime sales / expenses).
  // She can still tap Today / Yesterday / a date / a range to drill in.
  const [dateFilter, setDateFilter] = useState(createAllTimeFilter());
  const [salesData, setSalesData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [menuItems, setMenuItems] = useState(defaultMenuItems);
  const [saleForm, setSaleForm] = useState(null);
  const [expenseForm, setExpenseForm] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [isSaleComposerOpen, setIsSaleComposerOpen] = useState(false);
  const [isExpenseComposerOpen, setIsExpenseComposerOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [undoPending, setUndoPending] = useState(null);
  // Recent expense rows used purely as the source for autocomplete + auto-fill in the expense modal.
  // Kept separate from windowed expenseData so suggestions span the whole user history, not just today.
  const [expenseHistory, setExpenseHistory] = useState([]);
  const dateFilterRef = useRef(dateFilter);

  const activeMenuItems = useMemo(() => menuItems, [menuItems]);

  useEffect(() => {
    async function loadMenu() {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, current_price, unit_cost, archived")
        .order("name");

      if (!error && data?.length) {
        const items = data.map((row) => ({
          id: row.id,
          name: row.name,
          currentPrice: Number(row.current_price),
          unitCost: Number(row.unit_cost || 0),
          archived: false,
        }));
        setMenuItems(items);
        saveMenuItemsLocal(items);
      } else {
        setMenuItems(loadMenuItemsLocal());
      }
    }
    loadMenu();
  }, []);

  const dateBounds = useMemo(() => getDateBounds(dateFilter), [dateFilter]);
  // entryDate is what new sales/expenses get tagged with. In 'all' mode the bounds are 1970–2999
  // which would obviously be wrong to save against, so we fall back to today.
  const entryDate =
    dateFilter.type === "all"
      ? normalizeDate(new Date())
      : dateFilter.type === "range"
        ? dateBounds.to
        : dateBounds.from;
  const filteredSales = useMemo(() => filterByDate(salesData, dateFilter, "sold_on"), [salesData, dateFilter]);
  // Expenses are kept if their coverage window overlaps the dashboard window at all.
  // A GH₵500 / 10-day stock purchase will appear on every day it covers, not just the day it was bought.
  const filteredExpenses = useMemo(
    () => filterExpensesByWindow(expenseData, dateFilter),
    [expenseData, dateFilter]
  );
  // Allocated rows carry only the portion of each expense that falls inside the current window.
  // computeMetrics will prefer allocated_amount, so net = revenue − fair-share expenses.
  const allocatedExpenses = useMemo(
    () => allocateExpensesToWindow(filteredExpenses, dateFilter),
    [filteredExpenses, dateFilter]
  );
  const metrics = useMemo(
    () => computeMetrics(filteredSales, allocatedExpenses),
    [filteredSales, allocatedExpenses]
  );
  const trackerSubtitle =
    activeView === "expenses" ? "Expenses" : activeView === "sales" ? "Sales" : activeView === "menu" ? "Menu" : "Sales Tracker";

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (["dashboard", "sales", "expenses", "menu"].includes(hash)) {
      setActiveView(hash);
      setPrevView(hash);
    }
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `#${activeView}`);
  }, [activeView]);

  useEffect(() => {
    dateFilterRef.current = dateFilter;
  }, [dateFilter]);

  useEffect(() => {
    loadRecords(dateFilter);
  }, [dateFilter]);

  // One-time history fetch for autocomplete suggestions. Pulls the most recent ~200 expense rows
  // so the modal can suggest names she's used before and pre-fill category + amount on selection.
  const refreshExpenseHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("expenses")
      .select("expense_name:notes, category, amount, spent_on, created_at")
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) return;
    setExpenseHistory(
      dedupeExpenseHistory(
        data.map((row) => ({
          expense_name: row.expense_name,
          category: row.category,
          amount: Number(row.amount || 0),
          spent_on: row.spent_on,
          created_at: row.created_at,
        }))
      )
    );
  }, [supabase]);

  useEffect(() => {
    refreshExpenseHistory();
  }, [refreshExpenseHistory, userId]);

  function nextDay(dateStr) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split("T")[0];
  }

  async function loadRecords(filter) {
    const requestId = ++loadRequestRef.current;
    const { from, to } = getDateBounds(filter);
    const dayAfterTo = nextDay(to);
    setIsLoading(true);

    try {
      const isAllTime = filter.type === "all";
      // For 'all time', skip date constraints entirely but cap row count to keep things fast
      // even when the user has thousands of historical entries.
      const ROW_LIMIT = 2000;

      let salesQuery = supabase
        .from("sales")
        .select(SALES_SELECT_FIELDS)
        .order("sold_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (!isAllTime) {
        salesQuery = salesQuery.gte("sold_on", from).lt("sold_on", dayAfterTo);
      } else {
        salesQuery = salesQuery.limit(ROW_LIMIT);
      }

      // Overlap: covers_from <= to AND covers_to >= from. Pulls every expense whose span
      // touches the visible window, even if it was *bought* days/weeks before.
      let expensesQuery = supabase
        .from("expenses")
        .select(EXPENSES_SELECT_FIELDS)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (!isAllTime) {
        expensesQuery = expensesQuery.lte("covers_from", to).gte("covers_to", from);
      } else {
        expensesQuery = expensesQuery.limit(ROW_LIMIT);
      }

      const [salesResponse, expensesResponse] = await Promise.all([salesQuery, expensesQuery]);

      if (salesResponse.error || expensesResponse.error) {
        throw new Error(
          salesResponse.error?.message || expensesResponse.error?.message || "Could not load records."
        );
      }

      if (requestId !== loadRequestRef.current) {
        return;
      }

      setSalesData(normalizeSalesRows(salesResponse.data));
      setExpenseData(normalizeExpenseRows(expensesResponse.data));
    } catch (error) {
      if (requestId === loadRequestRef.current) {
        pushToast(error instanceof Error ? error.message : "Could not load records.", "error");
      }
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function refreshRecordsSilently(filter) {
    const { from, to } = getDateBounds(filter);
    const dayAfterTo = nextDay(to);

    const isAllTime = filter.type === "all";
    const ROW_LIMIT = 2000;

    let salesQuery = supabase
      .from("sales")
      .select(SALES_SELECT_FIELDS)
      .order("sold_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (!isAllTime) {
      salesQuery = salesQuery.gte("sold_on", from).lt("sold_on", dayAfterTo);
    } else {
      salesQuery = salesQuery.limit(ROW_LIMIT);
    }

    let expensesQuery = supabase
      .from("expenses")
      .select(EXPENSES_SELECT_FIELDS)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false });
    if (!isAllTime) {
      expensesQuery = expensesQuery.lte("covers_from", to).gte("covers_to", from);
    } else {
      expensesQuery = expensesQuery.limit(ROW_LIMIT);
    }

    const [salesResponse, expensesResponse] = await Promise.all([salesQuery, expensesQuery]);

    if (salesResponse.error || expensesResponse.error) {
      return;
    }

    setSalesData(normalizeSalesRows(salesResponse.data));
    setExpenseData(normalizeExpenseRows(expensesResponse.data));
  }

  useEffect(() => {
    const userFilter = userId ? `user_id=eq.${userId}` : undefined;

    const realtimeChannel = supabase
      .channel(`records-sync-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
          ...(userFilter ? { filter: userFilter } : {}),
        },
        () => refreshRecordsSilently(dateFilterRef.current)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          ...(userFilter ? { filter: userFilter } : {}),
        },
        () => refreshRecordsSilently(dateFilterRef.current)
      )
      .subscribe();

    const pollTimer = window.setInterval(() => {
      if (!document.hidden) {
        refreshRecordsSilently(dateFilterRef.current);
      }
    }, AUTO_SYNC_INTERVAL_MS);

    const handleFocus = () => refreshRecordsSilently(dateFilterRef.current);
    const handleVisibility = () => {
      if (!document.hidden) {
        refreshRecordsSilently(dateFilterRef.current);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(realtimeChannel);
    };
  }, [userId]);

  function pushToast(message, tone = "success", action = null) {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone, action }]);

    const timeout = action ? UNDO_TIMEOUT : 3000;
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, timeout);

    return id;
  }

  function dismissToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  // --- Sale form handlers ---

  function openSaleComposer(sale = null) {
    if (sale) {
      setEditingSale(sale);
      setSaleForm({
        itemId: sale.item_id || activeMenuItems[0]?.id || "",
        quantity: String(sale.quantity),
        unitPrice: String(sale.unit_price),
      });
    } else {
      setEditingSale(null);
      const first = activeMenuItems[0];
      setSaleForm({
        itemId: first?.id || "",
        quantity: "1",
        unitPrice: String(first?.currentPrice || 0),
      });
    }
    setIsSaleComposerOpen(true);
  }

  function closeSaleComposer() {
    setIsSaleComposerOpen(false);
    setEditingSale(null);
    setSaleForm(null);
  }

  function handleSaleItemChange(itemId) {
    const selectedMenu = activeMenuItems.find((item) => item.id === itemId) || activeMenuItems[0];
    setSaleForm((current) => ({
      ...current,
      itemId: selectedMenu?.id || "",
      unitPrice: String(selectedMenu?.currentPrice || 0),
    }));
  }

  function handleSaleFieldChange(field, value) {
    setSaleForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaleSubmit(event) {
    event.preventDefault();

    const { error, payload } = buildSalePayload(saleForm, activeMenuItems, entryDate);
    if (error || !payload) {
      pushToast(error || "Could not save sale.", "error");
      return;
    }

    setBusyAction("sale");

    if (editingSale) {
      const { sold_on: _drop, ...updateFields } = payload;
      const { data, error: updateError } = await supabase
        .from("sales")
        .update(updateFields)
        .eq("id", editingSale.id)
        .select(SALES_SELECT_FIELDS)
        .maybeSingle();
      setBusyAction("");

      if (updateError) {
        pushToast(updateError.message, "error");
        return;
      }
      if (!data) {
        pushToast("Update failed — no rows changed. Check permissions.", "error");
        return;
      }

      const updated = normalizeSalesRows([data])[0];
      setSalesData((current) => current.map((s) => (s.id === editingSale.id ? updated : s)));
      closeSaleComposer();
      pushToast("Sale updated.", "success");
    } else {
      const { data, error: insertError } = await supabase
        .from("sales")
        .insert(payload)
        .select(SALES_SELECT_FIELDS)
        .maybeSingle();
      setBusyAction("");

      if (insertError) {
        pushToast(insertError.message, "error");
        return;
      }
      if (!data) {
        pushToast("Sale was not saved — check database permissions.", "error");
        return;
      }

      const newRow = normalizeSalesRows([data])[0];
      setSalesData((current) => [newRow, ...current]);
      closeSaleComposer();
      pushToast("Sale saved.", "success");
    }
  }

  // --- Expense form handlers ---

  function openExpenseComposer(expense = null) {
    if (expense) {
      setEditingExpense(expense);
      // Derive the chip selection from the stored span so the form reflects what was saved.
      // A span equal to spent_on (1 day) maps to 'single'; everything else opens as 'custom'.
      const coversFrom = expense.covers_from || expense.spent_on;
      const coversTo = expense.covers_to || coversFrom;
      const isSingleDay = coversFrom === coversTo && coversFrom === expense.spent_on;
      setExpenseForm({
        name: expense.expense_name || expense.notes || "",
        amount: String(expense.amount),
        category: expense.category || "",
        coversMode: isSingleDay ? "single" : "custom",
        coversFrom,
        coversTo,
      });
    } else {
      setEditingExpense(null);
      // Default new expense to a single-day span on the dashboard's selected date — matches legacy UX.
      setExpenseForm({
        ...emptyExpenseForm,
        coversFrom: entryDate,
        coversTo: entryDate,
      });
    }
    setIsExpenseComposerOpen(true);
  }

  function closeExpenseComposer() {
    setIsExpenseComposerOpen(false);
    setEditingExpense(null);
    setExpenseForm(null);
  }

  function handleExpenseFieldChange(field, value) {
    setExpenseForm((current) => ({ ...current, [field]: value }));
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    // 'Save & add another' submits the same form but with name="add-another"; we detect it here
    // so we can keep the modal open after a successful insert (shopping-trip workflow).
    const addAnother =
      !editingExpense && event.nativeEvent?.submitter?.name === "add-another";

    const { error, payload } = buildExpensePayload(expenseForm, entryDate);
    if (error || !payload) {
      pushToast(error || "Could not save expense.", "error");
      return;
    }

    setBusyAction("expense");

    if (editingExpense) {
      const { spent_on: _drop, ...updateFields } = payload;
      const { data, error: updateError } = await supabase
        .from("expenses")
        .update(updateFields)
        .eq("id", editingExpense.id)
        .select(EXPENSES_SELECT_FIELDS)
        .maybeSingle();
      setBusyAction("");

      if (updateError) {
        pushToast(updateError.message, "error");
        return;
      }
      if (!data) {
        pushToast("Update failed — no rows changed. Check permissions.", "error");
        return;
      }

      const updated = normalizeExpenseRows([data])[0];
      setExpenseData((current) => current.map((e) => (e.id === editingExpense.id ? updated : e)));
      refreshExpenseHistory();
      closeExpenseComposer();
      pushToast("Expense updated.", "success");
    } else {
      const { data, error: insertError } = await supabase
        .from("expenses")
        .insert(payload)
        .select(EXPENSES_SELECT_FIELDS)
        .maybeSingle();
      setBusyAction("");

      if (insertError) {
        pushToast(insertError.message, "error");
        return;
      }
      if (!data) {
        pushToast("Expense was not saved — check database permissions.", "error");
        return;
      }

      const newRow = normalizeExpenseRows([data])[0];
      setExpenseData((current) => [newRow, ...current]);
      // Keep autocomplete suggestions fresh — the row she just saved should appear next time.
      refreshExpenseHistory();

      if (addAnother) {
        // Keep the modal open and reuse the cover period + category for the next item
        // in the same shopping trip. Only clear name + amount so she can rapid-fire entries.
        setExpenseForm((current) =>
          current ? { ...current, name: "", amount: "" } : current
        );
        pushToast("Expense saved. Add the next item.", "success");
      } else {
        closeExpenseComposer();
        pushToast("Expense saved.", "success");
      }
    }
  }

  // --- Expense upload ---

  async function handleExpenseUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusyAction("expense-upload");

    try {
      const text = await file.text();
      const rows = parseCSVRows(text);
      const payload = buildExpenseUploadRows(rows, entryDate);

      if (!payload.length) {
        pushToast("No valid expense rows found.", "error");
        return;
      }

      const { data, error } = await supabase.from("expenses").insert(payload).select(EXPENSES_SELECT_FIELDS);

      if (error) {
        pushToast(error.message, "error");
        return;
      }
      if (!data?.length) {
        pushToast("Import failed — check database permissions.", "error");
        return;
      }

      const newRows = normalizeExpenseRows(data);
      setExpenseData((current) => [...newRows, ...current]);
      pushToast(`${data.length} expense${data.length === 1 ? "" : "s"} imported.`, "success");
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not import the file.", "error");
    } finally {
      setBusyAction("");
      if (event.target) event.target.value = "";
    }
  }

  function downloadExpenseTemplate() {
    const rows = [
      ["Date", "Expense Name", "Category", "Amount (GH₵)"],
      [entryDate, "", "", ""],
    ];
    downloadCSV("fork-n-fire-expense-template.csv", rows);
    pushToast("Expense template downloaded.", "neutral");
  }

  // --- Undo delete ---

  const commitDelete = useCallback(async (type, id) => {
    const { error } = await supabase.from(type).delete().eq("id", id);
    if (error) {
      pushToast(error.message, "error");
      await loadRecords(dateFilter);
    }
  }, [dateFilter]);

  function handleDelete(type, id) {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      if (undoPending) {
        commitDelete(undoPending.type, undoPending.id);
      }
    }

    if (type === "sales") {
      setSalesData((current) => current.filter((s) => s.id !== id));
    } else {
      setExpenseData((current) => current.filter((e) => e.id !== id));
    }

    setUndoPending({ type, id });

    const toastId = pushToast(
      type === "sales" ? "Sale deleted." : "Expense deleted.",
      "neutral",
      { label: "Undo" }
    );

    undoTimerRef.current = setTimeout(() => {
      commitDelete(type, id);
      setUndoPending(null);
      undoTimerRef.current = null;
    }, UNDO_TIMEOUT);
  }

  function handleUndoDelete(toastId) {
    if (!undoPending) return;

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    setUndoPending(null);
    dismissToast(toastId);
    loadRecords(dateFilter);
    pushToast("Restored.", "success");
  }

  // --- Menu management ---

  async function handleMenuUpdate(updatedItems) {
    const previousItems = menuItems;
    setMenuItems(updatedItems);
    saveMenuItemsLocal(updatedItems);

    const rows = updatedItems.map((item) => ({
      id: item.id,
      name: item.name,
      current_price: item.currentPrice,
      unit_cost: Number(item.unitCost || 0),
      archived: false,
    }));

    const removedIds = previousItems
      .map((item) => item.id)
      .filter((id) => !updatedItems.some((item) => item.id === id));

    let error = null;

    if (rows.length) {
      const { error: upsertError } = await supabase.from("menu_items").upsert(rows, { onConflict: "id" });
      if (upsertError) {
        error = upsertError;
      }
    }

    if (!error && removedIds.length) {
      const { error: deleteError } = await supabase.from("menu_items").delete().in("id", removedIds);
      if (deleteError) {
        error = deleteError;
      }
    }
    if (error) {
      pushToast("Menu saved locally. Cloud sync failed — create a 'menu_items' table in Supabase to sync across devices.", "neutral");
    }
  }

  // --- Navigation ---

  async function handleLogout() {
    setBusyAction("logout");
    await supabase.auth.signOut();
    setBusyAction("");
    router.replace("/login");
    router.refresh();
  }

  function exportSales() {
    if (!filteredSales.length) {
      pushToast("No sales available to export.", "error");
      return;
    }
    downloadCSV("fork-n-fire-sales-export.csv", buildSalesExportRows(filteredSales));
    pushToast("Sales exported.", "neutral");
  }

  function exportExpenses() {
    if (!filteredExpenses.length) {
      pushToast("No expenses available to export.", "error");
      return;
    }
    downloadCSV("fork-n-fire-expenses-export.csv", buildExpenseExportRows(filteredExpenses));
    pushToast("Expenses exported.", "neutral");
  }

  function handleViewChange(nextView) {
    if (nextView === activeView) return;
    setPrevView(activeView);
    setTransitioning(true);
    window.setTimeout(() => {
      setActiveView(nextView);
      window.setTimeout(() => setTransitioning(false), 20);
    }, 150);
  }

  const saleTotalPreview = saleForm
    ? Math.max(0, Number.parseInt(saleForm.quantity, 10) || 0) *
      Math.max(0, Number.parseFloat(saleForm.unitPrice) || 0)
    : 0;

  const viewClass = `tracker-view-panel${transitioning ? " tracker-view-exit" : " tracker-view-enter"}`;

  return (
    <section className="dashboard-shell tracker-app-shell">
      <Topbar displayName={displayName} subtitle={trackerSubtitle} busyAction={busyAction} onLogout={handleLogout} />

      {activeView !== "menu" ? (
        <>
          <DateBar
            dateFilter={dateFilter}
            onApplyFilter={setDateFilter}
            onPrevious={() => setDateFilter((current) => shiftDateFilter(current, -1))}
            onNext={() => setDateFilter((current) => shiftDateFilter(current, 1))}
            onToday={() => setDateFilter(createTodayFilter())}
            onYesterday={() => setDateFilter(createYesterdayFilter())}
            onAllTime={() => setDateFilter(createAllTimeFilter())}
            onThisWeek={() => setDateFilter(createThisWeekFilter())}
            onThisMonth={() => setDateFilter(createThisMonthFilter())}
          />

          <SnapshotCard metrics={metrics} dateFilter={dateFilter} isLoading={isLoading} view={activeView} />

          {/* One-tap entry point to the shareable daily summary. Only meaningful when there's data. */}
          {activeView === "dashboard" && !isLoading && (metrics.saleCount > 0 || metrics.expenseCount > 0) ? (
            <div className="tracker-utility-row">
              <button
                className="tracker-utility-button tracker-utility-button--primary"
                type="button"
                onClick={() => setIsSummaryOpen(true)}
              >
                Day summary &amp; share
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {activeView === "sales" ? (
        <div className="tracker-utility-row">
          <button className="tracker-utility-button tracker-utility-button--primary" type="button" onClick={() => openSaleComposer()}>
            Add sale
          </button>
          <button className="tracker-utility-button" type="button" onClick={exportSales}>
            Export CSV
          </button>
        </div>
      ) : null}

      {activeView === "expenses" ? (
        <div className="tracker-utility-row tracker-utility-row--wide">
          <button className="tracker-utility-button tracker-utility-button--primary" type="button" onClick={() => openExpenseComposer()}>
            Add expense
          </button>
          <button className="tracker-utility-button" type="button" onClick={() => expenseUploadInputRef.current?.click()}>
            {busyAction === "expense-upload" ? "Importing..." : "Import CSV"}
          </button>
          <button className="tracker-utility-button" type="button" onClick={downloadExpenseTemplate}>
            Template
          </button>
          <button className="tracker-utility-button" type="button" onClick={exportExpenses}>
            Export CSV
          </button>
        </div>
      ) : null}

      <div className={viewClass} key={activeView}>
        {activeView === "dashboard" ? (
          <InsightsPanel
            metrics={metrics}
            isLoading={isLoading}
            expenses={allocatedExpenses}
            sales={filteredSales}
            menuItems={activeMenuItems}
          />
        ) : activeView === "menu" ? (
          <MenuManager menuItems={menuItems} onUpdate={handleMenuUpdate} />
        ) : (
          <section className="tracker-screen">
            <div className="tracker-section-intro">
              <div>
                <h2>{activeView === "sales" ? "Sales" : "Expenses"}</h2>
                <p>
                  {`Showing ${activeView} for ${
                    dateFilter.type === "range" ? `${dateBounds.from} to ${dateBounds.to}` : normalizeDate(dateFilter.value)
                  }.`}
                </p>
              </div>
            </div>

            {activeView === "sales" ? (
              <SalesList
                title="Sales list"
                description="Item name, quantity, amount, and time."
                sales={filteredSales}
                isLoading={isLoading}
                onEdit={openSaleComposer}
                onDelete={(id) => handleDelete("sales", id)}
              />
            ) : (
              <>
                <ExpenseCategoryChart expenses={allocatedExpenses} />
                <ExpenseList
                  title="Expense list"
                  description="Expense name, amount, category, and time."
                  expenses={allocatedExpenses}
                  isLoading={isLoading}
                  onEdit={openExpenseComposer}
                  onDelete={(id) => handleDelete("expenses", id)}
                />
              </>
            )}
          </section>
        )}
      </div>

      <input
        ref={expenseUploadInputRef}
        className="tracker-hidden-input"
        type="file"
        accept=".csv,text/csv"
        onChange={handleExpenseUpload}
      />

      <BottomNav activeView={activeView} onChange={handleViewChange} />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} onAction={handleUndoDelete} />

      {isSaleComposerOpen && saleForm ? (
        <ModalShell
          title={editingSale ? "Edit sale" : "Add sale"}
          subtitle={`Save to ${entryDate}`}
          onClose={closeSaleComposer}
        >
          <SalesForm
            menuItems={activeMenuItems}
            saleForm={saleForm}
            busyAction={busyAction}
            total={saleTotalPreview}
            selectedDate={entryDate}
            onItemChange={handleSaleItemChange}
            onFieldChange={handleSaleFieldChange}
            onSubmit={handleSaleSubmit}
            isEditing={!!editingSale}
          />
        </ModalShell>
      ) : null}

      {isSummaryOpen ? (
        <DaySummaryModal
          metrics={metrics}
          dateLabel={dateFilter.type === "all" ? "" : dateBounds.from}
          dateRangeLabel={
            dateFilter.type === "all"
              ? "All time"
              : dateFilter.type === "range"
                ? `${dateBounds.from} → ${dateBounds.to}`
                : ""
          }
          onClose={() => setIsSummaryOpen(false)}
        />
      ) : null}

      {isExpenseComposerOpen && expenseForm ? (
        <ModalShell
          title={editingExpense ? "Edit expense" : "Add expense"}
          subtitle={`Save to ${entryDate}`}
          onClose={closeExpenseComposer}
        >
          <ExpenseForm
            expenseForm={expenseForm}
            busyAction={busyAction}
            selectedDate={entryDate}
            history={expenseHistory}
            onFieldChange={handleExpenseFieldChange}
            onSubmit={handleExpenseSubmit}
            isEditing={!!editingExpense}
          />
        </ModalShell>
      ) : null}
    </section>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, []);

  return (
    <div className="tracker-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tracker-modal tracker-composer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tracker-modal-header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="tracker-modal-close" type="button" onClick={onClose} aria-label="Close dialog">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ToastViewport({ toasts, onDismiss, onAction }) {
  return (
    <div className="tracker-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`tracker-toast tracker-toast--${toast.tone}`} key={toast.id}>
          <span className="tracker-toast-mark">
            {toast.tone === "error" ? "!" : toast.tone === "neutral" ? "i" : "+"}
          </span>
          <span>{toast.message}</span>
          {toast.action ? (
            <button
              className="tracker-toast-action"
              type="button"
              onClick={() => onAction(toast.id)}
            >
              {toast.action.label}
            </button>
          ) : null}
          <button
            className="tracker-toast-dismiss"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}

function downloadCSV(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
