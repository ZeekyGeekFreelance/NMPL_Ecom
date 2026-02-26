"use client";
import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useLazyGenerateReportQuery } from "@/app/store/apis/ReportsApi";
import Dropdown from "@/app/components/molecules/Dropdown";
import { withAuth } from "@/app/components/HOC/WithAuth";

interface DropdownOption {
  label: string;
  value: string;
}

const ReportsDashboard: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const todayIso = new Date().toISOString().split("T")[0];

  const [generateReport, { isLoading }] = useLazyGenerateReportQuery();
  const [reportType, setReportType] = useState<string | null>("sales");
  const [format, setFormat] = useState<string | null>("pdf");
  const [timePeriod, setTimePeriod] = useState<string | null>("allTime");
  const [year, setYear] = useState<string | null>(String(currentYear));
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // Dropdown options
  const reportTypeOptions: DropdownOption[] = [
    { label: "Sales", value: "sales" },
    { label: "User Retention", value: "user_retention" },
    { label: "All Reports", value: "all" },
  ];

  const formatOptions: DropdownOption[] = [
    { label: "CSV", value: "csv" },
    { label: "PDF", value: "pdf" },
    { label: "XLSX", value: "xlsx" },
  ];

  const timePeriodOptions: DropdownOption[] = [
    { label: "Last 7 Days", value: "last7days" },
    { label: "Last Month", value: "lastMonth" },
    { label: "Last Year", value: "lastYear" },
    { label: "All Time", value: "allTime" },
    { label: "Custom", value: "custom" },
  ];

  // Generate year options (last 10 years)
  const yearOptions: DropdownOption[] = [
    { label: "Select Year", value: "" },
    ...Array.from({ length: 10 }, (_, i) => ({
      label: `${currentYear - i}`,
      value: `${currentYear - i}`,
    })),
  ];

  // Handle form submission
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!reportType || !format || !timePeriod) {
      setErrorMessage("Please select report type, format, and time period.");
      return;
    }

    const query: Record<string, string> = {
      type: reportType,
      format,
      timePeriod,
    };

    const effectiveYear = year || String(currentYear);
    if (timePeriod !== "custom") {
      query.year = effectiveYear;
    }

    if (timePeriod === "custom") {
      if (!startDate || !endDate) {
        setErrorMessage(
          "Please provide both start and end dates for custom range."
        );
        return;
      }

      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);

      if (
        Number.isNaN(parsedStartDate.getTime()) ||
        Number.isNaN(parsedEndDate.getTime())
      ) {
        setErrorMessage("Invalid date format. Use YYYY-MM-DD.");
        return;
      }

      if (startDate > endDate) {
        setErrorMessage("Start date must be on or before end date.");
        return;
      }

      if (startDate > todayIso || endDate > todayIso) {
        setErrorMessage("Future dates are not allowed.");
        return;
      }

      query.startDate = startDate;
      query.endDate = endDate;
    }

    try {
      const response = await generateReport(query).unwrap();
      const blob = response; // Assuming API returns a Blob
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportType}-report-${new Date().toISOString()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSuccessMessage("Report generated successfully!");
    } catch (err: any) {
      setErrorMessage(
        err?.data?.message || "Failed to generate report. Please try again."
      );
    }
  };

  // Clear custom dates when timePeriod changes
  useEffect(() => {
    if (timePeriod !== "custom") {
      setStartDate("");
      setEndDate("");
    }
  }, [timePeriod]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">
          Reports Dashboard
        </h1>

        <form onSubmit={handleGenerateReport} className="space-y-6">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <Dropdown
              label="Select Report Type"
              options={reportTypeOptions}
              value={reportType}
              onChange={setReportType}
              className="w-full"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Format
            </label>
            <Dropdown
              label="Select Format"
              options={formatOptions}
              value={format}
              onChange={setFormat}
              className="w-full"
            />
          </div>

          {/* Time Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Period
            </label>
            <Dropdown
              label="Select Time Period"
              options={timePeriodOptions}
              value={timePeriod}
              onChange={setTimePeriod}
              className="w-full"
            />
          </div>

          {/* Year filter (not used only when custom range is active) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <Dropdown
              label="Select Year"
              options={yearOptions}
              value={year}
              onChange={setYear}
              className="w-full"
              disabled={timePeriod === "custom"}
            />
          </div>

          {/* Custom Date Range (visible only for custom) */}
          {timePeriod === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setStartDate(nextValue);
                    if (endDate && nextValue > endDate) {
                      setEndDate(nextValue);
                    }
                  }}
                  max={endDate || todayIso}
                  className="mt-1 block h-11 w-full rounded-md border border-gray-300 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required={timePeriod === "custom"}
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={todayIso}
                  className="mt-1 block h-11 w-full rounded-md border border-gray-300 px-3 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required={timePeriod === "custom"}
                />
              </div>
            </div>
          )}

          {/* Error/Success Messages */}
          {errorMessage && (
            <div className="text-red-600 text-sm">{errorMessage}</div>
          )}
          {successMessage && (
            <div className="text-green-600 text-sm">{successMessage}</div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default withAuth(ReportsDashboard);
