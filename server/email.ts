// Email service using Resend - prioritizes RESEND_API_KEY env var, falls back to Replit connector
import { Resend } from 'resend';
import { resendBreaker } from './circuit-breaker';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@ogym.fitness';

async function getResendCredentials() {
  // Priority 1: Direct RESEND_API_KEY environment variable
  if (process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Using RESEND_API_KEY env var, FROM_EMAIL: ${FROM_EMAIL}`);
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: FROM_EMAIL
    };
  }

  // Priority 2: Replit Resend connector
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    return null;
  }

  try {
    const connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    if (!connectionSettings || !connectionSettings.settings?.api_key) {
      return null;
    }
    return {
      apiKey: connectionSettings.settings.api_key, 
      fromEmail: connectionSettings.settings.from_email || FROM_EMAIL
    };
  } catch (error) {
    console.error('Failed to get Resend credentials:', error);
    return null;
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const credentials = await getResendCredentials();
  
  // Fall back to dev mode if Resend not configured
  if (!credentials) {
    console.log("\n========================================");
    console.log("📧 DEV MODE EMAIL (Resend not configured)");
    console.log("----------------------------------------");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body: ${options.text}`);
    console.log("========================================\n");
    return true;
  }

  try {
    console.log(`[EMAIL] Sending email from: ${credentials.fromEmail} to: ${options.to}`);
    const result = await resendBreaker.execute(async () => {
      const resend = new Resend(credentials.apiKey);
      return resend.emails.send({
        from: credentials.fromEmail,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    });
    
    if (result.error) {
      console.error("[EMAIL] Resend API error:", JSON.stringify(result.error));
      return false;
    }
    
    console.log(`[EMAIL] Email sent successfully to ${options.to}, ID: ${result.data?.id}`);
    return true;
  } catch (error: any) {
    console.error("[EMAIL] Failed to send email:", error?.message || error);
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

export async function sendKioskOtpEmail(email: string, code: string, gymName: string): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Your Check-in Code for ${gymName}`,
    text: `Your check-in verification code for ${gymName} is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4f46e5;">Welcome to ${gymName}!</h2>
        <p>Your check-in verification code is:</p>
        <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">Thank you for visiting ${gymName}!</p>
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
