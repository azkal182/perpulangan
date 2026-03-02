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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  FileDown,
  Eye,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
  const [journeyFilter, setJourneyFilter] = useState<
    "all" | "outbound" | "return"
  >("all");
  const [printType, setPrintType] = useState<PrintType>("luggage_card");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [genderFilter, setGenderFilter] = useState<
    "all" | "Laki-laki" | "Perempuan"
  >("all");
  const [nameFilter, setNameFilter] = useState("");
  const [kordaFilters, setKordaFilters] = useState<string[]>([]);
  const [dropPointFilter, setDropPointFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
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

  const selectedKordaNames = kordas
    .filter((korda) => kordaFilters.includes(korda.id))
    .map((korda) => korda.name);
  const kordaFilterLabel =
    selectedKordaNames.length === 0
      ? "Semua"
      : selectedKordaNames.length === 1
        ? selectedKordaNames[0]
        : `${selectedKordaNames.length} korda dipilih`;

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
        journeyType: journeyFilter === "all" ? undefined : journeyFilter,
        gender: genderFilter === "all" ? undefined : genderFilter,
        studentName: nameFilter.trim() || undefined,
        kordaIds: kordaFilters.length > 0 ? kordaFilters : undefined,
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

    setGeneratingPdf(true);
    toast.loading("Generating PDF...");

    try {
      // Beri kesempatan UI render state loading sebelum proses PDF berjalan.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

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
      setGeneratingPdf(false);
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          <Label>Filter Perjalanan</Label>
          <Select
            value={journeyFilter}
            onValueChange={(value: "all" | "outbound" | "return") => {
              setJourneyFilter(value);
              resetPreview();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua perjalanan</SelectItem>
              <SelectItem value="outbound">Keberangkatan</SelectItem>
              <SelectItem value="return">Kepulangan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Filter Korda</Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
              >
                <span className="truncate text-left">{kordaFilterLabel}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-80 w-[--radix-dropdown-menu-trigger-width] overflow-y-auto"
            >
              <DropdownMenuCheckboxItem
                checked={kordaFilters.length === 0}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={() => {
                  setKordaFilters([]);
                  resetPreview();
                }}
              >
                Semua
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {kordas.map((korda) => (
                <DropdownMenuCheckboxItem
                  key={korda.id}
                  checked={kordaFilters.includes(korda.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => {
                    setKordaFilters((prev) => {
                      if (checked === true) {
                        return prev.includes(korda.id) ? prev : [...prev, korda.id];
                      }
                      return prev.filter((id) => id !== korda.id);
                    });
                    resetPreview();
                  }}
                >
                  {korda.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <Button
            variant="outline"
            onClick={() => onClose?.()}
            disabled={generatingPdf}
          >
            Batal
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handlePreview}
          disabled={loading || generatingPdf}
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
          disabled={!showPreview || loading || generatingPdf}
        >
          {generatingPdf ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyiapkan PDF...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Generate PDF
            </>
          )}
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
  "yellow-400": "#facc15",
  "yellow-500": "#eab308",
  "yellow-800": "#854d0e",
  "yellow-900": "#713f12",
  "rose-50": "#fff1f2",
  "rose-400": "#fb7185",
  "rose-500": "#f43f5e",
  "rose-800": "#9f1239",
  "rose-900": "#881337",
  "green-50": "#f0fdf4",
  "green-400": "#4ade80",
  "green-500": "#22c55e",
  "green-800": "#166534",
  "green-900": "#14532d",
  "sky-50": "#f0f9ff",
  "sky-400": "#38bdf8",
  "sky-500": "#0ea5e9",
  "sky-800": "#075985",
  "sky-900": "#0c4a6e",
  "violet-50": "#f5f3ff",
  "violet-400": "#a78bfa",
  "violet-500": "#8b5cf6",
  "violet-800": "#5b21b6",
  "violet-900": "#4c1d95",
  "slate-50": "#f8fafc",
  "slate-400": "#94a3b8",
  "slate-500": "#64748b",
  "slate-800": "#1e293b",
  "slate-900": "#0f172a",
};

const TAILWIND_COLOR_KEYS = Object.keys(TAILWIND_COLOR_HEX).sort(
  (a, b) => b.length - a.length,
);

function normalizeText(value: string | null | undefined): string {
  const normalized = value?.toString().trim();
  return normalized && normalized.length > 0 ? normalized : "-";
}

function normalizeBusSortValue(value: string | null | undefined): string {
  const normalized = value?.toString().trim();
  return normalized && normalized !== "-" ? normalized : "\uffff";
}

function isPutriGender(value: string | null | undefined): boolean {
  const gender = normalizeText(value).toUpperCase();
  return gender === "P" || gender === "PUTRI" || gender === "PEREMPUAN";
}

function getGenderSortRank(value: string | null | undefined): number {
  const gender = normalizeText(value).toUpperCase();
  if (gender === "L" || gender === "PUTRA" || gender === "LAKI-LAKI") {
    return 0;
  }
  if (gender === "P" || gender === "PUTRI" || gender === "PEREMPUAN") {
    return 1;
  }
  return 2;
}

function buildPagesByKorda(
  data: PrintDataItem[],
  cardsPerPage: number,
): PrintDataItem[][] {
  const grouped = new Map<string, PrintDataItem[]>();
  data.forEach((item) => {
    const key = normalizeText(item.kordaName);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(item);
  });

  const sortedGroupEntries = Array.from(grouped.entries()).sort(([left], [right]) =>
    left.localeCompare(right, "id", { sensitivity: "base" }),
  );

  const pages: PrintDataItem[][] = [];
  sortedGroupEntries.forEach(([, items]) => {
    const sortedItems = [...items].sort((a, b) => {
      const busCompare = normalizeBusSortValue(a.busLabel).localeCompare(
        normalizeBusSortValue(b.busLabel),
        "id",
        { sensitivity: "base", numeric: true },
      );
      if (busCompare !== 0) {
        return busCompare;
      }

      const nameCompare = normalizeText(a.studentName).localeCompare(
        normalizeText(b.studentName),
        "id",
        { sensitivity: "base", numeric: true },
      );
      if (nameCompare !== 0) {
        return nameCompare;
      }

      return (
        getGenderSortRank(a.studentGender) - getGenderSortRank(b.studentGender)
      );
    });

    for (let index = 0; index < sortedItems.length; index += cardsPerPage) {
      pages.push(sortedItems.slice(index, index + cardsPerPage));
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
  const isPutri = isPutriGender(item.studentGender);
  const genderLabel = isPutri ? "PUTRI" : "PUTRA";
  const floralScaleX = 980 / 800;
  const floralScaleY = 530 / 600;
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
      {isPutri && (
        <g opacity="0.2">
          <defs>
            <g id="wm-flower">
              <ellipse cx="0" cy="-22" rx="9" ry="18" fill={palette.header} />
              <ellipse cx="0" cy="-22" rx="9" ry="18" fill={palette.header} transform="rotate(60)" />
              <ellipse cx="0" cy="-22" rx="9" ry="18" fill={palette.header} transform="rotate(120)" />
              <ellipse cx="0" cy="-22" rx="9" ry="18" fill={palette.header} transform="rotate(180)" />
              <ellipse cx="0" cy="-22" rx="9" ry="18" fill={palette.header} transform="rotate(240)" />
              <ellipse cx="0" cy="-22" rx="9" ry="18" fill={palette.header} transform="rotate(300)" />
              <circle cx="0" cy="0" r="8" fill={palette.border} />
              <circle cx="0" cy="0" r="4" fill={palette.text} />
            </g>
            <g id="wm-flower-lg">
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(45)" />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(90)" />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(135)" />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(180)" />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(225)" />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(270)" />
              <ellipse cx="0" cy="-30" rx="12" ry="26" fill={palette.header} transform="rotate(315)" />
              <circle cx="0" cy="0" r="12" fill={palette.border} />
              <circle cx="0" cy="0" r="6" fill={palette.text} />
            </g>
            <g id="wm-leaf">
              <ellipse cx="0" cy="-12" rx="5" ry="12" fill={palette.header} />
            </g>
            <g id="wm-bud">
              <ellipse cx="0" cy="-10" rx="6" ry="12" fill={palette.header} />
              <line x1="0" y1="2" x2="0" y2="18" stroke={palette.text} strokeWidth="2" />
              <ellipse
                cx="-5"
                cy="10"
                rx="4"
                ry="8"
                fill={palette.header}
                transform="rotate(-30 -5 10)"
              />
              <ellipse
                cx="5"
                cy="10"
                rx="4"
                ry="8"
                fill={palette.header}
                transform="rotate(30 5 10)"
              />
            </g>
          </defs>

          <g transform={`scale(${floralScaleX} ${floralScaleY})`}>
            <g opacity="0.26">
              <path d="M 20 180 Q 60 120 90 50" stroke={palette.text} strokeWidth="3" fill="none" />
              <path d="M 20 180 Q 0 120 30 60" stroke={palette.text} strokeWidth="2.5" fill="none" />
              <path d="M 40 160 Q 80 140 120 100" stroke={palette.text} strokeWidth="2" fill="none" />
              <use href="#wm-leaf" transform="translate(55,115) rotate(-40)" />
              <use href="#wm-leaf" transform="translate(72,88) rotate(-20)" />
              <use href="#wm-leaf" transform="translate(28,130) rotate(30)" />
              <use href="#wm-leaf" transform="translate(85,130) rotate(-60)" />
              <use href="#wm-flower-lg" transform="translate(90,50)" />
              <use href="#wm-flower" transform="translate(30,62) scale(0.8)" />
              <use href="#wm-flower" transform="translate(118,100) scale(0.7)" />
              <use href="#wm-bud" transform="translate(65,72) scale(0.75)" />
              <use href="#wm-bud" transform="translate(48,92) scale(0.6)" />
            </g>

            <g transform="translate(800,0) scale(-1,1)" opacity="0.26">
              <path d="M 20 180 Q 60 120 90 50" stroke={palette.text} strokeWidth="3" fill="none" />
              <path d="M 20 180 Q 0 120 30 60" stroke={palette.text} strokeWidth="2.5" fill="none" />
              <path d="M 40 160 Q 80 140 120 100" stroke={palette.text} strokeWidth="2" fill="none" />
              <use href="#wm-leaf" transform="translate(55,115) rotate(-40)" />
              <use href="#wm-leaf" transform="translate(72,88) rotate(-20)" />
              <use href="#wm-leaf" transform="translate(28,130) rotate(30)" />
              <use href="#wm-leaf" transform="translate(85,130) rotate(-60)" />
              <use href="#wm-flower-lg" transform="translate(90,50)" />
              <use href="#wm-flower" transform="translate(30,62) scale(0.8)" />
              <use href="#wm-flower" transform="translate(118,100) scale(0.7)" />
              <use href="#wm-bud" transform="translate(65,72) scale(0.75)" />
              <use href="#wm-bud" transform="translate(48,92) scale(0.6)" />
            </g>

            <g transform="translate(0,600) scale(1,-1)" opacity="0.26">
              <path d="M 20 180 Q 60 120 90 50" stroke={palette.text} strokeWidth="3" fill="none" />
              <path d="M 20 180 Q 0 120 30 60" stroke={palette.text} strokeWidth="2.5" fill="none" />
              <path d="M 40 160 Q 80 140 120 100" stroke={palette.text} strokeWidth="2" fill="none" />
              <use href="#wm-leaf" transform="translate(55,115) rotate(-40)" />
              <use href="#wm-leaf" transform="translate(72,88) rotate(-20)" />
              <use href="#wm-leaf" transform="translate(28,130) rotate(30)" />
              <use href="#wm-leaf" transform="translate(85,130) rotate(-60)" />
              <use href="#wm-flower-lg" transform="translate(90,50)" />
              <use href="#wm-flower" transform="translate(30,62) scale(0.8)" />
              <use href="#wm-flower" transform="translate(118,100) scale(0.7)" />
              <use href="#wm-bud" transform="translate(65,72) scale(0.75)" />
              <use href="#wm-bud" transform="translate(48,92) scale(0.6)" />
            </g>

            <g transform="translate(800,600) scale(-1,-1)" opacity="0.26">
              <path d="M 20 180 Q 60 120 90 50" stroke={palette.text} strokeWidth="3" fill="none" />
              <path d="M 20 180 Q 0 120 30 60" stroke={palette.text} strokeWidth="2.5" fill="none" />
              <path d="M 40 160 Q 80 140 120 100" stroke={palette.text} strokeWidth="2" fill="none" />
              <use href="#wm-leaf" transform="translate(55,115) rotate(-40)" />
              <use href="#wm-leaf" transform="translate(72,88) rotate(-20)" />
              <use href="#wm-leaf" transform="translate(28,130) rotate(30)" />
              <use href="#wm-leaf" transform="translate(85,130) rotate(-60)" />
              <use href="#wm-flower-lg" transform="translate(90,50)" />
              <use href="#wm-flower" transform="translate(30,62) scale(0.8)" />
              <use href="#wm-flower" transform="translate(118,100) scale(0.7)" />
              <use href="#wm-bud" transform="translate(65,72) scale(0.75)" />
              <use href="#wm-bud" transform="translate(48,92) scale(0.6)" />
            </g>

            <g transform="translate(400, 300)" opacity="0.11">
              <use href="#wm-flower-lg" transform="scale(2.25)" />
              <use href="#wm-flower" transform="translate(90,0) scale(1.2)" />
              <use href="#wm-flower" transform="translate(-90,0) scale(1.2)" />
              <use href="#wm-flower" transform="translate(0,90) scale(1.2)" />
              <use href="#wm-flower" transform="translate(0,-90) scale(1.2)" />
              <use href="#wm-flower" transform="translate(65,65) scale(0.95)" />
              <use href="#wm-flower" transform="translate(-65,65) scale(0.95)" />
              <use href="#wm-flower" transform="translate(65,-65) scale(0.95)" />
              <use href="#wm-flower" transform="translate(-65,-65) scale(0.95)" />
            </g>

            <path
              d="M 140 35 Q 280 18 400 28 Q 520 18 660 35"
              stroke={palette.text}
              strokeWidth="2"
              fill="none"
              opacity="0.18"
            />
            <path
              d="M 140 565 Q 280 582 400 572 Q 520 582 660 565"
              stroke={palette.text}
              strokeWidth="2"
              fill="none"
              opacity="0.18"
            />
          </g>
        </g>
      )}
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

function resolveTailwindHexByKey(
  key: string | null | undefined,
  fallback: string,
): string {
  if (!key) {
    return fallback;
  }
  return TAILWIND_COLOR_HEX[key] ?? fallback;
}

function extractGradientColorKey(
  cls: string,
  direction: "from" | "to",
): string | null {
  const match = cls.match(new RegExp(`${direction}-([a-z-]+-\\d+)`));
  return match?.[1] ?? null;
}

function rgbToHex(color: PdfRgb): string {
  return `#${color
    .map((channel) => {
      const safe = Math.min(255, Math.max(0, Math.round(channel)));
      return safe.toString(16).padStart(2, "0");
    })
    .join("")}`;
}

function blendHexColors(start: string, end: string, ratio: number): string {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  const startRgb = hexToRgb(start);
  const endRgb = hexToRgb(end);
  const blended: PdfRgb = [
    startRgb[0] * (1 - safeRatio) + endRgb[0] * safeRatio,
    startRgb[1] * (1 - safeRatio) + endRgb[1] * safeRatio,
    startRgb[2] * (1 - safeRatio) + endRgb[2] * safeRatio,
  ];
  return rgbToHex(blended);
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function applyToneVariance(
  color: string,
  seed: number,
  bitShift: number,
  maxRatio: number,
  mode: "both" | "lighter" | "darker" = "both",
): string {
  const bucket = (seed >>> bitShift) % 201; // 0..200
  const centeredRatio = ((bucket - 100) / 100) * maxRatio;
  const signedRatio =
    mode === "lighter"
      ? Math.abs(centeredRatio)
      : mode === "darker"
        ? -Math.abs(centeredRatio)
        : centeredRatio;

  if (signedRatio >= 0) {
    return blendHexColors(color, "#ffffff", signedRatio);
  }
  return blendHexColors(color, "#000000", Math.abs(signedRatio));
}

function getHexPalette(kordaName: string): HexKordaPalette {
  const kordaColor = getKordaColor(kordaName);
  const headerFromKey = extractGradientColorKey(kordaColor.headerBg, "from");
  const headerToKey = extractGradientColorKey(kordaColor.headerBg, "to");
  const headerFromHex = resolveTailwindHexByKey(
    headerFromKey,
    resolveTailwindHex(kordaColor.headerBg, "#3b82f6"),
  );
  const headerToHex = resolveTailwindHexByKey(headerToKey, headerFromHex);
  const baseHeader =
    headerFromKey && headerToKey
      ? blendHexColors(headerFromHex, headerToHex, 0.5)
      : headerFromHex;

  const bgFromKey = extractGradientColorKey(kordaColor.bg, "from");
  const bgToKey = extractGradientColorKey(kordaColor.bg, "to");
  const bgFromHex = resolveTailwindHexByKey(
    bgFromKey,
    resolveTailwindHex(kordaColor.bg, "#eff6ff"),
  );
  const bgToHex = resolveTailwindHexByKey(bgToKey, bgFromHex);
  const baseBg =
    bgFromKey && bgToKey ? blendHexColors(bgFromHex, bgToHex, 0.5) : bgFromHex;

  const baseBorder = resolveTailwindHex(kordaColor.border, "#3b82f6");
  const baseText = resolveTailwindHex(kordaColor.text, "#1e40af");
  const seed = hashText(normalizeText(kordaName).toLocaleLowerCase("id-ID"));

  const header = applyToneVariance(baseHeader, seed, 0, 0.12, "both");
  const bg = applyToneVariance(baseBg, seed, 7, 0.08, "lighter");
  const border = applyToneVariance(baseBorder, seed, 13, 0.1, "both");
  const text = applyToneVariance(baseText, seed, 19, 0.08, "darker");

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

function blendWithWhite(color: PdfRgb, ratio: number): PdfRgb {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  return color.map(
    (channel) => Math.round(channel + (255 - channel) * safeRatio),
  ) as PdfRgb;
}

function drawLeafWatermarkShape(
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationDeg: number,
  fillColor: PdfRgb,
  veinColor: PdfRgb,
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cosRad = Math.cos(rad);
  const sinRad = Math.sin(rad);

  const rotatePoint = (x: number, y: number) => ({
    x: centerX + x * cosRad - y * sinRad,
    y: centerY + x * sinRad + y * cosRad,
  });

  const basePoints = [
    rotatePoint(0, -halfHeight),
    rotatePoint(halfWidth * 0.72, -halfHeight * 0.35),
    rotatePoint(halfWidth, 0),
    rotatePoint(halfWidth * 0.72, halfHeight * 0.35),
    rotatePoint(0, halfHeight),
    rotatePoint(-halfWidth * 0.72, halfHeight * 0.35),
    rotatePoint(-halfWidth, 0),
    rotatePoint(-halfWidth * 0.72, -halfHeight * 0.35),
  ];

  pdf.setFillColor(...fillColor);
  pdf.setDrawColor(...fillColor);
  pdf.setLineWidth(0.05);
  pdf.lines(
    basePoints
      .slice(1)
      .map((point, index) => [
        point.x - basePoints[index].x,
        point.y - basePoints[index].y,
      ]),
    basePoints[0].x,
    basePoints[0].y,
    [1, 1],
    "F",
    true,
  );

  const veinTop = rotatePoint(0, -halfHeight * 0.7);
  const veinBottom = rotatePoint(0, halfHeight * 0.7);
  pdf.setDrawColor(...veinColor);
  pdf.setLineWidth(0.12);
  pdf.line(veinTop.x, veinTop.y, veinBottom.x, veinBottom.y);
}

function drawWatermarkPolyline(
  pdf: jsPDF,
  points: Array<{ x: number; y: number }>,
  color: PdfRgb,
  lineWidth: number,
) {
  if (points.length < 2) {
    return;
  }

  pdf.setDrawColor(...color);
  pdf.setLineWidth(lineWidth);
  for (let i = 1; i < points.length; i += 1) {
    pdf.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
  }
}

function drawWatermarkQuadraticCurve(
  pdf: jsPDF,
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  color: PdfRgb,
  lineWidth: number,
) {
  const points: Array<{ x: number; y: number }> = [];
  const segments = 10;
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const oneMinusT = 1 - t;
    points.push({
      x:
        oneMinusT * oneMinusT * start.x +
        2 * oneMinusT * t * control.x +
        t * t * end.x,
      y:
        oneMinusT * oneMinusT * start.y +
        2 * oneMinusT * t * control.y +
        t * t * end.y,
    });
  }
  drawWatermarkPolyline(pdf, points, color, lineWidth);
}

function drawWatermarkFlower(
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  petals: number,
  petalDistance: number,
  petalWidth: number,
  petalHeight: number,
  petalColor: PdfRgb,
  centerColor: PdfRgb,
) {
  for (let index = 0; index < petals; index += 1) {
    const angle = (360 / petals) * index;
    const rad = (angle * Math.PI) / 180;
    const petalX = centerX + Math.cos(rad) * petalDistance;
    const petalY = centerY + Math.sin(rad) * petalDistance;
    drawLeafWatermarkShape(
      pdf,
      petalX,
      petalY,
      petalWidth,
      petalHeight,
      angle,
      petalColor,
      petalColor,
    );
  }

  pdf.setFillColor(...centerColor);
  pdf.circle(centerX, centerY, Math.max(0.25, petalWidth * 0.35), "F");
  pdf.setFillColor(...blendWithWhite(centerColor, 0.2));
  pdf.circle(centerX, centerY, Math.max(0.15, petalWidth * 0.17), "F");
}

function drawWatermarkBud(
  pdf: jsPDF,
  centerX: number,
  centerY: number,
  size: number,
  petalColor: PdfRgb,
  stemColor: PdfRgb,
) {
  drawLeafWatermarkShape(
    pdf,
    centerX,
    centerY - size * 0.2,
    size * 0.7,
    size * 1.15,
    0,
    petalColor,
    petalColor,
  );

  pdf.setDrawColor(...stemColor);
  pdf.setLineWidth(Math.max(0.07, size * 0.05));
  pdf.line(
    centerX,
    centerY + size * 0.12,
    centerX,
    centerY + size * 0.7,
  );

  drawLeafWatermarkShape(
    pdf,
    centerX - size * 0.28,
    centerY + size * 0.45,
    size * 0.35,
    size * 0.55,
    -35,
    petalColor,
    petalColor,
  );
  drawLeafWatermarkShape(
    pdf,
    centerX + size * 0.28,
    centerY + size * 0.45,
    size * 0.35,
    size * 0.55,
    35,
    petalColor,
    petalColor,
  );
}

function createReferenceMapper(
  originX: number,
  originY: number,
  width: number,
  height: number,
  mirrorX = false,
  mirrorY = false,
) {
  const scaleX = width / 800;
  const scaleY = height / 600;
  return (refX: number, refY: number) => ({
    x: originX + (mirrorX ? 800 - refX : refX) * scaleX,
    y: originY + (mirrorY ? 600 - refY : refY) * scaleY,
    scaleX,
    scaleY,
  });
}

function drawCornerFloralCluster(
  pdf: jsPDF,
  mapRef: ReturnType<typeof createReferenceMapper>,
  petalColor: PdfRgb,
  centerColor: PdfRgb,
  stemColor: PdfRgb,
  leafColor: PdfRgb,
) {
  const p = (refX: number, refY: number) => mapRef(refX, refY);
  const unit = Math.max(p(0, 0).scaleX, p(0, 0).scaleY);

  drawWatermarkQuadraticCurve(
    pdf,
    p(20, 180),
    p(60, 120),
    p(90, 50),
    stemColor,
    Math.max(0.08, 3.8 * unit),
  );
  drawWatermarkQuadraticCurve(
    pdf,
    p(20, 180),
    p(0, 120),
    p(30, 60),
    stemColor,
    Math.max(0.07, 3.1 * unit),
  );
  drawWatermarkQuadraticCurve(
    pdf,
    p(40, 160),
    p(80, 140),
    p(120, 100),
    stemColor,
    Math.max(0.06, 2.5 * unit),
  );

  const leafBaseWidth = 11.5 * unit;
  const leafBaseHeight = 27 * unit;
  [
    { x: 55, y: 115, r: -40 },
    { x: 72, y: 88, r: -20 },
    { x: 28, y: 130, r: 30 },
    { x: 85, y: 130, r: -60 },
  ].forEach((leaf) => {
    const point = p(leaf.x, leaf.y);
    drawLeafWatermarkShape(
      pdf,
      point.x,
      point.y,
      leafBaseWidth,
      leafBaseHeight,
      leaf.r,
      leafColor,
      blendWithWhite(leafColor, 0.16),
    );
  });

  const flowerLarge = p(90, 50);
  drawWatermarkFlower(
    pdf,
    flowerLarge.x,
    flowerLarge.y,
    8,
    33 * unit,
    14 * unit,
    31 * unit,
    petalColor,
    centerColor,
  );

  [
    { x: 30, y: 62, scale: 0.8 },
    { x: 118, y: 100, scale: 0.7 },
  ].forEach((flower) => {
    const point = p(flower.x, flower.y);
    drawWatermarkFlower(
      pdf,
      point.x,
      point.y,
      6,
      24 * unit * flower.scale,
      11 * unit * flower.scale,
      24 * unit * flower.scale,
      petalColor,
      centerColor,
    );
  });

  [
    { x: 65, y: 72, scale: 0.75 },
    { x: 48, y: 92, scale: 0.6 },
  ].forEach((bud) => {
    const point = p(bud.x, bud.y);
    drawWatermarkBud(
      pdf,
      point.x,
      point.y,
      11.5 * unit * bud.scale,
      petalColor,
      stemColor,
    );
  });
}

function drawPutriFloralWatermarkPdf(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: PdfKordaPalette,
) {
  const petalColor = blendWithWhite(palette.header, 0.78);
  const centerColor = blendWithWhite(palette.border, 0.68);
  const stemColor = blendWithWhite(palette.text, 0.56);
  const leafColor = blendWithWhite(palette.header, 0.7);

  const topLeft = createReferenceMapper(x, y, width, height, false, false);
  const topRight = createReferenceMapper(x, y, width, height, true, false);
  const bottomLeft = createReferenceMapper(x, y, width, height, false, true);
  const bottomRight = createReferenceMapper(x, y, width, height, true, true);

  drawCornerFloralCluster(
    pdf,
    topLeft,
    petalColor,
    centerColor,
    stemColor,
    leafColor,
  );
  drawCornerFloralCluster(
    pdf,
    topRight,
    petalColor,
    centerColor,
    stemColor,
    leafColor,
  );
  drawCornerFloralCluster(
    pdf,
    bottomLeft,
    petalColor,
    centerColor,
    stemColor,
    leafColor,
  );
  drawCornerFloralCluster(
    pdf,
    bottomRight,
    petalColor,
    centerColor,
    stemColor,
    leafColor,
  );

  const center = createReferenceMapper(x, y, width, height, false, false);
  const centerPoint = center(400, 300);
  const unit = Math.max(width / 800, height / 600);
  drawWatermarkFlower(
    pdf,
    centerPoint.x,
    centerPoint.y,
    8,
    30 * unit,
    15 * unit,
    33 * unit,
    blendWithWhite(petalColor, 0.2),
    blendWithWhite(centerColor, 0.2),
  );

  [
    { x: 490, y: 300, scale: 1.06 },
    { x: 310, y: 300, scale: 1.06 },
    { x: 400, y: 210, scale: 1.06 },
    { x: 400, y: 390, scale: 1.06 },
    { x: 465, y: 365, scale: 0.9 },
    { x: 335, y: 365, scale: 0.9 },
    { x: 465, y: 235, scale: 0.9 },
    { x: 335, y: 235, scale: 0.9 },
  ].forEach((flower) => {
    const point = center(flower.x, flower.y);
    drawWatermarkFlower(
      pdf,
      point.x,
      point.y,
      6,
      20 * unit * flower.scale,
      9 * unit * flower.scale,
      20 * unit * flower.scale,
      blendWithWhite(petalColor, 0.26),
      blendWithWhite(centerColor, 0.26),
    );
  });

  const topCurve = [
    center(140, 35),
    center(280, 18),
    center(400, 28),
    center(520, 18),
    center(660, 35),
  ];
  const bottomCurve = [
    center(140, 565),
    center(280, 582),
    center(400, 572),
    center(520, 582),
    center(660, 565),
  ];
  drawWatermarkPolyline(pdf, topCurve, blendWithWhite(stemColor, 0.16), Math.max(0.07, 1.7 * unit));
  drawWatermarkPolyline(pdf, bottomCurve, blendWithWhite(stemColor, 0.16), Math.max(0.07, 1.7 * unit));
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
  const isPutri = isPutriGender(item.studentGender);
  const genderLabel = isPutri ? "PUTRI" : "PUTRA";

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

  if (isPutri) {
    drawPutriFloralWatermarkPdf(pdf, x, y, width, height, palette);
  }

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
