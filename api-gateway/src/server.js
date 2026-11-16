import fs from "node:fs";
import path from "node:path";

if (typeof process.loadEnvFile === "function") {
  const candidateEnvs = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../.env")
  ];
  for (const envPath of candidateEnvs) {
    if (fs.existsSync(envPath)) {
      try { process.loadEnvFile(envPath); break; } catch (_e) {}
    }
  }
}

import { app } from "./app.js";

const PORT = Number(process.env.GATEWAY_PORT || process.env.PORT || 8080);
const OAUTH_CALLBACK_PORT = Number(process.env.OAUTH_CALLBACK_PORT || 8081);
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT || 3000);

function bindPort(port, label) {
  const srv = app.listen(port, "0.0.0.0", () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        service: label,
        message: `${label} listening on http://localhost:${port}`
      })
    );
  });
  srv.on("error", () => {
    // Port already bound by another process
  });
}

bindPort(PORT, "scm-api-gateway");
if (OAUTH_CALLBACK_PORT !== PORT) {
  bindPort(OAUTH_CALLBACK_PORT, "scm-oauth2-callback");
}
if (FRONTEND_PORT !== PORT && FRONTEND_PORT !== OAUTH_CALLBACK_PORT) {
  bindPort(FRONTEND_PORT, "scm-frontend-ui");
}

