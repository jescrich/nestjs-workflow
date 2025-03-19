import { Injectable, Logger } from '@nestjs/common';
import { Kafka, logLevel } from 'kafkajs';
import { EventMessage, IEventHandler } from './event.handler';

@Injectable()
export class KafkaClient {
  private readonly logger = new Logger(KafkaClient.name);
  kafka: Kafka;

  constructor(
    private readonly clientId?: string,
    private readonly brokers?: string,
  ) {
    this.kafka = new Kafka({
      clientId: clientId,
      brokers: brokers?.split(',') ?? ['localhost:9092'],
      logLevel: logLevel.WARN,
    });
  }

  async produce<T>(topic: string, key: string, event: T): Promise<void> {
    try {
      const producer = this.kafka.producer();

      await producer.connect();

      await producer.send({
        topic,
        messages: [
          {
            key: key,
            value: JSON.stringify(event),
          },
        ],
      });

      this.logger.log(`Event dispatched`, topic, key);
      await producer.disconnect();
    } catch (e) {
      this.logger.error(`Error dispatching event. ${key}`, e, topic, key);
      throw new Error(`Error dispatching event. ${key}`);
    }
  }

  async consume<T>(topic: string, groupId: string, handler: IEventHandler<T> 
    | ((params: { key: string; event: T; payload?: EventMessage; }) => Promise<void>)): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });

    const RETRY_DELAY_MS = 30000;

    const RETRY_LIMIT = 3;

    const retryCounts: Map<string, number> = new Map();

    // TODO: change any with a kafkamessage type.
    const processMessage = async (key: string, value: any, payload: EventMessage) => {
      const content = value?.toString() ?? null;

      if (content === null) {
        this.logger.error('Event content is null', null, topic, key);

        return;
      }

      const event: T = JSON.parse(content);

      if (typeof handler === 'function') {
        await handler({ key, event, payload: payload as any });
      } else {
        await handler.handle({ key, event, payload: payload as any });
      }
    };

    const sendToDeadLetterQueue = async (message: EventMessage) => {
      const producer = this.kafka.producer();
      await producer.connect();
      await producer.send({
        topic: `${topic}-dlq`,
        messages: [
          {
            key: message.key,
            value: message.value,
          },
        ],
      });
      await producer.disconnect();
      this.logger.warn(`Message offset ${message.offset} sent to DLQ.`, topic);
    };

    const runConsumer = async () => {
      await consumer.connect();

      await consumer.subscribe({ topic, fromBeginning: true });

      await consumer.run({
        eachBatchAutoResolve: false,
        eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
          for (const message of batch.messages) {
            if (!isRunning() || isStale()) break;

            const { topic, partition } = batch;

            const offsetKey = `${topic}-${partition}-${message.offset}`;

            const retries = retryCounts.get(offsetKey) || 0;

            try {
              const key = message.key?.toString() ?? '';
              this.logger.log(`Processing message`, message.offset, topic, key);

              await processMessage(key, message.value, message as EventMessage);

              resolveOffset(message.offset);
              this.logger.log(`Message processed successfully`, message.offset, topic, key);
              retryCounts.delete(offsetKey);
            } catch (error) {
              this.logger.error(
                `Error processing message: ${error}`,
                null,
                message.offset,
                topic,
                message.key?.toString(),
              );

              if (retries < RETRY_LIMIT) {
                retryCounts.set(offsetKey, retries + 1);

                this.logger.warn(`Retrying message.`, message.offset, topic, message.key?.toString());

                consumer.pause([{ topic, partitions: [partition] }]);

                setTimeout(async () => {
                  this.logger.log(`Resuming message.`, message.offset, topic, message.key?.toString());
                  consumer.resume([{ topic, partitions: [partition] }]);
                }, RETRY_DELAY_MS);
              } else {
                this.logger.warn(`Exceeded retry limit.`, message.offset, topic, message.key?.toString());
                resolveOffset(message.offset);
                // Send to DLQ after exceeding retry limit
                await sendToDeadLetterQueue(message as EventMessage);
                retryCounts.delete(offsetKey); // Clear retry count
              }
            }

            await heartbeat();
          }
        },
      });
    };

    runConsumer().catch((error) => {
      this.logger.error('Error starting Kafka consumer:', error);
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      const topics = await admin.listTopics();
      await admin.disconnect();

      // If we can list topics, the connection is healthy
      return topics.length >= 0;
    } catch (error) {
      this.logger.error('Kafka health check failed:', error);
      return false;
    }
  }
}
