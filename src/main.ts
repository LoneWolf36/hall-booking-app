import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { createLoggerConfig } from './config/logging.config';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: createLoggerConfig(),
  });
  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Hall Booking API')
    .setDescription('API for Parbhani hall booking system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  const port = process.env.PORT || 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
