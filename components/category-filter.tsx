"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Filter, ChevronDown } from "lucide-react";

interface CategoryFilterProps {
  /** All category names to show in the list */
  allCategories: string[];
  /** Category names to exclude from the dashboard (unchecked in UI) */
  excludedCategories: string[];
  onExcludedChange: (excluded: string[]) => void;
  className?: string;
}

export function CategoryFilter({
  allCategories,
  excludedCategories,
  onExcludedChange,
  className,
}: CategoryFilterProps) {
  const [open, setOpen] = React.useState(false);
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

  const includedCount = allCategories.length - excludedCategories.length;
  const label =
    excludedCategories.length === 0
      ? "All categories"
      : `${includedCount} of ${allCategories.length} categories`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "w-full justify-between font-normal sm:w-[220px]",
            excludedCategories.length > 0 && "border-primary/50 text-foreground",
            className
          )}
        >
            <span className="flex items-center gap-2 truncate">
            <Filter className="h-3.5 w-3 shrink-0 text-muted-foreground" aria-hidden />
            Include: {label}
          </span>
          <ChevronDown className="h-3.5 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">
            Uncheck categories to exclude them from totals and charts
          </p>
        </div>
        <div className="h-[280px] overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="flex flex-col gap-0 p-1">
              {allCategories.map((name) => (
                <label
                  key={name}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50",
                    excludedSet.has(name) && "opacity-60"
                  )}
                >
                  <Checkbox
                    checked={!excludedSet.has(name)}
                    onCheckedChange={() => toggle(name)}
                    onPointerDown={(e) => e.preventDefault()}
                  />
                  <span className="truncate">{name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
        {excludedCategories.length > 0 && (
          <div className="border-t border-border/60 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => {
                onExcludedChange([]);
                setOpen(false);
              }}
            >
              Show all categories
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
