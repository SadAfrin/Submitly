import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "../prisma/db";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

const normalizeRepoUrl = (u: string) =>
  u.trim().replace(/\/+$/, "").replace(/\.git$/i, "").toLowerCase();

const githubRepo = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;

// "", "N/A", "n/a", "na" -> undefined (mane "ei project e eta nai")
const blankToUndefined = (v: unknown) => {
  if (typeof v !== "string") return v ?? undefined;
  const t = v.trim();
  return t === "" || /^n\/?a$/i.test(t) ? undefined : t;
};

const repoField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .transform(normalizeRepoUrl)
    .refine((u) => githubRepo.test(u), "Must be a GitHub repo URL like https://github.com/user/repo")
    .optional()
);

const liveField = z.preprocess(
  blankToUndefined,
  z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "Must start with http:// or https://")
    .optional()
);

const submissionSchema = z
  .object({
    projectName: z.string().trim().min(3).max(80),
    frontendRepoUrl: repoField,
    backendRepoUrl: repoField,
    frontendLiveUrl: liveField,
    backendLiveUrl: liveField,
    description: z.string().trim().min(20).max(1000),
  })
  .refine((d) => d.frontendRepoUrl || d.backendRepoUrl, {
    message: "Provide at least one repository (frontend or backend)",
    path: ["frontendRepoUrl"],
  })
  .refine((d) => d.frontendLiveUrl || d.backendLiveUrl, {
    message: "Provide at least one live link (frontend or backend)",
    path: ["frontendLiveUrl"],
  });

// spam: ek student 10 minute e max 5 ta
const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // limiter janay kokhon counter reset hobe
    const info = (req as unknown as { rateLimit?: { resetTime?: Date } }).rateLimit;
    const resetAt = info?.resetTime?.getTime() ?? Date.now() + 10 * 60 * 1000;
    const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    const minutes = Math.ceil(seconds / 60);

    res.status(429).json({
      message: `Too many submissions. You can submit up to 5 projects every 10 minutes. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""}.`,
      retryAfterSeconds: seconds,
    });
  },
});

router.post(
  "/",
  authenticate,
  requireRole("STUDENT"),
  submitLimiter,
  asyncHandler(async (req, res) => {
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    const d = parsed.data;

    // duplicate: ei repo ta frontend ba backend, jekono column e age submit hoyechhe kina
    const urls = [...new Set([d.frontendRepoUrl, d.backendRepoUrl].filter((u): u is string => !!u))];
    for (const url of urls) {
      const [asFrontend, asBackend] = await Promise.all([
        db.orm.public.Submission.where({ frontendRepoUrl: url }).first(),
        db.orm.public.Submission.where({ backendRepoUrl: url }).first(),
      ]);
      if (asFrontend || asBackend) {
        return res.status(409).json({ message: `This repository has already been submitted: ${url}` });
      }
    }

    try {
      const sub = await db.orm.public.Submission.create({
        projectName: d.projectName,
        frontendRepoUrl: d.frontendRepoUrl ?? null,
        backendRepoUrl: d.backendRepoUrl ?? null,
        frontendLiveUrl: d.frontendLiveUrl ?? null,
        backendLiveUrl: d.backendLiveUrl ?? null,
        description: d.description,
        userId: req.user!.id,
      });
      res.status(201).json({ submission: sub });
    } catch (e: any) {
      // check ar create er majhe onno keu submit korle database er unique constraint dhorbe
      console.error("create submission failed:", e);
      if (/unique|duplicate/i.test(String(e?.message))) {
        return res.status(409).json({ message: "This repository has already been submitted" });
      }
      throw e;
    }
  })
);

router.get(
  "/mine",
  authenticate,
  requireRole("STUDENT"),
  asyncHandler(async (req, res) => {
    const items = await db.orm.public.Submission
      .where({ userId: req.user!.id })
      .orderBy((s) => s.createdAt.desc())
      .all();
    res.json({ items });
  })
);

export default router;