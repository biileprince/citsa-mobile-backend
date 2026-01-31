import nodemailer from "nodemailer";
import config from "../config/index.js";
import logger from "../utils/logger.js";

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.secure,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.password,
  },
});

/**
 * Send OTP email to user
 */
export async function sendOtpEmail(
  email: string,
  otpCode: string,
): Promise<boolean> {
  try {
    const mailOptions = {
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
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
    logger.info(`OTP email sent to ${email}: ${info.messageId}`);
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
    const mailOptions = {
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
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
    logger.info(`Welcome email sent to ${email}`);
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
    const mailOptions = {
      from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
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
    logger.info(`Event reminder sent to ${email} for ${eventTitle}`);
    return true;
  } catch (error) {
    logger.error("Failed to send event reminder email:", error);
    return false;
  }
}

/**
 * Verify SMTP connection
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    logger.info("SMTP connection verified successfully");
    return true;
  } catch (error) {
    logger.error("SMTP connection failed:", error);
    return false;
  }
}

export default {
  sendOtpEmail,
  sendWelcomeEmail,
  sendEventReminderEmail,
  verifyEmailConnection,
};
