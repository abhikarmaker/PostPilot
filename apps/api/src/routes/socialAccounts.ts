import { Router } from "express";
import { prisma } from "@postpilot/db";
import { AuthedRequest, requireAuth } from "../middleware/auth";

export const socialAccountsRouter = Router();
socialAccountsRouter.use(requireAuth);

socialAccountsRouter.get("/", async (req: AuthedRequest, res) => {
  const accounts = await prisma.socialAccount.findMany({
    where: { userId: req.userId },
    select: {
      id: true,
      platform: true,
      externalId: true,
      name: true,
      tokenExpiresAt: true,
      connectedAt: true,
    },
    orderBy: { connectedAt: "desc" },
  });
  res.json({ accounts });
});

socialAccountsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const account = await prisma.socialAccount.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!account) return res.status(404).json({ error: "Social account not found" });

  await prisma.socialAccount.delete({ where: { id: account.id } });
  res.status(204).send();
});
