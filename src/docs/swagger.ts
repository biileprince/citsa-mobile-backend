import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { parse } from "yaml";
import path from "path";
import { Express } from "express";
import logger from "../utils/logger.js";

/**
 * Load and parse the OpenAPI spec from YAML
 */
function loadSwaggerSpec(): object {
  // Use process.cwd() since tsx/node runs from the backend directory
  // Try dist path first (production), then src path (development)
  const srcPath = path.resolve(process.cwd(), "src/docs/swagger.yaml");
  const distPath = path.resolve(process.cwd(), "dist/docs/swagger.yaml");

  let specPath: string;
  try {
    readFileSync(distPath, "utf8");
    specPath = distPath;
  } catch {
    specPath = srcPath;
  }

  const file = readFileSync(specPath, "utf8");
  return parse(file);
}

/**
 * Setup Swagger UI middleware on the Express app
 * Docs available at /api-docs
 */
export function setupSwagger(app: Express): void {
  try {
    const spec = loadSwaggerSpec();

    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "CITSA API Documentation",
        swaggerOptions: {
          persistAuthorization: true,
          docExpansion: "list",
          filter: true,
          tagsSorter: "alpha",
          operationsSorter: "method",
        },
      }),
    );

    // Serve raw spec as JSON
    app.get("/api-docs.json", (_req, res) => {
      res.json(spec);
    });

    logger.info("Swagger docs available at /api-docs");
  } catch (error) {
    logger.error("Failed to setup Swagger docs:", error);
  }
}
