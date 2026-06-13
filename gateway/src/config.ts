export const config = {
  port: Number(process.env.PORT ?? 8787),
  jikanUrl: process.env.JIKAN_URL ?? "https://api.jikan.moe/v4",
  aniwatchUrl: process.env.ANIWATCH_URL ?? "http://localhost:4000",
  consumetUrl: process.env.CONSUMET_URL ?? "http://localhost:3000",
  animetsuUrl: process.env.ANIMETSU_URL ?? "http://localhost:8080",
  publicUrl: process.env.PUBLIC_URL ?? "http://localhost:8787",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
};
