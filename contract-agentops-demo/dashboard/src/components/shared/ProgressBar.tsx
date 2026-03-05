import React from "react";

interface Props {
  value: number; // 0-100
  label?: string;
  color?: string;
}

export function ProgressBar({ value, label, color = "bg-blue-500" }: Props) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div>
      {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
