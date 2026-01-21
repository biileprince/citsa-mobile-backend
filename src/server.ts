import app from "./app.js";
import config from "./config/index.js";
import prisma from "./config/database.js";
import logger from "./utils/logger.js";
import { verifyEmailConnection } from "./services/email.service.js";
import { cleanupExpiredTokens } from "./services/auth.service.js";

const PORT = config.port;

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Shutting down gracefully...`);

  try {
    await prisma.$disconnect();
    logger.info("Database connection closed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("✅ Database connected successfully");

    // Verify email configuration (optional - don't fail if email is not configured)
    if (config.smtp.user && config.smtp.password) {
      const emailConnected = await verifyEmailConnection();
      if (emailConnected) {
        logger.info("✅ Email service connected successfully");
      } else {
        logger.warn(
          "⚠️ Email service connection failed - OTP emails will not work",
        );
      }
    } else {
      logger.warn(
        "⚠️ Email service not configured - set SMTP credentials in .env",
      );
    }

    // Start cleanup job for expired tokens (every hour)
    setInterval(
      () => {
        cleanupExpiredTokens().catch((err) => {
          logger.error("Token cleanup failed:", err);
        });
      },
      60 * 60 * 1000,
    );

    // Start the server
    app.listen(PORT, () => {
      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                    CITSA Backend API                       ║
╠═══════════════════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}                           ║
║  📍 Environment: ${config.env.padEnd(39)}║
║  🔗 API URL: http://localhost:${PORT}/api/${config.apiVersion}               ║
║  📖 Health: http://localhost:${PORT}/api/${config.apiVersion}/health         ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
