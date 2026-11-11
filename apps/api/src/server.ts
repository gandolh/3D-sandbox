import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

// The process: the settings, the app, listen. A bad setting or a port in use throws here, and Node prints the
// error and exits 1.
const config = loadConfig();
const { app } = await buildApp(config);
await app.listen({ port: config.port, host: config.host });
console.log(`Solstice API on http://${config.host}:${config.port}`);
console.log(`  scenes  ${config.scenesDir}`);
console.log(`  index   ${config.databasePath}`);
