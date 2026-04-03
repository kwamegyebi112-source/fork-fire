"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/bottom-nav";
import DateBar from "@/components/dashboard/date-bar";
import ExpenseForm from "@/components/dashboard/expense-form";
import ExpenseList from "@/components/dashboard/expense-list";
import InsightsPanel from "@/components/dashboard/insights-panel";
import MenuManager from "@/components/dashboard/menu-manager";
import SalesForm from "@/components/dashboard/sales-form";
import SalesList from "@/components/dashboard/sales-list";
import SnapshotCard from "@/components/dashboard/snapshot-card";
import Topbar from "@/components/dashboard/topbar";
import {
  buildExpenseExportRows,
  buildExpensePayload,
  buildExpenseUploadRows,
  buildSalePayload,
  buildSalesExportRows,
  computeMetrics,
  createTodayFilter,
  createYesterdayFilter,
  filterByDate,
  getDateBounds,
  normalizeDate,
  normalizeExpenseRows,
  normalizeSalesRows,
  parseCSVRows,
  shiftDateFilter,
} from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/client";

const defaultMenuItems = [
  { id: "fried-yam", name: "Fried Yam + Pork/Chicken", currentPrice: 40, archived: false },
  { id: "jollof-rice", name: "Jollof Rice + Pork/Chicken", currentPrice: 40, archived: false },
  { id: "loaded-angwamo", name: "Loaded Angwamo", currentPrice: 50, archived: false },
  { id: "kenkey-fish", name: "Kenkey + Fish", currentPrice: 20, archived: false },
];

const MENU_STORAGE_KEY = "fork-n-fire-menu-items";

function loadMenuItems() {
  try {
    const stored = localStorage.getItem(MENU_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {}
  return defaultMenuItems;
}

function saveMenuItems(items) {
  try {
    localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

const emptyExpenseForm = { name: "", amount: "" };

const UNDO_TIMEOUT = 5000;

export default function DashboardApp({ displayName }) {
  const router = useRouter();
  const supabase = createClient();
  const expenseUploadInputRef = useRef(null);
  const undoTimerRef = useRef(null);

  const [activeView, setActiveView] = useState("dashboard");
  const [prevView, setPrevView] = useState("dashboard");
  const [transitioning, setTransitioning] = useState(false);
  const [dateFilter, setDateFilter] = useState(createTodayFilter());
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
  const [undoPending, setUndoPending] = useState(null);

  const activeMenuItems = useMemo(() => menuItems.filter((item) => !item.archived), [menuItems]);

  useEffect(() => {
    setMenuItems(loadMenuItems());
  }, []);

  const dateBounds = useMemo(() => getDateBounds(dateFilter), [dateFilter]);
  const entryDate = dateFilter.type === "range" ? dateBounds.to : dateBounds.from;
  const filteredSales = useMemo(() => filterByDate(salesData, dateFilter, "sold_on"), [salesData, dateFilter]);
  const filteredExpenses = useMemo(
    () => filterByDate(expenseData, dateFilter, "spent_on"),
    [expenseData, dateFilter]
  );
  const metrics = useMemo(() => computeMetrics(filteredSales, filteredExpenses), [filteredSales, filteredExpenses]);
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
    loadRecords(dateFilter);
  }, [dateFilter]);

  async function loadRecords(filter) {
    const { from, to } = getDateBounds(filter);
    setIsLoading(true);

    try {
      const [salesResponse, expensesResponse] = await Promise.all([
        supabase
          .from("sales")
          .select("id, item_id, item_name, quantity, unit_price, total, notes, sold_on, created_at")
          .gte("sold_on", from)
          .lte("sold_on", to)
          .order("sold_on", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("expenses")
          .select("id, category, amount, notes, spent_on, created_at")
          .gte("spent_on", from)
          .lte("spent_on", to)
          .order("spent_on", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (salesResponse.error || expensesResponse.error) {
        throw new Error(
          salesResponse.error?.message || expensesResponse.error?.message || "Could not load records."
        );
      }

      setSalesData(normalizeSalesRows(salesResponse.data));
      setExpenseData(normalizeExpenseRows(expensesResponse.data));
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not load records.", "error");
    } finally {
      setIsLoading(false);
    }
  }

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
      const { data, error: updateError } = await supabase
        .from("sales")
        .update(payload)
        .eq("id", editingSale.id)
        .select();
      setBusyAction("");

      if (updateError) {
        pushToast(updateError.message, "error");
        return;
      }
      if (!data?.length) {
        pushToast("Update failed — no rows changed. Check permissions.", "error");
        return;
      }

      closeSaleComposer();
      pushToast("Sale updated.", "success");
    } else {
      const { data, error: insertError } = await supabase.from("sales").insert(payload).select();
      setBusyAction("");

      if (insertError) {
        pushToast(insertError.message, "error");
        return;
      }
      if (!data?.length) {
        pushToast("Sale was not saved — check database permissions.", "error");
        return;
      }

      closeSaleComposer();
      pushToast("Sale saved.", "success");
    }

    await loadRecords(dateFilter);
  }

  // --- Expense form handlers ---

  function openExpenseComposer(expense = null) {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        name: expense.expense_name || expense.notes || "",
        amount: String(expense.amount),
      });
    } else {
      setEditingExpense(null);
      setExpenseForm({ ...emptyExpenseForm });
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

    const { error, payload } = buildExpensePayload(expenseForm, entryDate);
    if (error || !payload) {
      pushToast(error || "Could not save expense.", "error");
      return;
    }

    setBusyAction("expense");

    if (editingExpense) {
      const { data, error: updateError } = await supabase
        .from("expenses")
        .update(payload)
        .eq("id", editingExpense.id)
        .select();
      setBusyAction("");

      if (updateError) {
        pushToast(updateError.message, "error");
        return;
      }
      if (!data?.length) {
        pushToast("Update failed — no rows changed. Check permissions.", "error");
        return;
      }

      closeExpenseComposer();
      pushToast("Expense updated.", "success");
    } else {
      const { data, error: insertError } = await supabase.from("expenses").insert(payload).select();
      setBusyAction("");

      if (insertError) {
        pushToast(insertError.message, "error");
        return;
      }
      if (!data?.length) {
        pushToast("Expense was not saved — check database permissions.", "error");
        return;
      }

      closeExpenseComposer();
      pushToast("Expense saved.", "success");
    }

    await loadRecords(dateFilter);
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

      const { data, error } = await supabase.from("expenses").insert(payload).select();

      if (error) {
        pushToast(error.message, "error");
        return;
      }
      if (!data?.length) {
        pushToast("Import failed — check database permissions.", "error");
        return;
      }

      pushToast(`${data.length} expense${data.length === 1 ? "" : "s"} imported.`, "success");
      await loadRecords(dateFilter);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not import the file.", "error");
    } finally {
      setBusyAction("");
      if (event.target) event.target.value = "";
    }
  }

  function downloadExpenseTemplate() {
    const rows = [
      ["Date", "Expense Name", "Category", "Amount (GHS)"],
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

  function handleMenuUpdate(updatedItems) {
    setMenuItems(updatedItems);
    saveMenuItems(updatedItems);
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
          />

          <SnapshotCard metrics={metrics} dateFilter={dateFilter} isLoading={isLoading} view={activeView} />
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
          <InsightsPanel metrics={metrics} isLoading={isLoading} />
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
              <ExpenseList
                title="Expense list"
                description="Expense name, amount, category, and time."
                expenses={filteredExpenses}
                isLoading={isLoading}
                onEdit={openExpenseComposer}
                onDelete={(id) => handleDelete("expenses", id)}
              />
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
