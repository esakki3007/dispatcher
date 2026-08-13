import "dotenv/config";
import {
  buildApp,
  startConsumers,
} from "./app";
import { config, validateConfig } from "./config/config";

async function start() {
  validateConfig();

  const app = buildApp();

  try {
    // Fastify plugin lifecycle completes here.
    await app.ready();

    await startConsumers(app);

    await app.listen({
      port: config.port,
      host: "0.0.0.0",
    });

    app.log.info(
      `Application listening on ${config.port}`,
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
