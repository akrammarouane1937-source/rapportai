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

// ─── Template builders ────────────────────────────────────────────────────────

function buildWelcomeEmail(data: {
  name:             string;
  is_founding_user: boolean;
}): { subject: string; html: string } {
  const foundingBlock = data.is_founding_user ? `
    <div style="background:#f0f7ff;border-left:4px solid #2563eb;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0;font-weight:600;color:#1e40af;">🎉 Vous êtes membre fondateur</p>
      <p style="margin:8px 0 0;color:#1e40af;">
        Vous faites partie des 20 premiers membres de RapportAI.
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
