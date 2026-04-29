# Courses Service

Production-ready microservice that owns the **academic catalog domain** of the
University Management System: departments, subjects, courses, credits,
prerequisites, teacher assignments, course tags, and catalog versions.

This service does **not** own auth credentials, student records, enrollments,
grade calculations, classroom timetables, or invoices — those belong to other
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

Service listens on `http://localhost:3003`.

### Docker

```bash
docker compose up -d
```

---

## Architecture

```
src/
├─ departments/         # university departments (CS, MATH, …)
├─ subjects/            # academic disciplines (Programming, Algebra, …)
├─ courses/             # main catalog: codes, titles, credits, level, status
├─ prerequisites/       # required / recommended / corequisite + min grade
├─ teacher-assignments/ # term-based teacher↔course↔section
├─ catalog/             # academic-year catalog versions
├─ internal/            # x-internal-secret routes for sister services
├─ events/              # publisher + consumer + event name constants
├─ guards/              # JWT, Roles, Permissions, Internal
├─ strategies/          # JWT access strategy (verifies Auth tokens)
├─ common/              # decorators, filters, interceptors, audit log, DTOs
├─ config/              # env loading + Joi validation
├─ database/            # PrismaService (global)
└─ middleware/          # request context (client IP)
```

---

## Auth Model

Tokens are issued by **Auth Service** and verified locally using the shared
`JWT_ACCESS_SECRET`. The decoded payload exposes `sub` (auth user id), `email`,
`role`, and `permissions[]`.

- `JwtAuthGuard` (global) — runs unless `@Public()` is set.
- `RolesGuard` (global) — checks `@Roles('Admin', 'Teacher', 'Student')`.
- `PermissionsGuard` (global) — checks `@Permissions(...)`.
- `InternalGuard` — protects `/internal/*` with the `x-internal-secret` header.

Roles: `Admin`, `Teacher`, `Student`.

---

## API Surface

### Health
- `GET /health` — public

### Catalog Read (any authenticated user)
- `GET    /courses` — search/filter/paginate (keyword, departmentId, subjectId, credits, level, semesterType, deliveryMode, status, teacherId, includePrerequisites)
- `GET    /courses/:id`
- `GET    /courses/code/:courseCode`
- `GET    /courses/:id/prerequisites`
- `GET    /departments` · `GET /departments/:id`
- `GET    /subjects` · `GET /subjects/:id`
- `GET    /catalog/versions` · `GET /catalog/versions/current`

### Teacher
- `GET    /teachers/me/courses` — Teacher · Admin

### Admin Management
- `POST   /departments` · `PATCH /departments/:id` — Admin
- `POST   /subjects` · `PATCH /subjects/:id` — Admin
- `POST   /courses` · `PATCH /courses/:id` · `DELETE /courses/:id` — Admin
- `PATCH  /courses/:id/status` — Admin (DRAFT → ACTIVE → ARCHIVED transitions)
- `POST   /courses/:id/prerequisites` · `DELETE /courses/:id/prerequisites/:prerequisiteId` — Admin
- `POST   /courses/:id/assign-teacher` — Admin
- `PATCH  /teacher-assignments/:id` · `DELETE /teacher-assignments/:id` — Admin
- `POST   /catalog/versions` · `PATCH /catalog/versions/:id` — Admin

### Internal (x-internal-secret)
- `GET    /internal/courses/:id`
- `GET    /internal/courses/code/:courseCode`
- `GET    /internal/courses/:id/eligibility-rules` — credits + prerequisites for Enrollment
- `GET    /internal/teachers/:teacherId/courses`
- `GET    /internal/departments/:id`

---

## Business Rules

- `course_code` is globally unique
- Active courses must have `credits > 0`
- Credits are bounded by `MIN_COURSE_CREDITS` and `MAX_COURSE_CREDITS`
  (decimal credits gated by `ALLOW_DECIMAL_CREDITS`)
- Prerequisite chains are cycle-checked (BFS) before insertion
- A course cannot be its own prerequisite
- Archived courses are read-only; they remain queryable for transcripts/history
- Active courses cannot be hard-deleted — archive first
- Teacher assignments are unique per `(course, term, section)`; "removal" is a soft status flip

---

## Events

### Published
- `department.created` · `department.updated`
- `subject.created` · `subject.updated`
- `course.created` · `course.updated` · `course.status_changed` · `course.archived` · `course.deleted`
- `course.prerequisite_changed`
- `teacher.assigned_to_course` · `teacher.assignment_updated` · `teacher.assignment_removed`

### Consumed
- `auth.teacher_updated`
- `academic_term.created`

In production, swap the in-process `EventEmitter2` transport for Kafka /
RabbitMQ / NATS via a dedicated adapter — domain code stays unchanged.

---

## Database

PostgreSQL via Prisma. Tables (`@@map`):

`departments`, `subjects`, `courses`, `course_prerequisites`,
`teacher_assignments`, `course_tags`, `catalog_versions`, `audit_logs`.

Indexes are defined for: `course_code`, `title`, `department_id`, `subject_id`,
`status`, `level`, `semester_type`, `teacher_user_id`, and prerequisite
relations.

---

## Inter-Service Map

| Consumer            | Reads                                                    |
| ------------------- | -------------------------------------------------------- |
| Enrollment Service  | active courses · capacity defaults · prerequisites · credits |
| Scheduling Service  | teacher assignments · course metadata                    |
| Grades Service      | teacher↔course relationships                             |
| Finance Service     | credits (tuition logic)                                  |
| AI Agent Service    | difficulty trends · overloaded departments · prerequisite bottlenecks |

---

## Scripts

| Command                          | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `npm run start:dev`              | Watch-mode local dev               |
| `npm run build`                  | Compile to `dist/`                 |
| `npm run start:prod`             | Run compiled service               |
| `npm run prisma:migrate`         | Create + apply a dev migration     |
| `npm run prisma:migrate:deploy`  | Apply pending migrations in prod   |
| `npm run prisma:generate`        | Regenerate Prisma client           |
| `npm run prisma:seed`            | Seed reference data (CS101, …)    |
| `npm run prisma:studio`          | Open Prisma Studio                 |
| `npm run lint` · `npm run test`  | Lint · run unit tests              |
