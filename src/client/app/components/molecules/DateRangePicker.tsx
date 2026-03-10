"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMonths,
  format,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  isValid,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useController } from "react-hook-form";
import Dropdown from "@/app/components/molecules/Dropdown";

interface DateRangePickerProps {
  label?: string;
  control: any;
  startName: string;
  endName: string;
  className?: string;
  inlinePanel?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const toDateValue = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : null;
  }

  return null;
};

const serializeDateValue = (value: Date | null): string | null =>
  value ? format(value, "yyyy-MM-dd") : null;

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  label = "Custom Date Range",
  control,
  startName,
  endName,
  className = "",
  inlinePanel = false,
  onOpenChange,
}) => {
  const { field: startField } = useController({ name: startName, control });
  const { field: endField } = useController({ name: endName, control });

  const startDate = toDateValue(startField.value);
  const endDate = toDateValue(endField.value);
  const maxSelectableDate = useMemo(() => startOfDay(new Date()), []);

  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState(1);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const candidateMonth = startDate || endDate || maxSelectableDate;
    return isAfter(candidateMonth, maxSelectableDate)
      ? maxSelectableDate
      : candidateMonth;
  });
  const pickerRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const currentYear = maxSelectableDate.getFullYear();
    return Array.from({ length: 8 }, (_, index) => currentYear - 7 + index);
  }, [maxSelectableDate]);

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        value: String(monthIndex),
        label: format(new Date(2000, monthIndex, 1), "MMMM"),
      })),
    []
  );

  const yearOptions = useMemo(
    () =>
      years.map((yearOption) => ({
        value: String(yearOption),
        label: String(yearOption),
      })),
    [years]
  );

  const isFutureMonth = (date: Date) =>
    isAfter(startOfMonth(date), startOfMonth(maxSelectableDate));

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getDay(startOfMonth(currentMonth));
    const days: Array<Date | null> = Array.from({ length: firstDay }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    }

    while (days.length % 7 !== 0) {
      days.push(null);
    }

    return days;
  }, [currentMonth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    return () => {
      onOpenChange?.(false);
    };
  }, [onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      setSelecting(startDate && !endDate ? "end" : "start");
    }
  }, [isOpen, startDate, endDate]);

  const handleMonthShift = (next: boolean) => {
    setDirection(next ? 1 : -1);
    setCurrentMonth((previousMonth) => {
      const shiftedMonth = next
        ? addMonths(previousMonth, 1)
        : subMonths(previousMonth, 1);

      return isFutureMonth(shiftedMonth) ? previousMonth : shiftedMonth;
    });
  };

  const handleMonthSelect = (monthIndex: number) => {
    const nextMonth = new Date(currentMonth.getFullYear(), monthIndex, 1);
    setCurrentMonth(isFutureMonth(nextMonth) ? maxSelectableDate : nextMonth);
  };

  const handleYearSelect = (year: number) => {
    const nextMonth = new Date(year, currentMonth.getMonth(), 1);
    setCurrentMonth(isFutureMonth(nextMonth) ? maxSelectableDate : nextMonth);
  };

  const applyRange = (nextStart: Date | null, nextEnd: Date | null) => {
    startField.onChange(serializeDateValue(nextStart));
    endField.onChange(serializeDateValue(nextEnd));
  };

  const handleDateSelect = (date: Date | null) => {
    if (!date) {
      return;
    }
    if (isAfter(startOfDay(date), maxSelectableDate)) {
      return;
    }

    if (selecting === "start") {
      applyRange(date, endDate && isBefore(endDate, date) ? null : endDate);
      setSelecting("end");
      return;
    }

    if (startDate && isBefore(date, startDate)) {
      applyRange(date, startDate);
    } else {
      applyRange(startDate || date, date);
    }

    setSelecting("start");
    setIsOpen(false);
  };

  const handlePresetToday = () => {
    const today = maxSelectableDate;
    applyRange(today, today);
    setCurrentMonth(today);
    setSelecting("start");
    setIsOpen(false);
  };

  const handlePresetLast7Days = () => {
    const today = maxSelectableDate;
    applyRange(subDays(today, 6), today);
    setCurrentMonth(today);
    setSelecting("start");
    setIsOpen(false);
  };

  const handleClear = () => {
    applyRange(null, null);
    setSelecting("start");
    setIsOpen(false);
  };

  const displayValue = (() => {
    if (!startDate && !endDate) {
      return "Select Dates";
    }

    if (startDate && !endDate) {
      return `${format(startDate, "MMM dd, yyyy")} - End date`;
    }

    if (!startDate && endDate) {
      return `Start date - ${format(endDate, "MMM dd, yyyy")}`;
    }

    return `${format(startDate as Date, "MMM dd, yyyy")} - ${format(
      endDate as Date,
      "MMM dd, yyyy"
    )}`;
  })();

  return (
    <div className={`relative min-w-0 w-full ${className}`} ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((previous) => !previous)}
        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-left hover:border-gray-300 transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {label}
            </p>
            <p className="truncate text-sm font-medium text-gray-800">{displayValue}</p>
          </div>
          <Calendar size={18} className="shrink-0 text-gray-400" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className={
              inlinePanel
                ? "relative z-10 mt-3 w-[min(94vw,420px)] max-w-full rounded-xl border border-gray-200 bg-white shadow-xl"
                : "absolute left-1/2 z-20 mt-2 w-[min(94vw,420px)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white shadow-xl md:left-0 md:translate-x-0"
            }
          >
            <div className="p-5">
              <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-blue-700">
                  {selecting === "start"
                    ? "Select start date"
                    : "Select end date"}
                </p>
                <p className="text-[11px] text-blue-600">
                  Choose both dates to apply the custom range. Future dates are disabled.
                </p>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <p className="font-semibold text-gray-600">Start</p>
                  <p className="text-gray-800">
                    {startDate ? format(startDate, "MMM dd, yyyy") : "-"}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <p className="font-semibold text-gray-600">End</p>
                  <p className="text-gray-800">
                    {endDate ? format(endDate, "MMM dd, yyyy") : "-"}
                  </p>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleMonthShift(false)}
                  className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-2">
                  <Dropdown
                    label="Month"
                    options={monthOptions}
                    value={String(currentMonth.getMonth())}
                    onChange={(value) => {
                      if (value !== null) {
                        handleMonthSelect(Number(value));
                      }
                    }}
                    clearable={false}
                    className="h-8 w-[132px] rounded-md border-gray-200 bg-white px-2 text-xs text-gray-700"
                  />
                  <Dropdown
                    label="Year"
                    options={yearOptions}
                    value={String(currentMonth.getFullYear())}
                    onChange={(value) => {
                      if (value !== null) {
                        handleYearSelect(Number(value));
                      }
                    }}
                    clearable={false}
                    className="h-8 w-[96px] rounded-md border-gray-200 bg-white px-2 text-xs text-gray-700"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleMonthShift(true)}
                  className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isFutureMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={format(currentMonth, "yyyy-MM")}
                  initial={{ x: direction * 12, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -direction * 12, opacity: 0 }}
                  transition={{ duration: 0.14 }}
                >
                  <div className="mb-1 grid grid-cols-7 gap-1 text-center">
                    {DAYS_OF_WEEK.map((dayLabel) => (
                      <div key={dayLabel} className="text-[11px] font-semibold text-gray-500">
                        {dayLabel}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((dateValue, index) => {
                      const isFutureDate =
                        dateValue &&
                        isAfter(startOfDay(dateValue), maxSelectableDate);
                      const inRange =
                        dateValue &&
                        startDate &&
                        endDate &&
                        isWithinInterval(dateValue, { start: startDate, end: endDate });
                      const isStart = dateValue && startDate && isSameDay(dateValue, startDate);
                      const isEnd = dateValue && endDate && isSameDay(dateValue, endDate);
                      const isClickable = Boolean(dateValue) && !isFutureDate;

                      return (
                        <button
                          key={`${format(currentMonth, "yyyy-MM")}-${index}`}
                          type="button"
                          onClick={() => isClickable && handleDateSelect(dateValue)}
                          disabled={!isClickable}
                          className={`h-9 rounded-md text-xs font-medium transition-colors ${
                            !dateValue
                              ? "cursor-default text-transparent"
                              : isFutureDate
                              ? "cursor-not-allowed text-gray-300"
                              : isStart || isEnd
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : inRange
                              ? "bg-blue-100 text-blue-700"
                              : isToday(dateValue as Date)
                              ? "border border-blue-300 text-blue-600 hover:bg-blue-50"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          {dateValue ? dateValue.getDate() : "."}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={handlePresetToday}
                  className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handlePresetLast7Days}
                  className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                >
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DateRangePicker;
