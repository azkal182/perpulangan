"use client";

import {
  getKordaColor,
  type PrintDataItem,
  type LuggageCardSize,
} from "../../lib/print-utils";

interface LuggageCardTemplateProps {
  data: PrintDataItem;
  width: number; // in mm
  height: number; // in mm
  cardSize?: LuggageCardSize;
}

export function LuggageCardTemplate({
  data,
  width,
  height,
  cardSize = "standard",
}: LuggageCardTemplateProps) {
  const kordaColor = getKordaColor(data.kordaName);
  const isPutri =
    data.studentGender === "P" ||
    data.studentGender === "PUTRI" ||
    data.studentGender === "Perempuan";
  const genderLabel = isPutri ? "PUTRI" : "PUTRA";
  const rosterNumber = String(data.rosterNumber).padStart(3, "0");
  const isLarge = cardSize === "large_landscape" || cardSize === "large_portrait";
  const paddingClass = isLarge ? "p-[2.5mm]" : "p-[2mm]";

  if (cardSize === "large_portrait") {
    return (
      /* Outer cutting box with gray border and plain white frame margin */
      <div
        className={`relative box-border bg-white border border-gray-300 ${paddingClass}`}
        style={{
          width: `${width}mm`,
          height: `${height}mm`,
          breakInside: "avoid",
        }}
      >
        {/* Inner Card Artwork */}
        <div
          className={`h-full w-full relative flex flex-col justify-between overflow-hidden bg-white border ${kordaColor.border} rounded-[2.5mm]`}
        >
          {/* Top Header Banner (Vertical) */}
          <div
            className={`${kordaColor.headerBg} shrink-0 px-3 pt-2 pb-1.5 text-center text-white relative`}
          >
            {/* Centered Punch Hole Guide */}
            <div className="mx-auto mb-1 w-3.5 h-3.5 rounded-full border border-dashed border-white/70 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-white/90" />
            </div>
            <div className="text-[7px] font-bold uppercase tracking-widest text-white/85 leading-none mb-0.5">
              Label Bagasi Santri
            </div>
            <div className="text-[14px] font-black uppercase tracking-wide text-white leading-tight truncate">
              {data.kordaName}
            </div>
          </div>

          {/* Sub Header: Gender Pill & Roster Number Badges */}
          <div className="bg-slate-50 border-y border-gray-200 px-3 py-1 flex items-center justify-between shrink-0">
            <div
              className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider text-white ${kordaColor.headerBg}`}
            >
              {genderLabel}
            </div>
            <div className="bg-white rounded px-2 py-0.5 border border-gray-300 text-center shadow-xs">
              <span className="text-[6px] font-bold text-gray-400 uppercase tracking-wider mr-1">
                No. Urut:
              </span>
              <span className="text-[11px] font-black text-gray-900">
                {rosterNumber}
              </span>
            </div>
          </div>

          {/* Main Body with balanced vertical cards */}
          <div className="flex-1 px-3 pt-2 pb-2.5 flex flex-col justify-between gap-1.5 overflow-hidden">
            {/* Hero Passenger Name */}
            <div>
              <div className="text-[6.5px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
                Nama Penumpang / Santri
              </div>
              <div className="text-[13.5px] font-black text-gray-900 leading-tight">
                {data.studentName}
              </div>
              <div className="mt-0.5">
                {data.studentNis ? (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[7px] font-bold">
                    NIS: {data.studentNis}
                  </span>
                ) : (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[6.5px] font-bold">
                    PESERTA UMUM
                  </span>
                )}
              </div>
            </div>

            {/* Drop Point Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5">
              <div className="text-[6.5px] font-bold text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                Titik Turun (Drop Point)
              </div>
              <div className="text-[10px] font-bold text-gray-900 leading-tight line-clamp-2">
                {data.dropPointName}
              </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5">
              <div className="text-[6.5px] font-bold text-gray-500 uppercase tracking-wider leading-none mb-0.5">
                Kontak Darurat / Ortu
              </div>
              <div className="text-[10px] font-semibold text-gray-800 leading-none truncate">
                {data.parrentPhone || "-"}
              </div>
            </div>

            {/* Hero Armada Bus Card (Moved to bottom section) */}
            <div>
              <div className="text-[6.5px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
                Armada Bus
              </div>
              <div
                className={`${kordaColor.headerBg} rounded-xl p-2 text-center shadow-xs text-white border ${kordaColor.border}`}
              >
                <div className="text-[6px] font-bold uppercase tracking-wider text-white/85 leading-none mb-0.5">
                  Bus Penumpang
                </div>
                <div className="text-[16px] font-black uppercase tracking-wider text-white leading-tight">
                  {data.busLabel || "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Landscape (standard 95x53 or large_landscape 127x77)
  const isLargeLandscape = cardSize === "large_landscape";

  return (
    /* Outer cutting box with gray border and plain white frame margin */
    <div
      className={`relative box-border bg-white border border-gray-300 ${paddingClass}`}
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      {/* Inner Card Artwork */}
      <div
        className={`h-full w-full relative flex flex-col justify-between overflow-hidden bg-white border ${kordaColor.border} rounded-[2mm]`}
      >
        {/* Top Header Banner */}
        <div
          className={`${kordaColor.headerBg} shrink-0 ${isLargeLandscape ? "px-3.5 py-2" : "px-2.5 py-1.5"} flex items-center justify-between text-white relative`}
        >
          {/* Left: Punch Hole Guide & Korda */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`${isLargeLandscape ? "w-3.5 h-3.5" : "w-3 h-3"} rounded-full border border-dashed border-white/70 flex items-center justify-center shrink-0`}
            >
              <div className={`${isLargeLandscape ? "w-1 h-1" : "w-0.5 h-0.5"} rounded-full bg-white/80`} />
            </div>
            <div className="min-w-0">
              <div
                className={`${isLargeLandscape ? "text-[7.5px]" : "text-[6px]"} font-bold uppercase tracking-wider text-white/85 leading-none mb-0.5`}
              >
                Label Bagasi Santri
              </div>
              <div
                className={`${isLargeLandscape ? "text-[15px]" : "text-[12px]"} font-black uppercase tracking-wide text-white leading-none truncate`}
              >
                {data.kordaName}
              </div>
            </div>
          </div>

          {/* Right: Gender Pill & Roster Number Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className={`${isLargeLandscape ? "px-2.5 py-0.5 text-[8.5px]" : "px-2 py-0.5 text-[7px]"} rounded-full bg-white/20 border border-white/40 font-black uppercase tracking-wider text-white`}
            >
              {genderLabel}
            </div>
            <div
              className={`bg-white rounded-md ${isLargeLandscape ? "px-2 py-0.5" : "px-1.5 py-0.5"} border border-gray-200 text-center shadow-xs`}
            >
              <div
                className={`${isLargeLandscape ? "text-[6.5px]" : "text-[5px]"} font-bold text-gray-400 uppercase tracking-wider leading-none`}
              >
                No. Urut
              </div>
              <div
                className={`${isLargeLandscape ? "text-[13px]" : "text-[10px]"} font-black text-gray-900 leading-tight`}
              >
                {rosterNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Header Accent Line */}
        <div className={`${isLargeLandscape ? "h-[2.5px]" : "h-[1.5px]"} ${kordaColor.border} shrink-0`} />

        {/* Body Section */}
        <div className={`flex-1 ${isLargeLandscape ? "px-3.5 pt-2 pb-2.5" : "px-2.5 pt-1.5 pb-2"} flex flex-col justify-between`}>
          {/* Passenger Hero Identity */}
          <div>
            <div
              className={`${isLargeLandscape ? "text-[7.5px]" : "text-[6px]"} font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5`}
            >
              Nama Penumpang / Santri
            </div>
            <div
              className={`${isLargeLandscape ? "text-[15px]" : "text-[12px]"} font-black text-gray-900 leading-tight truncate`}
            >
              {data.studentName}
            </div>
            <div className="mt-0.5">
              {data.studentNis ? (
                <span
                  className={`inline-block ${isLargeLandscape ? "px-1.5 py-0.5 text-[8px]" : "px-1 py-0.5 text-[6.5px]"} rounded bg-gray-100 text-gray-700 font-bold`}
                >
                  NIS: {data.studentNis}
                </span>
              ) : (
                <span
                  className={`inline-block ${isLargeLandscape ? "px-1.5 py-0.5 text-[7.5px]" : "px-1 py-0.5 text-[6px]"} rounded bg-gray-100 text-gray-500 font-bold`}
                >
                  PESERTA UMUM
                </span>
              )}
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-200 my-0.5" />

          {/* Logistics Grid: Drop Point + Phone (Left), Bus (Right) */}
          <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end">
            {/* Left: Drop Point & Phone */}
            <div className="space-y-1 min-w-0">
              <div>
                <div
                  className={`${isLargeLandscape ? "text-[7.5px]" : "text-[6px]"} font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5`}
                >
                  Titik Turun (Drop Point)
                </div>
                <div
                  className={`${isLargeLandscape ? "text-[11px]" : "text-[9px]"} font-bold text-gray-900 leading-tight line-clamp-2`}
                >
                  {data.dropPointName}
                </div>
              </div>
              <div>
                <div
                  className={`${isLargeLandscape ? "text-[7px]" : "text-[5.5px]"} font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5`}
                >
                  Kontak Darurat / Ortu
                </div>
                <div
                  className={`${isLargeLandscape ? "text-[10px]" : "text-[8px]"} font-semibold text-gray-700 leading-none truncate`}
                >
                  {data.parrentPhone || "-"}
                </div>
              </div>
            </div>

            {/* Right: Armada Bus Badge */}
            <div className={`${isLargeLandscape ? "w-[48mm]" : "w-[36mm]"} shrink-0`}>
              <div
                className={`${isLargeLandscape ? "text-[7.5px]" : "text-[6px]"} font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5 text-center`}
              >
                Armada Bus
              </div>
              <div
                className={`${kordaColor.headerBg} rounded-lg ${isLargeLandscape ? "p-2" : "p-1.5"} text-center shadow-xs text-white border ${kordaColor.border}`}
              >
                <div
                  className={`${isLargeLandscape ? "text-[6.5px]" : "text-[5px]"} font-bold uppercase tracking-wider text-white/80 leading-none mb-0.5`}
                >
                  Bus Penumpang
                </div>
                <div
                  className={`${isLargeLandscape ? "text-[14.5px]" : "text-[11.5px]"} font-black uppercase tracking-wider text-white leading-tight truncate`}
                >
                  {data.busLabel || "-"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
