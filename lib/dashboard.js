function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDate(date) {
  if (!date) {
    return "";
  }

  if (typeof date === "string") {
    const trimmed = date.trim();
    if (!trimmed) {
      return "";
    }

    const isoPrefixMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoPrefixMatch) {
      const [, year, month, day] = isoPrefixMatch;
      return `${year}-${month}-${day}`;
    }

    const parsedFromString = new Date(trimmed);
    if (Number.isNaN(parsedFromString.getTime())) {
      return "";
    }

    return formatLocalDate(parsedFromString);
  }

  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return formatLocalDate(parsed);
}

export function filterByDate(data, filter, key) {
  const { from, to } = getDateBounds(filter);

  return data.filter((entry) => {
    const entryDate = normalizeDate(entry[key] || entry.created_at);
    return entryDate && entryDate >= from && entryDate <= to;
  });
}

export function computeMetrics(sales, expenses) {
  const revenue = sales.reduce((total, sale) => total + Number(sale.total || 0), 0);
  const expenseTotal = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const net = revenue - expenseTotal;
  const itemsSold = sales.reduce((total, sale) => total + Number(sale.quantity || 0), 0);
  const saleCount = sales.length;
  const expenseCount = expenses.length;
  const bestSeller = getBestSeller(sales);
  const biggestExpense = getBiggestExpense(expenses);
  const margin = revenue > 0 ? ((net / revenue) * 100) : 0;
  const bestSellerRevenue = bestSeller
    ? sales.filter((s) => s.item_name === bestSeller.name).reduce((t, s) => t + Number(s.total || 0), 0)
    : 0;

  return {
    revenue,
    expenseTotal,
    net,
    itemsSold,
    saleCount,
    expenseCount,
    bestSeller,
    bestSellerRevenue,
    biggestExpense,
    margin,
    statusTone: net > 0 ? "positive" : net < 0 ? "negative" : "neutral",
    statusLabel: net > 0 ? "Profit" : net < 0 ? "Loss" : "Break even",
  };
}

export function createSingleDateFilter(value = normalizeDate(new Date())) {
  return {
    type: "single",
    value,
    from: null,
    to: null,
  };
}

export function createRangeDateFilter(from, to) {
  return {
    type: "range",
    value: "",
    from: normalizeDate(from),
    to: normalizeDate(to),
  };
}

export function getDateBounds(filter) {
  if (filter.type === "range") {
    const rawFrom = normalizeDate(filter.from);
    const rawTo = normalizeDate(filter.to || filter.from);

    if (!rawFrom || !rawTo) {
      const today = normalizeDate(new Date());
      return { from: today, to: today };
    }

    return rawFrom <= rawTo ? { from: rawFrom, to: rawTo } : { from: rawTo, to: rawFrom };
  }

  const value = normalizeDate(filter.value || new Date());
  return { from: value, to: value };
}

export function shiftDateFilter(filter, amount) {
  if (filter.type === "range") {
    return {
      ...filter,
      from: shiftDateValue(filter.from, amount),
      to: shiftDateValue(filter.to, amount),
    };
  }

  return {
    ...filter,
    value: shiftDateValue(filter.value, amount),
  };
}

export function shiftDateValue(value, amount) {
  const normalized = normalizeDate(value || new Date());
  const date = new Date(`${normalized}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + amount);
  return formatLocalDate(date);
}

export function createTodayFilter() {
  return createSingleDateFilter(normalizeDate(new Date()));
}

export function createYesterdayFilter() {
  return createSingleDateFilter(shiftDateValue(normalizeDate(new Date()), -1));
}

export function normalizeSalesRows(rows) {
  return (rows || []).map((sale) => ({
    ...sale,
    sold_on: normalizeDate(sale.sold_on || sale.created_at),
    quantity: Number(sale.quantity || 0),
    unit_price: Number(sale.unit_price || 0),
    total: Number(sale.total || 0),
  }));
}

export function normalizeExpenseRows(rows) {
  return (rows || []).map((expense) => {
    const expenseName =
      (expense.expense_name || expense.name || expense.notes || expense.category || "Expense").trim() || "Expense";

    return {
      ...expense,
      spent_on: normalizeDate(expense.spent_on || expense.created_at),
      amount: Number(expense.amount || 0),
      category: (expense.category || "General").trim() || "General",
      expense_name: expenseName,
    };
  });
}

export function buildSalePayload(form, menuItems, soldOn) {
  const selectedMenu = menuItems.find((item) => item.id === form.itemId);
  const quantity = Math.max(1, Number.parseInt(form.quantity, 10) || 0);
  const unitPrice = Math.max(0, Number.parseFloat(form.unitPrice) || 0);

  if (!selectedMenu || quantity <= 0 || unitPrice <= 0) {
    return { error: "Enter a valid sale before saving.", payload: null };
  }

  return {
    error: "",
    payload: {
      item_id: selectedMenu.id,
      item_name: selectedMenu.name,
      sold_on: normalizeDate(soldOn),
      quantity,
      unit_price: unitPrice,
      total: quantity * unitPrice,
      notes: "",
    },
  };
}

export function buildExpensePayload(form, spentOn) {
  const amount = Math.max(0, Number.parseFloat(form.amount) || 0);
  const expenseName = (form.name || "").trim();
  const category = (form.category || "General").trim() || "General";

  if (!expenseName || amount <= 0) {
    return { error: "Enter an expense name and amount before saving.", payload: null };
  }

  return {
    error: "",
    payload: {
      category,
      amount,
      spent_on: normalizeDate(spentOn),
      notes: expenseName,
    },
  };
}

export function buildSalesExportRows(sales) {
  return [
    ["Date", "Item", "Quantity", "Unit Price (GHS)", "Total (GHS)"],
    ...sales.map((sale) => [
      sale.sold_on,
      sale.item_name,
      sale.quantity,
      sale.unit_price.toFixed(2),
      sale.total.toFixed(2),
    ]),
  ];
}

export function buildExpenseExportRows(expenses) {
  return [
    ["Date", "Expense Name", "Category", "Amount (GHS)"],
    ...expenses.map((expense) => [
      expense.spent_on,
      expense.expense_name,
      expense.category,
      expense.amount.toFixed(2),
    ]),
  ];
}

export function parseCSVRows(text) {
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

export function buildExpenseUploadRows(rows, fallbackDate) {
  if (!rows.length) {
    return [];
  }

  const [headerRow, ...dataRows] = rows;
  const headerMap = headerRow.reduce((accumulator, value, index) => {
    accumulator[normalizeHeader(value)] = index;
    return accumulator;
  }, {});

  const nameIndex = firstDefinedIndex(headerMap, ["expense name", "name", "notes"]);
  const categoryIndex = firstDefinedIndex(headerMap, ["category"]);
  const amountIndex = firstDefinedIndex(headerMap, ["amount"]);
  const dateIndex = firstDefinedIndex(headerMap, ["date"]);

  if (amountIndex === undefined || categoryIndex === undefined) {
    throw new Error("CSV must include Category and Amount columns.");
  }

  return dataRows
    .map((row, index) => {
      const rawName = nameIndex === undefined ? "" : (row[nameIndex] || "").trim();
      const rawCategory = (row[categoryIndex] || "").trim();
      const rawAmount = (row[amountIndex] || "").trim();
      const rawDate = dateIndex === undefined ? "" : (row[dateIndex] || "").trim();

      if (!rawName && !rawCategory && !rawAmount && !rawDate) {
        return null;
      }

      const amount = Number.parseFloat(rawAmount);
      const category = rawCategory || "General";
      const expenseName = rawName || rawCategory;

      if (!expenseName) {
        throw new Error(`Row ${index + 2}: Expense name is required.`);
      }

      if (!category) {
        throw new Error(`Row ${index + 2}: Category is required.`);
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Row ${index + 2}: Amount must be greater than 0.`);
      }

      const spentOn = normalizeDate(rawDate || fallbackDate);

      if (!spentOn) {
        throw new Error(`Row ${index + 2}: Date must use YYYY-MM-DD.`);
      }

      return {
        category,
        amount,
        spent_on: spentOn,
        notes: expenseName,
      };
    })
    .filter(Boolean);
}

function normalizeHeader(value) {
  return value.toLowerCase().replace(/\s*\(.*?\)\s*/g, "").trim();
}

function firstDefinedIndex(map, keys) {
  return keys.find((key) => map[key] !== undefined) !== undefined
    ? map[keys.find((key) => map[key] !== undefined)]
    : undefined;
}

function getBiggestExpense(expenses) {
  if (!expenses.length) {
    return null;
  }

  return expenses.reduce((biggest, expense) => {
    const amount = Number(expense.amount || 0);
    return amount > (biggest?.amount || 0) ? { name: expense.expense_name || expense.category || "Expense", amount } : biggest;
  }, null);
}

function getBestSeller(sales) {
  if (!sales.length) {
    return null;
  }

  const grouped = sales.reduce((accumulator, sale) => {
    const key = sale.item_name || "Unknown";

    if (!accumulator[key]) {
      accumulator[key] = {
        name: key,
        quantity: 0,
      };
    }

    accumulator[key].quantity += Number(sale.quantity || 0);
    return accumulator;
  }, {});

  return Object.values(grouped).sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.name.localeCompare(right.name);
  })[0];
}
