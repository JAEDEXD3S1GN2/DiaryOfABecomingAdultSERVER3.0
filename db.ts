// db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./shared/schema";
import "dotenv/config";

const { Pool } = pg;

// Ensure all required environment variables are set
const requiredEnv = [
  "DATABASE_HOST",
  "DATABASE_USER",
  "DATABASE_PASSWORD",
  "DATABASE_NAME",
];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    throw new Error(`Missing required environment variable: ${env}`);
  }
}

// Create pg Pool with SSL enabled (required by Koyeb)
export const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: 5432,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Initialize Drizzle ORM with the pool and your schema
export const db = drizzle(pool, { schema });
