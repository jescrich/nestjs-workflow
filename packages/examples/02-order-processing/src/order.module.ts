import { Module } from '@nestjs/common';
import { WorkflowModule, EntityService } from '@jescrich/nestjs-workflow';
import { orderWorkflowDefinition } from './order.workflow';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { OrderEntityService } from './order.entity.service';
import { PaymentService } from './services/payment.service';
import { InventoryService } from './services/inventory.service';
import { ShippingService } from './services/shipping.service';
import { Order, OrderStatus } from './order.entity';

@Module({
  imports: [
    WorkflowModule.register({
      name: 'OrderProcessingWorkflow',
      definition: orderWorkflowDefinition,
    }),
  ],
  providers: [
    OrderService,
    OrderEntityService,
    PaymentService,
    InventoryService,
    ShippingService
  ],
  controllers: [OrderController],
  exports: [OrderService, OrderEntityService]
})
export class OrderModule {}