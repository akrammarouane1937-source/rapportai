import { Resend } from "resend";
import { logger } from "./logger";

// Password reset is handled by Clerk — no forgot-password route needed.
// This module covers: welcome (signup), report_ready (export trigger).

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not configured");
  return new Resend(key);
}

const FROM = "RapportAI <no-reply@rapportai.io>";
const APP_URL = process.env.APP_URL ?? "https://rapportai.io";
// Where student feedback lands. Override with ADMIN_EMAIL env var.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "akrammarouane1937@gmail.com";

// ─── Error alerts — so the admin SEES real-user errors without watching logs ──
// Throttled: max ALERT_CAP emails per rolling hour, so a crash loop can't spam.
const ALERT_CAP = 25;
let alertWindowStart = Date.now();
let alertCount = 0;

export async function sendErrorAlert(data: {
  context: string;          // where it failed, e.g. "generate:conclusion" or "client"
  message: string;          // the error text
  sessionId?: string;
  section?: string;
  url?: string;
  userAgent?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  // rolling-hour throttle
  const now = Date.now();
  if (now - alertWindowStart > 3_600_000) { alertWindowStart = now; alertCount = 0; }
  if (alertCount >= ALERT_CAP) return;
  alertCount += 1;

  const esc = (s: string) => (s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `🚨 Erreur RapportAI — ${esc(data.context).slice(0, 60)}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;">
        <h2 style="font-size:17px;color:#b91c1c;">Un utilisateur a rencontré une erreur</h2>
        <p style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px;font-size:14px;white-space:pre-wrap;">${esc(data.message)}</p>
        <table style="font-size:13px;color:#374151;border-collapse:collapse;">
          <tr><td style="padding:2px 10px 2px 0;color:#9ca3af;">Contexte</td><td>${esc(data.context)}</td></tr>
          ${data.section ? `<tr><td style="padding:2px 10px 2px 0;color:#9ca3af;">Section</td><td>${esc(data.section)}</td></tr>` : ""}
          ${data.sessionId ? `<tr><td style="padding:2px 10px 2px 0;color:#9ca3af;">Session</td><td>${esc(data.sessionId)}</td></tr>` : ""}
          ${data.url ? `<tr><td style="padding:2px 10px 2px 0;color:#9ca3af;">Page</td><td>${esc(data.url)}</td></tr>` : ""}
          ${data.userAgent ? `<tr><td style="padding:2px 10px 2px 0;color:#9ca3af;">Appareil</td><td>${esc(data.userAgent).slice(0, 120)}</td></tr>` : ""}
          <tr><td style="padding:2px 10px 2px 0;color:#9ca3af;">Heure</td><td>${new Date().toISOString()}</td></tr>
        </table>
      </div>`,
    });
    logger.info({ event: "error_alert_sent", context: data.context });
  } catch (err) {
    logger.error({ event: "error_alert_failed", error: String(err) });
  }
}

// ─── Feedback / Review — student submissions, emailed to the admin inbox ──────
// kind="review" carries a star rating; kind="feedback" is free-text. Never throws.
export async function sendFeedbackEmail(data: {
  message: string;
  email?: string;
  name?: string;
  page?: string;
  kind?: "feedback" | "review";
  rating?: number;
  school?: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn({ event: "feedback_email_skipped" }, "RESEND_API_KEY not set — skipping");
    return;
  }
  const esc = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const isReview = data.kind === "review";
  const stars = isReview && data.rating ? "★".repeat(Math.max(1, Math.min(5, data.rating))) : "";
  const who = `${data.name ? esc(data.name) : "Anonyme"}${data.school ? ` · ${esc(data.school)}` : ""}`;
  const subject = isReview
    ? `⭐ Avis (${data.rating ?? "?"}/5) — ${data.name ? esc(data.name) : "Anonyme"}`
    : `💬 Feedback RapportAI${data.name ? ` — ${esc(data.name)}` : ""}`;
  try {
    const resend = getResend();
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;">
        <h2 style="font-size:18px;">${isReview ? "Nouvel avis étudiant" : "Nouveau feedback étudiant"}</h2>
        ${stars ? `<p style="font-size:22px;color:#f59e0b;margin:0 0 8px;">${stars} <span style="color:#9ca3af;font-size:14px;">(${data.rating}/5)</span></p>` : ""}
        <p style="white-space:pre-wrap;background:#f9fafb;border-radius:8px;padding:16px;font-size:15px;line-height:1.6;">${esc(data.message)}</p>
        <p style="font-size:13px;color:#6b7280;">
          De : ${who}${data.email ? ` &lt;${esc(data.email)}&gt;` : ""}<br>
          Page : ${data.page ? esc(data.page) : "—"}
        </p>
        ${isReview ? `<p style="font-size:12px;color:#9ca3af;">Pour l'afficher sur la landing, copie : { name: "${data.name ? esc(data.name) : "Anonyme"}", school: "${data.school ? esc(data.school) : ""}", rating: ${data.rating ?? 5}, text: "${esc(data.message).replace(/"/g, "'")}" }</p>` : ""}
      </div>`,
    });
    logger.info({ event: isReview ? "review_email_sent" : "feedback_email_sent" });
  } catch (err) {
    logger.error({ event: "feedback_email_failed", error: String(err) });
  }
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildWelcomeEmail(data: {
  name:             string;
  is_founding_user: boolean;
}): { subject: string; html: string } {
  const foundingBlock = data.is_founding_user ? `
    <div style="background:#f0f7ff;border-left:4px solid #2563eb;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0;font-weight:600;color:#1e40af;">🎉 Vous êtes membre fondateur</p>
      <p style="margin:8px 0 0;color:#1e40af;">
        Vous faites partie des 30 premiers membres de RapportAI.
        Accès Pro illimité offert à vie, sans conditions.
      </p>
    </div>` : "";

  return {
    subject: "Bienvenue sur RapportAI 👋",
    html: `<!DOCTYPE html>
<html>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
  <img src="${APP_URL}/logo.png" alt="RapportAI" height="40" style="margin-bottom:32px;">
  <h1 style="font-size:24px;font-weight:700;margin:0 0 8px;">Bonjour ${data.name} 👋</h1>
  <p style="font-size:16px;color:#444;line-height:1.6;">
    Bienvenue sur RapportAI. Vous êtes maintenant prêt à générer votre rapport académique en quelques minutes.
  </p>
  ${foundingBlock}
  <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;">
    <p style="margin:0 0 12px;font-weight:600;">Comment commencer :</p>
    <p style="margin:0 0 8px;color:#444;">1. Cliquez sur "Nouveau rapport"</p>
    <p style="margin:0 0 8px;color:#444;">2. Remplissez les informations de votre rapport</p>
    <p style="margin:0 0 8px;color:#444;">3. Validez le plan proposé</p>
    <p style="margin:0;color:#444;">4. Téléchargez votre rapport en Word ou PDF</p>
  </div>
  <a href="${APP_URL}/dashboard"
     style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;">
    Créer mon premier rapport
  </a>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:13px;color:#9ca3af;margin:0;">
    RapportAI, votre assistant pour les rapports académiques<br>
    Des questions ? Répondez directement à cet email.
  </p>
</body>
</html>`,
  };
}

function buildReportReadyEmail(data: {
  name:           string;
  report_subject: string;
  report_id:      string;
  word_count:     number;
  sections_count: number;
}): { subject: string; html: string } {
  const wordCountFr = data.word_count.toLocaleString("fr-FR");

  return {
    subject: `✅ Votre rapport est prêt : ${data.report_subject}`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
  <img src="${APP_URL}/logo.png" alt="RapportAI" height="40" style="margin-bottom:32px;">
  <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
    <p style="font-size:40px;margin:0 0 8px;">✅</p>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#166534;">Votre rapport est prêt !</h1>
    <p style="margin:0;color:#15803d;font-size:15px;">${data.report_subject}</p>
  </div>
  <p style="font-size:16px;color:#444;line-height:1.6;">
    Bonjour ${data.name},<br><br>
    Votre rapport académique a été généré avec succès. Vous pouvez le consulter, le modifier et le télécharger maintenant.
  </p>
  <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:20px 0;">
    <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Résumé de votre rapport :</p>
    <p style="margin:0 0 6px;color:#666;font-size:14px;">📄 ${data.sections_count} sections générées</p>
    <p style="margin:0 0 6px;color:#666;font-size:14px;">✍️ ${wordCountFr} mots</p>
    <p style="margin:0;color:#666;font-size:14px;">🤖 Contenu humanisé pour un rendu naturel</p>
  </div>
  <a href="${APP_URL}/report/${data.report_id}"
     style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px;margin-bottom:24px;">
    Voir et télécharger mon rapport
  </a>
  <div style="background:#fafafa;border-radius:8px;padding:16px;margin-bottom:24px;">
    <p style="margin:0 0 8px;font-weight:600;font-size:14px;">Avant de soumettre :</p>
    <p style="margin:0 0 6px;color:#666;font-size:14px;">✏️ Relisez et personnalisez chaque section</p>
    <p style="margin:0 0 6px;color:#666;font-size:14px;">📊 Ajoutez vos figures et tableaux personnels</p>
    <p style="margin:0;color:#666;font-size:14px;">👨‍🏫 Partagez avec votre encadrant pour validation</p>
  </div>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;">
  <p style="font-size:13px;color:#9ca3af;margin:0;">
    RapportAI, votre assistant pour les rapports académiques<br>
    Des questions ? Répondez directement à cet email.
  </p>
</body>
</html>`,
  };
}

// ─── Template registry ────────────────────────────────────────────────────────

type EmailTemplate = "welcome" | "report_ready";

type EmailData = {
  welcome:      { name: string; is_founding_user: boolean };
  report_ready: Parameters<typeof buildReportReadyEmail>[0];
};

// ─── sendEmail — never throws, logs and continues on failure ─────────────────

export async function sendEmail<T extends EmailTemplate>(
  to:       string,
  template: T,
  data:     EmailData[T],
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn({ event: "email_skipped", template, to }, "RESEND_API_KEY not set — skipping");
    return;
  }

  let subject: string;
  let html: string;

  if (template === "welcome") {
    ({ subject, html } = buildWelcomeEmail(data as EmailData["welcome"]));
  } else {
    ({ subject, html } = buildReportReadyEmail(data as EmailData["report_ready"]));
  }

  try {
    const resend = getResend();
    await resend.emails.send({ from: FROM, to, subject, html });
    logger.info({ event: "email_sent", template, to });
  } catch (err) {
    // Never crash if email fails
    logger.error({ event: "email_failed", template, to, error: String(err) });
  }
}
