"use client";

import { useRef, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DailyData } from "@/lib/process-transactions";

interface SpendChartProps {
  data: DailyData[];
  currentYear: number;
  previousYear: number;
  title: string;
  description?: string;
  totalDaysInView?: number;
  isMonthView?: boolean;
  /** Current selection range (from click or drag); shown as highlight and reflected in table. */
  selectedRange?: { start: string; end: string } | null;
  /** Called when user selects a range (single day on click, range on drag). */
  onSelectionChange?: (startDate: string, endDate: string) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  currentYear,
  previousYear,
  isMonthView,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string; payload?: { dateStr?: string } }>;
  label?: number;
  currentYear: number;
  previousYear: number;
  isMonthView?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const dateStr = payload[0]?.payload?.dateStr;

  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {dateStr ?? (isMonthView ? `Day ${label} of month` : `Day ${label}`)}
      </p>
      {payload.map((entry) => {
        const year =
          entry.dataKey === "currentYear" ? currentYear : previousYear;
        return (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{year}</span>
            <span className="font-mono text-sm font-semibold text-card-foreground">
              ${entry.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      })}
      {payload.length === 2 && (
        <div className="mt-1.5 border-t border-border/40 pt-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Difference</span>
            <span
              className={`font-mono text-xs font-semibold ${
                payload[0].value - payload[1].value > 0
                  ? "text-destructive"
                  : "text-chart-3"
              }`}
            >
              {payload[0].value - payload[1].value > 0 ? "+" : ""}$
              {Math.abs(payload[0].value - payload[1].value).toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SpendChart({
  data,
  currentYear,
  previousYear,
  title,
  description,
  totalDaysInView = 365,
  isMonthView = false,
  selectedRange = null,
  onSelectionChange,
}: SpendChartProps) {
  const maxValue = Math.max(
    ...data.map((d) => Math.max(d.currentYear, d.previousYear))
  );
  const interactive = Boolean(onSelectionChange);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const getIndexFromEvent = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current || data.length === 0) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      return Math.round(pct * (data.length - 1));
    },
    [data.length]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!interactive || !onSelectionChange) return;
      const idx = getIndexFromEvent(e);
      setDragState({ isDragging: true, startIndex: idx, endIndex: idx });
    },
    [interactive, onSelectionChange, getIndexFromEvent]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState?.isDragging) return;
      const idx = getIndexFromEvent(e);
      setDragState((s) => (s ? { ...s, endIndex: idx } : null));
    },
    [dragState?.isDragging, getIndexFromEvent]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragState || !onSelectionChange) return;
    const lo = Math.min(dragState.startIndex, dragState.endIndex);
    const hi = Math.max(dragState.startIndex, dragState.endIndex);
    const startStr = data[lo]?.dateStr ?? data[0]?.dateStr ?? "";
    const endStr = data[hi]?.dateStr ?? data[data.length - 1]?.dateStr ?? "";
    if (startStr && endStr) onSelectionChange(startStr, endStr);
    setDragState(null);
  }, [dragState, onSelectionChange, data]);

  const handleChartClick = useCallback(
    (state: { activeTooltipIndex?: number }) => {
      if (!interactive || !onSelectionChange || dragState?.isDragging) return;
      const index = state?.activeTooltipIndex;
      if (index != null && data[index]?.dateStr) {
        onSelectionChange(data[index].dateStr, data[index].dateStr);
      }
    },
    [interactive, onSelectionChange, data, dragState?.isDragging]
  );

  // Resolve selection for ReferenceArea (day values for x-axis)
  const refArea =
    dragState != null
      ? { start: data[dragState.startIndex]?.day, end: data[dragState.endIndex]?.day }
      : selectedRange
        ? (() => {
            const si = data.findIndex((d) => d.dateStr === selectedRange.start);
            const ei = data.findIndex((d) => d.dateStr === selectedRange.end);
            if (si < 0 || ei < 0) return null;
            const lo = Math.min(si, ei);
            const hi = Math.max(si, ei);
            return { start: data[lo]?.day, end: data[hi]?.day };
          })()
        : null;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
        {interactive && (
          <CardDescription className="text-xs">
            Click a point to select that day; drag across the chart to select a date range. Selection is highlighted in the table below.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-4">
        <div
          ref={containerRef}
          className={`relative min-h-[420px] h-[55vh] sm:min-h-[520px] sm:h-[65vh] max-h-[720px] ${interactive ? "cursor-crosshair [&_.recharts-dot]:cursor-pointer [&_.recharts-wrapper]:cursor-pointer" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              onClick={handleChartClick}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.90 0.008 240)"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "oklch(0.50 0.01 260)" }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: isMonthView ? "Day of month" : "Day",
                  position: "insideBottom",
                  offset: -4,
                  style: { fontSize: 11, fill: "oklch(0.50 0.01 260)" },
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "oklch(0.50 0.01 260)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatCurrency}
                domain={[0, Math.ceil(maxValue * 1.1)]}
                width={56}
              />
              <Tooltip
                content={
                  <CustomTooltip
                    currentYear={currentYear}
                    previousYear={previousYear}
                    isMonthView={isMonthView}
                  />
                }
              />
              <Legend
                formatter={(value: string) => {
                  const year = value === "currentYear" ? currentYear : previousYear;
                  return (
                    <span className="text-xs font-medium text-foreground">
                      {year}
                    </span>
                  );
                }}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ paddingTop: 12 }}
              />
              {refArea != null && refArea.start != null && refArea.end != null && (
                <ReferenceArea
                  x1={Math.min(refArea.start, refArea.end)}
                  x2={Math.max(refArea.start, refArea.end)}
                  strokeOpacity={0}
                  fill="oklch(0.55 0.15 250 / 0.15)"
                />
              )}
              <Line
                type="monotone"
                dataKey="currentYear"
                stroke="oklch(0.55 0.15 250)"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={interactive ? { r: 5, strokeWidth: 2 } : { r: 4, strokeWidth: 2 }}
                name="currentYear"
              />
              <Line
                type="monotone"
                dataKey="previousYear"
                stroke="oklch(0.60 0.18 20)"
                strokeWidth={2.5}
                dot={{ r: 4, strokeWidth: 2 }}
                activeDot={interactive ? { r: 5, strokeWidth: 2 } : { r: 4, strokeWidth: 2 }}
                name="previousYear"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
