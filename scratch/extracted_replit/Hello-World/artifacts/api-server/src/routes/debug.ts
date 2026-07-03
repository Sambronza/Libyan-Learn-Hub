import { Router } from "express";
import { sendEmail } from "../lib/email.js";

const router = Router();

router.get("/test-email", async (req, res) => {
  try {
    const to = req.query.to as string || "test@example.com";
    await sendEmail({
      to,
      subject: "Test Email from API",
      text: "This is a test email.",
    });
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

export default router;
