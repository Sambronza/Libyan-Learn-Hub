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

// ─── Shared brand wrapper ─────────────────────────────────────────────────────
function brandWrap(body: string): string {
  const appUrl = process.env.APP_URL || "https://eduonline.net.ly";
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Libyan Learn Hub</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;color:#f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;max-width:600px;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 40px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">🎓 Libyan Learn Hub</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px;">منصة التعليم الإلكتروني</div>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;padding:24px 40px;text-align:center;border-top:1px solid #334155;">
            <p style="margin:0;font-size:12px;color:#64748b;">
              © ${new Date().getFullYear()} Libyan Learn Hub · 
              <a href="${appUrl}" style="color:#818cf8;text-decoration:none;">eduonline.net.ly</a>
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#475569;">
              هذا البريد الإلكتروني تم إرساله تلقائياً — لا ترد عليه
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const styles = {
  h2: `font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 8px;`,
  p: `font-size:15px;color:#94a3b8;line-height:1.7;margin:0 0 16px;`,
  label: `font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:4px;`,
  value: `font-size:15px;font-weight:600;color:#e2e8f0;`,
  card: `background:#0f172a;border-radius:12px;padding:20px 24px;margin:24px 0;border:1px solid #334155;`,
  btn: `display:inline-block;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.3px;`,
};

// ─── Email: Teacher accepted request ─────────────────────────────────────────
export function buildAcceptedEmail(opts: {
  studentName: string;
  teacherName: string;
  subject: string;
  preferredAt: Date;
  durationMinutes: number;
  requestId: number;
}): { subject: string; text: string; html: string } {
  const appUrl = process.env.APP_URL || "https://eduonline.net.ly";
  const sessionUrl = `${appUrl}/tutoring/room/${opts.requestId}`;
  const dateStr = opts.preferredAt.toLocaleString("ar-LY", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const dateStrEn = opts.preferredAt.toLocaleString("en-GB", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const body = `
    <h2 style="${styles.h2}">✅ تم قبول طلب جلستك!</h2>
    <p style="${styles.p}">مرحباً <strong style="color:#e2e8f0;">${opts.studentName}</strong>،</p>
    <p style="${styles.p}">
      قبل المعلم <strong style="color:#a78bfa;">${opts.teacherName}</strong> طلبك للجلسة الخاصة.
      يُرجى الاستعداد والانضمام في الوقت المحدد.
    </p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">
      <em>Your teacher <strong style="color:#a78bfa;">${opts.teacherName}</strong> has accepted your 1-to-1 session request.</em>
    </p>
    <div style="${styles.card}">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
            <div style="${styles.label}">المادة / Subject</div>
            <div style="${styles.value}">${opts.subject}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
            <div style="${styles.label}">التاريخ والوقت / Date & Time</div>
            <div style="${styles.value}">${dateStr}</div>
            <div style="font-size:13px;color:#64748b;">${dateStrEn}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
            <div style="${styles.label}">المدة / Duration</div>
            <div style="${styles.value}">${opts.durationMinutes} دقيقة / ${opts.durationMinutes} minutes</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;">
            <div style="${styles.label}">المعلم / Teacher</div>
            <div style="${styles.value}">${opts.teacherName}</div>
          </td>
        </tr>
      </table>
    </div>
    <p style="text-align:center;margin:32px 0 0;">
      <a href="${sessionUrl}" style="${styles.btn}">🚀 الدخول إلى الجلسة &nbsp;/&nbsp; Enter Session</a>
    </p>
  `;

  return {
    subject: `✅ تم قبول طلبك | ${opts.teacherName} accepted your session`,
    text: `Hello ${opts.studentName},\n\n${opts.teacherName} has accepted your tutoring session.\n\nSubject: ${opts.subject}\nDate: ${dateStrEn}\nDuration: ${opts.durationMinutes} minutes\n\nJoin here: ${sessionUrl}`,
    html: brandWrap(body),
  };
}

// ─── Email: Teacher joined the room ──────────────────────────────────────────
export function buildTeacherJoinedEmail(opts: {
  studentName: string;
  teacherName: string;
  subject: string;
  requestId: number;
}): { subject: string; text: string; html: string } {
  const appUrl = process.env.APP_URL || "https://eduonline.net.ly";
  const sessionUrl = `${appUrl}/tutoring/room/${opts.requestId}`;

  const body = `
    <h2 style="${styles.h2}">⏰ معلمك في انتظارك الآن!</h2>
    <p style="${styles.p}">مرحباً <strong style="color:#e2e8f0;">${opts.studentName}</strong>،</p>
    <p style="${styles.p}">
      انضم المعلم <strong style="color:#a78bfa;">${opts.teacherName}</strong> إلى الجلسة وهو في انتظارك الآن.
      يُرجى الدخول فوراً لبدء الجلسة.
    </p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">
      <em>Your teacher <strong style="color:#a78bfa;">${opts.teacherName}</strong> has joined the session and is waiting for you. Please enter now!</em>
    </p>
    <div style="${styles.card}">
      <div style="${styles.label}">المادة / Subject</div>
      <div style="${styles.value};">${opts.subject}</div>
    </div>
    <div style="background:#422006;border:1px solid #92400e;border-radius:12px;padding:16px 24px;margin:0 0 32px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#fcd34d;font-weight:600;">
        ⚡ لا تضيّع الوقت — الجلسة تُحسب من لحظة انضمام المعلم
      </p>
      <p style="margin:4px 0 0;font-size:13px;color:#fbbf24;">
        <em>The session timer starts from when the teacher joins.</em>
      </p>
    </div>
    <p style="text-align:center;margin:0;">
      <a href="${sessionUrl}" style="${styles.btn}">📹 ادخل الجلسة الآن &nbsp;/&nbsp; Join Now</a>
    </p>
  `;

  return {
    subject: `⏰ معلمك في انتظارك! | Your teacher has joined — enter now`,
    text: `Hello ${opts.studentName},\n\n${opts.teacherName} has joined your tutoring session for "${opts.subject}" and is waiting for you.\n\nJoin now: ${sessionUrl}`,
    html: brandWrap(body),
  };
}

// ─── Email: Teacher registration approved ────────────────────────────────────
export function buildTeacherApprovedEmail(opts: {
  teacherName: string;
  teacherEmail: string;
}): { subject: string; text: string; html: string } {
  const appUrl = process.env.APP_URL || "https://eduonline.net.ly";
  const dashboardUrl = `${appUrl}/teacher/dashboard`;

  const body = `
    <h2 style="${styles.h2}">🎉 تهانينا! تم اعتماد حسابك كمعلم</h2>
    <p style="${styles.p}">مرحباً <strong style="color:#e2e8f0;">${opts.teacherName}</strong>،</p>
    <p style="${styles.p}">
      يسعدنا إبلاغك بأن طلب تسجيلك كمعلم على منصة <strong style="color:#a78bfa;">Libyan Learn Hub</strong> قد تمت الموافقة عليه.
      يمكنك الآن البدء في إنشاء دوراتك وإضافة محتواك التعليمي.
    </p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">
      <em>Congratulations! Your teacher account on <strong style="color:#a78bfa;">Libyan Learn Hub</strong> has been <strong style="color:#4ade80;">approved</strong>. You can now create courses and schedule live sessions.</em>
    </p>
    <div style="${styles.card}">
      <div style="${styles.label}">ما الذي يمكنك فعله الآن / What you can do now</div>
      <ul style="margin:12px 0 0;padding:0 0 0 20px;color:#94a3b8;font-size:14px;line-height:2;">
        <li>إنشاء دورات تعليمية ورفع محتوى / Create courses and upload content</li>
        <li>جدولة جلسات مباشرة / Schedule live sessions</li>
        <li>إدارة طلاب مسجلين / Manage enrolled students</li>
        <li>تلقي المدفوعات / Receive payments</li>
      </ul>
    </div>
    <p style="text-align:center;margin:32px 0 0;">
      <a href="${dashboardUrl}" style="${styles.btn}">🚀 اذهب إلى لوحة التحكم / Go to Dashboard</a>
    </p>
  `;

  return {
    subject: `✅ تم اعتماد حسابك كمعلم | Your teacher account is approved`,
    text: `Congratulations ${opts.teacherName}!\n\nYour teacher account on Libyan Learn Hub has been approved. You can now create courses and start teaching.\n\nDashboard: ${dashboardUrl}`,
    html: brandWrap(body),
  };
}

// ─── Email: Teacher registration rejected ────────────────────────────────────
export function buildTeacherRejectedEmail(opts: {
  teacherName: string;
  reason: string;
}): { subject: string; text: string; html: string } {
  const appUrl = process.env.APP_URL || "https://eduonline.net.ly";
  const dashboardUrl = `${appUrl}/teacher/dashboard`;

  const body = `
    <h2 style="${styles.h2}">❌ لم يتم قبول طلب التسجيل</h2>
    <p style="${styles.p}">مرحباً <strong style="color:#e2e8f0;">${opts.teacherName}</strong>،</p>
    <p style="${styles.p}">
      شكراً لتقديمك طلب التسجيل كمعلم على منصتنا. بعد مراجعة الطلب والوثائق المرفقة، نأسف لإبلاغك بأنه لم يتم قبول طلبك في الوقت الحالي.
    </p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">
      <em>Thank you for applying to teach on Libyan Learn Hub. Unfortunately, your registration was <strong style="color:#f87171;">not approved</strong> at this time.</em>
    </p>
    <div style="background:#2d1515;border:1px solid #7f1d1d;border-radius:12px;padding:20px 24px;margin:24px 0;">
      <div style="${styles.label};color:#f87171;">سبب الرفض / Rejection Reason</div>
      <p style="margin:8px 0 0;font-size:15px;color:#fca5a5;line-height:1.7;">${opts.reason}</p>
    </div>
    <p style="${styles.p}">
      يمكنك تصحيح المعلومات أو الوثائق المطلوبة وإعادة تقديم طلبك من خلال لوحة التحكم.
    </p>
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">
      <em>You may correct the required information or documents and resubmit your application from your dashboard.</em>
    </p>
    <p style="text-align:center;margin:32px 0 0;">
      <a href="${dashboardUrl}" style="${styles.btn}">🔄 إعادة التقديم / Resubmit Application</a>
    </p>
  `;

  return {
    subject: `❌ طلب تسجيل المعلم | Teacher registration update`,
    text: `Hello ${opts.teacherName},\n\nUnfortunately your teacher registration was not approved.\n\nReason: ${opts.reason}\n\nYou can resubmit from your dashboard: ${dashboardUrl}`,
    html: brandWrap(body),
  };
}

