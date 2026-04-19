import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import config from "./config/index.js";
import routes from "./routes/index.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { apiLimiter } from "./middleware/rateLimit.middleware.js";
import logger from "./utils/logger.js";
import { setupSwagger } from "./docs/swagger.js";

// Create Express app
const app: Express = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging (development)
if (config.env === "development") {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });
}

// Rate limiting
app.use(`/api/${config.apiVersion}`, apiLimiter);

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// Swagger API documentation
setupSwagger(app);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to CITSA Backend API",
    version: config.apiVersion,
    docs: "/api-docs",
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

export default app;
