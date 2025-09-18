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

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = path.extname(file.originalname);
      cb(null, `${timestamp}-${randomString}${extension}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
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
    else cb(new Error("Invalid file type"));
  },
});

const FTP_CONFIG = {
  host: process.env.FTP_HOST,
  user: process.env.FTP_USER,
  password: process.env.FTP_PASS,
  port: 21,
};

// middleware to disable caching
function noCache(req: any, res: any, next: any) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
}

async function checkFTPConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    let connected = false;
    ftp.on("ready", () => {
      connected = true;
      ftp.end();
      resolve(true);
    });
    ftp.on("error", () => {
      if (!connected) resolve(false);
    });
    ftp.connect(FTP_CONFIG);
  });
}

async function createFTPUploadsDir(): Promise<boolean> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    ftp.on("ready", () => {
      ftp.mkdir("public_html/uploads", true, (err) => {
        if (err && (err as any).code !== 550) resolve(false);
        else resolve(true);
        ftp.end();
      });
    });
    ftp.on("error", () => resolve(false));
    ftp.connect(FTP_CONFIG);
  });
}

async function uploadToFTP(localFilePath: string, fileName: string): Promise<boolean> {
  await createFTPUploadsDir();
  return new Promise((resolve) => {
    const ftp = new FTP();
    ftp.on("ready", () => {
      ftp.put(localFilePath, `public_html/uploads/${fileName}`, (err) => {
        if (err) resolve(false);
        else resolve(true);
        ftp.end();
      });
    });
    ftp.on("error", () => resolve(false));
    ftp.connect(FTP_CONFIG);
  });
}

async function listFtpFiles(): Promise<any[]> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    ftp.on("ready", () => {
      ftp.list("public_html/uploads", (err, list) => {
        if (err) resolve([]);
        else resolve(list || []);
        ftp.end();
      });
    });
    ftp.on("error", () => resolve([]));
    ftp.connect(FTP_CONFIG);
  });
}

async function syncFilesFromFTP(): Promise<void> {
  const isConnected = await checkFTPConnection();
  if (!isConnected) return;
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
}

function sanitizeFilename(filename: string): string {
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_");
  const ext = path.extname(sanitized);
  const base = sanitized.slice(0, -ext.length);
  if (base.length > 80) sanitized = base.slice(0, 80) + ext;
  return sanitized;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await syncFilesFromFTP();

  // disable etags globally
  app.set("etag", false);

  // apply no-cache globally
  app.use(noCache);

  app.get("/api/ftp/check", async (req, res) => {
    const isConnected = await checkFTPConnection();
    res.json({ connected: isConnected });
  });

  app.post("/api/files/upload", upload.array("files", 10), async (req, res) => {
    const uploadedFiles = req.files as Express.Multer.File[];
    if (!uploadedFiles || uploadedFiles.length === 0) return res.status(400).json({ message: "No files uploaded" });

    const processedFiles: SimpleFile[] = [];
    for (const file of uploadedFiles) {
      const sanitizedOriginal = sanitizeFilename(file.originalname);
      const ftpFileName = `${sanitizedOriginal}`;
      await uploadToFTP(file.path, ftpFileName);
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
  });

  app.get("/api/files", (req, res) => {
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
  });

  app.get("/api/files/:id", (req, res) => {
    const file = files.find((f) => f.id === req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    res.json({ file });
  });

  app.get("/api/files/:id/view", (req, res) => {
    const file = files.find((f) => f.id === req.params.id);
    if (!file) return res.status(404).json({ message: "File not found" });
    if (file.ftpPath) {
      const ftp = new FTP();
      ftp.on("ready", () => {
        ftp.get(file.ftpPath!, (err, stream) => {
          if (err || !stream) return res.status(500).json({ message: "Failed to fetch file" });
          res.set({ "Content-Type": file.mimeType, "Content-Disposition": `inline; filename="${file.originalName}"` });
          stream.pipe(res);
          stream.on("close", () => ftp.end());
        });
      });
      ftp.connect(FTP_CONFIG);
      return;
    }
    if (!fs.existsSync(file.localPath)) return res.status(404).json({ message: "File not found on disk" });
    res.set({ "Content-Type": file.mimeType, "Content-Disposition": `inline; filename="${file.originalName}"` });
    fs.createReadStream(file.localPath).pipe(res);
  });

  app.delete("/api/files/:id", (req, res) => {
    const idx = files.findIndex((f) => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: "File not found" });
    const file = files[idx];
    files.splice(idx, 1);
    if (file.localPath && fs.existsSync(file.localPath) && !file.localPath.startsWith("ftp://")) {
      try { fs.unlinkSync(file.localPath); } catch {}
    }
    if (file.ftpPath) {
      const ftp = new FTP();
      ftp.on("ready", () => {
        ftp.delete(file.ftpPath!, () => ftp.end());
      });
      ftp.connect(FTP_CONFIG);
    }
    res.json({ message: "File deleted successfully" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
