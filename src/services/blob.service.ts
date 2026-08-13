import {
  BlobServiceClient,
} from "@azure/storage-blob";
import {
  DefaultAzureCredential,
} from "@azure/identity";

export class BlobService {
  private readonly client: BlobServiceClient;

  constructor(accountUrl: string) {
    if (!accountUrl) {
      throw new Error("Storage account URL is required");
    }

    this.client = new BlobServiceClient(
      accountUrl,
      new DefaultAzureCredential(),
    );
  }

  async download(
    containerName: string,
    blobName: string,
  ): Promise<Buffer> {
    const container =
      this.client.getContainerClient(containerName);

    const blob =
      container.getBlobClient(blobName);

    const response =
      await blob.download();

    if (!response.readableStreamBody) {
      throw new Error(
        `Blob stream is unavailable: ${containerName}/${blobName}`,
      );
    }

    const chunks: Buffer[] = [];

    for await (const chunk of response.readableStreamBody) {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk),
      );
    }

    return Buffer.concat(chunks);
  }
}
