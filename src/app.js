import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { query } from "./config/db.js";
import { registerModules } from "./modules/index.js";
import { asyncHandler, errorHandler, notFound } from "./shared/middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",").map((s) => s.trim()) }));
  app.use(express.json());

  app.get(
    "/health",
    asyncHandler(async (req, res) => {
      await query("SELECT 1");
      res.json({ status: "ok" });
    })
  );

  registerModules(app);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
