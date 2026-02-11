import nodemailer from "nodemailer";
import { google } from "googleapis";
import config from "../config/index.js";
import logger from "../utils/logger.js";

// Email transport type
type TransportType = "gmail-api" | "smtp" | "none";
let activeTransport: TransportType = "none";

// Gmail API client (preferred)
let gmailClient: any = null;
let gmailAuth: any = null;

// Create SMTP transporter (fallback - DISABLED)
let smtpTransporter: nodemailer.Transporter | null = null;

/**
 * Initialize Gmail API client using googleapis
 */
async function createGmailClient(): Promise<any> {
  try {
    const { clientId, clientSecret, refreshToken, fromEmail } = config.gmail;

    if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
      logger.warn("Gmail API credentials not configured");
      return null;
    }

    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      "https://developers.google.com/oauthplayground",
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Test that we can get an access token
    const accessToken = await oauth2Client.getAccessToken();
    if (!accessToken.token) {
      logger.error("Failed to get Gmail OAuth2 access token");
      return null;
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    logger.info(`📧 Gmail API configured: ${fromEmail}`);
    return { gmail, auth: oauth2Client, fromEmail };
  } catch (error) {
    logger.error("Failed to create Gmail API client:", error);
    return null;
  }
}

/**
 * Initialize SMTP transporter (fallback - DISABLED FOR DEBUGGING)
 */
function createSmtpTransporter(): nodemailer.Transporter | null {
  // SMTP DISABLED - Gmail API only
  logger.warn("⚠️ SMTP transport disabled - using Gmail API only");
  return null;

  /* SMTP CODE COMMENTED OUT
  try {
    const { host, port, user, password } = config.smtp;

    if (!host || !user || !password) {
      return null;
    }

    const isImplicitSSL = port === 465;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isImplicitSSL,
      auth: {
        user,
        pass: password,
      },
      tls: {
        rejectUnauthorized: false,
        minVersion: "TLSv1.2",
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
      ...(!isImplicitSSL && port === 587 ? { requireTLS: true } : {}),
    });

    logger.info(
      `📧 SMTP configured: ${host}:${port} (${isImplicitSSL ? "SSL" : "STARTTLS"})`,
    );
    return transporter;
  } catch (error) {
    logger.error("Failed to create SMTP transporter:", error);
    return null;
  }
  */
}

/**
 * Initialize email transporters (Gmail API only)
 */
async function initializeTransports() {
  // Try Gmail API (ONLY option now)
  gmailClient = await createGmailClient();
  gmailAuth = gmailClient?.auth;

  if (gmailClient) {
    activeTransport = "gmail-api";
    logger.info("✅ Email transport: Gmail API (OAuth2 direct)");
    return;
  }

  // NO SMTP FALLBACK - Force Gmail API
  logger.error("❌ Gmail API not configured - emails will not work!");
  logger.error(
    "Required env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_FROM_EMAIL",
  );
  activeTransport = "none";

  /* SMTP FALLBACK DISABLED
  // Fallback to SMTP
  smtpTransporter = createSmtpTransporter();
  if (smtpTransporter) {
    activeTransport = "smtp";
    logger.info("✅ Email transport: SMTP (fallback)");
    return;
  // NO SMTP FALLBACK - Force Gmail API
  logger.error("❌ Gmail API not configured - emails will not work!");
  logger.error("Required env vars: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_FROM_EMAIL");
  activeTransport = "none";
  
  /* SMTP FALLBACK DISABLED
  // Fallback to SMTP
  smtpTransporter = createSmtpTransporter();
  if (smtpTransporter) {
    activeTransport = "smtp";
    logger.info("✅ Email transport: SMTP (fallback)");
    return;
  }

  // No transport available
  activeTransport = "none";
  logger.warn("⚠️ No email transport configured - emails will not be sent");
  */
}

// Initialize on module load
initializeTransports();

/**
 * Create email MIME message
 */
function createEmailMime(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
): string {
  const from = `"${config.gmail.fromName}" <${config.gmail.fromEmail}>`;

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    htmlBody,
  ];

  const message = messageParts.join("\n");

  // Encode to base64url
  const encodedMessage = Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return encodedMessage;
}

/**
 * Send email using Gmail API directly
 */
async function sendViaGmailAPI(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string,
): Promise<boolean> {
  try {
    if (!gmailClient || !gmailClient.gmail) {
      logger.error("Gmail API client not initialized");
      return false;
    }

    const raw = createEmailMime(to, subject, htmlBody, textBody);

    const result = await gmailClient.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: raw,
      },
    });

    logger.info(
      `Email sent successfully via Gmail API to ${to}: ${result.data.id}`,
    );
    return true;
  } catch (error) {
    logger.error("Failed to send email via Gmail API:", error);
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
    if (activeTransport !== "gmail-api") {
      logger.error("Gmail API not available - cannot send OTP email");
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

    const result = await sendViaGmailAPI(
      email,
      "Your CITSA App Verification Code",
      htmlBody,
      textBody,
    );

    if (result) {
      logger.info(`OTP email sent to ${email} via Gmail API`);
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
/**
 * Send welcome email after registration (Gmail API implementation pending)
 */
export async function sendWelcomeEmail(
  email: string,
  fullName: string,
): Promise<boolean> {
  logger.warn(
    `Welcome email not implemented yet for ${email} (Gmail API only mode)`,
  );
  // TODO: Implement with sendViaGmailAPI
  return true; // Don't fail registration if welcome email doesn't send
}

/**
 * Send event reminder email (Gmail API implementation pending)
 */
export async function sendEventReminderEmail(
  email: string,
  fullName: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string,
  location: string,
): Promise<boolean> {
  logger.warn(
    `Event reminder email not implemented yet for ${email} (Gmail API only mode)`,
  );
  // TODO: Implement with sendViaGmailAPI
  return true; // Don't fail event registration if reminder doesn't send
}

/**
 * Verify email connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    // Gmail API - just check if client is initialized
    if (activeTransport === "gmail-api" && gmailClient) {
      logger.info("Gmail API client ready (OAuth2 verified)");
      return true;
    }

    if (activeTransport === "none") {
      logger.error("No email transport configured");
      return false;
    }

    logger.warn("Unknown transport type");
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
