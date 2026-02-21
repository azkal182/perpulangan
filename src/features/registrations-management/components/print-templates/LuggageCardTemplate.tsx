"use client";

import { getKordaColor, type PrintDataItem } from "../../lib/print-utils";

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
  const kordaColor = getKordaColor(data.kordaName);
  
  return (
    <div
      className={`${kordaColor.border} ${kordaColor.bg} flex flex-col overflow-hidden rounded-lg border-2 shadow-sm`}
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      {/* Header */}
      <div className={`${kordaColor.headerBg} px-3 py-2 text-center`}>
        <div className="text-xs font-bold uppercase text-white shadow-sm">
          KARTU BARANG {data.studentGender === "L" ? "PUTRA" : "PUTRI"}
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
