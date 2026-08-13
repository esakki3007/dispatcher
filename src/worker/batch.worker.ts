import {
  parentPort,
} from "node:worker_threads";
import {
  BatchMessage,
} from "../dispatcher/batch-worker/batch.types";

if (!parentPort) {
  throw new Error(
    "batch.worker.ts must run inside a worker thread",
  );
}

/**
 * Worker-thread boundary only.
 *
 * NetReveal calls, concurrency controls, retries,
 * idempotency and result persistence will be added
 * in the next implementation stage.
 */
parentPort.on(
  "message",
  async (batch: BatchMessage) => {
    try {
      console.log(
        JSON.stringify({
          event:
            "BATCH_WORKER_STARTED",
          correlationId:
            batch.correlationId,
          batchNumber:
            batch.batchNumber,
          totalBatches:
            batch.totalBatches,
          count:
            batch.count,
          totalCount:
            batch.totalCount,
          byteLength:
            batch.byteLength,
        }),
      );

      // TODO:
      // 1. Process batch records
      // 2. Apply concurrency limit
      // 3. Call NetReveal
      // 4. Handle retries/idempotency
      // 5. Persist results

      parentPort?.postMessage({
        success: true,
        batchNumber:
          batch.batchNumber,
      });
    } catch (error) {
      parentPort?.postMessage({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);
