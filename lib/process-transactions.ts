import { getISOWeek, getDate, startOfYear, addDays, getDaysInMonth } from "date-fns";

export interface Transaction {
  id: number;
  date: string;
  amount: string;
  currency: string;
  to_base?: number;
  payee: string;
  category_name: string | null;
  category_group_name?: string | null;
  is_income: boolean;
  exclude_from_totals: boolean;
}

/** Day-based point for the chart (x-axis = day). dateStr is YYYY-MM-DD for tooltip/click. */
export interface DailyData {
  day: number;
  currentYear: number;
  previousYear: number;
  /** Present when the day maps to a single date (for filtering transactions). */
  dateStr?: string;
}

export interface CategorySpend {
  name: string;
  currentYear: number;
  previousYear: number;
  difference: number;
  percentChange: number | null;
}

/** Per-week totals, counts, and line items for the transaction table (rows = weeks, columns = years). */
export interface WeeklyDataEntry {
  week: number;
  currentYearTotal: number;
  currentYearCount: number;
  currentYearTransactions: Transaction[];
  previousYearTotal: number;
  previousYearCount: number;
  previousYearTransactions: Transaction[];
}

export interface SpendSummary {
  totalCurrentYear: number;
  totalPreviousYear: number;
  difference: number;
  percentChange: number | null;
  dailyData: DailyData[];
  topCategories: CategorySpend[];
  /** All category names that have spend (for filter UI) */
  allCategoryNames: string[];
  currentWeek: number;
  currentYearWeeklyAvg: number;
  previousYearWeeklyAvg: number;
  /** When set, data is for this month only (1-12) */
  month?: number;
  totalDaysInView: number;
  /** Weekly breakdown for transaction table (week, totals and counts per year) */
  weeklyData: WeeklyDataEntry[];
  /** Current year spend per category for the range (before category exclusion), for filter labels */
  categoryTotals: Record<string, number>;
}

export function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + "T12:00:00");
  return getISOWeek(date);
}

/** Week of month 1-5 (days 1-7, 8-14, 15-21, 22-28, 29-31) */
export function getWeekOfMonth(dateStr: string): number {
  const date = new Date(dateStr + "T12:00:00");
  const day = date.getDate();
  return Math.min(5, Math.ceil(day / 7));
}

/** Day of year 1-366 */
function getDayOfYear(dateStr: string, year: number): number {
  const date = new Date(dateStr + "T12:00:00");
  if (date.getFullYear() !== year) return 0;
  const start = startOfYear(date);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

/** Day of month 1-31 */
function getDayOfMonth(dateStr: string): number {
  const date = new Date(dateStr + "T12:00:00");
  return getDate(date);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Format day of year as YYYY-MM-DD */
function dateFromDayOfYear(year: number, dayOfYear: number): string {
  const start = startOfYear(new Date(year, 0, 1));
  const d = addDays(start, dayOfYear - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function filterByMonth(tx: Transaction[], year: number, month: number): Transaction[] {
  return tx.filter((t) => {
    const d = new Date(t.date + "T12:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function processTransactions(
  currentYearTx: Transaction[],
  previousYearTx: Transaction[],
  currentYear: number,
  previousYear: number,
  month?: number, // 1-12; when set, compare this month only (e.g. Jan vs Jan)
  excludeCategoryNames?: string[]
): SpendSummary {
  // Optional month filter: same month across both years
  const currentTx = month
    ? filterByMonth(currentYearTx, currentYear, month)
    : currentYearTx;
  const previousTx = month
    ? filterByMonth(previousYearTx, previousYear, month)
    : previousYearTx;

  // Filter: only debits (negative amounts when debit_as_negative is true), exclude income, exclude exclude_from_totals
  const filterExpenses = (tx: Transaction[]) =>
    tx.filter(
      (t) =>
        !t.is_income &&
        !t.exclude_from_totals &&
        parseFloat(t.amount) < 0
    );

  let currentExpenses = filterExpenses(currentTx);
  let previousExpenses = filterExpenses(previousTx);

  // All category names (from unfiltered expenses) for filter UI
  const allCategoryNames = (() => {
    const set = new Set<string>();
    for (const t of currentExpenses) {
      set.add(t.category_name || "Uncategorized");
    }
    for (const t of previousExpenses) {
      set.add(t.category_name || "Uncategorized");
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  })();

  // Current-year spend per category for the range (before exclusion), for filter labels
  const categoryTotals: Record<string, number> = {};
  for (const t of currentExpenses) {
    const cat = t.category_name || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(parseFloat(t.amount));
  }
  for (const name of allCategoryNames) {
    if (!(name in categoryTotals)) categoryTotals[name] = 0;
  }
  for (const k of Object.keys(categoryTotals)) {
    categoryTotals[k] = Math.round(categoryTotals[k]);
  }

  // Optional category exclusion
  if (excludeCategoryNames?.length) {
    const excludeSet = new Set(excludeCategoryNames);
    const byCategory = (t: Transaction) =>
      !excludeSet.has(t.category_name || "Uncategorized");
    currentExpenses = currentExpenses.filter(byCategory);
    previousExpenses = previousExpenses.filter(byCategory);
  }

  const getWeek = month
    ? (dateStr: string) => getWeekOfMonth(dateStr)
    : (dateStr: string) => getWeekNumber(dateStr);

  const now = new Date();
  const currentWeekNum = month
    ? now.getFullYear() === currentYear && now.getMonth() + 1 === month
      ? Math.min(5, Math.ceil(now.getDate() / 7))
      : 5
    : now.getFullYear() === currentYear
      ? getISOWeek(now)
      : 52;

  const isCurrentYear = now.getFullYear() === currentYear;
  const isCurrentMonth = month != null && now.getMonth() + 1 === month;

  // Day-based view: max days and current day index
  const maxDays = month
    ? getDaysInMonth(new Date(currentYear, (month ?? 1) - 1, 1))
    : isLeapYear(currentYear)
      ? 366
      : 365;
  const currentDayNum = month
    ? isCurrentYear && isCurrentMonth
      ? getDate(now)
      : maxDays
    : isCurrentYear
      ? getDayOfYear(
        `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
        currentYear
      )
      : maxDays;
  const totalDaysInView = Math.min(maxDays, currentDayNum);

  // Accumulate daily spend (day = day of year or day of month)
  const currentDaily: Record<number, number> = {};
  const previousDaily: Record<number, number> = {};

  const getDay = month
    ? (dateStr: string) => getDayOfMonth(dateStr)
    : (dateStr: string) => getDayOfYear(dateStr, currentYear);

  const getDayPrev = month
    ? (dateStr: string) => getDayOfMonth(dateStr)
    : (dateStr: string) => getDayOfYear(dateStr, previousYear);

  // Category tracking
  const currentCategorySpend: Record<string, number> = {};
  const previousCategorySpend: Record<string, number> = {};

  for (const tx of currentExpenses) {
    const day = getDay(tx.date);
    if (day >= 1 && day <= maxDays) {
      const amount = Math.abs(parseFloat(tx.amount));
      currentDaily[day] = (currentDaily[day] || 0) + amount;
    }
    const cat = tx.category_name || "Uncategorized";
    currentCategorySpend[cat] = (currentCategorySpend[cat] || 0) + Math.abs(parseFloat(tx.amount));
  }

  for (const tx of previousExpenses) {
    const day = getDayPrev(tx.date);
    if (day >= 1 && day <= maxDays) {
      const amount = Math.abs(parseFloat(tx.amount));
      previousDaily[day] = (previousDaily[day] || 0) + amount;
    }
    const cat = tx.category_name || "Uncategorized";
    previousCategorySpend[cat] = (previousCategorySpend[cat] || 0) + Math.abs(parseFloat(tx.amount));
  }

  // Build cumulative daily data with dateStr for tooltip/click
  const dailyData: DailyData[] = [];
  let cumulativeCurrent = 0;
  let cumulativePrevious = 0;

  for (let day = 1; day <= totalDaysInView; day++) {
    cumulativeCurrent += currentDaily[day] || 0;
    cumulativePrevious += previousDaily[day] || 0;
    const dateStr = month
      ? `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      : dateFromDayOfYear(currentYear, day);
    dailyData.push({
      day,
      currentYear: Math.round(cumulativeCurrent),
      previousYear: Math.round(cumulativePrevious),
      dateStr,
    });
  }

  // Totals
  const totalCurrentYear = Math.round(cumulativeCurrent);
  const totalPreviousYear = Math.round(cumulativePrevious);
  const difference = totalCurrentYear - totalPreviousYear;
  const percentChange =
    totalPreviousYear > 0
      ? ((totalCurrentYear - totalPreviousYear) / totalPreviousYear) * 100
      : null;

  // Top categories by current year spend
  const allCategories = new Set([
    ...Object.keys(currentCategorySpend),
    ...Object.keys(previousCategorySpend),
  ]);

  const topCategories: CategorySpend[] = [...allCategories]
    .map((name) => {
      const cy = currentCategorySpend[name] || 0;
      const py = previousCategorySpend[name] || 0;
      return {
        name,
        currentYear: Math.round(cy),
        previousYear: Math.round(py),
        difference: Math.round(cy - py),
        percentChange: py > 0 ? ((cy - py) / py) * 100 : null,
      };
    })
    .sort((a, b) => b.currentYear - a.currentYear)
    .slice(0, 8);

  // Weekly averages (for summary cards)
  const totalWeeksForAvg = month ? 5 : 52;
  const currentYearWeeklyAvg =
    currentWeekNum > 0 ? totalCurrentYear / currentWeekNum : 0;
  const previousYearWeeklyAvg =
    totalWeeksForAvg > 0 ? totalPreviousYear / totalWeeksForAvg : 0;

  // Weekly aggregation for transaction table (same getWeek as above), with line items
  const currentByWeek: Record<number, { total: number; transactions: Transaction[] }> = {};
  const previousByWeek: Record<number, { total: number; transactions: Transaction[] }> = {};
  for (const tx of currentExpenses) {
    const w = getWeek(tx.date);
    const amount = Math.abs(parseFloat(tx.amount));
    if (!currentByWeek[w]) currentByWeek[w] = { total: 0, transactions: [] };
    currentByWeek[w].total += amount;
    currentByWeek[w].transactions.push(tx);
  }
  for (const tx of previousExpenses) {
    const w = getWeek(tx.date);
    const amount = Math.abs(parseFloat(tx.amount));
    if (!previousByWeek[w]) previousByWeek[w] = { total: 0, transactions: [] };
    previousByWeek[w].total += amount;
    previousByWeek[w].transactions.push(tx);
  }
  // Sort transactions by date desc within each week
  for (const rec of Object.values(currentByWeek)) {
    rec.transactions.sort((a, b) => b.date.localeCompare(a.date));
  }
  for (const rec of Object.values(previousByWeek)) {
    rec.transactions.sort((a, b) => b.date.localeCompare(a.date));
  }
  const allWeeks = [...new Set([...Object.keys(currentByWeek), ...Object.keys(previousByWeek)].map(Number))].sort((a, b) => a - b);
  const weeklyData: WeeklyDataEntry[] = allWeeks.map((week) => ({
    week,
    currentYearTotal: Math.round(currentByWeek[week]?.total ?? 0),
    currentYearCount: currentByWeek[week]?.transactions.length ?? 0,
    currentYearTransactions: currentByWeek[week]?.transactions ?? [],
    previousYearTotal: Math.round(previousByWeek[week]?.total ?? 0),
    previousYearCount: previousByWeek[week]?.transactions.length ?? 0,
    previousYearTransactions: previousByWeek[week]?.transactions ?? [],
  }));

  return {
    totalCurrentYear,
    totalPreviousYear,
    difference,
    percentChange,
    dailyData,
    topCategories,
    allCategoryNames,
    currentWeek: currentWeekNum,
    currentYearWeeklyAvg: Math.round(currentYearWeeklyAvg),
    previousYearWeeklyAvg: Math.round(previousYearWeeklyAvg),
    month,
    totalDaysInView,
    weeklyData,
    categoryTotals,
  };
}
