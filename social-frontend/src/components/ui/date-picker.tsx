"use client";

import { useEffect, useId, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const local = (value: string) => new Date(`${value}T12:00:00`);
const key = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const pretty = (value: string) => local(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function dateCount(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
}

type DatePickerBase = { today: string; disabled?: boolean; label?: string; helper?: string; id?: string; className?: string };
export type DatePickerProps = DatePickerBase & ({
  mode: "single";
  value: string;
  onValueChange: (value: string) => void;
} | {
  mode: "range" | "multiple" | "dates";
  start: string;
  end: string;
  dates: string[];
  cap: number;
  onChange: (start: string, end: string, dates: string[]) => void;
});

export function DatePicker(props: DatePickerProps) {
  const { today, disabled = false, label, helper, className } = props;
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const [open, setOpen] = useState(false);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const single = props.mode === "single";
  const start = single ? props.value : props.start;
  const end = single ? props.value : props.end;
  const dates = single ? [] : props.dates;
  const cap = single ? 1 : props.cap;
  const range = props.mode === "range";
  const count = single ? Number(!!start) : range ? dateCount(start, end) : dates.length;
  const summary = single ? start ? pretty(start) : "Choose a date" : range ? start ? `${pretty(start)}${end && end !== start ? ` – ${pretty(end)}` : !end ? " · Choose an end date" : ""}` : "Choose your date range" : dates.length ? `${dates.length} ${dates.length === 1 ? "date" : "dates"} selected` : "Choose individual dates";
  const clear = () => { if (!disabled) { if (props.mode === "single") props.onValueChange(""); else props.onChange("", "", []); } };
  const calendarProps = { today: local(today), defaultMonth: local(start || dates[0] || today), className: "[--cell-size:2.5rem]" };

  return <div className={cn("min-w-0 space-y-3", className)}>
    {label && <label id={`${id}-label`} htmlFor={id} className="block text-sm font-medium">{label}</label>}
    <Popover open={open && !disabled} onOpenChange={next => setOpen(next && !disabled)}>
      <PopoverTrigger asChild><Button id={id} disabled={disabled} variant="outline" aria-labelledby={label ? `${id}-label ${id}-summary` : undefined} aria-describedby={`${id}-count${helper ? ` ${id}-helper` : ""}`} className="h-auto min-h-11 w-full justify-start gap-3 bg-background px-3 py-3 text-left font-normal hover:border-primary/50">
        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" /><span id={`${id}-summary`} className="min-w-0 flex-1 whitespace-normal">{summary}</span>
      </Button></PopoverTrigger>
      <PopoverContent align="start" aria-label={label ? `${label} calendar` : "Choose dates"} className="w-auto max-w-full overflow-hidden p-0">
        {props.mode === "single" ? <Calendar {...calendarProps} mode="single" selected={start ? local(start) : undefined} disabled={disabled ? true : { before: local(today) }} onSelect={date => {
          if (!disabled && (!date || key(date) >= today)) { props.onValueChange(date ? key(date) : ""); setOpen(false); }
        }} /> : props.mode === "range" ? <Calendar {...calendarProps} mode="range" selected={start ? { from: local(start), to: end ? local(end) : undefined } : undefined} disabled={disabled ? true : { before: local(today) }} max={cap - 1} onSelect={selection => {
          if (disabled) return;
          if (selection?.from && key(selection.from) >= today && (!selection.to || dateCount(key(selection.from), key(selection.to)) <= cap)) props.onChange(key(selection.from), selection.to ? key(selection.to) : "", []);
          else if (!selection) props.onChange("", "", []);
        }} /> : <Calendar {...calendarProps} mode="multiple" selected={dates.map(local)} disabled={date => disabled || key(date) < today || dates.length >= cap && !dates.includes(key(date))} max={cap} onSelect={values => {
          const selected = [...new Set((values ?? []).map(key))].sort();
          if (!disabled && selected.length <= cap && selected.every(date => date >= today)) props.onChange("", "", selected);
        }} />}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-3 py-2"><p className="max-w-48 text-xs text-muted-foreground">{range && start && !end ? "Choose an end date to complete the range." : single ? "Choose today or a future date." : `Choose up to ${cap} dates, starting today.`}</p><Button variant="ghost" size="sm" className="min-h-11" disabled={disabled} onClick={() => setOpen(false)}>Done</Button></div>
      </PopoverContent>
    </Popover>
    <div className="flex items-center justify-between gap-3"><p id={`${id}-count`} aria-live="polite" className="text-xs text-muted-foreground">{single ? start ? "1 date selected" : "No date selected" : `${count} / ${cap} dates selected`}</p><Button variant="ghost" className="min-h-11 text-muted-foreground" disabled={disabled || !count && !start} onClick={clear}>{single ? "Clear date" : "Clear dates"}</Button></div>
    {helper && <p id={`${id}-helper`} className="text-xs leading-relaxed text-muted-foreground">{helper}</p>}
    {!single && !range && dates.length > 0 && <div className="flex flex-wrap gap-2">{dates.map(date => <Button key={date} variant="secondary" disabled={disabled} className="min-h-11 gap-2 rounded-full text-xs" aria-label={`Remove ${date}`} onClick={() => { if (!disabled) props.onChange("", "", dates.filter(value => value !== date)); }}>{pretty(date)}<X aria-hidden="true" className="size-3.5" /></Button>)}</div>}
  </div>;
}