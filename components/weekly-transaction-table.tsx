"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import type { WeeklyDataEntry, Transaction } from "@/lib/process-transactions";

const CONDITIONAL_FORMATTING_STORAGE_KEY = "paisa_conditional_formatting";

function loadConditionalFormattingPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(CONDITIONAL_FORMATTING_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

/** Per-category min/max of absolute transaction amount (for conditional formatting). */
export type CategoryAmountRange = Record<string, { min: number; max: number }>;

function computeCategoryRanges(data: WeeklyDataEntry[]): CategoryAmountRange {
  const byCategory: Record<string, number[]> = {};
  for (const row of data) {
    for (const t of [...row.currentYearTransactions, ...row.previousYearTransactions]) {
      const key = t.category_name ?? "Uncategorized";
      if (!byCategory[key]) byCategory[key] = [];
      const amount = Math.abs(parseFloat(t.amount));
      if (!Number.isNaN(amount)) byCategory[key].push(amount);
    }
  }
  const ranges: CategoryAmountRange = {};
  for (const [cat, amounts] of Object.entries(byCategory)) {
    if (amounts.length === 0) continue;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    ranges[cat] = { min, max };
  }
  return ranges;
}

/** Interpolate from green (t=0) to red (t=1). Returns CSS background color. */
function interpolateGreenToRed(t: number): string {
  const clamp = Math.max(0, Math.min(1, t));
  const r = Math.round(34 + (239 - 34) * clamp);
  const g = Math.round(197 - (197 - 68) * clamp);
  const b = Math.round(94 - (94 - 68) * clamp);
  return `rgb(${r} ${g} ${b})`;
}

function getAmountFormatStyle(
  amount: number,
  categoryKey: string,
  ranges: CategoryAmountRange,
  enabled: boolean
): React.CSSProperties {
  if (!enabled || amount === 0) return {};
  const range = ranges[categoryKey];
  if (!range || range.min === range.max) return {};
  const t = (amount - range.min) / (range.max - range.min);
  const bg = interpolateGreenToRed(t);
  const isDark = t > 0.6;
  return {
    backgroundColor: bg,
    color: isDark ? "rgb(255 255 255)" : "rgb(0 0 0)",
    padding: "1px 4px",
    borderRadius: "4px",
  };
}

interface WeeklyTransactionTableProps {
  data: WeeklyDataEntry[];
  currentYear: number;
  previousYear: number;
  isMonthView?: boolean;
  /** When set, individual transactions whose date falls in this range are highlighted. */
  selection?: { start: string; end: string } | null;
}

function isDateInSelection(dateStr: string, selection: { start: string; end: string }): boolean {
  const start = selection.start <= selection.end ? selection.start : selection.end;
  const end = selection.start <= selection.end ? selection.end : selection.start;
  return dateStr >= start && dateStr <= end;
}

function formatAmount(amount: string): string {
  const n = Math.abs(parseFloat(amount));
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format date string (YYYY-MM-DD) as short day label e.g. "(14th)". */
function formatDayShort(dateStr: string): string {
  const day = new Date(dateStr + "T12:00:00").getDate();
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

function CellLineItems({
  transactions,
  total,
  selection,
  conditionalFormatting,
  categoryRanges,
}: {
  transactions: Transaction[];
  total: number;
  selection: { start: string; end: string } | null;
  conditionalFormatting: boolean;
  categoryRanges: CategoryAmountRange;
}) {
  if (transactions.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-0.5 overflow-hidden text-left">
      <div className="shrink-0 font-mono text-xs font-semibold text-foreground tabular-nums">
        ${total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({transactions.length})
      </div>
      <ScrollArea className="h-[200px] w-full shrink-0 overflow-hidden rounded border border-border/40 bg-muted/20">
        <ul className="space-y-1 px-2 py-1 pr-4">
          {transactions.map((t) => {
            const highlighted = selection != null && isDateInSelection(t.date, selection);
            const categoryLabel = (t.category_name || "Uncategorized").toUpperCase();
            const categoryKey = t.category_name ?? "Uncategorized";
            const amountNum = Math.abs(parseFloat(t.amount));
            const amountStyle = getAmountFormatStyle(
              amountNum,
              categoryKey,
              categoryRanges,
              conditionalFormatting
            );
            return (
              <li
                key={t.id}
                className={`flex min-w-0 items-baseline justify-between gap-2 rounded px-1 -mx-1 text-xs ${highlighted ? "bg-primary/15 ring-inset ring-1 ring-primary/40" : ""}`}
              >
                <span className="flex min-w-0 shrink items-baseline gap-1.5 overflow-hidden text-foreground">
                  <span className="shrink-0 text-muted-foreground">{formatDayShort(t.date)}</span>
                  <span className="min-w-0 max-w-[5rem] shrink truncate font-mono tabular-nums text-muted-foreground" title={categoryLabel}>
                    {categoryLabel}
                  </span>
                  <span className="min-w-0 truncate text-foreground" title={t.payee || "Unknown"}>
                    {t.payee || "Unknown"}
                  </span>
                </span>
                <span
                  className="shrink-0 font-mono tabular-nums text-muted-foreground"
                  style={Object.keys(amountStyle).length > 0 ? amountStyle : undefined}
                  title={`$${formatAmount(t.amount)}`}
                >
                  ${formatAmount(t.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}

export function WeeklyTransactionTable({
  data,
  currentYear,
  previousYear,
  isMonthView = false,
  selection = null,
}: WeeklyTransactionTableProps) {
  const [conditionalFormatting, setConditionalFormatting] = useState(true);

  useEffect(() => {
    setConditionalFormatting(loadConditionalFormattingPreference());
  }, []);

  const handleConditionalFormattingChange = useCallback((checked: boolean) => {
    setConditionalFormatting(checked);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(CONDITIONAL_FORMATTING_STORAGE_KEY, String(checked));
      } catch {
        // ignore
      }
    }
  }, []);

  const categoryRanges = useMemo(() => computeCategoryRanges(data), [data]);

  const weekLabel = (week: number) =>
    isMonthView ? `Wk ${week}` : `Wk ${week}`;

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Spend by week</CardTitle>
          <CardDescription>
            Line-item transactions per week — {currentYear} vs {previousYear}. Select a date range on the chart to highlight transactions here.
          </CardDescription>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Table options">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              checked={conditionalFormatting}
              onCheckedChange={handleConditionalFormattingChange}
            >
              Conditional formatting
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[10px] shrink-0">Week</TableHead>
                <TableHead className="min-w-[200px]">{currentYear}</TableHead>
                <TableHead className="min-w-[200px]">{previousYear}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No transaction data for the selected period.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.week} className="align-top">
                    <TableCell className="max-w-[20px] align-top font-medium text-muted-foreground pt-3">
                      {weekLabel(row.week)}
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top overflow-hidden pt-3">
                      <CellLineItems
                        transactions={row.currentYearTransactions}
                        total={row.currentYearTotal}
                        selection={selection}
                        conditionalFormatting={conditionalFormatting}
                        categoryRanges={categoryRanges}
                      />
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top overflow-hidden pt-3">
                      <CellLineItems
                        transactions={row.previousYearTransactions}
                        total={row.previousYearTotal}
                        selection={selection}
                        conditionalFormatting={conditionalFormatting}
                        categoryRanges={categoryRanges}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
