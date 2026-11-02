import { createExcelWorkbookBlob, downloadExcelBlob, type ExcelCell, type ExcelWorksheet } from "@/lib/excel-workbook";

export interface RegistrationExportRow {
  studentName: string;
  gender: "L" | "P" | "-";
  paymentStatus: "PAID" | "UNPAID";
  direction: string;
  journeyStatus: string;
  destinationKorda: string;
  travelPoint: string;
  bus: string;
}

export interface RegistrationExportKordaGroup {
  kordaName: string;
  rows: RegistrationExportRow[];
}

export interface RegistrationExportKorwilSheet {
  korwilName: string;
  kordas: RegistrationExportKordaGroup[];
}

interface GenderTotals {
  total: number;
  putra: number;
  putri: number;
  paid: number;
  unpaid: number;
}

function getRowsTotals(rows: RegistrationExportRow[]): GenderTotals {
  return {
    total: rows.length,
    putra: rows.filter((row) => row.gender === "L").length,
    putri: rows.filter((row) => row.gender === "P").length,
    paid: rows.filter((row) => row.paymentStatus === "PAID").length,
    unpaid: rows.filter((row) => row.paymentStatus === "UNPAID").length,
  };
}

function getKorwilTotals(sheet: RegistrationExportKorwilSheet): GenderTotals {
  return sheet.kordas.reduce<GenderTotals>((total, korda) => {
    const kordaTotals = getRowsTotals(korda.rows);
    total.total += kordaTotals.total;
    total.putra += kordaTotals.putra;
    total.putri += kordaTotals.putri;
    total.paid += kordaTotals.paid;
    total.unpaid += kordaTotals.unpaid;
    return total;
  }, { total: 0, putra: 0, putri: 0, paid: 0, unpaid: 0 });
}

function text(value: string, style: ExcelCell["style"] = "default"): ExcelCell {
  return { value, style };
}

function number(value: number, style: ExcelCell["style"] = "textCenter"): ExcelCell {
  return { value, style };
}

function merged(value: string, mergeAcross: number, style: ExcelCell["style"] = "section"): ExcelCell {
  return { value, mergeAcross, style };
}

function buildSummaryWorksheet(
  sheets: RegistrationExportKorwilSheet[],
  directionLabel: string,
): ExcelWorksheet {
  const totalKorda = sheets.reduce((sum, sheet) => sum + sheet.kordas.length, 0);
  const grandTotals = sheets.reduce<GenderTotals>((total, sheet) => {
    const korwilTotals = getKorwilTotals(sheet);
    total.total += korwilTotals.total;
    total.putra += korwilTotals.putra;
    total.putri += korwilTotals.putri;
    total.paid += korwilTotals.paid;
    total.unpaid += korwilTotals.unpaid;
    return total;
  }, { total: 0, putra: 0, putri: 0, paid: 0, unpaid: 0 });
  const rows: ExcelCell[][] = [
    [merged(`RINGKASAN EXPORT PESERTA - ${directionLabel.toLocaleUpperCase("id-ID")}`, 7, "title")],
    [merged(`Dibuat: ${new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`, 7, "muted")],
    [],
    [text("Jumlah peserta pada arah terpilih", "header"), number(grandTotals.total), text("Lunas", "header"), number(grandTotals.paid), text("Belum lunas", "header"), number(grandTotals.unpaid), text("Jumlah Putra", "header"), number(grandTotals.putra)],
    [text("Jumlah Putri", "header"), number(grandTotals.putri), text("Jumlah Korwil", "header"), number(sheets.length), text("Jumlah Korda", "header"), number(totalKorda), text(""), text("")],
    [],
    [merged("RINGKASAN PER KORWIL", 7)],
    [text("No", "headerCenter"), text("Korwil", "header"), text("Jumlah Korda", "headerCenter"), text("Peserta", "headerCenter"), text("Lunas", "headerCenter"), text("Belum lunas", "headerCenter"), text("Putra", "headerCenter"), text("Putri", "headerCenter")],
  ];

  if (!sheets.length) rows.push([merged("Tidak ada data perjalanan untuk diringkas", 7, "muted")]);
  else sheets.forEach((sheet, index) => {
    const totals = getKorwilTotals(sheet);
    rows.push([number(index + 1), text(sheet.korwilName), number(sheet.kordas.length), number(totals.total), number(totals.paid), number(totals.unpaid), number(totals.putra), number(totals.putri)]);
  });

  rows.push([], [merged("RINGKASAN PER KORWIL - KORDA", 7)], [text("No", "headerCenter"), text("Korwil", "header"), text("Korda", "header"), text("Peserta", "headerCenter"), text("Lunas", "headerCenter"), text("Belum lunas", "headerCenter"), text("Putra", "headerCenter"), text("Putri", "headerCenter")]);
  if (!sheets.length) rows.push([merged("Tidak ada data perjalanan untuk diringkas", 7, "muted")]);
  else {
    let rowNumber = 1;
    for (const sheet of sheets) {
      for (const korda of sheet.kordas) {
        const totals = getRowsTotals(korda.rows);
        rows.push([number(rowNumber++), text(sheet.korwilName), text(korda.kordaName), number(totals.total), number(totals.paid), number(totals.unpaid), number(totals.putra), number(totals.putri)]);
      }
    }
  }

  return { name: "Ringkasan", columns: [45, 220, 180, 110, 90, 110, 90, 90], rows };
}

function buildDropPointSummaryWorksheet(
  sheets: RegistrationExportKorwilSheet[],
  directionLabel: string,
): ExcelWorksheet {
  const rows: ExcelCell[][] = [
    [merged(`RINGKASAN TITIK TURUN - ${directionLabel.toLocaleUpperCase("id-ID")}`, 2, "title")],
    [merged(`Dibuat: ${new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`, 2, "muted")],
    [],
  ];

  if (!sheets.length) {
    rows.push([merged("Tidak ada data perjalanan untuk diringkas", 2, "muted")]);
    return { name: "Ringkasan Titik Turun", columns: [45, 280, 130], rows };
  }

  for (const sheet of sheets) {
    rows.push([merged(`KORWIL: ${sheet.korwilName}`, 2, "section")]);

    for (const korda of sheet.kordas) {
      const pointCounts = new Map<string, number>();

      for (const row of korda.rows) {
        const pointName = row.travelPoint.trim() || "Titik turun belum tersedia";
        pointCounts.set(pointName, (pointCounts.get(pointName) ?? 0) + 1);
      }

      rows.push([merged(`KORDA: ${korda.kordaName}`, 2)]);
      rows.push([
        text("No", "headerCenter"),
        text("Titik turun", "header"),
        text("Jumlah peserta", "headerCenter"),
      ]);

      const sortedPoints = [...pointCounts.entries()].sort(([first], [second]) =>
        first.localeCompare(second, "id", { sensitivity: "base" }),
      );

      if (!sortedPoints.length) {
        rows.push([merged("Tidak ada titik turun", 2, "muted")]);
      } else {
        sortedPoints.forEach(([pointName, participantCount], index) => {
          rows.push([number(index + 1), text(pointName), number(participantCount)]);
        });
        rows.push([
          text("Total Korda", "header"),
          text(""),
          number(korda.rows.length, "textCenter"),
        ]);
      }

      rows.push([]);
    }
  }

  return { name: "Ringkasan Titik Turun", columns: [45, 280, 130], rows };
}

function sanitizeSheetName(rawName: string, fallbackIndex: number): string {
  const cleaned = rawName.replace(/[:\\/?*\[\]]/g, " ").replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim().replace(/^'+|'+$/g, "");
  return (cleaned || `Korwil ${fallbackIndex + 1}`).slice(0, 31);
}

function uniqueSheetName(rawName: string, fallbackIndex: number, usedNames: Set<string>): string {
  const base = sanitizeSheetName(rawName, fallbackIndex);
  let candidate = base;
  let counter = 2;
  while (usedNames.has(candidate.toLocaleLowerCase("en-US"))) {
    const suffix = ` (${counter++})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  usedNames.add(candidate.toLocaleLowerCase("en-US"));
  return candidate;
}

export function buildRegistrationsExcelBlob(
  sheets: RegistrationExportKorwilSheet[],
  directionLabel: string,
): Blob {
  const usedNames = new Set<string>();
  const worksheets: ExcelWorksheet[] = [
    buildSummaryWorksheet(sheets, directionLabel),
    buildDropPointSummaryWorksheet(sheets, directionLabel),
  ];
  usedNames.add("ringkasan");
  usedNames.add("ringkasan titik turun");

  sheets.forEach((sheet, sheetIndex) => {
    const rows: ExcelCell[][] = [[merged(`KORWIL: ${sheet.korwilName}`, 7, "title")], []];
    if (!sheet.kordas.length) rows.push([merged("Tidak ada data pada arah perjalanan terpilih", 7, "section")]);
    for (const [kordaIndex, korda] of sheet.kordas.entries()) {
      rows.push([merged(`KORDA: ${korda.kordaName}`, 7)]);
      rows.push([text("No", "headerCenter"), text("Nama", "header"), text("L/P", "headerCenter"), text("Arah", "headerCenter"), text("Status perjalanan", "header"), text("Korda tujuan", "header"), text("Titik perjalanan", "header"), text("Bus", "header")]);
      if (!korda.rows.length) rows.push([merged("Tidak ada data pada korda ini", 7, "muted")]);
      else korda.rows.forEach((row, rowIndex) => rows.push([
        number(rowIndex + 1), text(row.studentName), text(row.gender, "textCenter"), text(row.direction, "textCenter"), text(row.journeyStatus, "textCenter"), text(row.destinationKorda), text(row.travelPoint), text(row.bus),
      ]));
      if (kordaIndex < sheet.kordas.length - 1) rows.push([]);
    }
    worksheets.push({ name: uniqueSheetName(sheet.korwilName, sheetIndex, usedNames), columns: [45, 210, 45, 120, 135, 140, 160, 110], rows });
  });

  return createExcelWorkbookBlob(worksheets);
}

export function downloadRegistrationsExcel(
  sheets: RegistrationExportKorwilSheet[],
  filename: string,
  directionLabel: string,
) {
  downloadExcelBlob(buildRegistrationsExcelBlob(sheets, directionLabel), filename);
}
