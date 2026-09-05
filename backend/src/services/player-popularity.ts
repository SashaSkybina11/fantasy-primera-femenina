import type { Prisma } from "@prisma/client";

export async function getPlayerPopularity(tx: Prisma.TransactionClient) {
  // Teams are created at registration. A squad exists once it contains a player.
  const totalUsers = await tx.fantasyTeam.count({ where: { players: { some: {} } } });
  // userId is unique on FantasyTeam and (fantasyTeamId, playerId) is unique
  // on FantasyTeamPlayer, so each row represents one distinct owner.
  const [leader] = await tx.fantasyTeamPlayer.groupBy({
    by: ["playerId"],
    _count: { playerId: true },
    orderBy: [{ _count: { playerId: "desc" } }, { playerId: "asc" }],
    take: 1,
  });
  const player = leader ? await tx.player.findUnique({
    where: { id: leader.playerId },
    select: { id: true, name: true, number: true, club: { select: { id: true, name: true } } },
  }) : null;
  const ownerCount = player && leader ? leader._count.playerId : 0;
  return { player, ownerCount, totalUsers, percentage: totalUsers ? Math.round(ownerCount / totalUsers * 100) : 0 };
}
