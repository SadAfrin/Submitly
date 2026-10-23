import "dotenv/config";
import express from "express";
import cors from "cors";
import type { Request, Response, NextFunction } from "express";
import authRoutes from "./routes/auth";
import { authenticate, requireRole } from "./middleware/auth";
import submissionRoutes from "./routes/submissions";
import mentorRoutes from "./routes/mentor";
import cookieParser from "cookie-parser";

const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",
    credentials: true,   // browser ke cookie pathate dey
  })
);
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/mentor", mentorRoutes);

// shudhu test er jonno, pore muche dibo
app.get("/api/mentor/ping", authenticate, requireRole("MENTOR"), (_req, res) => {
  res.json({ ok: true, message: "Hello mentor" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong" });
});

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => console.log(`API on http://localhost:${port}`));