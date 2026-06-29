/**
 * Winston logger — structured, leveled, dev-friendly.
 */
import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: config.env === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

// Add file transports in production
if (config.env === 'production') {
  logger.add(new winston.transports.File({
    filename: path.resolve(__dirname, '../../logs/error.log'),
    level: 'error',
    maxsize: 5_242_880,
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({
    filename: path.resolve(__dirname, '../../logs/combined.log'),
    maxsize: 5_242_880,
    maxFiles: 5,
  }));
}

export default logger;
