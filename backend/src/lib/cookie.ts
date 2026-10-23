import type { Response, CookieOptions } from "express";

const isProd = process.env.NODE_ENV === "production";

const base: CookieOptions = {
  httpOnly: true,                      // JavaScript pay na
  secure: isProd,                      // production e shudhu HTTPS
  sameSite: isProd ? "none" : "lax",   // deploy e frontend/backend alada domain hole none lage
  path: "/",
};

export const setAuthCookie = (res: Response, token: string) =>
  res.cookie("token", token, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });

export const clearAuthCookie = (res: Response) => res.clearCookie("token", base);