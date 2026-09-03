export default async function handler(req: any, res: any) {
  // Vercel resolves catch-all segments into `query.path`. Rebuild the URL that
  // Express sees so nested dynamic routes retain every segment and query value.
  const segments = Array.isArray(req.query?.path) ? req.query.path : [req.query?.path].filter(Boolean);
  const query = typeof req.url === "string" && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  if (segments.length) req.url = `/api/${segments.join("/")}${query}`;
  const { app } = await import("../backend/src/app.js");
  return app(req, res);
}
