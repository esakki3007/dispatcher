import {
  ServiceBusClient,
  ServiceBusReceiver,
  ServiceBusReceivedMessage,
} from "@azure/service-bus";
import { config } from "../config/config";
import {
  Dispatcher,
} from "../dispatcher/dispatcher";
import {
  FileQueueMessage,
} from "../dispatcher/batch-worker/batch.types";

export class FileQueueConsumer {
  private readonly receiver: ServiceBusReceiver;

  constructor(
    client: ServiceBusClient,
    private readonly dispatcher: Dispatcher,
  ) {
    this.receiver =
      client.createReceiver(
        config.fileQueueName,
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
            "File queue receiver error",
            error,
          );
        },
    });
  }

  private async processMessage(
    message: ServiceBusReceivedMessage,
  ): Promise<void> {
    const body =
      message.body as Partial<FileQueueMessage>;

    if (
      typeof body.blobPath !== "string" ||
      !body.blobPath
    ) {
      throw new Error(
        "File queue message is missing blobPath",
      );
    }

    if (
      typeof body.correlationId !== "string" ||
      !body.correlationId
    ) {
      throw new Error(
        "File queue message is missing correlationId",
      );
    }

    try {
      await this.dispatcher.dispatch({
        blobPath:
          body.blobPath,
        correlationId:
          body.correlationId,
      });

      // Complete only after ALL batch messages
      // for this file were successfully published.
      await this.receiver.completeMessage(
        message,
      );
    } catch (error) {
      console.error(
        "File dispatch failed",
        {
          correlationId:
            body.correlationId,
          blobPath:
            body.blobPath,
          error,
        },
      );

      // Do not complete. Service Bus can redeliver
      // according to lock/retry/DLQ configuration.
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.receiver.close();
  }
}
