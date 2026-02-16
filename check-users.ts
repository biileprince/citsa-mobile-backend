import { prisma } from "./src/config/database";

async function checkUsers() {
  console.log("🔍 Checking seeded users...");

  // Check if the new users were created
  const newUsers = await prisma.user.findMany({
    where: {
      email: { in: ["zakjnr5@gmail.com", "bosszak94@gmail.com"] },
    },
    select: { studentId: true, email: true, role: true, fullName: true },
  });

  console.log("\n📋 New users created:");
  newUsers.forEach((user) => {
    console.log(
      `- ${user.email} (ID: ${user.studentId}, Role: ${user.role}, Name: ${user.fullName})`,
    );
  });

  // Check if PS/ITC/22/0001 already exists
  const existingUser = await prisma.user.findFirst({
    where: { studentId: "PS/ITC/22/0001" },
    select: { email: true, fullName: true, role: true },
  });

  if (existingUser) {
    console.log(
      `\n⚠️  PS/ITC/22/0001 already exists: ${existingUser.email} (${existingUser.fullName}, ${existingUser.role})`,
    );
  } else {
    console.log("\n✅ PS/ITC/22/0001 is available");
  }

  // Graceful exit
  process.exit(0);
}

checkUsers().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
