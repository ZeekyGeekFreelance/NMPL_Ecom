"use client";

import React from "react";
import Chart from "react-apexcharts";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";

interface RevenueOverTimeChartProps {
  labels: string[];
  revenue: number[];
  totalRevenue: number;
}

const RevenueOverTimeChart: React.FC<RevenueOverTimeChartProps> = ({
  labels,
  revenue,
  totalRevenue,
}) => {
  const formatPrice = useFormatPrice();

  if (!labels.length || !revenue.length) {
    return (
      <div className="rounded-lg bg-white p-4 shadow-md">
        <h2 className="mb-2 text-lg font-semibold text-gray-800">Revenue Over Time</h2>
        <p className="text-sm text-gray-500">No revenue data available for the selected range.</p>
      </div>
    );
  }

  const series = [
    {
      name: "Revenue",
      data: revenue,
      color: "#1d3461",
    },
  ];

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "line",
      height: 350,
      toolbar: { show: false },
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    xaxis: {
      categories: labels.map((label) => {
        const date = new Date(label);
        if (Number.isNaN(date.getTime())) {
          return label;
        }

        return `${date.toLocaleString("default", {
          month: "short",
        })} ${date.getFullYear()}`;
      }),
      labels: {
        style: {
          fontSize: "12px",
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (value: number) => formatPrice(value),
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) => formatPrice(value),
      },
    },
    markers: {
      size: 4,
    },
    legend: {
      show: false,
    },
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Revenue Over Time</h2>
        <span className="text-sm font-medium text-gray-700">
          Total: {formatPrice(totalRevenue)}
        </span>
      </div>
      <Chart options={options} series={series} type="line" height={350} />
    </div>
  );
};

export default RevenueOverTimeChart;
