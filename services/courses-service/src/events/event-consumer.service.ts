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

  @OnEvent(INBOUND_EVENTS.AUTH_TEACHER_UPDATED)
  handleAuthTeacherUpdated(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.AUTH_TEACHER_UPDATED}`);
    // Wire to TeacherAssignmentsService.syncTeacherChanges(...) in your broker adapter.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.ACADEMIC_TERM_CREATED)
  handleAcademicTermCreated(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.ACADEMIC_TERM_CREATED}`);
    // Wire to CatalogService.activateTerm(...) in your broker adapter.
    void envelope;
  }
}
