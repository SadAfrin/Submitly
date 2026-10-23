import { Router } from "express";
import { z } from "zod";
import { db } from "../prisma/db";
import { asyncHandler } from "../lib/asyncHandler";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

// ei router er shob route e shudhu MENTOR dhukte parbe
router.use(authenticate, requireRole("MENTOR"));

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(STATUSES).optional(),
});

// GET /api/mentor/submissions?page=1&pageSize=10&status=APPROVED
router.get(
  "/submissions",
  asyncHandler(async (req, res) => {
    const parsed = listQuery.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ message: "Invalid query" });
    const { page, pageSize, status } = parsed.data;

    const filter = status ? { status } : {};

    const [rows, { total }] = await Promise.all([
      db.orm.public.Submission
        .where(filter)
        .orderBy([(s) => s.createdAt.desc(), (s) => s.id.desc()])
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .all(),
      db.orm.public.Submission.where(filter).aggregate((a) => ({ total: a.count() })),
    ]);

    // student der info: ekta query, protita row er jonno alada na
    const ids = [...new Set(rows.map((r) => r.userId))];
    const users = ids.length
      ? await db.orm.public.User
          .where((u) => u.id.in(ids))
          .select("id", "name", "email")
          .all()
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    res.json({
      items: rows.map((r) => ({ ...r, student: byId.get(r.userId) ?? null })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  })
);

// PATCH /api/mentor/submissions/:id/status   body: { "status": "APPROVED" }
const statusBody = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });
const idParam = z.coerce.number().int().positive();

router.patch(
  "/submissions/:id/status",
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const body = statusBody.safeParse(req.body);
    if (!id.success || !body.success) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const existing = await db.orm.public.Submission.where({ id: id.data }).first();
    if (!existing) return res.status(404).json({ message: "Submission not found" });

    const updated = await db.orm.public.Submission
      .where({ id: id.data })
      .update({ status: body.data.status });

    res.json({ submission: updated });
  })
);

// GET /api/mentor/stats
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const counts = await Promise.all(
      STATUSES.map((s) =>
        db.orm.public.Submission.where({ status: s }).aggregate((a) => ({ total: a.count() }))
      )
    );
    const [pending = 0, approved = 0, rejected = 0] = counts.map((c) => c.total);
    res.json({ pending, approved, rejected, total: pending + approved + rejected });
  })
);

export default router;