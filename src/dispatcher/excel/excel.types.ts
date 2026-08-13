export type ExcelRecord = Record<string, unknown>;

export interface ParsedExcel {
  records: ExcelRecord[];
  totalCount: number;
}
