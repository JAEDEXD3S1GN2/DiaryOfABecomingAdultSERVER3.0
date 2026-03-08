// scripts/seedAdmin.ts
import { db } from "../db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${hash}.${salt}`;
}

async function seedAdmin() {
  const email = "elizabetholuwaloni@gmail.com";

  // Check if admin already exists
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log("Admin user already exists, skipping seed.");
    process.exit(0);
  }

  await db.insert(users).values({
    name: "Oluwaloni Elizabeth",
    email,
    password: hashPassword("your-admin-password"),
    role: "admin",
  });

  console.log("Admin user seeded successfully.");
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
