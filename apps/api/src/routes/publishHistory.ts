import { Router } from "express";
import { prisma } from "@postpilot/db";
import { requireAuth } from "../middleware/auth";

export const publishHistoryRouter = Router();
publishHistoryRouter.use(requireAuth);

publishHistoryRouter.get("/", async (_req, res) => {
  const history = await prisma.publishHistory.findMany({
    include: {
      socialAccount: { select: { platform: true, name: true } },
      schedule: { include: { post: { select: { label: true, fbCaption: true, igCaption: true } } } },
    },
    orderBy: { attemptedAt: "desc" },
    take: 100,
  });
  res.json({ history });
});
