import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { config } from "@/config";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "B2C E-commerce API",
      version: "1.0.0",
      description: "API documentation for the B2C E-commerce platform REST endpoints",
    },
    servers: [
      {
        url: `${config.server.publicApiBaseUrl.replace(/\/+$/, "")}/api/v1`,
        description: `${config.nodeEnv} server`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["src/modules/**/*.routes.ts"], // Scan all route files for JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: any) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
