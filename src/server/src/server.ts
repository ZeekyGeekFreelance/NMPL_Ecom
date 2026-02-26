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

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  httpServer.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

bootstrap();
