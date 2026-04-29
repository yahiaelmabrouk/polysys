import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventPublisherService } from './event-publisher.service';
import { EventConsumerService } from './event-consumer.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 50,
    }),
  ],
  providers: [EventPublisherService, EventConsumerService],
  exports: [EventPublisherService],
})
export class EventsModule {}
