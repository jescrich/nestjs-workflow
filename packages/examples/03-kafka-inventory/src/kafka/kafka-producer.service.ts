import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import {
  StockReceivedPayload,
  StockAllocatedPayload,
  StockReleasedPayload,
  StockAdjustedPayload,
  AuditRequestedPayload,
  ReorderTriggeredPayload
} from '../inventory.entity';

/**
 * This service is only for publishing events to Kafka for demo purposes.
 * The WorkflowModule handles all Kafka consumption automatically.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'inventory-demo-producer',
      brokers: ['localhost:9093'], // Non-default port
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log('Kafka producer connected for demo');
    } catch (error) {
      this.logger.warn('Kafka producer not connected - demo will run without Kafka events');
      this.connected = false;
    }
  }

  private async disconnect() {
    if (this.connected) {
      try {
        await this.producer.disconnect();
        this.logger.log('Kafka producer disconnected');
      } catch (error) {
        this.logger.error('Error disconnecting Kafka producer', error);
      }
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Producer methods for demo - these publish to Kafka topics
  // The WorkflowModule will automatically consume these and trigger state transitions

  async publishStockReceived(payload: StockReceivedPayload) {
    if (!this.connected) {
      this.logger.warn('Kafka not connected - event not published');
      return;
    }

    await this.producer.send({
      topic: 'inventory.stock.received',
      messages: [
        {
          key: payload.sku,
          value: JSON.stringify({ key: payload.sku, event: payload }),
          timestamp: Date.now().toString()
        }
      ]
    });
    this.logger.log(`Published stock received event for ${payload.sku} to Kafka`);
  }

  async publishStockAllocated(payload: StockAllocatedPayload) {
    if (!this.connected) {
      this.logger.warn('Kafka not connected - event not published');
      return;
    }

    await this.producer.send({
      topic: 'inventory.stock.allocated',
      messages: [
        {
          key: payload.sku,
          value: JSON.stringify({ key: payload.sku, event: payload }),
          timestamp: Date.now().toString()
        }
      ]
    });
    this.logger.log(`Published stock allocated event for ${payload.sku} to Kafka`);
  }

  async publishStockReleased(payload: StockReleasedPayload) {
    if (!this.connected) {
      this.logger.warn('Kafka not connected - event not published');
      return;
    }

    await this.producer.send({
      topic: 'inventory.stock.released',
      messages: [
        {
          key: payload.sku,
          value: JSON.stringify({ key: payload.sku, event: payload }),
          timestamp: Date.now().toString()
        }
      ]
    });
    this.logger.log(`Published stock released event for ${payload.sku} to Kafka`);
  }

  async publishStockAdjusted(payload: StockAdjustedPayload) {
    if (!this.connected) {
      this.logger.warn('Kafka not connected - event not published');
      return;
    }

    await this.producer.send({
      topic: 'inventory.stock.adjusted',
      messages: [
        {
          key: payload.sku,
          value: JSON.stringify({ key: payload.sku, event: payload }),
          timestamp: Date.now().toString()
        }
      ]
    });
    this.logger.log(`Published stock adjusted event for ${payload.sku} to Kafka`);
  }

  async publishAuditRequested(payload: AuditRequestedPayload) {
    if (!this.connected) {
      this.logger.warn('Kafka not connected - event not published');
      return;
    }

    await this.producer.send({
      topic: 'inventory.audit.requested',
      messages: [
        {
          key: payload.sku,
          value: JSON.stringify({ key: payload.sku, event: payload }),
          timestamp: Date.now().toString()
        }
      ]
    });
    this.logger.log(`Published audit requested event for ${payload.sku} to Kafka`);
  }

  async publishReorderTriggered(payload: ReorderTriggeredPayload) {
    if (!this.connected) {
      this.logger.warn('Kafka not connected - event not published');
      return;
    }

    await this.producer.send({
      topic: 'inventory.reorder.triggered',
      messages: [
        {
          key: payload.sku,
          value: JSON.stringify({ key: payload.sku, event: payload }),
          timestamp: Date.now().toString()
        }
      ]
    });
    this.logger.log(`Published reorder triggered event for ${payload.sku} to Kafka`);
  }
}