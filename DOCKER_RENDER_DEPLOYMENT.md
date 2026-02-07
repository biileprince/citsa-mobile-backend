# Deploy to Render with Docker 🐳

## Why Docker Deployment?

- ✅ **Consistent environment** - Works the same locally and in production
- ✅ **Faster builds** - Cached layers speed up deployments
- ✅ **Better isolation** - No dependency conflicts
- ✅ **Full control** - Custom configurations and optimizations

## Quick Deployment (5 Minutes)

### Step 1: Update Your Render Service

Go to your existing service: https://dashboard.render.com/web/citsa-mobile-backend

### Step 2: Change Runtime to Docker

1. Click **"Settings"** in the left sidebar
2. Scroll to **"Runtime"** section
3. Change from **"Node"** to **"Docker"**
4. Click **"Save Changes"**

### Step 3: Update Build Settings

In **Settings → Build & Deploy**:

**Dockerfile Path:**

```
Dockerfile
```

**Docker Build Context Directory:** (leave blank or set to `./`)

**Docker Command:** (leave blank - uses CMD from Dockerfile)

### Step 4: Deploy

1. Go to **"Manual Deploy"** section
2. Click **"Deploy latest commit"**
3. Wait 3-5 minutes for Docker build

## Environment Variables

**Keep all your existing environment variables** - they're already set!

The Docker container will use:

- `PORT` (provided by Render)
- All your DATABASE*\*, JWT*\_, SMTP\_\_, AWS\_\* variables

## Testing After Deployment

```bash
# Health check
curl https://citsa-mobile-backend.onrender.com/api/v1/health

# Root endpoint
curl https://citsa-mobile-backend.onrender.com/

# Send OTP
curl -X POST https://citsa-mobile-backend.onrender.com/api/v1/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"studentId":"PS/ITC/22/0001"}'
```

## Local Docker Testing (Optional)

Test the Docker image locally before deploying:

```bash
# Build image
docker build -t citsa-backend .

# Run container
docker run -p 3000:3000 --env-file .env citsa-backend

# Test
curl http://localhost:3000/api/v1/health
```

## Docker Build Process

The Dockerfile:

1. Uses Node.js 20 Alpine (lightweight ~120MB)
2. Installs production dependencies
3. Generates Prisma Client
4. Compiles TypeScript
5. Removes dev dependencies
6. Starts with `node dist/server.js`

## Advantages Over Node Runtime

| Feature       | Node Runtime | Docker Runtime                   |
| ------------- | ------------ | -------------------------------- |
| Build Time    | ~30s         | ~2-3 min first time, ~30s cached |
| Image Size    | N/A          | ~300MB                           |
| Consistency   | May vary     | Always same                      |
| Customization | Limited      | Full control                     |
| Dependencies  | npm only     | System packages available        |

## Troubleshooting

### Build Fails

Check Docker build logs in Render dashboard. Common issues:

**Missing files:**

- Ensure all files in Dockerfile COPY commands exist
- Check .dockerignore isn't excluding needed files

**Prisma generation fails:**

- Verify prisma.config.ts is in root
- Ensure DATABASE_URL env var is set

**TypeScript compilation errors:**

- Run `npm run build` locally first
- Check all dependencies in package.json

### Container Crashes on Start

**Check logs for:**

- Database connection errors → Verify DATABASE_URL
- Missing environment variables → Add in Render dashboard
- Port binding issues → Should use `process.env.PORT`

### Slow Build Times

**First build takes 2-3 minutes** (normal)
**Subsequent builds are faster** (~30 seconds) due to Docker layer caching

To speed up:

- Keep package.json changes minimal
- Dependencies are cached between builds

## Alternative: Docker Compose for Local Development

Create `docker-compose.yml` for local development:

```yaml
version: "3.8"
services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./src:/app/src
      - ./prisma:/app/prisma
    command: npm run dev
```

Run with: `docker-compose up`

## Monitoring

Docker deployments on Render include:

- ✅ Container health checks
- ✅ Automatic restarts on crash
- ✅ Resource usage metrics (CPU, Memory)
- ✅ Real-time logs

## Updating Deployment

**Any git push to main branch triggers:**

1. Docker image rebuild
2. Automatic redeployment
3. Zero downtime rolling update

## Cost

**Free tier includes:**

- 750 hours/month (24/7 coverage)
- 512 MB RAM
- Shared CPU
- Docker deployments count the same as Node.js

**Paid tier ($7/month):**

- No sleep
- 1 GB RAM
- Dedicated resources
- Faster builds

## Next Steps

1. ✅ Update service to Docker runtime
2. ✅ Deploy latest commit
3. ✅ Test API endpoints
4. ✅ Monitor logs for any issues
5. ✅ Update mobile app to use Render URL

Your backend will be running in a Docker container with full control! 🚀
