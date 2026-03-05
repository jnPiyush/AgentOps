import React from "react";

interface Props {
  data: unknown;
  maxHeight?: string;
}

export function JsonViewer({ data, maxHeight = "300px" }: Props) {
  return (
    <pre
      className="bg-gray-900 text-green-400 text-xs p-3 rounded-lg overflow-auto font-mono"
      style={{ maxHeight }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
