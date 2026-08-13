import { ExcelRecord } from "../excel/excel.types";

export interface FileQueueMessage {
  blobPath: string;
  correlationId: string;
}

export interface BatchMessage {
  correlationId: string;
  blobPath: string;

  batchNumber: number;
  totalBatches: number;

  count: number;
  totalCount: number;

  byteLength: number;

  records: ExcelRecord[];
}
