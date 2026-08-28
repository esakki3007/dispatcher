// dispatcher/batch-worker/batch.publisher.ts

import {
  ServiceBusSender,
} from "@azure/service-bus";

import {
  SerializedBatchMessage,
} from "./batch.types";

import { config } from "../../config/config";

export class BatchPublisher {

  constructor(
    private readonly sender: ServiceBusSender,
  ) {}

  /**
   * Publishes batches with bounded concurrency.
   *
   * This is the backpressure mechanism.
   */
  async publishBatches(
    batches: AsyncIterable<SerializedBatchMessage>,
  ): Promise<number> {

    let totalBatches = 0;

    const inFlight =
      new Set<Promise<void>>();

    for await (
      const batch of batches
    ) {

      totalBatches++;

      const publishPromise =
        this.publishBatch(batch);

      inFlight.add(
        publishPromise,
      );

      publishPromise.finally(
        () => {
          inFlight.delete(
            publishPromise,
          );
        },
      );

      /*
       * BACKPRESSURE
       *
       * Do not consume another batch once
       * we have reached the configured number
       * of in-flight Service Bus sends.
       */
      if (
        inFlight.size >=
        config.batchPublishConcurrency
      ) {

        await Promise.race(
          inFlight,
        );
      }
    }

    /*
     * EOF.
     *
     * Wait for every outstanding message.
     */
    await Promise.all(
      inFlight,
    );

    return totalBatches;
  }

  private async publishBatch(
    batch: SerializedBatchMessage,
  ): Promise<void> {

    /*
     * Build the final JSON body using the
     * already serialized records.
     *
     * This avoids JSON.parse().
     */
    const body = this.buildBody(
      batch,
    );

    const actualByteLength =
      Buffer.byteLength(
        body,
        "utf8",
      );

    /*
     * Absolute safety check.
     */
    if (
      actualByteLength >
      config.batchHardMaxBytes
    ) {

      throw new Error(
        [
          "Service Bus batch exceeds hard limit.",
          `correlationId=${batch.correlationId}`,
          `batchNumber=${batch.batchNumber}`,
          `byteLength=${actualByteLength}`,
          `hardLimit=${config.batchHardMaxBytes}`,
        ].join(" "),
      );
    }

    await this.sender.sendMessages({
      body,

      /*
       * Deterministic message ID.
       *
       * Useful for duplicate detection/idempotency.
       */
      messageId:
        `${batch.correlationId}:${batch.batchNumber}`,
    });
  }

  private buildBody(
    batch: SerializedBatchMessage,
  ): string {

    /*
     * We cannot simply JSON.stringify(batch)
     * because serializedRecords are already JSON.
     *
     * Construct the JSON body directly.
     */

    const recordsJson =
      `[${batch.serializedRecords.join(",")}]`;

    return (
      "{" +

      `"messageType":"BATCH",` +

      `"correlationId":${JSON.stringify(
        batch.correlationId,
      )},` +

      `"blobPath":${JSON.stringify(
        batch.blobPath,
      )},` +

      `"batchNumber":${batch.batchNumber},` +

      `"count":${batch.count},` +

      `"totalCount":${batch.totalCount},` +

      `"byteLength":${batch.byteLength},` +

      `"records":${recordsJson}` +

      "}"
    );
  }
}
