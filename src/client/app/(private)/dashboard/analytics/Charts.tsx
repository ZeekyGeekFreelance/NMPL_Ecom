"use client";
import AreaChartComponent from "@/app/components/charts/AreaChartComponent";
import DonutChart from "@/app/components/charts/DonutChartComponent";
import RevenueOverTimeChart from "@/app/components/charts/RevenueOverTimeChart";
import React from "react";

const Charts = ({ data, mostSoldProducts, interactionByType }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
      <AreaChartComponent
        title="Order Trends"
        data={data?.revenueAnalytics?.monthlyTrends?.orders || []}
        categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
        color="#1d3461"
        percentageChange={data?.orderAnalytics?.changes?.orders}
      />
      <AreaChartComponent
        title="Revenue Trends"
        data={data?.revenueAnalytics?.monthlyTrends?.revenue || []}
        categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
        color="#15803d"
        percentageChange={data?.revenueAnalytics?.changes?.revenue}
      />
      <AreaChartComponent
        title="Sales Trends"
        data={data?.revenueAnalytics?.monthlyTrends?.sales || []}
        categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
        color="#b84c0d"
        percentageChange={data?.orderAnalytics?.changes?.sales}
      />
      <AreaChartComponent
        title="User Trends"
        data={data?.revenueAnalytics?.monthlyTrends?.users || []}
        categories={data?.revenueAnalytics?.monthlyTrends?.labels || []}
        color="#b45309"
        percentageChange={data?.userAnalytics?.changes?.users}
      />
      <AreaChartComponent
        title="Interaction Trends (Views)"
        data={data?.userAnalytics?.interactionTrends?.views || []}
        categories={data?.userAnalytics?.interactionTrends?.labels || []}
        color="#152847"
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
      <RevenueOverTimeChart
        labels={data?.revenueAnalytics?.monthlyTrends?.labels || []}
        revenue={data?.revenueAnalytics?.monthlyTrends?.revenue || []}
        totalRevenue={data?.revenueAnalytics?.totalRevenue || 0}
      />
    </div>
  );
};

export default Charts;
