"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CategorySpend } from "@/lib/process-transactions";

interface CategoryBreakdownProps {
  categories: CategorySpend[];
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

export function CategoryBreakdown({
  categories,
  currentYear,
  previousYear,
}: CategoryBreakdownProps) {
  if (!categories.length) return null;

  const maxSpend = Math.max(...categories.map((c) => c.currentYear));

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">Top Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center gap-4 border-b border-border/40 pb-2">
            <span className="flex-1 text-xs font-medium text-muted-foreground">
              Category
            </span>
            <span className="w-20 text-right text-xs font-medium text-muted-foreground sm:w-24">
              {currentYear}
            </span>
            <span className="w-20 text-right text-xs font-medium text-muted-foreground sm:w-24">
              {previousYear}
            </span>
            <span className="hidden w-20 text-right text-xs font-medium text-muted-foreground sm:block sm:w-24">
              Change
            </span>
          </div>

          {categories.map((cat) => {
            const barWidth =
              maxSpend > 0 ? (cat.currentYear / maxSpend) * 100 : 0;
            const isUp = cat.difference > 0;
            const isDown = cat.difference < 0;

            return (
              <div key={cat.name} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-4">
                  <div className="flex flex-1 flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">
                      {cat.name}
                    </span>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-chart-1 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-20 text-right font-mono text-sm font-semibold text-foreground sm:w-24">
                    {formatCurrency(cat.currentYear)}
                  </span>
                  <span className="w-20 text-right font-mono text-sm text-muted-foreground sm:w-24">
                    {formatCurrency(cat.previousYear)}
                  </span>
                  <div className="hidden w-20 items-center justify-end gap-1 sm:flex sm:w-24">
                    {isUp && <TrendingUp className="h-3 w-3 text-destructive" />}
                    {isDown && (
                      <TrendingDown className="h-3 w-3 text-chart-3" />
                    )}
                    {!isUp && !isDown && (
                      <Minus className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span
                      className={`font-mono text-xs font-medium ${
                        isUp
                          ? "text-destructive"
                          : isDown
                            ? "text-chart-3"
                            : "text-muted-foreground"
                      }`}
                    >
                      {cat.percentChange !== null
                        ? `${isUp ? "+" : ""}${cat.percentChange.toFixed(0)}%`
                        : "New"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
