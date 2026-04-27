# Content Broadcasting System

A production-ready backend system for distributing subject-based educational content from teachers to students via a public API, with a principal-controlled approval workflow.

---

## Tech Stack

| Layer          | Technology              |
|----------------|-------------------------|
| Runtime        | Node.js (v18+)          |
| Framework      | Express.js              |
| Database       | MySQL 8.0+              |
| Cache          | Redis 7+                |
| Auth           | JWT (jsonwebtoken)      |
| Password Hash  | bcryptjs (12 rounds)    |
| File Upload    | Multer (disk storage)   |
| Validation     | express-validator       |
| Logging        | Winston + Morgan        |
| Security       | Helmet, CORS, Rate Limit|

---

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Redis 7+ (optional but recommended)

### 1. Clone & Install

```bash
git clone <repo-url>
cd content-broadcasting-system
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your DB/Redis credentials
```

### 3. Database Setup

```bash
# Run migrations (creates all tables)
npm run migrate

# Seed default users
npm run seed
```

Default accounts after seed:

| Role      | Email                     | Password       |
|-----------|---------------------------|----------------|
| Principal | principal@school.com      | Admin@1234     |
| Teacher   | alice@school.com          | Teacher@1234   |
| Teacher   | bob@school.com            | Teacher@1234   |

### 4. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000` by default.

---

## API Reference

### Base URL
```
http://localhost:3000/api
```

### Auth Endpoints

| Method | Endpoint        | Auth | Description         |
|--------|-----------------|------|---------------------|
| POST   | /auth/register  | No   | Register teacher    |
| POST   | /auth/login     | No   | Login (any role)    |
| GET    | /auth/me        | JWT  | Current user info   |

#### Register
```json
POST /api/auth/register
{
  "name": "Jane Teacher",
  "email": "jane@school.com",
  "password": "Secure@123",
  "role": "teacher"
}
```

#### Login
```json
POST /api/auth/login
{
  "email": "principal@school.com",
  "password": "Admin@1234"
}
```
Response includes `token` — use as `Authorization: Bearer <token>`.

---

### Content Endpoints (Protected)

| Method | Endpoint                  | Role             | Description           |
|--------|---------------------------|------------------|-----------------------|
| POST   | /content                  | teacher          | Upload content        |
| GET    | /content                  | teacher/principal| List content          |
| GET    | /content/:id              | teacher/principal| Get single content    |
| PATCH  | /content/:id/approve      | principal        | Approve content       |
| PATCH  | /content/:id/reject       | principal        | Reject content        |
| DELETE | /content/:id              | teacher/principal| Delete content        |

#### Upload Content (multipart/form-data)
```
POST /api/content
Authorization: Bearer <teacher_token>
Content-Type: multipart/form-data

Fields:
  title              (required) string
  subject            (required) e.g. "maths"
  file               (required) JPG/PNG/GIF, max 10MB
  description        (optional) string
  startTime          (optional) ISO 8601 — e.g. 2025-06-01T09:00:00Z
  endTime            (optional) ISO 8601 — must be after startTime
  rotationDuration   (optional) integer minutes (default: 5)
```

**Important:** Content without `startTime` + `endTime` will NOT appear in live broadcasts.

#### Approve
```json
PATCH /api/content/:id/approve
Authorization: Bearer <principal_token>
```

#### Reject
```json
PATCH /api/content/:id/reject
Authorization: Bearer <principal_token>
{
  "rejectionReason": "File quality is too low"
}
```

---

### Public Broadcast Endpoints (No Auth Required)

| Method | Endpoint                              | Description                        |
|--------|---------------------------------------|------------------------------------|
| GET    | /content/live/:teacherId              | All live content for teacher       |
| GET    | /content/live/:teacherId/:subject     | Live content for specific subject  |

These are the endpoints students poll.

#### All subjects live
```
GET /api/content/live/d1a2b3c4-...
```
Response:
```json
{
  "success": true,
  "data": {
    "teacher": { "id": "...", "name": "Alice Teacher" },
    "live": {
      "maths": {
        "id": "...",
        "title": "Chapter 3 Quiz",
        "subject": "maths",
        "file_url": "http://localhost:3000/uploads/abc123.jpg",
        "slot_duration_minutes": 5,
        "active_window": { "start": "...", "end": "..." }
      },
      "science": { ... }
    }
  }
}
```

#### When nothing is live
```json
{
  "success": true,
  "message": "No content available",
  "data": null
}
```

---

### User Endpoints (Protected)

| Method | Endpoint          | Role      | Description       |
|--------|-------------------|-----------|-------------------|
| GET    | /users/me         | any       | Own profile       |
| GET    | /users/teachers   | principal | List all teachers |

---

## Content Lifecycle

```
Upload → pending → approved → [live if within time window]
                 → rejected  (reason stored, visible to teacher)
```

## Scheduling Logic

Each subject has an independent rotation cycle per teacher:

- Anchor = earliest `start_time` of active approved items in the subject group
- Cycle = sum of all `rotation_duration` values in the group
- Active item = computed from `(now - anchor) mod cycle` — **fully stateless**
- Items loop continuously until `end_time` is reached

---

## Edge Cases Handled

| Case                                | Response                   |
|-------------------------------------|----------------------------|
| No approved content for teacher     | `"No content available"`   |
| Approved but outside time window    | `"No content available"`   |
| Unknown teacher ID in live endpoint | `"No content available"`   |
| Invalid/unknown subject             | `"No content available"`   |
| File too large                      | 400 with message           |
| Invalid file type                   | 400 with message           |
| Duplicate email on register         | 409 Conflict               |
| Wrong role accessing endpoint       | 403 Forbidden              |
| Expired/invalid JWT                 | 401 Unauthorized           |

---

## Security

- All private routes protected by JWT middleware
- RBAC enforced at route level via `authorize()` middleware
- Passwords hashed with bcrypt (12 rounds)
- File uploads validated by MIME type + size limit
- Helmet sets secure HTTP headers
- Rate limiting on all API endpoints
- UUID primary keys (no enumerable IDs in public endpoints)
- No sensitive data (password_hash) ever returned in responses

---

## Bonus Features Implemented

- ✅ Redis caching on live broadcast endpoint (10s TTL)
- ✅ Rate limiting (public + private)
- ✅ Pagination & filters on content list (page, limit, status, subject)
- ✅ Architecture notes (`architecture-notes.txt`)
- ✅ Graceful shutdown
- ✅ Structured logging (Winston)

---

## Assumptions & Skipped Features

1. **S3 upload** — local disk storage implemented; S3 is documented as an upgrade path (replace multer diskStorage with multer-s3).
2. **Subject-wise analytics** — query foundation exists (content table has subject + approved_at); API endpoint not built within scope.
3. **Email notifications** — not in requirements; mentioned in arch notes as a queue-based future addition.
4. **Swagger UI** — Swagger collection provided instead (see `/docs/swagger.json`).
