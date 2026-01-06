import nodemailer from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const emailProvider = process.env.EMAIL_PROVIDER || "dev";

let transporter: nodemailer.Transporter | null = null;

if (emailProvider === "smtp") {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (emailProvider === "dev" || !transporter) {
    console.log("\n========================================");
    console.log("📧 DEV MODE EMAIL (not actually sent)");
    console.log("----------------------------------------");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body: ${options.text}`);
    console.log("========================================\n");
    return true;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@ogym.app",
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function getOTPExpiryTime(): Date {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 10);
  return expiry;
}

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Verify your OGym account",
    text: `Your OGym verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">OGym Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: "Reset your OGym password",
    text: `Your OGym password reset code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, you can safely ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">OGym Password Reset</h2>
        <p>You requested to reset your password. Use this code to continue:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
    `,
  });
}
