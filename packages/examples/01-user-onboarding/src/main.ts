import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  // Enable CORS
  app.enableCors();
  
  // Set global prefix
  app.setGlobalPrefix('api');
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.log(`Application is running on: http://localhost:${port}/api`);
  logger.log('');
  logger.log('Available endpoints:');
  logger.log('POST   /api/users/register               - Register new user');
  logger.log('GET    /api/users/verify-email           - Verify email with token');
  logger.log('GET    /api/users/:id                    - Get user by ID');
  logger.log('GET    /api/users/email/:email           - Get user by email');
  logger.log('PUT    /api/users/:id/profile            - Update user profile');
  logger.log('POST   /api/users/:id/verify-identity    - Start identity verification');
  logger.log('PUT    /api/users/:id/suspend            - Suspend user account');
  logger.log('PUT    /api/users/:id/reactivate         - Reactivate suspended account');
  logger.log('GET    /api/users/metrics/onboarding     - Get onboarding metrics');
  logger.log('');
  logger.log('Admin endpoints:');
  logger.log('POST   /api/users/admin/process-inactive - Process inactive users');
  logger.log('POST   /api/users/admin/send-reminders   - Send onboarding reminders');
}

bootstrap();