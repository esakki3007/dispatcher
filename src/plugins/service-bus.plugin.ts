import fp from "fastify-plugin";
import {
  ServiceBusClient,
} from "@azure/service-bus";
import {
  DefaultAzureCredential,
} from "@azure/identity";
import { config } from "../config/config";

export default fp(async (app) => {
  const credential = new DefaultAzureCredential();

  const client = new ServiceBusClient(
    config.serviceBusNamespace,
    credential,
  );

  app.decorate("serviceBus", client);

  app.addHook("onClose", async () => {
    await client.close();
  });
});
