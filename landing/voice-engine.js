/**
 * SiteMind AI — Voice Conversation Engine
 * 
 * Core AI engine for the floating widget. Provides:
 * - Speech-to-Text (browser Web Speech API)
 * - Text-to-Speech (browser Speech Synthesis API)
 * - Multi-language intent detection & responses
 * - Booking conversation flow with state management
 * - Pluggable LLM integration point
 * 
 * This file is loaded by widget.js and exposed as window.SiteMindVoice.
 */

(function () {
  'use strict';

  // ═════════════════════════════════════════════════════════════════
  //  LANGUAGE SUPPORT
  // ═════════════════════════════════════════════════════════════════

  const LANGUAGES = {
    en: { name: 'English', native: 'English', speechCode: 'en-US', sttCode: 'en-US' },
    es: { name: 'Spanish', native: 'Español', speechCode: 'es-ES', sttCode: 'es-ES' },
    fr: { name: 'French', native: 'Français', speechCode: 'fr-FR', sttCode: 'fr-FR' },
    de: { name: 'German', native: 'Deutsch', speechCode: 'de-DE', sttCode: 'de-DE' },
    it: { name: 'Italian', native: 'Italiano', speechCode: 'it-IT', sttCode: 'it-IT' },
    pt: { name: 'Portuguese', native: 'Português', speechCode: 'pt-BR', sttCode: 'pt-BR' },
    zh: { name: 'Chinese', native: '中文', speechCode: 'zh-CN', sttCode: 'zh-CN' },
    ja: { name: 'Japanese', native: '日本語', speechCode: 'ja-JP', sttCode: 'ja-JP' },
    ko: { name: 'Korean', native: '한국어', speechCode: 'ko-KR', sttCode: 'ko-KR' },
    ar: { name: 'Arabic', native: 'العربية', speechCode: 'ar-SA', sttCode: 'ar-SA' },
  };

  const LANGUAGE_PATTERNS = {
    en: /\b(hello|hi|hey|good morning|good afternoon|good evening|how are you|thanks|thank you|yes|no|please|help|book|appointment|schedule|price|cost|how much|hour|time|open|close|contact|phone|email|address|service|info|information)\b/i,
    es: /\b(hola|buenos días|buenas tardes|gracias|sí|no|por favor|ayuda|reservar|cita|programar|precio|costo|cuánto|horario|hora|abierto|cerrado|contacto|teléfono|correo|dirección|servicio|información)\b/i,
    fr: /\b(bonjour|salut|merci|oui|non|s\'il vous plaît|aide|réserver|rendez-vous|planifier|prix|coût|combien|horaire|heure|ouvert|fermé|contact|téléphone|courriel|adresse|service|information)\b/i,
    de: /\b(hallo|guten tag|guten morgen|danke|ja|nein|bitte|hilfe|buchen|termin|planen|preis|kosten|wie viel|öffnungszeiten|stunde|geöffnet|geschlossen|kontakt|telefon|email|adresse|service|information)\b/i,
  };

  // ═════════════════════════════════════════════════════════════════
  //  LANGUAGE DETECTOR
  // ═════════════════════════════════════════════════════════════════

  const LanguageDetector = {
    /** Detect language from text using keyword patterns */
    detect(text) {
      const scores = {};
      for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
        const matches = text.match(pattern);
        if (matches) scores[lang] = matches.length;
      }
      // Also count total word matches per language
      const words = text.toLowerCase().split(/\s+/);
      for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
        if (!scores[lang]) scores[lang] = 0;
        for (const word of words) {
          if (pattern.test(word)) scores[lang] += 0.5;
        }
      }
      if (Object.keys(scores).length === 0) return 'en';
      return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
    },

    /** Detect language from browser/system settings */
    detectBrowser() {
      const lang = (navigator.language || navigator.userLanguage || 'en').slice(0, 2).toLowerCase();
      return LANGUAGES[lang] ? lang : 'en';
    },

    /** Get speech synthesis language code */
    getSpeechCode(lang) {
      return (LANGUAGES[lang] || LANGUAGES.en).speechCode;
    },

    /** Get speech recognition language code */
    getSTTCode(lang) {
      return (LANGUAGES[lang] || LANGUAGES.en).sttCode;
    },

    /** Get language display name */
    getName(lang) {
      return (LANGUAGES[lang] || LANGUAGES.en).native;
    }
  };

  // ═════════════════════════════════════════════════════════════════
  //  MULTI-LANGUAGE RESPONSES
  // ═════════════════════════════════════════════════════════════════

  const RESPONSES = {
    en: {
      greeting: (time) => {
        const t = time < 12 ? 'Good morning' : time < 17 ? 'Good afternoon' : 'Good evening';
        return `${t}! I'm SiteMind, your AI sales assistant. How can I help you today? You can ask me about our services, pricing, hours, or book an appointment.`;
      },
      greetingReturning: 'Welcome back! How can I assist you today?',
      inquiry: 'That\'s a great question! Let me share what I know. Could you tell me a bit more about what you\'re looking for so I can give you the most helpful information?',
      booking_prompt: "I'd be happy to help you book an appointment! Let me ask a few questions to get you scheduled.",
      booking_name: "First, could I have your name?",
      booking_contact: "Great, thank you! What's the best email or phone number to reach you at?",
      booking_date: "Perfect! What date would you like to come in?",
      booking_time: "And what time works best for you?",
      booking_service: "What service are you interested in?",
      booking_confirm: (name, contact, date, time, service) =>
        `Excellent! Let me confirm your booking:\n\n📅 Date: ${date}\n⏰ Time: ${time}\n👤 Name: ${name}\n📞 Contact: ${contact}\n📋 Service: ${service || 'Consultation'}\n\nWould you like me to go ahead and book this?`,
      booking_confirmed: (date, time) =>
        `✅ Your appointment has been booked for ${date} at ${time}! You'll receive a confirmation email shortly. Is there anything else I can help you with?`,
      booking_cancelled: "No problem! If you'd like to book later, just let me know. Is there anything else I can help you with?",
      pricing: 'Our pricing is competitive and depends on the specific service you need. Could you let me know what you\'re looking for so I can provide accurate pricing information?',
      hours: "We're open Monday through Friday, 9 AM to 6 PM. We also offer after-hours support through this assistant. Would you like to book a specific time?",
      contact_prompt: "I'll make sure your message gets to the right person. What's the best way to reach you — email or phone?",
      thanks: "You're very welcome! It was my pleasure helping you. Is there anything else I can assist you with?",
      language_offer: "I can speak multiple languages! Currently I support English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, and Arabic. Just let me know which language you prefer.",
      farewell: "Thank you for reaching out! Have a wonderful day, and don't hesitate to come back if you need anything. 😊",
      fallback: "I want to make sure I understand you correctly. Could you tell me a bit more about what you need help with? You can ask me about services, pricing, hours, or book an appointment.",
      error: "I apologize, but I'm having trouble processing that. Could you try rephrasing or type your question instead?",
      collecting_name: "Thanks! And what name should I use for the appointment?",
      collecting_contact: "Could you share your email or phone number so we can confirm?",
      collecting_date: "What date works best for you?",
      collecting_time: "What time would you prefer?",
      collecting_service: "Which service are you interested in?",
    },
    es: {
      greeting: (time) => {
        const t = time < 12 ? '¡Buenos días' : time < 17 ? '¡Buenas tardes' : '¡Buenas noches';
        return `${t}! Soy SiteMind, tu asistente de ventas AI. ¿Cómo puedo ayudarte hoy? Puedes preguntarme sobre servicios, precios, horarios o agendar una cita.`;
      },
      greetingReturning: '¡Bienvenido de nuevo! ¿Cómo puedo ayudarte hoy?',
      inquiry: '¡Excelente pregunta! Déjame compartir lo que sé. ¿Podrías contarme un poco más sobre lo que buscas para darte la información más útil?',
      booking_prompt: "¡Me encantaría ayudarte a agendar una cita! Déjame hacerte algunas preguntas para programarte.",
      booking_name: "Primero, ¿podría tener tu nombre?",
      booking_contact: "¡Genial! ¿Cuál es el mejor correo o número de teléfono para contactarte?",
      booking_date: "Perfecto. ¿Qué fecha te gustaría venir?",
      booking_time: "¿Y qué horario te funciona mejor?",
      booking_service: "¿Qué servicio te interesa?",
      booking_confirm: (name, contact, date, time, service) =>
        `¡Excelente! Déjame confirmar tu cita:\n\n📅 Fecha: ${date}\n⏰ Hora: ${time}\n👤 Nombre: ${name}\n📞 Contacto: ${contact}\n📋 Servicio: ${service || 'Consulta'}\n\n¿Quieres que agende esta cita?`,
      booking_confirmed: (date, time) =>
        `✅ ¡Tu cita ha sido agendada para ${date} a las ${time}! Recibirás un correo de confirmación pronto. ¿Hay algo más en lo que pueda ayudarte?`,
      booking_cancelled: "¡Sin problema! Si deseas agendar después, solo dímelo. ¿Hay algo más en lo que pueda ayudarte?",
      pricing: 'Nuestros precios son competitivos y dependen del servicio específico que necesites. ¿Podrías decirme qué estás buscando para darte información precisa?',
      hours: "Estamos abiertos de lunes a viernes, de 9 AM a 6 PM. También ofrecemos soporte fuera de horario a través de este asistente. ¿Te gustaría agendar una cita?",
      contact_prompt: "Me aseguraré de que tu mensaje llegue a la persona correcta. ¿Cuál es la mejor forma de contactarte — correo o teléfono?",
      thanks: "¡De nada! Fue un placer ayudarte. ¿Hay algo más en lo que pueda asistirte?",
      language_offer: "¡Puedo hablar varios idiomas! Actualmente apoyo inglés, español, francés, alemán, italiano, portugués, chino, japonés, coreano y árabe. Solo dime qué idioma prefieres.",
      farewell: "¡Gracias por contactarnos! Que tengas un excelente día, y no dudes en volver si necesitas algo. 😊",
      fallback: "Quiero asegurarme de entenderte correctamente. ¿Podrías contarme un poco más sobre lo que necesitas? Puedes preguntarme sobre servicios, precios, horarios o agendar una cita.",
      error: "Lo siento, estoy teniendo dificultades para procesar eso. ¿Podrías intentar reformular o escribir tu pregunta?",
      collecting_name: "Gracias. ¿Y qué nombre debo usar para la cita?",
      collecting_contact: "¿Podrías compartir tu correo o número de teléfono para confirmar?",
      collecting_date: "¿Qué fecha te funciona mejor?",
      collecting_time: "¿Qué horario prefieres?",
      collecting_service: "¿Qué servicio te interesa?",
    },
    fr: {
      greeting: (time) => {
        const t = time < 12 ? 'Bonjour' : time < 17 ? 'Bon après-midi' : 'Bonsoir';
        return `${t}! Je suis SiteMind, votre assistant commercial AI. Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions sur nos services, tarifs, horaires ou prendre rendez-vous.`;
      },
      greetingReturning: 'Bon retour ! Comment puis-je vous aider aujourd\'hui ?',
      booking_prompt: "Je serais ravi de vous aider à prendre rendez-vous ! Laissez-moi vous poser quelques questions.",
      booking_name: "D'abord, pourrais-je avoir votre nom ?",
      booking_contact: "Parfait ! Quel est le meilleur email ou numéro pour vous joindre ?",
      booking_date: "Quelle date vous conviendrait ?",
      booking_time: "Et à quelle heure préférez-vous ?",
      booking_service: "Quel service vous intéresse ?",
      booking_confirm: (name, contact, date, time, service) =>
        `Excellent ! Laissez-moi confirmer votre rendez-vous :\n\n📅 Date : ${date}\n⏰ Heure : ${time}\n👤 Nom : ${name}\n📞 Contact : ${contact}\n📋 Service : ${service || 'Consultation'}\n\nSouhaitez-vous que je réserve cela ?`,
      booking_confirmed: (date, time) =>
        `✅ Votre rendez-vous a été réservé pour le ${date} à ${time} ! Vous recevrez un email de confirmation sous peu. Puis-je vous aider avec autre chose ?`,
      booking_cancelled: "Pas de problème ! Si vous souhaitez réserver plus tard, n'hésitez pas à me le dire. Puis-je vous aider avec autre chose ?",
      pricing: 'Nos tarifs sont compétitifs et dépendent du service spécifique dont vous avez besoin. Pourriez-vous me dire ce que vous cherchez pour que je puisse vous fournir des informations précises ?',
      hours: "Nous sommes ouverts du lundi au vendredi, de 9h à 18h. Nous offrons également un support après les heures d'ouverture via cet assistant. Souhaitez-vous réserver un créneau ?",
      thanks: "De rien ! Ce fut un plaisir de vous aider. Puis-je faire autre chose pour vous ?",
      farewell: "Merci de nous avoir contactés ! Passez une excellente journée, et n'hésitez pas à revenir si vous avez besoin de quoi que ce soit. 😊",
      fallback: "Je veux m'assurer de bien vous comprendre. Pourriez-vous m'en dire un peu plus sur ce dont vous avez besoin ? Vous pouvez me poser des questions sur les services, les tarifs, les horaires ou prendre rendez-vous.",
      error: "Je suis désolé, j'ai du mal à traiter cela. Pourriez-vous reformuler ou taper votre question ?",
      collecting_name: "Merci ! Et quel nom dois-je utiliser pour le rendez-vous ?",
      collecting_contact: "Pourriez-vous partager votre email ou numéro de téléphone pour confirmer ?",
      collecting_date: "Quelle date vous conviendrait le mieux ?",
      collecting_time: "À quelle heure préférez-vous ?",
      collecting_service: "Quel service vous intéresse ?",
    },
    de: {
      greeting: (time) => {
        const t = time < 12 ? 'Guten Morgen' : time < 17 ? 'Guten Tag' : 'Guten Abend';
        return `${t}! Ich bin SiteMind, Ihr KI-Verkaufsassistent. Wie kann ich Ihnen heute helfen? Sie können mich nach unseren Dienstleistungen, Preisen, Öffnungszeiten fragen oder einen Termin buchen.`;
      },
      greetingReturning: 'Willkommen zurück! Wie kann ich Ihnen heute helfen?',
      booking_prompt: "Ich helfe Ihnen gerne bei der Terminbuchung! Lassen Sie mich ein paar Fragen stellen.",
      booking_name: "Zuerst: Darf ich Ihren Namen haben?",
      booking_contact: "Perfekt! Wie ist die beste E-Mail oder Telefonnummer, um Sie zu erreichen?",
      booking_date: "Welches Datum passt Ihnen am besten?",
      booking_time: "Und welche Uhrzeit wäre ideal?",
      booking_service: "Für welche Dienstleistung interessieren Sie sich?",
      booking_confirm: (name, contact, date, time, service) =>
        `Ausgezeichnet! Lassen Sie mich Ihre Buchung bestätigen:\n\n📅 Datum: ${date}\n⏰ Uhrzeit: ${time}\n👤 Name: ${name}\n📞 Kontakt: ${contact}\n📋 Service: ${service || 'Beratung'}\n\nSoll ich diese Buchung vornehmen?`,
      booking_confirmed: (date, time) =>
        `✅ Ihr Termin wurde für ${date} um ${time} gebucht! Sie erhalten in Kürze eine Bestätigungs-E-Mail. Kann ich sonst noch etwas für Sie tun?`,
      booking_cancelled: "Kein Problem! Wenn Sie später buchen möchten, sagen Sie einfach Bescheid. Kann ich sonst noch etwas für Sie tun?",
      pricing: 'Unsere Preise sind wettbewerbsfähig und hängen von der gewünschten Dienstleistung ab. Könnten Sie mir mitteilen, wonach Sie suchen, damit ich Ihnen genaue Preisinformationen geben kann?',
      hours: "Wir haben Montag bis Freitag von 9 bis 18 Uhr geöffnet. Wir bieten auch Unterstützung außerhalb der Geschäftszeiten über diesen Assistenten an. Möchten Sie einen bestimmten Termin buchen?",
      thanks: "Gern geschehen! Es war mir eine Freude, Ihnen zu helfen. Kann ich sonst noch etwas für Sie tun?",
      farewell: "Vielen Dank für Ihre Kontaktaufnahme! Ich wünsche Ihnen einen schönen Tag und Sie können jederzeit wiederkommen, wenn Sie etwas brauchen. 😊",
      fallback: "Ich möchte sicherstellen, dass ich Sie richtig verstehe. Könnten Sie mir etwas mehr darüber erzählen, wobei ich Ihnen helfen kann? Sie können mich nach Dienstleistungen, Preisen, Öffnungszeiten fragen oder einen Termin buchen.",
      error: "Es tut mir leid, aber ich habe Schwierigkeiten, das zu verarbeiten. Könnten Sie es umformulieren oder Ihre Frage eingeben?",
      collecting_name: "Danke! Und welchen Namen soll ich für den Termin verwenden?",
      collecting_contact: "Könnten Sie Ihre E-Mail oder Telefonnummer zur Bestätigung teilen?",
      collecting_date: "Welches Datum passt Ihnen am besten?",
      collecting_time: "Welche Uhrzeit bevorzugen Sie?",
      collecting_service: "Für welche Dienstleistung interessieren Sie sich?",
    },
  };

  // ═════════════════════════════════════════════════════════════════
  //  INTENT DETECTION
  // ═════════════════════════════════════════════════════════════════

  const INTENT_PATTERNS = {
    greeting: /\b(hello|hi|hey|good\s*(morning|afternoon|evening|day)|howdy|greetings|hola|bonjour|hallo)\b/i,
    thanks: /\b(thank|thanks|thank you|gracias|merci|danke|appreciate)\b/i,
    booking: /\b(book|booking|appointment|schedule|schedule|reserve|reservation|cita|rendez-vous|termin|buchen|reservar|agendar|agendar una cita|would like to come in|i want to see|can i come|need to see)\b/i,
    pricing: /\b(price|pricing|cost|how much|rate|fee|price list|package|plan|subscription|precio|costo|tarifa|prix|coût|preis|kosten|wie viel)\b/i,
    hours: /\b(hour|hours|open|close|business hours|working hours|when are you|time|schedule|horario|hora|abierto|horaire|heure|ouvert|öffnungszeiten|stunde|geöffnet)\b/i,
    contact: /\b(contact|phone|telephone|call|email|address|location|reach|message|contacto|teléfono|llamar|correo|contact|téléphone|appeler|courriel|kontakt|telefon|anrufen)\b/i,
    language: /\b(language|idioma|lengua|lenguaje|langue|sprache|lang|speak|hablas|parlez-vous|sprechen)\b/i,
    farewell: /\b(bye|goodbye|see you|farewell|adios|au revoir|tschüss|bye bye|take care|have a good)\b/i,
    yes: /\b(^yes|^yeah|^yep|^sure|^okay|^ok|^please do|^go ahead|^sí|^oui|^ja|yes, please|that sounds good|please proceed)\b/i,
    no: /\b(^no|^nope|^nah|^not now|^maybe later|^no thanks|^no thank you|^nicht|^nein|^non|^no, thanks)\b/i,
    name: /\b(my name is|i am |call me |name's |me llamo|je m'appelle|ich heiße|this is |name )\b/i,
    date: /\b(today|tomorrow|next week|next monday|next tuesday|next wednesday|next thursday|next friday|monday|tuesday|wednesday|thursday|friday|this week|\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    time_pattern: /\b(\d{1,2}\s*(:|\.)\s*\d{2}\s*(am|pm)?|\d{1,2}\s*(am|pm)|at\s+\d|noon|midnight|morning|afternoon|evening)\b/i,
    service: /\b(cleaning|consulting|consultation|checkup|check-up|maintenance|repair|installation|design|development|session|class|lesson|treatment|massage|haircut|consult|meeting|legal|tax|accounting|fitness|training|coaching|therapy|consultation)\b/i,
    contact_detail: /\b([\w.+-]+@[\w-]+\.[\w.]+|\d{3}[\s.-]*\d{3}[\s.-]*\d{4}|\+?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2,4})\b/i,
  };

  // ═════════════════════════════════════════════════════════════════
  //  CONVERSATION ENGINE
  // ═════════════════════════════════════════════════════════════════

  class ConversationEngine {
    constructor(options = {}) {
      this.config = {
        language: options.language || 'en',
        autoDetect: options.autoDetect !== false,
        businessName: options.businessName || 'SiteMind',
        bookingEnabled: options.bookingEnabled !== false,
        onResponse: options.onResponse || (() => {}),
        onStateChange: options.onStateChange || (() => {}),
        onBookingComplete: options.onBookingComplete || (() => {}),
        ...options,
      };

      // Conversation state
      this.flow = null;        // null | 'booking' | 'contact'
      this.flowStep = 0;
      this.collectedData = {};
      this.currentLanguage = this.config.language;
      this.context = [];
      this.isProcessing = false;

      // Detect browser language initially
      if (this.config.autoDetect) {
        const browserLang = LanguageDetector.detectBrowser();
        if (LANGUAGES[browserLang]) {
          this.currentLanguage = browserLang;
        }
      }
    }

    /** Get responses for current language */
    _tx() {
      return RESPONSES[this.currentLanguage] || RESPONSES.en;
    }

    /** Set active language */
    setLanguage(lang) {
      if (LANGUAGES[lang]) {
        this.currentLanguage = lang;
        return true;
      }
      return false;
    }

    /** Detect and switch language from user text */
    _detectLanguage(text) {
      if (!this.config.autoDetect) return;
      const detected = LanguageDetector.detect(text);
      if (detected !== this.currentLanguage && LANGUAGES[detected]) {
        this.currentLanguage = detected;
      }
    }

    /** Classify intent from user text */
    _detectIntent(text) {
      if (this.flow === 'booking') {
        // In booking flow, check for confirmations
        if (INTENT_PATTERNS.yes.test(text)) return 'booking_confirm_yes';
        if (INTENT_PATTERNS.no.test(text)) return 'booking_confirm_no';
      }

      if (INTENT_PATTERNS.farewell.test(text)) return 'farewell';
      if (INTENT_PATTERNS.thanks.test(text)) return 'thanks';
      if (INTENT_PATTERNS.language.test(text)) return 'language';
      
      // Check for name patterns (not in booking flow)
      if (INTENT_PATTERNS.name.test(text)) return 'providing_name';
      
      // Check for contact detail (email/phone)
      if (INTENT_PATTERNS.contact_detail.test(text) && this.flow === 'booking') return 'providing_contact';
      
      if (INTENT_PATTERNS.greeting.test(text)) return 'greeting';
      if (INTENT_PATTERNS.pricing.test(text)) return 'pricing';
      if (INTENT_PATTERNS.hours.test(text)) return 'hours';
      if (INTENT_PATTERNS.contact.test(text)) return 'contact';
      
      // Booking intent (check after other intents)
      if (INTENT_PATTERNS.booking.test(text)) return 'booking';
      
      // Date/time during booking flow
      if (INTENT_PATTERNS.date.test(text) && this.flow === 'booking') return 'providing_date';
      if (INTENT_PATTERNS.time_pattern.test(text) && this.flow === 'booking') return 'providing_time';
      if (INTENT_PATTERNS.service.test(text) && this.flow === 'booking') return 'providing_service';

      return 'inquiry';
    }

    /** Start booking conversation flow */
    _startBooking() {
      this.flow = 'booking';
      this.flowStep = 0;
      this.collectedData = {};
      this.config.onStateChange('booking_name');
      return this._tx().booking_name;
    }

    /** Handle a booking flow step */
    _handleBookingStep(text, intent) {
      const tx = this._tx();

      switch (this.flowStep) {
        case 0: // Collecting name
          if (intent === 'providing_name') {
            // Extract name
            const nameMatch = text.match(/(?:my name is|i am |call me |name's |me llamo|je m'appelle|ich heiße|this is )\s*(.+)/i);
            this.collectedData.name = nameMatch ? nameMatch[1].trim() : text.trim();
          } else {
            this.collectedData.name = text.trim();
          }
          this.flowStep = 1;
          this.config.onStateChange('booking_contact');
          return tx.booking_contact;

        case 1: // Collecting contact
          if (intent === 'providing_contact') {
            this.collectedData.contact = text.trim();
          } else {
            this.collectedData.contact = text.trim();
          }
          this.flowStep = 2;
          this.config.onStateChange('booking_date');
          return tx.booking_date;

        case 2: // Collecting date
          if (intent === 'providing_date' || intent === 'providing_time') {
            // Could be "tomorrow", "next Monday", "March 15", "3/15", etc.
            this.collectedData.date = text.trim();
          } else {
            this.collectedData.date = text.trim();
          }
          this.flowStep = 3;
          this.config.onStateChange('booking_time');
          return tx.booking_time;

        case 3: // Collecting time
          if (intent === 'providing_time') {
            this.collectedData.time = text.trim();
          } else {
            this.collectedData.time = text.trim();
          }
          this.flowStep = 4;
          this.config.onStateChange('booking_service');
          return tx.booking_service;

        case 4: // Collecting service
          this.collectedData.service = intent === 'providing_service' ? text.trim() : (text.trim() || 'Consultation');
          this.flowStep = 5;
          this.config.onStateChange('booking_confirm');
          return tx.booking_confirm(
            this.collectedData.name,
            this.collectedData.contact,
            this.collectedData.date,
            this.collectedData.time,
            this.collectedData.service
          );

        case 5: // Confirm booking
          if (intent === 'booking_confirm_yes') {
            const { date, time } = this.collectedData;
            this.flow = null;
            this.flowStep = 0;
            this.config.onStateChange('booking_confirmed');
            this.config.onBookingComplete({ ...this.collectedData });
            return tx.booking_confirmed(date, time);
          } else {
            this.flow = null;
            this.flowStep = 0;
            this.collectedData = {};
            this.config.onStateChange('idle');
            return tx.booking_cancelled;
          }

        default:
          this.flow = null;
          this.flowStep = 0;
          this.config.onStateChange('idle');
          return tx.fallback;
      }
    }

    /**
     * Main processing method.
     * @param {string} text - User input text
     * @returns {string} AI response
     */
    process(text) {
      if (this.isProcessing) return null;
      this.isProcessing = true;

      try {
        const trimmed = text.trim();
        if (!trimmed) {
          this.isProcessing = false;
          return this._tx().fallback;
        }

        // Store in context
        this.context.push({ role: 'user', text: trimmed });
        if (this.context.length > 20) this.context.shift();

        // Detect language from user input
        this._detectLanguage(trimmed);

        const tx = this._tx();
        const intent = this._detectIntent(trimmed);

        // Handle booking flow if active
        if (this.flow === 'booking') {
          const response = this._handleBookingStep(trimmed, intent);
          this.context.push({ role: 'assistant', text: response });
          this.isProcessing = false;
          return response;
        }

        let response = '';

        switch (intent) {
          case 'greeting':
            response = tx.greeting(new Date().getHours());
            break;

          case 'thanks':
            response = tx.thanks;
            break;

          case 'booking':
            response = this._startBooking();
            break;

          case 'pricing':
            response = tx.pricing;
            break;

          case 'hours':
            response = tx.hours;
            break;

          case 'contact':
            response = tx.contact_prompt;
            break;

          case 'language':
            response = tx.language_offer;
            break;

          case 'farewell':
            response = tx.farewell;
            break;

          case 'inquiry':
          default:
            response = tx.inquiry;
            break;
        }

        this.context.push({ role: 'assistant', text: response });
        this.isProcessing = false;
        return response;
      } catch (err) {
        this.isProcessing = false;
        console.error('[SiteMind Voice] Processing error:', err);
        return this._tx().error;
      }
    }

    /** Reset conversation state */
    reset() {
      this.flow = null;
      this.flowStep = 0;
      this.collectedData = {};
      this.context = [];
      this.isProcessing = false;
      this.config.onStateChange('idle');
    }

    /** Get greeting for current language */
    getGreeting() {
      const tx = this._tx();
      return tx.greeting(new Date().getHours());
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  SPEECH-TO-TEXT (Browser Speech Recognition)
  // ═════════════════════════════════════════════════════════════════

  class SpeechToText {
    constructor(options = {}) {
      this.lang = options.language || 'en-US';
      this.continuous = options.continuous !== false;
      this.interimResults = options.interimResults !== false;
      this.onResult = options.onResult || (() => {});
      this.onInterim = options.onInterim || (() => {});
      this.onEnd = options.onEnd || (() => {});
      this.onError = options.onError || (() => {});
      this.recognition = null;
      this.isRunning = false;
    }

    /** Check if speech recognition is supported */
    static isSupported() {
      return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }

    /** Start listening */
    start(language) {
      if (this.isRunning) return;
      if (!SpeechToText.isSupported()) {
        this.onError('NOT_SUPPORTED');
        return;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.lang = language || this.lang;
      this.recognition.continuous = this.continuous;
      this.recognition.interimResults = this.interimResults;
      this.recognition.maxAlternatives = 1;

      this.recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          this.onInterim(interimTranscript);
        }
        if (finalTranscript) {
          this.onResult(finalTranscript);
        }
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        this.onEnd();
      };

      this.recognition.onerror = (event) => {
        this.isRunning = false;
        if (event.error === 'no-speech') {
          this.onError('NO_SPEECH');
        } else if (event.error === 'aborted') {
          this.onError('ABORTED');
        } else if (event.error === 'audio-capture') {
          this.onError('NO_MIC');
        } else if (event.error === 'not-allowed') {
          this.onError('PERMISSION_DENIED');
        } else {
          this.onError(event.error);
        }
      };

      try {
        this.recognition.start();
        this.isRunning = true;
      } catch (err) {
        this.isRunning = false;
        this.onError('START_FAILED');
      }
    }

    /** Stop listening */
    stop() {
      if (!this.isRunning || !this.recognition) return;
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors on stop
      }
      this.isRunning = false;
    }

    /** Set language */
    setLanguage(lang) {
      this.lang = lang;
      if (this.recognition) {
        this.recognition.lang = lang;
      }
    }

    /** Destroy instance */
    destroy() {
      this.stop();
      this.recognition = null;
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  TEXT-TO-SPEECH (Browser Speech Synthesis)
  // ═════════════════════════════════════════════════════════════════

  class TextToSpeech {
    constructor(options = {}) {
      this.lang = options.language || 'en-US';
      this.rate = options.rate || 1.0;
      this.pitch = options.pitch || 1.0;
      this.volume = options.volume || 1.0;
      this.voice = options.voice || null;
      this.onStart = options.onStart || (() => {});
      this.onEnd = options.onEnd || (() => {});
      this.onError = options.onError || (() => {});
      this.isSpeaking = false;
    }

    /** Check if speech synthesis is supported */
    static isSupported() {
      return 'speechSynthesis' in window;
    }

    /** Get available voices */
    static getVoices() {
      if (!TextToSpeech.isSupported()) return [];
      return window.speechSynthesis.getVoices();
    }

    /** Find best voice for a language */
    static findVoice(langCode) {
      const voices = TextToSpeech.getVoices();
      // Try exact match first
      let voice = voices.find(v => v.lang === langCode && !v.localService === false);
      if (voice) return voice;
      // Try prefix match
      const prefix = langCode.split('-')[0];
      voice = voices.find(v => v.lang.startsWith(prefix));
      return voice || null;
    }

    /** Speak text */
    speak(text, language) {
      if (!TextToSpeech.isSupported()) {
        this.onError('NOT_SUPPORTED');
        return;
      }

      // Cancel any current speech
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language || this.lang;
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      // Try to find matching voice
      const voice = TextToSpeech.findVoice(utterance.lang);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.onStart();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        this.onEnd();
      };

      utterance.onerror = (event) => {
        this.isSpeaking = false;
        this.onError(event.error || 'SYNTHESIS_ERROR');
      };

      // Use setTimeout to work around Chrome speech synthesis bug
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);
    }

    /** Stop speaking */
    stop() {
      if (!TextToSpeech.isSupported()) return;
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }

    /** Pause speaking */
    pause() {
      if (!TextToSpeech.isSupported()) return;
      window.speechSynthesis.pause();
    }

    /** Resume speaking */
    resume() {
      if (!TextToSpeech.isSupported()) return;
      window.speechSynthesis.resume();
    }

    setLanguage(lang) {
      this.lang = lang;
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═════════════════════════════════════════════════════════════════

  const SiteMindVoice = {
    // Classes
    ConversationEngine,
    SpeechToText,
    TextToSpeech,
    LanguageDetector,

    // Constants
    LANGUAGES,
    RESPONSES,

    // Utility
    isSupported: {
      speechRecognition: SpeechToText.isSupported(),
      speechSynthesis: TextToSpeech.isSupported(),
    },

    /** Create a ready-to-use voice engine instance */
    createEngine(options = {}) {
      return new ConversationEngine(options);
    },
  };

  // ═════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═════════════════════════════════════════════════════════════════

  // Check if module system exists
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteMindVoice;
  } else if (typeof define === 'function' && define.amd) {
    define('SiteMindVoice', [], () => SiteMindVoice);
  } else {
    window.SiteMindVoice = SiteMindVoice;
  }
})();