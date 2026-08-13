import {
  Worker,
} from "node:worker_threads";
import {
  BatchMessage,
} from "../dispatcher/batch-worker/batch.types";

/**
 * Minimal worker manager for the current boundary.
 *
 * It starts a worker thread for a batch.
 *
 * In the next stage this should become a reusable
 * bounded worker pool rather than one Worker per message.
 */
export class BatchWorkerManager {
  async execute(
    batch: BatchMessage,
  ): Promise<void> {
    const worker =
      new Worker(
        require.resolve(
          "./batch.worker.js",
        ),
      );

    try {
      await new Promise<void>(
        (resolve, reject) => {
          worker.once(
            "message",
            (result) => {
              if (result?.success) {
                resolve();
              } else {
                reject(
                  new Error(
                    result?.error ??
                    "Batch worker failed",
                  ),
                );
              }
            },
          );

          worker.once(
            "error",
            reject,
          );

          worker.postMessage(batch);
        },
      );
    } finally {
      await worker.terminate();
    }
  }
}
