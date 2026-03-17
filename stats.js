const KRW_FORMATTER = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});

function toMonthKey(dateString) {
  return String(dateString || "").slice(0, 7);
}

function getNowInSeoul() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const formatted = formatter.format(now);
  return new Date(`${formatted}T00:00:00+09:00`);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function formatKrw(value) {
  return KRW_FORMATTER.format(Number(value || 0));
}

export function filterByPeriod(receipts, period) {
  const sorted = [...receipts].sort((a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate)));
  const now = getNowInSeoul();
  const thisMonthStart = monthStart(now);

  if (period === "all") {
    return sorted;
  }

  if (period === "last3Months") {
    const from = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 2, 1);
    const fromKey = toDateKey(from);
    return sorted.filter((item) => String(item.purchaseDate) >= fromKey);
  }

  const fromKey = toDateKey(thisMonthStart);
  return sorted.filter((item) => String(item.purchaseDate) >= fromKey);
}

export function buildDailyGroups(receipts) {
  const groups = new Map();

  receipts.forEach((receipt) => {
    const key = receipt.purchaseDate;
    if (!groups.has(key)) {
      groups.set(key, { date: key, total: 0, items: [] });
    }
    const group = groups.get(key);
    group.total += Number(receipt.totalAmount || 0);
    group.items.push(receipt);
  });

  return Array.from(groups.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function computeOverview(receipts, filteredReceipts) {
  const now = getNowInSeoul();
  const currentMonthKey = toMonthKey(toDateKey(now));
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey = toMonthKey(toDateKey(lastMonthDate));

  const thisMonthTotal = receipts
    .filter((item) => toMonthKey(item.purchaseDate) === currentMonthKey)
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  const lastMonthTotal = receipts
    .filter((item) => toMonthKey(item.purchaseDate) === lastMonthKey)
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  const deltaAmount = thisMonthTotal - lastMonthTotal;
  const deltaRate = lastMonthTotal > 0 ? (deltaAmount / lastMonthTotal) * 100 : null;
  const allTimeTotal = receipts.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);

  const grouped = buildDailyGroups(filteredReceipts);
  const totalInPeriod = grouped.reduce((sum, group) => sum + group.total, 0);
  const purchaseDayCount = grouped.length;
  const dailyAverage = purchaseDayCount > 0 ? Math.round(totalInPeriod / purchaseDayCount) : 0;

  return {
    thisMonthTotal,
    lastMonthTotal,
    deltaAmount,
    deltaRate,
    allTimeTotal,
    dailyAverage
  };
}

export function buildMonthlySeries(receipts) {
  const map = new Map();

  receipts.forEach((receipt) => {
    const monthKey = toMonthKey(receipt.purchaseDate);
    const prev = map.get(monthKey) || 0;
    map.set(monthKey, prev + Number(receipt.totalAmount || 0));
  });

  const labels = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  const values = labels.map((label) => map.get(label));

  return { labels, values };
}
