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
  eventName?: string;
}

function formatSpacedEventTitle(eventName?: string): string {
  if (!eventName) return "M A B A R A T I   0 . 5";
  const clean = eventName.toUpperCase().replace(/[^A-Z0-9. -]/g, "").trim();
  if (!clean) return "M A B A R A T I   0 . 5";
  if (clean.includes("MABAR") && clean.includes("0.5")) {
    return "M A B A R A T I   0 . 5";
  }
  if (clean.length <= 18) {
    return clean.split("").join(" ");
  }
  return clean.slice(0, 18).split("").join(" ");
}

function generateBarcodeBars(seed: string, targetWidth: number): Array<{ x: number; width: number }> {
  const baseSequence = [
    2, 1, 1, 2, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 2, 1,
    3, 1, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2, 2, 1,
    1, 3, 2, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 1, 2,
    2, 1, 2,
  ];
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash = hash >>> 0;

  const adjusted = baseSequence.map((w, idx) => {
    if (idx < 4 || idx >= baseSequence.length - 3) return w;
    const bit = (hash >> (idx % 16)) & 1;
    return Math.max(1, Math.min(3, w + (bit === 1 && w === 1 ? 1 : 0)));
  });

  const total = adjusted.reduce((acc, val) => acc + val, 0);
  const scale = targetWidth / total;

  const bars: Array<{ x: number; width: number }> = [];
  let curX = 0;
  for (let i = 0; i < adjusted.length; i++) {
    const w = adjusted[i] * scale;
    if (i % 2 === 0) {
      bars.push({ x: curX, width: Math.max(0.7, w) });
    }
    curX += w;
  }
  return bars;
}

function renderWaveSvgOverlay(w: number, h: number, mode: "portrait" | "landscape") {
  const curves: string[] = [];
  const numCurves = 10;
  // Top-right curves
  for (let c = 0; c < numCurves; c++) {
    const x1 = w * 0.48 + c * (w * 0.05);
    const y1 = 0;
    const cx1 = w * 0.68 + c * (w * 0.025);
    const cy1 = h * (mode === "portrait" ? 0.10 : 0.14) + c * (h * 0.012);
    const cx2 = w * 0.82 + c * (w * 0.015);
    const cy2 = h * (mode === "portrait" ? 0.16 : 0.22) + c * (h * 0.016);
    const x2 = w;
    const y2 = h * (mode === "portrait" ? 0.08 : 0.12) + c * (h * 0.024);
    curves.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  // Bottom-left curves
  for (let c = 0; c < numCurves; c++) {
    const x1 = 0;
    const y1 = h * (mode === "portrait" ? 0.72 : 0.65) + c * (h * 0.024);
    const cx1 = w * 0.22 + c * (w * 0.025);
    const cy1 = h * (mode === "portrait" ? 0.68 : 0.60) - c * (h * 0.01);
    const cx2 = w * 0.35 + c * (w * 0.03);
    const cy2 = h * (mode === "portrait" ? 0.88 : 0.82) + c * (h * 0.012);
    const x2 = w * (mode === "portrait" ? 0.38 : 0.32) + c * (w * 0.045);
    const y2 = h;
    curves.push(`M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return curves;
}

export function LuggageCardTemplate({
  data,
  width,
  height,
  cardSize = "standard",
  eventName = "Mabar Ati 0.5",
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
  const spacedTitle = formatSpacedEventTitle(eventName);

  if (cardSize === "large_portrait") {
    const waves = renderWaveSvgOverlay(72, 122, "portrait");
    const barcodeBars = generateBarcodeBars(data.studentNis || data.id, 34);

    return (
      <div
        className={`relative box-border bg-white border border-gray-300 ${paddingClass}`}
        style={{
          width: `${width}mm`,
          height: `${height}mm`,
          breakInside: "avoid",
        }}
      >
        {/* Inner Card Artwork with Modern Gradient and Waves */}
        <div
          className={`h-full w-full relative flex flex-col justify-between overflow-hidden ${kordaColor.headerBg} border ${kordaColor.border} rounded-[2.5mm] shadow-xs text-slate-900`}
        >
          {/* Guilloche Ribbon Waves Overlay */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
            viewBox="0 0 72 122"
            preserveAspectRatio="none"
          >
            {waves.map((d, idx) => (
              <path key={idx} d={d} fill="none" stroke="#ffffff" strokeWidth="0.25" />
            ))}
          </svg>

          {/* Punch Hole Guide */}
          <div className="absolute top-[2mm] left-1/2 -translate-x-1/2 z-10 w-3 h-3 rounded-full border border-dashed border-white/80 flex items-center justify-center">
            <div className="w-0.5 h-0.5 rounded-full bg-white/90" />
          </div>

          {/* Top Header White Bar */}
          <div className="relative z-10 mx-[2.5mm] mt-[6mm] bg-white rounded-lg p-1.5 flex items-center justify-between border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo"
                className="w-7 h-5 object-contain shrink-0"
              />
              <span className="text-[11px] font-black tracking-wider text-slate-900 leading-none">
                ID BARANG
              </span>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-[7.5px] font-black uppercase tracking-wider text-white ${kordaColor.headerBg} truncate max-w-[34mm] flex items-center justify-center leading-none text-center`}
            >
              {data.kordaName}
            </div>
          </div>

          {/* Main Floating Cards Body */}
          <div className="relative z-10 mx-[2.5mm] my-1 flex-1 flex flex-col justify-between gap-1 overflow-hidden">
            {/* Hero Passenger Card */}
            <div className="bg-white rounded-lg p-2 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[6.5px] font-black uppercase tracking-wider text-white ${kordaColor.headerBg}`}
                >
                  {genderLabel}
                </span>
                <span className="bg-slate-50 border border-slate-200 text-[6.5px] font-extrabold px-1.5 py-0.5 rounded text-slate-800">
                  NO. URUT: {rosterNumber}
                </span>
              </div>
              <div className="text-[6px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                Nama Penumpang / Santri
              </div>
              <div className="text-[13px] font-black text-slate-900 leading-tight truncate">
                {data.studentName}
              </div>
              <div className="mt-1">
                {data.studentNis ? (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[6.5px] font-bold">
                    NIS: {data.studentNis}
                  </span>
                ) : (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[6.5px] font-bold">
                    PESERTA UMUM
                  </span>
                )}
              </div>
            </div>

            {/* Drop Point Card */}
            <div className="bg-white rounded-lg p-1.5 border border-slate-200/90 shadow-xs">
              <div className="text-[6px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                Titik Turun (Drop Point)
              </div>
              <div className="text-[9.5px] font-bold text-slate-900 leading-tight line-clamp-2">
                {data.dropPointName}
              </div>
            </div>

            {/* Emergency Contact Card */}
            <div className="bg-white rounded-lg p-1.5 border border-slate-200/90 shadow-xs">
              <div className="text-[6px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                Kontak Darurat / Ortu
              </div>
              <div className="text-[9.5px] font-semibold text-slate-800 leading-none truncate">
                {data.parrentPhone || "-"}
              </div>
            </div>

            {/* Armada Bus Card (Moved to bottom section) */}
            <div className="bg-white rounded-lg overflow-hidden border border-slate-200/90 shadow-xs">
              <div
                className={`${kordaColor.headerBg} py-0.5 text-center text-white text-[6px] font-black uppercase tracking-wider leading-none`}
              >
                Armada Bus Penumpang
              </div>
              <div className="py-2 text-center text-[18px] font-black text-slate-900 leading-none tracking-wider">
                {data.busLabel || "-"}
              </div>
            </div>
          </div>

          {/* Footer: Event Title Spaced + Barcode Box */}
          <div className="relative z-10 pb-[2mm] text-center">
            <div className="text-[6.5px] font-black uppercase tracking-[0.25em] text-white leading-none mb-1 drop-shadow-xs">
              {spacedTitle}
            </div>
            <div className="mx-auto w-[38mm] h-[8mm] bg-white rounded border border-slate-200/90 flex items-center justify-center p-1 shadow-xs">
              <svg className="w-full h-full" viewBox="0 0 34 8" preserveAspectRatio="none">
                {barcodeBars.map((bar, i) => (
                  <rect key={i} x={bar.x} y="0" width={bar.width} height="8" fill="#111827" />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cardSize === "large_landscape") {
    const waves = renderWaveSvgOverlay(122, 72, "landscape");
    const barcodeBars = generateBarcodeBars(data.studentNis || data.id, 42);

    return (
      <div
        className={`relative box-border bg-white border border-gray-300 ${paddingClass}`}
        style={{
          width: `${width}mm`,
          height: `${height}mm`,
          breakInside: "avoid",
        }}
      >
        {/* Inner Card Artwork with Modern Gradient and Waves */}
        <div
          className={`h-full w-full relative flex flex-col justify-between overflow-hidden ${kordaColor.headerBg} border ${kordaColor.border} rounded-[2.5mm] shadow-xs text-slate-900`}
        >
          {/* Guilloche Ribbon Waves Overlay */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
            viewBox="0 0 122 72"
            preserveAspectRatio="none"
          >
            {waves.map((d, idx) => (
              <path key={idx} d={d} fill="none" stroke="#ffffff" strokeWidth="0.25" />
            ))}
          </svg>

          {/* Top Header White Bar */}
          <div className="relative z-10 mx-[2.5mm] mt-[2.5mm] bg-white rounded-lg p-1.5 flex items-center justify-between border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Logo"
                className="w-7 h-5 object-contain shrink-0"
              />
              <span className="text-[11px] font-black tracking-wider text-slate-900 leading-none">
                ID BARANG
              </span>
            </div>
            {/* Punch hole */}
            <div className="w-3 h-3 rounded-full border border-dashed border-slate-300 flex items-center justify-center">
              <div className="w-0.5 h-0.5 rounded-full bg-slate-400" />
            </div>
            <div
              className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider text-white ${kordaColor.headerBg} truncate max-w-[46mm] flex items-center justify-center leading-none text-center`}
            >
              {data.kordaName}
            </div>
          </div>

          {/* Two-Column Body Section */}
          <div className="relative z-10 mx-[2.5mm] my-1 flex-1 grid grid-cols-[1.25fr_1fr] gap-2 items-stretch overflow-hidden">
            {/* Left Column: Passenger, Drop Point, Phone */}
            <div className="flex flex-col justify-between gap-1">
              {/* Passenger Hero Card */}
              <div className="bg-white rounded-lg p-1.5 border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[6px] font-black uppercase tracking-wider text-white ${kordaColor.headerBg}`}
                  >
                    {genderLabel}
                  </span>
                  <span className="bg-slate-50 border border-slate-200 text-[6px] font-extrabold px-1 py-0.2 rounded text-slate-800">
                    NO. URUT: {rosterNumber}
                  </span>
                </div>
                <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                  Nama Penumpang / Santri
                </div>
                <div className="text-[12px] font-black text-slate-900 leading-tight truncate">
                  {data.studentName}
                </div>
                <div className="mt-0.5">
                  {data.studentNis ? (
                    <span className="inline-block px-1 py-0.2 rounded bg-slate-100 text-slate-700 text-[6px] font-bold">
                      NIS: {data.studentNis}
                    </span>
                  ) : (
                    <span className="inline-block px-1 py-0.2 rounded bg-slate-100 text-slate-500 text-[6px] font-bold">
                      PESERTA UMUM
                    </span>
                  )}
                </div>
              </div>

              {/* Drop Point Card */}
              <div className="bg-white rounded-lg p-1.5 border border-slate-200/90 shadow-xs">
                <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                  Titik Turun (Drop Point)
                </div>
                <div className="text-[8.5px] font-bold text-slate-900 leading-tight line-clamp-1">
                  {data.dropPointName}
                </div>
              </div>

              {/* Phone Card */}
              <div className="bg-white rounded-lg p-1 border border-slate-200/90 shadow-xs">
                <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">
                  Kontak Darurat / Ortu
                </div>
                <div className="text-[8.5px] font-semibold text-slate-800 leading-none truncate">
                  {data.parrentPhone || "-"}
                </div>
              </div>
            </div>

            {/* Right Column: Armada Bus & Footer */}
            <div className="flex flex-col justify-between gap-1">
              {/* Armada Bus Card */}
              <div className="bg-white rounded-lg overflow-hidden border border-slate-200/90 shadow-xs flex-1 flex flex-col justify-between">
                <div
                  className={`${kordaColor.headerBg} py-0.5 text-center text-white text-[6px] font-black uppercase tracking-wider leading-none`}
                >
                  Armada Bus Penumpang
                </div>
                <div className="py-2 text-center text-[22px] font-black text-slate-900 leading-none tracking-wider">
                  {data.busLabel || "-"}
                </div>
                <div className="text-[5px] text-center text-slate-400 pb-0.5 font-bold uppercase">
                  Perjalanan Terdaftar
                </div>
              </div>

              {/* Footer Box */}
              <div className="text-center">
                <div className="text-[6px] font-black uppercase tracking-[0.25em] text-white leading-none mb-1 drop-shadow-xs">
                  {spacedTitle}
                </div>
                <div className="w-full h-[7.5mm] bg-white rounded border border-slate-200/90 flex items-center justify-center p-1 shadow-xs">
                  <svg className="w-full h-full" viewBox="0 0 42 7.5" preserveAspectRatio="none">
                    {barcodeBars.map((bar, i) => (
                      <rect key={i} x={bar.x} y="0" width={bar.width} height="7.5" fill="#111827" />
                    ))}
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standard (95x53mm)
  return (
    <div
      className={`relative box-border bg-white border border-gray-300 ${paddingClass}`}
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      <div
        className={`h-full w-full relative flex flex-col justify-between overflow-hidden bg-white border ${kordaColor.border} rounded-[2mm]`}
      >
        <div
          className={`${kordaColor.headerBg} shrink-0 px-2.5 py-1.5 flex items-center justify-between text-white relative`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full border border-dashed border-white/70 flex items-center justify-center shrink-0">
              <div className="w-0.5 h-0.5 rounded-full bg-white/80" />
            </div>
            <div className="min-w-0">
              <div className="text-[6px] font-bold uppercase tracking-wider text-white/85 leading-none mb-0.5">
                Label Bagasi Santri
              </div>
              <div className="text-[12px] font-black uppercase tracking-wide text-white leading-none truncate">
                {data.kordaName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="px-2 py-0.5 text-[7px] rounded-full bg-white/20 border border-white/40 font-black uppercase tracking-wider text-white">
              {genderLabel}
            </div>
            <div className="bg-white rounded-md px-1.5 py-0.5 border border-gray-200 text-center shadow-xs">
              <div className="text-[5px] font-bold text-gray-400 uppercase tracking-wider leading-none">
                No. Urut
              </div>
              <div className="text-[10px] font-black text-gray-900 leading-tight">
                {rosterNumber}
              </div>
            </div>
          </div>
        </div>

        <div className={`h-[1.5px] ${kordaColor.border} shrink-0`} />

        <div className="flex-1 px-2.5 pt-1.5 pb-2 flex flex-col justify-between">
          <div>
            <div className="text-[6px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
              Nama Penumpang / Santri
            </div>
            <div className="text-[12px] font-black text-gray-900 leading-tight truncate">
              {data.studentName}
            </div>
            <div className="mt-0.5">
              {data.studentNis ? (
                <span className="inline-block px-1 py-0.5 text-[6.5px] rounded bg-gray-100 text-gray-700 font-bold">
                  NIS: {data.studentNis}
                </span>
              ) : (
                <span className="inline-block px-1 py-0.5 text-[6px] rounded bg-gray-100 text-gray-500 font-bold">
                  PESERTA UMUM
                </span>
              )}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 my-0.5" />

          <div className="grid grid-cols-[1fr_auto] gap-2.5 items-end">
            <div className="space-y-1 min-w-0">
              <div>
                <div className="text-[6px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
                  Titik Turun (Drop Point)
                </div>
                <div className="text-[9px] font-bold text-gray-900 leading-tight line-clamp-2">
                  {data.dropPointName}
                </div>
              </div>
              <div>
                <div className="text-[5.5px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5">
                  Kontak Darurat / Ortu
                </div>
                <div className="text-[8px] font-semibold text-gray-700 leading-none truncate">
                  {data.parrentPhone || "-"}
                </div>
              </div>
            </div>

            <div className="w-[36mm] shrink-0">
              <div className="text-[6px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5 text-center">
                Armada Bus
              </div>
              <div
                className={`${kordaColor.headerBg} rounded-lg p-1.5 text-center shadow-xs text-white border ${kordaColor.border}`}
              >
                <div className="text-[5px] font-bold uppercase tracking-wider text-white/80 leading-none mb-0.5">
                  Bus Penumpang
                </div>
                <div className="text-[11.5px] font-black uppercase tracking-wider text-white leading-tight truncate">
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
