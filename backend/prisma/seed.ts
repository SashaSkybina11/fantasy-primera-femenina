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

function resolvePlayerPrice(player: SeedPlayer) {
  const seed = hashValue(`${player.club}:${player.number}:${player.name}:price`);
  if (player.position === PlayerPosition.GOALKEEPER) return 2200 + (seed % 1601);
  return 2600 + (seed % 2901);
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
    const price = resolvePlayerPrice(player);

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

  await prisma.league.upsert({
    where: { name: "Fantasy Primera División Fútbol Sala Femenino" },
    update: {},
    create: { name: "Fantasy Primera División Fútbol Sala Femenino" },
  });

  await prisma.gameweek.upsert({
    where: { number: 1 },
    update: {},
    create: {
      number: 1,
      name: "Jornada 1",
      status: "OPEN",
      marketOpenAt: new Date("2026-08-31T06:00:00.000Z"),
      deadlineAt: new Date("2026-09-04T17:00:00.000Z"),
      startsAt: new Date("2026-09-04T17:00:00.000Z"),
      endsAt: new Date("2026-09-06T21:59:59.000Z"),
    },
  });

  await syncFantasyTeamBudgets();

  console.info(`Seed complete: ${clubs.length} клубов, ${players.length} игроков.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
