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
      className={`${kordaColor.border} ${kordaColor.bg} flex flex-col overflow-hidden border-2 shadow-sm`}
      style={{
        width: `${width}mm`,
        height: `${height}mm`,
        breakInside: "avoid",
      }}
    >
      {/* Header */}
      <div className={`${kordaColor.headerBg} shrink-0 px-3 pt-2 pb-1.5 text-center`}>
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/90 shadow-sm leading-none mb-1 pt-0.5">
          ✦ KARTU BARANGs {data.studentGender === "L" ? "PUTRA" : "PUTRI"} ✦
        </div>
        <div className="text-[17px] font-black uppercase tracking-widest text-white shadow-sm leading-none drop-shadow-sm truncate">
          {data.kordaName}
        </div>
      </div>
      
      {/* Divider */}
      <div className={`h-[3px] ${kordaColor.border} shrink-0`}></div>

      {/* Name Ribbon */}
      <div className={`${kordaColor.bg} shrink-0 px-3 pt-2 pb-1.5 text-center border-b border-${kordaColor.border.replace('border-', '')}/20`}>
        <div className={`text-[8.5px] font-bold ${kordaColor.text} uppercase tracking-widest mb-0.5 opacity-75`}>
          Nama Peserta
        </div>
        <div className="text-[16px] font-extrabold text-gray-900 leading-tight px-1 truncate">
          {data.studentName}
        </div>
      </div>

      {/* Split Grid */}
      <div className="grid flex-1 grid-cols-2 bg-white overflow-hidden">
        {/* Left Column */}
        <div className="flex flex-col justify-center gap-2 p-3 pb-2 border-r border-gray-200">
           <div>
             <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Korda</div>
             <div className={`text-[12px] font-bold ${kordaColor.text} leading-tight truncate`}>{data.kordaName}</div>
           </div>
           <div>
             <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Nomor Induk</div>
             <div className="text-[11px] font-semibold text-gray-700 leading-none truncate">{data.studentNis}</div>
           </div>
        </div>
        {/* Right Column */}
        <div className="flex flex-col justify-center gap-2 p-3 pb-2">
           <div>
             <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Drop Point</div>
             <div className="text-[12px] font-bold text-gray-900 leading-tight line-clamp-2">{data.dropPointName}</div>
           </div>
           <div>
             <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Bus</div>
             <div className={`inline-block text-[13px] font-black text-white ${kordaColor.headerBg} px-2 py-0.5 rounded uppercase tracking-wider max-w-full truncate`}>
               {data.busLabel || "-"}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
