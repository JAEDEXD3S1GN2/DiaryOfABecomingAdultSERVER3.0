import { db } from "../db";
import { users } from "../shared/schema";
import { scrypt, randomBytes } from "crypto";
import "dotenv/config";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seedAdmin() {
  const hashedPassword = await hashPassword("Admin123");

  await db.insert(users).values({
    name: "Oluwaloni Elizabeth",
    email: "elizabetholuwaloni@gmail.com",
    password: hashedPassword,
    role: "admin",
  });

  console.log("Admin created successfully");
}

seedAdmin();