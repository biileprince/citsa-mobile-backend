import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Create a global prisma instance to prevent multiple connections
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Serverless-optimized adapter configuration
const adapterConfig: any = {
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "3306", 10),
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "citsa_db",
  // Serverless connection limits (lower for better cold start)
  connectionLimit: process.env.NODE_ENV === "production" ? 3 : 5,
  // Prevent connection timeout in serverless
  connectTimeout: 10000,
  acquireTimeout: 10000,
  timeout: 60000,
};

// Add SSL for TiDB Cloud (port 4000 indicates TiDB)
if (parseInt(process.env.DATABASE_PORT || "3306") === 4000) {
  adapterConfig.ssl = {
    rejectUnauthorized: true,
  };
}

const adapter = new PrismaMariaDb(adapterConfig);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Cache instance globally in all environments for serverless
globalForPrisma.prisma = prisma;

// Graceful shutdown handler
export async function disconnectPrisma() {
  await prisma.$disconnect();
}

export default prisma;
