import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose']
  });
  
  const port = process.env.PORT || 3002;
  await app.listen(port);
  
  Logger.log(`🚀 Kafka Inventory Workflow application is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📊 Kafka integration enabled - consuming events from localhost:9093`, 'Bootstrap');
  Logger.log(`📝 API Documentation available at: http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();