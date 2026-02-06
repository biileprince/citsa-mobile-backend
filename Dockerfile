# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ openssl

# Copy package files and Prisma config
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Install dependencies (skip postinstall to avoid DATABASE_URL requirement)
RUN npm ci --ignore-scripts

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client with dummy DATABASE_URL (only needed for generation, not actual connection)
ENV DATABASE_URL="mysql://user:pass@localhost:3306/db"
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies for Prisma with MariaDB adapter
RUN apk add --no-cache openssl libssl3 ca-certificates

# Copy package files and Prisma config
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma/

# Install production dependencies only (skip postinstall)
RUN npm ci --only=production --ignore-scripts

# Generate Prisma client with dummy DATABASE_URL (only for generation)
ENV DATABASE_URL="mysql://user:pass@localhost:3306/db"
RUN npx prisma generate

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

# Unset the dummy DATABASE_URL (real one will come from Render environment)
ENV DATABASE_URL=""

# Set environment (will be overridden by Render env vars)
ENV NODE_ENV=production
ENV PORT=3000

# Expose port (Render will provide PORT env var dynamically)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Start the application
CMD ["node", "dist/server.js"]
