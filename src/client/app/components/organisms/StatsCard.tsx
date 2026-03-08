"use client";
import { cn } from "@/app/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

type StatsCardProps = {
  title: string;
  value: string | number;
  percentage?: number | null;
  caption?: string;
  icon?: React.ReactNode;
};

const StatsCard = ({ title, value, percentage, caption, icon }: StatsCardProps) => {
  const safePercentage =
    typeof percentage === "number" && Number.isFinite(percentage)
      ? percentage
      : null;
  const isPositive = safePercentage === null ? true : safePercentage >= 0;

  return (
    <div className="mb-6 flex w-full flex-col gap-2 rounded-xl bg-white p-6 text-black shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-800">{title}</h3>
        {icon && (
          <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">{icon}</div>
        )}
      </div>

      <div className="text-2xl sm:text-3xl font-bold">{value}</div>

      <div className="flex items-center gap-1 text-sm">
        <div
          className={cn(
            "flex items-center justify-center rounded-full px-2 py-1 text-xs font-medium",
            isPositive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          )}
        >
          {isPositive ? (
            <TrendingUp className="mr-1 h-3 w-3" />
          ) : (
            <TrendingDown className="mr-1 h-3 w-3" />
          )}
          {safePercentage === null ? "N/A" : `${Math.abs(safePercentage)}%`}
        </div>
        {caption && <span className="text-gray-800">- {caption}</span>}
      </div>
    </div>
  );
};

export default StatsCard;
