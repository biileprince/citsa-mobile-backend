# CITSA Backend API

Backend API for the CITSA Student Mobile Application.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** MySQL (via Prisma ORM)
- **Authentication:** JWT (Access + Refresh tokens)
- **File Storage:** AWS S3
- **Email:** SMTP (Nodemailer)

## Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

1. **Clone and install dependencies:**

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**

   ```bash
   # Generate Prisma client
   npm run db:generate

   # Push schema to database (development)
   npm run db:push

   # Or run migrations (production)
   npm run db:migrate
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

   Server will run on `http://localhost:3000`

### Using Docker

```bash
# Start all services (MySQL, Redis, API)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## API Endpoints

### Authentication

| Method | Endpoint                     | Description               |
| ------ | ---------------------------- | ------------------------- |
| POST   | `/api/v1/auth/send-otp`      | Send OTP to student email |
| POST   | `/api/v1/auth/verify-otp`    | Verify OTP and get tokens |
| POST   | `/api/v1/auth/refresh-token` | Refresh access token      |
| POST   | `/api/v1/auth/logout`        | Logout (invalidate token) |

### User Profile

| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/api/v1/users/profile`         | Get current user profile |
| GET    | `/api/v1/users/profile/:userId` | Get user profile by ID   |
| POST   | `/api/v1/users/profile/setup`   | First-time profile setup |
| PUT    | `/api/v1/users/profile`         | Update profile           |
| POST   | `/api/v1/users/avatar`          | Upload avatar            |
| DELETE | `/api/v1/users/avatar`          | Delete avatar            |

### Feed / Posts

| Method | Endpoint                          | Description         |
| ------ | --------------------------------- | ------------------- |
| GET    | `/api/v1/feed/posts`              | Get feed posts      |
| GET    | `/api/v1/feed/posts/:id`          | Get single post     |
| POST   | `/api/v1/feed/posts`              | Create post (Admin) |
| POST   | `/api/v1/feed/posts/:id/like`     | Like post           |
| DELETE | `/api/v1/feed/posts/:id/like`     | Unlike post         |
| POST   | `/api/v1/feed/posts/:id/comments` | Add comment         |
| POST   | `/api/v1/feed/posts/:id/save`     | Save post           |
| DELETE | `/api/v1/feed/posts/:id/save`     | Unsave post         |
| GET    | `/api/v1/feed/saved`              | Get saved posts     |

### Events

| Method | Endpoint                          | Description          |
| ------ | --------------------------------- | -------------------- |
| GET    | `/api/v1/events`                  | Get all events       |
| GET    | `/api/v1/events/:id`              | Get single event     |
| POST   | `/api/v1/events/:id/register`     | Register for event   |
| DELETE | `/api/v1/events/:id/register`     | Cancel registration  |
| GET    | `/api/v1/events/my-registrations` | Get my registrations |

### Groups

| Method | Endpoint                     | Description          |
| ------ | ---------------------------- | -------------------- |
| GET    | `/api/v1/groups`             | Get all groups       |
| GET    | `/api/v1/groups/:id`         | Get single group     |
| GET    | `/api/v1/groups/:id/members` | Get group members    |
| POST   | `/api/v1/groups/:id/join`    | Join group           |
| DELETE | `/api/v1/groups/:id/join`    | Leave group          |
| GET    | `/api/v1/groups/my-groups`   | Get my groups        |
| GET    | `/api/v1/groups/categories`  | Get group categories |

### Classrooms

| Method | Endpoint                                               | Description                     |
| ------ | ------------------------------------------------------ | ------------------------------- |
| GET    | `/api/v1/classrooms`                                   | Get all classrooms              |
| GET    | `/api/v1/classrooms/:id`                               | Get classroom details           |
| GET    | `/api/v1/classrooms/:id/timetable`                     | Get timetable                   |
| GET    | `/api/v1/classrooms/:id/quizzes`                       | Get upcoming quizzes            |
| GET    | `/api/v1/classrooms/:id/announcements`                 | Get announcements               |
| POST   | `/api/v1/classrooms/:id/announcements`                 | Create announcement (Class Rep) |
| PUT    | `/api/v1/classrooms/:id/announcements/:announcementId` | Update announcement             |
| DELETE | `/api/v1/classrooms/:id/announcements/:announcementId` | Delete announcement             |

### Notifications

| Method | Endpoint                             | Description              |
| ------ | ------------------------------------ | ------------------------ |
| GET    | `/api/v1/notifications`              | Get notifications        |
| GET    | `/api/v1/notifications/unread-count` | Get unread count         |
| PUT    | `/api/v1/notifications/:id/read`     | Mark as read             |
| PUT    | `/api/v1/notifications/read-all`     | Mark all as read         |
| DELETE | `/api/v1/notifications/:id`          | Delete notification      |
| DELETE | `/api/v1/notifications/clear-read`   | Clear read notifications |

## Production API Testing

### Base URL

**Production:** `https://citsa-mobile-backend.onrender.com`

### Testing OTP Flow

**1. Send OTP**

Request:
```bash
curl -X POST https://citsa-mobile-backend.onrender.com/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"studentId": "PS/ADM/20/0001"}'
```

Expected Response:
```json
{
  "success": true,
  "message": "OTP sent to psadm200001@ucc.edu.gh",
  "data": {
    "email": "psadm200001@ucc.edu.gh",
    "expiresIn": 60
  }
}
```

**2. Verify OTP**

Request:
```bash
curl -X POST https://citsa-mobile-backend.onrender.com/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"studentId": "PS/ADM/20/0001", "otp": "123456"}'
```

Expected Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "studentId": "PS/ADM/20/0001",
      "email": "psadm200001@ucc.edu.gh",
      "isNewUser": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

**3. Get User Profile** (Authenticated)

Request:
```bash
curl -X GET https://citsa-mobile-backend.onrender.com/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Quick Test Endpoints

| Endpoint                 | Method | Auth | Description            |
| ------------------------ | ------ | ---- | ---------------------- |
| `/api/v1/health`         | GET    | No   | Health check           |
| `/api/v1/auth/send-otp`  | POST   | No   | Send OTP to test email |
| `/api/v1/auth/verify-otp`| POST   | No   | Verify OTP code        |
| `/api/v1/users/profile`  | GET    | Yes  | Get current user       |
| `/api/v1/feed/posts`     | GET    | Yes  | Get feed posts         |
| `/api/v1/events`         | GET    | Yes  | Get all events         |

### Error Responses

**Invalid Student ID:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Student ID must be 9 digits",
    "details": {
      "field": "studentId",
      "format": "Exactly 9 digits required"
    }
  }
}
```

**Invalid OTP:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid or expired OTP"
  }
}
```

## Authentication Flow

1. User enters 9-digit student ID
2. System sends 6-digit OTP to `{studentId}@university.edu`
3. User enters OTP within 60 seconds
4. System returns JWT access token (1h) + refresh token (30d)
5. Use access token in `Authorization: Bearer <token>` header
6. When access token expires, use refresh token to get new access token

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

## Scripts

| Command               | Description                              |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start development server with hot-reload |
| `npm run build`       | Build TypeScript to JavaScript           |
| `npm start`           | Start production server                  |
| `npm run db:generate` | Generate Prisma client                   |
| `npm run db:push`     | Push schema to database                  |
| `npm run db:migrate`  | Run database migrations                  |
| `npm run db:studio`   | Open Prisma Studio                       |
| `npm run lint`        | Run ESLint                               |
| `npm test`            | Run tests                                |

## Environment Variables

See `.env.example` for all required environment variables.

## License

ISC
