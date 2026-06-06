# SiteMind AI Server

Backend server for the SiteMind AI voice widget. Handles chat processing, LLM integration, language detection, booking flow, and data storage.

## Quick Start

```bash
cd server/
npm install
node server.js
```

The server starts on **http://localhost:3001**.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| **POST** | `/api/chat` | Process a chat message |
| **POST** | `/api/bookings` | Store a completed booking (+ auto-create calendar event) |
| **GET** | `/api/calendar/status` | Calendar configuration status |
| **GET** | `/api/calendar/availability` | Check time slot availability |
| **POST** | `/api/calendar/events` | Create a calendar event directly |
| **GET** | `/api/health` | Health check |
| **GET** | `/api/bookings` | List recent bookings |

> 💡 **Booking flow:** POST /api/bookings → (1) stores booking + (2) creates calendar event + (3) sends email notifications (owner + customer + schedules follow-ups)

### POST /api/chat

The main endpoint that the widget connects to.

**Request:**
```json
{
  "message": "I'd like to book an appointment",
  "sessionId": "optional-session-id",
  "language": "en",
  "businessName": "My Business"
}
```

**Response:**
```json
{
  "response": "I'd be happy to help you book! What's your name?",
  "intent": "booking",
  "booking": null,
  "language": "en",
  "sessionId": "sess-1234-abc",
  "provider": "openai"
}
```

### POST /api/bookings

Store a completed booking.

**Request:**
```json
{
  "sessionId": "sess-1234-abc",
  "booking": {
    "name": "John Smith",
    "contact": "john@example.com",
    "date": "Next Monday",
    "time": "2:00 PM",
    "service": "Consultation"
  },
  "agentId": "default"
}
```

## LLM Integration

The server supports two modes:

### 1. OpenAI (recommended)

Set your API key and model:

```bash
OPENAI_API_KEY=sk-... node server.js
```

Optional: set a different model:

```bash
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o node server.js
```

### 2. Rule-based (fallback)

No configuration needed. The server uses smart pattern matching to detect intents and manage booking flow. Works out of the box.

```bash
node server.js
```

## Configuration

Copy `.env.example` to `.env` and configure:

```
PORT=3001                        # Server port
NODE_ENV=development              # Environment
OPENAI_API_KEY=sk-...             # OpenAI API key (optional)
OPENAI_MODEL=gpt-4o-mini         # OpenAI model
CORS_ORIGINS=*                    # Allowed origins (comma-separated)
```

## Conversation Flow

```
Visitor: "I need to book an appointment"
  → Server detects BOOKING intent
  → Starts booking flow (6 steps):
    1. Ask for name
    2. Ask for contact info
    3. Ask for preferred date
    4. Ask for preferred time
    5. Ask for service
    6. Confirm all details → Book it!

Visitor: "How much do you charge?"
  → Server detects PRICING intent
  → Responds with pricing info

Visitor: "What are your hours?"
  → Server detects HOURS intent
  → Responds with business hours
```

## Multi-Language Support

Auto-detects language from visitor messages. Supports:

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)

Detects language by keyword patterns. The conversation continues in the detected language.

## Calendar Integration

### Google Calendar (service account)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the **Google Calendar API**
3. Create a **Service Account**, download the JSON key
4. Share your Google Calendar with the service account email (as "Make changes to events")
5. Set the environment variables:

```bash
GOOGLE_CALENDAR_ID=yourname@gmail.com
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

### Outlook Calendar (Microsoft Graph)

1. Go to [Azure Portal](https://portal.azure.com/) → App registrations
2. Create a new app, add **Calendar.ReadWrite** API permission
3. Create a **client secret**
4. Set environment variables:

```bash
OUTLOOK_CLIENT_ID=your-client-id
OUTLOOK_CLIENT_SECRET=your-client-secret
OUTLOOK_TENANT_ID=common
```

### Calendly (scheduling link)

No API keys needed. Visitors are redirected to your Calendly link:

```bash
CALENDLY_LINK=https://calendly.com/yourname/30min
```

### Calendar API

```bash
# Get calendar status
curl http://localhost:3001/api/calendar/status

# Check availability (no API keys needed for check)
curl "http://localhost:3001/api/calendar/availability?date=tomorrow&time=2:00PM"

# Create event
curl -X POST http://localhost:3001/api/calendar/events \
  -H "Content-Type: application/json" \
  -d '{"name":"John","contact":"john@email.com","date":"tomorrow","time":"2PM","service":"Consultation"}'
```

## Email Notifications

The system sends automated emails when bookings are made:

| Email Type | Recipient | When |
|------------|-----------|------|
| Booking Confirmation | Business owner | On booking |
| Customer Confirmation | Customer (if email) | On booking |
| Appointment Reminder | Customer | ~2h before |
| Follow-up | Customer | ~24h after |
| Lead Notification | Business owner | On new lead/conversation |

### Setup

Copy `.env.example` to `.env` and configure:

```bash
# Dev mode (logs to console, no real sending)
EMAIL_PROVIDER=dev

# Gmail (use App Password — NOT your regular password)
EMAIL_PROVIDER=gmail
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx    # From https://myaccount.google.com/apppasswords

# Custom SMTP (SendGrid, Mailgun, Postmark, etc.)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
```

### Email Templates

The system includes 5 professional email templates:
- Booking confirmation (owner) — details table, customer contact info
- Customer confirmation — booking summary, brand colors
- Lead notification — visitor details, conversation summary
- Appointment reminder — upcoming booking info
- Follow-up — post-appointment check-in

All templates feature responsive design with gradient headers, clean typography, and mobile-friendly layouts.

## Testing

Start the server, then run the test suite:

```bash
# Terminal 1: Start server
node server.js

# Terminal 2: Run tests
node test-server.js
```

The test script runs 9 tests covering: health check, greetings, pricing, hours, full booking flow (7 steps), Spanish language detection, French booking, German pricing, and farewell.

## Connecting to the Widget

The widget's `processWithAI()` function is ready to connect. Update your widget or site to call the server:

```javascript
// In widget.js, replace the processWithAIDemo function:
async function sendToServer(message, sessionId) {
  const res = await fetch('https://your-server.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId })
  });
  return res.json();
}
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Set `CORS_ORIGINS` to your website domain(s)
3. Set `OPENAI_API_KEY` for AI-powered responses
4. Use a process manager (pm2, systemd) or Docker
5. Add a reverse proxy (nginx, Caddy) for HTTPS
6. Replace in-memory booking storage with a database