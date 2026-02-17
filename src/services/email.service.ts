import { Resend } from "resend";
import config from "../config/index.js";
import logger from "../utils/logger.js";

let resendClient: Resend | null = null;
let isReady = false;

/**
 * Initialize Resend email client
 */
async function initializeTransports() {
  const { apiKey, fromEmail } = config.resend;

  if (!apiKey) {
    logger.error("❌ Resend API key not configured - emails will not work!");
    logger.error("Required env var: RESEND_API_KEY");
    isReady = false;
    return;
  }

  resendClient = new Resend(apiKey);
  isReady = true;
  logger.info(`✅ Email transport: Resend API (from: ${fromEmail})`);
}

// Initialize on module load
initializeTransports();

/**
 * Send email via Resend
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  try {
    if (!resendClient || !isReady) {
      logger.error("Resend client not initialized");
      return false;
    }

    const { data, error } = await resendClient.emails.send({
      from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
    });

    if (error) {
      logger.error("Resend API error:", error);
      return false;
    }

    logger.info(`Email sent via Resend to ${to}: ${data?.id}`);
    return true;
  } catch (error) {
    logger.error("Failed to send email via Resend:", error);
    return false;
  }
}

/**
 * Shared email layout wrapper
 */
function emailLayout(content: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>CITSA</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #e4e4e7;">
              <span style="font-size:20px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">CITSA</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">&copy; ${year} CITSA &mdash; Computer &amp; IT Students Association</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send OTP email to user
 */
export async function sendOtpEmail(
  email: string,
  otpCode: string,
): Promise<boolean> {
  try {
    if (!isReady) {
      logger.error("Resend not available - cannot send OTP email");
      return false;
    }

    const expiryMin = Math.floor(config.otp.expirySeconds / 60);

    const content = `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">Enter the following code to verify your identity.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:20px 0;">
            <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:6px;color:#18181b;background-color:#f4f4f5;padding:16px 32px;border-radius:8px;border:1px solid #e4e4e7;">${otpCode}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">This code expires in ${expiryMin} minute${expiryMin !== 1 ? "s" : ""}. If you didn't request this, you can safely ignore this email.</p>`;

    const htmlBody = emailLayout(content);
    const textBody = `Your verification code is: ${otpCode}\n\nThis code expires in ${expiryMin} minute${expiryMin !== 1 ? "s" : ""}. If you didn't request this, you can safely ignore this email.`;

    const result = await sendEmail(
      email,
      `${otpCode} is your verification code`,
      htmlBody,
      textBody,
    );

    if (result) {
      logger.info(`OTP email sent to ${email} via Resend`);
    }

    return result;
  } catch (error) {
    logger.error("Failed to send OTP email:", error);
    return false;
  }
}

/**
 * Send welcome email after registration
 */
export async function sendWelcomeEmail(
  email: string,
  fullName: string,
): Promise<boolean> {
  try {
    if (!isReady) {
      logger.warn(`Resend not available - skipping welcome email for ${email}`);
      return true;
    }

    const firstName = fullName.split(" ")[0];

    const content = `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">Your account has been created. You're now part of the CITSA community.</p>
      <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.6;">Open the app to explore events, connect with peers, and stay in the loop.</p>`;

    const htmlBody = emailLayout(content);
    const textBody = `Hi ${firstName},\n\nYour account has been created. You're now part of the CITSA community.\n\nOpen the app to explore events, connect with peers, and stay in the loop.`;

    return await sendEmail(email, "Welcome to CITSA", htmlBody, textBody);
  } catch (error) {
    logger.error("Failed to send welcome email:", error);
    return true;
  }
}

/**
 * Send event reminder email
 */
export async function sendEventReminderEmail(
  email: string,
  fullName: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  location: string,
): Promise<boolean> {
  try {
    if (!isReady) {
      logger.warn(
        `Resend not available - skipping event reminder for ${email}`,
      );
      return true;
    }

    const firstName = fullName.split(" ")[0];

    const content = `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">Reminder for your upcoming event:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background-color:#f4f4f5;border-radius:6px;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#18181b;">${eventTitle}</p>
            <p style="margin:0 0 4px;font-size:14px;color:#52525b;">${eventDate} at ${eventTime}</p>
            <p style="margin:0;font-size:14px;color:#52525b;">${location}</p>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">Open the app for more details.</p>`;

    const htmlBody = emailLayout(content);
    const textBody = `Hi ${firstName},\n\nReminder: ${eventTitle}\n${eventDate} at ${eventTime}\n${location}`;

    return await sendEmail(
      email,
      `Reminder: ${eventTitle}`,
      htmlBody,
      textBody,
    );
  } catch (error) {
    logger.error("Failed to send event reminder email:", error);
    return true;
  }
}

/**
 * Verify email connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    if (isReady && resendClient) {
      logger.info("Resend API client ready");
      return true;
    }

    logger.error("Resend not configured");
    return false;
  } catch (error) {
    logger.error("Email connection verification failed:", error);
    return false;
  }
}

// Export functions individually for named imports
export { initializeTransports };

export default {
  initializeTransports,
  sendOtpEmail,
  sendWelcomeEmail,
  sendEventReminderEmail,
  verifyEmailConnection,
};
