import { Router } from "express";
import { prisma } from "@postpilot/db";
import { AuthedRequest, requireAuth } from "../middleware/auth";

export const publishHistoryRouter = Router();
publishHistoryRouter.use(requireAuth);

publishHistoryRouter.get("/", async (req: AuthedRequest, res) => {
  const history = await prisma.publishHistory.findMany({
    where: { schedule: { post: { userId: req.userId } } },
    include: {
      socialAccount: { select: { platform: true, name: true } },
      schedule: { include: { post: { select: { caption: true } } } },
    },
    orderBy: { attemptedAt: "desc" },
    take: 100,
  });
  res.json({ history });
});
