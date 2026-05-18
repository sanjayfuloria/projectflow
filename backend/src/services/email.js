// src/services/email.js
// Uses Brevo (formerly Sendinblue) SMTP – free tier: 300 emails/day, no credit card
// Sign up at: https://app.brevo.com → Settings → SMTP & API → SMTP tab
// Copy: BREVO_SMTP_USER (your login email) and BREVO_SMTP_KEY (SMTP key)

const nodemailer = require('nodemailer');

const isConfigured = !!(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_KEY);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    })
  : null;

const FROM = `"ProjectFlow – CDOE" <${process.env.BREVO_FROM_EMAIL || 'noreply@projectflow.app'}>`;
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Base HTML template ────────────────────────────────────────────────────────
const wrap = (title, body) => `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0f14;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#161921;border-radius:12px;overflow:hidden;border:1px solid #2a2f42;">
    <div style="background:linear-gradient(135deg,#6c63ff,#ff6584);padding:24px 28px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(255,255,255,0.8)"></div>
        <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px">ProjectFlow</span>
      </div>
      <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px">CDOE · IFHE Hyderabad</div>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 16px;color:#e8eaf0;font-size:18px;">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 28px;border-top:1px solid #2a2f42;font-size:11px;color:#555d7a;text-align:center;">
      ProjectFlow · CDOE · IFHE Hyderabad · You're receiving this because you're a team member.
    </div>
  </div>
</body>
</html>`;

const btn = (text, url) =>
  `<a href="${url}" style="display:inline-block;margin-top:18px;padding:10px 22px;background:#6c63ff;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>`;

const p = (text) => `<p style="margin:0 0 10px;color:#8b90a7;font-size:14px;line-height:1.6;">${text}</p>`;

// ── Email senders ─────────────────────────────────────────────────────────────

async function send(to, subject, html) {
  if (!isConfigured) {
    console.log(`[EMAIL – not configured] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${subject}`);
  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
  }
}

// Task assigned to you
async function sendTaskAssigned({ toEmail, toName, taskKey, taskTitle, assignerName, columnLabel, dueDate }) {
  const due = dueDate ? `<br>Due: <strong style="color:#ffc94d">${new Date(dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</strong>` : '';
  const html = wrap('Task Assigned to You',
    p(`Hi ${toName},`) +
    p(`<strong style="color:#e8eaf0">${assignerName}</strong> assigned you a task:`) +
    `<div style="background:#1e2230;border:1px solid #2a2f42;border-left:3px solid #6c63ff;border-radius:8px;padding:14px 16px;margin:12px 0;">
      <div style="font-size:11px;color:#555d7a;font-weight:700;letter-spacing:1px;">${taskKey}</div>
      <div style="font-size:15px;font-weight:600;color:#e8eaf0;margin-top:4px;">${taskTitle}</div>
      <div style="font-size:12px;color:#8b90a7;margin-top:6px;">Column: ${columnLabel}${due}</div>
    </div>` +
    btn('View Task', `${APP_URL}`)
  );
  await send(toEmail, `[ProjectFlow] Task assigned: ${taskTitle}`, html);
}

// Task due tomorrow reminder
async function sendDueSoonReminder({ toEmail, toName, taskKey, taskTitle, dueDate }) {
  const html = wrap('Task Due Tomorrow ⏰',
    p(`Hi ${toName},`) +
    p(`This task is due <strong style="color:#ffc94d">tomorrow</strong>:`) +
    `<div style="background:#1e2230;border:1px solid #2a2f42;border-left:3px solid #ffc94d;border-radius:8px;padding:14px 16px;margin:12px 0;">
      <div style="font-size:11px;color:#555d7a;font-weight:700;letter-spacing:1px;">${taskKey}</div>
      <div style="font-size:15px;font-weight:600;color:#e8eaf0;margin-top:4px;">${taskTitle}</div>
      <div style="font-size:12px;color:#ffc94d;margin-top:6px;">Due: ${new Date(dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
    </div>` +
    btn('Open Task', `${APP_URL}`)
  );
  await send(toEmail, `[ProjectFlow] Due tomorrow: ${taskTitle}`, html);
}

// Task overdue alert
async function sendOverdueAlert({ toEmail, toName, taskKey, taskTitle, dueDate }) {
  const html = wrap('Task Overdue ⚠️',
    p(`Hi ${toName},`) +
    p(`This task is <strong style="color:#ff6584">overdue</strong> and needs attention:`) +
    `<div style="background:#1e2230;border:1px solid #2a2f42;border-left:3px solid #ff6584;border-radius:8px;padding:14px 16px;margin:12px 0;">
      <div style="font-size:11px;color:#555d7a;font-weight:700;letter-spacing:1px;">${taskKey}</div>
      <div style="font-size:15px;font-weight:600;color:#e8eaf0;margin-top:4px;">${taskTitle}</div>
      <div style="font-size:12px;color:#ff6584;margin-top:6px;">Was due: ${new Date(dueDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
    </div>` +
    btn('Update Task', `${APP_URL}`)
  );
  await send(toEmail, `[ProjectFlow] Overdue: ${taskTitle}`, html);
}

// New comment on a task you're assigned to
async function sendCommentNotification({ toEmail, toName, taskKey, taskTitle, commenterName, commentText }) {
  const html = wrap('New Comment on Your Task 💬',
    p(`Hi ${toName},`) +
    p(`<strong style="color:#e8eaf0">${commenterName}</strong> commented on <strong style="color:#6c63ff">${taskTitle}</strong>:`) +
    `<div style="background:#1e2230;border:1px solid #2a2f42;border-left:3px solid #43d9ad;border-radius:8px;padding:14px 16px;margin:12px 0;font-size:14px;color:#8b90a7;line-height:1.6;font-style:italic;">
      "${commentText.length > 200 ? commentText.slice(0, 200) + '…' : commentText}"
    </div>` +
    btn('Reply', `${APP_URL}`)
  );
  await send(toEmail, `[ProjectFlow] New comment on ${taskKey}: ${taskTitle}`, html);
}

// Welcome email on registration
async function sendWelcome({ toEmail, toName }) {
  const html = wrap('Welcome to ProjectFlow! 🚀',
    p(`Hi ${toName},`) +
    p(`You've been added to the ProjectFlow workspace at <strong>CDOE · IFHE Hyderabad</strong>.`) +
    p(`You can now manage tasks, collaborate with your team, and track project progress — all in one place.`) +
    btn('Open ProjectFlow', `${APP_URL}`)
  );
  await send(toEmail, `Welcome to ProjectFlow – CDOE`, html);
}

module.exports = {
  sendTaskAssigned,
  sendDueSoonReminder,
  sendOverdueAlert,
  sendCommentNotification,
  sendWelcome,
};
