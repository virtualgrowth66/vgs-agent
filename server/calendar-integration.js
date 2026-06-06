/**
 * SiteMind AI — Calendar Integration
 * 
 * Multi-provider calendar integration supporting:
 * - Google Calendar (OAuth2 service account)
 * - Outlook Calendar (Microsoft Graph API)
 * - Calendly (scheduling link redirect)
 * 
 * Handles availability checking and event creation.
 */

const https = require('https');
const { URL } = require('url');

// ═════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═════════════════════════════════════════════════════════════════

const CONFIG = {
  google: {
    enabled: !!process.env.GOOGLE_CALENDAR_ID,
    calendarId: process.env.GOOGLE_CALENDAR_ID || '',
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
    timezone: process.env.CALENDAR_TIMEZONE || 'America/New_York',
    defaultDuration: parseInt(process.env.CALENDAR_DEFAULT_DURATION) || 60, // minutes
  },
  outlook: {
    enabled: !!process.env.OUTLOOK_CLIENT_ID,
    clientId: process.env.OUTLOOK_CLIENT_ID || '',
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || '',
    tenantId: process.env.OUTLOOK_TENANT_ID || 'common',
    calendarId: process.env.OUTLOOK_CALENDAR_ID || '',
    timezone: process.env.CALENDAR_TIMEZONE || 'America/New_York',
    defaultDuration: parseInt(process.env.CALENDAR_DEFAULT_DURATION) || 60,
  },
  calendly: {
    enabled: !!process.env.CALENDLY_LINK,
    link: process.env.CALENDLY_LINK || '',
    apiToken: process.env.CALENDLY_API_TOKEN || '',
    eventType: process.env.CALENDLY_EVENT_TYPE || '',
    timezone: process.env.CALENDAR_TIMEZONE || 'America/New_York',
  },
};

// ═════════════════════════════════════════════════════════════════
//  UTILITY
// ═════════════════════════════════════════════════════════════════

/** Simple HTTP request helper */
function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/** Parse a date string into ISO, handling various input formats */
function parseDateTime(dateStr, timeStr) {
  const now = new Date();
  let date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    // Handle relative dates like "tomorrow", "next Monday"
    const lower = dateStr.toLowerCase();
    if (lower.includes('tomorrow')) {
      date = new Date(now);
      date.setDate(date.getDate() + 1);
    } else if (lower.includes('next')) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = dayNames.findIndex(d => lower.includes(d));
      if (targetDay >= 0) {
        date = new Date(now);
        const currentDay = date.getDay();
        let daysUntil = targetDay - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        date.setDate(date.getDate() + daysUntil);
      }
    } else if (lower.includes('today')) {
      date = new Date(now);
    } else {
      date = new Date(now);
      date.setDate(date.getDate() + 1);
    }
  }

  // Parse time
  let hours = 10; // Default 10 AM
  let minutes = 0;
  
  if (timeStr) {
    const timeLower = timeStr.toLowerCase();
    const timeMatch = timeLower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1]);
      minutes = parseInt(timeMatch[2]) || 0;
      if (timeMatch[3] === 'pm' && hours < 12) hours += 12;
      if (timeMatch[3] === 'am' && hours === 12) hours = 0;
    }
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** Format ISO datetime string for API */
function toISO(date) {
  return date.toISOString();
}

// ═════════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR
// ═════════════════════════════════════════════════════════════════

class GoogleCalendar {
  constructor() {
    this.enabled = CONFIG.google.enabled;
  }

  /** Get Google OAuth2 access token using service account */
  async _getAccessToken() {
    if (!CONFIG.google.serviceAccountJson) {
      throw new Error('Google service account JSON not configured');
    }
    
    let credentials;
    try {
      credentials = JSON.parse(CONFIG.google.serviceAccountJson);
    } catch {
      // Try loading from file
      credentials = require(CONFIG.google.serviceAccountJson);
    }

    // JWT grant type token exchange
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = { alg: 'RS256', typ: 'JWT' };
    const jwtClaim = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    // Simpler approach: use googleapis library or fallback to REST
    try {
      const { google } = require('googleapis');
      const auth = new google.auth.JWT(
        credentials.client_email,
        null,
        credentials.private_key,
        ['https://www.googleapis.com/auth/calendar']
      );
      const token = await auth.getAccessToken();
      return token.token || token.access_token;
    } catch (e) {
      throw new Error('Failed to get Google access token: ' + e.message);
    }
  }

  /** Check calendar availability for a time range */
  async checkAvailability(dateStr, timeStr, durationMinutes) {
    if (!this.enabled) return null;
    
    try {
      const startTime = parseDateTime(dateStr, timeStr);
      const endTime = new Date(startTime.getTime() + (durationMinutes || CONFIG.google.defaultDuration) * 60000);
      
      const token = await this._getAccessToken();
      const result = await httpRequest(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CONFIG.google.calendarId)}/events?` +
        `timeMin=${toISO(startTime)}&timeMax=${toISO(endTime)}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (result.status !== 200) {
        return { available: false, error: 'Failed to check calendar', details: result.data };
      }

      const events = result.data.items || [];
      const isAvailable = events.length === 0;

      return {
        available: isAvailable,
        startTime: toISO(startTime),
        endTime: toISO(endTime),
        conflictingEvents: events.map(e => ({
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
        })),
        provider: 'google',
      };
    } catch (err) {
      console.error('[GoogleCalendar] Availability error:', err.message);
      return { available: false, error: err.message };
    }
  }

  /** Create a calendar event */
  async createEvent({ name, contact, date, time, service, duration }) {
    if (!this.enabled) return null;

    try {
      const startTime = parseDateTime(date, time);
      const endTime = new Date(startTime.getTime() + (duration || CONFIG.google.defaultDuration) * 60000);

      const token = await this._getAccessToken();
      const eventBody = {
        summary: `${service || 'Appointment'} — ${name}`,
        description: `Booking from SiteMind AI\n\nName: ${name}\nContact: ${contact}\nService: ${service || 'General'}\nSource: Website Widget`,
        start: {
          dateTime: toISO(startTime),
          timeZone: CONFIG.google.timezone,
        },
        end: {
          dateTime: toISO(endTime),
          timeZone: CONFIG.google.timezone,
        },
        attendees: contact?.includes('@') ? [{ email: contact }] : [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      const result = await httpRequest(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CONFIG.google.calendarId)}/events?sendNotifications=true`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        eventBody
      );

      if (result.status === 200) {
        return {
          success: true,
          eventId: result.data.id,
          htmlLink: result.data.htmlLink,
          startTime: toISO(startTime),
          endTime: toISO(endTime),
          provider: 'google',
        };
      }

      return { success: false, error: 'Failed to create event', details: result.data };
    } catch (err) {
      console.error('[GoogleCalendar] Create error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /** Get upcoming events (for display/checking) */
  async getUpcoming(maxResults = 10) {
    if (!this.enabled) return [];

    try {
      const token = await this._getAccessToken();
      const result = await httpRequest(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CONFIG.google.calendarId)}/events?` +
        `timeMin=${toISO(new Date())}&orderBy=startTime&singleEvents=true&maxResults=${maxResults}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (result.status !== 200) return [];
      return (result.data.items || []).map(e => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        link: e.htmlLink,
      }));
    } catch {
      return [];
    }
  }
}

// ═════════════════════════════════════════════════════════════════
//  OUTLOOK CALENDAR (Microsoft Graph API)
// ═════════════════════════════════════════════════════════════════

class OutlookCalendar {
  constructor() {
    this.enabled = CONFIG.outlook.enabled;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  /** Get Microsoft Graph access token (client credentials flow) */
  async _getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const result = await httpRequest(
        `https://login.microsoftonline.com/${CONFIG.outlook.tenantId}/oauth2/v2.0/token`,
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        `client_id=${encodeURIComponent(CONFIG.outlook.clientId)}` +
        `&client_secret=${encodeURIComponent(CONFIG.outlook.clientSecret)}` +
        `&scope=https://graph.microsoft.com/.default` +
        `&grant_type=client_credentials`
      );

      if (result.status !== 200) {
        throw new Error('Token request failed: ' + JSON.stringify(result.data));
      }

      this.accessToken = result.data.access_token;
      this.tokenExpiry = Date.now() + (result.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (err) {
      throw new Error('Outlook auth failed: ' + err.message);
    }
  }

  /** Check availability */
  async checkAvailability(dateStr, timeStr, durationMinutes) {
    if (!this.enabled) return null;

    try {
      const startTime = parseDateTime(dateStr, timeStr);
      const endTime = new Date(startTime.getTime() + (durationMinutes || CONFIG.outlook.defaultDuration) * 60000);

      const token = await this._getAccessToken();
      const calendarId = CONFIG.outlook.calendarId || 'me/calendar';

      const result = await httpRequest(
        `https://graph.microsoft.com/v1.0/${calendarId}/calendarView?` +
        `startDateTime=${toISO(startTime)}&endDateTime=${toISO(endTime)}`,
        { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' } },
      );

      if (result.status !== 200) {
        return { available: false, error: 'Failed to check availability' };
      }

      const events = result.data.value || [];
      const isAvailable = events.length === 0;

      return {
        available: isAvailable,
        startTime: toISO(startTime),
        endTime: toISO(endTime),
        conflictingEvents: events.map(e => ({
          summary: e.subject,
          start: e.start?.dateTime,
          end: e.end?.dateTime,
        })),
        provider: 'outlook',
      };
    } catch (err) {
      console.error('[OutlookCalendar] Availability error:', err.message);
      return { available: false, error: err.message };
    }
  }

  /** Create event */
  async createEvent({ name, contact, date, time, service, duration }) {
    if (!this.enabled) return null;

    try {
      const startTime = parseDateTime(date, time);
      const endTime = new Date(startTime.getTime() + (duration || CONFIG.outlook.defaultDuration) * 60000);

      const token = await this._getAccessToken();
      const calendarId = CONFIG.outlook.calendarId || 'me/calendar';

      const eventBody = {
        subject: `${service || 'Appointment'} — ${name}`,
        body: {
          contentType: 'text',
          content: `Booking from SiteMind AI\n\nName: ${name}\nContact: ${contact}\nService: ${service || 'General'}`,
        },
        start: { dateTime: toISO(startTime), timeZone: 'UTC' },
        end: { dateTime: toISO(endTime), timeZone: 'UTC' },
        attendees: contact?.includes('@') ? [{ emailAddress: { address: contact } }] : [],
        isReminderOn: true,
        reminderMinutesBeforeStart: 30,
      };

      const result = await httpRequest(
        `https://graph.microsoft.com/v1.0/${calendarId}/events`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
        eventBody
      );

      if (result.status === 201) {
        return {
          success: true,
          eventId: result.data.id,
          htmlLink: result.data.webLink,
          startTime: toISO(startTime),
          endTime: toISO(endTime),
          provider: 'outlook',
        };
      }

      return { success: false, error: 'Failed to create event', details: result.data };
    } catch (err) {
      console.error('[OutlookCalendar] Create error:', err.message);
      return { success: false, error: err.message };
    }
  }
}

// ═════════════════════════════════════════════════════════════════
//  CALENDLY
// ═════════════════════════════════════════════════════════════════

class Calendly {
  constructor() {
    this.enabled = CONFIG.calendly.enabled;
  }

  /** Get the scheduling link */
  getSchedulingLink({ name, contact, service } = {}) {
    if (!this.enabled) return null;
    
    let link = CONFIG.calendly.link;
    
    // Add query params if available
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (contact) params.set('email', contact);
    if (service) params.set('a1', service);
    
    const paramStr = params.toString();
    if (paramStr) link += (link.includes('?') ? '&' : '?') + paramStr;
    
    return link;
  }

  /** Get available event types (requires API token) */
  async getEventTypes() {
    if (!CONFIG.calendly.apiToken) return [];

    try {
      const result = await httpRequest(
        'https://api.calendly.com/event_types',
        { headers: { Authorization: `Bearer ${CONFIG.calendly.apiToken}` } }
      );

      if (result.status !== 200) return [];
      return (result.data.collection || []).map(e => ({
        uri: e.uri,
        name: e.name,
        duration: e.duration,
        slug: e.slug,
        link: e.scheduling_url,
      }));
    } catch {
      return [];
    }
  }
}

// ═════════════════════════════════════════════════════════════════
//  CALENDAR INTEGRATION (Unified Interface)
// ═════════════════════════════════════════════════════════════════

class CalendarIntegration {
  constructor() {
    this.google = new GoogleCalendar();
    this.outlook = new OutlookCalendar();
    this.calendly = new Calendly();
  }

  /** Get the primary calendar provider name */
  get primaryProvider() {
    if (this.google.enabled) return 'google';
    if (this.outlook.enabled) return 'outlook';
    if (this.calendly.enabled) return 'calendly';
    return null;
  }

  /** Check if any calendar is configured */
  get isConfigured() {
    return this.google.enabled || this.outlook.enabled || this.calendly.enabled;
  }

  /** Get status of all calendar providers */
  get status() {
    return {
      google: { enabled: this.google.enabled, calendarId: CONFIG.google.calendarId || null },
      outlook: { enabled: this.outlook.enabled, clientId: CONFIG.outlook.clientId || null },
      calendly: { enabled: this.calendly.enabled, link: CONFIG.calendly.link || null },
      primaryProvider: this.primaryProvider,
    };
  }

  /**
   * Check availability for a time slot
   * @param {string} dateStr - Date string (e.g. "next Monday", "2024-03-15")
   * @param {string} timeStr - Time string (e.g. "2 PM", "14:00")
   * @param {number} duration - Duration in minutes
   * @returns {object} Availability result
   */
  async checkAvailability(dateStr, timeStr, duration) {
    // Try Google first, then Outlook
    if (this.google.enabled) {
      const result = await this.google.checkAvailability(dateStr, timeStr, duration);
      if (result) return result;
    }
    if (this.outlook.enabled) {
      const result = await this.outlook.checkAvailability(dateStr, timeStr, duration);
      if (result) return result;
    }
    // Calendly can't check availability directly
    return { available: null, provider: 'none', reason: 'No calendar provider configured for availability checks' };
  }

  /**
   * Create a calendar event
   * @param {object} booking - { name, contact, date, time, service }
   * @returns {object} Created event info
   */
  async createEvent(booking) {
    const { name, contact, date, time, service } = booking;

    // Try Google first
    if (this.google.enabled) {
      const result = await this.google.createEvent({ name, contact, date, time, service });
      if (result?.success) return result;
    }

    // Fallback to Outlook
    if (this.outlook.enabled) {
      const result = await this.outlook.createEvent({ name, contact, date, time, service });
      if (result?.success) return result;
    }

    // Calendly: return scheduling link instead
    if (this.calendly.enabled) {
      return {
        success: true,
        schedulingLink: this.calendly.getSchedulingLink({ name, contact, service }),
        provider: 'calendly',
        message: 'Please use the scheduling link to complete your booking',
      };
    }

    return { success: false, error: 'No calendar provider configured' };
  }

  /** Get upcoming events */
  async getUpcomingEvents(maxResults) {
    if (this.google.enabled) return this.google.getUpcoming(maxResults);
    if (this.outlook.enabled) return []; // Outlook upcoming not implemented
    return [];
  }

  /** Get Calendly scheduling link */
  getSchedulingLink(details) {
    return this.calendly.getSchedulingLink(details);
  }
}

// ═════════════════════════════════════════════════════════════════
//  EXPORT
// ═════════════════════════════════════════════════════════════════

module.exports = {
  CalendarIntegration,
  GoogleCalendar,
  OutlookCalendar,
  Calendly,
  parseDateTime,
};