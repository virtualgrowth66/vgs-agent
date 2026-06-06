/**
 * SiteMind AI — Backend Server
 * 
 * Express server that powers the voice AI widget.
 * Handles chat processing, LLM integration, and booking collection.
 * 
 * Endpoints:
 *   POST /api/chat    — Process a chat message (main widget endpoint)
 *   POST /api/bookings — Store completed booking data
 *   GET  /api/health   — Health check
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-... node server.js
 *   # Falls back to rule-based engine when no API key is set
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ChatEngine, detectLanguage } = require('./chat-engine');
const { CalendarIntegration } = require('./calendar-integration');
const { EmailNotifications } = require('./email-notifications');

// ═════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const corsOrigins = process.env.CORS_ORIGINS || '*';
const corsOptions = {
  origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(s => s.trim()),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
};

// ═════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═════════════════════════════════════════════════════════════════

const engine = new ChatEngine({
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  maxSessions: 5000,
});

// In-memory booking storage (replace with DB in production)
const bookings = [];

// Calendar integration
const calendar = new CalendarIntegration();
const calendarStatus = calendar.status;

// Email notifications
const email = new EmailNotifications();

const app = express();

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (req.path === '/api/chat') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

// ═════════════════════════════════════════════════════════════════
//  ENDPOINTS
// ═════════════════════════════════════════════════════════════════

/**
 * POST /api/chat
 * Main endpoint for the widget to process messages.
 * 
 * Request body:
 *   { message: string, sessionId?: string, language?: string, businessName?: string }
 * 
 * Response:
 *   { response: string, intent: string, booking: object|null, language: string, sessionId: string, provider: string }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, language, businessName } = req.body;

    // Validate
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "message" field' });
    }

    const trimmed = message.trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (trimmed.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }

    // Process the message
    const result = await engine.processMessage(sessionId, trimmed, { language, businessName });

    // Send response
    res.json({
      response: result.response,
      intent: result.intent,
      booking: result.booking,
      language: result.language,
      sessionId: result.sessionId,
      provider: result.provider,
    });
  } catch (err) {
    console.error('[Server] Chat error:', err);
    res.status(500).json({
      response: "I'm sorry, I'm having trouble processing that right now. Please try again in a moment.",
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/bookings
 * Store a completed booking from the widget.
 * 
 * Request body:
 *   { sessionId: string, booking: { name, contact, date, time, service }, agentId?: string }
 * 
 * Response:
 *   { success: true, bookingId: string, calendar: object|null }
 */
app.post('/api/bookings', (req, res) => {
  try {
    const { sessionId, booking, agentId } = req.body;

    if (!booking || !booking.name || !booking.contact) {
      return res.status(400).json({ error: 'Missing required booking fields (name, contact)' });
    }

    const record = {
      id: 'bkg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      sessionId: sessionId || 'unknown',
      agentId: agentId || 'default',
      ...booking,
      createdAt: new Date().toISOString(),
      source: 'widget',
    };

    bookings.push(record);

    console.log(`[Booking] ${record.id}: ${record.name} — ${record.date} ${record.time} (${record.service || 'General'})`);

    // Create calendar event if calendar is configured
    let calendarResult = null;
    if (calendar.isConfigured) {
      calendar.createEvent(booking).then(result => {
        console.log(`[Calendar] ${result.success ? '✅' : '❌'} ${record.id}: ${result.provider || 'unknown'} — ${result.eventId || result.schedulingLink || result.error}`);
      }).catch(err => {
        console.error(`[Calendar] Error creating event for ${record.id}:`, err.message);
      });
    }

    // Send email notifications
    email.processBooking(booking).then(results => {
      for (const r of results) {
        if (r.success) {
          console.log(`[Email] ✅ ${r.type} notification sent for ${record.id}`);
        }
      }
    }).catch(err => {
      console.error(`[Email] Error processing notifications for ${record.id}:`, err.message);
    });

    res.json({
      success: true,
      bookingId: record.id,
      calendar: calendarResult ? { ...calendarResult, async: true } : { configured: calendar.isConfigured, enabled: calendar.primaryProvider },
      email: { provider: email.status.provider, mode: email.status.ready ? 'sending' : 'dev' },
    });
  } catch (err) {
    console.error('[Server] Booking error:', err);
    res.status(500).json({ error: 'Failed to store booking' });
  }
});

/**
 * GET /api/calendar/status
 * Get calendar configuration status.
 */
app.get('/api/calendar/status', (req, res) => {
  const status = calendar.status;
  res.json({
    configured: calendar.isConfigured,
    primaryProvider: status.primaryProvider,
    providers: {
      google: { enabled: status.google.enabled, calendarId: status.google.calendarId },
      outlook: { enabled: status.outlook.enabled },
      calendly: { enabled: status.calendly.enabled, link: status.calendly.link },
    },
  });
});

/**
 * GET /api/calendar/availability
 * Check calendar availability for a time slot.
 * Query params: date, time, duration (minutes)
 */
app.get('/api/calendar/availability', async (req, res) => {
  try {
    const { date, time, duration } = req.query;
    if (!date || !time) {
      return res.status(400).json({ error: 'Missing required params: date, time' });
    }

    if (!calendar.isConfigured) {
      return res.json({
        available: null,
        provider: 'none',
        message: 'No calendar provider configured. Set GOOGLE_CALENDAR_ID or CALENDLY_LINK in .env',
      });
    }

    const result = await calendar.checkAvailability(date, time, parseInt(duration) || 60);
    res.json(result);
  } catch (err) {
    console.error('[Server] Calendar availability error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/calendar/events
 * Create a calendar event directly.
 * Request body: { name, contact, date, time, service, duration }
 */
app.post('/api/calendar/events', async (req, res) => {
  try {
    const { name, contact, date, time, service, duration } = req.body;

    if (!name || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields: name, date, time' });
    }

    if (!calendar.isConfigured) {
      return res.json({
        success: false,
        error: 'No calendar provider configured',
        calendlyLink: calendar.calendly.enabled ? calendar.calendly.getSchedulingLink({ name, contact, service }) : null,
      });
    }

    const result = await calendar.createEvent({ name, contact, date, time, service, duration });
    res.json(result);
  } catch (err) {
    console.error('[Server] Calendar create event error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/health
 * Health check endpoint.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    environment: NODE_ENV,
    uptime: Math.floor(process.uptime()),
    engine: {
      activeSessions: engine.stats.activeSessions,
      totalMessages: engine.stats.totalIntents,
      bookings: engine.stats.bookingCount,
      provider: engine.openai ? 'openai' : 'rules',
    },
    calendar: {
      configured: calendar.isConfigured,
      primaryProvider: calendar.primaryProvider,
      providers: calendarStatus,
    },
    email: {
      provider: email.status.provider,
      configured: email.status.configured,
      ready: email.status.ready,
      mode: email.status.ready ? 'live' : 'dev',
    },
  });
});

/**
 * GET /api/bookings
 * List bookings (for development/debugging).
 */
app.get('/api/bookings', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(bookings.slice(-limit).reverse());
});

// ═════════════════════════════════════════════════════════════════
//  START SERVER
// ═════════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  const apiType = engine.openai ? `OpenAI (${process.env.OPENAI_MODEL || 'gpt-4o-mini'})` : 'Rule-based (no API key)';
  const calInfo = calendar.isConfigured ? `Calendar: ${calendar.primaryProvider} (configured)` : 'Calendar: none (optional)';
  const emailInfo = email.status.ready ? 'Email: live (sending)' : `Email: ${email.status.provider} (dev mode)`;
  console.log(`
╔══════════════════════════════════════════════╗
║         SiteMind AI — Server v1.0            ║
╠══════════════════════════════════════════════╣
║  Port:       ${String(PORT).padEnd(30)}║
║  Mode:       ${NODE_ENV.padEnd(30)}║
║  Provider:   ${apiType.padEnd(30)}║
║  ${calInfo.padEnd(37)}║
║  ${emailInfo.padEnd(37)}║
║  CORS:       ${corsOrigins.padEnd(30)}║
║                                              ║
║  Endpoints:                                  ║
║    POST /api/chat          — Chat            ║
║    POST /api/bookings      — Bookings        ║
║    GET /api/calendar/status  — Cal status    ║
║    GET /api/calendar/availability — Slots    ║
║    POST /api/calendar/events  — Create event ║
║    GET  /api/health        — Health          ║
║    GET  /api/bookings      — List bookings   ║
╚══════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  process.exit(0);
});
