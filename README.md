# WebFileCheck Dispatcher

This project implements the flow:

File Queue
-> Dispatcher
-> Azure Blob download
-> ExcelJS parsing
-> byte-based batch chunking
-> Batch Queue
-> Batch Queue Consumer
-> start of worker-thread boundary

## Current scope

The worker thread is intentionally only a boundary/skeleton. NetReveal
processing is NOT implemented in this package yet.

## Important message limits

- Azure Service Bus theoretical limit: 256 KB
- Application hard limit: 200 KB
- Preferred target: 180 KB

The chunker does not use a fixed record count. Record count is dynamic
because Excel records can have very different sizes.

A single record larger than 200 KB is rejected because one logical record
cannot safely be split across independent batch messages.

## Performance design

The dispatcher does not repeatedly do:

    [...currentRecords, record]
    JSON.stringify(currentRecords)

for every record.

Each record is serialized once and a running byte counter is maintained.

The final publisher performs an exact JSON UTF-8 byte-length check before
sending to Service Bus.

For the current 10K-row requirement, Excel parsing remains in the main
process. The expensive high-concurrency NetReveal stage is the intended
worker-thread stage.

## Startup

`server.ts`

1. Loads environment variables.
2. Builds Fastify.
3. Registers the Service Bus plugin.
4. Waits for Fastify's plugin lifecycle with `app.ready()`.
5. Starts the File Queue consumer.
6. Starts the Batch Queue consumer.
7. The Batch Queue consumer invokes `BatchWorkerManager`.
8. `BatchWorkerManager` starts `batch.worker.ts`.

## Important production note

`BatchWorkerManager` currently creates a worker per received batch only to
demonstrate the worker-thread boundary. Before production, replace it with
a bounded worker pool (for example 8 workers per replica) and implement
backpressure, retry/DLQ handling, idempotency and NetReveal concurrency.

## Azure authentication

The sample uses `DefaultAzureCredential`.

For Azure-hosted workloads, configure the workload/managed identity and
grant the required RBAC roles to:

- Storage Blob Data Reader on the storage account/container
- Azure Service Bus Data Receiver on the file and batch queues
- Azure Service Bus Data Sender on the batch queue

For local development, configure an Azure identity supported by
DefaultAzureCredential.

## Blob path format

The sample assumes:

    <container>/<blob-name>

For example:

    webfilecheck/input/2026/file.xlsx

becomes:

    container = webfilecheck
    blobName  = input/2026/file.xlsx
