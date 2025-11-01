import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { createLoggerConfig } from './config/logging.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: createLoggerConfig(),
  });

  // Global API prefix
  const apiPrefix = 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000', 
      process.env.CORS_ORIGIN || '*'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Swagger documentation - mount under the same api prefix for consistency
  const config = new DocumentBuilder()
    .setTitle('Hall Booking API')
    .setDescription('API for Parbhani hall booking system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix.replace(/\/$/, '')}/docs`, app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(
    `🚀 Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  logger.log(
    `📚 Swagger docs available at: http://localhost:${port}/${apiPrefix}/docs`,
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
