import Fastify from "fastify";
import serviceBusPlugin from "./plugins/service-bus.plugin";
import { config } from "./config/config";
import { BlobService } from "./services/blob.service";
import { ExcelParser } from "./dispatcher/excel/excel.parser";
import { BatchPublisher } from "./dispatcher/batch-worker/batch.publisher";
import { Dispatcher } from "./dispatcher/dispatcher";
import { FileQueueConsumer } from "./consumers/file-queue.consumer";
import { BatchQueueConsumer } from "./consumers/batch-queue.consumer";
import { BatchWorkerManager } from "./worker/batch-worker.manager";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(serviceBusPlugin);

  return app;
}

export async function startConsumers(app: ReturnType<typeof Fastify>) {
  const blobService =
    new BlobService(config.storageAccountUrl);

  const excelParser =
    new ExcelParser();

  const batchPublisher =
    new BatchPublisher(app.serviceBus);

  const dispatcher =
    new Dispatcher(
      blobService,
      excelParser,
      batchPublisher,
    );

  const fileQueueConsumer =
    new FileQueueConsumer(
      app.serviceBus,
      dispatcher,
    );

  const batchWorkerManager =
    new BatchWorkerManager();

  const batchQueueConsumer =
    new BatchQueueConsumer(
      app.serviceBus,
      batchWorkerManager,
    );

  fileQueueConsumer.start();
  batchQueueConsumer.start();

  app.addHook("onClose", async () => {
    await fileQueueConsumer.close();
    await batchQueueConsumer.close();
    await batchPublisher.close();
  });
}
