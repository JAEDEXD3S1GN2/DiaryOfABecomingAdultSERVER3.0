import { defineConfig } from "drizzle-kit";
import "dotenv/config";
import { Pool } from "pg";

// Ensure DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Ensure the database is provisioned");
}

// Create a pg Pool with SSL enabled
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // required for Koyeb-hosted Postgres
  },
});

export default defineConfig({
  out: "./migrations",            // folder for migration files
  schema: "./shared/schema.ts",   // your schema file
  dialect: "postgresql",
  dbCredentials: pool,            // pass the Pool directly
});
