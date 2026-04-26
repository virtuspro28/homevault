import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const isInstalled = await prisma.user.count();
  const hash = await bcrypt.hash('homevault', 10);
  
  if (isInstalled > 0) {
    await prisma.user.updateMany({
      where: { role: 'admin' },
      data: { password: hash }
    });
    console.log("SUCCESS_RESET");
  } else {
    console.log("NOT_INSTALLED_NO_RESET_NEEDED");
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
