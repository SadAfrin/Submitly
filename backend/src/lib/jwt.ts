import "dotenv/config";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET missing in .env");

export type Role = "STUDENT" | "MENTOR";
export type TokenPayload = { sub: string, role:Role };

export function signToken(userId: number, role: Role) {
    return jwt.sign({ role }, secret!, {subject: String(userId), expiresIn: "7d"});
}

export function verifyToken(token: string): TokenPayload {
    return jwt.verify(token, secret!) as unknown as TokenPayload;
}