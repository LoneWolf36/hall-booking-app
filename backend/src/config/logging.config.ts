import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const createLoggerConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return WinstonModule.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      isDevelopment
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          )
        : winston.format.json(),
    ),
    defaultMeta: { service: 'hall-booking-api' },
    transports: [
      new winston.transports.Console(),
      ...(isDevelopment
        ? []
        : [
            new winston.transports.File({
              filename: 'logs/error.log',
              level: 'error',
            }),
            new winston.transports.File({
              filename: 'logs/combined.log',
            }),
          ]),
    ],
  });
};
