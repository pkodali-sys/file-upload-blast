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
      // Generate unique filename with timestamp and random string
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = path.extname(file.originalname);
      cb(null, `${timestamp}-${randomString}${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PNG, JPG, DOC and PDF files are allowed."
        )
      );
    }
  },
});

// FTP Configuration
const FTP_CONFIG = {
  host: "",
  user: "",
  password: "",
  // connTimeout: 60000,
  // pasvTimeout: 60000,
  // keepalive: 60000,
};

async function uploadToFTP(
  localFilePath: string,
  fileName: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const ftp = new FTP();

    ftp.on("ready", () => {
      console.log("FTP connection established");
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

// listing all the files from FTP server
async function listFtpFiles(): Promise<any[]> {
  return new Promise((resolve) => {
    const ftp = new FTP();
    // ready
    ftp.on("ready", () => {
      console.log("FTP connection established for file listing");
      ftp.list("public_html/uploads", (err, list) => {
        if(err) {
          console.error("FTP list error:", err);
          resolve([]);
        } else {
          console.log(`Found ${list.length} files on FTP server`);
          resolve(list || []);
        }
        ftp.end();
      })
    });
    // ftp error
    ftp.on("error", (err) => {
      console.error("FTP connection error during listing:", err);
      resolve([]);
    });

    ftp.connect(FTP_CONFIG);
  });
}

// Sync files from ftp server on start up
async function syncFilesFromFTP() : Promise<void> {
  try{
    console.log("Syncing files from ftp server...");
    const ftpFiles = await listFtpFiles();

    for(const ftpFile of ftpFiles) {
      if(ftpFile.type !== "-" || ftpFile.name.startsWith(".")) {
          continue;
      }
      // check if file already exists on server
      const existingFile = files.find(f => f.name === ftpFile.name || f.localPath?.includes(ftpFile.name));
      if(existingFile) {
        continue; // skipping if already in memory
      }

      //extract original filename and reconstruct metadata
      const filename = ftpFile.name;
      const originalName = filename.replace(/^\d+-[a-z0-9]+/, '');
      // remove random timestamp extension
      const extention = path.extname(filename).toLowerCase();

      if(extention !== ".pdf" ) {
        continue;
      }

      // set MIME type for pdf
      const mimeType = 'application/pdf';
      // create file metadata
      const fileData: SimpleFile= {
        id: randomUUID(),
        name: originalName.startsWith('.') ? filename : originalName,
        originalName: originalName.startsWith('.') ? filename : originalName,
        size: ftpFile.size || 0,
        mimeType,
        uploadedAt : ftpFile.date ? new Date(ftpFile.date).toISOString() : new Date().toISOString(),
        isProcessed: true,
        localPath: `ftp://${filename}`
      };

      files.push(fileData);
    }
    console.log(`Synced ${ftpFiles.length} files from FTP. Total files in memory: ${files.length}`)
  } catch (err) {
    console.error("Error syncing files from FTP", err)
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await syncFilesFromFTP();
  // File upload endpoint
  app.post("/api/files/upload", upload.array("files", 10), async (req, res) => {
    try {
      const uploadedFiles = req.files as Express.Multer.File[];
      if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const processedFiles = [];

      for (const file of uploadedFiles) {
        // Upload to FTP server (async, don't wait for completion)
        const ftpUploadPromise = uploadToFTP(file.path, file.filename);

        const fileData: SimpleFile = {
          id: randomUUID(),
          name: file.originalname,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,

          uploadedAt: new Date().toISOString(),
          isProcessed: true,
          localPath: file.path,
        };

        files.push(fileData);

        // Try FTP upload and update status
        ftpUploadPromise.then((ftpSuccess) => {
          console.log(
            `File ${file.originalname} - Local: ✓ FTP: ${
              ftpSuccess ? "✓" : "✗"
            }`
          );
        });

        processedFiles.push(fileData);
      }

      res.json({ files: processedFiles });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // Get files with pagination and search
  app.get("/api/files", async (req, res) => {
    try {
      const {
        page = "1",
        limit = "10",
        search,
        category,
      } = req.query as Record<string, string>;

      let filteredFiles = [...files];

      // Apply filters
      if (search) {
        const searchTerm = search.toLowerCase();
        filteredFiles = filteredFiles.filter(
          (file) =>
            file.name.toLowerCase().includes(searchTerm) ||
            file.originalName.toLowerCase().includes(searchTerm)
        );
      }

      // Sort by upload date (newest first)
      filteredFiles.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      );

      const total = filteredFiles.length;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const paginatedFiles = filteredFiles.slice(
        offset,
        offset + parseInt(limit)
      );

      res.json({
        files: paginatedFiles,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error("Get files error:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Get single file
  app.get("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const file = files.find((f) => f.id === id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      res.json({ file });
    } catch (error) {
      console.error("Get file error:", error);
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  // View file
  app.get("/api/files/:id/view", async (req, res) => {
    try {
      const { id } = req.params;
      const file = files.find((f) => f.id === id);

      if (!file || !file.localPath) {
        return res.status(404).json({ message: "File not found" });
      }

      // handle FTP only files
      if(file.localPath.startsWith("ftp://")) {
        const fileName = file.localPath.replace("ftp://", "");
        const ftpFileUrl = `https://${FTP_CONFIG.host.replace('files.', '')}/uploads/${fileName}`;
        return res.redirect(ftpFileUrl);
      }
      

      // Check if file exists locally
      if (!fs.existsSync(file.localPath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      // Set appropriate headers
      res.set({
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.originalName}"`,
      });

      // Stream the file
      const fileStream = fs.createReadStream(file.localPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("File serve error:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Delete file
  app.delete("/api/files/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const fileIndex = files.findIndex((f) => f.id === id);

      if (fileIndex === -1) {
        return res.status(404).json({ message: "File not found" });
      }

      const file = files[fileIndex];

      // Remove from in-memory storage
      files.splice(fileIndex, 1);

      // Optionally delete the local file from disk
      if (file.localPath && fs.existsSync(file.localPath)) {
        try {
          fs.unlinkSync(file.localPath);
          console.log(`Local file deleted: ${file.localPath}`);
        } catch (error) {
          console.error("Failed to delete local file:", error);
          // Continue anyway since we removed it from memory
        }
      }

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
