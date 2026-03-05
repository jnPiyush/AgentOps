import React from "react";

interface Props {
  status: string;
  size?: "sm" | "md";
}

const COLORS: Record<string, string> = {
  processing: "bg-blue-100 text-blue-700",
  awaiting_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-600",
  low: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
  pass: "bg-green-100 text-green-700",
  fail: "bg-red-100 text-red-700",
  warn: "bg-yellow-100 text-yellow-700",
  online: "bg-green-100 text-green-700",
  offline: "bg-red-100 text-red-700",
};

export function StatusBadge({ status, size = "sm" }: Props) {
  const color = COLORS[status] ?? "bg-gray-100 text-gray-600";
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span className={`inline-block rounded-full font-medium ${color} ${padding}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
