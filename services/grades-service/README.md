# Grades Service

Production-ready microservice for the University Management System. Owns all
grading workflows, GPA calculations, transcripts, and academic standing.

- **Port:** 3005
- **Stack:** NestJS 10, Prisma 5, PostgreSQL 16, Redis (ioredis), JWT (HS256), EventEmitter2

## Modules

| Module | Responsibility |
| --- | --- |
| `grading-scales` | Letter-grade ↔ percentage bands & grade-points |
| `assessments` | CRUD assessments per course/term/section, weight-sum guard |
| `grades` | Per-student-per-assessment scores, bulk upsert, override |
| `gradebook` | Aggregated matrix view of a course's assessments + grades |
| `results` | Final course results, transactional course/term publication |
| `gpa` | Term & cumulative GPA snapshots, academic standing |
| `transcripts` | Request, approve/reject, payload snapshot generation |
| `regrades` | Student-initiated grade appeals + teacher/admin review |
| `internal` | Internal service-to-service endpoints (X-Internal-Secret) |

## Key Endpoints

### Public student
- `GET /grades/me`, `GET /grades/me/term/:term`
- `GET /gpa/me`
- `GET /transcripts/me`
- `POST /transcripts/request`
- `POST /regrades/:gradeId/request`

### Teacher / Admin
- `POST /assessments`, `PATCH /assessments/:id`, `PATCH /assessments/:id/status`
- `POST /grades`, `POST /grades/bulk`, `PATCH /grades/:id`
- `GET /courses/:courseId/gradebook?term=...`
- `POST /courses/:courseId/publish-results?term=...`
- `PATCH /regrades/:id/review`

### Admin only
- `PATCH /grades/:id/override`
- `POST /results/publish-term/:term`
- `POST /gpa/recalculate/:studentId`
- `PATCH /transcripts/:id/approve|reject`
- All `/grading-scales` mutations

### Internal (X-Internal-Secret header)
- `GET /internal/students/:studentId/completed-courses`
- `GET /internal/students/:studentId/gpa`
- `GET /internal/students/:studentId/transcript-summary`
- `GET /internal/courses/:courseId/results?term=...`

## Events Emitted

`assessment.created|updated|status_changed`,
`grade.submitted|published|amended|overridden`,
`result.course_published|term_published`,
`gpa.updated|standing_changed`,
`transcript.requested|completed|rejected`,
`regrade.requested|reviewed`,
`student.at_risk_detected`.

Inbound consumers: `enrollment.created`, `enrollment.withdrawn`,
`course.updated`, `term.closed` (in `events/event-consumer.service.ts`).

## Concurrency & Atomicity

- Result publication is wrapped in `RedisLockService.withLock(...)` and a
  Prisma `$transaction`, ensuring no two concurrent publishes can race per
  course/term or per term.
- Grade upserts are guarded by a unique `(assessmentId, studentId)` index.
- Final results are guarded by `(studentId, courseId, academicTerm)`.

## Setup

```powershell
npm install
npx prisma generate
npx prisma migrate dev
npm run prisma:seed   # seeds the default 10-band grading scale
npm run start:dev
```

Or via Docker:

```powershell
docker compose up --build
```

## Environment

See `.env.example` for the full list. Key variables:

- `PORT=3005`
- `DATABASE_URL=postgresql://grades_user:grades_pass@localhost:5435/grades_db`
- `JWT_ACCESS_SECRET=...`
- `INTERNAL_SECRET=...`
- `REDIS_HOST`, `REDIS_PORT`
- `AUTH_SERVICE_URL`, `STUDENTS_SERVICE_URL`, `COURSES_SERVICE_URL`, `ENROLLMENT_SERVICE_URL`
- `DEFAULT_PASS_PERCENTAGE=50`
- `ALLOW_TEACHER_PUBLISH=false`
- `TRANSCRIPT_NUMBER_PREFIX=TR`
- `RESULT_PUBLISH_LOCK_TTL_SECONDS=120`
