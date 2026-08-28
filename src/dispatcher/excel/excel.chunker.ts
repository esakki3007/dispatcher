// dispatcher/excel/excel.chunker.ts

import { config } from "../../config/config";
import { ExcelRecord } from "./excel.types";
import {
  serializeRecord,
  SerializedRecord,
} from "./excel.serializer";

import {
  SerializedBatchMessage,
} from "../batch-worker/batch.types";

export interface ChunkMetadata {
  correlationId: string;
  blobPath: string;
  totalCount: number;
}

function calculateEnvelopeOverhead(
  metadata: ChunkMetadata,
  batchNumber: number,
  count: number,
): number {

  const envelope = {
    messageType: "BATCH",

    correlationId:
      metadata.correlationId,

    blobPath:
      metadata.blobPath,

    batchNumber,

    count,

    totalCount:
      metadata.totalCount,

    byteLength: 0,

    records: [],
  };

  const envelopeJson =
    JSON.stringify(envelope);

  const envelopeBytes =
    Buffer.byteLength(
      envelopeJson,
      "utf8",
    );

  const emptyRecordsBytes =
    Buffer.byteLength(
      "[]",
      "utf8",
    );

  return (
    envelopeBytes -
    emptyRecordsBytes
  );
}

function calculateBatchByteLength(
  metadata: ChunkMetadata,
  batchNumber: number,
  records: SerializedRecord[],
): number {

  const envelopeBytes =
    calculateEnvelopeOverhead(
      metadata,
      batchNumber,
      records.length,
    );

  let recordBytes = 0;

  for (
    const record of records
  ) {
    recordBytes +=
      record.byteLength;
  }

  const commaBytes =
    Math.max(
      records.length - 1,
      0,
    );

  const bracketsBytes = 2;

  return (
    envelopeBytes +
    recordBytes +
    commaBytes +
    bracketsBytes
  );
}

export async function* chunkRecords(
  metadata: ChunkMetadata,
  records: AsyncIterable<ExcelRecord>,
): AsyncGenerator<SerializedBatchMessage> {

  let batchNumber = 1;

  let currentRecords: SerializedRecord[] = [];

  let currentRecordBytes = 0;

  for await (
    const record of records
  ) {

    /*
     * SERIALIZE EXACTLY ONCE.
     */
    const serialized =
      serializeRecord(record);

    /*
     * Check single record.
     */
    const singleRecordBytes =
      calculateBatchByteLength(
        metadata,
        batchNumber,
        [serialized],
      );

    if (
      singleRecordBytes >
      config.batchHardMaxBytes
    ) {

      throw new Error(
        [
          "Single record exceeds hard batch limit.",
          `correlationId=${metadata.correlationId}`,
          `recordBytes=${serialized.byteLength}`,
          `batchBytes=${singleRecordBytes}`,
        ].join(" "),
      );
    }

    /*
     * Candidate calculation.
     *
     * NO array copy.
     */
    const candidateCount =
      currentRecords.length + 1;

    const candidateRecordBytes =
      currentRecordBytes +
      serialized.byteLength;

    const candidateEnvelopeBytes =
      calculateEnvelopeOverhead(
        metadata,
        batchNumber,
        candidateCount,
      );

    const candidateCommaBytes =
      candidateCount - 1;

    const candidateBytes =
      candidateEnvelopeBytes +
      candidateRecordBytes +
      candidateCommaBytes +
      2;

    /*
     * TARGET LIMIT
     */
    if (
      currentRecords.length > 0 &&
      candidateBytes >
        config.batchTargetBytes
    ) {

      yield buildBatch(
        metadata,
        batchNumber,
        currentRecords,
        currentRecordBytes,
      );

      batchNumber++;

      currentRecords = [
        serialized,
      ];

      currentRecordBytes =
        serialized.byteLength;

      continue;
    }

    /*
     * HARD LIMIT
     */
    if (
      candidateBytes >
      config.batchHardMaxBytes
    ) {

      if (
        currentRecords.length === 0
      ) {
        throw new Error(
          "Unable to create batch within hard limit.",
        );
      }

      yield buildBatch(
        metadata,
        batchNumber,
        currentRecords,
        currentRecordBytes,
      );

      batchNumber++;

      currentRecords = [
        serialized,
      ];

      currentRecordBytes =
        serialized.byteLength;

      continue;
    }

    /*
     * Add to current batch.
     */
    currentRecords.push(
      serialized,
    );

    currentRecordBytes =
      candidateRecordBytes;
  }

  /*
   * Final batch.
   */
  if (
    currentRecords.length > 0
  ) {

    yield buildBatch(
      metadata,
      batchNumber,
      currentRecords,
      currentRecordBytes,
    );
  }
}

function buildBatch(
  metadata: ChunkMetadata,
  batchNumber: number,
  records: SerializedRecord[],
  recordBytes: number,
): SerializedBatchMessage {

  const byteLength =
    calculateBatchByteLength(
      metadata,
      batchNumber,
      records,
    );

  if (
    byteLength >
    config.batchHardMaxBytes
  ) {

    throw new Error(
      [
        "Batch exceeds hard limit.",
        `correlationId=${metadata.correlationId}`,
        `batchNumber=${batchNumber}`,
        `byteLength=${byteLength}`,
        `hardLimit=${config.batchHardMaxBytes}`,
      ].join(" "),
    );
  }

  return {
    messageType: "BATCH",

    correlationId:
      metadata.correlationId,

    blobPath:
      metadata.blobPath,

    batchNumber,

    count:
      records.length,

    totalCount:
      metadata.totalCount,

    byteLength,

    serializedRecords:
      records.map(
        (record) =>
          record.json,
      ),
  };
}
