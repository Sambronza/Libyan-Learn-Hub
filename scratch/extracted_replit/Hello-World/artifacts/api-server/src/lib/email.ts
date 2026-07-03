import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 5000, // 5 seconds
  greetingTimeout: 5000,
  socketTimeout: 5000,
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  // If SMTP is not configured, fall back to mock logging (useful for local dev)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[Mock Email] To: ${to} | Subject: ${subject}`);
    console.warn(`[Mock Email Text]: ${text}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Libyan Learn Hub" <no-reply@eduonline.net.ly>`,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
