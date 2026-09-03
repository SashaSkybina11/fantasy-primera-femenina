export default async function handler(req: any, res: any) {
  const { app } = await import("../backend/src/app.js");
  return app(req, res);
}
