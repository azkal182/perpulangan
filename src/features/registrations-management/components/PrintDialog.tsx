"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileDown, Eye } from "lucide-react";
import { getPrintDataAction } from "../actions/print-actions";
import type {
  PaperSize,
  PrintType,
  PrintDataItem,
} from "../lib/print-utils";
import { calculateLayout, PAPER_SIZES } from "../lib/print-utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { LuggageCardTemplate } from "./print-templates/LuggageCardTemplate";
import { TicketTemplate } from "./print-templates/TicketTemplate";

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  kordas: Array<{ id: string; name: string }>;
  dropPoints: Array<{ id: string; name: string }>;
}

export function PrintDialog({
  open,
  onOpenChange,
  eventId,
  kordas,
  dropPoints,
}: PrintDialogProps) {
  const [printType, setPrintType] = useState<PrintType>("luggage_card");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [genderFilter, setGenderFilter] = useState<"all" | "L" | "P">("all");
  const [kordaFilter, setKordaFilter] = useState<string>("all");
  const [dropPointFilter, setDropPointFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PrintDataItem[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    console.log("🔍 Preview clicked, fetching data...");
    try {
      const result = await getPrintDataAction({
        eventId,
        gender: genderFilter === "all" ? undefined : genderFilter,
        kordaId: kordaFilter === "all" ? undefined : kordaFilter,
        dropPointId: dropPointFilter === "all" ? undefined : dropPointFilter,
      });

      console.log("📦 Server response:", result);

      if (result.success && result.data) {
        console.log(`✅ Got ${result.data.length} items`);
        if (result.data.length === 0) {
          toast.error("Tidak ada data ditemukan dengan filter yang dipilih");
          setLoading(false);
          return;
        }
        setPreviewData(result.data);
        setShowPreview(true);
        toast.success(`Preview siap: ${result.data.length} item`);
      } else {
        console.error("❌ Error from server:", result.error);
        toast.error(result.error || "Gagal memuat data");
      }
    } catch (error) {
      console.error("💥 Exception:", error);
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
      const totalPages = Math.ceil(previewData.length / cardsPerPage);

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const startIndex = pageIndex * cardsPerPage;
        const endIndex = Math.min(startIndex + cardsPerPage, previewData.length);
        const pageData = previewData.slice(startIndex, endIndex);

        // Create temporary container - ISOLATED from all CSS
        const container = document.createElement("div");
        container.style.cssText = `
          position: absolute;
          left: -9999px;
          top: 0;
          width: ${paper.width}mm;
          height: ${paper.height}mm;
          background: white;
          display: grid;
          grid-template-columns: repeat(${layout.columns}, 1fr);
          grid-template-rows: repeat(${layout.rows}, 1fr);
          gap: ${layout.gapY}mm ${layout.gapX}mm;
          padding: ${layout.marginY}mm ${layout.marginX}mm;
          font-family: Arial, sans-serif;
          box-sizing: border-box;
        `;
        document.body.appendChild(container);

        // Render cards with pure HTML (no React, no Tailwind)
        pageData.forEach((item) => {
          const cardWrapper = document.createElement("div");
          cardWrapper.style.cssText = "all: initial; display: block;";
          container.appendChild(cardWrapper);

          cardWrapper.innerHTML = renderComponentToHTML(
            printType === "luggage_card" ? LuggageCardTemplate : TicketTemplate,
            {
              data: item,
              width: layout.cardWidth,
              height: layout.cardHeight,
            }
          );
        });

        // Convert to canvas and add to PDF
        const canvas = await html2canvas(container, {
          scale: 2, // Lower scale for better performance, still crisp
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc) => {
            // CRITICAL: Remove all global stylesheets to avoid lab()/oklab() parsing errors
            // Our print templates use pure inline styles, so we don't need any external CSS
            clonedDoc
              .querySelectorAll('link[rel="stylesheet"], style')
              .forEach((el) => el.remove());
          },
        });

        // Add image at exact paper dimensions (no conversion needed)
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, paper.width, paper.height);

        // Cleanup
        document.body.removeChild(container);
      }

      // Download PDF
      const filename = `${printType === "luggage_card" ? "kartu_barang" : "tiket"}_${paperSize}_${new Date().getTime()}.pdf`;
      pdf.save(filename);

      toast.dismiss();
      toast.success(`PDF berhasil dibuat (${previewData.length} item)`);
      onOpenChange(false);
    } catch (error) {
      toast.dismiss();
      toast.error("Gagal membuat PDF");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cetak Kartu & Tiket</DialogTitle>
          <DialogDescription>
            Pilih jenis dokumen, filter, dan ukuran kertas untuk print
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Print Type */}
          <div className="space-y-3">
            <Label>Jenis Dokumen</Label>
            <RadioGroup
              value={printType}
              onValueChange={(value) => {
                setPrintType(value as PrintType);
                setShowPreview(false);
              }}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="luggage_card" id="luggage_card" />
                <Label htmlFor="luggage_card" className="font-normal">
                  Kartu Barang (Gender-Based Colors)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ticket" id="ticket" />
                <Label htmlFor="ticket" className="font-normal">
                  Tiket Perjalanan (Gradient Design)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Filter Gender</Label>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Select value={genderFilter} onValueChange={(v: any) => { setGenderFilter(v); setShowPreview(false); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="L">Putra</SelectItem>
                  <SelectItem value="P">Putri</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter Korda</Label>
              <Select value={kordaFilter} onValueChange={(v) => { setKordaFilter(v); setShowPreview(false); }}>
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
              <Select value={dropPointFilter} onValueChange={(v) => { setDropPointFilter(v); setShowPreview(false); }}>
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
            <Select value={paperSize} onValueChange={(v: PaperSize) => { setPaperSize(v); setShowPreview(false); }}>
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

          {/* Preview Info */}
          {showPreview && previewData && (
            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800">
                ✅ Preview siap: {previewData.length} item akan dicetak
              </p>
              <p className="mt-1 text-xs text-green-600">
                Layout: {calculateLayout(paperSize, printType).columns} kolom x{" "}
                {calculateLayout(paperSize, printType).rows} baris per halaman
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to render React component to HTML string (simplified)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderComponentToHTML(Component: any, props: any): string {
  // Support both L/P and PUTRA/PUTRI formats
  const gender = props.data.studentGender?.toUpperCase();
  const isPutra = gender === "PUTRA" || gender === "LAKI-LAKI" || gender === "L";

  if (Component.name === "LuggageCardTemplate") {
    // Modern color palette with gradients
    const headerGradient = isPutra 
      ? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)" 
      : "linear-gradient(135deg, #be185d 0%, #ec4899 100%)";
    const bgColor = isPutra ? "#f0f9ff" : "#fdf2f8";
    const borderColor = isPutra ? "#3b82f6" : "#ec4899";
    const accentColor = isPutra ? "#1e40af" : "#be185d";

    return `
      <div style="all:initial;display:flex;flex-direction:column;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;width:${props.width}mm;height:${props.height}mm;border:3px solid ${borderColor};background:${bgColor};border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1),0 2px 4px rgba(0,0,0,0.06)">
        <div style="background:${headerGradient};padding:10px 16px;text-align:center;box-sizing:border-box">
          <div style="font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.5px;font-family:'Segoe UI',Arial,sans-serif">✦ KARTU BARANG ${isPutra ? "PUTRA" : "PUTRI"} ✦</div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px;font-size:9.5px;box-sizing:border-box;background:#ffffff;margin:3px;border-radius:8px">
          <div style="font-family:'Segoe UI',Arial,sans-serif">
            <div style="font-size:8px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Nama</div>
            <div style="font-weight:600;color:#1f2937;font-size:10px;line-height:1.3;font-family:'Segoe UI',Arial,sans-serif">${props.data.studentName}</div>
            <div style="font-size:8px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.3px;margin-top:8px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">NIS</div>
            <div style="font-weight:500;color:#374151;font-family:'Segoe UI',Arial,sans-serif">${props.data.studentNis}</div>
            <div style="font-size:8px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.3px;margin-top:8px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Korda</div>
            <div style="font-weight:500;color:#374151;font-family:'Segoe UI',Arial,sans-serif">${props.data.kordaName}</div>
          </div>
          <div style="font-family:'Segoe UI',Arial,sans-serif">
            <div style="font-size:8px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Drop Point</div>
            <div style="font-weight:500;color:#374151;font-family:'Segoe UI',Arial,sans-serif">${props.data.dropPointName}</div>
            <div style="font-size:8px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.3px;margin-top:8px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Bus</div>
            <div style="font-weight:600;color:#1f2937;font-size:10px;font-family:'Segoe UI',Arial,sans-serif">${props.data.busLabel || "-"}</div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Ticket template - modern design with teal/emerald theme
    return `
      <div style="all:initial;display:flex;flex-direction:column;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;width:${props.width}mm;height:${props.height}mm;border:3px solid #14b8a6;background:#f0fdfa;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1),0 2px 4px rgba(0,0,0,0.06)">
        <div style="background:#0d9488;padding:12px 16px;text-align:center;box-sizing:border-box;border-bottom:3px solid #14b8a6">
          <div style="font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px;font-family:'Segoe UI',Arial,sans-serif">🎫 TIKET PERJALANAN 🎫</div>
        </div>
        <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;font-size:10px;box-sizing:border-box;background:#ffffff;margin:4px;border-radius:8px">
          <div style="font-family:'Segoe UI',Arial,sans-serif">
            <div style="font-size:8px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Nama Peserta</div>
            <div style="font-weight:700;color:#1f2937;font-size:11px;line-height:1.3;font-family:'Segoe UI',Arial,sans-serif">${props.data.studentName}</div>
            <div style="font-size:8px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.3px;margin-top:10px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Nomor Induk</div>
            <div style="font-weight:600;color:#374151;font-family:'Segoe UI',Arial,sans-serif">${props.data.studentNis}</div>
            <div style="font-size:8px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.3px;margin-top:10px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Koordinator Daerah</div>
            <div style="font-weight:600;color:#374151;font-family:'Segoe UI',Arial,sans-serif">${props.data.kordaName}</div>
          </div>
          <div style="font-family:'Segoe UI',Arial,sans-serif">
            <div style="font-size:8px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Titik Pemberangkatan</div>
            <div style="font-weight:600;color:#374151;font-family:'Segoe UI',Arial,sans-serif">${props.data.dropPointName}</div>
            <div style="font-size:8px;font-weight:600;color:#0d9488;text-transform:uppercase;letter-spacing:0.3px;margin-top:10px;margin-bottom:2px;font-family:'Segoe UI',Arial,sans-serif">Nomor Bus</div>
            <div style="font-weight:700;color:#1f2937;font-size:11px;background:#d1fae5;padding:4px 8px;border-radius:4px;display:inline-block;font-family:'Segoe UI',Arial,sans-serif">${props.data.busLabel || "-"}</div>
          </div>
        </div>
        <div style="border-top:2px dashed #5eead4;padding:10px;text-align:center;box-sizing:border-box;background:#ecfdf5;margin:4px 4px 4px 4px;border-radius:0 0 6px 6px">
          <p style="all:initial;display:block;text-align:center;font-size:8.5px;font-weight:600;font-style:italic;color:#0f766e;font-family:'Segoe UI',Arial,sans-serif;margin:0;letter-spacing:0.2px">✓ Simpan tiket ini dengan baik selama perjalanan</p>
        </div>
      </div>
    `;
  }
}
