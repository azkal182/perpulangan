"use client";

import type { PrintDataItem } from "../lib/print-utils";

interface TicketTemplateProps {
  data: PrintDataItem;
  width: number; // in mm
  height: number; // in mm
}

export function TicketTemplate({ data, width, height }: TicketTemplateProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border-2 border-teal-600 bg-gradient-to-br from-teal-50 to-green-50 shadow-md"
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <pattern
            id="grid"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="10" r="1" fill="currentColor" />
          </pattern>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative flex h-full flex-col p-4">
        {/* Header */}
        <div className="mb-3 text-center">
          <div className="text-base font-bold uppercase text-teal-800">
            Tiket Perjalanan
          </div>
          <div className="h-0.5 mt-1 bg-gradient-to-r from-transparent via-teal-600 to-transparent" />
        </div>

        {/* Data Grid - 2 Columns */}
        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-2 text-sm">
          {/* Left Column */}
          <div className="space-y-2">
            <div>
              <div className="text-xs font-semibold text-gray-600">Nama</div>
              <div className="line-clamp-2 font-bold text-gray-900">
                {data.studentName}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">NIS</div>
              <div className="font-bold text-gray-900">{data.studentNis}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">Korda</div>
              <div className="line-clamp-2 font-medium text-gray-900">
                {data.kordaName}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-2">
            <div>
              <div className="text-xs font-semibold text-gray-600">
                Drop Point
              </div>
              <div className="line-clamp-2 font-medium text-gray-900">
                {data.dropPointName}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">Bus</div>
              <div className="line-clamp-2 font-medium text-gray-900">
                {data.busLabel || "-"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t-2 border-dashed border-teal-300 pt-2">
          <p className="text-center text-xs font-medium italic text-teal-700">
            Simpan tiket ini baik-baik
          </p>
        </div>
      </div>
    </div>
  );
}
