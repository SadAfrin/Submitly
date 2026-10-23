import type { Request, Response, NextFunction } from "express";
import { verifyToken, type Role } from "../lib/jwt";

declare global {
    namespace Express {
        interface Request {
            user?: { id: number; role: Role };
        } 
    }
}

// AuthN?
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token =
    req.cookies?.token ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);

  if (!token) return res.status(401).json({ message: "Login required" });

  try {
    const payload = verifyToken(token);
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

// AuthZ: permission?
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ message: "Login required" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}