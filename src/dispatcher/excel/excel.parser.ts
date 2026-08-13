import ExcelJS from "exceljs";
import {
  ExcelRecord,
  ParsedExcel,
} from "./excel.types";

export class ExcelParser {
  async parse(
    buffer: Buffer,
  ): Promise<ParsedExcel> {
    if (!buffer.length) {
      throw new Error("Excel file is empty");
    }

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error("Excel file contains no worksheet");
    }

    const headers: string[] = [];

    worksheet.getRow(1).eachCell(
      { includeEmpty: true },
      (cell, columnNumber) => {
        const header =
          String(cell.value ?? "").trim();

        if (!header) {
          throw new Error(
            `Empty header at column ${columnNumber}`,
          );
        }

        headers[columnNumber] = header;
      },
    );

    if (!headers.length) {
      throw new Error("Excel file contains no headers");
    }

    const records: ExcelRecord[] = [];

    worksheet.eachRow(
      { includeEmpty: false },
      (row, rowNumber) => {
        if (rowNumber === 1) {
          return;
        }

        const record: ExcelRecord = {};

        for (
          let columnNumber = 1;
          columnNumber <= headers.length;
          columnNumber++
        ) {
          const header = headers[columnNumber];

          if (!header) {
            continue;
          }

          record[header] =
            this.normalizeCellValue(
              row.getCell(columnNumber).value,
            );
        }

        if (!this.isEmptyRecord(record)) {
          records.push(record);
        }
      },
    );

    if (!records.length) {
      throw new Error(
        "Excel file contains no data records",
      );
    }

    return {
      records,
      totalCount: records.length,
    };
  }

  private normalizeCellValue(
    value: ExcelJS.CellValue,
  ): unknown {
    if (value === null || value === undefined) {
      return null;
    }

    if (
      typeof value === "object" &&
      "text" in value
    ) {
      return value.text;
    }

    if (
      typeof value === "object" &&
      "result" in value
    ) {
      return value.result;
    }

    return value;
  }

  private isEmptyRecord(
    record: ExcelRecord,
  ): boolean {
    return Object.values(record).every(
      (value) =>
        value === null ||
        value === undefined ||
        value === "",
    );
  }
}
