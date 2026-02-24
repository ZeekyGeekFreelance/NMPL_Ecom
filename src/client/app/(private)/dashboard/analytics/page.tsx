"use client";

import dynamic from "next/dynamic";
import React, { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  BarChart2,
  CreditCard,
  DollarSign,
  Download,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useQuery } from "@apollo/client";
import StatsCard from "@/app/components/organisms/StatsCard";
import Dropdown from "@/app/components/molecules/Dropdown";
import DateRangePicker from "@/app/components/molecules/DateRangePicker";
import ListCard from "@/app/components/organisms/ListCard";
import CustomLoader from "@/app/components/feedback/CustomLoader";
import useFormatPrice from "@/app/hooks/ui/useFormatPrice";
import { useLazyExportAnalyticsQuery } from "@/app/store/apis/AnalyticsApi";
import { GET_ALL_ANALYTICS } from "@/app/gql/Dashboard";
import { withAuth } from "@/app/components/HOC/WithAuth";

const AreaChart = dynamic(
  () => import("@/app/components/charts/AreaChartComponent"),
  { ssr: false }
);
const BarChart = dynamic(
  () => import("@/app/components/charts/BarChartComponent"),
  { ssr: false }
);
const DonutChart = dynamic(
  () => import("@/app/components/charts/DonutChartComponent"),
  { ssr: false }
);
const RevenueOverTimeChart = dynamic(
  () => import("@/app/components/charts/RevenueOverTimeChart"),
  { ssr: false }
);

interface FormData {
  timePeriod: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  useCustomRange: boolean;
}

const timePeriodOptions = [
  { label: "Last 7 Days", value: "last7days" },
  { label: "Last Month", value: "lastMonth" },
  { label: "Last Year", value: "lastYear" },
  { label: "All Time", value: "allTime" },
];

const exportTypeOptions = [
  { label: "All Data", value: "all" },
  { label: "Overview", value: "overview" },
  { label: "Products", value: "products" },
  { label: "Users", value: "users" },
];

const exportFormatOptions = [
  { label: "CSV", value: "csv" },
  { label: "PDF", value: "pdf" },
  { label: "XLSX", value: "xlsx" },
];

const AnalyticsDashboard = () => {
  const { control, watch } = useForm<FormData>({
    defaultValues: {
      timePeriod: "allTime",
      useCustomRange: false,
      year: new Date().getFullYear().toString(),
    },
  });

  const formatPrice = useFormatPrice();
  const [exportType, setExportType] = useState<string>("all");
  const [exportFormat, setExportFormat] = useState<string>("csv");
  const [exportMessage, setExportMessage] = useState<string>("");

  const [triggerExport, { isLoading: isExporting, error: exportError }] =
    useLazyExportAnalyticsQuery();

  const { timePeriod, year, startDate, endDate, useCustomRange } = watch();

  const queryParams = useMemo(
    () => ({
      timePeriod: timePeriod || "allTime",
      year: useCustomRange ? undefined : year ? parseInt(year, 10) : undefined,
      startDate: useCustomRange && startDate ? startDate : undefined,
      endDate: useCustomRange && endDate ? endDate : undefined,
    }),
    [timePeriod, useCustomRange, year, startDate, endDate]
  );

  const { data, loading, error } = useQuery(GET_ALL_ANALYTICS, {
    variables: { params: queryParams },
  });

  const minYear = data?.yearRange?.minYear || 2020;
  const maxYear = data?.yearRange?.maxYear || 2020;
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => ({
    label: String(minYear + i),
    value: String(minYear + i),
  }));

  const handleExport = async () => {
    setExportMessage("");

    try {
      const file = await triggerExport({
        type: exportType,
        format: exportFormat,
        timePeriod: queryParams.timePeriod,
        year: queryParams.year,
        startDate: queryParams.startDate,
        endDate: queryParams.endDate,
      }).unwrap();

      const blob = file instanceof Blob ? file : new Blob([file as BlobPart]);
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      link.href = downloadUrl;
      link.download = `analytics-${exportType}-${timestamp}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setExportMessage("Export generated successfully.");
    } catch {
      setExportMessage("Failed to export analytics data.");
    }
  };

  if (loading) {
    return <CustomLoader />;
  }

  if (error) {
    return <div className="p-6 text-red-600">Error loading analytics data.</div>;
  }

  const mostSoldProducts = {
    labels: data?.productPerformance?.slice(0, 10).map((item: any) => item.name) || [],
    data: data?.productPerformance?.slice(0, 10).map((item: any) => item.quantity) || [],
  };

  const salesByProduct = {
    categories: data?.productPerformance?.map((item: any) => item.name) || [],
    data: data?.productPerformance?.map((item: any) => item.revenue) || [],
  };

  const interactionByType = {
    labels: ["Views", "Clicks", "Others"],
    data: [
      data?.interactionAnalytics?.byType?.views || 0,
      data?.interactionAnalytics?.byType?.clicks || 0,
      data?.interactionAnalytics?.byType?.others || 0,
    ],
  };

  const topItems =
    data?.productPerformance?.slice(0, 10).map((item: any) => ({
      id: item.productId || item.id,
      slug: item.productSlug || undefined,
      name: item.name,
      subtitle: item.productSlug ? `/${item.productSlug}` : "Product",
      primaryInfo: formatPrice(item.revenue),
      secondaryInfo: `${item.quantity} sold`,
      quantity: item.quantity,
      revenue: formatPrice(item.revenue),
      href: item.productSlug
        ? `/product/${item.productSlug}`
        : `/dashboard/products/${item.productId || item.id}`,
    })) || [];

  const topUsers =
    data?.userAnalytics?.topUsers?.slice(0, 10).map((item: any) => ({
      id: item.id,
      name: item.name,
      subtitle: item.email,
      primaryInfo: formatPrice(item.totalSpent),
      secondaryInfo: `${item.orderCount} orders`,
      email: item.email,
      orderCount: item.orderCount,
      totalSpent: formatPrice(item.totalSpent),
      engagementScore: item.engagementScore,
      href: "/dashboard/users",
    })) || [];

  const mostViewedProducts =
    data?.interactionAnalytics?.mostViewedProducts
      ?.slice(0, 10)
      .map((item: any) => ({
        id: item.productId,
        slug: item.productSlug || undefined,
        name: item.productName,
        subtitle: item.productSlug ? `/${item.productSlug}` : "Most viewed",
        primaryInfo: item.viewCount,
        secondaryInfo: `${item.viewCount} views`,
        viewCount: item.viewCount,
        href: item.productSlug ? `/product/${item.productSlug}` : "/shop",
      })) || [];

  return (
    <motion.div
      className="min-h-screen space-y-6 p-4 sm:p-6"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900 whitespace-nowrap">
          Analytics Dashboard
        </h1>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Controller
            name="timePeriod"
            control={control}
            render={({ field }) => (
              <Dropdown
                onChange={field.onChange}
                options={timePeriodOptions}
                value={field.value}
                label="Time Period"
                className="w-full"
              />
            )}
          />

          <Controller
            name="year"
            control={control}
            render={({ field }) => (
              <Dropdown
                onChange={field.onChange}
                options={yearOptions}
                value={field.value ?? "all"}
                label="Year"
                className="w-full"
                disabled={useCustomRange}
              />
            )}
          />

          <DateRangePicker
            label="Custom Date Range"
            control={control}
            startName="startDate"
            endName="endDate"
          />

          <Dropdown
            options={exportTypeOptions}
            value={exportType}
            onChange={(value) => value && setExportType(value)}
            label="Export Type"
            className="w-full"
          />

          <Dropdown
            options={exportFormatOptions}
            value={exportFormat}
            onChange={(value) => value && setExportFormat(value)}
            label="Export Format"
            className="w-full"
          />

          <button
            type="button"
            className="h-[42px] rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-blue-300"
            onClick={handleExport}
            disabled={isExporting}
          >
            <span className="inline-flex items-center gap-2">
              <Download className="h-4 w-4" />
              {isExporting ? "Exporting..." : "Export"}
            </span>
          </button>
        </div>

        {(exportMessage || exportError) && (
          <p className={`text-sm ${exportError ? "text-red-600" : "text-green-600"}`}>
            {exportError ? "Export request failed." : exportMessage}
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Revenue"
          value={formatPrice(data?.revenueAnalytics?.totalRevenue || 0)}
          percentage={data?.revenueAnalytics?.changes?.revenue}
          caption="since last period"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Orders"
          value={data?.orderAnalytics?.totalOrders || 0}
          percentage={data?.orderAnalytics?.changes?.orders}
          caption="since last period"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Sales"
          value={data?.orderAnalytics?.totalSales || 0}
          percentage={data?.orderAnalytics?.changes?.sales}
          caption="since last period"
          icon={<BarChart2 className="h-5 w-5" />}
        />
        <StatsCard
          title="Average Order Value"
          value={formatPrice(data?.orderAnalytics?.averageOrderValue || 0)}
          percentage={data?.orderAnalytics?.changes?.averageOrderValue}
          caption="since last period"
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Users"
          value={data?.userAnalytics?.totalUsers || 0}
          percentage={data?.userAnalytics?.changes?.users}
          caption="since last period"
          icon={<Users className="h-5 w-5" />}
        />
        <StatsCard
          title="Lifetime Value"
          value={formatPrice(data?.userAnalytics?.lifetimeValue || 0)}
          percentage={data?.userAnalytics?.repeatPurchaseRate}
          caption="repeat purchase rate"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <StatsCard
          title="Engagement Score"
          value={data?.userAnalytics?.engagementScore?.toFixed(2) || 0}
          percentage={data?.userAnalytics?.repeatPurchaseRate}
          caption="repeat purchase rate"
          icon={<BarChart2 className="h-5 w-5" />}
        />
        <StatsCard
          title="Total Interactions"
          value={data?.interactionAnalytics?.totalInteractions || 0}
          percentage={null}
          caption="all interactions"
          icon={<BarChart2 className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AreaChart
          title="Order Trends"
          data={data?.revenueAnalytics?.monthlyTrends?.orders || []}
          categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
          color="#ec4899"
          percentageChange={data?.orderAnalytics?.changes?.orders}
        />
        <AreaChart
          title="Revenue Trends"
          data={data?.revenueAnalytics?.monthlyTrends?.revenue || []}
          categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
          color="#22c55e"
          percentageChange={data?.revenueAnalytics?.changes?.revenue}
        />
        <AreaChart
          title="Sales Trends"
          data={data?.revenueAnalytics?.monthlyTrends?.sales || []}
          categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
          color="#3b82f6"
          percentageChange={data?.orderAnalytics?.changes?.sales}
        />
        <AreaChart
          title="User Trends"
          data={data?.revenueAnalytics?.monthlyTrends?.users || []}
          categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
          color="#f59e0b"
          percentageChange={data?.userAnalytics?.changes?.users}
        />
        <AreaChart
          title="Interaction Trends (Views)"
          data={data?.userAnalytics?.interactionTrends?.views || []}
          categories={data?.userAnalytics?.interactionTrends?.labels || []}
          color="#8b5cf6"
          percentageChange={data?.interactionAnalytics?.changes?.views}
        />
        <DonutChart
          title="Top 10 Products by Quantity"
          data={mostSoldProducts.data}
          labels={mostSoldProducts.labels}
        />
        <DonutChart
          title="Interactions by Type"
          data={interactionByType.data}
          labels={interactionByType.labels}
        />
        <RevenueOverTimeChart startDate="2023-01-01" endDate="2023-12-31" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ListCard
          title="Top Products"
          viewAllLink="/shop"
          items={topItems}
          itemType="product"
        />
        <ListCard
          title="Top Users"
          viewAllLink="/dashboard/users"
          items={topUsers}
          itemType="user"
        />
        <ListCard
          title="Most Viewed Products"
          viewAllLink="/shop"
          items={mostViewedProducts}
          itemType="product"
        />
        <BarChart
          title="Sales by Product"
          data={salesByProduct.data}
          categories={salesByProduct.categories}
          color="#4CAF50"
        />
      </div>
    </motion.div>
  );
};

export default withAuth(AnalyticsDashboard);
