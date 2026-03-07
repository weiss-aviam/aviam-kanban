"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DayFlag,
  DayPicker,
  getDefaultClassNames,
  SelectionState,
  UI,
} from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        ...defaultClassNames,
        [UI.Root]: cn("w-fit", defaultClassNames[UI.Root]),
        [UI.Months]: cn(
          "relative flex flex-col gap-4",
          defaultClassNames[UI.Months],
        ),
        [UI.Month]: cn(
          "flex w-full flex-col gap-4",
          defaultClassNames[UI.Month],
        ),
        [UI.MonthCaption]: cn(
          "flex h-9 items-center justify-center px-10",
          defaultClassNames[UI.MonthCaption],
        ),
        [UI.CaptionLabel]: cn(
          "text-sm font-medium",
          defaultClassNames[UI.CaptionLabel],
        ),
        [UI.Nav]: cn("flex items-center gap-1", defaultClassNames[UI.Nav]),
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-0 h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100",
          defaultClassNames[UI.PreviousMonthButton],
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-0 h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100",
          defaultClassNames[UI.NextMonthButton],
        ),
        [UI.MonthGrid]: cn(
          "w-full border-collapse",
          defaultClassNames[UI.MonthGrid],
        ),
        [UI.Weekdays]: cn("flex", defaultClassNames[UI.Weekdays]),
        [UI.Weekday]: cn(
          "w-9 text-[0.8rem] font-normal text-muted-foreground",
          defaultClassNames[UI.Weekday],
        ),
        [UI.Week]: cn("mt-2 flex w-full", defaultClassNames[UI.Week]),
        [UI.Day]: cn(
          "h-9 w-9 p-0 text-center text-sm",
          defaultClassNames[UI.Day],
        ),
        [UI.DayButton]: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
          defaultClassNames[UI.DayButton],
        ),
        [SelectionState.selected]: cn(
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          defaultClassNames[SelectionState.selected],
        ),
        [DayFlag.today]: cn(
          "bg-accent text-accent-foreground",
          defaultClassNames[DayFlag.today],
        ),
        [DayFlag.outside]: cn(
          "text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
          defaultClassNames[DayFlag.outside],
        ),
        [DayFlag.disabled]: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames[DayFlag.disabled],
        ),
        [DayFlag.hidden]: cn("invisible", defaultClassNames[DayFlag.hidden]),
        ...classNames,
      }}
      components={{
        Chevron: ({
          className: chevronClassName,
          orientation = "left",
          ...chevronProps
        }) => {
          const Icon = orientation === "right" ? ChevronRight : ChevronLeft;
          return (
            <Icon
              className={cn("h-4 w-4", chevronClassName)}
              {...chevronProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
