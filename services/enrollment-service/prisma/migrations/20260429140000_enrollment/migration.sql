-- Enrollment Service: initial schema
-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('PENDING', 'ENROLLED', 'WAITLISTED', 'DROPPED', 'WITHDRAWN', 'COMPLETED', 'FAILED');
CREATE TYPE "enrollment_source" AS ENUM ('SELF_SERVICE', 'ADMIN', 'SYSTEM');
CREATE TYPE "grading_option" AS ENUM ('LETTER', 'PASS_FAIL');
CREATE TYPE "waitlist_status" AS ENUM ('ACTIVE', 'PROMOTED', 'REMOVED', 'EXPIRED');
CREATE TYPE "registration_role_scope" AS ENUM ('STUDENT', 'ADMIN', 'ALL');
CREATE TYPE "audit_action" AS ENUM ('ENROLLED', 'DROPPED', 'WITHDRAWN', 'OVERRIDE', 'PROMOTED_WAITLIST', 'STATUS_CHANGED', 'CAPACITY_CHANGED', 'WINDOW_CHANGED');

-- CreateTable: enrollments
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "academic_term" TEXT NOT NULL,
    "section_code" TEXT,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "enrollment_status" NOT NULL DEFAULT 'PENDING',
    "source" "enrollment_source" NOT NULL DEFAULT 'SELF_SERVICE',
    "credits_snapshot" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "grading_option" "grading_option" NOT NULL DEFAULT 'LETTER',
    "dropped_at" TIMESTAMP(3),
    "drop_reason" TEXT,
    "override_reason" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "enrollments_student_id_idx" ON "enrollments"("student_id");
CREATE INDEX "enrollments_course_id_idx" ON "enrollments"("course_id");
CREATE INDEX "enrollments_academic_term_idx" ON "enrollments"("academic_term");
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");
CREATE INDEX "enrollments_course_id_academic_term_idx" ON "enrollments"("course_id", "academic_term");
CREATE INDEX "enrollments_student_id_academic_term_idx" ON "enrollments"("student_id", "academic_term");
CREATE INDEX "enrollments_student_id_course_id_academic_term_idx" ON "enrollments"("student_id", "course_id", "academic_term");

-- Partial unique: only one ACTIVE enrollment (enrolled / pending / waitlisted)
-- per (student, course, term). Inactive history rows can coexist.
CREATE UNIQUE INDEX "enrollments_active_uniq"
  ON "enrollments"("student_id", "course_id", "academic_term")
  WHERE "status" IN ('ENROLLED', 'PENDING', 'WAITLISTED');

-- CreateTable: waitlists
CREATE TABLE "waitlists" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "academic_term" TEXT NOT NULL,
    "section_code" TEXT,
    "position" INTEGER NOT NULL,
    "priority_score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "waitlist_status" NOT NULL DEFAULT 'ACTIVE',
    "notified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "waitlists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waitlists_student_id_idx" ON "waitlists"("student_id");
CREATE INDEX "waitlists_course_id_academic_term_position_idx" ON "waitlists"("course_id", "academic_term", "position");
CREATE INDEX "waitlists_status_idx" ON "waitlists"("status");
CREATE INDEX "waitlists_student_id_status_idx" ON "waitlists"("student_id", "status");

-- Partial unique: only one ACTIVE waitlist record per (student, course, term)
CREATE UNIQUE INDEX "waitlists_active_uniq"
  ON "waitlists"("student_id", "course_id", "academic_term")
  WHERE "status" = 'ACTIVE';

-- CreateTable: registration_windows
CREATE TABLE "registration_windows" (
    "id" TEXT NOT NULL,
    "academic_term" TEXT NOT NULL,
    "role_scope" "registration_role_scope" NOT NULL DEFAULT 'STUDENT',
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "late_add_deadline" TIMESTAMP(3),
    "drop_deadline" TIMESTAMP(3) NOT NULL,
    "withdraw_deadline" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "registration_windows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_windows_academic_term_role_scope_key" ON "registration_windows"("academic_term", "role_scope");
CREATE INDEX "registration_windows_academic_term_idx" ON "registration_windows"("academic_term");
CREATE INDEX "registration_windows_is_active_idx" ON "registration_windows"("is_active");

-- CreateTable: course_capacity_snapshots
CREATE TABLE "course_capacity_snapshots" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "academic_term" TEXT NOT NULL,
    "section_code" TEXT,
    "capacity_total" INTEGER NOT NULL DEFAULT 0,
    "seats_taken" INTEGER NOT NULL DEFAULT 0,
    "seats_reserved" INTEGER NOT NULL DEFAULT 0,
    "waitlist_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_capacity_snapshots_pkey" PRIMARY KEY ("id")
);

-- Postgres treats NULLs as distinct in unique indexes, so we coerce
-- section_code to a literal '*' for uniqueness purposes.
CREATE UNIQUE INDEX "course_capacity_snapshots_unique"
  ON "course_capacity_snapshots"("course_id", "academic_term", (COALESCE("section_code", '*')));
CREATE INDEX "course_capacity_snapshots_course_id_academic_term_idx" ON "course_capacity_snapshots"("course_id", "academic_term");

-- CreateTable: enrollment_audit_logs
CREATE TABLE "enrollment_audit_logs" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT,
    "actor_user_id" TEXT,
    "action" "audit_action" NOT NULL,
    "metadata_json" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enrollment_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "enrollment_audit_logs_enrollment_id_idx" ON "enrollment_audit_logs"("enrollment_id");
CREATE INDEX "enrollment_audit_logs_actor_user_id_idx" ON "enrollment_audit_logs"("actor_user_id");
CREATE INDEX "enrollment_audit_logs_action_idx" ON "enrollment_audit_logs"("action");
CREATE INDEX "enrollment_audit_logs_created_at_idx" ON "enrollment_audit_logs"("created_at");

ALTER TABLE "enrollment_audit_logs"
  ADD CONSTRAINT "enrollment_audit_logs_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: audit_logs (generic)
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
