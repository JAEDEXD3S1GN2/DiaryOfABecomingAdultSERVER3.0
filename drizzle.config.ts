// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const getDbCredentials = () => {
  if (process.env.DATABASE_URL) {
    return {
      url: process.env.DATABASE_URL + "?sslmode=require",
    };
  }

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

  return {
    url: `postgresql://${process.env.DATABASE_USER}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_HOST}:5432/${process.env.DATABASE_NAME}?sslmode=require`,
  };
};

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: getDbCredentials(),
});
