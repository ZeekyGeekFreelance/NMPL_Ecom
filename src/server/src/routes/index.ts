import express from "express";
import { configureV1Routes } from "./v1";
import { exposeCsrfToken } from "@/shared/middlewares/csrfProtection";

export const configureRoutes = () => {
  const router = express.Router();

  // Expose CSRF token for all API routes
  router.use(exposeCsrfToken);

  router.use("/v1", configureV1Routes());

  // ** V2 ROUTES HERE **

  return router;
};
