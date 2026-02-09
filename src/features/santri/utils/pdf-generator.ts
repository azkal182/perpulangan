"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { KorwilGroupPDF } from "../actions/export-pdf.action";

/**
 * Generate formal PDF report for students grouped by Korwil and Korda
 */
export function generateStudentsPDF(data: KorwilGroupPDF[]) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // PDF Settings
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  data.forEach((korwil, korwilIndex) => {
    // Add page break between Korwils (except first)
    if (korwilIndex > 0) {
      doc.addPage();
    }

    let currentY = margin;

    // === HEADER ===
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("DAFTAR SANTRI", pageWidth / 2, currentY, { align: "center" });
    currentY += 7;

    doc.setFontSize(14);
    doc.text(korwil.korwilName, pageWidth / 2, currentY, { align: "center" });
    currentY += 10;

    // === KORWIL SUMMARY ===
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Santri: ${korwil.totalStudents}`, margin, currentY);
    currentY += 5;
    doc.text(`Putra: ${korwil.putraCount}`, margin, currentY);
    currentY += 5;
    doc.text(`Putri: ${korwil.putriCount}`, margin, currentY);
    currentY += 8;

    // === TABLES PER KORDA ===
    korwil.kordas.forEach((korda) => {
      // Check if we need a new page (basic check)
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = margin;
      }

      // Korda Header
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${korda.kordaName}`, margin, currentY);
      currentY += 6;

      // PUTRA TABLE
      if (korda.putra.length > 0) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Putra (${korda.putra.length})`, margin, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          head: [["No", "Nama", "NIS", "Kabupaten/Kota"]] as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body: korda.putra.map((s, idx) => [
            idx + 1,
            s.name,
            s.nis,
            s.regencyName,
          ]) as any,
          theme: "grid",
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 9,
            cellPadding: 2,
          },
          margin: { left: margin, right: margin },
          didDrawPage: (hookData) => {
            // Update currentY after table
            currentY = hookData.cursor?.y || currentY;
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentY = (doc as any).lastAutoTable.finalY + 5;
      }

      // PUTRI TABLE
      if (korda.putri.length > 0) {
        // Check page break
        if (currentY > pageHeight - 60) {
          doc.addPage();
          currentY = margin;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Putri (${korda.putri.length})`, margin, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          head: [["No", "Nama", "NIS", "Kabupaten/Kota"]] as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          body: korda.putri.map((s, idx) => [
            idx + 1,
            s.name,
            s.nis,
            s.regencyName,
          ]) as any,
          theme: "grid",
          headStyles: {
            fillColor: [255, 105, 180],
            textColor: 255,
            fontStyle: "bold",
          },
          styles: {
            fontSize: 9,
            cellPadding: 2,
          },
          margin: { left: margin, right: margin },
          didDrawPage: (hookData) => {
            currentY = hookData.cursor?.y || currentY;
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }
    });

    // === FOOTER WITH PAGE NUMBER ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Halaman ${i} dari ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }
  });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `Daftar_Santri_${timestamp}.pdf`;

  // Download PDF
  doc.save(filename);
}
