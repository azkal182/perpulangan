// Type definitions for jspdf-autotable
declare module "jspdf-autotable" {
  import { jsPDF } from "jspdf";

  export interface CellDef {
    content?: string | number;
    colSpan?: number;
    rowSpan?: number;
    styles?: Partial<Styles>;
  }

  export type RowInput = CellDef[] | (string | number | CellDef)[];

  export interface Styles {
    font?: string;
    fontStyle?: string;
    overflow?: "linebreak" | "ellipsize" | "visible" | "hidden";
    fillColor?: number | number[] | string | false;
    textColor?: number | number[] | string;
    cellPadding?: number | { top?: number; right?: number; bottom?: number; left?: number };
    fontSize?: number;
    cellWidth?: "auto" | "wrap" | number;
    minCellHeight?: number;
    minCellWidth?: number;
    halign?: "left" | "center" | "right" | "justify";
    valign?: "top" | "middle" | "bottom";
    lineColor?: number | number[] | string;
    lineWidth?: number;
  }

  export interface UserOptions {
    includeHiddenHtml?: boolean;
    useCss?: boolean;
    theme?: "striped" | "grid" | "plain";
    startY?: number | false;
    margin?: number | { top?: number; right?: number; bottom?: number; left?: number; horizontal?: number; vertical?: number };
    pageBreak?: "auto" | "avoid" | "always";
    rowPageBreak?: "auto" | "avoid";
    tableWidth?: "auto" | "wrap" | number;
    showHead?: "everyPage" | "firstPage" | "never";
    showFoot?: "everyPage" | "lastPage" | "never";
    tableLineColor?: number | number[] | string;
    tableLineWidth?: number;
    head?: RowInput[][];
    body?: RowInput[][];
    foot?: RowInput[][];
    headStyles?: Partial<Styles>;
    bodyStyles?: Partial<Styles>;
    footStyles?: Partial<Styles>;
    alternateRowStyles?: Partial<Styles>;
    columnStyles?: { [key: string]: Partial<Styles> };
    styles?: Partial<Styles>;
    didDrawPage?: (data: CellHookData) => void;
    didDrawCell?: (data: CellHookData) => void;
    willDrawCell?: (data: CellHookData) => void;
    didParseCell?: (data: CellHookData) => void;
  }

  export interface CellHookData {
    cell: Cell;
    row: Row;
    column: Column;
    section: "head" | "body" | "foot";
    cursor?: { x: number; y: number };
  }

  export interface Cell {
    raw: string | number;
    content: string;
    styles: Styles;
    section: "head" | "body" | "foot";
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface Row {
    raw: RowInput;
    cells: { [key: string]: Cell };
    section: "head" | "body" | "foot";
    index: number;
  }

  export interface Column {
    dataKey: string | number;
    index: number;
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): jsPDF;
}
