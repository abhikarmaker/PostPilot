import { Router } from "express";
import { prisma } from "@postpilot/db";
import { requireAuth } from "../middleware/auth";

export const socialAccountsRouter = Router();
socialAccountsRouter.use(requireAuth);

socialAccountsRouter.get("/", async (_req, res) => {
  const accounts = await prisma.socialAccount.findMany({
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

socialAccountsRouter.delete("/:id", async (req, res) => {
  const account = await prisma.socialAccount.findUnique({ where: { id: req.params.id } });
  if (!account) return res.status(404).json({ error: "Social account not found" });

  await prisma.socialAccount.delete({ where: { id: account.id } });
  res.status(204).send();
});
