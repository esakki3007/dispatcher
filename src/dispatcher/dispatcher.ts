import { BlobService } from "../services/blob.service";
import { ExcelParser } from "./excel/excel.parser";
import { chunkRecords } from "./excel/excel.chunker";
import {
  BatchPublisher,
} from "./batch-worker/batch.publisher";
import {
  BatchMessage,
  FileQueueMessage,
} from "./batch-worker/batch.types";
import { config } from "../config/config";

export class Dispatcher {
  constructor(
    private readonly blobService: BlobService,
    private readonly excelParser: ExcelParser,
    private readonly batchPublisher: BatchPublisher,
  ) {}

  async dispatch(
    fileMessage: FileQueueMessage,
  ): Promise<void> {
    const {
      containerName,
      blobName,
    } =
      this.parseBlobPath(
        fileMessage.blobPath,
      );

    // Async I/O: does not block while waiting for Blob Storage.
    const buffer =
      await this.blobService.download(
        containerName,
        blobName,
      );

    // ExcelJS parsing/chunking is CPU work on this Node process.
    // For the current 10K-row requirement, keep it here and
    // optimize allocations rather than introducing another worker pool.
    const parsed =
      await this.excelParser.parse(buffer);

    const chunks =
      chunkRecords(
        {
          correlationId:
            fileMessage.correlationId,
          blobPath:
            fileMessage.blobPath,
          totalCount:
            parsed.totalCount,
        },
        parsed.records,
      );

    const totalBatches = chunks.length;

    for (
      let index = 0;
      index < chunks.length;
      index++
    ) {
      const chunk = chunks[index];

      const message: BatchMessage = {
        correlationId:
          fileMessage.correlationId,
        blobPath:
          fileMessage.blobPath,

        batchNumber:
          index + 1,
        totalBatches,

        count:
          chunk.records.length,
        totalCount:
          parsed.totalCount,

        // Recalculated exactly in publisher before send.
        byteLength:
          chunk.estimatedByteLength,

        records:
          chunk.records,
      };

      await this.batchPublisher.publish(
        message,
      );
    }

    console.info(
      JSON.stringify({
        event: "FILE_DISPATCHED",
        correlationId:
          fileMessage.correlationId,
        totalCount:
          parsed.totalCount,
        totalBatches,
        targetBytes:
          config.batchTargetBytes,
        hardMaxBytes:
          config.batchHardMaxBytes,
      }),
    );
  }

  private parseBlobPath(
    blobPath: string,
  ): {
    containerName: string;
    blobName: string;
  } {
    const normalized =
      blobPath.replace(/^\/+/, "");

    const separator =
      normalized.indexOf("/");

    if (
      separator <= 0 ||
      separator ===
        normalized.length - 1
    ) {
      throw new Error(
        `Invalid blobPath: ${blobPath}`,
      );
    }

    return {
      containerName:
        normalized.substring(
          0,
          separator,
        ),
      blobName:
        normalized.substring(
          separator + 1,
        ),
    };
  }
}
