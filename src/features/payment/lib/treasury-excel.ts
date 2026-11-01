import { createExcelWorkbookBlob, downloadExcelBlob, type ExcelCell, type ExcelWorksheet } from "@/lib/excel-workbook";
import type {
  TreasuryExportData,
  TreasuryExportGroup,
} from "../actions/treasury-export.actions";

function text(value: string, style: ExcelCell["style"] = "default"): ExcelCell {
  return { value, style };
}

function number(value: number, style: ExcelCell["style"] = "currency"): ExcelCell {
  return { value, style };
}

function buildArmadaSheet(titleText: string, groups: TreasuryExportGroup[]): ExcelWorksheet {
  const rows: ExcelCell[][] = [
    [{ value: titleText, style: "title", mergeAcross: 8 }],
    [text("KORWIL", "header"), text("KORDA", "header"), text("HARGA TIKET", "header"), text("PESERTA", "headerCenter"), text("TOTAL", "header"), text("FEE PONDOK", "header"), text("HASIL SETELAH FEE", "header"), text("PEMBAYARAN ARMADA", "header"), text("FEE KORDA", "header")],
  ];

  if (!groups.length) rows.push([{ value: "Tidak ada data untuk perjalanan ini", style: "muted", mergeAcross: 8 }]);
  else for (const group of groups) {
    rows.push([
      text(group.korwilName),
      text(group.kordaName),
      number(group.tariff),
      number(group.participants, "integer"),
      number(group.total),
      number(group.feePondok),
      number(group.afterFee),
      text(group.paymentArmada),
      text(group.feeKorda),
    ]);
  }

  return { name: titleText, columns: [145, 220, 105, 75, 110, 110, 130, 145, 100], rows };
}

function buildFeeSheet(data: TreasuryExportData): ExcelWorksheet {
  const directionTitle = data.direction === "both" ? "PULANG DAN PERGI" : data.direction === "outbound" ? "PULANG" : "PERGI";
  const rows: ExcelCell[][] = [
    [{ value: `LAPORAN FEE ${directionTitle}`, style: "title", mergeAcross: 7 }],
    [text("NO", "headerCenter"), text("TANGGAL", "header"), text("NAMA", "header"), text("KETERANGAN", "header"), text("DEBIT", "header"), text("KREDIT", "header"), text("SALDO", "header"), text("NOTE", "header")],
  ];

  if (!data.feeRows.length) rows.push([{ value: "Tidak ada data untuk perjalanan ini", style: "muted", mergeAcross: 7 }]);
  else data.feeRows.forEach((item, index) => rows.push([
    number(index + 1, "integer"),
    text("—"),
    text(item.kordaName),
    text(`${item.direction} · ${item.participantCount} peserta`),
    number(item.debit),
    number(item.credit),
    number(item.balance),
    text(item.note),
  ]));

  return { name: "LAPORAN FEE", columns: [55, 105, 180, 230, 110, 110, 110, 300], rows };
}

export function buildTreasuryExcelBlob(data: TreasuryExportData): Blob {
  const worksheets: ExcelWorksheet[] = [buildFeeSheet(data)];
  if (data.direction !== "return") worksheets.push(buildArmadaSheet("LAPORAN ARMADA PULANG", data.outbound));
  if (data.direction !== "outbound") worksheets.push(buildArmadaSheet("LAPORAN ARMADA PERGI", data.returning));
  return createExcelWorkbookBlob(worksheets);
}

export function downloadTreasuryExcel(data: TreasuryExportData, filename: string) {
  downloadExcelBlob(buildTreasuryExcelBlob(data), filename);
}
