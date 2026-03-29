"use client";
import React from "react";
import AttributeForm from "./AttributeForm";
import AttributeAssignment from "./AttributeAssignment";
import DashboardHeader from "./DashboardHeader";
import { useGetAllAttributesQuery } from "@/app/store/apis/AttributeApi";
import AttributesBoardView from "./AttributesBoardView";
import { withAuth } from "@/app/components/HOC/WithAuth";
import { getApiErrorMessage } from "@/app/utils/getApiErrorMessage";
import LoadingDots from "@/app/components/feedback/LoadingDots";

const AttributesDashboard: React.FC = () => {
  const { data, isLoading, error } = useGetAllAttributesQuery(undefined);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingDots label="Loading attributes" align="center" className="text-base" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-lg">
        Error loading attributes:{" "}
        {getApiErrorMessage(error, "Unknown error")}
      </div>
    );
  }

  return (
    <div className="p-6 min-w-full bg-gray-50 min-h-screen">
      <DashboardHeader />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Create Form */}
        <div className="lg:col-span-1">
          <AttributeForm />
        </div>

        {/* Right Column - Assignment & List */}
        <div className="lg:col-span-2 space-y-6">
          <AttributeAssignment attributes={data?.attributes || []} />
        </div>
      </div>
      <AttributesBoardView attributes={data?.attributes || []} />
    </div>
  );
};

export default withAuth(AttributesDashboard);
