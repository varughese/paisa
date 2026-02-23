"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface CategoryFilterProps {
  /** All category names to show in the list */
  allCategories: string[];
  /** Category names to exclude from the dashboard (unchecked in UI) */
  excludedCategories: string[];
  onExcludedChange: (excluded: string[]) => void;
  /** Current-year spend per category for the selected range (for label totals) */
  categoryTotals?: Record<string, number>;
  className?: string;
}

export function CategoryFilter({
  allCategories,
  excludedCategories,
  onExcludedChange,
  categoryTotals,
  className,
}: CategoryFilterProps) {
  const excludedSet = React.useMemo(
    () => new Set(excludedCategories),
    [excludedCategories]
  );

  const toggle = (name: string) => {
    if (excludedSet.has(name)) {
      onExcludedChange(excludedCategories.filter((c) => c !== name));
    } else {
      onExcludedChange([...excludedCategories, name]);
    }
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-medium text-muted-foreground">
          Include
        </Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => onExcludedChange([])}
          >
            Select all
          </button>
          <span className="text-muted-foreground/60">·</span>
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => onExcludedChange([...allCategories])}
          >
            Deselect all
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {allCategories.map((name) => (
          <label
            key={name}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-sm py-1 pr-1 text-sm hover:bg-accent/50",
              excludedSet.has(name) && "opacity-60"
            )}
          >
            <Checkbox
              checked={!excludedSet.has(name)}
              onCheckedChange={() => toggle(name)}
              onPointerDown={(e) => e.preventDefault()}
            />
            <span>
              {name}
              {categoryTotals && name in categoryTotals && (
                <span className="text-muted-foreground">
                  {" "}
                  ({formatCurrency(categoryTotals[name])})
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
