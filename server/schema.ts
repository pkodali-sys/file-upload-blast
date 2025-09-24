// Database schema and types
import { z } from "zod";
import {
  pgTable,
  text,
  varchar,
  bigint,
  numeric,
  timestamp,
  boolean,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";

// Simple user type for hardcoded authentication
export interface User {
  id: string;
  username: string;
  expiresAt?: number; // Timestamp when session expires
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export type SelectUser = User;

// Zod schema for login validation
export const loginCredentialsSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Database Tables
export const files = pgTable(
  "files",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    source: text("source").notNull().default("local"), // 'local', 'ftp', 'db'
    storageUrl: text("storage_url"),
    sha256: text("sha256"),
    uploaderUserId: text("uploader_user_id"),
    isProcessed: boolean("is_processed").notNull().default(false),
  },
  (table) => ({
    uploadedAtIdx: index("idx_files_uploaded_at").on(table.uploadedAt.desc()),
    categoryIdx: index("idx_files_category").on(table.category),
    sourceIdx: index("idx_files_source").on(table.source),
  })
);

export const fileBlobs = pgTable("file_blobs", {
  fileId: uuid("file_id")
    .primaryKey()
    .references(() => files.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // Base64 encoded binary content
});

// Relations
export const filesRelations = relations(files, ({ one }) => ({
  blob: one(fileBlobs, {
    fields: [files.id],
    references: [fileBlobs.fileId],
  }),
}));

export const fileBlobsRelations = relations(fileBlobs, ({ one }) => ({
  file: one(files, {
    fields: [fileBlobs.fileId],
    references: [files.id],
  }),
}));

// Insert schemas
export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  uploadedAt: true,
});

export const insertFileBlobSchema = createInsertSchema(fileBlobs);

// Types
export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type FileBlob = typeof fileBlobs.$inferSelect;
export type InsertFileBlob = z.infer<typeof insertFileBlobSchema>;

// Legacy interface for compatibility (maps to new File type)
export interface SimpleFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  category: string;
  amount?: string;
  uploadedAt: string;
  isProcessed: boolean;
  localPath: string;
}

// Pagination and search types
export interface FileSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  source?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
