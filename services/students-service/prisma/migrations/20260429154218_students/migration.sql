-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('ACTIVE', 'PROBATION', 'SUSPENDED', 'GRADUATED', 'WITHDRAWN', 'PENDING');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED');

-- CreateEnum
CREATE TYPE "academic_standing" AS ENUM ('GOOD', 'WARNING', 'PROBATION', 'DISMISSED');

-- CreateEnum
CREATE TYPE "contact_type" AS ENUM ('EMAIL', 'PHONE', 'GUARDIAN', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "note_visibility" AS ENUM ('ADMIN', 'ADVISOR', 'INTERNAL');

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "student_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "gender",
    "nationality" TEXT,
    "national_id" TEXT,
    "admission_date" DATE NOT NULL,
    "expected_graduation_date" DATE,
    "department_id" TEXT,
    "program_name" TEXT NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "enrollment_status" "enrollment_status" NOT NULL DEFAULT 'PENDING',
    "advisor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "profile_photo_url" TEXT,
    "bio" TEXT,
    "address_line_1" TEXT NOT NULL DEFAULT '',
    "address_line_2" TEXT,
    "city" TEXT NOT NULL DEFAULT '',
    "state_region" TEXT NOT NULL DEFAULT '',
    "postal_code" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "emergency_contact_name" TEXT NOT NULL DEFAULT '',
    "emergency_contact_phone" TEXT NOT NULL DEFAULT '',
    "emergency_contact_relation" TEXT NOT NULL DEFAULT '',
    "medical_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "status" "attendance_status" NOT NULL,
    "marked_by_user_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_history" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "semester_name" TEXT NOT NULL,
    "credits_attempted" INTEGER NOT NULL,
    "credits_completed" INTEGER NOT NULL,
    "gpa" DECIMAL(4,2) NOT NULL,
    "cgpa" DECIMAL(4,2) NOT NULL,
    "academic_standing" "academic_standing" NOT NULL,
    "remarks" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_contacts" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "type" "contact_type" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_notes" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "visibility" "note_visibility" NOT NULL DEFAULT 'INTERNAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "students_auth_user_id_key" ON "students"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_number_key" ON "students"("student_number");

-- CreateIndex
CREATE INDEX "students_auth_user_id_idx" ON "students"("auth_user_id");

-- CreateIndex
CREATE INDEX "students_student_number_idx" ON "students"("student_number");

-- CreateIndex
CREATE INDEX "students_enrollment_status_idx" ON "students"("enrollment_status");

-- CreateIndex
CREATE INDEX "students_last_name_idx" ON "students"("last_name");

-- CreateIndex
CREATE INDEX "students_department_id_idx" ON "students"("department_id");

-- CreateIndex
CREATE INDEX "students_advisor_id_idx" ON "students"("advisor_id");

-- CreateIndex
CREATE INDEX "students_program_name_idx" ON "students"("program_name");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_student_id_key" ON "student_profiles"("student_id");

-- CreateIndex
CREATE INDEX "student_profiles_student_id_idx" ON "student_profiles"("student_id");

-- CreateIndex
CREATE INDEX "attendance_student_id_idx" ON "attendance"("student_id");

-- CreateIndex
CREATE INDEX "attendance_course_id_session_date_idx" ON "attendance"("course_id", "session_date");

-- CreateIndex
CREATE INDEX "attendance_session_date_idx" ON "attendance"("session_date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_student_id_course_id_session_date_key" ON "attendance"("student_id", "course_id", "session_date");

-- CreateIndex
CREATE INDEX "academic_history_student_id_idx" ON "academic_history"("student_id");

-- CreateIndex
CREATE INDEX "academic_history_academic_standing_idx" ON "academic_history"("academic_standing");

-- CreateIndex
CREATE UNIQUE INDEX "academic_history_student_id_semester_name_key" ON "academic_history"("student_id", "semester_name");

-- CreateIndex
CREATE INDEX "student_contacts_student_id_idx" ON "student_contacts"("student_id");

-- CreateIndex
CREATE INDEX "student_contacts_type_idx" ON "student_contacts"("type");

-- CreateIndex
CREATE INDEX "student_notes_student_id_idx" ON "student_notes"("student_id");

-- CreateIndex
CREATE INDEX "student_notes_visibility_idx" ON "student_notes"("visibility");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_history" ADD CONSTRAINT "academic_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_contacts" ADD CONSTRAINT "student_contacts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
