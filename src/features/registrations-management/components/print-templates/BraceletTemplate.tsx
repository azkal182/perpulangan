"use client";

import {
  getKordaColor,
  type PrintDataItem,
} from "../../lib/print-utils";

interface BraceletTemplateProps {
  data: PrintDataItem;
  eventName: string;
  journeyType?: "outbound" | "return";
  width?: number; // 220 mm
  height?: number; // 20 mm
}

export function BraceletTemplate({
  data,
  eventName,
  journeyType = "outbound",
  width = 220,
  height = 20,
}: BraceletTemplateProps) {
  const kordaColor = getKordaColor(data.kordaName);
  const isPutri =
    data.studentGender === "P" ||
    data.studentGender === "PUTRI" ||
    data.studentGender === "Perempuan";
  const genderLabel = isPutri ? "PUTRI" : "PUTRA";
  const rosterNumber = String(data.rosterNumber).padStart(3, "0");
  const journeyLabel = journeyType === "outbound" ? "PULANG" : "KEMBALI";

  return (
    <div
      className="relative box-border overflow-hidden bg-white border border-gray-300"
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      {/* Background Lighting Gradient - Soft & Continuous */}
      <div
        className={`absolute inset-0 ${kordaColor.headerBg}`}
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.06) 100%)",
        }}
      />

      {/* Main Content Layout */}
      <div className="relative h-full w-full flex items-center justify-between px-3 z-10">
        {/* Left: Logo */}
        <div className="shrink-0 flex items-center pr-3 border-r border-white/40 border-dashed h-4/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            className="h-[15mm] w-auto max-w-[24mm] object-contain"
          />
        </div>

        {/* Center: Participant Details */}
        <div className="flex-1 px-3 flex flex-col justify-between h-full py-1">
          {/* Top Line: Badges */}
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[7px] font-black tracking-wider">
              AKSES {journeyLabel}
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-900 text-[7px] font-black">
              {genderLabel}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900 text-[7px] font-black">
              NO. {rosterNumber}
            </span>
            <span className="text-[7.5px] font-extrabold text-slate-800 tracking-wider uppercase truncate drop-shadow-xs">
              {eventName}
            </span>
          </div>

          {/* Middle Line: Hero Name */}
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-black text-slate-900 uppercase leading-none truncate drop-shadow-xs">
              {data.studentName}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-900 text-[6.5px] font-bold shrink-0">
              {data.studentNis ? `NIS: ${data.studentNis}` : "PESERTA UMUM"}
            </span>
          </div>

          {/* Bottom Line: Logistics (Korda, Drop Point, Bus) */}
          <div className="flex items-center gap-1.5 text-[7px]">
            <div className="bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-900 truncate max-w-[45mm]">
              <span className="font-bold text-slate-500 mr-1">KORDA:</span>
              <span className="font-black">{data.kordaName}</span>
            </div>
            <div className="bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-900 truncate max-w-[55mm]">
              <span className="font-bold text-slate-500 mr-1">TURUN:</span>
              <span className="font-black">{data.dropPointName}</span>
            </div>
            <div className={`${kordaColor.headerBg} px-2 py-0.5 rounded border border-white text-white font-black truncate shadow-xs`}>
              <span className="opacity-85 mr-1 font-bold">ARMADA:</span>
              <span>{data.busLabel || "-"}</span>
            </div>
          </div>
        </div>

        {/* Right: Barcode Box and Spaced Track Header */}
        <div className="shrink-0 flex flex-col items-center justify-center pl-2">
          <div className="text-[6.5px] font-black tracking-[3px] text-slate-900 uppercase mb-0.5">
            M A B A R A T I 0 . 5
          </div>
          <div className="bg-white px-2 py-1 rounded border border-slate-300 flex items-center justify-center shadow-xs">
            {/* Barcode visual representation */}
            <div className="flex items-center gap-[1px] h-[7mm] w-[40mm] px-1">
              {Array.from({ length: 38 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-full bg-black ${i % 3 === 0 ? "w-[2px]" : i % 5 === 0 ? "w-[3px]" : "w-[1px]"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
