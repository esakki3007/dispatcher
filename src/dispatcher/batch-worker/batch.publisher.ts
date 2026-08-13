import {
  ServiceBusClient,
  ServiceBusSender,
} from "@azure/service-bus";
import { config } from "../../config/config";
import { BatchMessage } from "./batch.types";

export class BatchPublisher {
  private readonly sender: ServiceBusSender;

  constructor(
    client: ServiceBusClient,
  ) {
    this.sender = client.createSender(
      config.batchQueueName,
    );
  }

  async publish(
    message: BatchMessage,
  ): Promise<void> {
    const serialized =
      JSON.stringify(message);

    const byteLength =
      Buffer.byteLength(
        serialized,
        "utf8",
      );

    if (
      byteLength >
      config.batchHardMaxBytes
    ) {
      throw new Error(
        `Batch ${message.batchNumber} exceeds hard limit. ` +
        `Actual=${byteLength}, ` +
        `Maximum=${config.batchHardMaxBytes}`,
      );
    }

    const finalMessage: BatchMessage = {
      ...message,
      byteLength,
    };

    await this.sender.sendMessages({
      body: finalMessage,
      messageId:
        `${message.correlationId}:${message.batchNumber}`,
      correlationId:
        message.correlationId,
      applicationProperties: {
        batchNumber:
          message.batchNumber,
        totalBatches:
          message.totalBatches,
        count:
          message.count,
        totalCount:
          message.totalCount,
        byteLength,
      },
    });
  }

  async close(): Promise<void> {
    await this.sender.close();
  }
}
