"use client";

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
import type { WeeklyDataEntry, Transaction } from "@/lib/process-transactions";

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
  return `(${day}${suffix})`;
}

function CellLineItems({
  transactions,
  total,
  selection,
}: {
  transactions: Transaction[];
  total: number;
  selection: { start: string; end: string } | null;
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
            return (
              <li
                key={t.id}
                className={`flex items-baseline justify-between gap-2 rounded px-1 -mx-1 text-xs ${highlighted ? "bg-primary/15 ring-inset ring-1 ring-primary/40" : ""}`}
              >
                <span className="min-w-0 truncate text-foreground" title={t.payee}>
                  {t.payee || "Unknown"}
                  <span className="ml-1 text-muted-foreground">{formatDayShort(t.date)}</span>
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
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
  const weekLabel = (week: number) =>
    isMonthView ? `Week ${week}` : `Week ${week}`;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Spend by week</CardTitle>
        <CardDescription>
          Line-item transactions per week — {currentYear} vs {previousYear}. Select a date range on the chart to highlight transactions here.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px] shrink-0">Week</TableHead>
                <TableHead className="w-[240px] min-w-[200px]">{currentYear}</TableHead>
                <TableHead className="w-[240px] min-w-[200px]">{previousYear}</TableHead>
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
                    <TableCell className="max-w-[100px] align-top font-medium text-muted-foreground pt-3">
                      {weekLabel(row.week)}
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top overflow-hidden pt-3">
                      <CellLineItems
                        transactions={row.currentYearTransactions}
                        total={row.currentYearTotal}
                        selection={selection}
                      />
                    </TableCell>
                    <TableCell className="max-w-[240px] align-top overflow-hidden pt-3">
                      <CellLineItems
                        transactions={row.previousYearTransactions}
                        total={row.previousYearTotal}
                        selection={selection}
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
