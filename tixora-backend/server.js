import app from './src/app.js';
import { ENV, validateProductionEnv } from './src/config/env.js';
import { startBackgroundWorkers, stopBackgroundWorkers } from './src/workers/index.js';
import { logger } from './src/utils/logger.js';

validateProductionEnv();
export let server;

function startServer(port, retry = 0) {
  const instance = app.listen(port);
  instance.once('listening', async () => {
    server = instance;
    const actualPort = instance.address().port;
    logger.info(`TIXORA Backend service running on port ${actualPort} [${ENV.NODE_ENV}]`);
    logger.info(`API Base URL: http://localhost:${actualPort}${ENV.API_PREFIX}`);
    await startBackgroundWorkers();
  });
  instance.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && ENV.NODE_ENV !== 'production' && retry < 10) {
      logger.warn(`Port ${port} is already in use; trying port ${Number(port) + 1}.`);
      startServer(Number(port) + 1, retry + 1);
      return;
    }
    logger.error(`Could not start backend on port ${port}.`, error);
    process.exitCode = 1;
  });
  return instance;
}

startServer(ENV.PORT);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  stopBackgroundWorkers();
  server?.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  stopBackgroundWorkers();
  server?.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

export { server as default };
