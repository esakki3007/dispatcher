import { config } from "../../config/config";
import { ExcelRecord } from "./excel.types";

export interface BatchChunk {
  records: ExcelRecord[];
  estimatedByteLength: number;
}

export interface ChunkMetadata {
  correlationId: string;
  blobPath: string;
  totalCount: number;
}

function serializeRecord(
  record: ExcelRecord,
): { json: string; bytes: number } {
  const json = JSON.stringify(record);

  return {
    json,
    bytes: Buffer.byteLength(json, "utf8"),
  };
}

/**
 * The chunker uses a conservative envelope size.
 *
 * We deliberately do not repeatedly stringify the growing
 * records array. Each record is serialized once and a
 * running byte counter is maintained.
 */
function getConservativeEnvelopeBytes(
  metadata: ChunkMetadata,
): number {
  const envelope = JSON.stringify({
    correlationId: metadata.correlationId,
    blobPath: metadata.blobPath,
    batchNumber: 999999,
    totalBatches: 999999,
    count: 999999,
    totalCount: metadata.totalCount,
    byteLength: 999999,
    records: [],
  });

  return Buffer.byteLength(envelope, "utf8");
}

export function chunkRecords(
  metadata: ChunkMetadata,
  records: ExcelRecord[],
): BatchChunk[] {
  if (!records.length) {
    return [];
  }

  const chunks: BatchChunk[] = [];

  const envelopeBytes =
    getConservativeEnvelopeBytes(metadata);

  let currentRecords: ExcelRecord[] = [];
  let currentBytes = envelopeBytes;

  for (const record of records) {
    const serialized = serializeRecord(record);

    const singleRecordBytes =
      envelopeBytes +
      serialized.bytes;

    if (
      singleRecordBytes >
      config.batchHardMaxBytes
    ) {
      throw new Error(
        `Single record exceeds hard batch limit: ${config.batchHardMaxBytes} bytes`,
      );
    }

    const separatorBytes =
      currentRecords.length > 0 ? 1 : 0;

    const candidateBytes =
      currentBytes +
      separatorBytes +
      serialized.bytes;

    if (
      currentRecords.length > 0 &&
      candidateBytes > config.batchTargetBytes
    ) {
      chunks.push({
        records: currentRecords,
        estimatedByteLength: currentBytes,
      });

      currentRecords = [record];
      currentBytes =
        envelopeBytes +
        serialized.bytes;

      continue;
    }

    if (
      candidateBytes >
      config.batchHardMaxBytes
    ) {
      if (!currentRecords.length) {
        throw new Error(
          "Unable to create a batch within the hard message limit",
        );
      }

      chunks.push({
        records: currentRecords,
        estimatedByteLength: currentBytes,
      });

      currentRecords = [record];
      currentBytes =
        envelopeBytes +
        serialized.bytes;

      continue;
    }

    currentRecords.push(record);
    currentBytes = candidateBytes;
  }

  if (currentRecords.length) {
    chunks.push({
      records: currentRecords,
      estimatedByteLength: currentBytes,
    });
  }

  return chunks;
}
