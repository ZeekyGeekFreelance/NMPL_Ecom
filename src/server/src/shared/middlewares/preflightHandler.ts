import { Request, Response, NextFunction } from "express";

export const preflightHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    const origin =
      typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }

    // Set CORS headers for preflight
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "X-API-Key",
        "X-Client-Version",
        "X-Device-Type",
        "X-Platform",
        "X-API-Version",
        "Apollo-Require-Preflight", // For GraphQL
      ].join(", ")
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400"); // 24 hours

    // End preflight request
    res.status(200).end();
    return;
  }

  next();
};
