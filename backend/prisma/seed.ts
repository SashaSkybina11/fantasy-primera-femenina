import { PrismaClient } from "@prisma/client";
import { clubs } from "./data/clubs.js";
import { players } from "./data/players.js";

const prisma = new PrismaClient();

async function main() {
  const createdClubs = new Map<string, string>();

  for (const name of clubs) {
    const club = await prisma.club.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    createdClubs.set(name, club.id);
  }

  for (const player of players) {
    const clubId = createdClubs.get(player.club);
    if (!clubId) throw new Error(`Не найден клуб ${player.club}`);

    await prisma.player.upsert({
      where: { clubId_number: { clubId, number: player.number } },
      update: {
        name: player.name,
        position: player.position,
        price: player.price,
      },
      create: {
        clubId,
        number: player.number,
        name: player.name,
        position: player.position,
        price: player.price,
      },
    });
  }

  await prisma.league.upsert({
    where: { name: "Fantasy Primera División Femenina" },
    update: {},
    create: { name: "Fantasy Primera División Femenina" },
  });

  console.info(`Seed complete: ${clubs.length} клубов, ${players.length} игроков.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
