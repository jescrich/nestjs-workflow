import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WorkflowModule } from '@jescrich/nestjs-workflow';
import { inventoryWorkflowDefinition } from './inventory.workflow';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryEntityService } from './inventory.entity.service';
import { KafkaProducerService } from './kafka/kafka-producer.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WorkflowModule.register({
      name: 'InventoryManagementWorkflow',
      definition: inventoryWorkflowDefinition,
      // Enable Kafka integration - the workflow will automatically consume events
      kafka: {
        enabled: true,
        clientId: 'inventory-workflow',
        brokers: 'localhost:9093' // Non-default port
      }
    }),
  ],
  providers: [
    InventoryService,
    InventoryEntityService,
    KafkaProducerService // Only for demo publishing
  ],
  controllers: [InventoryController],
  exports: [InventoryService, InventoryEntityService, KafkaProducerService]
})
export class InventoryModule {}