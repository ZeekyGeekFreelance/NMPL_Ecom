import express from "express";
import { configureV1Routes } from "./v1";

export const configureRoutes = () => {
  const router = express.Router();

  router.use("/v1", configureV1Routes());

  // ** V2 ROUTES HERE **

  return router;
};
