import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  Logger.log(`🚀 BullMQ Task Workflow application is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📦 Redis connection: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`, 'Bootstrap');
}

bootstrap();
