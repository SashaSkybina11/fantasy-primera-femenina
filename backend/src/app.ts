import { mkdirSync } from "node:fs";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { uploadsDirectory } from "./config/paths.js";
import authRouter from "./routes/auth.js";
import catalogRouter from "./routes/catalog.js";
import leagueRouter from "./routes/league.js";
import profileRouter from "./routes/profile.js";
import teamRouter from "./routes/team.js";
import { errorHandler } from "./utils/http.js";

mkdirSync(uploadsDirectory, { recursive: true });

export const app = express();
app.use(cors({ origin: env.frontendUrl }));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadsDirectory));

app.get("/api/health", (_request, response) => response.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api", catalogRouter);
app.use("/api/my-team", teamRouter);
app.use("/api/league", leagueRouter);
app.use(errorHandler);
