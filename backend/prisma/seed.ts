import { PlayerPosition, PrismaClient } from "@prisma/client";
import { marketDatesForWeek } from "../src/services/market-schedule.js";
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
    const price = player.price;

    const existing = await prisma.player.findUnique({ where: { clubId_number_name: { clubId, number: player.number, name: player.name } }, select: { _count: { select: { priceChanges: true } } } });
    await prisma.player.upsert({
      where: { clubId_number_name: { clubId, number: player.number, name: player.name } },
      update: {
        name: player.name,
        position: player.position,
        role,
        ...(existing?._count.priceChanges ? {} : { price }),
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

  const firstMonday = Date.UTC(2026, 7, 31);
  for (let number = 1; number <= 30; number += 1) {
    const monday = firstMonday + (number - 1) * 7 * 24 * 60 * 60 * 1000;
    const { marketOpenAt, deadlineAt, endsAt } = marketDatesForWeek(new Date(monday));
    await prisma.gameweek.upsert({
      where: { number },
      update: { name: `Jornada ${number}`, marketOpenAt, deadlineAt },
      create: { number, name: `Jornada ${number}`, marketOpenAt, deadlineAt, startsAt: deadlineAt, endsAt },
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
