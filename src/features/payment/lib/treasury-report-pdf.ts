import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { TreasuryOfficialReportData } from "../actions/treasury-report.actions";

const PAGE_MARGIN = 13;
const NAVY: [number, number, number] = [24, 48, 79];
const BLUE: [number, number, number] = [42, 89, 135];
const LIGHT_BLUE: [number, number, number] = [232, 240, 247];

function money(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function reportNumber(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
  return `KEU-PUSAT-${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}`;
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(210, 218, 226);
    doc.line(PAGE_MARGIN, height - 12, width - PAGE_MARGIN, height - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(95, 105, 115);
    doc.text("Perpulangan · Laporan Keuangan Pusat · Dokumen sistem", PAGE_MARGIN, height - 7);
    doc.text(`Halaman ${page} dari ${pageCount}`, width - PAGE_MARGIN, height - 7, { align: "right" });
  }
}

export function buildTreasuryOfficialPdf(data: TreasuryOfficialReportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const summary = data.summary;
  const code = reportNumber(data.generatedAt);

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PERPULANGAN  |  ADMINISTRASI KEUANGAN", PAGE_MARGIN, 11);
  doc.setFontSize(19);
  doc.text("LAPORAN KEUANGAN PUSAT", PAGE_MARGIN, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Ringkasan seluruh event dan seluruh arah perjalanan", PAGE_MARGIN, 29);

  doc.setTextColor(35, 45, 55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Nomor laporan", pageWidth - PAGE_MARGIN - 73, 43);
  doc.text("Waktu dibuat", pageWidth - PAGE_MARGIN - 73, 50);
  doc.setFont("helvetica", "normal");
  doc.text(code, pageWidth - PAGE_MARGIN, 43, { align: "right" });
  doc.text(formatDateTime(data.generatedAt), pageWidth - PAGE_MARGIN, 50, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(12);
  doc.text("1. Ringkasan keuangan", PAGE_MARGIN, 47);

  const summaryRows = [
    ["Tagihan global", money(summary.grossBilled), "Fee tagihan global", money(summary.billedFee)],
    ["Uang masuk global (sesuai rek)", money(summary.bankReceipts), "Fee masuk", money(summary.receivedFee)],
    ["Hak setelah fee", money(summary.netEntitlement), "Kelebihan pembayaran", money(summary.excessPayment)],
    ["Kas", money(summary.centralCash), "Total pengeluaran", money(summary.totalExpenses)],
  ];
  autoTable(doc, {
    startY: 56,
    head: [["Indikator", "Nilai", "Indikator", "Nilai"]],
    body: summaryRows,
    theme: "grid",
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: [35, 45, 55], lineColor: [215, 222, 229], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 60, fontStyle: "bold" }, 1: { cellWidth: 62, halign: "right" }, 2: { cellWidth: 60, fontStyle: "bold" }, 3: { cellWidth: 62, halign: "right" } },
  });

  const afterSummary = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 105;
  const definitions = [
    `Total pengeluaran: ${money(summary.refunds)} refund aktual + ${money(summary.disbursements)} pencairan ke Korda.`,
    "Hak setelah fee adalah hak pembukuan berbasis tagihan, bukan jumlah kas yang sudah diterima.",
    "Fee masuk dihitung proporsional dari penerimaan bersih yang dialokasikan ke tagihan perjalanan; Saldo Lain tidak dikenai fee.",
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 95);
  let noteY = afterSummary + 8;
  for (const line of definitions) {
    const lines = doc.splitTextToSize(`- ${line}`, pageWidth - PAGE_MARGIN * 2);
    doc.text(lines, PAGE_MARGIN, noteY);
    noteY += lines.length * 4 + 1;
  }

  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.setFontSize(15);
  doc.text("2. Posisi dana per Korda", PAGE_MARGIN, 18);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 95);
  doc.setFontSize(9);
  doc.text("Nilai mencakup seluruh event serta perjalanan Pulang dan Pergi.", PAGE_MARGIN, 24);

  const total = data.kordas.reduce((acc, row) => ({
    grossBilled: acc.grossBilled + row.grossBilled,
    billedFee: acc.billedFee + row.billedFee,
    netEntitlement: acc.netEntitlement + row.netEntitlement,
    registrationReceipts: acc.registrationReceipts + row.registrationReceipts,
    receivedFee: acc.receivedFee + row.receivedFee,
    excessPayment: acc.excessPayment + row.excessPayment,
    disbursed: acc.disbursed + row.disbursed,
  }), { grossBilled: 0, billedFee: 0, netEntitlement: 0, registrationReceipts: 0, receivedFee: 0, excessPayment: 0, disbursed: 0 });

  autoTable(doc, {
    startY: 31,
    head: [["Korda tujuan", "Tagihan", "Fee tagihan", "Hak setelah fee", "Penerimaan tagihan", "Fee masuk", "Saldo Lain", "Dicairkan", "Maks. dapat dicairkan"]],
    body: [
      ...data.kordas.map((row) => [row.name, money(row.grossBilled), money(row.billedFee), money(row.netEntitlement), money(row.registrationReceipts), money(row.receivedFee), money(row.excessPayment), money(row.disbursed), money(row.currentlyDisbursable)]),
      ["TOTAL", money(total.grossBilled), money(total.billedFee), money(total.netEntitlement), money(total.registrationReceipts), money(total.receivedFee), money(total.excessPayment), money(total.disbursed), money(summary.currentlyDisbursableTotal)],
    ],
    theme: "grid",
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 17 },
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2.2, textColor: [35, 45, 55], lineColor: [215, 222, 229], lineWidth: 0.15, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "center", minCellHeight: 12 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 37, halign: "left" },
      1: { cellWidth: 27, halign: "right" },
      2: { cellWidth: 25, halign: "right" },
      3: { cellWidth: 28, halign: "right" },
      4: { cellWidth: 29, halign: "right" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 25, halign: "right" },
      7: { cellWidth: 25, halign: "right" },
      8: { cellWidth: 29, halign: "right" },
    },
    didParseCell: (hook) => {
      if (hook.section === "body" && hook.row.index === data.kordas.length) {
        hook.cell.styles.fillColor = LIGHT_BLUE;
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  const pageCountBeforeFooter = doc.getNumberOfPages();
  for (let page = 1; page <= pageCountBeforeFooter; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 100, 110);
      doc.setFontSize(8);
      doc.text(`Nomor laporan: ${code}`, doc.internal.pageSize.getWidth() - PAGE_MARGIN, 18, { align: "right" });
    }
  }
  drawFooter(doc);
  return doc;
}

export function downloadTreasuryOfficialPdf(data: TreasuryOfficialReportData) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(data.generatedAt));
  buildTreasuryOfficialPdf(data).save(`laporan_resmi_keuangan_pusat_${date}.pdf`);
}
