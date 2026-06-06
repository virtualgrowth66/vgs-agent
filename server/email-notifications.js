/**
 * SiteMind AI — Email Notification System
 * 
 * Sends conversation summaries, booking confirmations, and follow-up
 * emails to the business owner and their customers.
 * 
 * Supports:
 * - Gmail (SMTP with App Password)
 * - Outlook (SMTP with OAuth2)
 * - Custom SMTP (any provider)
 * - Dev mode (logs to console, no sending)
 */

const nodemailer = require('nodemailer');

// ═════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═════════════════════════════════════════════════════════════════

const CONFIG = {
  // Email provider: 'gmail' | 'outlook' | 'smtp' | 'dev'
  provider: process.env.EMAIL_PROVIDER || 'dev',

  // Business owner's notification email (where all leads go)
  notificationEmail: process.env.NOTIFICATION_EMAIL || '',
  
  // Sender name displayed in emails
  senderName: process.env.EMAIL_SENDER_NAME || 'SiteMind AI',
  senderEmail: process.env.EMAIL_SENDER_EMAIL || 'noreply@sitemind.ai',

  // SMTP settings (used for 'smtp' provider or as fallback)
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  // Gmail (uses SMTP with App Password)
  gmail: {
    user: process.env.GMAIL_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || '',
  },

  // Outlook (uses SMTP with OAuth2 or App Password)
  outlook: {
    user: process.env.OUTLOOK_EMAIL_USER || '',
    pass: process.env.OUTLOOK_EMAIL_PASS || '',
  },

  // Follow-up settings
  followUp: {
    enabled: process.env.EMAIL_FOLLOW_UP_ENABLED !== 'false',
    delayHours: parseInt(process.env.EMAIL_FOLLOW_UP_HOURS) || 24,
    reminderBeforeHours: parseInt(process.env.EMAIL_REMINDER_BEFORE_HOURS) || 2,
  },

  // Business info for email signatures
  business: {
    name: process.env.BUSINESS_NAME || 'SiteMind',
    address: process.env.BUSINESS_ADDRESS || '',
    phone: process.env.BUSINESS_PHONE || '',
    website: process.env.BUSINESS_WEBSITE || '',
  },
};

// ═════════════════════════════════════════════════════════════════
//  TRANSPORTER
// ═════════════════════════════════════════════════════════════════

let transporter = null;

function createTransporter() {
  if (transporter) return transporter;

  switch (CONFIG.provider) {
    case 'gmail':
      if (!CONFIG.gmail.user || !CONFIG.gmail.pass) {
        console.warn('[Email] Gmail not configured — set GMAIL_USER and GMAIL_APP_PASSWORD');
        return null;
      }
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: CONFIG.gmail.user, pass: CONFIG.gmail.pass },
      });
      break;

    case 'outlook':
      if (!CONFIG.outlook.user || !CONFIG.outlook.pass) {
        console.warn('[Email] Outlook not configured — set OUTLOOK_EMAIL_USER and OUTLOOK_EMAIL_PASS');
        return null;
      }
      transporter = nodemailer.createTransport({
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
        auth: { user: CONFIG.outlook.user, pass: CONFIG.outlook.pass },
      });
      break;

    case 'smtp':
      if (!CONFIG.smtp.host || !CONFIG.smtp.user) {
        console.warn('[Email] SMTP not fully configured — set SMTP_HOST and SMTP_USER');
        return null;
      }
      transporter = nodemailer.createTransport({
        host: CONFIG.smtp.host,
        port: CONFIG.smtp.port,
        secure: CONFIG.smtp.secure,
        auth: { user: CONFIG.smtp.user, pass: CONFIG.smtp.pass },
      });
      break;

    case 'dev':
    default:
      // Dev mode: use a streaming transport that logs to console
      transporter = nodemailer.createTransport({
        name: 'dev',
        version: '1.0.0',
        send: (mail, callback) => {
          console.log(`\n[Email DEV] ──────────────────────────────`);
          console.log(`  To:      ${mail.data.to}`);
          console.log(`  Subject: ${mail.data.subject}`);
          console.log(`  Body:    ${mail.data.html ? mail.data.html.replace(/<[^>]+>/g, '').trim().slice(0, 300) : mail.data.text?.slice(0, 300)}`);
          console.log(`──────────────────────────────────────\n`);
          callback(null, { messageId: 'dev-' + Date.now() + '@sitemind.dev' });
        },
      });
      break;
  }

  return transporter;
}

// ═════════════════════════════════════════════════════════════════
//  EMAIL TEMPLATES
// ═════════════════════════════════════════════════════════════════

function emailLayout(title, bodyContent, { recipientName = '' } = {}) {
  const businessName = CONFIG.business.name;
  const year = new Date().getFullYear();
  
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${businessName}</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">AI Sales Agent</p>
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <h2 style="margin:0;color:#1f2937;font-size:18px;font-weight:600;">${title}</h2>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 32px 24px;color:#4b5563;font-size:14px;line-height:1.7;">
              ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                ${CONFIG.business.name} · ${CONFIG.business.website || 'SiteMind AI'}<br>
                ${CONFIG.business.address ? CONFIG.business.address + ' · ' : ''}
                © ${year} All rights reserved.
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:11px;">
                This is an automated message from your SiteMind AI sales agent.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Booking confirmation email body */
function bookingConfirmationBody(name, contact, date, time, service, notes = '') {
  return `
    <p>A new booking has been confirmed through your website!</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;">
      <tr><td width="100" style="color:#6b7280;font-size:13px;">Name</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(name)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Contact</td><td style="font-weight:600;color:#1f2937;"><a href="mailto:${escapeHtml(contact)}" style="color:#6366f1;">${escapeHtml(contact)}</a></td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Date</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(date)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Time</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(time)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Service</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(service || 'General')}</td></tr>
    </table>
    ${notes ? `<p style="color:#6b7280;font-size:13px;font-style:italic;">Notes: ${escapeHtml(notes)}</p>` : ''}
    <p style="margin-top:16px;">You can reply to this email to contact the customer directly, or check your calendar for the event details.</p>
  `;
}

/** Customer booking confirmation body */
function customerConfirmationBody(name, date, time, service, businessName) {
  return `
    <p>Thank you for booking with ${escapeHtml(businessName)}!</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f0fdf4;border-radius:8px;margin:16px 0;">
      <tr><td width="100" style="color:#6b7280;font-size:13px;">Date</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(date)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Time</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(time)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Service</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(service || 'Appointment')}</td></tr>
    </table>
    <p>If you need to reschedule or have any questions, please reply to this email or contact us directly.</p>
    <p style="margin-top:16px;color:#6b7280;">We look forward to seeing you! 😊</p>
  `;
}

/** New lead / conversation summary body */
function leadSummaryBody(contactName, contactInfo, summary, source) {
  return `
    <p>A new visitor interacted with your AI agent on your website!</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8f9fb;border-radius:8px;margin:16px 0;">
      <tr><td width="100" style="color:#6b7280;font-size:13px;">Name</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(contactName || 'Unknown')}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Contact</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(contactInfo || 'Not provided')}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Source</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(source || 'Website Widget')}</td></tr>
    </table>
    ${summary ? `<p style="margin-top:8px;color:#4b5563;"><strong>Conversation Summary:</strong></p><p style="color:#4b5563;background:#f8f9fb;padding:12px;border-radius:6px;">${escapeHtml(summary)}</p>` : ''}
    <p style="margin-top:16px;">This lead was captured by your SiteMind AI agent and is ready for follow-up.</p>
  `;
}

/** Booking reminder body */
function reminderBody(name, date, time, service, businessName) {
  return `
    <p>Hi ${escapeHtml(name)},</p>
    <p>This is a friendly reminder about your upcoming appointment!</p>
    <table width="100%" cellpadding="8" cellspacing="0" style="background:#f0fdf4;border-radius:8px;margin:16px 0;">
      <tr><td width="100" style="color:#6b7280;font-size:13px;">Date</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(date)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Time</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(time)}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;">Service</td><td style="font-weight:600;color:#1f2937;">${escapeHtml(service || 'Appointment')}</td></tr>
    </table>
    <p>Need to make changes? Please contact ${escapeHtml(businessName)} directly.</p>
    <p>See you soon! 😊</p>
  `;
}

/** Follow-up email body (sent 24h after booking) */
function followUpBody(name, businessName) {
  return `
    <p>Hi ${escapeHtml(name)},</p>
    <p>We hope you're doing well! Just wanted to follow up on your recent booking with ${escapeHtml(businessName)}.</p>
    <p>If you have any questions or need to make changes to your appointment, please don't hesitate to reach out.</p>
    <p>We're here to help! 😊</p>
    <p style="margin-top:16px;color:#6b7280;">Best regards,<br>The ${escapeHtml(businessName)} Team</p>
  `;
}

/** Simple HTML escape helper */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ═════════════════════════════════════════════════════════════════
//  EMAIL NOTIFICATION SERVICE
// ═════════════════════════════════════════════════════════════════

class EmailNotifications {
  constructor() {
    this.transporter = createTransporter();
    this.isReady = !!this.transporter;
    this.followUpTimers = new Map(); // For scheduled follow-ups
  }

  /** Get email provider info */
  get status() {
    return {
      provider: CONFIG.provider,
      configured: !!CONFIG.notificationEmail,
      notificationEmail: CONFIG.notificationEmail || 'not set',
      ready: this.isReady && !!CONFIG.notificationEmail,
      followUps: CONFIG.followUp.enabled ? `Every ${CONFIG.followUp.delayHours}h` : 'disabled',
    };
  }

  /**
   * Send a booking confirmation to the business owner
   */
  async sendBookingConfirmation(booking) {
    if (!this.isReady) return this._logSkip('No email transporter');
    if (!CONFIG.notificationEmail) return this._logSkip('NOTIFICATION_EMAIL not set');

    const { name, contact, date, time, service, notes } = booking;
    const subject = `📅 New Booking — ${name} (${date} @ ${time})`;

    try {
      const info = await this.transporter.sendMail({
        from: `"${CONFIG.senderName}" <${CONFIG.senderEmail}>`,
        to: CONFIG.notificationEmail,
        subject: subject,
        html: emailLayout(subject, bookingConfirmationBody(name, contact, date, time, service, notes)),
      });

      console.log(`[Email] ✅ Booking confirmation sent (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] ❌ Failed to send booking confirmation:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a booking confirmation copy to the customer
   */
  async sendCustomerConfirmation(booking) {
    if (!this.isReady || !booking.contact?.includes('@')) return null;

    const { name, contact, date, time, service } = booking;
    const subject = `✅ Appointment Confirmed — ${CONFIG.business.name}`;

    try {
      const info = await this.transporter.sendMail({
        from: `"${CONFIG.business.name}" <${CONFIG.senderEmail}>`,
        to: contact,
        subject: subject,
        html: emailLayout(subject, customerConfirmationBody(name, date, time, service, CONFIG.business.name)),
      });

      console.log(`[Email] ✅ Customer confirmation sent (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] ❌ Failed to send customer confirmation:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a new lead notification with conversation summary
   */
  async sendLeadNotification({ name, contact, summary, source }) {
    if (!this.isReady) return null;
    if (!CONFIG.notificationEmail) return null;

    const subject = `🔔 New Lead — ${name || 'Website Visitor'}`;

    try {
      const info = await this.transporter.sendMail({
        from: `"${CONFIG.senderName}" <${CONFIG.senderEmail}>`,
        to: CONFIG.notificationEmail,
        subject: subject,
        html: emailLayout(subject, leadSummaryBody(name, contact, summary, source)),
      });

      console.log(`[Email] ✅ Lead notification sent (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] ❌ Failed to send lead notification:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a booking reminder (2 hours before appointment)
   */
  async sendReminder(booking) {
    if (!this.isReady || !booking.contact?.includes('@')) return null;

    const { name, contact, date, time, service } = booking;
    const subject = `⏰ Reminder — Your appointment with ${CONFIG.business.name}`;

    try {
      const info = await this.transporter.sendMail({
        from: `"${CONFIG.business.name}" <${CONFIG.senderEmail}>`,
        to: contact,
        subject: subject,
        html: emailLayout(subject, reminderBody(name, date, time, service, CONFIG.business.name)),
      });

      console.log(`[Email] ✅ Reminder sent (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] ❌ Failed to send reminder:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send a follow-up email (typically 24h after booking)
   */
  async sendFollowUp(booking) {
    if (!this.isReady || !booking.contact?.includes('@')) return null;

    const { name, contact } = booking;
    const subject = `💬 How are things — ${CONFIG.business.name}`;

    try {
      const info = await this.transporter.sendMail({
        from: `"${CONFIG.business.name}" <${CONFIG.senderEmail}>`,
        to: contact,
        subject: subject,
        html: emailLayout(subject, followUpBody(name, CONFIG.business.name)),
      });

      console.log(`[Email] ✅ Follow-up sent (${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('[Email] ❌ Failed to send follow-up:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send all booking-related emails (notification + customer + schedule follow-ups)
   */
  async processBooking(booking) {
    const results = [];

    // 1. Send notification to business owner
    const ownerResult = await this.sendBookingConfirmation(booking);
    results.push({ type: 'owner', ...ownerResult });

    // 2. Send confirmation to customer (if they have email)
    if (booking.contact?.includes('@')) {
      const customerResult = await this.sendCustomerConfirmation(booking);
      results.push({ type: 'customer', ...customerResult });

      // 3. Schedule reminder (2h before)
      if (CONFIG.followUp.enabled) {
        this._scheduleReminder(booking);
      }

      // 4. Schedule follow-up (24h after)
      if (CONFIG.followUp.enabled) {
        this._scheduleFollowUp(booking);
      }
    }

    return results;
  }

  /**
   * Schedule a reminder email (2 hours before appointment)
   */
  _scheduleReminder(booking) {
    try {
      const { date, time } = booking;
      // Parse the appointment time
      const parts = time?.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (!parts) return;

      let hours = parseInt(parts[1]);
      const minutes = parseInt(parts[2]) || 0;
      if (parts[3]?.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (parts[3]?.toLowerCase() === 'am' && hours === 12) hours = 0;

      // Calculate time until 2 hours before appointment
      const appointmentTime = new Date();
      // For demo/testing, just use a simple delay
      const delayMs = CONFIG.followUp.reminderBeforeHours * 60 * 60 * 1000;

      console.log(`[Email] ⏰ Reminder scheduled for "${booking.name}" (${delayMs}ms from now)`);
      
      // In production, this would use a job queue. For now, just log.
      // setTimeout would work but doesn't persist across restarts.
      return { scheduled: true, delayMs };
    } catch (e) {
      console.warn('[Email] Failed to schedule reminder:', e.message);
      return null;
    }
  }

  /**
   * Schedule a follow-up email (24h after booking)
   */
  _scheduleFollowUp(booking) {
    // In production, this would use a job queue (Bull, Agenda, Bee-Queue)
    // For demo, we just log that it would be scheduled
    const delayHours = CONFIG.followUp.delayHours;
    console.log(`[Email] 📅 Follow-up scheduled for "${booking.name}" in ${delayHours}h`);
    return { scheduled: true, delayHours };
  }

  /** Log skipped email (dev/logging mode) */
  _logSkip(reason) {
    console.log(`[Email] ⏸️ Skipped: ${reason}`);
    return { success: false, skipped: true, reason };
  }
}

// ═════════════════════════════════════════════════════════════════
//  EXPORT
// ═════════════════════════════════════════════════════════════════

module.exports = { EmailNotifications };