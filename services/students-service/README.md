# Students Service

Production-ready microservice that owns the **student identity domain** within the
University Management System: master records, profiles, contacts, attendance,
academic-history snapshots, and advisor/admin notes.

This service does **not** own auth credentials, course catalog, enrollments,
grade calculations, invoices/payments, or schedules — those belong to other
services and are referenced here only by ID.

---

## Stack

- Node.js 20 · NestJS 10
- PostgreSQL 16 · Prisma 5
- Passport JWT (validates tokens issued by Auth Service)
- @nestjs/event-emitter (swap with Kafka/RabbitMQ adapter in production)
- Helmet · Throttler · class-validator
- Winston logger · Docker-ready

---

## Quick Start

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

Service listens on `http://localhost:3002`.

### Docker

```bash
docker compose up -d
```

---

## Architecture

```
src/
├─ students/           # master records + search + create flow
├─ profiles/           # extended profile (1:1 with student)
├─ attendance/         # daily/class attendance + bulk + lock window
├─ academic-history/   # GPA/CGPA snapshots from Grades Service
├─ contacts/           # multiple typed contacts per student
├─ notes/              # admin/advisor notes
├─ internal/           # x-internal-secret routes for sister services
├─ events/             # publisher + consumer + event name constants
├─ guards/             # JWT, Roles, Permissions, Internal
├─ strategies/         # JWT access strategy (verifies Auth tokens)
├─ common/             # decorators, filters, interceptors, audit log, DTOs
├─ config/             # env loading + Joi validation
├─ database/           # PrismaService (global)
└─ middleware/         # request context (client IP)
```

---

## Auth Model

Tokens are issued by **Auth Service** and verified locally using the shared
`JWT_ACCESS_SECRET`. The decoded payload exposes `sub` (auth user id), `email`,
`role`, and `permissions[]`.

- `JwtAuthGuard` (global) — runs unless `@Public()` is set.
- `RolesGuard` (global) — checks `@Roles('Admin', 'Teacher', ...)`.
- `PermissionsGuard` (global) — checks `@Permissions(...)`.
- `InternalGuard` — protects `/internal/*` with the `x-internal-secret` header.

Roles: `Admin`, `Teacher`, `Student`, `Finance Staff`.

---

## API Surface

### Health
- `GET /health` — public

### Self-service (`Student`)
- `GET    /students/me`
- `PATCH  /students/me/contact`
- `GET    /students/me/attendance`
- `GET    /students/me/history`

### Admin / Staff
- `POST   /students` — Admin
- `GET    /students` — Admin · Teacher · Finance Staff (search + filter + paginate)
- `GET    /students/:id` — Admin · Teacher · Finance Staff
- `PATCH  /students/:id` — Admin
- `PATCH  /students/:id/status` — Admin (audited; emits `student.status_changed`)
- `GET    /students/:id/attendance` — Admin · Teacher
- `GET    /students/:id/history` — Admin · Teacher · Finance Staff
- `POST   /students/:id/notes` — Admin · Teacher
- `GET    /students/:studentId/notes` — Admin · Teacher (filtered by visibility)
- `*      /students/:studentId/contacts` — Admin

### Profiles
- `GET    /profiles/:studentId` — Admin
- `PATCH  /profiles/:studentId` — Admin

### Attendance
- `POST   /attendance` — Admin · Teacher
- `POST   /attendance/bulk` — Admin · Teacher
- `GET    /attendance/course/:courseId` — Admin · Teacher
- `PATCH  /attendance/:id` — Admin · Teacher (subject to lock window)

### Academic History
- `GET    /academic-history/:studentId` — Admin · Teacher · Finance Staff
- `POST   /academic-history/:studentId` — Admin (manual; canonical path is events)

### Internal (`x-internal-secret` required, JWT bypassed)
- `GET    /internal/students/:id`
- `GET    /internal/by-auth-user/:authUserId`
- `GET    /internal/student-number/:studentNumber`
- `GET    /internal/students/:id/status`
- `POST   /internal/students/:id/academic-history`

### Search filters on `GET /students`
`name`, `studentNumber`, `departmentId`, `program`, `level`, `status`,
`advisorId`, `admissionYear`, plus `page`, `limit`, `sortBy`, `sortOrder`.

---

## Business Rules

- One auth user maps to one student (`auth_user_id` is unique).
- `student_number` is unique and auto-generated as `STU-YYYY-NNNNNN` if omitted.
- Suspended/withdrawn students remain searchable.
- Attendance records lock after `ATTENDANCE_LOCK_DAYS` (default 7); after that
  only `Admin` (or `override=true` from admin) may modify them.
- Bulk attendance respects the unique `(student, course, date)` constraint and
  returns a per-row result list.
- Status changes are audited and emit `student.status_changed`.
- Students may only update contact-shaped fields on their own profile.

---

## Events

### Published
- `student.created`
- `student.updated`
- `student.status_changed`
- `attendance.marked`
- `attendance.low_detected` (when course attendance rate `< LOW_ATTENDANCE_THRESHOLD`)
- `academic_history.updated`

### Consumed
- `auth.student_created`
- `grades.semester_closed`
- `enrollment.status_changed`

The `EventsModule` uses `@nestjs/event-emitter` as the in-process transport.
Swap `EventPublisherService` / `EventConsumerService` with a Kafka, RabbitMQ,
or NATS adapter in production without touching domain code.

---

## Security Checklist

- ✅ JWT verification with shared secret (no auth duplication)
- ✅ Role + permission guards
- ✅ DTO validation (`class-validator`, whitelist + forbidNonWhitelisted)
- ✅ Prisma parameterized queries (no raw SQL on user input)
- ✅ Helmet + CORS + Compression
- ✅ Throttler (rate limiting)
- ✅ Audit log for status changes, attendance, contact updates, history snapshots
- ✅ Internal routes gated by `x-internal-secret`
- ✅ Container runs as non-root user

---

## Environment Variables

See `.env.example`. Required: `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`INTERNAL_SECRET`. Optional tuning: `ATTENDANCE_LOCK_DAYS`,
`LOW_ATTENDANCE_THRESHOLD`, `THROTTLE_TTL`, `THROTTLE_LIMIT`.

---

## Database

```bash
npm run prisma:migrate          # create migration in dev
npm run prisma:migrate:deploy   # apply migrations in prod
npm run prisma:studio
```

Indexes created for: `auth_user_id`, `student_number`, `enrollment_status`,
`last_name`, `department_id`, `advisor_id`, `program_name`, `(course_id, session_date)`,
and all `student_id` foreign keys on child tables.
