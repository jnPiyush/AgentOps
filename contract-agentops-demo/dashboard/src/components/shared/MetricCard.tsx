import React from "react";

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ label, value, subtitle, trend }: Props) {
  const trendColor = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-500";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className={`text-xs mt-1 ${trendColor}`}>{subtitle}</p>}
    </div>
  );
}
