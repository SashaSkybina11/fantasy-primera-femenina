import { app } from "../backend/src/app";

// Vercel discovers this catch-all function as /api/* and passes the request to
// the existing Express application. No separate production API host is needed.
export default app;
