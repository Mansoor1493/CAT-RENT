import http from 'http';
import app from './app';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import { initializeSocket } from './config/socket';
import { initializeJobs } from './jobs';
import { logger } from './utils/logger';
import { Equipment } from './models';
import { seedDatabase } from './seed/seedDatabase';

const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

// Connect to database and start server
async function start() {
  await connectDatabase();

  // Auto-seed if database is empty
  const equipmentCount = await Equipment.countDocuments();
  if (equipmentCount === 0) {
    logger.info('Equipment database is empty. Auto-seeding initial fleet data...');
    await seedDatabase(false);
  }

  initializeJobs();

  server.listen(config.port, () => {
    logger.info(`CATFLEET IQ API running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`MongoDB: ${config.mongodbUri}`);
  });
}

start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export default server;
