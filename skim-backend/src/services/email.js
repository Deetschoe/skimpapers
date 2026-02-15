const { Resend } = require('resend');

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('RESEND_API_KEY not set — emails will be logged to console');
    return null;
  }
  return new Resend(apiKey);
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'skim@resend.dev';

async function sendPasswordResetEmail(email, code) {
  const client = getClient();
  const subject = 'Skim — Password Reset Code';
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #C75B38; font-size: 28px; margin-bottom: 8px;">skim</h2>
      <p style="color: #666; margin-bottom: 24px;">Your password reset code:</p>
      <div style="background: #FAF9F5; border: 2px solid #E0DFDA; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1A1A1A;">${code}</span>
      </div>
      <p style="color: #9E9E99; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;

  if (!client) {
    console.log(`[EMAIL] Password reset for ${email}: code=${code}`);
    return;
  }

  await client.emails.send({ from: FROM_EMAIL, to: email, subject, html });
}

async function sendWaitlistConfirmation(email) {
  const client = getClient();
  const subject = 'Skim — You\'re on the waitlist!';
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #C75B38; font-size: 28px; margin-bottom: 8px;">skim</h2>
      <p style="color: #1A1A1A; margin-bottom: 16px;">You're on the waitlist!</p>
      <p style="color: #666;">We'll send you an access code when it's your turn. Research, distilled — coming soon.</p>
    </div>
  `;

  if (!client) {
    console.log(`[EMAIL] Waitlist confirmation for ${email}`);
    return;
  }

  await client.emails.send({ from: FROM_EMAIL, to: email, subject, html });
}

async function sendAccessCodeEmail(email, code) {
  const client = getClient();
  const subject = 'Skim — Your Access Code';
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #C75B38; font-size: 28px; margin-bottom: 8px;">skim</h2>
      <p style="color: #1A1A1A; margin-bottom: 16px;">You're in!</p>
      <p style="color: #666; margin-bottom: 24px;">Here's your access code to create your Skim account:</p>
      <div style="background: #FAF9F5; border: 2px solid #C75B38; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #C75B38;">${code}</span>
      </div>
      <p style="color: #9E9E99; font-size: 13px;">Open Skim and enter this code to get started.</p>
    </div>
  `;

  if (!client) {
    console.log(`[EMAIL] Access code for ${email}: code=${code}`);
    return;
  }

  await client.emails.send({ from: FROM_EMAIL, to: email, subject, html });
}

async function sendLoginCode(email, code) {
  const client = getClient();
  const subject = 'skim — Your Login Code';
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
      <h2 style="color: #C75B38; font-size: 28px; margin-bottom: 8px;">skim</h2>
      <p style="color: #666; margin-bottom: 24px;">Your login code:</p>
      <div style="background: #FAF9F5; border: 2px solid #E0DFDA; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1A1A1A;">${code}</span>
      </div>
      <p style="color: #9E9E99; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>
  `;

  if (!client) {
    console.log(`[EMAIL] Login code for ${email}: code=${code}`);
    return;
  }

  await client.emails.send({ from: FROM_EMAIL, to: email, subject, html });
}

module.exports = { sendPasswordResetEmail, sendWaitlistConfirmation, sendAccessCodeEmail, sendLoginCode };
