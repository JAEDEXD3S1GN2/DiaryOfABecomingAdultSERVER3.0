// db.ts
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./shared/schema";
import "dotenv/config";

const { Pool } = pg;

// Ensure DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Create a pg Pool with SSL enabled for Koyeb-hosted Postgres
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL + "?sslmode=require", // enforce SSL
});

// Initialize Drizzle ORM with the pool and your schema
export const db = drizzle(pool, { schema });
