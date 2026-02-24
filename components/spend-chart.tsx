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
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DailyData } from "@/lib/process-transactions";

/** Renders a tiny filled dot only when this point's value is greater than the previous day's. */
function dotWhenHigher(
  data: DailyData[],
  dataKey: "currentYear" | "previousYear",
  baseDotProps: { r: number; fill: string }
) {
  return (props: { cx?: number; cy?: number; payload?: DailyData; index?: number }) => {
    const { cx, cy, payload, index = 0 } = props;
    if (index === 0 || cx == null || cy == null || !payload) return null;
    const prev = data[index - 1];
    if (!prev || payload[dataKey] <= prev[dataKey]) return null;
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={baseDotProps.r}
        fill={baseDotProps.fill}
      />
    );
  };
}

interface SpendChartProps {
  data: DailyData[];
  currentYear: number;
  previousYear: number;
  title: string;
  description?: string;
  totalDaysInView?: number;
  isMonthView?: boolean;
  /** When set, draw a vertical gray line at this day (1-based) for "today" in current year. */
  currentDayNum?: number | null;
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

function formatTooltipCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatSignedCurrency(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function toneClassForDelta(value: number): string {
  if (value > 0) return "text-destructive";
  if (value < 0) return "text-chart-3";
  return "text-muted-foreground";
}

function TooltipYearSection({
  year,
  color,
  cumulative,
  vsPreviousDay,
  daySpend,
  categories,
}: {
  year: number;
  color: string;
  cumulative: number;
  vsPreviousDay: number | null;
  daySpend: number;
  categories: Array<{ name: string; amount: number }>;
}) {
  const visibleCategories = categories.slice(0, 4);

  return (
    <div className="rounded-md bg-muted/20 px-2 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-muted-foreground">{year}</span>
        </div>
        <span className="font-mono text-sm font-semibold text-card-foreground">
          {formatTooltipCurrency(cumulative)}
        </span>
      </div>

      <div className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
        <span className="text-muted-foreground">vs previous day</span>
        <span
          className={`text-right font-mono ${
            vsPreviousDay == null
              ? "text-muted-foreground"
              : toneClassForDelta(vsPreviousDay)
          }`}
        >
          {vsPreviousDay == null ? "—" : formatSignedCurrency(vsPreviousDay)}
        </span>
        <span className="text-muted-foreground">Spend on this day</span>
        <span className="text-right font-mono text-card-foreground">
          {formatTooltipCurrency(daySpend)}
        </span>
      </div>

      <div className="mt-1.5 border-t border-border/40 pt-1.5">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Category breakdown (day)
        </p>
        {visibleCategories.length > 0 ? (
          <div className="space-y-0.5">
            {visibleCategories.map((category) => (
              <div
                key={`${year}-${category.name}`}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate text-card-foreground">{category.name}</span>
                <span className="font-mono text-card-foreground">
                  {formatTooltipCurrency(category.amount)}
                </span>
              </div>
            ))}
            {categories.length > visibleCategories.length && (
              <p className="pt-0.5 text-right text-[10px] text-muted-foreground">
                +{categories.length - visibleCategories.length} more categories
              </p>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">No spend on this day</p>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  data,
  currentYear,
  previousYear,
  isMonthView,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number;
    dataKey?: string;
    color?: string;
    payload?: DailyData;
  }>;
  label?: number;
  data: DailyData[];
  currentYear: number;
  previousYear: number;
  isMonthView?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const dateStr = point.dateStr;
  const currentEntry = payload.find((entry) => entry.dataKey === "currentYear");
  const previousEntry = payload.find((entry) => entry.dataKey === "previousYear");
  const currentValue = Math.round(currentEntry?.value ?? point.currentYear);
  const previousValue = Math.round(previousEntry?.value ?? point.previousYear);
  const difference = currentValue - previousValue;

  const currentColor = currentEntry?.color ?? "oklch(0.55 0.15 250)";
  const previousColor = previousEntry?.color ?? "oklch(0.60 0.18 20)";

  const pointIndex = data.findIndex((d) => d.day === point.day);
  const previousPoint = pointIndex > 0 ? data[pointIndex - 1] : null;
  const currentVsPreviousDay =
    previousPoint != null ? currentValue - previousPoint.currentYear : null;
  const previousVsPreviousDay =
    previousPoint != null ? previousValue - previousPoint.previousYear : null;
  const previousDifference =
    previousPoint != null
      ? previousPoint.currentYear - previousPoint.previousYear
      : null;
  const differenceVsPreviousDay =
    previousDifference != null ? difference - previousDifference : null;
  const visibleDrivers = point.differenceDrivers.slice(0, 5);

  return (
    <div className="max-h-[420px] w-[320px] overflow-y-auto rounded-lg border border-border/60 bg-card px-3 py-2.5 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {dateStr ?? (isMonthView ? `Day ${label} of month` : `Day ${label}`)}
      </p>
      <div className="space-y-1.5">
        <TooltipYearSection
          year={currentYear}
          color={currentColor}
          cumulative={currentValue}
          vsPreviousDay={currentVsPreviousDay}
          daySpend={point.currentDaySpend}
          categories={point.currentDayCategoryBreakdown}
        />
        <TooltipYearSection
          year={previousYear}
          color={previousColor}
          cumulative={previousValue}
          vsPreviousDay={previousVsPreviousDay}
          daySpend={point.previousDaySpend}
          categories={point.previousDayCategoryBreakdown}
        />
      </div>

      <div className="mt-2 border-t border-border/40 pt-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Difference</span>
          <span
            className={`font-mono text-xs font-semibold ${toneClassForDelta(
              difference
            )}`}
          >
            {formatSignedCurrency(difference)}
          </span>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">Diff vs previous day</span>
          <span
            className={`font-mono text-xs font-semibold ${
              differenceVsPreviousDay == null
                ? "text-muted-foreground"
                : toneClassForDelta(differenceVsPreviousDay)
            }`}
          >
            {differenceVsPreviousDay == null
              ? "—"
              : formatSignedCurrency(differenceVsPreviousDay)}
          </span>
        </div>

        <div className="mt-1.5 border-t border-border/40 pt-1.5">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            What is driving today&apos;s difference
          </p>
          {visibleDrivers.length > 0 ? (
            <div className="space-y-1">
              {visibleDrivers.map((driver) => (
                <div key={driver.name} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-card-foreground">
                      {driver.name}
                    </span>
                    <span
                      className={`font-mono font-medium ${toneClassForDelta(
                        driver.difference
                      )}`}
                    >
                      {formatSignedCurrency(driver.difference)}
                    </span>
                  </div>
                  <p className="text-right text-[10px] text-muted-foreground">
                    {currentYear} {formatTooltipCurrency(driver.currentYear)} vs{" "}
                    {previousYear} {formatTooltipCurrency(driver.previousYear)}
                  </p>
                </div>
              ))}
              {point.differenceDrivers.length > visibleDrivers.length && (
                <p className="text-right text-[10px] text-muted-foreground">
                  +{point.differenceDrivers.length - visibleDrivers.length} more
                  categories
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No spend in either year on this day
            </p>
          )}
        </div>
      </div>
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
  currentDayNum = null,
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
                    data={data}
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
              {currentDayNum != null && (
                <ReferenceLine
                  x={currentDayNum}
                  stroke="oklch(0.65 0.02 260)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                />
              )}
              <Line
                type="monotone"
                dataKey="currentYear"
                stroke="oklch(0.55 0.15 250)"
                strokeWidth={2.5}
                dot={dotWhenHigher(data, "currentYear", { r: 2, fill: "oklch(0.55 0.15 250)" })}
                activeDot={interactive ? { r: 5, strokeWidth: 2 } : { r: 4, strokeWidth: 2 }}
                name="currentYear"
              />
              <Line
                type="monotone"
                dataKey="previousYear"
                stroke="oklch(0.60 0.18 20)"
                strokeWidth={2.5}
                dot={dotWhenHigher(data, "previousYear", { r: 2, fill: "oklch(0.60 0.18 20)" })}
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
