/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { KorwilGroupPDF } from "../actions/export-pdf.action";

const MARGIN = 15;
const PAGE_W = 210; // A4 portrait mm
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drawPageNumber(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Halaman ${i} dari ${total}`, PAGE_W / 2, PAGE_H - 8, {
      align: "center",
    });
    doc.setTextColor(0);
  }
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  doc.text(text, MARGIN, y);
  doc.setTextColor(0);
  return y + 6;
}

// ─── Page 1: Summary ──────────────────────────────────────────────────────────

function drawSummaryPage(doc: jsPDF, data: KorwilGroupPDF[]) {
  let y = MARGIN;

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("REKAPITULASI DATA SANTRI", PAGE_W / 2, y, { align: "center" });
  y += 7;

  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Dicetak: ${dateStr}`, PAGE_W / 2, y, { align: "center" });
  doc.setTextColor(0);
  y += 10;

  // Grand totals
  const grandTotal = data.reduce((s, k) => s + k.totalStudents, 0);
  const grandPutra = data.reduce((s, k) => s + k.putraCount, 0);
  const grandPutri = data.reduce((s, k) => s + k.putriCount, 0);

  // Grand total boxes
  const boxW = (CONTENT_W - 8) / 3;
  const boxes = [
    {
      label: "Total Santri",
      value: grandTotal,
      color: [30, 64, 120] as [number, number, number],
    },
    {
      label: "Putra",
      value: grandPutra,
      color: [37, 99, 180] as [number, number, number],
    },
    {
      label: "Putri",
      value: grandPutri,
      color: [180, 60, 120] as [number, number, number],
    },
  ];
  boxes.forEach((box, i) => {
    const x = MARGIN + i * (boxW + 4);
    doc.setFillColor(...box.color);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
    doc.setTextColor(255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(box.label, x + boxW / 2, y + 6, { align: "center" });
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(box.value), x + boxW / 2, y + 14, { align: "center" });
    doc.setTextColor(0);
  });
  y += 24;

  // ── Tabel Ringkasan per Korwil ──
  y = sectionTitle(doc, "Ringkasan per Koordinator Wilayah (Korwil)", y);

  autoTable(doc, {
    startY: y,

    head: [["No", "Korwil", "Total", "Putra", "Putri"]] as any,

    body: [
      ...data.map((k, i) => [
        i + 1,
        k.korwilName,
        k.totalStudents,
        k.putraCount,
        k.putriCount,
      ]),
      // Footer row
      ["", "TOTAL", grandTotal, grandPutra, grandPutri],
    ] as any,
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 120],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
    },
    // Bold last row (total)
    didParseCell: (hookData) => {
      if (hookData.row.index === data.length) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [220, 230, 245];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Tabel Ringkasan per Korda ──
  y = sectionTitle(doc, "Ringkasan per Koordinator Daerah (Korda)", y);

  // Flatten all kordas
  const allKordas: {
    korwil: string;
    korda: string;
    total: number;
    putra: number;
    putri: number;
  }[] = [];
  for (const korwil of data) {
    for (const korda of korwil.kordas) {
      const total = korda.putra.length + korda.putri.length;
      allKordas.push({
        korwil: korwil.korwilName,
        korda: korda.kordaName,
        total,
        putra: korda.putra.length,
        putri: korda.putri.length,
      });
    }
  }

  autoTable(doc, {
    startY: y,

    head: [["No", "Korwil", "Korda", "Total", "Putra", "Putri"]] as any,

    body: [
      ...allKordas.map((k, i) => [
        i + 1,
        k.korwil,
        k.korda,
        k.total,
        k.putra,
        k.putri,
      ]),
      ["", "", "TOTAL", grandTotal, grandPutra, grandPutri],
    ] as any,
    theme: "grid",
    headStyles: {
      fillColor: [30, 64, 120],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
    },
    didParseCell: (hookData) => {
      if (hookData.row.index === allKordas.length) {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fillColor = [220, 230, 245];
      }
    },
    margin: { left: MARGIN, right: MARGIN },
  });
}

// ─── Pages 2+: Detail per Korwil > Korda ─────────────────────────────────────

function drawDetailPages(doc: jsPDF, data: KorwilGroupPDF[]) {
  data.forEach((korwil) => {
    // Each korwil starts on a new page
    doc.addPage();

    let y = MARGIN;

    // Korwil header
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 120);
    doc.text("DAFTAR SANTRI", PAGE_W / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(13);
    doc.text(korwil.korwilName, PAGE_W / 2, y, { align: "center" });
    doc.setTextColor(0);
    y += 7;

    // Korwil summary line
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(
      `Total: ${korwil.totalStudents}  |  Putra: ${korwil.putraCount}  |  Putri: ${korwil.putriCount}`,
      PAGE_W / 2,
      y,
      { align: "center" },
    );
    doc.setTextColor(0);
    y += 10;

    korwil.kordas.forEach((korda, kordaIndex) => {
      // Every korda (except the first in this korwil) starts on a new page
      if (kordaIndex > 0) {
        doc.addPage();
        y = MARGIN;
      }

      const kordaTotal = korda.putra.length + korda.putri.length;

      // Korda header box
      doc.setFillColor(240, 244, 252);
      doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 64, 120);
      doc.text(korda.kordaName, MARGIN + 4, y + 5);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60);
      doc.text(
        `Total: ${kordaTotal}  |  Putra: ${korda.putra.length}  |  Putri: ${korda.putri.length}`,
        PAGE_W - MARGIN - 4,
        y + 5,
        { align: "right" },
      );
      doc.setTextColor(0);
      y += 16;

      // PUTRA TABLE
      if (korda.putra.length > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(37, 99, 180);
        doc.text(`Putra (${korda.putra.length})`, MARGIN, y);
        doc.setTextColor(0);
        y += 4;

        autoTable(doc, {
          startY: y,

          head: [["No", "Nama", "NIS", "Kabupaten/Kota"]] as any,
          body: korda.putra.map((s, idx) => [
            idx + 1,
            s.name,
            s.nis,
            s.regencyName,
          ]) as any,
          theme: "grid",
          headStyles: {
            fillColor: [37, 99, 180],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          styles: { fontSize: 9, cellPadding: 2 },
          columnStyles: { 0: { cellWidth: 10, halign: "center" } },
          margin: { left: MARGIN, right: MARGIN },
        });

        y = (doc as any).lastAutoTable.finalY + 5;
      }

      // PUTRI TABLE
      if (korda.putri.length > 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(180, 60, 120);
        doc.text(`Putri (${korda.putri.length})`, MARGIN, y);
        doc.setTextColor(0);
        y += 4;

        autoTable(doc, {
          startY: y,

          head: [["No", "Nama", "NIS", "Kabupaten/Kota"]] as any,
          body: korda.putri.map((s, idx) => [
            idx + 1,
            s.name,
            s.nis,
            s.regencyName,
          ]) as any,
          theme: "grid",
          headStyles: {
            fillColor: [180, 60, 120],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 9,
          },
          styles: { fontSize: 9, cellPadding: 2 },
          columnStyles: { 0: { cellWidth: 10, halign: "center" } },
          margin: { left: MARGIN, right: MARGIN },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }
    });
  });
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function generateStudentsPDF(data: KorwilGroupPDF[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Page 1: Summary
  drawSummaryPage(doc, data);

  // Pages 2+: Detail per korwil > korda
  drawDetailPages(doc, data);

  // Page numbers (done last so total is known)
  drawPageNumber(doc);

  const timestamp = new Date().toISOString().split("T")[0];
  doc.save(`Daftar_Santri_${timestamp}.pdf`);
}
