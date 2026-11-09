import { env } from "./config/env.js";
import { closePool } from "./config/db.js";
import { runMigrations } from "./db/migrate.js";
import { failInterruptedRuns } from "./shared/sync/syncRuns.repository.js";
import { createApp } from "./app.js";

async function main() {
  await runMigrations(); // creates the database (if allowed) and applies pending migrations
  await failInterruptedRuns();

  const server = createApp().listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
    console.log(`[server] MCP endpoint: ${env.mcp.url}`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[server] failed to start:", err.message);
  process.exit(1);
});
