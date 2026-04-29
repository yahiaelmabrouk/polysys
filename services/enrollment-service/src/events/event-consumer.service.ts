import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { INBOUND_EVENTS } from './event-names';

/**
 * Consumes inbound events from other microservices.
 *
 * In production these handlers are bound to broker subscriptions
 * (Kafka topics / RabbitMQ queues). For local single-service deployment
 * they are wired through @nestjs/event-emitter for parity.
 *
 * Side effects (e.g. invalidating capacity for an archived course, or
 * refusing future enrollments for a suspended student) are routed to the
 * appropriate domain services through dedicated adapters; the handlers below
 * are intentionally inert until that broker adapter is wired in.
 */
@Injectable()
export class EventConsumerService {
  private readonly logger = new Logger(EventConsumerService.name);

  @OnEvent(INBOUND_EVENTS.COURSE_UPDATED)
  handleCourseUpdated(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.COURSE_UPDATED}`);
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.COURSE_ARCHIVED)
  handleCourseArchived(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.COURSE_ARCHIVED}`);
    // Wire to CapacityService.markCourseInactive(courseId) in broker adapter.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.STUDENT_STATUS_CHANGED)
  handleStudentStatusChanged(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.STUDENT_STATUS_CHANGED}`);
    // If new status is SUSPENDED, EnrollmentsService can drop active rows.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.REGISTRATION_TERM_OPENED)
  handleRegistrationTermOpened(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.REGISTRATION_TERM_OPENED}`);
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.FINANCE_HOLD_PLACED)
  handleFinanceHoldPlaced(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.FINANCE_HOLD_PLACED}`);
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.FINANCE_HOLD_CLEARED)
  handleFinanceHoldCleared(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.FINANCE_HOLD_CLEARED}`);
    void envelope;
  }
}
