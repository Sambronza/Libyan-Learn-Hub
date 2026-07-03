import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import categoriesRouter from "./categories.js";
import coursesRouter from "./courses.js";
import sectionsRouter from "./sections.js";
import slidesRouter from "./slides.js";
import quizzesRouter from "./quizzes.js";
import enrollmentsRouter from "./enrollments.js";
import progressRouter from "./progress.js";
import liveSessionsRouter from "./live-sessions.js";
import usersRouter from "./users.js";
import teacherRouter from "./teacher.js";
import paymentsRouter from "./payments.js";
import adminRouter from "./admin.js";
import videoRouter from "./video.js";
import reportsRouter from "./reports.js";
import tutoringRouter from "./tutoring.js";
import tutoringListingsRouter from "./tutoring-listings.js";
import sessionRoomRouter from "./session-room.js";
import expensesRouter from "./expenses.js";
import lessonProgressRouter from "./lesson-progress.js";
import wishlistsRouter from "./wishlists.js";
import uploadRouter from "./upload.js";
// New platform improvement routes
import teacherProfileRouter from "./teacher-profile.js";
import advertisementsRouter from "./advertisements.js";
import copyrightComplaintsRouter from "./copyright-complaints.js";
import verificationRouter from "./verification.js";
import academyRouter from "./academy.js";
import notificationsRouter from "./notifications.js";
import biometricsRouter from "./biometrics.js";
import walletRouter from "./wallet.js";
import prepaidCardsRouter from "./prepaid-cards.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/categories", categoriesRouter);
router.use("/courses", coursesRouter);
router.use("/courses/:courseId/sections", sectionsRouter);
router.use("/slides", slidesRouter);
router.use("/quizzes", quizzesRouter);
router.use("/enrollments", enrollmentsRouter);
router.use("/progress", progressRouter);
router.use("/live-sessions", liveSessionsRouter);
router.use("/", usersRouter);
router.use("/teachers", teacherRouter);
router.use("/teacher", teacherRouter);
router.use("/payments", paymentsRouter);
router.use("/admin", adminRouter);
router.use("/video", videoRouter);
router.use("/reports", reportsRouter);
router.use("/tutoring", tutoringRouter);
router.use("/tutoring-listings", tutoringListingsRouter);
router.use("/room", sessionRoomRouter);
router.use("/expenses", expensesRouter);
router.use("/lesson-progress", lessonProgressRouter);
router.use("/wishlists", wishlistsRouter);
router.use("/upload", uploadRouter);
// New platform improvement routes
router.use("/teacher-profile", teacherProfileRouter);
router.use("/advertisements", advertisementsRouter);
router.use("/copyright-complaints", copyrightComplaintsRouter);
router.use("/verification", verificationRouter);
router.use("/notifications", notificationsRouter);
router.use("/biometrics", biometricsRouter);
// Academy router
router.use("/academy", academyRouter);
// Wallet & Prepaid Cards
router.use("/wallet", walletRouter);
router.use("/prepaid-cards", prepaidCardsRouter);

export default router;
