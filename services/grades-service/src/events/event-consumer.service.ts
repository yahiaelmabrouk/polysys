import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { INBOUND_EVENTS } from './event-names';

/**
 * Consumes events emitted by other microservices.
 *
 * In production these handlers are bound to broker subscriptions
 * (Kafka topics / RabbitMQ queues). For a single-service deployment
 * they are wired through @nestjs/event-emitter for parity.
 */
@Injectable()
export class EventConsumerService {
  private readonly logger = new Logger(EventConsumerService.name);

  @OnEvent(INBOUND_EVENTS.ENROLLMENT_CREATED)
  handleEnrollmentCreated(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.ENROLLMENT_CREATED}`);
    // Wire to GradesService.linkEnrollment(...) in your broker adapter.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.ENROLLMENT_WITHDRAWN)
  handleEnrollmentWithdrawn(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.ENROLLMENT_WITHDRAWN}`);
    // Wire to ResultsService.markWithdrawn(...) in your broker adapter.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.COURSE_UPDATED)
  handleCourseUpdated(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.COURSE_UPDATED}`);
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.TERM_CLOSED)
  handleTermClosed(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.TERM_CLOSED}`);
    // Wire to ResultsService.publishTerm(term) in your broker adapter.
    void envelope;
  }
}
