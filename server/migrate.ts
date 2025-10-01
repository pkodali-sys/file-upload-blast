// migrate.ts
import { db } from "./db.js";
import { sql } from "drizzle-orm";

export async function createTables() {
  console.log("🛠️ Creating database tables for file storage...");

  try {
    // ==========================================
    // FILES TABLE
    // ==========================================
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
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files (uploaded_at DESC);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_files_category ON files (category);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_files_source ON files (source);
    `);

    // ==========================================
    // FILE BLOBS TABLE
    // ==========================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS file_blobs (
        file_id UUID PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      );
    `);

    // ==========================================
    // SESSION TABLE
    // ==========================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "session" (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL,
        PRIMARY KEY (sid)
      );
    `);

    console.log("✅ All database tables created successfully!");
  } catch (error) {
    console.error("❌ Error creating database tables:", error);
    throw error;
  }
}
