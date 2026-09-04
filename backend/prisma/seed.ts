import { PlayerPosition, PrismaClient } from "@prisma/client";
import { clubs } from "./data/clubs.js";
import { players, type SeedPlayer } from "./data/players.js";

const prisma = new PrismaClient();
const initialBudget = 50000;

function hashValue(input: string) {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_003;
  }
  return hash;
}

function resolvePlayerRole(player: SeedPlayer): NonNullable<SeedPlayer["role"]> {
  if (player.role) return player.role;
  if (player.position === PlayerPosition.GOALKEEPER) return "PORTERA";
  const rolePool = ["CIERRE", "ALA", "ALA", "PIVOT"] as const;
  return rolePool[hashValue(`${player.club}:${player.number}:${player.name}:role`) % rolePool.length];
}

async function syncFantasyTeamBudgets() {
  const teams = await prisma.fantasyTeam.findMany({
    select: {
      id: true,
      players: {
        select: {
          player: {
            select: {
              price: true,
            },
          },
        },
      },
    },
  });

  await Promise.all(
    teams.map((team) => {
      const spent = team.players.reduce((total, entry) => total + entry.player.price, 0);
      return prisma.fantasyTeam.update({
        where: { id: team.id },
        data: { budget: Math.max(0, initialBudget - spent) },
      });
    }),
  );
}

async function main() {
  const createdClubs = new Map<string, string>();

  for (const clubData of clubs) {
    const club = await prisma.club.upsert({
      where: { name: clubData.name },
      update: {
        logoUrl: clubData.logoUrl,
        coach: clubData.coach ?? null,
        president: clubData.president ?? null,
      },
      create: {
        name: clubData.name,
        logoUrl: clubData.logoUrl,
        coach: clubData.coach ?? null,
        president: clubData.president ?? null,
      },
    });
    createdClubs.set(clubData.name, club.id);
  }

  for (const player of players) {
    const clubId = createdClubs.get(player.club);
    if (!clubId) throw new Error(`Не найден клуб ${player.club}`);
    const role = resolvePlayerRole(player);
    const price = 3000;

    await prisma.player.upsert({
      where: { clubId_number_name: { clubId, number: player.number, name: player.name } },
      update: {
        name: player.name,
        position: player.position,
        role,
        price,
        age: player.age ?? null,
        nationality: player.nationality ?? null,
      },
      create: {
        clubId,
        number: player.number,
        name: player.name,
        position: player.position,
        role,
        price,
        age: player.age ?? null,
        nationality: player.nationality ?? null,
      },
    });
  }

  // Also normalize any player that was added manually and is not present in
  // the static seed catalog.
  await prisma.player.updateMany({ data: { price: 3000 } });

  await prisma.league.upsert({
    where: { name: "Fantasy Primera División Fútbol Sala Femenino" },
    update: {},
    create: { name: "Fantasy Primera División Fútbol Sala Femenino" },
  });

  const firstMonday = Date.UTC(2026, 7, 31);
  for (let number = 1; number <= 30; number += 1) {
    const monday = firstMonday + (number - 1) * 7 * 24 * 60 * 60 * 1000;
    // Europe/Madrid is UTC+2 through Jornada 8, then UTC+1 for the rest
    // of this 2026/27 schedule. Store UTC instants, never a fixed offset rule.
    const utcOffsetHours = number <= 8 ? 2 : 1;
    const marketOpenAt = new Date(monday + (8 - utcOffsetHours) * 60 * 60 * 1000);
    const deadlineAt = new Date(monday + 4 * 24 * 60 * 60 * 1000 + (19 - utcOffsetHours) * 60 * 60 * 1000);
    const endsAt = new Date(monday + 6 * 24 * 60 * 60 * 1000 + (23 - utcOffsetHours) * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);
    await prisma.gameweek.upsert({
      where: { number },
      update: { name: `Jornada ${number}`, marketOpenAt, deadlineAt, startsAt: deadlineAt, endsAt },
      create: { number, name: `Jornada ${number}`, status: number === 1 ? "OPEN" : "UPCOMING", marketOpenAt, deadlineAt, startsAt: deadlineAt, endsAt },
    });
  }

  await syncFantasyTeamBudgets();

  console.info(`Seed complete: ${clubs.length} клубов, ${players.length} игроков.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
