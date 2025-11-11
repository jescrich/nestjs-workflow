import { Module } from '@nestjs/common';
import { OrderModule } from './order.module';

@Module({
  imports: [OrderModule],
})
export class AppModule {}