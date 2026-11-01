export type ExcelStyle = "default" | "title" | "section" | "header" | "headerCenter" | "textCenter" | "integer" | "currency" | "muted";

export type ExcelCellValue = string | number;

export interface ExcelCell {
  value: ExcelCellValue;
  style?: ExcelStyle;
  mergeAcross?: number;
}

export interface ExcelWorksheet {
  name: string;
  columns: number[];
  rows: ExcelCell[][];
}

const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const relationshipNamespace = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const worksheetRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
const stylesRelationshipType = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function styleIndex(style: ExcelStyle | undefined): number {
  switch (style) {
    case "title": return 1;
    case "section": return 2;
    case "header": return 3;
    case "headerCenter": return 4;
    case "textCenter": return 5;
    case "integer": return 6;
    case "currency": return 7;
    case "muted": return 8;
    default: return 0;
  }
}

function worksheetXml(sheet: ExcelWorksheet): string {
  const merges: string[] = [];
  const rows = sheet.rows.map((cells, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const cellXml = cells.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowNumber}`;
      if (cell.mergeAcross && cell.mergeAcross > 0) {
        const endReference = `${columnName(columnIndex + cell.mergeAcross)}${rowNumber}`;
        merges.push(`<mergeCell ref="${reference}:${endReference}"/>`);
      }
      const style = ` s="${styleIndex(cell.style)}"`;
      if (typeof cell.value === "number") {
        const number = Number.isFinite(cell.value) ? cell.value : 0;
        return `<c r="${reference}"${style} t="n"><v>${number}</v></c>`;
      }
      return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowNumber}">${cellXml}</row>`;
  }).join("");
  const columns = sheet.columns.length
    ? `<cols>${sheet.columns.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(1, width / 7)}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const mergeCells = merges.length ? `<mergeCells count="${merges.length}">${merges.join("")}</mergeCells>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${spreadsheetNamespace}"><sheetFormatPr defaultRowHeight="15"/>${columns}<sheetData>${rows}</sheetData>${mergeCells}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${spreadsheetNamespace}"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot;#,##0;[Red]-&quot;Rp&quot;#,##0"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><i/><color rgb="FF6B7280"/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4285F4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFCBD5E1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function contentTypesXml(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}</Types>`;
}

function workbookXml(sheets: ExcelWorksheet[]): string {
  const names = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${spreadsheetNamespace}" xmlns:r="${relationshipNamespace}"><sheets>${names}</sheets></workbook>`;
}

function workbookRelationshipsXml(sheetCount: number): string {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="${worksheetRelationshipType}" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${sheetCount + 1}" Type="${stylesRelationshipType}" Target="styles.xml"/></Relationships>`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: Array<{ path: string; content: string }>): ArrayBuffer {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  const header = (length: number, fields: Array<[number, number, number]>) => {
    const bytes = new Uint8Array(length);
    const view = new DataView(bytes.buffer);
    for (const [offset, value, size] of fields) {
      if (size === 2) view.setUint16(offset, value, true);
      else view.setUint32(offset, value, true);
    }
    return bytes;
  };

  for (const file of files) {
    const name = encoder.encode(file.path);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const localHeader = header(30, [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x0021, 2], [14, checksum, 4], [18, content.length, 4], [22, content.length, 4], [26, name.length, 2], [28, 0, 2]]);
    localParts.push(localHeader, name, content);

    const centralHeader = header(46, [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x0021, 2], [16, checksum, 4], [20, content.length, 4], [24, content.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 4], [42, localOffset, 4]]);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + content.length;
    centralSize += centralHeader.length + name.length;
  }

  const end = header(22, [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, centralSize, 4], [16, localOffset, 4], [20, 0, 2]]);
  const output = new ArrayBuffer(localOffset + centralSize + end.length);
  const result = new Uint8Array(output);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    result.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function createExcelWorkbookBlob(sheets: ExcelWorksheet[]): Blob {
  if (sheets.length === 0) throw new Error("Workbook harus memiliki minimal satu worksheet.");
  const files = [
    { path: "[Content_Types].xml", content: contentTypesXml(sheets.length) },
    { path: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { path: "xl/workbook.xml", content: workbookXml(sheets) },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelationshipsXml(sheets.length) },
    { path: "xl/styles.xml", content: stylesXml() },
    ...sheets.map((sheet, index) => ({ path: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet) })),
  ];
  return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadExcelBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
