import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import router from "./routes";

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
  "https://www.eduonline.net.ly"
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

app.use(limiter);

// Normalize Content-Type for proxied requests (e.g., Vercel → Render).
// When Vercel forwards POST/PUT/PATCH requests, it can sometimes strip or
// alter the Content-Type header, causing express.json() to skip parsing and
// leave req.body as undefined. This middleware ensures the header is set.
app.use((req, _res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const ct = req.headers['content-type'];
    // Only override to application/json if content-type is completely missing
    // or if it's text/plain (which happens when some proxies strip it)
    // Do NOT override multipart/form-data or application/x-www-form-urlencoded
    if (!ct || ct.includes('text/plain')) {
      req.headers['content-type'] = 'application/json';
    }
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Performance Monitoring Middleware
let isColdStart = true;
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log cold start if it's the very first request
  if (isColdStart) {
    console.log(`[Cold Start] First request received: ${req.method} ${req.url}`);
    isColdStart = false;
  }

  // Hook into response finish to log duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[Performance] SLOW REQUEST: ${req.method} ${req.originalUrl} took ${duration}ms`);
    } else {
      // Optional: log all requests if needed for debugging
      // console.log(`[Performance] ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });
  
  next();
});

// Root-level health probe — deployment liveness checks hit /api (the base path)
// before the router routes are matched. Return 200 immediately without touching the DB.
app.get(["/api", "/api/"], (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

export default app;
