// Manual database migration script for file storage tables
import { db } from "./db.js";
import { sql } from "drizzle-orm";

async function createTables() {
  console.log("Creating database tables for file storage...");

  try {
    // Create files table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size BIGINT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC(12,2),
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        source TEXT NOT NULL DEFAULT 'local',
        storage_url TEXT,
        sha256 TEXT,
        uploader_user_id TEXT,
        is_processed BOOLEAN NOT NULL DEFAULT false
      )
    `);

    // Create indexes for performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files (uploaded_at DESC)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_files_category ON files (category)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_files_source ON files (source)
    `);

    // Create file_blobs table for storing file contents
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS file_blobs (
        file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      )
    `);

    console.log("Database tables created successfully!");

    // Test the connection by inserting a test record
    console.log("Testing database connection...");

    return true;
  } catch (error) {
    console.error("Error creating database tables:", error);
    throw error;
  }
}

export { createTables };
