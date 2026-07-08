import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../env";

export const authRouter = Router();

const loginSchema = z.object({ password: z.string().min(1) });

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!timingSafeEqual(parsed.data.password, env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const token = jwt.sign({ sub: "owner" }, env.JWT_SECRET, { expiresIn: "90d" });
  res.json({ token });
});
