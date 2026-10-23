import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../prisma/db";
import { signToken } from "../lib/jwt";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate } from "../middleware/auth";
import { setAuthCookie, clearAuthCookie } from "../lib/cookie";

const router = Router();

const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post("/signup", asyncHandler(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  const { name, email, password } = parsed.data;

  const existing = await db.orm.public.User.where({ email }).first();
  if (existing) return res.status(409).json({ message: "Email already registered" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await db.orm.public.User.create({ name, email, password: hashed });

  setAuthCookie(res, signToken(user.id, user.role));
  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
  const { email, password } = parsed.data;

  const user = await db.orm.public.User.where({ email }).first();
  const ok = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !ok) return res.status(401).json({ message: "Invalid email or password" });

  setAuthCookie(res, signToken(user.id, user.role));
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}));

router.get("/me", authenticate, asyncHandler(async (req, res) => {
  const user = await db.orm.public.User
    .where({ id: req.user!.id })
    .select("id", "name", "email", "role")
    .first();
  if (!user) return res.status(401).json({ message: "Login required" });
  res.json({ user });
}));

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;