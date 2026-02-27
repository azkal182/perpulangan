import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BusAttendanceManifest } from "../actions/passenger.actions";

const PAGE_WIDTH = 210; // A4 portrait (mm)
const PAGE_HEIGHT = 297;
const PAGE_MARGIN = 10;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const NO_COLUMN_WIDTH = 10;
const NAME_COLUMN_WIDTH = 64;
const KAB_KOTA_COLUMN_WIDTH = 58;
const DROP_POINT_COLUMN_WIDTH =
  CONTENT_WIDTH - NO_COLUMN_WIDTH - NAME_COLUMN_WIDTH - KAB_KOTA_COLUMN_WIDTH;

type JourneyType = "outbound" | "return";

interface BuildBusAttendancePdfParams {
  eventName: string;
  journey: JourneyType;
  buses: BusAttendanceManifest[];
  generatedAt?: Date;
}

function getJourneyLabel(journey: JourneyType): string {
  return journey === "outbound" ? "Keberangkatan" : "Kepulangan";
}

function formatGeneratedAt(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function buildColumnStyles() {
  const styles: Record<number, { cellWidth: number; halign?: "left" | "center" }> = {
    0: { cellWidth: NO_COLUMN_WIDTH, halign: "center" },
    1: { cellWidth: NAME_COLUMN_WIDTH, halign: "left" },
    2: { cellWidth: KAB_KOTA_COLUMN_WIDTH, halign: "left" },
    3: { cellWidth: DROP_POINT_COLUMN_WIDTH, halign: "left" },
  };

  return styles;
}

export function buildBusAttendancePdf({
  eventName,
  journey,
  buses,
  generatedAt = new Date(),
}: BuildBusAttendancePdfParams): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const journeyLabel = getJourneyLabel(journey);
  const generatedAtLabel = formatGeneratedAt(generatedAt);
  const columnStyles = buildColumnStyles();

  buses.forEach((bus, busIndex) => {
    if (busIndex > 0) {
      doc.addPage();
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("DAFTAR ABSENSI ROMBONGAN BUS", PAGE_WIDTH / 2, 14, { align: "center" });
    doc.setFontSize(11);
    const busTitleLines = doc.splitTextToSize(`BUS: ${bus.busLabel}`, CONTENT_WIDTH);
    let busTitleY = 19;
    busTitleLines.forEach((line: string) => {
      doc.text(line, PAGE_WIDTH / 2, busTitleY, { align: "center" });
      busTitleY += 4.2;
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    let leftY = busTitleY + 2;
    doc.text(`Event: ${eventName}`, PAGE_MARGIN, leftY);
    leftY += 5;
    doc.text(`Perjalanan: ${journeyLabel}`, PAGE_MARGIN, leftY);
    leftY += 5;

    const kordaLabel =
      bus.kordaNames.length > 0 ? bus.kordaNames.join(", ") : "-";
    const kordaLines = doc.splitTextToSize(`Korda: ${kordaLabel}`, 120);
    kordaLines.forEach((line: string) => {
      doc.text(line, PAGE_MARGIN, leftY);
      leftY += 4.2;
    });

    const detailRight = [];
    if (bus.korwilName) {
      detailRight.push(`Korwil: ${bus.korwilName}`);
    }
    detailRight.push(
      `Peserta: ${bus.passengers.length}${bus.busCapacity > 0 ? ` / ${bus.busCapacity}` : ""}`,
    );
    detailRight.push(`Dicetak: ${generatedAtLabel}`);

    detailRight.forEach((line, index) => {
      doc.text(line, PAGE_WIDTH - PAGE_MARGIN, busTitleY + 2 + index * 5, { align: "right" });
    });

    const minimumRows = Math.max(bus.passengers.length, 12);
    const body = Array.from({ length: minimumRows }, (_, rowIndex) => {
      const passenger = bus.passengers[rowIndex];
      return [
        passenger ? String(rowIndex + 1) : "",
        passenger?.studentName ?? "",
        passenger?.kabKota ?? "",
        passenger?.dropPointName ?? "",
      ];
    });
    const tableHead = [["No", "Nama", "Kab/Kota", "Titik Turun"]] as unknown as never;
    const tableBody = body as unknown as never;

    autoTable(doc, {
      startY: Math.max(36, leftY + 1),
      head: tableHead,
      body: tableBody,
      theme: "grid",
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0.2,
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      styles: {
        fontSize: 9,
        cellPadding: { top: 1.5, right: 1.2, bottom: 1.5, left: 1.2 },
        textColor: 20,
        valign: "middle",
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: 20,
        fontStyle: "bold",
        halign: "center",
        minCellHeight: 14,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
      },
      bodyStyles: {
        minCellHeight: 7,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
      },
      columnStyles,
    });
  });

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Halaman ${page} / ${totalPages}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 6, {
      align: "right",
    });
    doc.setTextColor(0);
  }

  return doc;
}

export function openBusAttendancePdfInNewTab(
  doc: jsPDF,
  targetWindow?: Window | null,
): void {
  const pdfUrl = doc.output("bloburl");
  const previewWindow = targetWindow ?? window.open("", "_blank");
  if (!previewWindow) {
    throw new Error("Popup diblokir browser. Izinkan popup untuk membuka preview PDF.");
  }
  previewWindow.location.href = String(pdfUrl);
  previewWindow.focus();
}
