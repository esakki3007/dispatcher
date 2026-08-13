import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
} from "@azure/service-bus";
import { config } from "../config/config";
import {
  BatchMessage,
} from "../dispatcher/batch-worker/batch.types";
import {
  BatchWorkerManager,
} from "../worker/batch-worker.manager";

/**
 * This is intentionally the boundary where we start
 * the future worker-thread processing.
 *
 * NetReveal is NOT implemented here yet.
 */
export class BatchQueueConsumer {
  private readonly receiver: ServiceBusReceiver;

  constructor(
    client: ServiceBusClient,
    private readonly workerManager:
      BatchWorkerManager,
  ) {
    this.receiver =
      client.createReceiver(
        config.batchQueueName,
        {
          receiveMode: "peekLock",
        },
      );
  }

  start(): void {
    this.receiver.subscribe({
      processMessage:
        async (message) => {
          await this.processMessage(
            message,
          );
        },

      processError:
        async (error) => {
          console.error(
            "Batch queue receiver error",
            error,
          );
        },
    });
  }

  private async processMessage(
    message: ServiceBusReceivedMessage,
  ): Promise<void> {
    const batch =
      message.body as BatchMessage;

    try {
      // This is where the worker thread is started/used.
      await this.workerManager.execute(
        batch,
      );

      await this.receiver.completeMessage(
        message,
      );
    } catch (error) {
      console.error(
        "Batch worker failed",
        {
          correlationId:
            batch.correlationId,
          batchNumber:
            batch.batchNumber,
          error,
        },
      );

      // Do not complete failed messages.
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.receiver.close();
  }
}
