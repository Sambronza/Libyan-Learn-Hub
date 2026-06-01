import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function test() {
  console.log("User:", process.env.SMTP_USER);
  console.log("Host:", process.env.SMTP_HOST);
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    // First, verify the connection configuration
    await transporter.verify();
    console.log("✅ SUCCESS! SMTP Server accepted the credentials.");
    
    // Send a test email
    const toEmail = "sambronza2019@gmail.com";
    console.log("✉️ Sending a quick test email to", toEmail);
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Libyan Learn Hub" <contact@eduonline.net.ly>',
      to: toEmail,
      subject: "Test Email - Libyan Learn Hub",
      text: "Your Brevo SMTP integration is working perfectly!"
    });
    console.log("✅ Test email sent! Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ FAILED to verify SMTP connection. Double check the SMTP_PASS in your .env file.");
    console.error(error);
  }
}

test();
