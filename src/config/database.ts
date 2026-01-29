import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Create a global prisma instance to prevent multiple connections in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build adapter configuration for TiDB Cloud
const adapterConfig: any = {
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "3306", 10),
  user: process.env.DATABASE_USER || "root",
  password: process.env.DATABASE_PASSWORD || "",
  database: process.env.DATABASE_NAME || "citsa_db",
  connectionLimit: 5,
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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
