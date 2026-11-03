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
  LuggageCardSize,
} from "../lib/print-utils";
import {
  calculateLayout,
  PAPER_SIZES,
  getKordaColor,
} from "../lib/print-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  kordas: Array<{ id: string; name: string }>;
  dropPoints: Array<{ id: string; name: string }>;
}

interface PrintWorkspaceProps {
  eventId: string;
  eventName: string;
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
  eventName,
  kordas,
  dropPoints,
}: PrintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cetak Kartu, Tiket & Gelang</DialogTitle>
          <DialogDescription>
            Pilih jenis dokumen, filter, dan ukuran kertas untuk print
          </DialogDescription>
        </DialogHeader>
        <PrintWorkspace
          eventId={eventId}
          eventName={eventName}
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
  eventName,
  kordas,
  dropPoints,
  onClose,
  showCloseButton = false,
  className,
}: PrintWorkspaceProps) {
  const [journeyFilter, setJourneyFilter] = useState<"" | "outbound" | "return">("");
  const [printType, setPrintType] = useState<PrintType>("luggage_card");
  const [luggageCardSize, setLuggageCardSize] = useState<LuggageCardSize>("standard");
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
  const selectedJourneyType: "outbound" | "return" = journeyFilter === "return" ? "return" : "outbound";
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
    if (!journeyFilter) {
      toast.error("Pilih arah perjalanan sebelum membuat preview.");
      return;
    }
    setLoading(true);
    try {
      const result = await getPrintDataAction({
        eventId,
        journeyType: journeyFilter,
        printType,
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

      const isPaperLandscape =
        printType === "bracelet" ||
        (printType === "luggage_card" && luggageCardSize === "large_landscape");

      const layout = calculateLayout(paperSize, printType, luggageCardSize);
      const paper = isPaperLandscape
        ? { width: PAPER_SIZES[paperSize].height, height: PAPER_SIZES[paperSize].width }
        : PAPER_SIZES[paperSize];

      // Create PDF
      const pdf = new jsPDF({
        orientation: isPaperLandscape ? "landscape" : "portrait",
        unit: "mm",
        format: [paper.width, paper.height],
      });

      const cardsPerPage = layout.columns * layout.rows;
      const pageChunks = buildPrintPages(previewData, cardsPerPage);
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
            drawLuggageCardToPdf(
              pdf,
              item,
              x,
              y,
              layout.cardWidth,
              layout.cardHeight,
              luggageCardSize,
            );
            return;
          }
          if (printType === "ticket") {
            drawTicketToPdf(pdf, item, x, y, layout.cardWidth, layout.cardHeight);
            return;
          }
          drawBraceletToPdf(pdf, item, eventName, selectedJourneyType, x, y, layout.cardWidth, layout.cardHeight);
          drawBraceletCropMarks(pdf, x, y, layout.cardWidth, layout.cardHeight);
        });
      }

      // Download PDF
      const filename = `${printType === "luggage_card" ? `kartu_barang_${luggageCardSize}` : printType === "ticket" ? "tiket" : "gelang_22x2cm"}_${paperSize}_${new Date().getTime()}.pdf`;
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

  const isPaperLandscape =
    printType === "bracelet" ||
    (printType === "luggage_card" && luggageCardSize === "large_landscape");
  const layout = calculateLayout(paperSize, printType, luggageCardSize);
  const paper = isPaperLandscape
    ? { width: PAPER_SIZES[paperSize].height, height: PAPER_SIZES[paperSize].width }
    : PAPER_SIZES[paperSize];
  const cardsPerPage = layout.columns * layout.rows;
  const previewPages =
    previewData && showPreview ? buildPrintPages(previewData, cardsPerPage) : [];
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
  const fallbackScale = paperSize === "A3+" ? 0.24 : paperSize === "A3" ? 0.34 : 0.4;
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
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="bracelet" id="bracelet" />
            <Label htmlFor="bracelet" className="font-normal">
              Gelang Santri (22 × 2 cm)
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
          <Label>Perjalanan <span className="text-destructive">*</span></Label>
          <Select
            value={journeyFilter}
            onValueChange={(value: "outbound" | "return") => {
              setJourneyFilter(value);
              resetPreview();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih perjalanan" />
            </SelectTrigger>
            <SelectContent>
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

      {/* Paper Size & Card Size */}
      <div
        className={`grid grid-cols-1 gap-4 ${printType === "luggage_card" ? "md:grid-cols-2" : ""}`}
      >
        <div className="space-y-2">
          <Label>Ukuran Kertas</Label>
          <Select
            value={paperSize}
            onValueChange={(v: PaperSize) => {
              setPaperSize(v);
              resetPreview();
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4 (210 x 297 mm)</SelectItem>
              <SelectItem value="F4">F4 (215 x 330 mm)</SelectItem>
              <SelectItem value="A3">A3 (297 x 420 mm)</SelectItem>
              <SelectItem value="A3+">A3+ (329 x 483 mm)</SelectItem>
            </SelectContent>
          </Select>
          {printType === "bracelet" && (
            <p className="text-xs text-muted-foreground">
              Setiap gelang berukuran 22 × 2 cm dan disusun pada lembar kertas terpilih (landscape).
            </p>
          )}
        </div>

        {printType === "luggage_card" && (
          <div className="space-y-2">
            <Label>Ukuran Kartu Barang</Label>
            <Select
              value={luggageCardSize}
              onValueChange={(v: LuggageCardSize) => {
                setLuggageCardSize(v);
                resetPreview();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">
                  Standar (9.5 × 5.3 cm - Landscape)
                </SelectItem>
                <SelectItem value="large_portrait">
                  Besar Tegak (7.7 × 12.7 cm - Portrait)
                </SelectItem>
                <SelectItem value="large_landscape">
                  Besar Mendatar (12.7 × 7.7 cm - Landscape)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {luggageCardSize === "standard" &&
                "Ukuran kartu standar 9.5 × 5.3 cm (landscape)."}
              {luggageCardSize === "large_portrait" &&
                "Ukuran 7.7 × 12.7 cm tegak (portrait) untuk plastik mika / pouch gantungan koper."}
              {luggageCardSize === "large_landscape" &&
                "Ukuran 12.7 × 7.7 cm mendatar (landscape) format besar."}
            </p>
          </div>
        )}
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
                    className={`absolute ${printType === "bracelet" ? "overflow-visible" : "overflow-hidden"}`}
                    style={{
                      left,
                      top,
                      width: previewCardWidthPx,
                      height: previewCardHeightPx,
                    }}
                  >
                    {printType === "bracelet" && <PreviewBraceletCropMarks unitPx={mmToPx(1) * previewScale} />}
                    {printType === "luggage_card" ? (
                      <PreviewLuggageCard item={item} cardSize={luggageCardSize} />
                    ) : printType === "ticket" ? (
                      <PreviewTicketCard item={item} />
                    ) : (
                      <PreviewBracelet item={item} eventName={eventName} journeyType={selectedJourneyType} />
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
          disabled={!journeyFilter || loading || generatingPdf}
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
          disabled={!journeyFilter || !showPreview || loading || generatingPdf}
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

function isPutriGender(value: string | null | undefined): boolean {
  const gender = normalizeText(value).toUpperCase();
  return gender === "P" || gender === "PUTRI" || gender === "PEREMPUAN";
}

function buildPrintPages(
  data: PrintDataItem[],
  cardsPerPage: number,
): PrintDataItem[][] {
  const pages: PrintDataItem[][] = [];
  for (let index = 0; index < data.length; index += cardsPerPage) {
    pages.push(data.slice(index, index + cardsPerPage));
  }

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

function wrapPreviewLines(value: string, maxChars: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let overflow = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else if (lines.length < maxLines - 1) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = candidate;
      overflow = true;
      break;
    }
  }
  if (line) lines.push(line);
  if (overflow && lines.length) lines[lines.length - 1] = truncatePreviewText(lines[lines.length - 1], maxChars);
  return lines.length ? lines : ["-"];
}

function PreviewLuggageCard({
  item,
  cardSize = "standard",
}: {
  item: PrintDataItem;
  cardSize?: LuggageCardSize;
}) {
  const palette = getHexPalette(item.kordaName);
  const isPutri = isPutriGender(item.studentGender);
  const genderLabel = isPutri ? "PUTRI" : "PUTRA";
  const rosterNumber = String(item.rosterNumber).padStart(3, "0");
  const parentPhone = item.parrentPhone ? truncatePreviewText(item.parrentPhone, 22) : "-";

  if (cardSize === "large_portrait") {
    const kordaText = truncatePreviewText(item.kordaName, 22).toUpperCase();
    const studentName = truncatePreviewText(item.studentName, 26).toUpperCase();
    const studentNis = item.studentNis ? truncatePreviewText(item.studentNis, 16) : "";
    const dropPointLines = wrapPreviewLines(item.dropPointName, 22, 2);
    const busLabel = truncatePreviewText(item.busLabel || "-", 14).toUpperCase();
    const nisBadgeWidth = Math.max(90, Math.min(260, studentNis.length * 11 + 65));

    return (
      <svg
        viewBox="0 0 770 1270"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Preview kartu barang tegak ${studentName}`}
      >
        {/* Outer Cutting Border (Subtle Gray) */}
        <rect x="0.5" y="0.5" width="769" height="1269" fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />

        {/* Inner Card Artwork Container (Plain White Frame Gap: 25 SVG units = 2.5mm) */}
        <rect x="25" y="25" width="720" height="1220" rx="14" fill="#ffffff" stroke={palette.border} strokeWidth="2" />

        {isPutri ? (
          <g opacity="0.07" transform="translate(470, 930)">
            <circle cx="120" cy="120" r="100" fill="none" stroke={palette.header} strokeWidth="12" />
            <path d="M 120 20 C 170 70 170 170 120 220 C 70 170 70 70 120 20 Z" fill={palette.header} />
          </g>
        ) : (
          <g opacity="0.04">
            <pattern id={`grid-pattern-p-${item.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.8" fill={palette.header} />
            </pattern>
            <rect x="26" y="225" width="718" height="1010" fill={`url(#grid-pattern-p-${item.id})`} />
          </g>
        )}

        {/* Top Header Banner */}
        <path d="M 25 39 C 25 31 31 25 39 25 L 731 25 C 739 25 745 31 745 39 L 745 220 L 25 220 Z" fill={palette.header} />

        {/* Center Punch Hole Guide */}
        <circle cx="385" cy="62" r="18" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="5 3" opacity="0.75" />
        <circle cx="385" cy="62" r="3.5" fill="#ffffff" opacity="0.75" />

        <text x="385" y="120" fill="#ffffff" opacity="0.85" textAnchor="middle" fontSize="20" fontWeight="700" letterSpacing="3">
          LABEL BAGASI SANTRI
        </text>
        <text x="385" y="178" fill="#ffffff" textAnchor="middle" fontSize="42" fontWeight="900" letterSpacing="1">
          {kordaText}
        </text>

        {/* Accent Strip below Header */}
        <rect x="25" y="220" width="720" height="6" fill={palette.border} />

        {/* Sub Header: Gender Pill & Roster Number Badges */}
        <rect x="25" y="226" width="720" height="110" fill="#f8fafc" />
        <rect x="55" y="248" width="220" height="66" rx="33" fill={palette.header} />
        <text x="165" y="290" fill="#ffffff" textAnchor="middle" fontSize="24" fontWeight="900" letterSpacing="1.5">
          {genderLabel}
        </text>

        <rect x="470" y="240" width="220" height="82" rx="12" fill="#ffffff" stroke={palette.border} strokeWidth="1.5" />
        <text x="580" y="268" fill="#6b7280" textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="1.5">
          NO. URUT
        </text>
        <text x="580" y="308" fill="#111827" textAnchor="middle" fontSize="38" fontWeight="900">
          {rosterNumber}
        </text>
        <line x1="25" y1="336" x2="745" y2="336" stroke="#e2e8f0" strokeWidth="1.5" />

        {/* Passenger Hero Name */}
        <text x="55" y="380" fill="#9ca3af" fontSize="19" fontWeight="800" letterSpacing="2">
          NAMA PENUMPANG / SANTRI
        </text>
        <text x="55" y="435" fill="#111827" fontSize="44" fontWeight="900">
          {studentName}
        </text>

        {studentNis ? (
          <g transform="translate(55, 458)">
            <rect width={nisBadgeWidth} height="38" rx="8" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
            <text x="14" y="26" fill="#4b5563" fontSize="22" fontWeight="800">
              NIS: {studentNis}
            </text>
          </g>
        ) : (
          <g transform="translate(55, 458)">
            <rect width="210" height="38" rx="8" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
            <text x="14" y="26" fill="#6b7280" fontSize="20" fontWeight="800">
              PESERTA UMUM
            </text>
          </g>
        )}

        <line x1="50" y1="520" x2="720" y2="520" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="6 4" />

        {/* Drop Point Container Card */}
        <g transform="translate(55, 545)">
          <rect width="660" height="160" rx="14" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
          <text x="24" y="38" fill="#6b7280" fontSize="19" fontWeight="800" letterSpacing="2">
            TITIK TURUN (DROP POINT)
          </text>
          <text x="24" y="88" fill="#111827" fontSize="36" fontWeight="800">
            {dropPointLines[0]}
          </text>
          {dropPointLines[1] && (
            <text x="24" y="132" fill="#111827" fontSize="32" fontWeight="800">
              {dropPointLines[1]}
            </text>
          )}
        </g>

        {/* Emergency Contact Container Card */}
        <g transform="translate(55, 725)">
          <rect width="660" height="140" rx="14" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
          <text x="24" y="38" fill="#6b7280" fontSize="19" fontWeight="800" letterSpacing="2">
            KONTAK DARURAT / ORTU
          </text>
          <text x="24" y="92" fill="#1f2937" fontSize="36" fontWeight="800">
            {parentPhone}
          </text>
        </g>

        {/* Armada Bus Focal Point (Moved to Bottom Section) */}
        <text x="55" y="895" fill="#6b7280" fontSize="20" fontWeight="800" letterSpacing="2">
          ARMADA BUS
        </text>
        <g transform="translate(55, 915)">
          <rect width="660" height="235" rx="16" fill={palette.header} stroke={palette.border} strokeWidth="2.5" />
          <path d="M 0 16 C 0 7.2 7.2 0 16 0 L 644 0 C 652.8 0 660 7.2 660 16 L 660 46 L 0 46 Z" fill="rgba(0, 0, 0, 0.14)" />
          <text x="330" y="32" fill="#ffffff" opacity="0.95" textAnchor="middle" fontSize="20" fontWeight="800" letterSpacing="2.5">
            BUS PENUMPANG
          </text>
          <text x="330" y="160" fill="#ffffff" textAnchor="middle" fontSize="66" fontWeight="900" letterSpacing="2">
            {busLabel}
          </text>
        </g>
      </svg>
    );
  }

  if (cardSize === "large_landscape") {
    const kordaText = truncatePreviewText(item.kordaName, 24).toUpperCase();
    const studentName = truncatePreviewText(item.studentName, 34).toUpperCase();
    const studentNis = item.studentNis ? truncatePreviewText(item.studentNis, 18) : "";
    const dropPointLines = wrapPreviewLines(item.dropPointName, 22, 2);
    const busLabel = truncatePreviewText(item.busLabel || "-", 14).toUpperCase();
    const nisBadgeWidth = Math.max(110, Math.min(320, studentNis.length * 13 + 80));

    return (
      <svg
        viewBox="0 0 1270 770"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Preview kartu barang besar mendatar ${studentName}`}
      >
        {/* Outer Cutting Border (Subtle Gray) */}
        <rect x="0.5" y="0.5" width="1269" height="769" fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />

        {/* Inner Card Artwork Container (Plain White Frame Gap: 25 SVG units = 2.5mm) */}
        <rect x="25" y="25" width="1220" height="720" rx="12" fill="#ffffff" stroke={palette.border} strokeWidth="2" />

        {isPutri ? (
          <g opacity="0.07" transform="translate(880, 360)">
            <circle cx="160" cy="160" r="140" fill="none" stroke={palette.header} strokeWidth="16" />
            <path d="M 160 30 C 220 90 220 230 160 290 C 100 230 100 90 160 30 Z" fill={palette.header} />
          </g>
        ) : (
          <g opacity="0.04">
            <pattern id={`grid-pattern-ll-${item.id}`} width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="14" cy="14" r="2.2" fill={palette.header} />
            </pattern>
            <rect x="26" y="180" width="1218" height="540" fill={`url(#grid-pattern-ll-${item.id})`} />
          </g>
        )}

        {/* Top Header Banner */}
        <path d="M 25 37 C 25 30.5 30.5 25 37 25 L 1233 25 C 1239.5 25 1245 30.5 1245 37 L 1245 175 L 25 175 Z" fill={palette.header} />

        {/* Punch Hole */}
        <circle cx="80" cy="95" r="22" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="5 3" opacity="0.75" />
        <circle cx="80" cy="95" r="4.5" fill="#ffffff" opacity="0.75" />

        <text x="125" y="75" fill="#ffffff" opacity="0.85" fontSize="21" fontWeight="700" letterSpacing="3">
          LABEL BAGASI SANTRI
        </text>
        <text x="125" y="145" fill="#ffffff" fontSize="50" fontWeight="900" letterSpacing="1">
          {kordaText}
        </text>

        {/* Right Badges */}
        <rect x="860" y="52" width="150" height="85" rx="42" fill="rgba(255, 255, 255, 0.22)" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="2" />
        <text x="935" y="106" fill="#ffffff" textAnchor="middle" fontSize="30" fontWeight="800" letterSpacing="1.5">
          {genderLabel}
        </text>

        <rect x="1030" y="42" width="195" height="105" rx="16" fill="#ffffff" stroke={palette.border} strokeWidth="2" />
        <text x="1127" y="76" fill="#6b7280" textAnchor="middle" fontSize="21" fontWeight="800" letterSpacing="2">
          NO. URUT
        </text>
        <text x="1127" y="127" fill="#111827" textAnchor="middle" fontSize="48" fontWeight="900">
          {rosterNumber}
        </text>

        <rect x="25" y="175" width="1220" height="7" fill={palette.border} />

        {/* Hero Name Area */}
        <text x="75" y="225" fill="#9ca3af" fontSize="21" fontWeight="800" letterSpacing="2">
          NAMA PENUMPANG / SANTRI
        </text>
        <text x="75" y="282" fill="#111827" fontSize="52" fontWeight="900">
          {studentName}
        </text>

        {studentNis ? (
          <g transform="translate(75, 305)">
            <rect width={nisBadgeWidth} height="42" rx="8" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
            <text x="16" y="29" fill="#4b5563" fontSize="24" fontWeight="800">
              NIS: {studentNis}
            </text>
          </g>
        ) : (
          <g transform="translate(75, 305)">
            <rect width="230" height="42" rx="8" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
            <text x="16" y="29" fill="#6b7280" fontSize="22" fontWeight="800">
              PESERTA UMUM
            </text>
          </g>
        )}

        <line x1="65" y1="365" x2="1205" y2="365" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="8 5" />

        {/* Left Column: Drop Point & Phone */}
        <text x="75" y="410" fill="#6b7280" fontSize="23" fontWeight="800" letterSpacing="2">
          TITIK TURUN (DROP POINT)
        </text>
        <text x="75" y="458" fill="#111827" fontSize="38" fontWeight="800">
          {dropPointLines[0]}
        </text>
        {dropPointLines[1] && (
          <text x="75" y="505" fill="#111827" fontSize="34" fontWeight="800">
            {dropPointLines[1]}
          </text>
        )}

        <text x="75" y="580" fill="#6b7280" fontSize="22" fontWeight="800" letterSpacing="2">
          KONTAK DARURAT / ORTU
        </text>
        <text x="75" y="628" fill="#1f2937" fontSize="36" fontWeight="800">
          {parentPhone}
        </text>

        <line x1="660" y1="385" x2="660" y2="715" stroke="#e5e7eb" strokeWidth="2" />

        {/* Right Column: Armada Bus */}
        <text x="695" y="410" fill="#6b7280" fontSize="23" fontWeight="800" letterSpacing="2">
          ARMADA BUS
        </text>
        <g transform="translate(695, 430)">
          <rect width="515" height="215" rx="18" fill={palette.header} stroke={palette.border} strokeWidth="2.5" />
          <path d="M 0 18 C 0 8 8 0 18 0 L 497 0 C 507 0 515 8 515 18 L 515 50 L 0 50 Z" fill="rgba(0, 0, 0, 0.12)" />
          <text x="257" y="36" fill="#ffffff" opacity="0.95" textAnchor="middle" fontSize="23" fontWeight="800" letterSpacing="2.5">
            BUS PENUMPANG
          </text>
          <text x="257" y="152" fill="#ffffff" textAnchor="middle" fontSize="66" fontWeight="900" letterSpacing="2">
            {busLabel}
          </text>
        </g>
      </svg>
    );
  }

  // Standard (950 x 530)
  const kordaText = truncatePreviewText(item.kordaName, 22).toUpperCase();
  const studentName = truncatePreviewText(item.studentName, 32).toUpperCase();
  const studentNis = item.studentNis ? truncatePreviewText(item.studentNis, 18) : "";
  const dropPointLines = wrapPreviewLines(item.dropPointName, 18, 2);
  const busLabel = truncatePreviewText(item.busLabel || "-", 14).toUpperCase();
  const nisBadgeWidth = Math.max(90, Math.min(260, studentNis.length * 11 + 65));

  return (
    <svg
      viewBox="0 0 950 530"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Preview kartu barang ${studentName}`}
    >
      {/* Outer Cutting Border (Subtle Gray) */}
      <rect x="0.5" y="0.5" width="949" height="529" fill="#ffffff" stroke="#d1d5db" strokeWidth="1" />

      {/* Inner Card Artwork Container (Plain White Frame Gap: 20 SVG units = 2.0mm) */}
      <rect x="20" y="20" width="910" height="490" rx="10" fill="#ffffff" stroke={palette.border} strokeWidth="2" />

      {/* Decorative modern subtle background watermark */}
      {isPutri ? (
        <g opacity="0.07" transform="translate(660, 245)">
          <circle cx="120" cy="120" r="100" fill="none" stroke={palette.header} strokeWidth="12" />
          <path d="M 120 20 C 170 70 170 170 120 220 C 70 170 70 70 120 20 Z" fill={palette.header} />
          <path d="M 20 120 C 70 170 170 170 220 120 C 170 70 70 70 20 120 Z" fill={palette.header} />
        </g>
      ) : (
        <g opacity="0.04">
          <pattern id={`grid-pattern-${item.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1.8" fill={palette.header} />
          </pattern>
          <rect x="21" y="140" width="908" height="355" fill={`url(#grid-pattern-${item.id})`} />
        </g>
      )}

      {/* Header Banner */}
      <path
        d="M 20 30 C 20 24.5 24.5 20 30 20 L 920 20 C 925.5 20 930 24.5 930 30 L 930 135 L 20 135 Z"
        fill={palette.header}
      />

      {/* Punch hole guide */}
      <circle cx="65" cy="75" r="18" fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="5 3" opacity="0.75" />
      <circle cx="65" cy="75" r="3.5" fill="#ffffff" opacity="0.75" />

      {/* Header Info (Left) */}
      <text x="100" y="56" fill="#ffffff" opacity="0.85" fontSize="17" fontWeight="700" letterSpacing="2.5">
        LABEL BAGASI SANTRI
      </text>
      <text x="100" y="110" fill="#ffffff" fontSize="38" fontWeight="900" letterSpacing="1">
        {kordaText}
      </text>

      {/* Header Chips (Right) */}
      {/* Gender Chip */}
      <rect
        x="635"
        y="42"
        width="120"
        height="64"
        rx="32"
        fill="rgba(255, 255, 255, 0.22)"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth="1.5"
      />
      <text x="695" y="82" fill="#ffffff" textAnchor="middle" fontSize="23" fontWeight="800" letterSpacing="1.5">
        {genderLabel}
      </text>

      {/* Roster Number Card */}
      <rect
        x="765"
        y="34"
        width="150"
        height="80"
        rx="12"
        fill="#ffffff"
        stroke={palette.border}
        strokeWidth="1.5"
      />
      <text x="840" y="60" fill="#6b7280" textAnchor="middle" fontSize="16" fontWeight="800" letterSpacing="1.5">
        NO. URUT
      </text>
      <text x="840" y="98" fill="#111827" textAnchor="middle" fontSize="36" fontWeight="900" letterSpacing="1">
        {rosterNumber}
      </text>

      {/* Accent Strip below Header */}
      <rect x="20" y="135" width="910" height="6" fill={palette.border} />

      {/* Hero Passenger Name Area */}
      <text x="60" y="175" fill="#9ca3af" fontSize="17" fontWeight="800" letterSpacing="2">
        NAMA PENUMPANG / SANTRI
      </text>
      <text x="60" y="222" fill="#111827" fontSize="40" fontWeight="900">
        {studentName}
      </text>

      {/* Sub Identity: NIS or General Participant */}
      {studentNis ? (
        <g transform="translate(60, 238)">
          <rect width={nisBadgeWidth} height="32" rx="6" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
          <text x="12" y="22" fill="#4b5563" fontSize="19" fontWeight="800" letterSpacing="0.5">
            NIS: {studentNis}
          </text>
        </g>
      ) : (
        <g transform="translate(60, 238)">
          <rect width="180" height="32" rx="6" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1" />
          <text x="12" y="22" fill="#6b7280" fontSize="17" fontWeight="800" letterSpacing="0.5">
            PESERTA UMUM
          </text>
        </g>
      )}

      {/* Mid Horizontal Separator */}
      <line x1="55" y1="285" x2="895" y2="285" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="6 4" />

      {/* Logistics Columns */}
      {/* Left Column: Drop Point & Emergency Contact */}
      <text x="60" y="318" fill="#6b7280" fontSize="18" fontWeight="800" letterSpacing="1.5">
        TITIK TURUN (DROP POINT)
      </text>
      <text x="60" y="353" fill="#111827" fontSize="30" fontWeight="800">
        {dropPointLines[0]}
      </text>
      {dropPointLines[1] && (
        <text x="60" y="388" fill="#111827" fontSize="26" fontWeight="800">
          {dropPointLines[1]}
        </text>
      )}

      <text x="60" y="438" fill="#6b7280" fontSize="17" fontWeight="800" letterSpacing="1.5">
        KONTAK DARURAT / ORTU
      </text>
      <text x="60" y="474" fill="#1f2937" fontSize="27" fontWeight="800">
        {parentPhone}
      </text>

      {/* Vertical Column Divider */}
      <line x1="490" y1="302" x2="490" y2="490" stroke="#e5e7eb" strokeWidth="1.5" />

      {/* Right Column: Armada Bus Focal Point */}
      <text x="515" y="318" fill="#6b7280" fontSize="18" fontWeight="800" letterSpacing="1.5">
        ARMADA BUS
      </text>

      <g transform="translate(515, 334)">
        {/* Bus Card Badge */}
        <rect width="390" height="148" rx="14" fill={palette.header} stroke={palette.border} strokeWidth="2" />
        <path d="M 0 14 C 0 6.2 6.2 0 14 0 L 376 0 C 383.8 0 390 6.2 390 14 L 390 38 L 0 38 Z" fill="rgba(0, 0, 0, 0.12)" />
        <text x="195" y="26" fill="#ffffff" opacity="0.95" textAnchor="middle" fontSize="17" fontWeight="800" letterSpacing="2">
          BUS PENUMPANG
        </text>
        <text x="195" y="102" fill="#ffffff" textAnchor="middle" fontSize="48" fontWeight="900" letterSpacing="1.5">
          {busLabel}
        </text>
      </g>
    </svg>
  );
}

function PreviewTicketCard({ item }: { item: PrintDataItem }) {
  const palette = getHexPalette(item.kordaName);
  const studentName = truncatePreviewText(item.studentName, 28);
  const dropPoint = truncatePreviewText(item.dropPointName, 18);
  const korda = truncatePreviewText(item.kordaName, 18);
  const busLabel = truncatePreviewText(item.busLabel, 16);
  const rosterNumber = String(item.rosterNumber).padStart(3, "0");
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
      <text x="950" y="40" fill="#ffffff" textAnchor="end" fontSize="30" fontWeight="700">
        {`NO. ${rosterNumber}`}
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

function PreviewBraceletCropMarks({ unitPx }: { unitPx: number }) {
  const length = unitPx * 0.35;
  const offset = unitPx * 0.3;
  const thickness = unitPx * 0.12;
  const stroke = { position: "absolute" as const, backgroundColor: "#475569" };
  const marks = [
    { left: -(offset + length), top: 0, width: length, height: thickness },
    { left: 0, top: -(offset + length), width: thickness, height: length },
    { right: -(offset + length), top: 0, width: length, height: thickness },
    { right: 0, top: -(offset + length), width: thickness, height: length },
    { left: -(offset + length), bottom: 0, width: length, height: thickness },
    { left: 0, bottom: -(offset + length), width: thickness, height: length },
    { right: -(offset + length), bottom: 0, width: length, height: thickness },
    { right: 0, bottom: -(offset + length), width: thickness, height: length },
  ];
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0">{marks.map((mark, index) => <span key={index} style={{ ...stroke, ...mark }} />)}</div>;
}

function PreviewBracelet({ item, eventName, journeyType }: { item: PrintDataItem; eventName: string; journeyType: "outbound" | "return" }) {
  const palette = getHexPalette(item.kordaName);
  const eventText = truncatePreviewText(eventName, 22);
  const studentName = truncatePreviewText(item.studentName, 30);
  const kordaLines = wrapPreviewLines(item.kordaName, 15, 2);
  const journeyLabel = journeyType === "outbound" ? "PULANG" : "KEMBALI";
  const headerText = contrastTextColor(palette.header);
  const nameClipId = `bracelet-name-${item.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg viewBox="0 0 2200 200" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Preview gelang ${studentName}`}>
      <defs><clipPath id={nameClipId}><rect x="540" y="80" width="1060" height="88" /></clipPath></defs>
      <rect x="2" y="2" width="2196" height="196" fill={palette.header} stroke={palette.border} strokeWidth="4" />
      <rect x="3" y="3" width="480" height="194" fill={palette.text} />
      <rect x="483" y="3" width="1197" height="194" fill={palette.bg} />
      <line x1="483" y1="3" x2="483" y2="197" stroke={palette.border} strokeWidth="3" />
      <line x1="1680" y1="3" x2="1680" y2="197" stroke={palette.border} strokeWidth="3" />
      <text x="243" y="72" fill="#ffffff" textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="2">EVENT</text>
      <text x="243" y="143" fill="#ffffff" textAnchor="middle" fontSize="27" fontWeight="600">{eventText}</text>
      <text x="540" y="57" fill={palette.text} fontSize="16" fontWeight="700" letterSpacing="2">AKSES PERJALANAN / {journeyLabel}</text>
      <line x1="540" y1="77" x2="1625" y2="77" stroke={palette.border} strokeWidth="2" />
      <text x="540" y="145" fill={palette.text} fontSize="69" fontWeight="800" clipPath={`url(#${nameClipId})`}>{studentName}</text>
      <text x="1940" y="65" fill={headerText} textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="2">KORDA</text>
      {kordaLines.map((line, index) => <text key={`${line}-${index}`} x="1940" y={kordaLines.length === 1 ? 143 : 119 + index * 34} fill={headerText} textAnchor="middle" fontSize="32" fontWeight="800">{line}</text>)}
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

function contrastTextColor(hex: string): string {
  const [red, green, blue] = hexToRgb(hex);
  return 0.299 * red + 0.587 * green + 0.114 * blue > 155 ? "#111827" : "#ffffff";
}

function blendWithWhite(color: PdfRgb, ratio: number): PdfRgb {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  return color.map(
    (channel) => Math.round(channel + (255 - channel) * safeRatio),
  ) as PdfRgb;
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

function truncateSingleLineText(
  pdf: jsPDF,
  value: string | null | undefined,
  maxWidth: number,
  fontSize: number,
  style: PdfFontStyle,
): FittedTextResult {
  const text = normalizeText(value);
  pdf.setFont("helvetica", style);
  pdf.setFontSize(fontSize);
  if (pdf.getTextWidth(text) <= maxWidth) return { text, fontSize };

  let shortened = text;
  while (shortened.length > 0 && pdf.getTextWidth(`${shortened}...`) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return { text: `${shortened}...`, fontSize };
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

function drawBraceletToPdf(
  pdf: jsPDF,
  item: PrintDataItem,
  eventName: string,
  journeyType: "outbound" | "return",
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const palette = getPdfPalette(item.kordaName);
  const headerText = hexToRgb(contrastTextColor(rgbToHex(palette.header)));
  const eventBlockWidth = 48;
  const kordaBlockWidth = 52;
  const nameBlockWidth = width - eventBlockWidth - kordaBlockWidth;
  const event = fitSingleLineText(pdf, eventName, eventBlockWidth - 8, 7.4, 5.8, "bold");
  const journeyLabel = journeyType === "outbound" ? "PULANG" : "KEMBALI";
  const journey = fitSingleLineText(pdf, `AKSES PERJALANAN / ${journeyLabel}`, nameBlockWidth - 14, 5.4, 4.8, "bold");
  const name = truncateSingleLineText(pdf, item.studentName, nameBlockWidth - 14, 19.5, "bold");
  const korda = fitMultilineText(pdf, item.kordaName, kordaBlockWidth - 8, 2, 10, 7.2, "bold");

  pdf.setFillColor(...palette.header);
  pdf.rect(x, y, width, height, "F");
  pdf.setFillColor(...palette.text);
  pdf.rect(x, y, eventBlockWidth, height, "F");
  pdf.setFillColor(...palette.bg);
  pdf.rect(x + eventBlockWidth, y, nameBlockWidth, height, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.35);
  pdf.rect(x + 0.15, y + 0.15, width - 0.3, height - 0.3, "S");
  pdf.line(x + eventBlockWidth, y, x + eventBlockWidth, y + height);
  pdf.line(x + width - kordaBlockWidth, y, x + width - kordaBlockWidth, y + height);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.2);
  pdf.text("EVENT", x + eventBlockWidth / 2, y + 6.1, { align: "center" });
  pdf.setFontSize(event.fontSize);
  pdf.text(event.text, x + eventBlockWidth / 2, y + 14.1, { align: "center" });

  pdf.setTextColor(...palette.text);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(journey.fontSize);
  pdf.text(journey.text, x + eventBlockWidth + 7, y + 5.7);
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.18);
  pdf.line(x + eventBlockWidth + 7, y + 7.7, x + width - kordaBlockWidth - 7, y + 7.7);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(name.fontSize);
  pdf.text(name.text, x + eventBlockWidth + 7, y + 15.2);

  pdf.setTextColor(...headerText);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.2);
  pdf.text("KORDA", x + width - kordaBlockWidth / 2, y + 5.8, { align: "center" });
  pdf.setFontSize(korda.fontSize);
  if (korda.lines.length === 1) {
    pdf.text(korda.lines[0], x + width - kordaBlockWidth / 2, y + 14.1, { align: "center" });
  } else {
    pdf.text(korda.lines, x + width - kordaBlockWidth / 2, y + 10.6, { align: "center", lineHeightFactor: 1.1 });
  }
}

function drawBraceletCropMarks(pdf: jsPDF, x: number, y: number, width: number, height: number) {
  const length = 0.35;
  const offset = 0.3;
  pdf.setDrawColor(71, 85, 105);
  pdf.setLineWidth(0.12);
  pdf.line(x - offset - length, y, x - offset, y);
  pdf.line(x, y - offset - length, x, y - offset);
  pdf.line(x + width + offset, y, x + width + offset + length, y);
  pdf.line(x + width, y - offset - length, x + width, y - offset);
  pdf.line(x - offset - length, y + height, x - offset, y + height);
  pdf.line(x, y + height + offset, x, y + height + offset + length);
  pdf.line(x + width + offset, y + height, x + width + offset + length, y + height);
  pdf.line(x + width, y + height + offset, x + width, y + height + offset + length);
}

function drawLuggageCardStandardPdf(
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

  // 1. Outer Cutting Border (Subtle Gray) and Plain White Frame
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(209, 213, 219);
  pdf.setLineWidth(0.18);
  pdf.rect(x, y, width, height, "FD");

  // Inset inner card (2.0mm plain white frame gap)
  const margin = 2.0;
  const ix = x + margin;
  const iy = y + margin;
  const iw = width - 2 * margin; // 91mm
  const ih = height - 2 * margin; // 49mm

  // Inner card background
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(ix, iy, iw, ih, 1.8, 1.8, "F");

  // Modern subtle background accent for Putri
  if (isPutri) {
    const wmColor = blendWithWhite(palette.header, 0.94);
    pdf.setDrawColor(...wmColor);
    pdf.setLineWidth(0.8);
    pdf.circle(ix + iw - 14, iy + ih - 15, 12, "S");
    pdf.circle(ix + iw - 14, iy + ih - 15, 6, "S");
  }

  // 2. Header Banner (height 11.5mm)
  const headerHeight = 11.5;
  pdf.setFillColor(...palette.header);
  pdf.roundedRect(ix, iy, iw, headerHeight, 1.8, 1.8, "F");
  pdf.rect(ix, iy + 2.0, iw, headerHeight - 2.0, "F");

  // Hole punch guide
  const punchX = ix + 4.8;
  const punchY = iy + 5.8;
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.18);
  pdf.circle(punchX, punchY, 1.8, "S");
  pdf.setFillColor(255, 255, 255);
  pdf.circle(punchX, punchY, 0.35, "F");

  // Header Title & Korda Name
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.2);
  pdf.text("LABEL BAGASI SANTRI", ix + 8.2, iy + 4.2);

  const kordaHeader = fitSingleLineText(
    pdf,
    normalizeText(item.kordaName).toUpperCase(),
    iw - 38,
    10.8,
    7.5,
    "bold",
  );
  pdf.setFontSize(kordaHeader.fontSize);
  pdf.text(kordaHeader.text, ix + 8.2, iy + 9.2);

  // Header Right Chips:
  // Gender Pill
  const genderPillW = 11.5;
  const genderPillH = 6.0;
  const genderPillX = ix + iw - 29.0;
  const genderPillY = iy + 2.6;
  pdf.setFillColor(...blendWithWhite(palette.header, 0.25));
  pdf.roundedRect(genderPillX, genderPillY, genderPillW, genderPillH, 1.2, 1.2, "F");
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.15);
  pdf.roundedRect(genderPillX, genderPillY, genderPillW, genderPillH, 1.2, 1.2, "S");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(6.2);
  pdf.text(genderLabel, genderPillX + genderPillW / 2, genderPillY + 4.2, { align: "center" });

  // Roster Number Badge (White Card)
  const rosterBadgeW = 14.5;
  const rosterBadgeH = 7.6;
  const rosterBadgeX = ix + iw - 16.0;
  const rosterBadgeY = iy + 1.8;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(rosterBadgeX, rosterBadgeY, rosterBadgeW, rosterBadgeH, 1.4, 1.4, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(rosterBadgeX, rosterBadgeY, rosterBadgeW, rosterBadgeH, 1.4, 1.4, "S");

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(4.8);
  pdf.text("NO. URUT", rosterBadgeX + rosterBadgeW / 2, rosterBadgeY + 2.6, { align: "center" });
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(9.0);
  pdf.text(String(item.rosterNumber).padStart(3, "0"), rosterBadgeX + rosterBadgeW / 2, rosterBadgeY + 6.5, { align: "center" });

  // Accent Line below Header
  pdf.setFillColor(...palette.border);
  pdf.rect(ix, iy + headerHeight, iw, 0.6, "F");

  // 3. Hero Passenger Section
  pdf.setTextColor(156, 163, 175);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.0);
  pdf.text("NAMA PENUMPANG / SANTRI", ix + 4.2, iy + 15.6);

  const studentName = fitSingleLineText(
    pdf,
    normalizeText(item.studentName).toUpperCase(),
    iw - 8.0,
    11.2,
    7.5,
    "bold",
  );
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(studentName.fontSize);
  pdf.text(studentName.text, ix + 4.2, iy + 20.2);

  if (item.studentNis) {
    const nisText = fitSingleLineText(pdf, `NIS: ${item.studentNis}`, 30, 6.0, 4.8, "bold");
    const nisBadgeW = pdf.getTextWidth(nisText.text) + 3.0;
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(ix + 4.2, iy + 21.8, nisBadgeW, 3.4, 0.8, 0.8, "F");
    pdf.setTextColor(75, 85, 99);
    pdf.setFontSize(nisText.fontSize);
    pdf.text(nisText.text, ix + 5.7, iy + 24.3);
  } else {
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(ix + 4.2, iy + 21.8, 19.0, 3.4, 0.8, 0.8, "F");
    pdf.setTextColor(107, 114, 128);
    pdf.setFontSize(5.2);
    pdf.text("PESERTA UMUM", ix + 5.2, iy + 24.3);
  }

  // 4. Mid Horizontal Divider
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.15);
  pdf.line(ix + 3.5, iy + 26.8, ix + iw - 3.5, iy + 26.8);

  // 5. Logistics Grid
  // Left: Drop Point
  pdf.setTextColor(107, 114, 128);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.2);
  pdf.text("TITIK TURUN (DROP POINT)", ix + 4.2, iy + 30.2);

  const dropPointValue = fitMultilineText(
    pdf,
    item.dropPointName,
    39.0,
    2,
    7.8,
    6.2,
    "bold",
  );
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(dropPointValue.fontSize);
  const dropLineHeight = Math.max(2.8, dropPointValue.fontSize * 0.38);
  dropPointValue.lines.forEach((line, index) => {
    pdf.text(line, ix + 4.2, iy + 34.0 + index * dropLineHeight);
  });

  // Left: Emergency Parent Phone
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(5.0);
  pdf.text("KONTAK DARURAT / ORTU", ix + 4.2, iy + 41.6);

  const parentPhone = fitSingleLineText(pdf, item.parrentPhone || "-", 39.0, 7.5, 6.2, "bold");
  pdf.setTextColor(55, 65, 81);
  pdf.setFontSize(parentPhone.fontSize);
  pdf.text(parentPhone.text, ix + 4.2, iy + 45.4);

  // Column Divider Line
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.15);
  pdf.line(ix + 46.5, iy + 28.5, ix + 46.5, iy + 46.8);

  // Right: Armada Bus Focal Point Card
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(5.2);
  pdf.text("ARMADA BUS", ix + 48.5, iy + 30.2);

  const busCardX = ix + 48.5;
  const busCardY = iy + 31.8;
  const busCardW = 38.5;
  const busCardH = 14.2;
  pdf.setFillColor(...palette.header);
  pdf.roundedRect(busCardX, busCardY, busCardW, busCardH, 1.6, 1.6, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(busCardX, busCardY, busCardW, busCardH, 1.6, 1.6, "S");

  // Inner top strip inside Bus Badge
  const busHeaderStrip = palette.header.map((c) => Math.round(c * 0.85)) as PdfRgb;
  pdf.setFillColor(...busHeaderStrip);
  pdf.roundedRect(busCardX, busCardY, busCardW, 3.6, 1.6, 1.6, "F");
  pdf.rect(busCardX, busCardY + 2.0, busCardW, 1.6, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(4.6);
  pdf.text("BUS PENUMPANG", busCardX + busCardW / 2, busCardY + 2.6, { align: "center" });

  const busValue = fitSingleLineText(pdf, item.busLabel || "-", busCardW - 2.5, 11.2, 7.2, "bold");
  pdf.setFontSize(busValue.fontSize);
  pdf.text(busValue.text, busCardX + busCardW / 2, busCardY + 9.8, { align: "center" });

  // 6. Inner Card Border (Clean rounded corners without bottom block clash)
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(ix, iy, iw, ih, 1.8, 1.8, "S");
}

function drawLuggageCardPortraitPdf(
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

  // 1. Outer Cutting Border (Subtle Gray) and Plain White Frame
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(209, 213, 219);
  pdf.setLineWidth(0.18);
  pdf.rect(x, y, width, height, "FD");

  // Inset inner card (2.5mm plain white frame gap)
  const margin = 2.5;
  const ix = x + margin;
  const iy = y + margin;
  const iw = width - 2 * margin; // 72mm
  const ih = height - 2 * margin; // 122mm

  // Inner card background
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(ix, iy, iw, ih, 2.2, 2.2, "F");

  // Subtle watermark for Putri
  if (isPutri) {
    const wmColor = blendWithWhite(palette.header, 0.94);
    pdf.setDrawColor(...wmColor);
    pdf.setLineWidth(0.8);
    pdf.circle(ix + iw - 16, iy + ih - 22, 14, "S");
    pdf.circle(ix + iw - 16, iy + ih - 22, 7, "S");
  }

  // 2. Header Banner (height 19.5mm)
  const headerHeight = 19.5;
  pdf.setFillColor(...palette.header);
  pdf.roundedRect(ix, iy, iw, headerHeight, 2.2, 2.2, "F");
  pdf.rect(ix, iy + 2.0, iw, headerHeight - 2.0, "F");

  // Center punch hole guide
  const punchX = ix + iw / 2;
  const punchY = iy + 4.8;
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.2);
  pdf.circle(punchX, punchY, 1.8, "S");
  pdf.setFillColor(255, 255, 255);
  pdf.circle(punchX, punchY, 0.35, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.8);
  pdf.text("LABEL BAGASI SANTRI", punchX, iy + 10.5, { align: "center" });

  const kordaHeader = fitSingleLineText(
    pdf,
    normalizeText(item.kordaName).toUpperCase(),
    iw - 10,
    11.8,
    7.8,
    "bold",
  );
  pdf.setFontSize(kordaHeader.fontSize);
  pdf.text(kordaHeader.text, punchX, iy + 16.0, { align: "center" });

  pdf.setFillColor(...palette.border);
  pdf.rect(ix, iy + headerHeight, iw, 0.6, "F");

  // 3. Sub Header: Gender Pill & Roster Badge Strip
  pdf.setFillColor(248, 250, 252);
  pdf.rect(ix, iy + headerHeight + 0.6, iw, 10.5, "F");

  const genderW = 21.0;
  const genderH = 6.2;
  const genderX = ix + 4.5;
  const genderY = iy + headerHeight + 2.6;
  pdf.setFillColor(...palette.header);
  pdf.roundedRect(genderX, genderY, genderW, genderH, 1.4, 1.4, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7.2);
  pdf.text(genderLabel, genderX + genderW / 2, genderY + 4.4, { align: "center" });

  const rosterW = 21.0;
  const rosterH = 7.8;
  const rosterX = ix + iw - 25.5;
  const rosterY = iy + headerHeight + 1.8;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(rosterX, rosterY, rosterW, rosterH, 1.4, 1.4, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(rosterX, rosterY, rosterW, rosterH, 1.4, 1.4, "S");

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(4.8);
  pdf.text("NO. URUT", rosterX + rosterW / 2, rosterY + 2.6, { align: "center" });
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(9.8);
  pdf.text(String(item.rosterNumber).padStart(3, "0"), rosterX + rosterW / 2, rosterY + 6.6, { align: "center" });

  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.15);
  pdf.line(ix, iy + headerHeight + 11.1, ix + iw, iy + headerHeight + 11.1);

  // 4. Passenger Hero Name
  pdf.setTextColor(156, 163, 175);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.5);
  pdf.text("NAMA PENUMPANG / SANTRI", ix + 5.0, iy + 35.5);

  const studentName = fitSingleLineText(
    pdf,
    normalizeText(item.studentName).toUpperCase(),
    iw - 10.0,
    12.2,
    8.0,
    "bold",
  );
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(studentName.fontSize);
  pdf.text(studentName.text, ix + 5.0, iy + 40.5);

  if (item.studentNis) {
    const nisText = fitSingleLineText(pdf, `NIS: ${item.studentNis}`, 34, 6.4, 5.0, "bold");
    const nisBadgeW = pdf.getTextWidth(nisText.text) + 3.5;
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(ix + 5.0, iy + 42.8, nisBadgeW, 3.8, 0.8, 0.8, "F");
    pdf.setTextColor(75, 85, 99);
    pdf.setFontSize(nisText.fontSize);
    pdf.text(nisText.text, ix + 6.8, iy + 45.5);
  } else {
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(ix + 5.0, iy + 42.8, 21.0, 3.8, 0.8, 0.8, "F");
    pdf.setTextColor(107, 114, 128);
    pdf.setFontSize(5.6);
    pdf.text("PESERTA UMUM", ix + 5.8, iy + 45.5);
  }

  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.15);
  pdf.line(ix + 4.5, iy + 49.5, ix + iw - 4.5, iy + 49.5);

  // 5. Drop Point Section (Inside styled container box)
  const dropBoxX = ix + 4.5;
  const dropBoxY = iy + 52.5;
  const dropBoxW = iw - 9.0;
  const dropBoxH = 16.0;
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(dropBoxX, dropBoxY, dropBoxW, dropBoxH, 1.6, 1.6, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.18);
  pdf.roundedRect(dropBoxX, dropBoxY, dropBoxW, dropBoxH, 1.6, 1.6, "S");

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(5.2);
  pdf.text("TITIK TURUN (DROP POINT)", dropBoxX + 3.5, dropBoxY + 4.2);

  const dropPointValue = fitMultilineText(pdf, item.dropPointName, dropBoxW - 7.0, 2, 9.2, 7.2, "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(dropPointValue.fontSize);
  const dropLineH = Math.max(3.4, dropPointValue.fontSize * 0.38);
  dropPointValue.lines.forEach((line, index) => {
    pdf.text(line, dropBoxX + 3.5, dropBoxY + 8.8 + index * dropLineH);
  });

  // 6. Emergency Contact (Inside styled container box)
  const phoneBoxX = ix + 4.5;
  const phoneBoxY = iy + 71.0;
  const phoneBoxW = iw - 9.0;
  const phoneBoxH = 14.5;
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(phoneBoxX, phoneBoxY, phoneBoxW, phoneBoxH, 1.6, 1.6, "F");
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.18);
  pdf.roundedRect(phoneBoxX, phoneBoxY, phoneBoxW, phoneBoxH, 1.6, 1.6, "S");

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(5.2);
  pdf.text("KONTAK DARURAT / ORTU", phoneBoxX + 3.5, phoneBoxY + 4.2);

  const parentPhone = fitSingleLineText(pdf, item.parrentPhone || "-", phoneBoxW - 7.0, 9.2, 7.2, "bold");
  pdf.setTextColor(55, 65, 81);
  pdf.setFontSize(parentPhone.fontSize);
  pdf.text(parentPhone.text, phoneBoxX + 3.5, phoneBoxY + 9.8);

  // 7. Armada Bus Section (MOVED TO BOTTOM SECTION)
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(5.5);
  pdf.text("ARMADA BUS", ix + 5.0, iy + 89.2);

  const busCardW = iw - 9.0; // 63mm
  const busCardH = 24.0;
  const busCardX = ix + 4.5;
  const busCardY = iy + 91.2;

  pdf.setFillColor(...palette.header);
  pdf.roundedRect(busCardX, busCardY, busCardW, busCardH, 2.2, 2.2, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(busCardX, busCardY, busCardW, busCardH, 2.2, 2.2, "S");

  const busHeaderStrip = palette.header.map((c) => Math.round(c * 0.85)) as PdfRgb;
  pdf.setFillColor(...busHeaderStrip);
  pdf.roundedRect(busCardX, busCardY, busCardW, 4.8, 2.2, 2.2, "F");
  pdf.rect(busCardX, busCardY + 2.6, busCardW, 2.2, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(5.2);
  pdf.text("BUS PENUMPANG", busCardX + busCardW / 2, busCardY + 3.5, { align: "center" });

  const busValue = fitSingleLineText(pdf, item.busLabel || "-", busCardW - 5.0, 16.5, 9.5, "bold");
  pdf.setFontSize(busValue.fontSize);
  pdf.text(busValue.text, busCardX + busCardW / 2, busCardY + 16.0, { align: "center" });

  // 8. Inner Card Border (Clean rounded corners without bottom block clash)
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(ix, iy, iw, ih, 2.2, 2.2, "S");
}

function drawLuggageCardLargeLandscapePdf(
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

  // 1. Outer Cutting Border (Subtle Gray) and Plain White Frame
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(209, 213, 219);
  pdf.setLineWidth(0.18);
  pdf.rect(x, y, width, height, "FD");

  // Inset inner card (2.5mm plain white frame gap)
  const margin = 2.5;
  const ix = x + margin;
  const iy = y + margin;
  const iw = width - 2 * margin; // 122mm
  const ih = height - 2 * margin; // 72mm

  // Inner card background
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(ix, iy, iw, ih, 2.0, 2.0, "F");

  // Subtle watermark for Putri
  if (isPutri) {
    const wmColor = blendWithWhite(palette.header, 0.94);
    pdf.setDrawColor(...wmColor);
    pdf.setLineWidth(0.8);
    pdf.circle(ix + iw - 18, iy + ih - 20, 16, "S");
    pdf.circle(ix + iw - 18, iy + ih - 20, 8, "S");
  }

  // 2. Header Banner (height 15.5mm)
  const headerHeight = 15.5;
  pdf.setFillColor(...palette.header);
  pdf.roundedRect(ix, iy, iw, headerHeight, 2.0, 2.0, "F");
  pdf.rect(ix, iy + 2.0, iw, headerHeight - 2.0, "F");

  // Hole punch guide
  const punchX = ix + 6.0;
  const punchY = iy + 7.8;
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.2);
  pdf.circle(punchX, punchY, 2.0, "S");
  pdf.setFillColor(255, 255, 255);
  pdf.circle(punchX, punchY, 0.4, "F");

  // Title & Korda Name
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.4);
  pdf.text("LABEL BAGASI SANTRI", ix + 10.0, iy + 5.5);

  const kordaHeader = fitSingleLineText(
    pdf,
    normalizeText(item.kordaName).toUpperCase(),
    iw - 50,
    13.5,
    9.0,
    "bold",
  );
  pdf.setFontSize(kordaHeader.fontSize);
  pdf.text(kordaHeader.text, ix + 10.0, iy + 12.0);

  // Right Badges: Gender & Roster
  const genderPillW = 14.5;
  const genderPillH = 8.0;
  const genderPillX = ix + iw - 38.0;
  const genderPillY = iy + 3.8;
  pdf.setFillColor(...blendWithWhite(palette.header, 0.25));
  pdf.roundedRect(genderPillX, genderPillY, genderPillW, genderPillH, 1.6, 1.6, "F");
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.18);
  pdf.roundedRect(genderPillX, genderPillY, genderPillW, genderPillH, 1.6, 1.6, "S");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7.6);
  pdf.text(genderLabel, genderPillX + genderPillW / 2, genderPillY + 5.5, { align: "center" });

  const rosterBadgeW = 19.0;
  const rosterBadgeH = 10.0;
  const rosterBadgeX = ix + iw - 21.5;
  const rosterBadgeY = iy + 2.8;
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(rosterBadgeX, rosterBadgeY, rosterBadgeW, rosterBadgeH, 1.8, 1.8, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(rosterBadgeX, rosterBadgeY, rosterBadgeW, rosterBadgeH, 1.8, 1.8, "S");

  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(5.2);
  pdf.text("NO. URUT", rosterBadgeX + rosterBadgeW / 2, rosterBadgeY + 3.4, { align: "center" });
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(11.5);
  pdf.text(String(item.rosterNumber).padStart(3, "0"), rosterBadgeX + rosterBadgeW / 2, rosterBadgeY + 8.4, { align: "center" });

  // Accent line
  pdf.setFillColor(...palette.border);
  pdf.rect(ix, iy + headerHeight, iw, 0.7, "F");

  // 3. Hero Passenger Section
  pdf.setTextColor(156, 163, 175);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.2);
  pdf.text("NAMA PENUMPANG / SANTRI", ix + 5.5, iy + 20.8);

  const studentName = fitSingleLineText(
    pdf,
    normalizeText(item.studentName).toUpperCase(),
    iw - 11.0,
    13.8,
    9.5,
    "bold",
  );
  pdf.setTextColor(17, 24, 39);
  pdf.setFontSize(studentName.fontSize);
  pdf.text(studentName.text, ix + 5.5, iy + 26.8);

  if (item.studentNis) {
    const nisText = fitSingleLineText(pdf, `NIS: ${item.studentNis}`, 40, 7.2, 5.8, "bold");
    const nisBadgeW = pdf.getTextWidth(nisText.text) + 4.0;
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(ix + 5.5, iy + 29.2, nisBadgeW, 4.0, 1.0, 1.0, "F");
    pdf.setTextColor(75, 85, 99);
    pdf.setFontSize(nisText.fontSize);
    pdf.text(nisText.text, ix + 7.5, iy + 32.2);
  } else {
    pdf.setFillColor(243, 244, 246);
    pdf.roundedRect(ix + 5.5, iy + 29.2, 24.0, 4.0, 1.0, 1.0, "F");
    pdf.setTextColor(107, 114, 128);
    pdf.setFontSize(6.2);
    pdf.text("PESERTA UMUM", ix + 6.5, iy + 32.2);
  }

  // Mid divider
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.18);
  pdf.line(ix + 4.5, iy + 35.0, ix + iw - 4.5, iy + 35.0);

  // 4. Logistics Grid
  // Left: Drop Point
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(6.5);
  pdf.text("TITIK TURUN (DROP POINT)", ix + 5.5, iy + 39.5);

  const dropPointValue = fitMultilineText(
    pdf,
    item.dropPointName,
    54.0,
    2,
    9.5,
    7.5,
    "bold",
  );
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(dropPointValue.fontSize);
  const dropLineHeight = Math.max(3.6, dropPointValue.fontSize * 0.38);
  dropPointValue.lines.forEach((line, index) => {
    pdf.text(line, ix + 5.5, iy + 44.5 + index * dropLineHeight);
  });

  // Left: Emergency Parent Phone
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(6.2);
  pdf.text("KONTAK DARURAT / ORTU", ix + 5.5, iy + 56.5);

  const parentPhone = fitSingleLineText(pdf, item.parrentPhone || "-", 54.0, 9.2, 7.2, "bold");
  pdf.setTextColor(55, 65, 81);
  pdf.setFontSize(parentPhone.fontSize);
  pdf.text(parentPhone.text, ix + 5.5, iy + 61.5);

  // Column Divider Line
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.18);
  pdf.line(ix + 64.0, iy + 37.0, ix + 64.0, iy + 67.0);

  // Right: Armada Bus Focal Point Card
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(6.5);
  pdf.text("ARMADA BUS", ix + 67.5, iy + 39.5);

  const busCardX = ix + 67.5;
  const busCardY = iy + 41.5;
  const busCardW = 50.0;
  const busCardH = 20.5;
  pdf.setFillColor(...palette.header);
  pdf.roundedRect(busCardX, busCardY, busCardW, busCardH, 2.0, 2.0, "F");
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(busCardX, busCardY, busCardW, busCardH, 2.0, 2.0, "S");

  const busHeaderStrip = palette.header.map((c) => Math.round(c * 0.85)) as PdfRgb;
  pdf.setFillColor(...busHeaderStrip);
  pdf.roundedRect(busCardX, busCardY, busCardW, 4.8, 2.0, 2.0, "F");
  pdf.rect(busCardX, busCardY + 2.8, busCardW, 2.0, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(5.5);
  pdf.text("BUS PENUMPANG", busCardX + busCardW / 2, busCardY + 3.6, { align: "center" });

  const busValue = fitSingleLineText(pdf, item.busLabel || "-", busCardW - 4.0, 14.5, 9.0, "bold");
  pdf.setFontSize(busValue.fontSize);
  pdf.text(busValue.text, busCardX + busCardW / 2, busCardY + 14.5, { align: "center" });

  // 5. Inner Card Border (Clean rounded corners without bottom block clash)
  pdf.setDrawColor(...palette.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(ix, iy, iw, ih, 2.0, 2.0, "S");
}

function drawLuggageCardToPdf(
  pdf: jsPDF,
  item: PrintDataItem,
  x: number,
  y: number,
  width: number,
  height: number,
  cardSize: LuggageCardSize = "standard",
) {
  if (cardSize === "large_portrait") {
    drawLuggageCardPortraitPdf(pdf, item, x, y, width, height);
    return;
  }
  if (cardSize === "large_landscape") {
    drawLuggageCardLargeLandscapePdf(pdf, item, x, y, width, height);
    return;
  }
  drawLuggageCardStandardPdf(pdf, item, x, y, width, height);
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
  pdf.setFontSize(5.8);
  pdf.text(`NO. ${String(item.rosterNumber).padStart(3, "0")}`, x + width - 2, y + 3.9, {
    align: "right",
  });

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
