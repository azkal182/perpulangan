export interface RegistrationExportRow {
  studentName: string;
  gender: "L" | "P" | "-";
  outboundKorda: string;
  outboundDropPoint: string;
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

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSheetName(rawName: string, fallbackIndex: number): string {
  const cleaned = rawName
    .replace(/[:\\/?*\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return `Korwil ${fallbackIndex + 1}`;
  }

  return cleaned.slice(0, 31);
}

function rowXml(cells: string[]): string {
  return `<Row>${cells.join("")}</Row>`;
}

function stringCell(value: string, styleId = "Text"): string {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function numberCell(value: number, styleId = "TextCenter"): string {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${value}</Data></Cell>`;
}

function mergedTitleCell(value: string, styleId = "SectionHeader"): string {
  return `<Cell ss:MergeAcross="5" ss:StyleID="${styleId}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

interface GenderTotals {
  total: number;
  putra: number;
  putri: number;
}

function getRowsTotals(rows: RegistrationExportRow[]): GenderTotals {
  const putra = rows.filter((row) => row.gender === "L").length;
  const putri = rows.filter((row) => row.gender === "P").length;
  return {
    total: rows.length,
    putra,
    putri,
  };
}

function getKorwilTotals(sheet: RegistrationExportKorwilSheet): GenderTotals {
  return sheet.kordas.reduce<GenderTotals>(
    (acc, korda) => {
      const kordaTotals = getRowsTotals(korda.rows);
      acc.total += kordaTotals.total;
      acc.putra += kordaTotals.putra;
      acc.putri += kordaTotals.putri;
      return acc;
    },
    { total: 0, putra: 0, putri: 0 },
  );
}

function buildSummaryWorksheetXml(
  sheets: RegistrationExportKorwilSheet[],
  sheetName: string,
): string {
  const rows: string[] = [];
  const totalKorda = sheets.reduce((sum, sheet) => sum + sheet.kordas.length, 0);
  const grandTotals = sheets.reduce<GenderTotals>(
    (acc, sheet) => {
      const sheetTotals = getKorwilTotals(sheet);
      acc.total += sheetTotals.total;
      acc.putra += sheetTotals.putra;
      acc.putri += sheetTotals.putri;
      return acc;
    },
    { total: 0, putra: 0, putri: 0 },
  );

  rows.push(
    rowXml([mergedTitleCell("RINGKASAN EXPORT DAFTAR PESERTA", "Title")]),
  );
  rows.push(
    rowXml([
      mergedTitleCell(
        `Dibuat: ${new Date().toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })}`,
        "Muted",
      ),
    ]),
  );
  rows.push("<Row/>");

  rows.push(
    rowXml([
      stringCell("Jumlah Student", "Header"),
      numberCell(grandTotals.total),
      stringCell("Jumlah Putra", "Header"),
      numberCell(grandTotals.putra),
      stringCell("Jumlah Putri", "Header"),
      numberCell(grandTotals.putri),
    ]),
  );
  rows.push(
    rowXml([
      stringCell("Jumlah Korwil", "Header"),
      numberCell(sheets.length),
      stringCell("Jumlah Korda", "Header"),
      numberCell(totalKorda),
      stringCell("", "Text"),
      stringCell("", "Text"),
    ]),
  );
  rows.push("<Row/>");

  rows.push(rowXml([mergedTitleCell("RINGKASAN PER KORWIL", "SectionHeader")]));
  rows.push(
    rowXml([
      stringCell("No", "HeaderCenter"),
      stringCell("Korwil", "Header"),
      stringCell("Jumlah Korda", "HeaderCenter"),
      stringCell("Total Student", "HeaderCenter"),
      stringCell("Putra", "HeaderCenter"),
      stringCell("Putri", "HeaderCenter"),
    ]),
  );

  if (sheets.length === 0) {
    rows.push(
      rowXml([
        mergedTitleCell("Tidak ada data outbound untuk diringkas", "Muted"),
      ]),
    );
  } else {
    sheets.forEach((sheet, index) => {
      const sheetTotals = getKorwilTotals(sheet);
      rows.push(
        rowXml([
          numberCell(index + 1, "TextCenter"),
          stringCell(sheet.korwilName),
          numberCell(sheet.kordas.length, "TextCenter"),
          numberCell(sheetTotals.total, "TextCenter"),
          numberCell(sheetTotals.putra, "TextCenter"),
          numberCell(sheetTotals.putri, "TextCenter"),
        ]),
      );
    });
  }

  rows.push("<Row/>");
  rows.push(
    rowXml([mergedTitleCell("RINGKASAN PER KORWIL - KORDA", "SectionHeader")]),
  );
  rows.push(
    rowXml([
      stringCell("No", "HeaderCenter"),
      stringCell("Korwil", "Header"),
      stringCell("Korda", "Header"),
      stringCell("Total Student", "HeaderCenter"),
      stringCell("Putra", "HeaderCenter"),
      stringCell("Putri", "HeaderCenter"),
    ]),
  );

  if (sheets.length === 0) {
    rows.push(
      rowXml([
        mergedTitleCell("Tidak ada data outbound untuk diringkas", "Muted"),
      ]),
    );
  } else {
    let detailNo = 1;
    sheets.forEach((sheet) => {
      sheet.kordas.forEach((korda) => {
        const kordaTotals = getRowsTotals(korda.rows);
        rows.push(
          rowXml([
            numberCell(detailNo, "TextCenter"),
            stringCell(sheet.korwilName),
            stringCell(korda.kordaName),
            numberCell(kordaTotals.total, "TextCenter"),
            numberCell(kordaTotals.putra, "TextCenter"),
            numberCell(kordaTotals.putri, "TextCenter"),
          ]),
        );
        detailNo += 1;
      });
    });
  }

  return `
    <Worksheet ss:Name="${xmlEscape(sheetName)}">
      <Table>
        <Column ss:AutoFitWidth="0" ss:Width="45"/>
        <Column ss:AutoFitWidth="0" ss:Width="220"/>
        <Column ss:AutoFitWidth="0" ss:Width="180"/>
        <Column ss:AutoFitWidth="0" ss:Width="110"/>
        <Column ss:AutoFitWidth="0" ss:Width="90"/>
        <Column ss:AutoFitWidth="0" ss:Width="90"/>
        ${rows.join("")}
      </Table>
    </Worksheet>
  `;
}

export function buildRegistrationsExcelBlob(
  sheets: RegistrationExportKorwilSheet[],
): Blob {
  const usedSheetNames = new Set<string>();
  const getUniqueSheetName = (rawName: string, sheetIndex: number): string => {
    const base = sanitizeSheetName(rawName, sheetIndex);
    let candidate = base;
    let counter = 2;

    while (usedSheetNames.has(candidate)) {
      const suffix = ` (${counter})`;
      candidate = `${base.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      counter += 1;
    }

    usedSheetNames.add(candidate);
    return candidate;
  };

  const summaryWorksheetXml = buildSummaryWorksheetXml(
    sheets,
    getUniqueSheetName("Ringkasan", 0),
  );

  const detailWorksheetXml = sheets
    .map((sheet, sheetIndex) => {
      const sheetName = getUniqueSheetName(sheet.korwilName, sheetIndex + 1);
      const rows: string[] = [];

      rows.push(
        rowXml([mergedTitleCell(`KORWIL: ${sheet.korwilName}`, "Title")]),
      );
      rows.push("<Row/>");

      if (sheet.kordas.length === 0) {
        rows.push(
          rowXml([mergedTitleCell("Tidak ada data outbound", "SectionHeader")]),
        );
      } else {
        sheet.kordas.forEach((korda, kordaIndex) => {
          rows.push(rowXml([mergedTitleCell(`KORDA: ${korda.kordaName}`)]));
          rows.push(
            rowXml([
              stringCell("No", "HeaderCenter"),
              stringCell("Nama", "Header"),
              stringCell("L/P", "HeaderCenter"),
              stringCell("Korda", "Header"),
              stringCell("Titik Turun", "Header"),
              stringCell("Bus", "Header"),
            ]),
          );

          if (korda.rows.length === 0) {
            rows.push(
              rowXml([
                mergedTitleCell("Tidak ada data pada korda ini", "Muted"),
              ]),
            );
          } else {
            korda.rows.forEach((row, rowIndex) => {
              rows.push(
                rowXml([
                  numberCell(rowIndex + 1, "TextCenter"),
                  stringCell(row.studentName),
                  stringCell(row.gender, "TextCenter"),
                  stringCell(row.outboundKorda),
                  stringCell(row.outboundDropPoint),
                  stringCell(row.bus),
                ]),
              );
            });
          }

          if (kordaIndex < sheet.kordas.length - 1) {
            rows.push("<Row/>");
          }
        });
      }

      return `
        <Worksheet ss:Name="${xmlEscape(sheetName)}">
          <Table>
            <Column ss:AutoFitWidth="0" ss:Width="45"/>
            <Column ss:AutoFitWidth="0" ss:Width="210"/>
            <Column ss:AutoFitWidth="0" ss:Width="45"/>
            <Column ss:AutoFitWidth="0" ss:Width="170"/>
            <Column ss:AutoFitWidth="0" ss:Width="190"/>
            <Column ss:AutoFitWidth="0" ss:Width="120"/>
            ${rows.join("")}
          </Table>
        </Worksheet>
      `;
    })
    .join("");
  const worksheetXml = `${summaryWorksheetXml}${detailWorksheetXml}`;

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40"
>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="SectionHeader">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="HeaderCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Text">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="TextCenter">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11"/>
    </Style>
    <Style ss:ID="Muted">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#6B7280"/>
    </Style>
  </Styles>
  ${worksheetXml}
</Workbook>`;

  return new Blob([xml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
}

export function downloadRegistrationsExcel(
  sheets: RegistrationExportKorwilSheet[],
  filename: string,
) {
  const blob = buildRegistrationsExcelBlob(sheets);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
