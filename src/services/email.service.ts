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

    const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verification Code</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a2e; margin: 0;">CITSA App</h1>
              <p style="color: #666; margin-top: 5px;">Computer & IT Students Association</p>
            </div>
            
            <div style="background-color: #f8f9fa; border-radius: 10px; padding: 30px; text-align: center;">
              <h2 style="color: #333; margin-top: 0;">Your Verification Code</h2>
              <p style="color: #666; margin-bottom: 20px;">Enter this code to verify your identity:</p>
              
              <div style="background-color: #1a1a2e; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff;">${otpCode}</span>
              </div>
              
              <p style="color: #dc3545; font-size: 14px; margin-top: 20px;">
                ⏱️ This code expires in ${Math.floor(config.otp.expirySeconds / 60)} minutes
              </p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
              <p>If you didn't request this code, please ignore this email.</p>
              <p style="margin-top: 20px;">
                © ${new Date().getFullYear()} CITSA - Computer & IT Students Association
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

    const textBody = `Your CITSA App verification code is: ${otpCode}. This code expires in ${Math.floor(config.otp.expirySeconds / 60)} minutes.`;

    const result = await sendEmail(
      email,
      "Your CITSA App Verification Code",
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

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CITSA</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Welcome to CITSA!</h1>
            <p style="color: #666; margin-top: 5px;">Computer & IT Students Association</p>
          </div>
          <div style="padding: 20px;">
            <p style="color: #333; font-size: 16px;">Hi ${fullName},</p>
            <p style="color: #666;">Welcome to the CITSA community! You're now part of a vibrant network of Computer & IT students.</p>
            <p style="color: #666;">Explore events, connect with peers, and stay updated with the latest happenings.</p>
          </div>
          <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} CITSA - Computer & IT Students Association</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `Hi ${fullName}, welcome to CITSA! You're now part of our community.`;

    return await sendEmail(email, "Welcome to CITSA!", htmlBody, textBody);
  } catch (error) {
    logger.error("Failed to send welcome email:", error);
    return true; // Don't fail registration
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
      logger.warn(`Resend not available - skipping event reminder for ${email}`);
      return true;
    }

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Reminder</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a2e; margin: 0;">Event Reminder</h1>
            <p style="color: #666; margin-top: 5px;">CITSA App</p>
          </div>
          <div style="padding: 20px;">
            <p style="color: #333; font-size: 16px;">Hi ${fullName},</p>
            <p style="color: #666;">This is a reminder for an upcoming event:</p>
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1a1a2e; margin-top: 0;">${eventTitle}</h3>
              <p style="color: #666; margin: 5px 0;">📅 ${eventDate} at ${eventTime}</p>
              <p style="color: #666; margin: 5px 0;">📍 ${location}</p>
            </div>
          </div>
          <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
            <p>© ${new Date().getFullYear()} CITSA - Computer & IT Students Association</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textBody = `Hi ${fullName}, reminder: ${eventTitle} on ${eventDate} at ${eventTime}, ${location}.`;

    return await sendEmail(email, `Reminder: ${eventTitle}`, htmlBody, textBody);
  } catch (error) {
    logger.error("Failed to send event reminder email:", error);
    return true; // Don't fail event registration
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
