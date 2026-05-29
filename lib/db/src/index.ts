import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Database is optional for core report-generation. Share/stripe routes will
// return 500 when DATABASE_URL is absent, but the server starts normally.
export const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgresql://localhost/rapportai" });
export const db = drizzle(pool, { schema });

export * from "./schema";
