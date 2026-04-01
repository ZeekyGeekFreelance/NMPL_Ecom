"use client";

import { useState, useRef } from "react";
import {
  format,
  addMonths,
  subMonths,
  getDaysInMonth,
  startOfMonth,
  getDay,
  isAfter,
  isSameDay,
  isToday,
  startOfDay,
} from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Controller, useController } from "react-hook-form";
import Dropdown from "./Dropdown";

const DatePicker = ({
  label,
  control,
  name,
}: {
  label?: string;
  control: any;
  name: string;
}) => {
  const { field } = useController({ name, control });
  const maxSelectableDate = startOfDay(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(
    field.value && !isAfter(startOfDay(field.value), maxSelectableDate)
      ? field.value
      : maxSelectableDate
  );
  const [isOpen, setIsOpen] = useState(false);
  const [direction, setDirection] = useState(1);
  const pickerRef = useRef<HTMLDivElement>(null);

  const daysOfWeek = [
    { label: "Sunday", value: "Su" },
    { label: "Monday", value: "Mo" },
    { label: "Tuesday", value: "Tu" },
    { label: "Wednesday", value: "We" },
    { label: "Thursday", value: "Th" },
    { label: "Friday", value: "Fr" },
    { label: "Saturday", value: "Sa" },
  ];

  const years = Array.from(
    { length: new Date().getFullYear() - 1899 },
    (_, i) => ({ label: (1900 + i).toString(), value: (1900 + i).toString() })
  );

  const months = Array.from({ length: 12 }, (_, i) => ({
    label: format(new Date(2000, i, 1), "MMMM"),
    value: format(new Date(2000, i, 1), "MMMM"),
  }));

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getDay(startOfMonth(currentMonth));
    const days: (Date | null)[] = Array.from({ length: firstDay }, () => null);
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      );
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  };

  const handleDateSelect = (date: Date | null) => {
    if (date && !isAfter(startOfDay(date), maxSelectableDate)) {
      field.onChange(date);
      setIsOpen(false);
    }
  };

  const handleMonthChange = (next: boolean) => {
    setDirection(next ? 1 : -1);
    setCurrentMonth((previousMonth) => {
      const nextMonth = next
        ? addMonths(previousMonth, 1)
        : subMonths(previousMonth, 1);

      if (isAfter(startOfMonth(nextMonth), startOfMonth(maxSelectableDate))) {
        return previousMonth;
      }

      return nextMonth;
    });
  };

  const handleYearChange = (selectedYear: string | null) => {
    if (selectedYear !== null) {
      const nextMonth = new Date(
        parseInt(selectedYear, 10),
        currentMonth.getMonth(),
        1
      );

      setCurrentMonth(
        isAfter(startOfMonth(nextMonth), startOfMonth(maxSelectableDate))
          ? maxSelectableDate
          : nextMonth
      );
    }
  };

  const handleMonthSelect = (selectedMonth: string | null) => {
    if (selectedMonth === null) {
      return;
    }

    const monthIndex = months.findIndex(
      (month) => month.value === selectedMonth
    );
    if (monthIndex >= 0) {
      const nextMonth = new Date(currentMonth.getFullYear(), monthIndex, 1);
      setCurrentMonth(
        isAfter(startOfMonth(nextMonth), startOfMonth(maxSelectableDate))
          ? maxSelectableDate
          : nextMonth
      );
    }
  };

  const calendarDays = generateCalendarDays();

  // useEffect(() => {
  //   function handleClickOutside(event: MouseEvent) {
  //     if (
  //       pickerRef.current &&
  //       !pickerRef.current.contains(event.target as Node)
  //     ) {
  //       setIsOpen(false);
  //     }
  //   }
  //   document.addEventListener("mousedown", handleClickOutside);
  //   return () => document.removeEventListener("mousedown", handleClickOutside);
  // }, []);

  return (
    <div className="relative w-full" ref={pickerRef}>
      <div
        className="flex h-11 justify-between items-center px-3.5 rounded-lg border border-gray-200 
                  bg-white shadow-sm cursor-pointer hover:border-gray-300 transition-all duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-sm font-medium text-gray-700">
          {field.value
            ? format(field.value, "MMM dd, yyyy")
            : label || "Select date"}
        </span>
        <Calendar size={18} className="text-gray-400" />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute mt-2 bg-white border border-gray-100 rounded-lg shadow-lg z-10 w-full overflow-hidden"
          >
            <div className="p-3">
              <div className="flex justify-between items-center mb-4">
                <button
                  type="button"
                  onClick={() => handleMonthChange(false)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex space-x-2 w-full px-2">
                  <Controller
                    name="months"
                    control={control}
                    render={({ field }) => (
                      <Dropdown
                        options={months}
                        value={months[currentMonth.getMonth()]?.value}
                        onChange={(value) => {
                          field.onChange(value);
                          handleMonthSelect(value);
                        }}
                        className="text-xs font-medium"
                      />
                    )}
                  />

                  <Controller
                    name="years"
                    control={control}
                    render={() => (
                      <Dropdown
                        options={years}
                        value={currentMonth.getFullYear().toString()}
                        onChange={handleYearChange}
                        className="text-xs font-medium"
                      />
                    )}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleMonthChange(true)}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isAfter(
                    startOfMonth(addMonths(currentMonth, 1)),
                    startOfMonth(maxSelectableDate)
                  )}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={format(currentMonth, "yyyy-MM")}
                  initial={{ x: direction * 10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -direction * 10, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {daysOfWeek.map((day) => (
                      <div
                        key={day.value}
                        className="text-xs font-medium text-gray-400 py-1"
                      >
                        {day.label}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {calendarDays.map((date, index) => (
                      <div
                        key={index}
                        className={`
                          aspect-square flex items-center justify-center rounded-full text-sm
                          ${date && !isAfter(startOfDay(date), maxSelectableDate) ? "cursor-pointer" : ""}
                          ${
                            date && isAfter(startOfDay(date), maxSelectableDate)
                              ? "text-gray-300 cursor-not-allowed"
                              : ""
                          }
                          ${
                            date &&
                            isToday(date) &&
                            !isSameDay(date, field.value)
                              ? "border border-blue-400 text-blue-600"
                              : ""
                          }
                          ${
                            date && isSameDay(date, field.value)
                              ? "bg-blue-500 text-white hover:bg-blue-600"
                              : date &&
                                !isAfter(startOfDay(date), maxSelectableDate)
                              ? "hover:bg-gray-100 text-gray-800"
                              : ""
                          }
                          transition-colors duration-200
                        `}
                        onClick={() => date && handleDateSelect(date)}
                      >
                        {date ? (
                          <span className="text-xs font-medium">
                            {date.getDate()}
                          </span>
                        ) : (
                          ""
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-3 pt-2 border-t border-gray-100 flex justify-between">
                <button
                  className="text-xs font-medium text-blue-500 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                  onClick={() => handleDateSelect(new Date())}
                >
                  Today
                </button>
                <button
                  className="text-xs font-medium text-gray-500 hover:text-gray-600 px-2 py-1 rounded transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DatePicker;
