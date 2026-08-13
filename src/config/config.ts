export const config = {
  port: Number(process.env.PORT ?? 3000),

  serviceBusNamespace:
    process.env.AZURE_SERVICE_BUS_NAMESPACE ?? "",

  storageAccountUrl:
    process.env.AZURE_STORAGE_ACCOUNT_URL ?? "",

  fileQueueName:
    process.env.FILE_QUEUE_NAME ??
    "webfilecheck-file-queue",

  batchQueueName:
    process.env.BATCH_QUEUE_NAME ??
    "webfilecheck-batch-queue",

  batchTargetBytes:
    Number(
      process.env.BATCH_TARGET_BYTES ??
      180 * 1024,
    ),

  batchHardMaxBytes:
    Number(
      process.env.BATCH_HARD_MAX_BYTES ??
      200 * 1024,
    ),
} as const;

export function validateConfig(): void {
  const required: Array<[string, string]> = [
    [
      "AZURE_SERVICE_BUS_NAMESPACE",
      config.serviceBusNamespace,
    ],
    [
      "AZURE_STORAGE_ACCOUNT_URL",
      config.storageAccountUrl,
    ],
  ];

  for (const [name, value] of required) {
    if (!value) {
      throw new Error(`Missing environment variable: ${name}`);
    }
  }

  if (
    config.batchTargetBytes <= 0 ||
    config.batchHardMaxBytes <= 0 ||
    config.batchTargetBytes >= config.batchHardMaxBytes
  ) {
    throw new Error(
      "BATCH_TARGET_BYTES must be > 0 and less than BATCH_HARD_MAX_BYTES",
    );
  }
}
