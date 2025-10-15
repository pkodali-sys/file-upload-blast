import {
  SimpleFile,
  File,
  InsertFile,
  FileSearchParams,
  PaginatedResult,
  files,
  fileBlobs,
} from "shared/schema";
import { db } from "./db";
import MemoryStore from "memorystore";
import session from "express-session";
import { eq, desc, like, and, count, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const MemStoreSession = MemoryStore(session);

/* ================================
   Interface
================================ */
export interface IStorage {
  // File ops (legacy + compatibility)
  saveFile(file: SimpleFile): Promise<SimpleFile>;
  getFile(id: string): Promise<SimpleFile | null>;
  getAllFiles(): Promise<SimpleFile[]>;
  deleteFile(id: string): Promise<boolean>;

  // DB-backed operations
  saveFileMetadata(file: InsertFile): Promise<File>;
  getFileMetadata(id: string): Promise<File | null>;
  getFiles(params: FileSearchParams): Promise<PaginatedResult<File>>;
  saveFileContent(fileId: string, content: Buffer): Promise<void>;
  getFileContent(fileId: string): Promise<Buffer | null>;
  deleteFileComplete(id: string): Promise<boolean>;
  updateFileMetadata(id: string, updatedFields: Partial<InsertFile>): Promise<File | null>;
  updateFile(id: string, updatedFile: Partial<SimpleFile>): Promise<SimpleFile | null>;

  // Migration helpers
  migrateFromMemory(memoryFiles: SimpleFile[]): Promise<void>;

  // Auth/session store
  sessionStore: session.Store;
}

/* ================================
   PostgreSQL-backed Storage
================================ */
export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemStoreSession({ checkPeriod: 86400000 }); // prune daily
  }

  // ========== Legacy Compatibility ==========
  async saveFile(file: SimpleFile): Promise<SimpleFile> {
    const insertFile: InsertFile = {
      originalName: file.originalName,
      storedName: file.name,
      mimeType: file.mimeType,
      size: file.size,
      source: "local",
      storageUrl: file.localPath,
      isProcessed: file.isProcessed,
      category: "all",
    };

    const dbFile = await this.saveFileMetadata(insertFile);
    return this.convertToSimpleFile(dbFile);
  }

  async getFile(id: string): Promise<SimpleFile | null> {
    const dbFile = await this.getFileMetadata(id);
    return dbFile ? this.convertToSimpleFile(dbFile) : null;
  }

  async getAllFiles(): Promise<SimpleFile[]> {
    const result = await this.getFiles({ page: 1, limit: 1000 });
    return result.data.map((f) => this.convertToSimpleFile(f));
  }

  async deleteFile(id: string): Promise<boolean> {
    return this.deleteFileComplete(id);
  }

  // ========== Database Operations ==========
  async saveFileMetadata(file: InsertFile): Promise<File> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }

  async getFileMetadata(id: string): Promise<File | null> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file || null;
  }

  async updateFileMetadata(id: string, updatedFields: Partial<InsertFile>): Promise<File | null> {
    const updates = Object.fromEntries(
      Object.entries(updatedFields).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(updates).length === 0) return this.getFileMetadata(id);

    const [updatedFile] = await db
      .update(files)
      .set({ ...updates, uploadedAt: sql`NOW()` })
      .where(eq(files.id, id))
      .returning();

    return updatedFile || null;
  }

  async updateFile(id: string, updatedFile: Partial<SimpleFile>): Promise<SimpleFile | null> {
    const updateData: Partial<InsertFile> = {};

    if (updatedFile.originalName) updateData.originalName = updatedFile.originalName;
    if (updatedFile.name) updateData.storedName = updatedFile.name;
    if (updatedFile.mimeType) updateData.mimeType = updatedFile.mimeType;
    if (updatedFile.size) updateData.size = updatedFile.size;
    if (updatedFile.localPath) updateData.storageUrl = updatedFile.localPath;
    if (updatedFile.isProcessed !== undefined) updateData.isProcessed = updatedFile.isProcessed;

    const dbFile = await this.updateFileMetadata(id, updateData);
    return dbFile ? this.convertToSimpleFile(dbFile) : null;
  }

  async getFiles(params: FileSearchParams): Promise<PaginatedResult<File>> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [];

    if (params.search) {
      const searchValue = `%${params.search}%`;
      conditions.push(
        or(
          like(sql`LOWER(${files.originalName})`, sql`LOWER(${searchValue})`),
          like(sql`LOWER(${files.storedName})`, sql`LOWER(${searchValue})`)
        )
      );
    }

    if (params.source) conditions.push(eq(files.source, params.source));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(files).where(whereClause);

    const data = await db
      .select()
      .from(files)
      .where(whereClause)
      .orderBy(desc(files.uploadedAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: Number(total),
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(Number(total) / limit)),
    };
  }

  async saveFileContent(fileId: string, content: Buffer): Promise<void> {
    const base64Content = content.toString("base64");
    await db
      .insert(fileBlobs)
      .values({ fileId, content: base64Content })
      .onConflictDoUpdate({
        target: fileBlobs.fileId,
        set: { content: base64Content },
      });
  }

  async getFileContent(fileId: string): Promise<Buffer | null> {
    const [blob] = await db.select().from(fileBlobs).where(eq(fileBlobs.fileId, fileId));
    return blob ? Buffer.from(blob.content, "base64") : null;
  }

  async deleteFileComplete(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async migrateFromMemory(memoryFiles: SimpleFile[]): Promise<void> {
    for (const file of memoryFiles) {
      try {
        const insertFile: InsertFile = {
          originalName: file.originalName,
          storedName: file.name,
          mimeType: file.mimeType,
          size: file.size,
          source: "local",
          storageUrl: file.localPath,
          isProcessed: file.isProcessed,
        };
        await this.saveFileMetadata(insertFile);
        console.log(`✅ Migrated file: ${file.originalName}`);
      } catch (error) {
        console.error(`❌ Migration failed for ${file.originalName}:`, error);
      }
    }
  }

  private convertToSimpleFile(dbFile: File): SimpleFile {
    return {
      id: dbFile.id,
      name: dbFile.storedName,
      originalName: dbFile.originalName,
      size: dbFile.size,
      mimeType: dbFile.mimeType,
      uploadedAt: dbFile.uploadedAt.toISOString(),
      isProcessed: dbFile.isProcessed,
      localPath: dbFile.storageUrl ?? "",
    };
  }
}

/* ================================
   Memory Storage (fallback)
================================ */
export class MemStorage implements IStorage {
  private files: SimpleFile[] = [];
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemStoreSession({ checkPeriod: 86400000 });
  }

  async saveFile(file: SimpleFile): Promise<SimpleFile> {
    this.files.push(file);
    return file;
  }

  async getFile(id: string): Promise<SimpleFile | null> {
    return this.files.find((f) => f.id === id) || null;
  }

  async getAllFiles(): Promise<SimpleFile[]> {
    return [...this.files];
  }

  async deleteFile(id: string): Promise<boolean> {
    const i = this.files.findIndex((f) => f.id === id);
    if (i >= 0) {
      this.files.splice(i, 1);
      return true;
    }
    return false;
  }

  // Stubs for DB features
  async saveFileMetadata(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }
  async getFileMetadata(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateFileMetadata(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }
  async updateFile(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }
  async getFiles(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }
  async saveFileContent(): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
  async getFileContent(): Promise<Buffer | null> {
    throw new Error("Not implemented in MemStorage");
  }
  async deleteFileComplete(): Promise<boolean> {
    throw new Error("Not implemented in MemStorage");
  }
  async migrateFromMemory(): Promise<void> {
    throw new Error("Not implemented in MemStorage");
  }
}

/* ================================
   Export Active Storage
================================ */
const USE_DATABASE = process.env.USE_DATABASE !== "false";
export const storage = USE_DATABASE ? new DatabaseStorage() : new MemStorage();
