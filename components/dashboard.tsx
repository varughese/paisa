"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import { ApiKeyForm } from "@/components/api-key-form";
import { SpendChart } from "@/components/spend-chart";
import { SummaryCards } from "@/components/summary-cards";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { CategoryFilter } from "@/components/category-filter";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { WeeklyTransactionTable } from "@/components/weekly-transaction-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut, RefreshCw } from "lucide-react";
import { processTransactions, type Transaction } from "@/lib/process-transactions";
import {
  fetchUser,
  fetchTransactions,
  type LunchMoneyUser,
} from "@/lib/lunch-money-client";

const thisYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => thisYear - i);

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_FILTER_STORAGE_KEY = "paisa_excluded_categories";
const URL_PARAM_CATEGORIES = "categories";
const URL_PARAM_MONTH = "month";
/** Period separator so the param stays readable (commas get encoded as %2C). */
const CATEGORIES_SEP = ".";

function loadExcludedCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CATEGORY_FILTER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

/** Build categories param value from included category indices (null if all included). */
function buildCategoriesParamValue(
  excluded: string[],
  allCategoryNames: string[]
): string | null {
  if (allCategoryNames.length === 0) return null;
  const excludedSet = new Set(excluded);
  const includedIndices: number[] = [];
  allCategoryNames.forEach((name, i) => {
    if (!excludedSet.has(name)) includedIndices.push(i);
  });
  if (includedIndices.length === allCategoryNames.length) return null;
  return includedIndices.join(CATEGORIES_SEP);
}

/** Parse categories=0.1.3 into excluded category names using the full list. */
function parseCategoriesParam(
  param: string | null,
  allCategoryNames: string[]
): string[] | null {
  if (param === null || allCategoryNames.length === 0) return null;
  if (param.trim() === "") return allCategoryNames; // empty = include none
  const indices = param
    .split(/[.,]/) // . for readable URLs; , for backward compatibility
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < allCategoryNames.length);
  const includedSet = new Set(indices.map((i) => allCategoryNames[i]));
  const excluded = allCategoryNames.filter((c) => !includedSet.has(c));
  return excluded;
}

function parseMonthParam(param: string | null): number | null {
  if (param === null) return null;
  const raw = param.trim().toLowerCase();
  if (raw === "" || raw === "all") return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) return null;
  return parsed;
}

export function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  /** Compare this year (e.g. 2025) vs this year (e.g. 2024). */
  const [yearA, setYearA] = useState(thisYear);
  const [yearB, setYearB] = useState(thisYear - 1);
  /** Chart selection: date range (YYYY-MM-DD) to highlight in table; single day when clicked. */
  const [chartSelection, setChartSelection] = useState<{ start: string; end: string } | null>(null);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const prevYearsRef = useRef({ yearA, yearB });

  // Restore API key from sessionStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("lm_api_key");
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  // Fetch user info (client-side Lunch Money API)
  const { data: userData } = useSWR<LunchMoneyUser>(
    apiKey ? ["lm-user", apiKey] : null,
    ([, key]: [string, string]) => fetchUser(key)
  );

  // Fetch year A transactions (client-side Lunch Money API)
  const {
    data: currentYearData,
    error: currentError,
    isLoading: currentLoading,
    mutate: mutateCurrent,
  } = useSWR<{ transactions: Transaction[] }>(
    apiKey
      ? [
        "lm-transactions",
        apiKey,
        `${yearA}-01-01`,
        `${yearA}-12-31`,
      ]
      : null,
    ([, key, start, end]: [string, string, string, string]) =>
      fetchTransactions(key, start, end).then((transactions) => ({
        transactions,
      })),
    { revalidateOnFocus: false }
  );

  // Fetch year B transactions (client-side Lunch Money API)
  const {
    data: previousYearData,
    error: previousError,
    isLoading: previousLoading,
    mutate: mutatePrevious,
  } = useSWR<{ transactions: Transaction[] }>(
    apiKey
      ? [
        "lm-transactions",
        apiKey,
        `${yearB}-01-01`,
        `${yearB}-12-31`,
      ]
      : null,
    ([, key, start, end]: [string, string, string, string]) =>
      fetchTransactions(key, start, end).then((transactions) => ({
        transactions,
      })),
    { revalidateOnFocus: false }
  );

  // All category names (from data, no exclusion) for URL param parsing and building
  const allCategoryNames = useMemo(() => {
    if (
      !currentYearData?.transactions?.length &&
      !previousYearData?.transactions?.length
    ) {
      return [];
    }
    return processTransactions(
      currentYearData?.transactions ?? [],
      previousYearData?.transactions ?? [],
      yearA,
      yearB,
      undefined,
      undefined
    ).allCategoryNames;
  }, [currentYearData, previousYearData, yearA, yearB]);

  // Restore category filter: URL params take precedence (for bookmarks); do not override localStorage when applying URL
  useEffect(() => {
    const categoriesParam = searchParams.get(URL_PARAM_CATEGORIES);
    if (categoriesParam !== null && allCategoryNames.length > 0) {
      const excluded = parseCategoriesParam(categoriesParam, allCategoryNames);
      if (excluded !== null) setExcludedCategories(excluded);
    } else if (categoriesParam === null) {
      setExcludedCategories(loadExcludedCategories());
    }
  }, [searchParams, allCategoryNames]);

  // Restore selected month from URL param (for bookmarks/shareable views).
  useEffect(() => {
    setSelectedMonth(parseMonthParam(searchParams.get(URL_PARAM_MONTH)));
  }, [searchParams]);

  // When year selection changes, reset category filter (all included) and clear storage/URL
  useEffect(() => {
    if (prevYearsRef.current.yearA === yearA && prevYearsRef.current.yearB === yearB) return;
    prevYearsRef.current = { yearA, yearB };
    setExcludedCategories([]);
    try {
      localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, "[]");
    } catch {
      // ignore
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete(URL_PARAM_CATEGORIES);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [yearA, yearB, pathname, router, searchParams]);

  // Persist category filter to localStorage and sync selection to URL when user changes it
  const handleExcludedCategoriesChange = useCallback(
    (excluded: string[]) => {
      setExcludedCategories(excluded);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, JSON.stringify(excluded));
        } catch {
          // ignore quota or other storage errors
        }
      }
      const params = new URLSearchParams(searchParams.toString());
      const categoriesParamValue = buildCategoriesParamValue(excluded, allCategoryNames);
      if (categoriesParamValue === null) {
        params.delete(URL_PARAM_CATEGORIES);
      } else {
        params.set(URL_PARAM_CATEGORIES, categoriesParamValue);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, allCategoryNames, searchParams]
  );

  const handleMonthChange = useCallback(
    (value: string) => {
      let nextMonth: number | null = null;
      if (value !== "all") {
        const parsed = parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 12) {
          nextMonth = parsed;
        }
      }
      setSelectedMonth(nextMonth);
      const params = new URLSearchParams(searchParams.toString());
      if (nextMonth === null) {
        params.delete(URL_PARAM_MONTH);
      } else {
        params.set(URL_PARAM_MONTH, String(nextMonth));
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleConnect = useCallback(async (key: string) => {
    setIsConnecting(true);
    setConnectError(null);

    try {
      // Validate the key by fetching user info (client-side Lunch Money API)
      await fetchUser(key);
      setApiKey(key);
      localStorage.setItem("lm_api_key", key);
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : "Failed to connect. Check your API key."
      );
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setApiKey(null);
    localStorage.removeItem("lm_api_key");
    setConnectError(null);
  }, []);

  const handleRefresh = useCallback(() => {
    mutateCurrent();
    mutatePrevious();
  }, [mutateCurrent, mutatePrevious]);

  // No API key - show connect form
  if (!apiKey) {
    return (
      <ApiKeyForm
        onSubmit={handleConnect}
        isLoading={isConnecting}
        error={connectError}
      />
    );
  }

  const isLoading = currentLoading || previousLoading;
  const error = currentError || previousError;

  // Loading state
  if (isLoading && !currentYearData && !previousYearData) {
    return <DashboardSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-destructive">
          {error.message || "Failed to load data"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            Try Again
          </Button>
          <Button variant="ghost" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </div>
    );
  }

  const summary = processTransactions(
    currentYearData?.transactions || [],
    previousYearData?.transactions || [],
    yearA,
    yearB,
    selectedMonth ?? undefined,
    excludedCategories.length > 0 ? excludedCategories : undefined
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Image
                src="/icon.png"
                alt=""
                width={24}
                height={24}
                className="size-6 shrink-0"
              />
              <h1 className="text-base font-semibold text-foreground sm:text-lg">
                Paisa
              </h1>
            </div>
            {userData && (
              <p className="text-xs text-muted-foreground">
                {userData.budget_name || userData.user_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDisconnect}
              aria-label="Disconnect"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6">
          {/* Month and category filters */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Compare</span>
                <Select
                  value={String(yearA)}
                  onValueChange={(v) => setYearA(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">vs</span>
                <Select
                  value={String(yearB)}
                  onValueChange={(v) => setYearB(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[88px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedMonth === null ? "all" : String(selectedMonth)}
                  onValueChange={handleMonthChange}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All year</SelectItem>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={name} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">
                  {selectedMonth === null
                    ? `${yearA} vs ${yearB}`
                    : `${MONTH_NAMES[selectedMonth - 1]} ${yearA} vs ${yearB}`}
                </span>
              </div>
            </div>
            <CategoryFilter
              allCategories={summary.allCategoryNames}
              excludedCategories={excludedCategories}
              onExcludedChange={handleExcludedCategoriesChange}
              categoryTotals={summary.categoryTotals}
              categoryTotalsPreviousYear={summary.categoryTotalsPreviousYear}
            />
          </div>


          {/* Main Chart */}
          <SpendChart
            data={summary.dailyData}
            currentYear={yearA}
            previousYear={yearB}
            title={summary.month ? "Cumulative Spend (month)" : "Cumulative Spend"}
            description={
              summary.month
                ? `${MONTH_NAMES[summary.month - 1]} ${yearA} vs ${yearB} by day of month`
                : `${yearA} vs ${yearB} spending comparison by day`
            }
            totalDaysInView={summary.totalDaysInView}
            isMonthView={!!summary.month}
            currentDayNum={summary.currentDayNum}
            selectedRange={chartSelection}
            onSelectionChange={(start, end) => setChartSelection({ start, end })}
          />

          {/* Weekly transaction table (rows = weeks, columns = years) */}
          <WeeklyTransactionTable
            data={summary.weeklyData}
            currentYear={yearA}
            previousYear={yearB}
            isMonthView={!!summary.month}
            selection={chartSelection}
          />

          {/* Category Breakdown */}
          <CategoryBreakdown
            categories={summary.topCategories}
            currentYear={yearA}
            previousYear={yearB}
          />

          {/* Summary Cards */}
          <SummaryCards
            summary={summary}
            currentYear={yearA}
            previousYear={yearB}
          />
        </div>
      </main>
    </div>
  );
}
