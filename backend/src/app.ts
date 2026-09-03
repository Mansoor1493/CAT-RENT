import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - high allowance for live telemetry dashboards & multi-tab navigation
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000, // High capacity for live telemetry and multi-client dashboards
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.nodeEnv === 'development' || req.ip === '127.0.0.1' || req.ip === '::1',
});
app.use('/api/', limiter);

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

export default app;
