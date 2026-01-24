# CITSA Mobile Backend API Documentation

## Base URL

```
Development: http://localhost:3000/api/v1
Production: https://api.citsaucc.org/api/v1  ## might change
```

## Authentication Flow

### Overview

The CITSA app uses a 2-step OTP authentication process:

1. User enters their Student ID
2. System sends OTP to their registered email
3. User enters OTP to verify and get access tokens
4. User completes profile setup (if needed)

---

## API Endpoints

### 1. Send OTP

**Endpoint:** `POST /auth/send-otp`

**Description:** Sends a 6-digit OTP code to the student's registered email address.

**Request Body:**

```json
{
  "studentId": "PS/ITC/22/0120"
}
```

**Validation:**

- `studentId`: Required, must match format `PS/XXX/YY/NNNN` (e.g., PS/ITC/22/0120)
- Student must exist in database
- Student account must be active

**Success Response (200):**

```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "message": "OTP sent successfully",
    "email": "ama****@ucc.edu.gh"
  }
}
```

**Error Responses:**

_Student Not Found (404):_

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "Student not found. Please contact administration."
  }
}
```

_Invalid Format (400):_

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "studentId",
        "message": "Student ID must be in format PS/ITC/22/0120"
      }
    ]
  }
}
```

_Rate Limited (429):_

```json
{
  "success": false,
  "error": {
    "code": "OTP_RATE_LIMITED",
    "message": "Too many OTP requests. Please wait 5 minutes."
  }
}
```

**Rate Limiting:**

- Maximum 3 OTP requests per 5 minutes per email
- OTP expires in 600 seconds (10 minutes)

**Development Mode:**

- OTP is logged to server console instead of sent via email
- Check server logs for the OTP code

---

### 2. Resend OTP

**Endpoint:** `POST /auth/resend-otp`

**Description:** Resends a new 6-digit OTP code and invalidates all previous unused OTPs.

**Request Body:**

```json
{
  "studentId": "PS/ITC/22/0120"
}
```

**Validation:**

- `studentId`: Required, must match format `PS/XXX/YY/NNNN`
- Student must exist in database
- Same rate limiting as send-otp applies

**Success Response (200):**

```json
{
  "success": true,
  "message": "OTP resent successfully",
  "data": {
    "message": "New OTP sent successfully",
    "email": "ama****@ucc.edu.gh",
    "expiresIn": 600
  }
}
```

**Error Responses:**
Same as send-otp endpoint (Student Not Found, Invalid Format, Rate Limited)

**Behavior:**

- All previous unused OTPs for the email are invalidated
- A new OTP is generated and sent
- Rate limiting applies across both send-otp and resend-otp
- OTP is logged to console in development mode

---

### 3. Verify OTP

**Endpoint:** `POST /auth/verify-otp`

**Description:** Verifies the OTP code and returns access/refresh tokens.

**Request Body:**

```json
{
  "studentId": "PS/ITC/22/0120",
  "otpCode": "123456"
}
```

**Validation:**

- `studentId`: Required, must match format
- `otpCode`: Required, exactly 6 digits

**Success Response (200):**

```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "needsProfileSetup": true,
    "user": {
      "id": "uuid-here",
      "studentId": "PS/ITC/22/0120",
      "email": "ama.osei@ucc.edu.gh",
      "fullName": null,
      "bio": null,
      "avatarUrl": null,
      "program": null,
      "classYear": null,
      "skills": [],
      "interests": [],
      "portfolioUrl": null,
      "role": "STUDENT",
      "isVerified": true,
      "createdAt": "2026-01-24T00:00:00.000Z"
    }
  }
}
```

**Important Fields:**

- `needsProfileSetup`: `true` if user needs to complete profile (no fullName/program/classYear)
- `accessToken`: Use in Authorization header for protected routes
- `refreshToken`: Use to get new access token when it expires
- `expiresIn`: Access token validity in seconds (3600 = 1 hour)

**Error Responses:**

_Invalid OTP (400):_

```json
{
  "success": false,
  "error": {
    "code": "OTP_INVALID",
    "message": "Invalid OTP. 2 attempt(s) remaining."
  }
}
```

_OTP Expired (400):_

```json
{
  "success": false,
  "error": {
    "code": "OTP_EXPIRED",
    "message": "OTP expired or not found. Please request a new one."
  }
}
```

_Max Attempts Exceeded (400):_

```json
{
  "success": false,
  "error": {
    "code": "OTP_MAX_ATTEMPTS",
    "message": "Maximum OTP attempts exceeded. Please request a new OTP."
  }
}
```

**OTP Attempt Limits:**

- Maximum 3 attempts per OTP
- After 3 failed attempts, user must request a new OTP

---

### 4. Refresh Token

**Endpoint:** `POST /auth/refresh-token`

**Description:** Get a new access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600
  }
}
```

---

### 5. Setup Profile

**Endpoint:** `POST /users/profile/setup`

**Description:** Complete user profile after first login.

**Headers:**

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**

```json
{
  "fullName": "Ama Osei",
  "bio": "Aspiring software engineer",
  "program": "Information Technology",
  "classYear": "2026",
  "skills": ["Flutter", "Dart", "Firebase"],
  "interests": ["Mobile Development", "UI/UX"],
  "portfolioUrl": "https://github.com/amaosei"
}
```

**Validation:**

- `fullName`: Required, 2-255 characters
- `program`: Required, max 100 characters
- `classYear`: Required, exactly 4 digits
- `bio`: Optional, max 1000 characters
- `skills`: Optional array of strings
- `interests`: Optional array of strings
- `portfolioUrl`: Optional, valid URL

**Success Response (200):**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "uuid-here",
    "studentId": "PS/ITC/22/0120",
    "email": "ama.osei@ucc.edu.gh",
    "fullName": "Ama Osei",
    "bio": "Aspiring software engineer",
    "program": "Information Technology",
    "classYear": "2026",
    "skills": ["Flutter", "Dart", "Firebase"],
    "interests": ["Mobile Development", "UI/UX"],
    "portfolioUrl": "https://github.com/amaosei",
    "role": "STUDENT",
    "isVerified": true,
    "createdAt": "2026-01-24T00:00:00.000Z"
  }
}
```

---

## Mobile Integration Guide

### Flutter Implementation Example

```dart
// 1. Send OTP
Future<void> sendOTP(String studentId) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/send-otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'studentId': studentId}),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    if (data['success']) {
      // Navigate to OTP screen
      Navigator.push(context, MaterialPageRoute(
        builder: (_) => OTPScreen(studentId: studentId),
      ));
    }
  }
}

// 2. Verify OTP
Future<Map<String, dynamic>?> verifyOTP(String studentId, String otpCode) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/verify-otp'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'studentId': studentId,
      'otpCode': otpCode,
    }),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    if (data['success']) {
      // Save tokens
      await saveTokens(
        data['data']['accessToken'],
        data['data']['refreshToken'],
      );

      // Check if profile setup needed
      if (data['data']['needsProfileSetup'] == true) {
        // Navigate to profile setup
        Navigator.pushReplacement(context, MaterialPageRoute(
          builder: (_) => ProfileSetupScreen(),
        ));
      } else {
        // Navigate to home
        Navigator.pushReplacement(context, MaterialPageRoute(
          builder: (_) => HomeScreen(),
        ));
      }

      return data['data'];
    }
  }
  return null;
}

// 3. Setup Profile
Future<void> setupProfile(Map<String, dynamic> profileData) async {
  final token = await getAccessToken();

  final response = await http.put(
    Uri.parse('$baseUrl/users/profile/setup'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode(profileData),
  );

  if (response.statusCode == 200) {
    // Navigate to home
    Navigator.pushReplacement(context, MaterialPageRoute(
      builder: (_) => HomeScreen(),
    ));
  }
}
```

---

## Sample Students for Testing

| Student ID     | Email                    | Full Name     | Program                | Year |
| -------------- | ------------------------ | ------------- | ---------------------- | ---- |
| PS/ITC/22/0120 | ama.osei@ucc.edu.gh      | Ama Osei      | Information Technology | 2026 |
| PS/CSC/22/0045 | kofi.asante@ucc.edu.gh   | Kofi Asante   | Computer Science       | 2026 |
| PS/ITC/23/0201 | abena.boateng@ucc.edu.gh | Abena Boateng | Information Technology | 2027 |

**Note:** In development mode, all students have incomplete profiles (`fullName`, `program`, `classYear` are `null`) to test the profile setup flow.

---

## Error Codes Reference

| Code             | Description                      |
| ---------------- | -------------------------------- |
| VALIDATION_ERROR | Request validation failed        |
| USER_NOT_FOUND   | Student ID not found in database |
| USER_INACTIVE    | Student account is inactive      |
| OTP_RATE_LIMITED | Too many OTP requests            |
| OTP_INVALID      | Incorrect OTP code               |
| OTP_EXPIRED      | OTP has expired                  |
| OTP_MAX_ATTEMPTS | Maximum OTP attempts exceeded    |
| UNAUTHORIZED     | Missing or invalid access token  |
| TOKEN_EXPIRED    | Access token has expired         |
| TOKEN_INVALID    | Malformed access token           |
| DATABASE_ERROR   | Database operation failed        |
| INTERNAL_ERROR   | Server error                     |

---

## Testing Checklist

### Prerequisites

- ✅ Docker running (MySQL + Redis)
- ✅ Backend server running on port 3000
- ✅ Database seeded with test students

### Test Flow

1. **Send OTP**
   - Use student ID: `PS/ITC/22/0120`
   - Check server console for OTP code
   - Verify masked email in response

2. **Verify OTP**
   - Use OTP from server console
   - Verify tokens received
   - Check `needsProfileSetup` flag

3. **Setup Profile**
   - Use access token from step 2
   - Complete profile with required fields
   - Verify profile saved

4. **Access Protected Routes**
   - Use access token in Authorization header
   - Test profile retrieval, feed, etc.

---

## Production Deployment Notes

### Environment Variables Required

```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_HOST=your-mysql-host
DATABASE_PORT=3306
DATABASE_USER=your-db-user
DATABASE_PASSWORD=your-db-password
DATABASE_NAME=citsa_db

# JWT Secrets (generate strong random strings)
JWT_ACCESS_SECRET=your-256-bit-secret-key
JWT_REFRESH_SECRET=your-256-bit-refresh-secret

# SMTP (required for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@ucc.edu.gh

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=citsa-uploads

# University
UNIVERSITY_EMAIL_DOMAIN=ucc.edu.gh
```

### Pre-deployment Steps

1. Configure SMTP for email delivery
2. Generate secure JWT secrets
3. Set up AWS S3 bucket for file uploads
4. Configure production database
5. Import student records into database
6. Test complete flow in staging environment

---

## Support

For issues or questions:

- GitHub Issues: https://github.com/citsa-ucc-dev/citsa-mobile-backend/issues
- Email: support@citsa.ucc.edu.gh
