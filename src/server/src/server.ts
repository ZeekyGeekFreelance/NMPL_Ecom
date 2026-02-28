import "dotenv/config";
import "reflect-metadata";
import { addAlias } from "module-alias";
import path from "path";

// Resolve to current runtime root: `src` during ts-node, `dist` after build.
const runtimeRoot = path.resolve(__dirname);
addAlias("@", runtimeRoot);

import { createApp } from "./app";

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  const { httpServer } = await createApp();

  httpServer.on("error", (err) => {
    const nodeError = err as NodeJS.ErrnoException;
    if (nodeError.code === "EADDRINUSE") {
      console.error(
        `Server error: port ${PORT} is already in use. Update PORT in src/server/.env and keep client API URL aligned.`
      );
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`Failed to bootstrap server: ${errorMessage}`);
  process.exit(1);
});
