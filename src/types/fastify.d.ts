import type { ServiceBusClient } from "@azure/service-bus";

declare module "fastify" {
  interface FastifyInstance {
    serviceBus: ServiceBusClient;
  }
}
