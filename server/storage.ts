// Storage interface with database support
import {
  SimpleFile,
  File,
  InsertFile,
  FileSearchParams,
  PaginatedResult,
} from "shared/schema";
import MemoryStore from "memorystore";
import session from "express-session";
import { db } from "./db";
import { files, fileBlobs } from "shared/schema";
import { eq, desc, like, and, count, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const MemStoreSession = MemoryStore(session);

export interface IStorage {
  // File operations (existing for compatibility)
  saveFile(file: SimpleFile): Promise<SimpleFile>;
  getFile(id: string): Promise<SimpleFile | null>;
  getAllFiles(): Promise<SimpleFile[]>;
  deleteFile(id: string): Promise<boolean>;

  // New database operations
  saveFileMetadata(file: InsertFile): Promise<File>;
  getFileMetadata(id: string): Promise<File | null>;
  getFiles(params: FileSearchParams): Promise<PaginatedResult<File>>;
  saveFileContent(fileId: string, content: Buffer): Promise<void>;
  getFileContent(fileId: string): Promise<Buffer | null>;
  deleteFileComplete(id: string): Promise<boolean>;

  // Migration helpers
  migrateFromMemory(memoryFiles: SimpleFile[]): Promise<void>;

  // Session store for authentication
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // Legacy compatibility methods
  async saveFile(file: SimpleFile): Promise<SimpleFile> {
    const insertFile: InsertFile = {
      originalName: file.originalName,
      storedName: file.name,
      mimeType: file.mimeType,
      size: file.size,
      category: file.category,
      amount: file.amount ? file.amount : null,
      source: "local",
      storageUrl: file.localPath,
      isProcessed: file.isProcessed,
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
    return result.data.map((file) => this.convertToSimpleFile(file));
  }

  async deleteFile(id: string): Promise<boolean> {
    return this.deleteFileComplete(id);
  }

  // New database operations
  async saveFileMetadata(file: InsertFile): Promise<File> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }

  async getFileMetadata(id: string): Promise<File | null> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file || null;
  }

  // async getFiles(params: FileSearchParams): Promise<PaginatedResult<File>> {
  //   const page = params.page || 1;
  //   const limit = params.limit || 20;
  //   const offset = (page - 1) * limit;

  //   // Build where conditions
  //   const conditions = [];

  //   if (params.search) {
  //     conditions.push(
  //       or(
  //         like(files.originalName, `%${params.search}%`),
  //         like(files.storedName, `%${params.search}%`)
  //       )
  //     );
  //   }

  //   if (params.category) {
  //     conditions.push(eq(files.category, params.category));
  //   }

  //   if (params.source) {
  //     conditions.push(eq(files.source, params.source));
  //   }

  //   const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  //   // Get total count
  //   const [{ total }] = await db
  //     .select({ total: count() })
  //     .from(files)
  //     .where(whereClause);

  //   // Get paginated data
  //   const data = await db
  //     .select()
  //     .from(files)
  //     .where(whereClause)
  //     .orderBy(desc(files.uploadedAt))
  //     .limit(limit)
  //     .offset(offset);

  //   return {
  //     data,
  //     total: Number(total),
  //     page,
  //     limit,
  //     totalPages: Math.ceil(Number(total) / limit),
  //   };
  // }

    async getFiles(params: FileSearchParams): Promise<PaginatedResult<File>> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    // Build where conditions
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

    if (params.category) {
      conditions.push(eq(files.category, params.category));
    }

    if (params.source) {
      conditions.push(eq(files.source, params.source));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(files)
      .where(whereClause);

    // Get paginated data
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
      totalPages: Math.ceil(Number(total) / limit) || 1,
    };
  }


  async saveFileContent(fileId: string, content: Buffer): Promise<void> {
    const base64Content = content.toString("base64");
    await db
      .insert(fileBlobs)
      .values({
        fileId,
        content: base64Content,
      })
      .onConflictDoUpdate({
        target: fileBlobs.fileId,
        set: { content: base64Content },
      });
  }

  async getFileContent(fileId: string): Promise<Buffer | null> {
    const [blob] = await db
      .select()
      .from(fileBlobs)
      .where(eq(fileBlobs.fileId, fileId));
    if (!blob) return null;

    return Buffer.from(blob.content, "base64");
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
          category: file.category,
          amount: file.amount || null,
          source: "local",
          storageUrl: file.localPath,
          isProcessed: file.isProcessed,
        };

        await this.saveFileMetadata(insertFile);
        console.log(`Migrated file: ${file.originalName}`);
      } catch (error) {
        console.error(`Failed to migrate file ${file.originalName}:`, error);
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
      category: dbFile.category,
      amount: dbFile.amount || undefined,
      uploadedAt: dbFile.uploadedAt.toISOString(),
      isProcessed: dbFile.isProcessed,
      localPath: dbFile.storageUrl || "",
    };
  }
}

export class MemStorage implements IStorage {
  private files: SimpleFile[] = [];
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  async saveFile(file: SimpleFile): Promise<SimpleFile> {
    this.files.push(file);
    return file;
  }

  async getFile(id: string): Promise<SimpleFile | null> {
    return this.files.find((file) => file.id === id) || null;
  }

  async getAllFiles(): Promise<SimpleFile[]> {
    return [...this.files];
  }

  async deleteFile(id: string): Promise<boolean> {
    const index = this.files.findIndex((file) => file.id === id);
    if (index >= 0) {
      this.files.splice(index, 1);
      return true;
    }
    return false;
  }

  // Stub implementations for database methods
  async saveFileMetadata(): Promise<any> {
    throw new Error("Not implemented in MemStorage");
  }
  async getFileMetadata(): Promise<any> {
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

// Use database storage by default, fallback to memory for development
const USE_DATABASE = process.env.USE_DATABASE !== "false"; // Default to true
export const storage = USE_DATABASE ? new DatabaseStorage() : new MemStorage();
