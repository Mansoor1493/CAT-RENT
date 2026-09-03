import mongoose from 'mongoose';
import { config } from './env';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri);
    logger.info('Connected to MongoDB successfully');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    // Retry after 5 seconds
    logger.info('Retrying MongoDB connection in 5 seconds...');
    setTimeout(() => connectDatabase(), 5000);
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Attempting to reconnect...');
  });
}
