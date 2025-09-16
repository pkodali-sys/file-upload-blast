import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import FTP from "ftp";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple in-memory storage for files (no persistence)
interface SimpleFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  isProcessed: boolean;
  localPath: string;
  ftpPath?: string;
}

const files: SimpleFile[] = [];

// Configure multer for file uploads to local disk
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = path.extname(file.originalname);
      cb(null, `${timestamp}-${randomString}${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only PNG, JPG, DOC, XLS, and PDF allowed."));
  },
});

// FTP Configuration
const FTP_CONFIG = {
  host: "172.24.29.4",
  user: "ftp_bot",
  password: "test@123",
  port: 21,
};

// Check FTP connection
async function checkFTPConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    let connected = false;

    ftp.on("ready", () => {
      connected = true;
      console.log("FTP connection successful");
      ftp.end();
      resolve(true);
    });

    ftp.on("error", (err) => {
      if (!connected) {
        console.error("FTP connection failed:", err);
        resolve(false);
      }
    });

    ftp.connect(FTP_CONFIG);
  });
}

// Ensure uploads directory exists on FTP
async function createFTPUploadsDir(): Promise<boolean> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    ftp.on("ready", () => {
      ftp.mkdir("public_html/uploads", true, (err) => {
        if (err && (err as any).code !== 550) {
          console.error("Failed to create FTP dir:", err);
          resolve(false);
        } else resolve(true);
        ftp.end();
      });
    });
    ftp.on("error", (err) => {
      console.error("FTP connection error:", err);
      resolve(false);
    });
    ftp.connect(FTP_CONFIG);
  });
}

// Upload file to FTP
async function uploadToFTP(localFilePath: string, fileName: string): Promise<boolean> {
  await createFTPUploadsDir();
  return new Promise((resolve) => {
    const ftp = new FTP();
    ftp.on("ready", () => {
      ftp.put(localFilePath, `public_html/uploads/${fileName}`, (err) => {
        if (err) {
          console.error("FTP upload error:", err);
          resolve(false);
        } else {
          console.log(`File uploaded to FTP: ${fileName}`);
          resolve(true);
        }
        ftp.end();
      });
    });
    ftp.on("error", (err) => {
      console.error("FTP connection error:", err);
      resolve(false);
    });
    ftp.connect(FTP_CONFIG);
  });
}

// List FTP files
async function listFtpFiles(): Promise<any[]> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    ftp.on("ready", () => {
      ftp.list("public_html/uploads", (err, list) => {
        if (err) {
          console.error("FTP list error:", err);
          resolve([]);
        } else resolve(list || []);
        ftp.end();
      });
    });
    ftp.on("error", (err) => {
      console.error("FTP error during list:", err);
      resolve([]);
    });
    ftp.connect(FTP_CONFIG);
  });
}

// Sync files from FTP server
async function syncFilesFromFTP(): Promise<void> {
  try {
    console.log("Syncing files from FTP...");
    const isConnected = await checkFTPConnection();
    if (!isConnected) {
      console.warn("FTP server unreachable. Skipping sync.");
      return;
    }

    await createFTPUploadsDir();
    const ftpFiles = await listFtpFiles();

    for (const ftpFile of ftpFiles) {
      if (ftpFile.type !== "-" || ftpFile.name.startsWith(".")) continue;

      const filename = ftpFile.name;
      const ext = path.extname(filename).toLowerCase();
      if (![".pdf", ".png", ".jpg", ".jpeg", ".gif", ".doc", ".docx", ".xls", ".xlsx"].includes(ext)) continue;
      if (files.find((f) => f.name === filename)) continue;

      files.push({
        id: randomUUID(),
        name: filename,
        originalName: filename,
        size: ftpFile.size || 0,
        mimeType: ext === ".pdf" ? "application/pdf" : "application/octet-stream",
        uploadedAt: ftpFile.date ? new Date(ftpFile.date).toISOString() : new Date().toISOString(),
        isProcessed: true,
        localPath: `ftp://${filename}`,
        ftpPath: `public_html/uploads/${filename}`,
      });
    }
    console.log(`Synced ${files.length} files from FTP.`);
  } catch (err) {
    console.error("Error syncing FTP:", err);
  }
}

// Sanitize filenames
function sanitizeFilename(filename: string): string {
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, "");
  sanitized = sanitized.replace(/\s+/g, "_").replace(/_+/g, "_");
  const ext = path.extname(sanitized);
  const base = sanitized.slice(0, -ext.length);
  if (base.length > 80) sanitized = base.slice(0, 80) + ext;
  return sanitized;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await syncFilesFromFTP();

  // FTP connection check endpoint
  app.get("/api/ftp/check", async (req, res) => {
    try {
      const isConnected = await checkFTPConnection();
      res.json({ connected: isConnected });
    } catch (err) {
      console.error("FTP check error:", err);
      res.status(500).json({ connected: false, message: "FTP check failed" });
    }
  });

  // Upload endpoint
  app.post("/api/files/upload", upload.array("files", 10), async (req, res) => {
    try {
      const uploadedFiles = req.files as Express.Multer.File[];
      if (!uploadedFiles || uploadedFiles.length === 0) return res.status(400).json({ message: "No files uploaded" });

      const processedFiles: SimpleFile[] = [];

      for (const file of uploadedFiles) {
        const sanitizedOriginal = sanitizeFilename(file.originalname);
        const ftpFileName = `${sanitizedOriginal}`;

        const ftpSuccess = await uploadToFTP(file.path, ftpFileName);
        console.log(`File ${file.originalname} - Local: ✓ FTP: ${ftpSuccess ? "✓" : "✗"}`);

        const fileData: SimpleFile = {
          id: randomUUID(),
          name: ftpFileName,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date().toISOString(),
          isProcessed: true,
          localPath: file.path,
          ftpPath: `public_html/uploads/${ftpFileName}`,
        };

        files.push(fileData);
        processedFiles.push(fileData);
      }

      res.json({ files: processedFiles });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // List files endpoint
  app.get("/api/files", async (req, res) => {
    try {
      const { page = "1", limit = "10", search } = req.query as Record<string, string>;
      let filtered = [...files];
      if (search) {
        const term = search.toLowerCase();
        filtered = filtered.filter((f) => f.name.toLowerCase().includes(term) || f.originalName.toLowerCase().includes(term));
      }
      filtered.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      const total = filtered.length;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const paginated = filtered.slice(offset, offset + parseInt(limit));
      res.json({ files: paginated, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (error) {
      console.error("List error:", error);
      res.status(500).json({ message: "Failed to list files" });
    }
  });

  // Get single file
  app.get("/api/files/:id", (req, res) => {
    const file = files.find((f) => f.id === req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    res.json({ file });
  });

  // View file
  app.get("/api/files/:id/view", (req, res) => {
    const file = files.find((f) => f.id === req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });

    if (file.ftpPath) {
      const ftp = new FTP();
      ftp.on("ready", () => {
        ftp.get(file.ftpPath!, (err, stream) => {
          if (err || !stream) {
            console.error("FTP stream error:", err);
            res.status(500).json({ message: "Failed to fetch file from FTP" });
            ftp.end();
            return;
          }
          res.set({
            "Content-Type": file.mimeType,
            "Content-Disposition": `inline; filename="${file.originalName}"`,
          });
          stream.pipe(res);
          stream.on("close", () => ftp.end());
        });
      });
      ftp.on("error", (err) => {
        console.error("FTP connection error:", err);
        res.status(500).json({ message: "FTP connection failed" });
      });
      ftp.connect(FTP_CONFIG);
      return;
    }

    if (!fs.existsSync(file.localPath)) return res.status(404).json({ message: "File not found on disk" });
    res.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.originalName}"`,
    });
    fs.createReadStream(file.localPath).pipe(res);
  });

  // Delete file
  app.delete("/api/files/:id", (req, res) => {
    const idx = files.findIndex((f) => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "File not found" });

    const file = files[idx];
    files.splice(idx, 1);

    // Delete local
    if (file.localPath && fs.existsSync(file.localPath) && !file.localPath.startsWith("ftp://")) {
      try { fs.unlinkSync(file.localPath); } catch (err) { console.error("Failed to delete local file:", err); }
    }

    // Delete FTP
    if (file.ftpPath) {
      const ftp = new FTP();
      ftp.on("ready", () => {
        ftp.delete(file.ftpPath!, (err) => {
          if (err) console.error("Failed to delete FTP file:", err);
          else console.log(`Deleted from FTP: ${file.ftpPath}`);
          ftp.end();
        });
      });
      ftp.on("error", (err) => console.error("FTP delete connection error:", err));
      ftp.connect(FTP_CONFIG);
    }

    res.json({ message: "File deleted successfully" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
