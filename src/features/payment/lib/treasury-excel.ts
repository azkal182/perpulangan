import type {
  TreasuryExportData,
  TreasuryExportGroup,
} from "../actions/treasury-export.actions";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function textCell(value: string, style = "Text") {
  return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
}

function numberCell(value: number, style = "Currency") {
  return `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${value}</Data></Cell>`;
}

function row(cells: string[]) {
  return `<Row>${cells.join("")}</Row>`;
}

function title(value: string, mergeAcross: number) {
  return `<Row><Cell ss:MergeAcross="${mergeAcross}" ss:StyleID="Title"><Data ss:Type="String">${escapeXml(value)}</Data></Cell></Row>`;
}

function worksheet(name: string, columns: number[], rows: string[]) {
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${columns.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join("")}${rows.join("")}</Table></Worksheet>`;
}

function buildArmadaSheet(titleText: string, groups: TreasuryExportGroup[]) {
  const rows = [
    title(titleText, 8),
    row([
      textCell("KORWIL", "Header"),
      textCell("KORDA", "Header"),
      textCell("HARGA TIKET", "Header"),
      textCell("PESERTA", "HeaderCenter"),
      textCell("TOTAL", "Header"),
      textCell("FEE PONDOK", "Header"),
      textCell("HASIL SETELAH FEE", "Header"),
      textCell("PEMBAYARAN ARMADA", "Header"),
      textCell("FEE KORDA", "Header"),
    ]),
  ];

  if (!groups.length) {
    rows.push(row([textCell("Tidak ada data untuk perjalanan ini", "Muted")]));
  } else {
    for (const group of groups) {
      rows.push(row([
        textCell(group.korwilName),
        textCell(group.kordaName),
        numberCell(group.tariff),
        numberCell(group.participants, "Integer"),
        numberCell(group.total),
        numberCell(group.feePondok),
        numberCell(group.afterFee),
        textCell(group.paymentArmada),
        textCell(group.feeKorda),
      ]));
    }
  }

  return worksheet(titleText, [145, 220, 105, 75, 110, 110, 130, 145, 100], rows);
}

function buildFeeSheet(data: TreasuryExportData) {
  const rows = [
    title(`LAPORAN FEE ${data.direction === "both" ? "PULANG DAN PERGI" : data.direction === "outbound" ? "PULANG" : "PERGI"}`, 7),
    row([textCell("NO", "HeaderCenter"), textCell("TANGGAL", "Header"), textCell("NAMA", "Header"), textCell("KETERANGAN", "Header"), textCell("DEBIT", "Header"), textCell("KREDIT", "Header"), textCell("SALDO", "Header"), textCell("NOTE", "Header")]),
  ];

  if (!data.feeRows.length) {
    rows.push(row([textCell("Tidak ada data untuk perjalanan ini", "Muted")]));
  } else {
    data.feeRows.forEach((item, index) => rows.push(row([
      numberCell(index + 1, "Integer"),
      textCell("—"),
      textCell(item.kordaName),
      textCell(`${item.direction} · ${item.participantCount} peserta`),
      numberCell(item.debit),
      numberCell(item.credit),
      numberCell(item.balance),
      textCell(item.note),
    ])));
  }

  return worksheet("LAPORAN FEE", [55, 105, 180, 230, 110, 110, 110, 300], rows);
}

export function buildTreasuryExcelBlob(data: TreasuryExportData): Blob {
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="Title"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1"/><Interior ss:Color="#D9EAF7" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#4285F4" ss:Pattern="Solid"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
    <Style ss:ID="HeaderCenter"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#4285F4" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Text"><Alignment ss:Vertical="Center"/></Style>
    <Style ss:ID="Integer"><NumberFormat ss:Format="#,##0"/><Alignment ss:Horizontal="Center"/></Style>
    <Style ss:ID="Currency"><NumberFormat ss:Format="&quot;Rp&quot;#,##0"/><Alignment ss:Horizontal="Right"/></Style>
    <Style ss:ID="Muted"><Font ss:Color="#6B7280" ss:Italic="1"/></Style>
  </Styles>
  ${buildFeeSheet(data)}
  ${data.direction === "return" ? "" : buildArmadaSheet("LAPORAN ARMADA PULANG", data.outbound)}
  ${data.direction === "outbound" ? "" : buildArmadaSheet("LAPORAN ARMADA PERGI", data.returning)}
</Workbook>`;
  return new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
}

export function downloadTreasuryExcel(data: TreasuryExportData, filename: string) {
  const url = window.URL.createObjectURL(buildTreasuryExcelBlob(data));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
