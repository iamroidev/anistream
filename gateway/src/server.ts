import { serve } from "@hono/node-server";
import app from "./index.js";
import { config } from "./config.js";
import { consumetMode } from "./services/consumet-adapter.js";

console.log(`AniStream gateway listening on :${config.port}`);
console.log(`  Jikan:    ${config.jikanUrl}`);
console.log(`  Miruro:   ${config.miruroUrl} (key ${config.miruroApiKey ? "set" : "missing"})`);
console.log(`  Aniwatch: ${config.aniwatchUrl}`);
console.log(`  Consumet: ${config.consumetUrl}`);
console.log(`  Animetsu: ${config.animetsuUrl}`);
console.log(`  Public:   ${config.publicUrl}`);

void consumetMode().then((mode) => {
  console.log(`  Consumet mode: ${mode} (${mode === "remote" ? "Docker API" : "in-process scrapers"})`);
});

serve({ fetch: app.fetch, port: config.port });