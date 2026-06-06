/**
 * SiteMind AI — Chat Engine
 * 
 * Server-side conversation engine with:
 * - OpenAI/LLM integration (with rule-based fallback)
 * - Language detection
 * - Intent classification
 * - Booking flow state management
 * - Business-aware responses
 */

// ═══════════════════════════════════════════════════════════
//  LANGUAGE DETECTION
// ═══════════════════════════════════════════════════════════

const LANGUAGE_PATTERNS = {
  en: /\b(hello|hi|hey|good|morning|afternoon|evening|thanks|thank|help|book|appointment|schedule|price|cost|how|much|hour|open|close|yes|no|please|info|service)\b/i,
  es: /\b(hola|buenos|días|tardes|gracias|sí|no|por|favor|ayuda|reservar|cita|programar|precio|costo|cuánto|horario|abierto|cerrado|contacto|servicio|información)\b/i,
  fr: /\b(bonjour|salut|merci|oui|non|s'il|plaît|aide|réserver|rendez-vous|prix|coût|combien|horaire|ouvert|fermé|contact|service|information)\b/i,
  de: /\b(hallo|guten|tag|morgen|danke|ja|nein|bitte|hilfe|buchen|termin|preis|kosten|wie|viel|öffnungszeiten|stunde|geöffnet|geschlossen|kontakt|telefon|service|information|beratung)\b/i,
  it: /\b( ciao |buongiorno|grazie|sì|no|per|favore|aiuto|prenotare|appuntamento|prezzo|costo|quanto|orario|aperto|chiuso|contatto|servizio)\b/i,
  pt: /\b(olá|oi|bom|dia|obrigado|sim|não|por|favor|ajuda|reservar|compromisso|preço|custo|quanto|horário|aberto|fechado|contato|serviço)\b/i,
};

function detectLanguage(text) {
  const scores = {};
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    let score = 0;
    // Test each word individually
    for (const word of words) {
      if (pattern.test(word)) score += 2;
    }
    // Also test the full text (catches multi-word phrases)
    const fullMatches = (lower.match(pattern) || []).length;
    score += fullMatches;
    if (score > 0) scores[lang] = score;
  }
  
  if (Object.keys(scores).length === 0) return 'en';
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

// ═══════════════════════════════════════════════════════════
//  INTENT & RESPONSE PATTERNS
// ═══════════════════════════════════════════════════════════

const INTENT_PATTERNS = {
  greeting: { pattern: /\b(hello|hi|hey|good\s*(morning|afternoon|evening)|howdy|greetings|hola|bonjour|hallo|buenos días|guten tag)\b/i, weight: 0.7 },
  thanks: { pattern: /\b(thanks|thank you|gracias|merci|danke|appreciate|grazie|obrigado)\b/i, weight: 0.8 },
  booking: { pattern: /\b(book|booking|appointment|schedule|reserve|reservation|agendar|cita|rendez-vous|termin|prenotare|reservar)\b/i, weight: 1.0 },
  pricing: { pattern: /\b(price|pricing|cost|how much|rate|fee|package|plan|subscription|precio|costo|prix|coût|preis|kosten|quanto costa)\b/i, weight: 0.9 },
  hours: { pattern: /\b(hours|open|close|business hours|working hours|when are you|horario|horaire|öffnungszeiten|orario|aberto)\b/i, weight: 0.8 },
  contact: { pattern: /\b(contact|phone|call|email|address|location|reach|message|contacto|teléfono|correo|kontakt|telefon)\b/i, weight: 0.7 },
  language: { pattern: /\b(language|idioma|langue|sprache|lingua|idioma|speak|hablas|parlez|sprechen|parli|fala)\b/i, weight: 0.6 },
  farewell: { pattern: /\b(bye|goodbye|see you|farewell|adios|au revoir|tschüss|arrivederci|tchau|chao)\b/i, weight: 0.8 },
};

function classifyIntent(text) {
  const lower = text.toLowerCase();
  let bestIntent = 'inquiry';
  let bestScore = 0;
  
  for (const [intent, config] of Object.entries(INTENT_PATTERNS)) {
    const matches = (lower.match(config.pattern) || []).length;
    const score = matches * config.weight;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }
  
  return bestIntent;
}

// ═══════════════════════════════════════════════════════════
//  MULTI-LANGUAGE RESPONSES
// ═══════════════════════════════════════════════════════════

const RESPONSES = {
  en: {
    greeting: (h) => `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}! I'm SiteMind, your AI sales assistant. How can I help you today? You can ask about services, pricing, hours, or book an appointment.`,
    greetingReturning: 'Welcome back! How can I help you today?',
    inquiry: "I'd love to help with that! Could you tell me a bit more so I can give you the best information?",
    booking_start: "I'd be happy to help you book! Let me ask a few questions.",
    booking_name: "First, what's your name?",
    booking_contact: "Great! What's the best email or phone to reach you?",
    booking_date: "What date works best for you?",
    booking_time: "And what time would you prefer?",
    booking_service: "Which service are you interested in?",
    booking_confirm: (d) => `Let me confirm:\n📅 ${d.date || 'TBD'}\n⏰ ${d.time || 'TBD'}\n👤 ${d.name}\n📞 ${d.contact}\n📋 ${d.service || 'Consultation'}\n\nShall I book this?`,
    booking_done: (d) => `✅ Booked for ${d.date} at ${d.time}! You'll get a confirmation email.`,
    booking_cancel: "No problem! Let me know if you change your mind.",
    pricing: "Great question! Our pricing is tailored to each service. Could you share what you're looking for so I can provide accurate info?",
    hours: "We're open Mon-Fri, 9 AM to 6 PM. We also offer after-hours support through me!",
    contact: "I'll connect you with the right person. What's the best way to reach you?",
    thanks: "You're welcome! Happy to help. 😊",
    language: "I support English, Spanish, French, German, Italian, and Portuguese. Which do you prefer?",
    farewell: "Thanks for chatting! Have a great day! 😊",
    fallback: "I want to make sure I understand. Could you tell me more about what you need?",
  },
  es: {
    greeting: (h) => `${h < 12 ? '¡Buenos días' : h < 17 ? '¡Buenas tardes' : '¡Buenas noches'}! Soy SiteMind, tu asistente AI. ¿Cómo puedo ayudarte?`,
    inquiry: "¡Claro! Cuéntame un poco más para darte la mejor información.",
    booking_start: "¡Te ayudo a agendar! Déjame hacerte unas preguntas.",
    booking_name: "Primero, ¿cuál es tu nombre?",
    booking_contact: "¡Genial! ¿Cuál es tu correo o teléfono?",
    booking_date: "¿Qué fecha te funciona?",
    booking_time: "¿Y qué horario prefieres?",
    booking_service: "¿Qué servicio te interesa?",
    booking_confirm: (d) => `Confirma:\n📅 ${d.date || 'TBD'}\n⏰ ${d.time || 'TBD'}\n👤 ${d.name}\n📞 ${d.contact}\n📋 ${d.service || 'Consulta'}\n\n¿Agendamos?`,
    booking_done: (d) => `✅ Agendado para ${d.date} a las ${d.time}! Recibirás un correo.`,
    booking_cancel: "¡Sin problema! Avísame si cambias de opinión.",
    pricing: "Nuestros precios dependen del servicio. ¿Qué estás buscando?",
    hours: "Abrimos lun-vie, 9 AM a 6 PM. ¡También te atiendo fuera de horario!",
    contact: "Te conectaré con la persona indicada. ¿Cómo prefieres que te contacten?",
    thanks: "¡De nada! Un placer ayudar. 😊",
    language: "Hablo español, inglés, francés, alemán, italiano y portugués. ¿Cuál prefieres?",
    farewell: "¡Gracias por escribir! ¡Que tengas un excelente día! 😊",
    fallback: "Quiero asegurarme de entenderte. ¿Me cuentas más sobre lo que necesitas?",
  },
  fr: {
    greeting: (h) => `${h < 12 ? 'Bonjour' : h < 17 ? 'Bon après-midi' : 'Bonsoir'} ! Je suis SiteMind, votre assistant IA. Comment puis-je vous aider ?`,
    inquiry: "Avec plaisir ! Pouvez-vous m'en dire un peu plus ?",
    booking_start: "Je vous aide à réserver ! Laissez-moi vous poser quelques questions.",
    booking_name: "D'abord, quel est votre nom ?",
    booking_contact: "Parfait ! Quel est votre email ou téléphone ?",
    booking_date: "Quelle date vous convient ?",
    booking_time: "Et à quelle heure préférez-vous ?",
    booking_service: "Quel service vous intéresse ?",
    booking_confirm: (d) => `Confirmez :\n📅 ${d.date || 'TBD'}\n⏰ ${d.time || 'TBD'}\n👤 ${d.name}\n📞 ${d.contact}\n📋 ${d.service || 'Consultation'}\n\nJe réserve ?`,
    booking_done: (d) => `✅ Réservé pour ${d.date} à ${d.time} ! Vous recevrez un email.`,
    booking_cancel: "Pas de problème ! Revenez quand vous voulez.",
    pricing: "Nos tarifs dépendent du service. Que recherchez-vous ?",
    hours: "Ouvert lun-ven, 9h-18h. Aussi disponible après les heures !",
    contact: "Je vous mets en relation. Comment préférez-vous être contacté ?",
    thanks: "De rien ! Ravi de vous aider. 😊",
    language: "Je parle français, anglais, espagnol, allemand, italien et portugais. Quelle langue préférez-vous ?",
    farewell: "Merci ! Passez une excellente journée ! 😊",
    fallback: "Je veux être sûr de bien comprendre. Pouvez-vous m'en dire plus ?",
  },
  de: {
    greeting: (h) => `${h < 12 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend'}! Ich bin SiteMind, Ihr KI-Assistent. Wie kann ich helfen?`,
    inquiry: "Gerne! Erzählen Sie mir mehr, damit ich Ihnen besser helfen kann.",
    booking_start: "Ich buche gerne für Sie! Ein paar Fragen dazu.",
    booking_name: "Zuerst: Ihr Name?",
    booking_contact: "Perfekt! Ihre E-Mail oder Telefonnummer?",
    booking_date: "Welches Datum passt Ihnen?",
    booking_time: "Und welche Uhrzeit?",
    booking_service: "Welche Dienstleistung interessiert Sie?",
    booking_confirm: (d) => `Bestätigung:\n📅 ${d.date || 'TBD'}\n⏰ ${d.time || 'TBD'}\n👤 ${d.name}\n📞 ${d.contact}\n📋 ${d.service || 'Beratung'}\n\nBuchen?`,
    booking_done: (d) => `✅ Gebucht für ${d.date} um ${d.time}! Sie erhalten eine Bestätigung.`,
    booking_cancel: "Kein Problem! Melden Sie sich einfach wieder.",
    pricing: "Unsere Preise richten sich nach der Dienstleistung. Was suchen Sie?",
    hours: "Geöffnet Mo-Fr, 9-18 Uhr. Auch außerhalb der Geschäftszeiten erreichbar!",
    contact: "Ich verbinde Sie mit der richtigen Person. Wie möchten Sie kontaktiert werden?",
    thanks: "Gern geschehen! 😊",
    language: "Ich spreche Deutsch, Englisch, Spanisch, Französisch, Italienisch und Portugiesisch. Welche Sprache bevorzugen Sie?",
    farewell: "Danke für Ihr Interesse! Einen schönen Tag! 😊",
    fallback: "Ich möchte sichergehen, dass ich Sie richtig verstehe. Können Sie mehr erzählen?",
  },
};

// ═══════════════════════════════════════════════════════════
//  CONVERSATION STATE MACHINE
// ═══════════════════════════════════════════════════════════

class ConversationSession {
  constructor(options = {}) {
    this.id = options.id || 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    this.createdAt = Date.now();
    this.lastActive = Date.now();
    this.language = options.language || 'en';
    this.businessName = options.businessName || 'SiteMind';
    
    // Booking flow state
    this.booking = null;     // null | 'active' | 'confirmed' | 'cancelled'
    this.bookingStep = 0;    // 0-5 (name, contact, date, time, service, confirm)
    this.bookingData = {};   // Collected data
    
    // Conversation history
    this.history = [
      { role: 'system', content: `You are SiteMind, an AI sales assistant for ${this.businessName}. Be helpful, friendly, and concise. Help visitors book appointments, answer questions, and handle inquiries.` }
    ];
    this.messageCount = 0;
    
    // Debug info
    this.intents = [];
  }

  /** Touch the session to keep it alive */
  touch() {
    this.lastActive = Date.now();
  }

  /** Check if session has expired (> 30 min inactivity) */
  get expired() {
    return Date.now() - this.lastActive > 30 * 60 * 1000;
  }

  /** Get response for current language */
  t(key, ...args) {
    const lang = RESPONSES[this.language] || RESPONSES.en;
    const text = lang[key] || RESPONSES.en[key] || '';
    return typeof text === 'function' ? text(...args) : text;
  }
}

// ═══════════════════════════════════════════════════════════
//  CHAT ENGINE
// ═══════════════════════════════════════════════════════════

class ChatEngine {
  constructor(options = {}) {
    this.sessions = new Map();
    this.maxSessions = options.maxSessions || 1000;
    this.sessionTTL = options.sessionTTL || 30 * 60 * 1000; // 30 min
    
    // Optional OpenAI integration
    this.openai = null;
    if (options.openaiApiKey) {
      try {
        // Dynamic import for optional dependency
        const OpenAI = require('openai');
        this.openai = new OpenAI({ apiKey: options.openaiApiKey });
        this.openaiModel = options.openaiModel || 'gpt-4o-mini';
      } catch (e) {
        console.log('[ChatEngine] OpenAI not available, using rule-based engine');
      }
    }
  }

  /** Get or create a session */
  getSession(sessionId, lang) {
    // Clean expired sessions
    this._cleanExpired();
    
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      session.touch();
      return session;
    }
    
    const session = new ConversationSession({
      id: sessionId,
      language: lang || 'en',
    });
    
    if (this.sessions.size < this.maxSessions) {
      this.sessions.set(session.id, session);
    }
    
    return session;
  }

  /** Clean expired sessions */
  _cleanExpired() {
    for (const [id, session] of this.sessions) {
      if (session.expired) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Process a user message and return a response
   * @param {string} sessionId - Conversation session ID
   * @param {string} message - User's message
   * @param {object} options - Optional: { language, businessName }
   * @returns {object} { response, intent, booking, language, sessionId }
   */
  async processMessage(sessionId, message, options = {}) {
    const text = message.trim();
    if (!text) {
      return { response: 'Please type a message.', intent: 'inquiry', booking: null, language: 'en' };
    }

    // Detect language
    const detectedLang = options.language || detectLanguage(text);
    
    // Get or create session
    const session = this.getSession(sessionId, detectedLang);
    if (options.businessName) session.businessName = options.businessName;
    
    // Update language if detected
    if (detectedLang !== session.language && options.language !== session.language) {
      session.language = detectedLang;
    }
    
    session.messageCount++;

    // Try OpenAI first
    if (this.openai) {
      try {
        const result = await this._processWithOpenAI(session, text);
        return {
          response: result.response,
          intent: result.intent,
          booking: session.booking === 'confirmed' ? { ...session.bookingData } : null,
          language: session.language,
          sessionId: session.id,
          provider: 'openai',
        };
      } catch (err) {
        console.error('[ChatEngine] OpenAI error, falling back to rules:', err.message);
      }
    }

    // Fallback to rule-based engine
    const result = this._processWithRules(session, text);
    return {
      response: result.response,
      intent: result.intent,
      booking: session.booking === 'confirmed' ? { ...session.bookingData } : null,
      language: session.language,
      sessionId: session.id,
      provider: 'rules',
    };
  }

  /**
   * Process with OpenAI LLM
   */
  async _processWithOpenAI(session, text) {
    const lang = session.language;
    const langInstruction = lang !== 'en' 
      ? `\nIMPORTANT: The user is speaking ${RESPONSES[lang]?.name || lang}. Always respond in their language.`
      : '';
    
    const bookingContext = session.booking === 'active' 
      ? `\nBooking in progress (step ${session.bookingStep}/5): ${JSON.stringify(session.bookingData)}`
      : '';
    
    const systemPrompt = `You are SiteMind, a friendly AI sales assistant for ${session.businessName}. 
Your job is to help website visitors by answering questions and booking appointments.
Be warm, professional, and concise. Keep responses under 3 sentences.${langInstruction}${bookingContext}

When a visitor wants to book, collect these details one at a time:
1. Their name
2. Contact info (email or phone)
3. Preferred date
4. Preferred time
5. Service needed

Then confirm before finalizing.

Respond in JSON format: { "response": "...", "intent": "greeting|booking|pricing|hours|contact|thanks|farewell|inquiry", "booking_step": null|0|1|2|3|4|5, "booking_data": {} | { "name":"...", "contact":"...", etc } }`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.history.slice(-10),
      { role: 'user', content: text },
    ];

    const completion = await this.openai.chat.completions.create({
      model: this.openaiModel,
      messages: messages,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 300,
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { response: raw, intent: 'inquiry' };
    }

    // Update session state from LLM response
    const intent = parsed.intent || 'inquiry';
    session.intents.push(intent);

    if (parsed.booking_step !== undefined) {
      session.booking = 'active';
      session.bookingStep = parsed.booking_step;
      if (parsed.booking_data) {
        session.bookingData = { ...session.bookingData, ...parsed.booking_data };
      }
    }

    if (parsed.intent === 'booking' && parsed.booking_step === undefined) {
      session.booking = 'confirmed';
    }

    // Store in history
    session.history.push({ role: 'user', content: text });
    session.history.push({ role: 'assistant', content: parsed.response || '' });
    if (session.history.length > 20) {
      session.history.splice(1, 2); // Keep system prompt
    }

    return {
      response: parsed.response || 'Let me help you with that!',
      intent: intent,
    };
  }

  /**
   * Process with rule-based engine (fallback)
   */
  _processWithRules(session, text) {
    const lang = session.language;
    const t = (key, ...args) => session.t(key, ...args);
    const lower = text.toLowerCase();
    let intent = classifyIntent(text);

    session.intents.push(intent);

    // Handle booking flow
    if (session.booking === 'active') {
      return this._handleBookingStep(session, text, intent);
    }

    // Handle new booking request
    if (intent === 'booking') {
      session.booking = 'active';
      session.bookingStep = 0;
      session.bookingData = {};
      return { response: t('booking_name'), intent: 'booking' };
    }

    // Handle other intents
    let response = '';
    switch (intent) {
      case 'greeting':
        response = t('greeting', new Date().getHours());
        break;
      case 'thanks':
        response = t('thanks');
        break;
      case 'pricing':
        response = t('pricing');
        break;
      case 'hours':
        response = t('hours');
        break;
      case 'contact':
        response = t('contact');
        break;
      case 'language':
        response = t('language');
        break;
      case 'farewell':
        response = t('farewell');
        break;
      case 'inquiry':
      default:
        response = t('inquiry');
        break;
    }

    return { response, intent };
  }

  /**
   * Handle a step in the booking flow
   */
  _handleBookingStep(session, text, intent) {
    const t = (key, ...args) => session.t(key, ...args);
    
    switch (session.bookingStep) {
      case 0: // Collect name
        session.bookingData.name = text.trim();
        session.bookingStep = 1;
        return { response: t('booking_contact'), intent: 'booking' };

      case 1: // Collect contact
        session.bookingData.contact = text.trim();
        session.bookingStep = 2;
        return { response: t('booking_date'), intent: 'booking' };

      case 2: // Collect date
        session.bookingData.date = text.trim();
        session.bookingStep = 3;
        return { response: t('booking_time'), intent: 'booking' };

      case 3: // Collect time
        session.bookingData.time = text.trim();
        session.bookingStep = 4;
        return { response: t('booking_service'), intent: 'booking' };

      case 4: // Collect service
        session.bookingData.service = text.trim();
        session.bookingStep = 5;
        return { response: t('booking_confirm', session.bookingData), intent: 'booking' };

      case 5: // Confirm
        if (intent === 'greeting' || text.match(/\b(yes|yeah|yep|sure|ok|okay|please|si|sí|oui|ja|confirm|book it|go ahead)\b/i)) {
          session.booking = 'confirmed';
          const { date, time } = session.bookingData;
          return { response: t('booking_done', session.bookingData), intent: 'booking' };
        } else {
          session.booking = 'cancelled';
          session.bookingStep = 0;
          session.bookingData = {};
          return { response: t('booking_cancel'), intent: 'booking' };
        }

      default:
        session.booking = null;
        session.bookingStep = 0;
        return { response: t('fallback'), intent: 'inquiry' };
    }
  }

  /** Get active session count */
  get stats() {
    this._cleanExpired();
    return {
      activeSessions: this.sessions.size,
      totalIntents: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.intents.length, 0),
      bookingCount: Array.from(this.sessions.values()).filter(s => s.booking === 'confirmed').length,
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════

module.exports = { ChatEngine, ConversationSession, detectLanguage, classifyIntent };