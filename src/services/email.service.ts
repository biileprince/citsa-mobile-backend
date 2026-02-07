import nodemailer from "nodemailer";
import { google } from "googleapis";
import config from "../config/index.js";
import logger from "../utils/logger.js";

// Email transport type
type TransportType = "gmail-api" | "smtp" | "none";
let activeTransport: TransportType = "none";

// Create Gmail API transporter (preferred)
let gmailTransporter: nodemailer.Transporter | null = null;

// Create SMTP transporter (fallback)
let smtpTransporter: nodemailer.Transporter | null = null;

/**
 * Initialize Gmail API OAuth2 transporter
 */
async function createGmailTransporter(): Promise<nodemailer.Transporter | null> {
  try {
    const { clientId, clientSecret, refreshToken, fromEmail } = config.gmail;

    if (!clientId || !clientSecret || !refreshToken || !fromEmail) {
      return null;
    }

    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      clientId,
      clientSecret,
      "https://developers.google.com/oauthplayground" // Redirect URI (not used for server)
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Get access token (auto-refreshes when needed)
    const accessToken = await oauth2Client.getAccessToken();

    if (!accessToken.token) {
      logger.error("Failed to get Gmail OAuth2 access token");
      return null;
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: fromEmail,
        clientId,
        clientSecret,
        refreshToken,
        accessToken: accessToken.token,
      },
    } as any);

    logger.info(`📧 Gmail API configured: ${fromEmail}`);
    return transporter;
  } catch (error) {
    logger.error("Failed to create Gmail API transporter:", error);
    return null;
  }
}

/**
 * Initialize SMTP transporter (fallback)
 */
function createSmtpTransporter(): nodemailer.Transporter | null {
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
}

/**
 * Initialize email transporters (Gmail API preferred, SMTP fallback)
 */
async function initializeTransports() {
  // Try Gmail API first (preferred)
  gmailTransporter = await createGmailTransporter();
  if (gmailTransporter) {
    activeTransport = "gmail-api";
    logger.info("✅ Email transport: Gmail API (OAuth2)");
    return;
  }

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
}

// Initialize on module load
initializeTransports();

/**
 * Get active transporter
 */
function getTransporter(): nodemailer.Transporter | null {
  if (activeTransport === "gmail-api") return gmailTransporter;
  if (activeTransport === "smtp") return smtpTransporter;
  return null;
}

/**
 * Get sender info based on active transport
 */
function getSenderInfo(): { name: string; email: string } {
  if (activeTransport === "gmail-api") {
    return {
      name: config.gmail.fromName,
      email: config.gmail.fromEmail,
    };
  }
  return {
    name: config.smtp.fromName,
    email: config.smtp.fromEmail,
  };
}

/**
 * Send OTP email to user
 */
export async function sendOtpEmail(
  email: string,
  otpCode: string,
): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      logger.error("No email transporter available");
      return false;
    }

    const sender = getSenderInfo();

    const mailOptions = {
      from: `"${sender.name}" <${sender.email}>`,
      to: email,
      subject: "Your CITSA App Verification Code",
      html: `
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
      `,
      text: `Your CITSA App verification code is: ${otpCode}. This code expires in ${Math.floor(config.otp.expirySeconds / 60)} minutes.`,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(
      `OTP email sent to ${email} via ${activeTransport}: ${info.messageId}`,
    );
    return true;
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
    const transporter = getTransporter();
    if (!transporter) {
      logger.error("No email transporter available");
      return false;
    }

    const sender = getSenderInfo();

    const mailOptions = {
      from: `"${sender.name}" <${sender.email}>`,
      to: email,
      subject: "Welcome to CITSA App! 🎉",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a2e; margin: 0;">Welcome to CITSA! 🎉</h1>
            </div>
            
            <div style="padding: 20px;">
              <p style="color: #333; font-size: 16px;">Hi ${fullName},</p>
              
              <p style="color: #666; line-height: 1.6;">
                Welcome to the CITSA Student App! We're excited to have you join our community of 
                Computer and IT students.
              </p>
              
              <p style="color: #666; line-height: 1.6;">
                With the CITSA App, you can:
              </p>
              
              <ul style="color: #666; line-height: 1.8;">
                <li>📢 Stay updated with announcements and news</li>
                <li>📅 Register for events and activities</li>
                <li>👥 Join clubs and groups</li>
                <li>📚 Access your classroom timetable and quizzes</li>
                <li>💼 Discover opportunities and resources</li>
              </ul>
              
              <p style="color: #666; line-height: 1.6;">
                Get started by exploring the app and connecting with your fellow students!
              </p>
            </div>
            
            <div style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
              <p>© ${new Date().getFullYear()} CITSA - Computer & IT Students Association</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${fullName}, Welcome to the CITSA Student App! We're excited to have you join our community.`,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Welcome email sent to ${email} via ${activeTransport}`);
    return true;
  } catch (error) {
    logger.error("Failed to send welcome email:", error);
    return false;
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
    const transporter = getTransporter();
    if (!transporter) {
      logger.error("No email transporter available");
      return false;
    }

    const sender = getSenderInfo();

    const mailOptions = {
      from: `"${sender.name}" <${sender.email}>`,
      to: email,
      subject: `Reminder: ${eventTitle} is tomorrow! 📅`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px;">
            <h1 style="color: #1a1a2e; text-align: center;">Event Reminder 📅</h1>
            
            <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; margin: 20px 0;">
              <p style="color: #333;">Hi ${fullName},</p>
              
              <p style="color: #666;">This is a friendly reminder that you're registered for:</p>
              
              <h2 style="color: #1a1a2e;">${eventTitle}</h2>
              
              <div style="margin: 20px 0;">
                <p style="color: #666; margin: 8px 0;">📅 <strong>Date:</strong> ${eventDate}</p>
                <p style="color: #666; margin: 8px 0;">⏰ <strong>Time:</strong> ${eventTime}</p>
                <p style="color: #666; margin: 8px 0;">📍 <strong>Location:</strong> ${location}</p>
              </div>
              
              <p style="color: #666;">We look forward to seeing you there!</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(
      `Event reminder sent to ${email} for ${eventTitle} via ${activeTransport}`,
    );
    return true;
  } catch (error) {
    logger.error("Failed to send event reminder email:", error);
    return false;
  }
}

/**
 * Verify email connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) {
      logger.warn("No email transporter available for verification");
      return false;
    }

    // Gmail API doesn't support verify(), so we'll just check if transporter exists
    if (activeTransport === "gmail-api") {
      logger.info("Gmail API transporter ready (verification skipped - OAuth2)");
      return true;
    }

    // For SMTP, actually verify the connection
    await transporter.verify();
    logger.info("SMTP connection verified successfully");
    return true;
  } catch (error) {
    logger.error("Email connection verification failed:", error);
    return false;
  }
}

export default {
  initializeTransports,
  sendOtpEmail,
  sendWelcomeEmail,
  sendEventReminderEmail,
  verifyEmailConnection,
};
