"use client";

import { useState, useCallback, useEffect } from "react";
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

const currentYear = new Date().getFullYear();
const previousYear = currentYear - 1;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_FILTER_STORAGE_KEY = "paisa_excluded_categories";

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

export function Dashboard() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  /** Chart selection: date range (YYYY-MM-DD) to highlight in table; single day when clicked. */
  const [chartSelection, setChartSelection] = useState<{ start: string; end: string } | null>(null);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);

  // Restore API key from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("lm_api_key");
    if (stored) {
      setApiKey(stored);
    }
  }, []);

  // Restore category filter from localStorage on mount
  useEffect(() => {
    setExcludedCategories(loadExcludedCategories());
  }, []);

  // Persist category filter to localStorage when it changes
  const handleExcludedCategoriesChange = useCallback((excluded: string[]) => {
    setExcludedCategories(excluded);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, JSON.stringify(excluded));
      } catch {
        // ignore quota or other storage errors
      }
    }
  }, []);

  // Fetch user info (client-side Lunch Money API)
  const { data: userData } = useSWR<LunchMoneyUser>(
    apiKey ? ["lm-user", apiKey] : null,
    ([, key]: [string, string]) => fetchUser(key)
  );

  // Fetch current year transactions (client-side Lunch Money API)
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
          `${currentYear}-01-01`,
          `${currentYear}-12-31`,
        ]
      : null,
    ([, key, start, end]: [string, string, string, string]) =>
      fetchTransactions(key, start, end).then((transactions) => ({
        transactions,
      })),
    { revalidateOnFocus: false }
  );

  // Fetch previous year transactions (client-side Lunch Money API)
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
          `${previousYear}-01-01`,
          `${previousYear}-12-31`,
        ]
      : null,
    ([, key, start, end]: [string, string, string, string]) =>
      fetchTransactions(key, start, end).then((transactions) => ({
        transactions,
      })),
    { revalidateOnFocus: false }
  );

  const handleConnect = useCallback(async (key: string) => {
    setIsConnecting(true);
    setConnectError(null);

    try {
      // Validate the key by fetching user info (client-side Lunch Money API)
      await fetchUser(key);
      setApiKey(key);
      sessionStorage.setItem("lm_api_key", key);
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
    sessionStorage.removeItem("lm_api_key");
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
    currentYear,
    previousYear,
    selectedMonth ?? undefined,
    excludedCategories.length > 0 ? excludedCategories : undefined
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex flex-col">
            <h1 className="text-base font-semibold text-foreground sm:text-lg">
              Paisa
            </h1>
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Compare</span>
              <Select
                value={selectedMonth === null ? "all" : String(selectedMonth)}
                onValueChange={(v) =>
                  setSelectedMonth(v === "all" ? null : parseInt(v, 10))
                }
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
                  ? `${currentYear} vs ${previousYear}`
                  : `${MONTH_NAMES[selectedMonth - 1]} ${currentYear} vs ${previousYear}`}
              </span>
            </div>
            <CategoryFilter
              allCategories={summary.allCategoryNames}
              excludedCategories={excludedCategories}
              onExcludedChange={handleExcludedCategoriesChange}
            />
          </div>

          {/* Summary Cards */}
          <SummaryCards
            summary={summary}
            currentYear={currentYear}
            previousYear={previousYear}
          />

          {/* Main Chart */}
          <SpendChart
            data={summary.dailyData}
            currentYear={currentYear}
            previousYear={previousYear}
            title={summary.month ? "Cumulative Spend (month)" : "Cumulative Spend"}
            description={
              summary.month
                ? `${MONTH_NAMES[summary.month - 1]} ${currentYear} vs ${previousYear} by day of month`
                : `${currentYear} vs ${previousYear} spending comparison by day`
            }
            totalDaysInView={summary.totalDaysInView}
            isMonthView={!!summary.month}
            selectedRange={chartSelection}
            onSelectionChange={(start, end) => setChartSelection({ start, end })}
          />

          {/* Weekly transaction table (rows = weeks, columns = years) */}
          <WeeklyTransactionTable
            data={summary.weeklyData}
            currentYear={currentYear}
            previousYear={previousYear}
            isMonthView={!!summary.month}
            selection={chartSelection}
          />

          {/* Category Breakdown */}
          <CategoryBreakdown
            categories={summary.topCategories}
            currentYear={currentYear}
            previousYear={previousYear}
          />
        </div>
      </main>
    </div>
  );
}
