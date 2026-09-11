import { buildApp } from "./app.js";

const { app, config } = await buildApp();

try {
  await app.listen({ port: config.port, host: config.host });
  console.log(`Solstice API on http://${config.host}:${config.port}`);
  console.log(`  scenes  ${config.scenesDir}`);
  console.log(`  index   ${config.databasePath}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
