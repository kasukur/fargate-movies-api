import { createApp } from './app';
import { config } from './config';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`Movies API listening on port ${config.port}`);
  console.log(`DynamoDB table: ${config.tableName} (region: ${config.region})`);
  if (config.dynamoDbEndpoint) {
    console.log(`Using local DynamoDB endpoint: ${config.dynamoDbEndpoint}`);
  }
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
