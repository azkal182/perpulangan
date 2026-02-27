"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileDown, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { getPrintDataAction } from "../actions/print-actions";
import type {
  PaperSize,
  PrintType,
  PrintDataItem,
} from "../lib/print-utils";
import { calculateLayout, PAPER_SIZES, getKordaColor } from "../lib/print-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  kordas: Array<{ id: string; name: string }>;
  dropPoints: Array<{ id: string; name: string }>;
}

interface PrintWorkspaceProps {
  eventId: string;
  kordas: Array<{ id: string; name: string }>;
  dropPoints: Array<{ id: string; name: string }>;
  onClose?: () => void;
  showCloseButton?: boolean;
  className?: string;
}

export function PrintDialog({
  open,
  onOpenChange,
  eventId,
  kordas,
  dropPoints,
}: PrintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cetak Kartu & Tiket</DialogTitle>
          <DialogDescription>
            Pilih jenis dokumen, filter, dan ukuran kertas untuk print
          </DialogDescription>
        </DialogHeader>
        <PrintWorkspace
          eventId={eventId}
          kordas={kordas}
          dropPoints={dropPoints}
          onClose={() => onOpenChange(false)}
          showCloseButton
        />
      </DialogContent>
    </Dialog>
  );
}

export function PrintWorkspace({
  eventId,
  kordas,
  dropPoints,
  onClose,
  showCloseButton = false,
  className,
}: PrintWorkspaceProps) {
  const [printType, setPrintType] = useState<PrintType>("luggage_card");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [genderFilter, setGenderFilter] = useState<
    "all" | "Laki-laki" | "Perempuan"
  >("all");
  const [nameFilter, setNameFilter] = useState("");
  const [kordaFilter, setKordaFilter] = useState<string>("all");
  const [dropPointFilter, setDropPointFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PrintDataItem[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [previewViewportSize, setPreviewViewportSize] = useState({
    width: 0,
    height: 0,
  });
  const resetPreview = () => {
    setShowPreview(false);
    setPreviewPageIndex(0);
  };

  useEffect(() => {
    const target = previewViewportRef.current;
    if (!target) {
      return;
    }

    const updateSize = () => {
      setPreviewViewportSize({
        width: target.clientWidth,
        height: target.clientHeight,
      });
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(updateSize);
    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [showPreview]);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const result = await getPrintDataAction({
        eventId,
        gender: genderFilter === "all" ? undefined : genderFilter,
        studentName: nameFilter.trim() || undefined,
        kordaId: kordaFilter === "all" ? undefined : kordaFilter,
        dropPointId: dropPointFilter === "all" ? undefined : dropPointFilter,
      });

      if (result.success && result.data) {
        if (result.data.length === 0) {
          toast.error("Tidak ada data ditemukan dengan filter yang dipilih");
          setShowPreview(false);
          setPreviewPageIndex(0);
          return;
        }
        setPreviewData(result.data);
        setShowPreview(true);
        setPreviewPageIndex(0);
        toast.success(`Preview siap: ${result.data.length} item`);
      } else {
        toast.error(result.error || "Gagal memuat data");
      }
    } catch (error) {
      console.error(error);
      toast.error("Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!previewData || previewData.length === 0) {
      toast.error("Silakan preview data terlebih dahulu");
      return;
    }

    setLoading(true);
    toast.loading("Generating PDF...");

    try {
      const layout = calculateLayout(paperSize, printType);
      const paper = PAPER_SIZES[paperSize];

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [paper.width, paper.height],
      });

      const cardsPerPage = layout.columns * layout.rows;
      const pageChunks = buildPagesByKorda(previewData, cardsPerPage);
      const totalPages = pageChunks.length;

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const pageData = pageChunks[pageIndex];
        pageData.forEach((item, index) => {
          const row = Math.floor(index / layout.columns);
          const col = index % layout.columns;
          const x = layout.marginX + col * (layout.cardWidth + layout.gapX);
          const y = layout.marginY + row * (layout.cardHeight + layout.gapY);

          if (printType === "luggage_card") {
            drawLuggageCardToPdf(pdf, item, x, y, layout.cardWidth, layout.cardHeight);
            return;
          }

          drawTicketToPdf(pdf, item, x, y, layout.cardWidth, layout.cardHeight);
        });
      }

      // Download PDF
      const filename = `${printType === "luggage_card" ? "kartu_barang" : "tiket"}_${paperSize}_${new Date().getTime()}.pdf`;
      pdf.save(filename);

      toast.dismiss();
      toast.success(`PDF berhasil dibuat (${previewData.length} item)`);
      onClose?.();
    } catch (error) {
      toast.dismiss();
      toast.error("Gagal membuat PDF");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const layout = calculateLayout(paperSize, printType);
  const paper = PAPER_SIZES[paperSize];
  const cardsPerPage = layout.columns * layout.rows;
  const previewPages =
    previewData && showPreview ? buildPagesByKorda(previewData, cardsPerPage) : [];
  const totalPreviewPages = previewPages.length;
  const currentPreviewPage =
    totalPreviewPages > 0
      ? Math.min(previewPageIndex, totalPreviewPages - 1)
      : 0;
  const currentPreviewItems = previewPages[currentPreviewPage] ?? [];
  const mmToPx = (mm: number) => mm * 3.7795275591;
  const paperWidthPx = mmToPx(paper.width);
  const paperHeightPx = mmToPx(paper.height);
  const availableWidthPx = Math.max(0, previewViewportSize.width - 24);
  const availableHeightPx = Math.max(0, previewViewportSize.height - 24);
  const fallbackScale = paperSize === "A3" ? 0.34 : 0.4;
  const fitScale =
    availableWidthPx > 0 && availableHeightPx > 0
      ? Math.min(
          availableWidthPx / paperWidthPx,
          availableHeightPx / paperHeightPx,
        )
      : fallbackScale;
  const previewScale = Math.min(1, Math.max(0.16, fitScale));
  const scaledPaperWidthPx = paperWidthPx * previewScale;
  const scaledPaperHeightPx = paperHeightPx * previewScale;
  const previewCardWidthPx = mmToPx(layout.cardWidth) * previewScale;
  const previewCardHeightPx = mmToPx(layout.cardHeight) * previewScale;
  const previewMarginXPx = mmToPx(layout.marginX) * previewScale;
  const previewMarginYPx = mmToPx(layout.marginY) * previewScale;
  const previewGapXPx = mmToPx(layout.gapX) * previewScale;
  const previewGapYPx = mmToPx(layout.gapY) * previewScale;

  const handlePreviewPageChange = (direction: -1 | 1) => {
    setPreviewPageIndex((prev) => {
      if (totalPreviewPages <= 0) {
        return 0;
      }
      const next = prev + direction;
      return Math.max(0, Math.min(totalPreviewPages - 1, next));
    });
  };

  return (
    <div className={cn("space-y-6 py-4", className)}>
      {/* Print Type */}
      <div className="space-y-3">
        <Label>Jenis Dokumen</Label>
        <RadioGroup
          value={printType}
          onValueChange={(value) => {
            setPrintType(value as PrintType);
            resetPreview();
          }}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="luggage_card" id="luggage_card" />
            <Label htmlFor="luggage_card" className="font-normal">
              Kartu Barang
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="ticket" id="ticket" />
            <Label htmlFor="ticket" className="font-normal">
              Tiket Perjalanan
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="student-name-filter">Filter Nama</Label>
          <Input
            id="student-name-filter"
            value={nameFilter}
            onChange={(event) => {
              setNameFilter(event.target.value);
              resetPreview();
            }}
            placeholder="Cari nama peserta"
          />
        </div>

        <div className="space-y-2">
          <Label>Filter Gender</Label>
          <Select
            value={genderFilter}
            onValueChange={(value: "all" | "Laki-laki" | "Perempuan") => {
              setGenderFilter(value);
              resetPreview();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="Laki-laki">Laki-laki</SelectItem>
              <SelectItem value="Perempuan">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Filter Korda</Label>
          <Select value={kordaFilter} onValueChange={(v) => { setKordaFilter(v); resetPreview(); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {kordas.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Filter Drop Point</Label>
          <Select value={dropPointFilter} onValueChange={(v) => { setDropPointFilter(v); resetPreview(); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {dropPoints.map((dp) => (
                <SelectItem key={dp.id} value={dp.id}>
                  {dp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Paper Size */}
      <div className="space-y-2">
        <Label>Ukuran Kertas</Label>
        <Select value={paperSize} onValueChange={(v: PaperSize) => { setPaperSize(v); resetPreview(); }}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
            <SelectItem value="F4">F4 (215 x 330 mm)</SelectItem>
            <SelectItem value="A3">A3 (297 x 420 mm)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      {showPreview && previewData && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                Preview siap: {previewData.length} item
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Layout: {layout.columns} kolom x {layout.rows} baris per halaman
              </p>
            </div>
            {totalPreviewPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handlePreviewPageChange(-1)}
                  disabled={currentPreviewPage <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-xs font-medium text-muted-foreground">
                  Halaman {currentPreviewPage + 1} / {totalPreviewPages}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handlePreviewPageChange(1)}
                  disabled={currentPreviewPage >= totalPreviewPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div
            ref={previewViewportRef}
            className="relative h-[70vh] min-h-[320px] max-h-[860px] overflow-auto rounded-md border bg-muted/40 p-3"
          >
            <div
              className="relative mx-auto border border-slate-200 bg-white shadow-sm"
              style={{
                width: scaledPaperWidthPx,
                height: scaledPaperHeightPx,
              }}
            >
              {currentPreviewItems.map((item, index) => {
                const row = Math.floor(index / layout.columns);
                const col = index % layout.columns;
                const left =
                  previewMarginXPx + col * (previewCardWidthPx + previewGapXPx);
                const top =
                  previewMarginYPx + row * (previewCardHeightPx + previewGapYPx);

                return (
                  <div
                    key={`${item.id}-${index}`}
                    className="absolute overflow-hidden"
                    style={{
                      left,
                      top,
                      width: previewCardWidthPx,
                      height: previewCardHeightPx,
                    }}
                  >
                    {printType === "luggage_card" ? (
                      <PreviewLuggageCard item={item} />
                    ) : (
                      <PreviewTicketCard item={item} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {showCloseButton && (
          <Button variant="outline" onClick={() => onClose?.()}>
            Batal
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handlePreview}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </>
          )}
        </Button>
        <Button
          onClick={handleGeneratePDF}
          disabled={!showPreview || loading}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Generate PDF
        </Button>
      </div>
    </div>
  );
}

type PdfRgb = [number, number, number];
type PdfFontStyle = "normal" | "bold" | "italic" | "bolditalic";

interface FittedTextResult {
  text: string;
  fontSize: number;
}

interface FittedMultilineResult {
  lines: string[];
  fontSize: number;
}

interface PdfKordaPalette {
  header: PdfRgb;
  bg: PdfRgb;
  border: PdfRgb;
  text: PdfRgb;
}

interface HexKordaPalette {
  header: string;
  bg: string;
  border: string;
  text: string;
}

const TAILWIND_COLOR_HEX: Record<string, string> = {
  "red-50": "#fef2f2",
  "red-400": "#f87171",
  "red-500": "#ef4444",
  "red-800": "#991b1b",
  "red-900": "#7f1d1d",
  "blue-50": "#eff6ff",
  "blue-400": "#60a5fa",
  "blue-500": "#3b82f6",
  "blue-800": "#1e40af",
  "blue-900": "#1e3a8a",
  "emerald-50": "#ecfdf5",
  "emerald-400": "#34d399",
  "emerald-500": "#10b981",
  "emerald-800": "#065f46",
  "emerald-900": "#064e3b",
  "purple-50": "#faf5ff",
  "purple-400": "#c084fc",
  "purple-500": "#a855f7",
  "purple-800": "#6b21a8",
  "purple-900": "#581c87",
  "amber-50": "#fffbeb",
  "amber-400": "#fbbf24",
  "amber-500": "#f59e0b",
  "amber-800": "#92400e",
  "amber-900": "#78350f",
  "teal-50": "#f0fdfa",
  "teal-400": "#2dd4bf",
  "teal-500": "#14b8a6",
  "teal-800": "#115e59",
  "teal-900": "#134e4a",
  "pink-50": "#fdf2f8",
  "pink-400": "#f472b6",
  "pink-500": "#ec4899",
  "pink-800": "#9d174d",
  "pink-900": "#831843",
  "indigo-50": "#eef2ff",
  "indigo-400": "#818cf8",
  "indigo-500": "#6366f1",
  "indigo-800": "#3730a3",
  "indigo-900": "#312e81",
  "orange-50": "#fff7ed",
  "orange-400": "#fb923c",
  "orange-500": "#f97316",
  "orange-800": "#9a3412",
  "orange-900": "#7c2d12",
  "cyan-50": "#ecfeff",
  "cyan-400": "#22d3ee",
  "cyan-500": "#06b6d4",
  "cyan-800": "#155e75",
  "cyan-900": "#164e63",
  "fuchsia-50": "#fdf4ff",
  "fuchsia-400": "#e879f9",
  "fuchsia-500": "#d946ef",
  "fuchsia-800": "#86198f",
  "fuchsia-900": "#701a75",
  "lime-50": "#f7fee7",
  "lime-400": "#a3e635",
  "lime-500": "#84cc16",
  "lime-800": "#3f6212",
  "lime-900": "#365314",
  "yellow-50": "#fefce8",
  "yellow-500": "#eab308",
  "rose-50": "#fff1f2",
  "rose-500": "#f43f5e",
};

const TAILWIND_COLOR_KEYS = Object.keys(TAILWIND_COLOR_HEX).sort(
  (a, b) => b.length - a.length,
);

function normalizeText(value: string | null | undefined): string {
  const normalized = value?.toString().trim();
  return normalized && normalized.length > 0 ? normalized : "-";
}

function buildPagesByKorda(
  data: PrintDataItem[],
  cardsPerPage: number,
): PrintDataItem[][] {
  const sorted = [...data].sort((a, b) => {
    const kordaCompare = normalizeText(a.kordaName).localeCompare(
      normalizeText(b.kordaName),
      "id",
      { sensitivity: "base" },
    );
    if (kordaCompare !== 0) {
      return kordaCompare;
    }

    return normalizeText(a.studentName).localeCompare(
      normalizeText(b.studentName),
      "id",
      { sensitivity: "base" },
    );
  });

  const grouped = new Map<string, PrintDataItem[]>();
  sorted.forEach((item) => {
    const key = normalizeText(item.kordaName);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(item);
  });

  const pages: PrintDataItem[][] = [];
  grouped.forEach((items) => {
    for (let index = 0; index < items.length; index += cardsPerPage) {
      pages.push(items.slice(index, index + cardsPerPage));
    }
  });

  return pages;
}

function truncatePreviewText(
  value: string | null | undefined,
  maxChars: number,
): string {
  const text = normalizeText(value);
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(1, maxChars - 3)).trimEnd()}...`;
}

function PreviewLuggageCard({ item }: { item: PrintDataItem }) {
  const palette = getHexPalette(item.kordaName);
  const gender = normalizeText(item.studentGender).toUpperCase();
  const genderLabel =
    gender === "P" || gender === "PUTRI" || gender === "PEREMPUAN"
      ? "PUTRI"
      : "PUTRA";
  const kordaText = truncatePreviewText(item.kordaName, 16).toUpperCase();
  const studentName = truncatePreviewText(item.studentName, 30).toUpperCase();
  const studentNis = truncatePreviewText(item.studentNis, 20);
  const parentPhone = truncatePreviewText(item.parrentPhone, 24);
  const dropPoint = truncatePreviewText(item.dropPointName, 20);
  const busLabel = truncatePreviewText(item.busLabel, 20);
  const busBadgeWidth = Math.max(
    48,
    Math.min(420, busLabel.length * 15 + 24),
  );

  return (
    <svg
      viewBox="0 0 980 530"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Preview kartu barang ${studentName}`}
    >
      <rect x="1" y="1" width="978" height="528" fill="#ffffff" stroke={palette.border} strokeWidth="2" />
      <rect x="1" y="1" width="978" height="118" fill={palette.header} />
      <rect x="1" y="119" width="978" height="7" fill={palette.border} />
      <rect x="1" y="126" width="978" height="93" fill={palette.bg} />
      <line x1="1" y1="219" x2="979" y2="219" stroke="#d1d5db" strokeWidth="1.4" />
      <line x1="490" y1="219" x2="490" y2="529" stroke="#e5e7eb" strokeWidth="1.4" />

      <text x="490" y="43" fill="#ffffff" textAnchor="middle" fontSize="34" fontWeight="700" letterSpacing="4">
        {`KARTU BARANG ${genderLabel}`}
      </text>
      <text x="490" y="96" fill="#ffffff" textAnchor="middle" fontSize="61" fontWeight="900">
        {kordaText}
      </text>

      <text x="490" y="190" fill="#111827" textAnchor="middle" fontSize="49" fontWeight="700">
        {studentName}
      </text>

      <text x="28" y="255" fill="#6b7280" fontSize="31" fontWeight="700">NIS</text>
      <text x="28" y="297" fill="#374151" fontSize="38" fontWeight="500">{studentNis}</text>
      <text x="28" y="412" fill="#6b7280" fontSize="31" fontWeight="700">NO HP ORTU</text>
      <text x="28" y="454" fill="#1f2937" fontSize="31" fontWeight="700">{parentPhone}</text>

      <text x="518" y="255" fill="#6b7280" fontSize="31" fontWeight="700">DROP POINT</text>
      <text x="518" y="297" fill="#1f2937" fontSize="38" fontWeight="700">{dropPoint}</text>
      <text x="518" y="412" fill="#6b7280" fontSize="31" fontWeight="700">BUS</text>
      <rect x="518" y="420" width={busBadgeWidth} height="44" fill={palette.header} />
      <text
        x={518 + busBadgeWidth / 2}
        y="451"
        fill="#ffffff"
        textAnchor="middle"
        fontSize="31"
        fontWeight="700"
      >
        {busLabel}
      </text>
    </svg>
  );
}

function PreviewTicketCard({ item }: { item: PrintDataItem }) {
  const palette = getHexPalette(item.kordaName);
  const studentName = truncatePreviewText(item.studentName, 28);
  const dropPoint = truncatePreviewText(item.dropPointName, 18);
  const korda = truncatePreviewText(item.kordaName, 18);
  const busLabel = truncatePreviewText(item.busLabel, 16);
  const busBadgeWidth = Math.max(
    40,
    Math.min(430, busLabel.length * 13 + 24),
  );

  return (
    <svg
      viewBox="0 0 980 200"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Preview tiket perjalanan ${studentName}`}
    >
      <rect x="1" y="1" width="978" height="198" fill="#ffffff" stroke={palette.border} strokeWidth="2" />
      <rect x="1" y="1" width="978" height="56" fill={palette.header} />
      <rect x="1" y="57" width="978" height="142" fill={palette.bg} />
      <line x1="1" y1="57" x2="979" y2="57" stroke={palette.border} strokeWidth="1.4" />
      <line x1="490" y1="57" x2="490" y2="199" stroke="#d1d5db" strokeWidth="1.4" />

      <text x="490" y="40" fill="#ffffff" textAnchor="middle" fontSize="40" fontWeight="700">
        TIKET PERJALANAN
      </text>

      <text x="20" y="85" fill="#6b7280" fontSize="23" fontWeight="700">NAMA PESERTA</text>
      <text x="20" y="116" fill="#111827" fontSize="34" fontWeight="700">{studentName}</text>
      <text x="20" y="154" fill="#6b7280" fontSize="23" fontWeight="700">DROP POINT</text>
      <text x="20" y="185" fill="#374151" fontSize="32" fontWeight="500">{dropPoint}</text>

      <text x="506" y="85" fill="#6b7280" fontSize="23" fontWeight="700">KORDA</text>
      <text x="506" y="116" fill="#1f2937" fontSize="34" fontWeight="700">{korda}</text>
      <text x="506" y="154" fill="#6b7280" fontSize="23" fontWeight="700">BUS</text>
      <rect x="506" y="158" width={busBadgeWidth} height="31" fill={palette.header} />
      <text
        x={506 + busBadgeWidth / 2}
        y="181"
        fill="#ffffff"
        textAnchor="middle"
        fontSize="23"
        fontWeight="700"
      >
        {busLabel}
      </text>
    </svg>
  );
}

function resolveTailwindHex(cls: string, fallback: string): string {
  for (const key of TAILWIND_COLOR_KEYS) {
    if (cls.includes(key)) {
      return TAILWIND_COLOR_HEX[key];
    }
  }
  return fallback;
}

function getHexPalette(kordaName: string): HexKordaPalette {
  const kordaColor = getKordaColor(kordaName);
  const gradientStartMatch = kordaColor.headerBg.match(/from-[a-z]+-\d+/);
  const headerSource = gradientStartMatch?.[0] ?? kordaColor.headerBg;
  const header = resolveTailwindHex(headerSource, "#3b82f6");
  const bg = resolveTailwindHex(kordaColor.bg, "#eff6ff");
  const border = resolveTailwindHex(kordaColor.border, "#3b82f6");
  const text = resolveTailwindHex(kordaColor.text, "#1e40af");

  return { header, bg, border, text };
}

function hexToRgb(hex: string): PdfRgb {
  const cleaned = hex.replace("#", "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : cleaned;
  const parsed = Number.parseInt(normalized, 16);
  if (Number.isNaN(parsed)) {
    return [59, 130, 246];
  }
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function getPdfPalette(kordaName: string): PdfKordaPalette {
  const hexPalette = getHexPalette(kordaName);

  return {
    header: hexToRgb(hexPalette.header),
    bg: hexToRgb(hexPalette.bg),
    border: hexToRgb(hexPalette.border),
    text: hexToRgb(hexPalette.text),
  };
}

function fitSingleLineText(
  pdf: jsPDF,
  value: string | null | undefined,
  maxWidth: number,
  startSize: number,
  minSize: number,
  style: PdfFontStyle,
): FittedTextResult {
  const text = normalizeText(value);
  let fontSize = startSize;
  pdf.setFont("helvetica", style);
  pdf.setFontSize(fontSize);

  while (fontSize > minSize && pdf.getTextWidth(text) > maxWidth) {
    fontSize -= 0.3;
    pdf.setFontSize(fontSize);
  }

  if (pdf.getTextWidth(text) <= maxWidth) {
    return { text, fontSize };
  }

  let shortened = text;
  while (
    shortened.length > 1 &&
    pdf.getTextWidth(`${shortened}...`) > maxWidth
  ) {
    shortened = shortened.slice(0, -1);
  }

  return {
    text: `${shortened}...`,
    fontSize: minSize,
  };
}

function fitMultilineText(
  pdf: jsPDF,
  value: string | null | undefined,
  maxWidth: number,
  maxLines: number,
  startSize: number,
  minSize: number,
  style: PdfFontStyle,
): FittedMultilineResult {
  const text = normalizeText(value);
  let fontSize = startSize;
  let lines: string[] = [text];

  while (fontSize >= minSize) {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(fontSize);
    lines = pdf.splitTextToSize(text, maxWidth) as string[];
    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
    fontSize -= 0.3;
  }

  pdf.setFont("helvetica", style);
  pdf.setFontSize(minSize);
  lines = pdf.splitTextToSize(text, maxWidth) as string[];
  if (lines.length <= maxLines) {
    return { lines, fontSize: minSize };
  }

  const clampedLines = lines.slice(0, maxLines);
  const lastLine = fitSingleLineText(
    pdf,
    `${clampedLines[maxLines - 1]}...`,
    maxWidth,
    minSize,
    minSize,
    style,
  );
  clampedLines[maxLines - 1] = lastLine.text;

  return {
    lines: clampedLines,
    fontSize: minSize,
  };
}

function drawLuggageCardToPdf(
  pdf: jsPDF,
  item: PrintDataItem,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const palette = getPdfPalette(item.kordaName);
  const gender = normalizeText(item.studentGender).toUpperCase();
  const genderLabel =
    gender === "P" || gender === "PUTRI" || gender === "PEREMPUAN"
      ? "PUTRI"
      : "PUTRA";

  const headerHeight = 11.8;
  const dividerHeight = 0.7;
  const nameHeight = 9.4;
  const contentTop = y + headerHeight + dividerHeight + nameHeight;
  const middleX = x + width / 2;
  const columnWidth = width / 2 - 4.8;
  const leftColumnX = x + 2.8;
  const rightColumnX = middleX + 2;
  const labelColor: PdfRgb = [107, 114, 128];

  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, width, height, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y, width, height, "S");

  pdf.setFillColor(...palette.header);
  pdf.rect(x, y, width, headerHeight, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.1);
  pdf.text(`KARTU BARANG ${genderLabel}`, x + width / 2, y + 4, {
    align: "center",
  });

  const kordaHeader = fitSingleLineText(
    pdf,
    normalizeText(item.kordaName).toUpperCase(),
    width - 8,
    14.2,
    9.4,
    "bold",
  );
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(kordaHeader.fontSize);
  pdf.text(kordaHeader.text, x + width / 2, y + 9.1, { align: "center" });

  pdf.setFillColor(...palette.border);
  pdf.rect(x, y + headerHeight, width, dividerHeight, "F");

  pdf.setFillColor(...palette.bg);
  pdf.rect(x, y + headerHeight + dividerHeight, width, nameHeight, "F");
  pdf.setDrawColor(209, 213, 219);
  pdf.setLineWidth(0.15);
  pdf.line(
    x,
    y + headerHeight + dividerHeight + nameHeight,
    x + width,
    y + headerHeight + dividerHeight + nameHeight,
  );

  const studentName = fitSingleLineText(
    pdf,
    normalizeText(item.studentName).toUpperCase(),
    width - 8,
    11.6,
    8.4,
    "bold",
  );
  pdf.setTextColor(17, 24, 39);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(studentName.fontSize);
  pdf.text(
    studentName.text,
    x + width / 2,
    y + headerHeight + dividerHeight + 6.3,
    {
      align: "center",
    },
  );

  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.15);
  pdf.line(middleX, contentTop, middleX, y + height);

  const topLabelY = contentTop + 3.2;
  const topValueY = contentTop + 6.8;
  const bottomLabelY = contentTop + 14.6;
  const bottomValueY = contentTop + 18.2;

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("NIS", leftColumnX, topLabelY);

  const nisValue = fitSingleLineText(
    pdf,
    item.studentNis,
    columnWidth,
    9.2,
    7.2,
    "normal",
  );
  pdf.setTextColor(55, 65, 81);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(nisValue.fontSize);
  pdf.text(nisValue.text, leftColumnX, topValueY);

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("NO HP ORTU", leftColumnX, bottomLabelY);

  const parentPhoneValue = fitMultilineText(
    pdf,
    item.parrentPhone,
    columnWidth,
    2,
    8.2,
    6.6,
    "normal",
  );
  pdf.setTextColor(31, 41, 55);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(parentPhoneValue.fontSize);
  const addressLineHeight = Math.max(2.8, parentPhoneValue.fontSize * 0.38);
  parentPhoneValue.lines.forEach((line, index) => {
    pdf.text(line, leftColumnX, bottomValueY + index * addressLineHeight);
  });

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("DROP POINT", rightColumnX, topLabelY);

  const dropPointValue = fitMultilineText(
    pdf,
    item.dropPointName,
    columnWidth,
    2,
    8.8,
    7.2,
    "bold",
  );
  pdf.setTextColor(31, 41, 55);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(dropPointValue.fontSize);
  const dropPointLineHeight = Math.max(3.1, dropPointValue.fontSize * 0.38);
  dropPointValue.lines.forEach((line, index) => {
    pdf.text(line, rightColumnX, topValueY + index * dropPointLineHeight);
  });

  const busLabelY = bottomLabelY;
  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("BUS", rightColumnX, busLabelY);

  const busValue = fitSingleLineText(
    pdf,
    item.busLabel,
    columnWidth - 2.2,
    8.8,
    7.2,
    "bold",
  );
  const badgePaddingX = 1.2;
  const badgeHeight = 4.4;
  const badgeWidth = Math.min(
    columnWidth,
    pdf.getTextWidth(busValue.text) + badgePaddingX * 2,
  );
  const badgeY = bottomValueY - 3.1;

  pdf.setFillColor(...palette.header);
  pdf.roundedRect(rightColumnX, badgeY, badgeWidth, badgeHeight, 0.8, 0.8, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(busValue.fontSize);
  pdf.text(busValue.text, rightColumnX + badgeWidth / 2, badgeY + 3, {
    align: "center",
  });
}

function drawTicketToPdf(
  pdf: jsPDF,
  item: PrintDataItem,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const palette = getPdfPalette(item.kordaName);
  const labelColor: PdfRgb = [107, 114, 128];
  const headerHeight = 5.6;
  const bodyTop = y + headerHeight;
  const bodyHeight = height - headerHeight;
  const splitX = x + width / 2;
  const leftColumnX = x + 1.7;
  const rightColumnX = splitX + 1.5;
  const columnWidth = width / 2 - 3.2;

  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, width, height, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.rect(x, y, width, height, "S");

  pdf.setFillColor(...palette.header);
  pdf.rect(x, y, width, headerHeight, "F");

  const headerTitle = fitSingleLineText(
    pdf,
    "TIKET PERJALANAN",
    width - 6,
    7.4,
    6,
    "bold",
  );
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(headerTitle.fontSize);
  pdf.text(headerTitle.text, x + width / 2, y + 3.9, { align: "center" });

  pdf.setFillColor(...palette.bg);
  pdf.rect(x, bodyTop, width, bodyHeight, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.15);
  pdf.line(x, bodyTop, x + width, bodyTop);

  pdf.setDrawColor(209, 213, 219);
  pdf.line(splitX, bodyTop, splitX, y + height);

  const topLabelY = bodyTop + 2.1;
  const topValueY = bodyTop + 4.6;
  const bottomLabelY = bodyTop + 8.8;
  const bottomValueY = bodyTop + 11.3;

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.8);
  pdf.text("NAMA PESERTA", leftColumnX, topLabelY);

  const studentName = fitSingleLineText(
    pdf,
    item.studentName,
    columnWidth,
    7.6,
    6.1,
    "bold",
  );
  pdf.setTextColor(17, 24, 39);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(studentName.fontSize);
  pdf.text(studentName.text, leftColumnX, topValueY);

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.8);
  pdf.text("DROP POINT", leftColumnX, bottomLabelY);

  const dropPoint = fitSingleLineText(
    pdf,
    item.dropPointName,
    columnWidth,
    7.1,
    5.9,
    "normal",
  );
  pdf.setTextColor(55, 65, 81);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(dropPoint.fontSize);
  pdf.text(dropPoint.text, leftColumnX, bottomValueY);

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.8);
  pdf.text("KORDA", rightColumnX, topLabelY);

  const korda = fitSingleLineText(
    pdf,
    item.kordaName,
    columnWidth,
    7.1,
    5.9,
    "bold",
  );
  pdf.setTextColor(31, 41, 55);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(korda.fontSize);
  pdf.text(korda.text, rightColumnX, topValueY);

  pdf.setTextColor(...labelColor);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.8);
  pdf.text("BUS", rightColumnX, bottomLabelY);

  const busValue = fitSingleLineText(
    pdf,
    item.busLabel,
    columnWidth - 2,
    7,
    5.9,
    "bold",
  );
  const badgeHeight = 3;
  const badgeWidth = Math.min(columnWidth, pdf.getTextWidth(busValue.text) + 1.5);
  const badgeY = bodyTop + 9.2;

  pdf.setFillColor(...palette.header);
  pdf.rect(rightColumnX, badgeY, badgeWidth, badgeHeight, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(busValue.fontSize);
  pdf.text(busValue.text, rightColumnX + badgeWidth / 2, badgeY + 2.05, {
    align: "center",
  });
}
