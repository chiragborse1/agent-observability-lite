import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.runAlert.deleteMany();
  await prisma.runStep.deleteMany();
  await prisma.run.deleteMany();

  console.log("Cleared local run data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
