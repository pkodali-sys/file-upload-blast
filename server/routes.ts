import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import MemoryStore from "memorystore";
import {
  User,
  LoginCredentials,
  loginCredentialsSchema,
} from "../shared/schema.js";
import { createTables } from "./migrate.js";
import { storage, DatabaseStorage } from "./storage.js";
import connectPgSimple from "connect-pg-simple";


// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File storage will be managed by the storage interface
// Legacy interface maintained for compatibility
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


export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database tables first
  console.log("Initializing database...");
  try {
    await createTables();
    console.log("Database initialization completed!");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }

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
  // app.use(session(sessionSettings));
//   app.use(session({
//   store: sessionStore, // or switch to connect-pg-simple
//   secret: process.env.SESSION_SECRET!,
//   resave: false,
//   saveUninitialized: false,
//   rolling: true, // refresh expiry on activity
//   cookie: {
//     maxAge: 3600000, // 1 hour
//     httpOnly: true,
//     secure: false, // true if HTTPS
//     sameSite: "lax", // or "none" with CORS
//   },
// }));
  const PgSession = connectPgSimple(session);
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, httpOnly: true, sameSite: "lax" },
  }));
  app.use(passport.initialize());
  app.use(passport.session());

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
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
      });
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
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
    });

    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out successfully" });
    });
  });

  // Get current user route
  app.get("/api/user", (req, res) => {
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
      });
    
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

  // File upload endpoint - PROTECTED (requires authentication)
  app.post(
    "/api/files/upload",
    requireAuth,
    upload.array("files", 10),
    async (req, res) => {
        res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
      });
      try {
        const uploadedFiles = req.files as Express.Multer.File[];
        if (!uploadedFiles || uploadedFiles.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        const processedFiles = [];

        for (const file of uploadedFiles) {
          const fileData: SimpleFile = {
            id: randomUUID(), // Temporary ID, will be replaced by database
            name: file.originalname, // This should always be the original filename
            originalName: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date().toISOString(),
            isProcessed: true,
            localPath: file.path,
          };

          // Save file metadata to database and get the actual database-generated ID
          const savedFile = await storage.saveFile(fileData);

          // Store file content in database for sharing using the correct database ID
          if (storage instanceof DatabaseStorage) {
            try {
              console.log(
                `Reading file from: ${file.path} (${file.size} bytes)`
              );

              // Check if file exists before reading
              if (!fs.existsSync(file.path)) {
                throw new Error(`File does not exist at path: ${file.path}`);
              }

              const fileContent = fs.readFileSync(file.path);
              await storage.saveFileContent(savedFile.id, fileContent);
              console.log(
                `File content stored in database for: ${file.originalname} (${fileContent.length} bytes)`
              );
            } catch (error) {
              console.error(
                `Failed to store file content in database for ${file.originalname}:`,
                error
              );
            }
          }

          // Update fileData with the correct database ID for response
          fileData.id = savedFile.id;

          console.log(
            `File ${file.originalname} uploaded successfully to database`
          );

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
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
      });
    try {
      const {
        page = "1",
        limit = "10",
        search,
      } = req.query as Record<string, string>;

      let filteredFiles = await storage.getAllFiles();

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
      res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
      });
    try {
      const { id } = req.params;
      const file = await storage.getFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      res.json({ file });
    } catch (error) {
      console.error("Get file error:", error);
      res.status(500).json({ message: "Failed to fetch file" });
    }
  });

  // View file - PUBLIC endpoint for file sharing (NO AUTHENTICATION REQUIRED)
  app.get("/api/files/:id/view", async (req, res) => {
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
    });

    try {
      const { id } = req.params;
      const file = await storage.getFile(id);

      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Set appropriate headers for file download/viewing
      res.set({
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.originalName}"`,
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      });

      // Try to serve file content from database first (PRIMARY SOURCE)
      if (storage instanceof DatabaseStorage) {
        try {
          const fileContent = await storage.getFileContent(file.id);
          if (fileContent) {
            res.send(fileContent);
            return;
          }
        } catch (error) {
          console.error("Failed to get file content from database:", error);
        }
      }

      // Fallback to local file if database content not available
      if (file.localPath && fs.existsSync(file.localPath)) {
        const fileStream = fs.createReadStream(file.localPath);
        fileStream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Failed to stream file" });
          }
        });
        fileStream.pipe(res);
        return;
      }

      return res.status(404).json({ message: "File content not found" });
    } catch (error) {
      console.error("View file error:", error);
      res.status(500).json({ message: "Failed to view file" });
    }
  });

  // Delete file endpoint - PROTECTED
  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    res.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate", // Disable caching
        "Pragma": "no-cache", // Older HTTP/1.0 cache
        "Expires": "0", // Make sure content isn't cached
      });
      
    try {
      const { id } = req.params;
      const success = await storage.deleteFile(id);

      if (!success) {
        return res.status(404).json({ message: "File not found" });
      }

      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Delete file error:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  const server = createServer(app);
  return server;
}
