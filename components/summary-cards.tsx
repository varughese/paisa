"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react";
import type { SpendSummary } from "@/lib/process-transactions";

interface SummaryCardsProps {
  summary: SpendSummary;
  currentYear: number;
  previousYear: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function SummaryCards({ summary, currentYear, previousYear }: SummaryCardsProps) {
  const isOverspending = summary.difference > 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {currentYear} Spend
            </span>
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatCurrency(summary.totalCurrentYear)}
          </span>
          <span className="text-xs text-muted-foreground">
            Week {summary.currentWeek} of {summary.totalWeeksInView}
          </span>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {previousYear} Total
            </span>
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatCurrency(summary.totalPreviousYear)}
          </span>
          <span className="text-xs text-muted-foreground">
            {summary.month ? `Month total` : "Full year"}
          </span>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="flex items-center gap-2">
            {isOverspending ? (
              <TrendingUp className="h-4 w-4 text-destructive" />
            ) : (
              <TrendingDown className="h-4 w-4 text-chart-3" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              YoY Change
            </span>
          </div>
          <span
            className={`font-mono text-xl font-bold tracking-tight sm:text-2xl ${
              isOverspending ? "text-destructive" : "text-chart-3"
            }`}
          >
            {isOverspending ? "+" : ""}
            {formatCurrency(summary.difference)}
          </span>
          {summary.percentChange !== null && (
            <span
              className={`text-xs ${
                isOverspending ? "text-destructive" : "text-chart-3"
              }`}
            >
              {isOverspending ? "+" : ""}
              {summary.percentChange.toFixed(1)}% vs {previousYear}
            </span>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-1 p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Weekly Avg
            </span>
          </div>
          <span className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {formatCurrency(summary.currentYearWeeklyAvg)}
          </span>
          <span className="text-xs text-muted-foreground">
            vs {formatCurrency(summary.previousYearWeeklyAvg)}/wk in {previousYear}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
