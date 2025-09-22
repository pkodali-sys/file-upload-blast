import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import FTP from "ftp";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import { User, LoginCredentials, loginCredentialsSchema } from "shared/schema";

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
  category: string;
  amount?: string;
  uploadedAt: string;
  isProcessed: boolean;
  localPath: string;
}

const files: SimpleFile[] = [];

// Authentication Setup - All in one place
const MemStoreSession = MemoryStore(session);
const sessionStore = new MemStoreSession({
  checkPeriod: 86400000, // prune expired entries every 24h
  ttl: 3600000, // 1 hour TTL to match session maxAge
});

// Hardcoded user credentials
const USERS = [
  { id: "0", username: "TBS_Admin", password: "HorseRunning18Miles!@" },
  { id: "1", username: "User_Tao", password: "TBS_Marketing!2025!" },
  { id: "2", username: "User_Diem", password: "TBS_Marketing!2025!" },
  { id: "3", username: "User_Stefania", password: "TBS_Marketing!2025!" },
  { id: "4", username: "User_The_Mike", password: "TBS_Marketing!2025!" },
];

// Helper function to find user by username and password
const findUser = (username: string, password: string): User | null => {
  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );
  if (user) {
    return { id: user.id, username: user.username };
  }
  return null;
};

// Helper function to find user by ID
const findUserById = (id: string): User | null => {
  const user = USERS.find((u) => u.id === id);
  if (user) {
    return { id: user.id, username: user.username };
  }
  return null;
};

// Middleware to require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDF, Word documents, and Excel files are allowed."
        )
      );
    }
  },
});

// FTP Configuration from Environment Variables
const FTP_CONFIG = {
  host: process.env.FTP_HOST || "localhost",
  user: process.env.FTP_USER || "anonymous",
  password: process.env.FTP_PASSWORD || "",
  connTimeout: 60000,
  pasvTimeout: 60000,
  keepalive: 60000,
};

async function uploadToFTP(
  localFilePath: string,
  fileName: string
): Promise<boolean> {
  // First ensure uploads directory exists
  const dirCreated = await createFTPUploadsDir();
  if (!dirCreated) {
    console.log("Warning: Could not verify uploads directory exists");
  }

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

// Create uploads directory on FTP server
async function createFTPUploadsDir(): Promise<boolean> {
  return new Promise((resolve) => {
    const ftp = new FTP();

    ftp.on("ready", () => {
      console.log("FTP connection established for directory creation");

      // First check if public_html exists
      ftp.list("public_html", (err, list) => {
        if (err) {
          console.log("public_html directory not found, creating it...");
          ftp.mkdir("public_html", (mkdirErr) => {
            if (mkdirErr) {
              console.error("Failed to create public_html:", mkdirErr);
              ftp.end();
              resolve(false);
              return;
            }

            // Now create uploads directory
            ftp.mkdir("public_html/uploads", (uploadsErr) => {
              if (uploadsErr) {
                console.error(
                  "Failed to create uploads directory:",
                  uploadsErr
                );
                resolve(false);
              } else {
                console.log(
                  "Successfully created public_html/uploads directory"
                );
                resolve(true);
              }
              ftp.end();
            });
          });
        } else {
          // public_html exists, now check/create uploads
          ftp.mkdir("public_html/uploads", (uploadsErr) => {
            if (uploadsErr && (uploadsErr as any).code !== 550) {
              // 550 means directory already exists, which is fine
              console.error("Failed to create uploads directory:", uploadsErr);
              resolve(false);
            } else {
              console.log(
                "Uploads directory ready (created or already exists)"
              );
              resolve(true);
            }
            ftp.end();
          });
        }
      });
    });

    ftp.on("error", (err) => {
      console.error("FTP connection error during directory creation:", err);
      resolve(false);
    });

    ftp.connect(FTP_CONFIG);
  });
}

// List files from FTP server
async function listFTPFiles(): Promise<any[]> {
  return new Promise((resolve) => {
    const ftp = new FTP();

    ftp.on("ready", () => {
      console.log("FTP connection established for file listing");
      ftp.list("public_html/uploads", (err, list) => {
        if (err) {
          console.error("FTP list error:", err);
          resolve([]);
        } else {
          console.log(`Found ${list.length} files on FTP server`);
          resolve(list || []);
        }
        ftp.end();
      });
    });

    ftp.on("error", (err) => {
      console.error("FTP connection error during listing:", err);
      resolve([]);
    });

    ftp.connect(FTP_CONFIG);
  });
}

// Sync files from FTP server on startup
async function syncFilesFromFTP(): Promise<void> {
  try {
    console.log("Syncing files from FTP server...");

    // First ensure the uploads directory exists
    console.log("Creating uploads directory if it doesn't exist...");
    const dirCreated = await createFTPUploadsDir();
    if (!dirCreated) {
      console.log(
        "Could not create/verify uploads directory, but continuing anyway..."
      );
    }

    const ftpFiles = await listFTPFiles();

    for (const ftpFile of ftpFiles) {
      // Skip directories and system files
      if (ftpFile.type !== "-" || ftpFile.name.startsWith(".")) {
        continue;
      }

      // Check if file already exists in memory
      const existingFile = files.find(
        (f) => f.name === ftpFile.name || f.localPath?.includes(ftpFile.name)
      );
      if (existingFile) {
        continue; // Skip if already in memory
      }

      // Extract original filename and reconstruct metadata
      const fileName = ftpFile.name;
      // Updated regex to match new format: timestamp-random-originalname.ext
      const originalName = fileName.replace(/^\d+-[a-z0-9]+-/, "") || fileName; // Remove timestamp-random prefix, fallback to filename

      // Debug logging
      console.log(`Processing FTP file: ${fileName}`);
      console.log(`Extracted original name: ${originalName}`);

      const extension = path.extname(fileName).toLowerCase();

      // Only sync PDF files
      if (extension !== ".pdf") {
        continue;
      }

      // Set MIME type for PDF
      const mimeType = "application/pdf";

      // Create file metadata
      const fileData: SimpleFile = {
        id: randomUUID(),
        name: originalName.startsWith(".") ? fileName : originalName,
        originalName: originalName.startsWith(".") ? fileName : originalName,
        size: ftpFile.size || 0,
        mimeType,
        category: categorizeFile(originalName, mimeType),
        amount: extractAmount(originalName)?.toString(),
        uploadedAt: ftpFile.date
          ? new Date(ftpFile.date).toISOString()
          : new Date().toISOString(),
        isProcessed: true,
        localPath: `ftp://${fileName}`, // Special path to indicate FTP-only file
      };

      files.push(fileData);
    }

    console.log(
      `Synced ${ftpFiles.length} files from FTP. Total files in memory: ${files.length}`
    );
  } catch (error) {
    console.error("Error syncing files from FTP:", error);
  }
}

// Simple categorization function
function categorizeFile(filename: string, mimeType: string): string {
  const name = filename.toLowerCase();

  if (
    name.includes("receipt") ||
    name.includes("coffee") ||
    name.includes("lunch") ||
    name.includes("dinner")
  ) {
    return "Business Expense";
  } else if (
    name.includes("grocery") ||
    name.includes("shared") ||
    name.includes("utility")
  ) {
    return "Shared Bill";
  } else if (
    name.includes("invoice") ||
    name.includes("office") ||
    name.includes("supplies")
  ) {
    return "Business Expense";
  } else if (
    name.includes("personal") ||
    name.includes("medical") ||
    name.includes("insurance")
  ) {
    return "Personal Expense";
  } else if (
    name.includes("tax") ||
    name.includes("1099") ||
    name.includes("w2")
  ) {
    return "Tax Document";
  }

  return "Business Expense"; // default
}

// Simple amount extraction
function extractAmount(filename: string): number | null {
  const match = filename.match(/\$?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : null;
}

// Sanitize filename for safe FTP storage
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, "");

  // Replace spaces with underscores
  sanitized = sanitized.replace(/\s+/g, "_");

  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, "_");

  // Remove leading/trailing underscores
  sanitized = sanitized.replace(/^_+|_+$/g, "");

  // Limit length (keep extension)
  const ext = path.extname(sanitized);
  const base = sanitized.slice(0, -ext.length);
  if (base.length > 80) {
    sanitized = base.slice(0, 80) + ext;
  }

  return sanitized;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication directly here - no external file needed
  const sessionSettings: session.SessionOptions = {
    secret:
      process.env.SESSION_SECRET ||
      "default-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    rolling: false, // Absolute 1-hour timeout from login
    store: sessionStore,
    cookie: {
      maxAge: 3600000, // 1 hour in milliseconds
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: "lax",
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use('/api/', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next(); // Continue to the next middleware or route handler
  });

  // Passport local strategy with hardcoded credentials
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      // Find user with matching credentials
      const user = findUser(username, password);
      if (user) {
        return done(null, user);
      }
      return done(null, false, { message: "Invalid credentials" });
    })
  );

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser((id: string, done) => {
    const user = findUserById(id);
    if (user) {
      done(null, user);
    } else {
      done(null, false);
    }
  });

  // AUTHENTICATION ROUTES - These MUST come before file routes
  // Login route
  app.post("/api/login", (req, res, next) => {
      res.set('Cache-Control', 'no-store');
    try {
      // Validate request body
      const validatedData = loginCredentialsSchema.parse(req.body);

      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) return next(err);
        if (!user) {
          return res
            .status(401)
            .json({ message: info?.message || "Invalid credentials" });
        }

        req.login(user, (err) => {
          if (err) return next(err);

          // Set session expiry time for client countdown
          const expiresAt = Date.now() + 3600000; // 1 hour from now
          (req.session as any).expiresAt = expiresAt;

          res.json({ ...user, expiresAt });
        });
      })(req, res, next);
    } catch (error) {
      res.status(400).json({ message: "Invalid input data" });
    }
  });

  // Logout route
  app.post("/api/logout", (req, res, next) => {
      res.set('Cache-Control', 'no-store');
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user route
  app.get("/api/user", (req, res) => {
      res.set('Cache-Control', 'no-store');
    if (req.isAuthenticated()) {
      const expiresAt = (req.session as any).expiresAt || Date.now() + 3600000;
      res.json({ ...req.user, expiresAt });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  console.log(
    "Authentication setup complete - 4 users configured with 1 hour session timeout"
  );

  // Sync existing files from FTP server on startup
  await syncFilesFromFTP();

  // File upload endpoint - PROTECTED (requires authentication)
  app.post(
    "/api/files/upload",
    requireAuth,
    upload.array("files", 10),
    async (req, res) => {
        res.set('Cache-Control', 'no-store');
      try {
        const uploadedFiles = req.files as Express.Multer.File[];
        if (!uploadedFiles || uploadedFiles.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        const processedFiles = [];

        for (const file of uploadedFiles) {
          const category = categorizeFile(file.originalname, file.mimetype);
          const amount = extractAmount(file.originalname);

          // Create FTP filename with original filename embedded
          const sanitizedOriginal = sanitizeFilename(file.originalname);
          const ftpFileName = `${file.filename.replace(
            path.extname(file.filename),
            ""
          )}-${sanitizedOriginal}`;

          // Debug logging
          console.log(`Upload debug - Original name: ${file.originalname}`);
          console.log(`Upload debug - Local filename: ${file.filename}`);
          console.log(`Upload debug - Sanitized: ${sanitizedOriginal}`);
          console.log(`Upload debug - FTP filename: ${ftpFileName}`);

          // Upload to FTP server (async, don't wait for completion)
          const ftpUploadPromise = uploadToFTP(file.path, ftpFileName);

          const fileData: SimpleFile = {
            id: randomUUID(),
            name: file.originalname, // This should always be the original filename
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            category,
            amount: amount ? amount.toString() : undefined,
            uploadedAt: new Date().toISOString(),
            isProcessed: true,
            localPath: file.path,
          };

          // Debug: verify what we're storing
          console.log(
            `Storing file data - name: ${fileData.name}, originalName: ${fileData.originalName}`
          );

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
    }
  );

  // Get files with pagination and search
  app.get("/api/files", requireAuth, async (req, res) => {
      res.set('Cache-Control', 'no-store');
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
            file.originalName.toLowerCase().includes(searchTerm) ||
            file.category.toLowerCase().includes(searchTerm)
        );
      }

      if (category) {
        filteredFiles = filteredFiles.filter(
          (file) => file.category === category
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
      res.set('Cache-Control', 'no-store');
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
      res.set('Cache-Control', 'no-store');
    try {
      const { id } = req.params;
      const file = files.find((f) => f.id === id);

      if (!file || !file.localPath) {
        return res.status(404).json({ message: "File not found" });
      }

      // Handle FTP-only files
      if (file.localPath.startsWith("ftp://")) {
        const fileName = file.localPath.replace("ftp://", "");
        const ftpFileUrl = `https://${FTP_CONFIG.host.replace(
          "files.",
          ""
        )}/uploads/${fileName}`;
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
  app.delete("/api/files/:id", requireAuth, async (req, res) => {
      res.set('Cache-Control', 'no-store');

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
