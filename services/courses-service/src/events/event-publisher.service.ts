import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * EventPublisherService — emits domain events to the in-process event bus.
 *
 * In production this is wired to a message broker (Kafka / RabbitMQ / NATS)
 * via a dedicated adapter; here we use EventEmitter2 as the default transport
 * so the rest of the codebase stays decoupled from the broker choice.
 */
@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  publish<T extends Record<string, unknown>>(event: string, payload: T): void {
    const envelope = {
      event,
      payload,
      occurredAt: new Date().toISOString(),
      service: 'courses-service',
    };
    this.logger.debug(`emit ${event}`);
    this.emitter.emit(event, envelope);
  }
}
