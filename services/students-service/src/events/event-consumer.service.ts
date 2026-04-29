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

  @OnEvent(INBOUND_EVENTS.AUTH_STUDENT_CREATED)
  handleAuthStudentCreated(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.AUTH_STUDENT_CREATED}`);
    // Wire to StudentsService.createFromAuth(...) in your broker adapter.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.GRADES_SEMESTER_CLOSED)
  handleGradesSemesterClosed(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.GRADES_SEMESTER_CLOSED}`);
    // Wire to AcademicHistoryService.recordSnapshot(...) in your broker adapter.
    void envelope;
  }

  @OnEvent(INBOUND_EVENTS.ENROLLMENT_STATUS_CHANGED)
  handleEnrollmentStatusChanged(envelope: unknown): void {
    this.logger.log(`Received ${INBOUND_EVENTS.ENROLLMENT_STATUS_CHANGED}`);
    // Wire to StudentsService.syncEnrollmentStatus(...) in your broker adapter.
    void envelope;
  }
}
