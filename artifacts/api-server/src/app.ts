import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// 1. Security Headers
app.use(helmet());

// 2. CORS Configuration
const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:5173",
  "https://libyan-learn-hub.vercel.app",
  "https://libyan-learn-hub-lms-web.vercel.app",
  "https://eduonline.net.ly",
  "https://www.eduonline.net.ly",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// 3. Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Limit each IP to 2000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

// app.use(limiter);

// Normalize Content-Type for proxied requests (e.g., Vercel → Render).
// EXCLUDE multipart/form-data to prevent breaking file uploads.
app.use((req, _res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'];
    if (ct && ct.includes('multipart/form-data')) {
      return next();
    }
    if (!ct || !ct.includes('application/json')) {
      req.headers['content-type'] = 'application/json';
    }
  }
  next();
});

// Serve local uploads folder statically for development fallback
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
