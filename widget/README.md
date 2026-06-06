# SiteMind AI — Voice Conversation Engine & Floating Widget

A complete voice-activated AI sales agent that lives on any website. Handles speech-to-text, multi-language intent detection, booking conversation flow, and text-to-speech — all in the browser.

## Quick Start

Add these two scripts in your website's `</body>` section:

```html
<script src="voice-engine.js"></script>
<script src="widget.js"
        data-agent-id="your-agent-id"
        data-language="en"
        data-primary-color="#4F46E5"
        data-auto-detect="true"
        data-voice="true"
        data-tts="true"></script>
```

Or use the single-file bundle:

```html
<script src="embed.js"
        data-agent-id="your-agent-id"
        data-primary-color="#4F46E5"></script>
```

The widget appears as a floating avatar in the bottom-right corner.

## File Structure

```
widget/
├── index.html              # Demo page with conversation flow buttons
├── voice-engine.js         # Voice AI engine (STT, TTS, conversation, intents)
├── widget.js               # Floating widget UI (loads voice-engine.js)
├── embed.js                # Production single-file bundle (widget + engine)
├── widget-avatar.png       # Avatar image (1024x1024)
└── README.md               # This file
```

## Voice Engine (`voice-engine.js`)

The core AI engine provides:

| Component | Description |
|-----------|-------------|
| **`SpeechToText`** | Browser speech recognition via Web Speech API. Supports 10+ languages. Continuous/interim options. |
| **`TextToSpeech`** | Browser speech synthesis. Auto-finds best voice per language. Play/pause/stop controls. |
| **`ConversationEngine`** | Stateful conversation manager with intent detection and booking flow. |
| **`LanguageDetector`** | Keyword-based language detection. Detects from text and browser settings. |

### Conversation Flow

```
Visitor says: "I'd like to book an appointment"
  → Engine detects BOOKING intent
  → Starts booking flow (6 steps):
    1. Ask for name
    2. Ask for contact info
    3. Ask for preferred date
    4. Ask for preferred time
    5. Ask for service type
    6. Confirm all details & book
```

Other supported intents: greeting, pricing, hours, contact, thanks, language, farewell, inquiry (fallback).

### Multi-Language Support

10 languages built-in with auto-detection:

| Code | Language | Speech Recognition | Speech Synthesis |
|------|----------|-------------------|-----------------|
| `en` | English | en-US | en-US |
| `es` | Spanish | es-ES | es-ES |
| `fr` | French | fr-FR | fr-FR |
| `de` | German | de-DE | de-DE |
| `it` | Italian | it-IT | it-IT |
| `pt` | Portuguese | pt-BR | pt-BR |
| `zh` | Chinese | zh-CN | zh-CN |
| `ja` | Japanese | ja-JP | ja-JP |
| `ko` | Korean | ko-KR | ko-KR |
| `ar` | Arabic | ar-SA | ar-SA |

### LLM Integration Point

The `ConversationEngine` currently uses a rule-based intent system. To swap in a real LLM:

```javascript
// In your website, after loading voice-engine.js:
const engine = window.SiteMindVoice.createEngine({
  language: 'en',
  onBookingComplete: (data) => {
    // Send booking data to your API
    fetch('/api/bookings', { method: 'POST', body: JSON.stringify(data) });
  }
});

// Override the process method to use your LLM:
engine.process = function(userText) {
  // Call your LLM API
  return fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: userText, session: this.context })
  }).then(res => res.text());
};
```

## Widget Configuration

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-agent-id` | `default` | Unique identifier for your agent |
| `data-language` | `en` | Default language |
| `data-primary-color` | `#4F46E5` | Brand color for header, buttons, accents |
| `data-position` | `bottom-right` | Widget position on page |
| `data-avatar` | *(auto)* | Custom avatar image URL |
| `data-greeting` | *default message* | Custom greeting message |
| `data-auto-detect` | `true` | Auto-detect visitor language |
| `data-voice` | `true` | Enable speech-to-text |
| `data-tts` | `true` | Enable text-to-speech |
| `data-business` | `SiteMind` | Business name for booking |
| `data-server-url` | `''` | Backend server URL (e.g. `https://api.example.com`). When set, widget routes all messages to the server instead of using the browser engine. |

## Features

- **Speech-to-Text** — Real-time browser-based speech recognition (Web Speech API)
- **Text-to-Speech** — Natural voice responses with per-message play button
- **Multi-Language** — Auto-detects and responds in visitor's language (10 languages)
- **Booking Flow** — Multi-step conversation: name → contact → date → time → service → confirm
- **Intent Detection** — Smart keyword matching for greetings, pricing, hours, booking, contact, etc.
- **Visual Indicator** — Header dot status: online (green), listening (yellow), processing (blue), speaking (purple)
- **Waveform Animation** — Visual feedback during voice recording
- **Booking Progress Bar** — Shows current step during booking flow
- **Floating Avatar** — Circular avatar with gentle pulsing animation
- **Responsive** — Full-screen mobile layout on small screens
- **Zero External Dependencies** — No frameworks, no CDN links

## Embedding on Different Platforms

### WordPress
Add to "Custom HTML" widget in footer, or paste in theme's `footer.php` before `</body>`.

### Wix
Use "Embed Code" element → "Embed HTML" → paste both scripts (or embed.js).

### Squarespace
Settings → Advanced → Code Injection → Footer → paste snippet.

### Webflow
Add an "Embed" element before closing `</body>` tag.

### Shopify
Online Store → Themes → Edit Code → theme.liquid → paste before `</body>`.

### Any Custom HTML Site
Paste directly in the HTML before `</body>`.

## Development

To test locally:

```bash
cd widget/
python3 -m http.server 8080
# Open http://localhost:8080
```

Open `index.html` in your browser to see the widget + voice engine in action.
Click the demo flow buttons to simulate conversations.

## Architecture

```
widget.js (UI Layer)
├── Injects CSS
├── Creates floating button + panel
├── Loads & connects voice-engine.js
└── Handles DOM events

voice-engine.js (AI Layer)
├── SpeechToText (Web Speech API)
├── TextToSpeech (Speech Synthesis)
├── ConversationEngine (Intent → Response)
│   ├── NLP Intent Detection
│   ├── Booking Flow State Machine
│   ├── Multi-Language Responses
│   └── LLM Integration Point
└── LanguageDetector
  
embed.js (Production Bundle)
├── Contains both widget.js + voice-engine.js
└── Minified single-file drop-in
```

## Connecting to the Server

The widget can operate in two modes:

### 1. Browser Engine (default, no server needed)

Uses `voice-engine.js` for speech recognition, conversation flow, and speech synthesis — all in the browser. Zero server cost.

```
<script src="voice-engine.js"></script>
<script src="widget.js" data-agent-id="my-agent"></script>
```

### 2. Backend Server (AI-powered)

Set `data-server-url` to route all messages to a backend server with LLM integration (OpenAI, etc.).

```
<script src="voice-engine.js"></script>
<script src="widget.js"
        data-agent-id="my-agent"
        data-server-url="https://api.mysite.com"></script>
```

The server runs on port 3001 and provides:
- **POST /api/chat** — Process messages with LLM or rule engine
- **POST /api/bookings** — Store completed bookings
- **GET /api/health** — Health check

See `/home/team/shared/server/README.md` for server setup.

## Backend Integration

The widget is designed to connect to a backend API for:

1. **AI Responses** — Replace the rule-based engine with OpenAI/Anthropic
2. **Calendar Booking** — Connect to Google Calendar, Outlook, or Calendly
3. **Email Notifications** — Send conversation summaries to business owner
4. **CRM Sync** — Push captured leads to HubSpot, Salesforce, etc.
5. **Analytics** — Track conversations, booking rates, popular questions
