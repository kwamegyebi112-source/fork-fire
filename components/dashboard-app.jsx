"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const menuItems = [
  {
    id: "fried-yam",
    name: "Fried Yam + Pork/Chicken",
    currentPrice: 40,
    originalPrice: 60,
  },
  {
    id: "jollof-rice",
    name: "Jollof Rice + Pork/Chicken",
    currentPrice: 40,
    originalPrice: 60,
  },
  {
    id: "loaded-angwamo",
    name: "Loaded Angwamo",
    currentPrice: 50,
    originalPrice: 75,
  },
];

const emptySaleForm = {
  itemId: menuItems[0].id,
  quantity: "1",
  unitPrice: String(menuItems[0].currentPrice),
  notes: "",
};

const emptyExpenseForm = {
  category: "",
  amount: "",
  notes: "",
};

const shortDate = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  day: "numeric",
});

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const currency = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const trashIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 7H20M9 7V5C9 4.44772 9.44772 4 10 4H14C14.5523 4 15 4.44772 15 5V7M8 10V17M12 10V17M16 10V17M6 7L7 19C7.08614 20.0344 7.95175 20.8333 8.98979 20.8333H15.0102C16.0483 20.8333 16.9139 20.0344 17 19L18 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function DashboardApp({ userEmail, displayName }) {
  const router = useRouter();
  const supabase = createClient();
  const expenseUploadInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [reportDate, setReportDate] = useState(todayString());
  const [salesWindow, setSalesWindow] = useState([]);
  const [expensesWindow, setExpensesWindow] = useState([]);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "sales" || hash === "expenses" || hash === "dashboard") {
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    window.history.replaceState(null, "", `#${activeTab}`);
  }, [activeTab]);

  useEffect(() => {
    loadWindow(reportDate);
  }, [reportDate]);

  const selectedSales = salesWindow.filter((sale) => sale.sold_on === reportDate);
  const selectedExpenses = expensesWindow.filter((expense) => expense.spent_on === reportDate);

  const revenue = sumBy(selectedSales, "total");
  const expensesTotal = sumBy(selectedExpenses, "amount");
  const profit = revenue - expensesTotal;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
  const itemsSold = sumBy(selectedSales, "quantity");
  const averageSale = selectedSales.length ? revenue / selectedSales.length : 0;
  const bestSeller = getBestSeller(selectedSales);
  const topExpense = getTopExpense(selectedExpenses);
  const status = getStatus(profit, revenue, expensesTotal, itemsSold, selectedSales.length);
  const trendDays = buildRecentDays(reportDate, 7);
  const trendValues = trendDays.map((date) => {
    const dateSales = salesWindow.filter((sale) => sale.sold_on === date);
    const dateExpenses = expensesWindow.filter((expense) => expense.spent_on === date);
    return sumBy(dateSales, "total") - sumBy(dateExpenses, "amount");
  });
  const maxTrend = Math.max(...trendValues.map((value) => Math.abs(value)), 1);
  const expenseMix = buildExpenseMix(selectedExpenses, expensesTotal);

  async function loadWindow(selectedDate) {
    setIsLoading(true);

    const fromDate = shiftDate(selectedDate, -6);

    const [salesResponse, expensesResponse] = await Promise.all([
      supabase
        .from("sales")
        .select("id, item_id, item_name, quantity, unit_price, total, notes, sold_on, created_at")
        .gte("sold_on", fromDate)
        .lte("sold_on", selectedDate)
        .order("sold_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("id, category, amount, notes, spent_on, created_at")
        .gte("spent_on", fromDate)
        .lte("spent_on", selectedDate)
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    setIsLoading(false);

    if (salesResponse.error || expensesResponse.error) {
      pushToast(
        salesResponse.error?.message || expensesResponse.error?.message || "Could not load records.",
        "error"
      );
      return;
    }

    setSalesWindow(
      (salesResponse.data || []).map((sale) => ({
        ...sale,
        quantity: Number(sale.quantity),
        unit_price: Number(sale.unit_price),
        total: Number(sale.total),
      }))
    );

    setExpensesWindow(
      (expensesResponse.data || []).map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
      }))
    );
  }

  function pushToast(message, tone = "success") {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }

  function handleSaleItemChange(itemId) {
    const selectedMenu = menuItems.find((item) => item.id === itemId) || menuItems[0];
    setSaleForm((current) => ({
      ...current,
      itemId: selectedMenu.id,
      unitPrice: String(selectedMenu.currentPrice),
    }));
  }

  async function handleSaleSubmit(event) {
    event.preventDefault();

    const selectedMenu = menuItems.find((item) => item.id === saleForm.itemId);
    const quantity = Math.max(1, Number.parseInt(saleForm.quantity, 10) || 0);
    const unitPrice = Math.max(0, Number.parseFloat(saleForm.unitPrice) || 0);

    if (!selectedMenu || quantity <= 0 || unitPrice <= 0) {
      pushToast("Enter a valid sale before saving.", "error");
      return;
    }

    setBusyAction("sale");

    const { error } = await supabase.from("sales").insert({
      item_id: selectedMenu.id,
      item_name: selectedMenu.name,
      sold_on: reportDate,
      quantity,
      unit_price: unitPrice,
      total: quantity * unitPrice,
      notes: saleForm.notes.trim(),
    });

    setBusyAction("");

    if (error) {
      pushToast(error.message, "error");
      return;
    }

    pushToast(`Sale saved for ${formatCurrency(quantity * unitPrice)}.`, "success");
    setSaleForm(emptySaleForm);
    await loadWindow(reportDate);
    setActiveTab("dashboard");
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();

    const amount = Math.max(0, Number.parseFloat(expenseForm.amount) || 0);
    const category = expenseForm.category.trim();

    if (!category || amount <= 0) {
      pushToast("Enter a category and amount before saving.", "error");
      return;
    }

    setBusyAction("expense");

    const { error } = await supabase.from("expenses").insert({
      category,
      amount,
      spent_on: reportDate,
      notes: expenseForm.notes.trim(),
    });

    setBusyAction("");

    if (error) {
      pushToast(error.message, "error");
      return;
    }

    pushToast(`Expense saved for ${formatCurrency(amount)}.`, "success");
    setExpenseForm(emptyExpenseForm);
    await loadWindow(reportDate);
  }

  function downloadExpenseTemplate() {
    const rows = [
      ["Date", "Category", "Amount (GHS)", "Notes"],
      [reportDate, "", "", ""],
    ];

    downloadCSV("fork-n-fire-expense-template.csv", rows);
    pushToast("Expense template downloaded.", "neutral");
  }

  function triggerExpenseUpload() {
    expenseUploadInputRef.current?.click();
  }

  async function handleExpenseFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBusyAction("expense-upload");

    try {
      const text = await file.text();
      const parsedRows = parseCSVRows(text);
      const uploadRows = buildExpenseUploadRows(parsedRows, reportDate);

      if (!uploadRows.length) {
        pushToast("No valid expense rows found in the file.", "error");
        return;
      }

      const { error } = await supabase.from("expenses").insert(uploadRows);

      if (error) {
        pushToast(error.message, "error");
        return;
      }

      pushToast(`${uploadRows.length} expense${uploadRows.length === 1 ? "" : "s"} imported.`, "success");
      await loadWindow(reportDate);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not import that file.", "error");
    } finally {
      setBusyAction("");
      if (event.target) {
        event.target.value = "";
      }
    }
  }

  async function confirmDelete(type, id) {
    setBusyAction(`${type}-delete`);

    const { error } = await supabase.from(type).delete().eq("id", id);

    setBusyAction("");
    setPendingDelete(null);

    if (error) {
      pushToast(error.message, "error");
      return;
    }

    pushToast(type === "sales" ? "Sale deleted." : "Expense deleted.", "neutral");
    await loadWindow(reportDate);
  }

  async function handleLogout() {
    setBusyAction("logout");
    await supabase.auth.signOut();
    setBusyAction("");
    router.replace("/login");
    router.refresh();
  }

  function exportSales() {
    if (!selectedSales.length) {
      pushToast("No sales available to export.", "error");
      return;
    }

    const rows = [
      ["Date", "Item", "Quantity", "Unit Price (GHS)", "Total (GHS)", "Notes"],
      ...selectedSales.map((sale) => [
        sale.sold_on,
        sale.item_name,
        sale.quantity,
        sale.unit_price.toFixed(2),
        sale.total.toFixed(2),
        sale.notes || "",
      ]),
    ];

    downloadCSV(`fork-n-fire-sales-${reportDate}.csv`, rows);
    pushToast("Sales exported.", "success");
  }

  function exportExpenses() {
    if (!selectedExpenses.length) {
      pushToast("No expenses available to export.", "error");
      return;
    }

    const rows = [
      ["Date", "Category", "Amount (GHS)", "Notes"],
      ...selectedExpenses.map((expense) => [
        expense.spent_on,
        expense.category,
        expense.amount.toFixed(2),
        expense.notes || "",
      ]),
    ];

    downloadCSV(`fork-n-fire-expenses-${reportDate}.csv`, rows);
    pushToast("Expenses exported.", "success");
  }

  return (
    <section className="dashboard-shell">
      <ToastViewport toasts={toasts} />

      <header className="panel app-header">
        <div className="brand-cluster">
          <Image
            src="/fork-n-fire-logo.png"
            alt="Fork N' Fire logo"
            width={82}
            height={82}
            className="app-logo"
          />

          <div>
            <p className="eyebrow">Fork N' Fire</p>
            <h1 className="app-title">Sales Tracker</h1>
            <p className="app-subtitle">Daily sales and expenses.</p>
          </div>
        </div>

        <div className="user-cluster">
          <div className="user-pill">
            <span className="user-pill-label">Signed in</span>
            <strong>{displayName}</strong>
            <small>{userEmail}</small>
          </div>

          <button className="ghost-button" type="button" onClick={handleLogout} disabled={busyAction === "logout"}>
            {busyAction === "logout" ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="panel date-summary-card">
        <div className="date-nav">
          <button className="nav-button" type="button" onClick={() => setReportDate(shiftDate(reportDate, -1))}>
            Prev
          </button>

          <label className="field">
            <span>Date</span>
            <input
              type="date"
              value={reportDate}
              onChange={(event) => setReportDate(event.target.value || todayString())}
            />
          </label>

          <button className="nav-button" type="button" onClick={() => setReportDate(shiftDate(reportDate, 1))}>
            Next
          </button>

          <button className="today-button" type="button" onClick={() => setReportDate(todayString())} disabled={reportDate === todayString()}>
            Today
          </button>
        </div>

        <div className={`hero-card hero-card--${status.tone}`}>
          <span className="hero-label">{status.label}</span>
          <FlashValue as="strong" value={formatCurrency(profit)} className={`hero-value tone-${status.tone}`} />
          <p className="hero-date">{longDate.format(parseDateValue(reportDate))}</p>
          <span className={`status-pill status-pill--${status.tone}`}>{status.badge}</span>
        </div>
      </section>

      <nav className="panel tab-strip" aria-label="Sections" role="tablist">
        <button
          className={`tab-chip ${activeTab === "dashboard" ? "is-active" : ""}`}
          type="button"
          role="tab"
          id="tab-dashboard"
          aria-selected={activeTab === "dashboard"}
          aria-controls="panel-dashboard"
          onClick={() => setActiveTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`tab-chip ${activeTab === "sales" ? "is-active" : ""}`}
          type="button"
          role="tab"
          id="tab-sales"
          aria-selected={activeTab === "sales"}
          aria-controls="panel-sales"
          onClick={() => setActiveTab("sales")}
        >
          Sales
          {selectedSales.length ? <span className="tab-count">{selectedSales.length}</span> : null}
        </button>
        <button
          className={`tab-chip ${activeTab === "expenses" ? "is-active" : ""}`}
          type="button"
          role="tab"
          id="tab-expenses"
          aria-selected={activeTab === "expenses"}
          aria-controls="panel-expenses"
          onClick={() => setActiveTab("expenses")}
        >
          Expenses
          {selectedExpenses.length ? <span className="tab-count">{selectedExpenses.length}</span> : null}
        </button>
      </nav>

      {activeTab === "dashboard" ? (
        <section className="tab-stack" id="panel-dashboard" role="tabpanel" aria-labelledby="tab-dashboard">
          <article className="panel spotlight-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 className="section-title">Snapshot</h2>
              </div>
              <p className="section-meta">{status.message}</p>
            </div>

            <div className="spotlight-grid">
              <div className="highlight-panel">
                <span className="highlight-label">Best Seller</span>
                <strong className="highlight-value">{bestSeller?.name ?? "-"}</strong>
                <small className="highlight-meta">
                  {bestSeller ? `${bestSeller.quantity} sold` : "No sales"}
                </small>
              </div>

              <div className="highlight-panel">
                <span className="highlight-label">Top Expense</span>
                <strong className="highlight-value">{topExpense?.category ?? "-"}</strong>
                <small className="highlight-meta">{topExpense ? formatCurrency(topExpense.amount) : "No expenses"}</small>
              </div>
            </div>
          </article>

          <article className="panel stats-card">
            <div className="stats-grid">
              <StatBlock label="Revenue" value={formatCurrency(revenue)} tone="warm" />
              <StatBlock label="Expenses" value={formatCurrency(expensesTotal)} tone="calm" />
              <StatBlock label="Average Sale" value={formatCurrency(averageSale)} tone="fire" />
              <StatBlock label="Margin" value={`${margin}%`} tone={profit > 0 ? "good" : profit < 0 ? "bad" : "neutral"} />
              <StatBlock
                label="Items Sold"
                value={String(itemsSold)}
                tone="plain"
                meta={`${selectedSales.length} order${selectedSales.length === 1 ? "" : "s"}`}
              />
            </div>
          </article>

          <div className="dashboard-panels">
            <article className="panel content-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Trend</p>
                  <h2 className="section-title">7-Day Trend</h2>
                </div>
                <p className="section-meta">{isLoading ? "Updating..." : "Updates automatically"}</p>
              </div>

              <div className="trend-grid">
                {trendDays.map((date, index) => {
                  const value = trendValues[index];
                  const height = Math.max((Math.abs(value) / maxTrend) * 100, 8);

                  return (
                    <div className={`trend-day ${date === reportDate ? "is-current" : ""}`} key={`${date}-${value}`}>
                      <span className="trend-value">{formatCompactCurrency(value)}</span>
                      <div className="trend-frame">
                        <span className={`trend-bar ${value >= 0 ? "positive" : "negative"}`} style={{ "--bar-height": `${height}%` }} />
                      </div>
                      <span className="trend-label">{shortDate.format(parseDateValue(date))}</span>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel content-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Expenses</p>
                  <h2 className="section-title">Category Split</h2>
                </div>
              </div>

              {expenseMix.length ? (
                <div className="mix-list">
                  {expenseMix.map((item) => (
                    <article className="mix-item" key={`${item.category}-${item.percent}`}>
                      <div className="mix-row">
                        <strong>{item.category}</strong>
                        <span>
                          {formatCurrency(item.amount)} <em>{item.percent}%</em>
                        </span>
                      </div>
                      <div className="mix-track">
                        <span className="mix-fill" style={{ "--fill-width": `${item.percent}%` }} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No expenses yet"
                  description="Add a cost to see the split."
                  variant="expense"
                />
              )}
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "sales" ? (
        <section className="tab-stack" id="panel-sales" role="tabpanel" aria-labelledby="tab-sales">
          <div className="mobile-grid">
            <article className="panel content-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Menu</p>
                  <h2 className="section-title">Menu Prices</h2>
                </div>
              </div>

              <div className="menu-list">
                {menuItems.map((item) => (
                  <article className="menu-card" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span className="menu-price-now">Now {formatCurrency(item.currentPrice)}</span>
                      <span className="menu-price-old">Was {formatCurrency(item.originalPrice)}</span>
                    </div>

                    <button className="ghost-button" type="button" onClick={() => handleSaleItemChange(item.id)}>
                      Use
                    </button>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel content-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Sales</p>
                  <h2 className="section-title">New Sale</h2>
                </div>
                <p className="section-meta">{longDate.format(parseDateValue(reportDate))}</p>
              </div>

              <form className="entry-form" onSubmit={handleSaleSubmit}>
                <label className="field">
                  <span>Item</span>
                  <select value={saleForm.itemId} onChange={(event) => handleSaleItemChange(event.target.value)}>
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="two-col-grid">
                  <label className="field">
                    <span>Quantity</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      enterKeyHint="next"
                      value={saleForm.quantity}
                      onChange={(event) => setSaleForm((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </label>

                  <label className="field">
                    <span>Unit Price (GHS)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      enterKeyHint="next"
                      value={saleForm.unitPrice}
                      onChange={(event) => setSaleForm((current) => ({ ...current, unitPrice: event.target.value }))}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Note</span>
                  <input
                    type="text"
                    placeholder="Optional"
                    autoCapitalize="sentences"
                    enterKeyHint="done"
                    value={saleForm.notes}
                    onChange={(event) => setSaleForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>

                <div className="form-footer">
                  <div className="preview-card">
                    <span>Total</span>
                    <strong>{formatCurrency(Math.max(0, Number.parseInt(saleForm.quantity, 10) || 0) * Math.max(0, Number.parseFloat(saleForm.unitPrice) || 0))}</strong>
                  </div>

                  <button className="primary-button" type="submit" disabled={busyAction === "sale"}>
                    {busyAction === "sale" ? "Saving..." : "Save sale"}
                  </button>
                </div>
              </form>
            </article>
          </div>

          <article className="panel content-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Sales</p>
                <h2 className="section-title">Sales Log</h2>
              </div>
              <div className="table-tools">
                <span className="section-meta">{selectedSales.length} entries</span>
                <button className="ghost-button" type="button" onClick={exportSales}>
                  Export CSV
                </button>
              </div>
            </div>

            {selectedSales.length ? (
              <div className="record-list">
                {selectedSales.map((sale) => {
                  const isPending = pendingDelete?.type === "sales" && pendingDelete.id === sale.id;

                  return (
                    <article className={`record-card ${isPending ? "is-pending-delete" : ""}`} key={sale.id}>
                      <div className="record-main">
                        <div>
                          <strong>{sale.item_name}</strong>
                          <p>
                            Qty {sale.quantity} / {formatCurrency(sale.unit_price)}
                          </p>
                          {sale.notes ? <small>{sale.notes}</small> : null}
                        </div>
                        <div className="record-side">
                          <strong>{formatCurrency(sale.total)}</strong>
                          {isPending ? (
                            <div className="confirm-actions">
                              <button className="confirm-button confirm-button-danger" type="button" disabled={busyAction === "sales-delete"} onClick={() => confirmDelete("sales", sale.id)}>
                                Yes
                              </button>
                              <button className="confirm-button" type="button" onClick={() => setPendingDelete(null)}>
                                No
                              </button>
                            </div>
                          ) : (
                            <button className="icon-button" type="button" onClick={() => setPendingDelete({ type: "sales", id: sale.id })} aria-label="Delete sale">
                              {trashIcon}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No sales for this date"
                description="Add the first order to start tracking."
                variant="sale"
              />
            )}
          </article>
        </section>
      ) : null}

      {activeTab === "expenses" ? (
        <section className="tab-stack" id="panel-expenses" role="tabpanel" aria-labelledby="tab-expenses">
          <article className="panel content-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Expenses</p>
                <h2 className="section-title">New Expense</h2>
              </div>
              <p className="section-meta">{longDate.format(parseDateValue(reportDate))}</p>
            </div>

            <form className="entry-form" onSubmit={handleExpenseSubmit}>
              <label className="field">
                <span>Category</span>
                <input
                  type="text"
                  placeholder="Ingredients, transport, packaging"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  value={expenseForm.category}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, category: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Amount (GHS)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  enterKeyHint="next"
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>

              <label className="field">
                <span>Note</span>
                <input
                  type="text"
                  placeholder="Optional"
                  autoCapitalize="sentences"
                  enterKeyHint="done"
                  value={expenseForm.notes}
                  onChange={(event) => setExpenseForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>

              <div className="form-footer">
                <div className="preview-card">
                  <span>Selected date</span>
                  <strong>{longDate.format(parseDateValue(reportDate))}</strong>
                </div>

                <div className="import-tools">
                  <button className="ghost-button" type="button" onClick={downloadExpenseTemplate}>
                    Download template
                  </button>
                  <button className="ghost-button" type="button" onClick={triggerExpenseUpload} disabled={busyAction === "expense-upload"}>
                    {busyAction === "expense-upload" ? "Importing..." : "Upload CSV"}
                  </button>
                  <input
                    ref={expenseUploadInputRef}
                    className="sr-only-input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleExpenseFileChange}
                  />
                </div>

                <button className="primary-button alt-button" type="submit" disabled={busyAction === "expense"}>
                  {busyAction === "expense" ? "Saving..." : "Save expense"}
                </button>
              </div>
            </form>
          </article>

          <article className="panel content-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Expenses</p>
                <h2 className="section-title">Expense Log</h2>
              </div>
              <div className="table-tools">
                <span className="section-meta">{selectedExpenses.length} entries</span>
                <button className="ghost-button" type="button" onClick={exportExpenses}>
                  Export CSV
                </button>
              </div>
            </div>

            {selectedExpenses.length ? (
              <div className="record-list">
                {selectedExpenses.map((expense) => {
                  const isPending = pendingDelete?.type === "expenses" && pendingDelete.id === expense.id;

                  return (
                    <article className={`record-card ${isPending ? "is-pending-delete" : ""}`} key={expense.id}>
                      <div className="record-main">
                        <div>
                          <strong>{expense.category}</strong>
                          <p>{formatCurrency(expense.amount)}</p>
                          {expense.notes ? <small>{expense.notes}</small> : null}
                        </div>
                        <div className="record-side">
                          {isPending ? (
                            <div className="confirm-actions">
                              <button className="confirm-button confirm-button-danger" type="button" disabled={busyAction === "expenses-delete"} onClick={() => confirmDelete("expenses", expense.id)}>
                                Yes
                              </button>
                              <button className="confirm-button" type="button" onClick={() => setPendingDelete(null)}>
                                No
                              </button>
                            </div>
                          ) : (
                            <button className="icon-button" type="button" onClick={() => setPendingDelete({ type: "expenses", id: expense.id })} aria-label="Delete expense">
                              {trashIcon}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No expenses for this date"
                description="Add the first cost to keep the totals honest."
                variant="expense"
              />
            )}
          </article>
        </section>
      ) : null}
    </section>
  );
}

function FlashValue({ as: Tag = "strong", value, className = "" }) {
  return (
    <Tag key={value} className={`value-flash ${className}`.trim()}>
      {value}
    </Tag>
  );
}

function StatBlock({ label, value, tone, meta }) {
  return (
    <article className={`stat-block stat-block--${tone}`}>
      <span>{label}</span>
      <FlashValue as="strong" value={value} className={`tone-${tone}`} />
      {meta ? <small>{meta}</small> : null}
    </article>
  );
}

function EmptyState({ title, description, variant }) {
  const icon =
    variant === "sale" ? (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 3L3 7V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V7L18 3H6Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M3 7H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ) : (
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 10H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );

  return (
    <div className="empty-state">
      {icon}
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function ToastViewport({ toasts }) {
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div className={`toast toast--${toast.tone}`} key={toast.id}>
          <span className="toast-mark">{toast.tone === "error" ? "!" : toast.tone === "neutral" ? "i" : "+"}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

function buildExpenseMix(expenses, total) {
  const grouped = expenses.reduce((accumulator, expense) => {
    accumulator[expense.category] = (accumulator[expense.category] || 0) + expense.amount;
    return accumulator;
  }, {});

  return Object.entries(grouped)
    .map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

function getBestSeller(sales) {
  if (!sales.length) {
    return null;
  }

  const grouped = sales.reduce((accumulator, sale) => {
    if (!accumulator[sale.item_name]) {
      accumulator[sale.item_name] = {
        name: sale.item_name,
        quantity: 0,
      };
    }

    accumulator[sale.item_name].quantity += sale.quantity;
    return accumulator;
  }, {});

  return Object.values(grouped).sort((left, right) => right.quantity - left.quantity)[0];
}

function getTopExpense(expenses) {
  if (!expenses.length) {
    return null;
  }

  return [...expenses].sort((left, right) => right.amount - left.amount)[0];
}

function getStatus(profit, revenue, expenseTotal, itemsSold, orderCount) {
  if (!revenue && !expenseTotal) {
    return {
      label: "Net Result",
      badge: "No activity",
      message: "No sales or expenses recorded yet.",
      tone: "neutral",
    };
  }

  if (profit > 0) {
    return {
      label: "Profit",
      badge: "In profit",
      message: `${itemsSold} item${itemsSold === 1 ? "" : "s"} across ${orderCount} sale${
        orderCount === 1 ? "" : "s"
      }.`,
      tone: "positive",
    };
  }

  if (profit < 0 && revenue === 0) {
    return {
      label: "Loss",
      badge: "Costs only",
      message: `Need ${formatCurrency(expenseTotal)} in sales to cover costs.`,
      tone: "negative",
    };
  }

  if (profit < 0) {
    return {
      label: "Loss",
      badge: "Needs sales",
      message: `${formatCurrency(Math.abs(profit))} needed to break even.`,
      tone: "negative",
    };
  }

  return {
    label: "Break Even",
    badge: "Balanced",
    message: "Sales and expenses are balanced.",
    tone: "neutral",
  };
}

function sumBy(entries, key) {
  return entries.reduce((total, entry) => total + Number(entry[key] || 0), 0);
}

function buildRecentDays(endDate, count) {
  const end = parseDateValue(endDate);
  const days = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - offset);
    days.push(formatDateInput(date));
  }

  return days;
}

function shiftDate(value, amount) {
  const date = parseDateValue(value);
  date.setDate(date.getDate() + amount);
  return formatDateInput(date);
}

function todayString() {
  return formatDateInput(new Date());
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value) {
  return new Date(`${value}T12:00:00`);
}

function formatCurrency(value) {
  return `GHS ${currency.format(value || 0)}`;
}

function formatCompactCurrency(value) {
  const sign = value < 0 ? "-" : "";
  return `${sign}GHS ${currency.format(Math.abs(value)).replace(".00", "")}`;
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

function parseCSVRows(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      row.push(current.trim());
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current.trim());
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.length));
}

function buildExpenseUploadRows(rows, fallbackDate) {
  if (!rows.length) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headerMap = headerRow.reduce((accumulator, value, index) => {
    accumulator[normalizeHeader(value)] = index;
    return accumulator;
  }, {});

  const categoryIndex = headerMap.category;
  const amountIndex = headerMap.amount;
  const dateIndex = headerMap.date;
  const notesIndex = headerMap.notes;

  if (categoryIndex === undefined || amountIndex === undefined) {
    throw new Error("CSV must include Category and Amount columns.");
  }

  return dataRows
    .map((row, index) => {
      const category = (row[categoryIndex] || "").trim();
      const rawAmount = (row[amountIndex] || "").trim();
      const rawDate = dateIndex === undefined ? "" : (row[dateIndex] || "").trim();
      const notes = notesIndex === undefined ? "" : (row[notesIndex] || "").trim();

      if (!category && !rawAmount && !rawDate && !notes) {
        return null;
      }

      const amount = Number.parseFloat(rawAmount);

      if (!category) {
        throw new Error(`Row ${index + 2}: Category is required.`);
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Row ${index + 2}: Amount must be greater than 0.`);
      }

      const spentOn = rawDate || fallbackDate;

      if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
        throw new Error(`Row ${index + 2}: Date must use YYYY-MM-DD.`);
      }

      return {
        category,
        amount,
        spent_on: spentOn,
        notes,
      };
    })
    .filter(Boolean);
}

function normalizeHeader(value) {
  return value.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
}
