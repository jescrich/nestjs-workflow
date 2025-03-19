import { DynamicModule, Global, Module } from '@nestjs/common';
import { KafkaClient } from './client';


@Global()
@Module({})
export class KafkaModule {
  static register(params: { clientId: string; brokers: string }): DynamicModule {
    const { clientId, brokers } = params;

    if (!brokers) {
      throw new Error('Unable to create KafkaClientModule: missing brokers');
    }

    const providers = [
      {
        provide: KafkaClient,
        useFactory: () => new KafkaClient(clientId, brokers),
      },
    ];
    return {
      module: KafkaModule,
      providers,
      exports: [KafkaClient],
    };
  }
}
