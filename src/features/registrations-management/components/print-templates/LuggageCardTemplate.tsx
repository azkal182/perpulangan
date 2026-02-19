"use client";

import type { PrintDataItem } from "../../lib/print-utils";

interface LuggageCardTemplateProps {
  data: PrintDataItem;
  width: number; // in mm
  height: number; // in mm
}

export function LuggageCardTemplate({
  data,
  width,
  height,
}: LuggageCardTemplateProps) {
  const isPutra = data.studentGender === "L";
  const headerBg = isPutra ? "bg-blue-600" : "bg-pink-600";
  const borderColor = isPutra ? "border-blue-600" : "border-pink-600";
  const bgColor = isPutra ? "bg-blue-50" : "bg-pink-50";

  return (
    <div
      className={`${borderColor} ${bgColor} flex flex-col overflow-hidden rounded-lg border-2 shadow-sm`}
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      {/* Header */}
      <div className={`${headerBg} px-3 py-2 text-center`}>
        <div className="text-xs font-bold uppercase text-white">
          KARTU BARANG {isPutra ? "PUTRA" : "PUTRI"}
        </div>
      </div>

      {/* Content - 2 Columns */}
      <div className="grid flex-1 grid-cols-2 gap-2 p-3">
        {/* Left Column */}
        <div className="space-y-1.5 text-xs">
          <div>
            <div className="font-semibold text-gray-700">Nama:</div>
            <div className="line-clamp-2 font-medium text-gray-900">
              {data.studentName}
            </div>
          </div>
          <div>
            <div className="font-semibold text-gray-700">NIS:</div>
            <div className="font-medium text-gray-900">{data.studentNis}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-700">Korda:</div>
            <div className="line-clamp-2 font-medium text-gray-900">
              {data.kordaName}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-1.5 text-xs">
          <div>
            <div className="font-semibold text-gray-700">Drop Point:</div>
            <div className="line-clamp-2 font-medium text-gray-900">
              {data.dropPointName}
            </div>
          </div>
          <div>
            <div className="font-semibold text-gray-700">Bus:</div>
            <div className="line-clamp-2 font-medium text-gray-900">
              {data.busLabel || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
