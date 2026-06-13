import { serve } from "@hono/node-server";
import app from "./index.js";
import { config } from "./config.js";

console.log(`AniStream gateway listening on :${config.port}`);
console.log(`  Jikan:    ${config.jikanUrl}`);
console.log(`  Aniwatch: ${config.aniwatchUrl}`);
console.log(`  Consumet: ${config.consumetUrl}`);
console.log(`  Animetsu: ${config.animetsuUrl}`);
console.log(`  Public:   ${config.publicUrl}`);

serve({ fetch: app.fetch, port: config.port });
