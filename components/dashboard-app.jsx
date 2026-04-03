"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/bottom-nav";
import DateBar from "@/components/dashboard/date-bar";
import ExpenseForm from "@/components/dashboard/expense-form";
import ExpenseList from "@/components/dashboard/expense-list";
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

const menuItems = [
  {
    id: "fried-yam",
    name: "Fried Yam + Pork/Chicken",
    currentPrice: 40,
  },
  {
    id: "jollof-rice",
    name: "Jollof Rice + Pork/Chicken",
    currentPrice: 40,
  },
  {
    id: "loaded-angwamo",
    name: "Loaded Angwamo",
    currentPrice: 50,
  },
  {
    id: "kenkey-fish",
    name: "Kenkey + Fish",
    currentPrice: 20,
  },
];

const emptySaleForm = {
  itemId: menuItems[0].id,
  quantity: "1",
  unitPrice: String(menuItems[0].currentPrice),
};

const emptyExpenseForm = {
  name: "",
  category: "",
  amount: "",
};

export default function DashboardApp({ displayName }) {
  const router = useRouter();
  const supabase = createClient();
  const expenseUploadInputRef = useRef(null);

  const [activeView, setActiveView] = useState("dashboard");
  const [activityView, setActivityView] = useState("sales");
  const [dateFilter, setDateFilter] = useState(createTodayFilter());
  const [salesData, setSalesData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [busyAction, setBusyAction] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isSaleComposerOpen, setIsSaleComposerOpen] = useState(false);
  const [isExpenseComposerOpen, setIsExpenseComposerOpen] = useState(false);

  const dateBounds = useMemo(() => getDateBounds(dateFilter), [dateFilter]);
  const entryDate = dateFilter.type === "range" ? dateBounds.to : dateBounds.from;
  const filteredSales = useMemo(() => filterByDate(salesData, dateFilter, "sold_on"), [salesData, dateFilter]);
  const filteredExpenses = useMemo(
    () => filterByDate(expenseData, dateFilter, "spent_on"),
    [expenseData, dateFilter]
  );
  const metrics = useMemo(() => computeMetrics(filteredSales, filteredExpenses), [filteredSales, filteredExpenses]);
  const activeLogView = activeView === "dashboard" ? activityView : activeView;
  const trackerSubtitle =
    activeView === "expenses" ? "Expenses" : activeView === "sales" ? "Sales" : "Sales Tracker";

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");

    if (hash === "dashboard" || hash === "sales" || hash === "expenses") {
      setActiveView(hash);

      if (hash === "sales" || hash === "expenses") {
        setActivityView(hash);
      }
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

  function pushToast(message, tone = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }

  function handleSaleItemChange(itemId) {
    const selectedMenu = menuItems.find((item) => item.id === itemId) || menuItems[0];

    setSaleForm((current) => ({
      ...current,
      itemId: selectedMenu.id,
      unitPrice: String(selectedMenu.currentPrice),
    }));
  }

  function handleSaleFieldChange(field, value) {
    setSaleForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleExpenseFieldChange(field, value) {
    setExpenseForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaleSubmit(event) {
    event.preventDefault();

    const { error, payload } = buildSalePayload(saleForm, menuItems, entryDate);

    if (error || !payload) {
      pushToast(error || "Could not save sale.", "error");
      return;
    }

    setBusyAction("sale");

    const { error: insertError } = await supabase.from("sales").insert(payload);
    setBusyAction("");

    if (insertError) {
      pushToast(insertError.message, "error");
      return;
    }

    setSaleForm(emptySaleForm);
    setIsSaleComposerOpen(false);
    pushToast("Sale saved.", "success");
    await loadRecords(dateFilter);
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    const { error, payload } = buildExpensePayload(expenseForm, entryDate);

    if (error || !payload) {
      pushToast(error || "Could not save expense.", "error");
      return;
    }

    setBusyAction("expense");

    const { error: insertError } = await supabase.from("expenses").insert(payload);
    setBusyAction("");

    if (insertError) {
      pushToast(insertError.message, "error");
      return;
    }

    setExpenseForm(emptyExpenseForm);
    setIsExpenseComposerOpen(false);
    pushToast("Expense saved.", "success");
    await loadRecords(dateFilter);
  }

  async function handleExpenseUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusyAction("expense-upload");

    try {
      const text = await file.text();
      const rows = parseCSVRows(text);
      const payload = buildExpenseUploadRows(rows, entryDate);

      if (!payload.length) {
        pushToast("No valid expense rows found.", "error");
        return;
      }

      const { error } = await supabase.from("expenses").insert(payload);

      if (error) {
        pushToast(error.message, "error");
        return;
      }

      pushToast(`${payload.length} expense${payload.length === 1 ? "" : "s"} imported.`, "success");
      await loadRecords(dateFilter);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not import the file.", "error");
    } finally {
      setBusyAction("");

      if (event.target) {
        event.target.value = "";
      }
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

  async function handleDelete(type, id) {
    setBusyAction(`${type}-delete`);

    const { error } = await supabase.from(type).delete().eq("id", id);

    setBusyAction("");
    setPendingDelete(null);

    if (error) {
      pushToast(error.message, "error");
      return;
    }

    pushToast(type === "sales" ? "Sale deleted." : "Expense deleted.", "neutral");
    await loadRecords(dateFilter);
  }

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
    setActiveView(nextView);

    if (nextView === "sales" || nextView === "expenses") {
      setActivityView(nextView);
    }
  }

  const saleTotalPreview =
    Math.max(0, Number.parseInt(saleForm.quantity, 10) || 0) *
    Math.max(0, Number.parseFloat(saleForm.unitPrice) || 0);

  return (
    <section className="dashboard-shell tracker-app-shell">
      <Topbar displayName={displayName} subtitle={trackerSubtitle} busyAction={busyAction} onLogout={handleLogout} />

      <DateBar
        dateFilter={dateFilter}
        onApplyFilter={setDateFilter}
        onPrevious={() => setDateFilter((current) => shiftDateFilter(current, -1))}
        onNext={() => setDateFilter((current) => shiftDateFilter(current, 1))}
        onToday={() => setDateFilter(createTodayFilter())}
        onYesterday={() => setDateFilter(createYesterdayFilter())}
      />

      <SnapshotCard metrics={metrics} dateFilter={dateFilter} isLoading={isLoading} view={activeView} />

      {activeView === "sales" ? (
        <div className="tracker-utility-row">
          <button className="tracker-utility-button tracker-utility-button--primary" type="button" onClick={() => setIsSaleComposerOpen(true)}>
            Add sale
          </button>
          <button className="tracker-utility-button" type="button" onClick={exportSales}>
            Export CSV
          </button>
        </div>
      ) : null}

      {activeView === "expenses" ? (
        <div className="tracker-utility-row">
          <button className="tracker-utility-button tracker-utility-button--primary" type="button" onClick={() => setIsExpenseComposerOpen(true)}>
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

      <section className="tracker-screen">
        <div className="tracker-section-intro">
          <div>
            <h2>{activeView === "dashboard" ? "Today's Activity" : activeView === "sales" ? "Sales" : "Expenses"}</h2>
            {activeView === "dashboard" ? null : (
              <p>
                {`Showing ${activeView} for ${
                  dateFilter.type === "range" ? `${dateBounds.from} to ${dateBounds.to}` : normalizeDate(dateFilter.value)
                }.`}
              </p>
            )}
          </div>
          {activeView === "dashboard" ? (
            <div className="tracker-toggle" aria-label="Activity type">
              <button
                className={`tracker-toggle-button ${activityView === "sales" ? "is-active" : ""}`}
                type="button"
                onClick={() => setActivityView("sales")}
              >
                Sales
              </button>
              <button
                className={`tracker-toggle-button ${activityView === "expenses" ? "is-active" : ""}`}
                type="button"
                onClick={() => setActivityView("expenses")}
              >
                Expenses
              </button>
            </div>
          ) : null}
        </div>

        {activeLogView === "sales" ? (
          <SalesList
            title={activeView === "dashboard" ? "Sales log" : "Sales list"}
            description="Item name, quantity, amount, and time."
            sales={filteredSales}
            isLoading={isLoading}
            pendingDelete={pendingDelete}
            busyAction={busyAction}
            onRequestDelete={setPendingDelete}
            onCancelDelete={() => setPendingDelete(null)}
            onConfirmDelete={handleDelete}
          />
        ) : (
          <ExpenseList
            title={activeView === "dashboard" ? "Expense log" : "Expense list"}
            description="Expense name, amount, category, and time."
            expenses={filteredExpenses}
            isLoading={isLoading}
            pendingDelete={pendingDelete}
            busyAction={busyAction}
            onRequestDelete={setPendingDelete}
            onCancelDelete={() => setPendingDelete(null)}
            onConfirmDelete={handleDelete}
          />
        )}
      </section>

      <input
        ref={expenseUploadInputRef}
        className="tracker-hidden-input"
        type="file"
        accept=".csv,text/csv"
        onChange={handleExpenseUpload}
      />

      <BottomNav activeView={activeView} onChange={handleViewChange} />
      <ToastViewport toasts={toasts} />

      {isSaleComposerOpen ? (
        <ModalShell title="Add sale" subtitle={`Save to ${entryDate}`} onClose={() => setIsSaleComposerOpen(false)}>
          <SalesForm
            menuItems={menuItems}
            saleForm={saleForm}
            busyAction={busyAction}
            total={saleTotalPreview}
            selectedDate={entryDate}
            onItemChange={handleSaleItemChange}
            onFieldChange={handleSaleFieldChange}
            onSubmit={handleSaleSubmit}
          />
        </ModalShell>
      ) : null}

      {isExpenseComposerOpen ? (
        <ModalShell
          title="Add expense"
          subtitle={`Save to ${entryDate}`}
          onClose={() => setIsExpenseComposerOpen(false)}
        >
          <ExpenseForm
            expenseForm={expenseForm}
            busyAction={busyAction}
            selectedDate={entryDate}
            onFieldChange={handleExpenseFieldChange}
            onSubmit={handleExpenseSubmit}
          />
        </ModalShell>
      ) : null}
    </section>
  );
}

function ModalShell({ title, subtitle, onClose, children }) {
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
          <button className="tracker-modal-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ToastViewport({ toasts }) {
  return (
    <div className="tracker-toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`tracker-toast tracker-toast--${toast.tone}`} key={toast.id}>
          <span className="tracker-toast-mark">
            {toast.tone === "error" ? "!" : toast.tone === "neutral" ? "i" : "+"}
          </span>
          <span>{toast.message}</span>
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
