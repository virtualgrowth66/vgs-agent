/**
 * SiteMind AI — Floating Voice Widget
 * 
 * A single embeddable snippet that adds a voice-enabled AI sales agent
 * to any website. Floats in the bottom-right corner, shows a circular
 * avatar, and expands into a voice interface on click.
 * 
 * Integrates with voice-engine.js for speech recognition, synthesis,
 * and AI conversation flow.
 * 
 * Usage:
 *   <script src="widget.js"
 *           data-agent-id="your-agent-id"
 *           data-language="en"
 *           data-primary-color="#4F46E5"></script>
 * 
 * Before widget.js, load voice-engine.js:
 *   <script src="voice-engine.js"></script>
 *   <script src="widget.js" data-...></script>
 * 
 * Or use embed.js which bundles everything.
 */

(function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────
  const CONFIG = {
    agentId: document.currentScript?.getAttribute('data-agent-id') || 'default',
    language: document.currentScript?.getAttribute('data-language') || 'en',
    primaryColor: document.currentScript?.getAttribute('data-primary-color') || '#4F46E5',
    position: document.currentScript?.getAttribute('data-position') || 'bottom-right',
    avatarUrl: document.currentScript?.getAttribute('data-avatar') || '',
    greeting: document.currentScript?.getAttribute('data-greeting') || "Hi! I'm your AI assistant. How can I help you today?",
    voiceEnabled: document.currentScript?.getAttribute('data-voice') !== 'false',
    ttsEnabled: document.currentScript?.getAttribute('data-tts') !== 'false',
    autoDetect: document.currentScript?.getAttribute('data-auto-detect') !== 'false',
    businessName: document.currentScript?.getAttribute('data-business') || 'SiteMind',
    // Server mode (connect to backend instead of using browser engine)
    serverUrl: document.currentScript?.getAttribute('data-server-url') || '',
  };

  // ─── State ────────────────────────────────────────────────────────
  const state = {
    isOpen: false,
    isListening: false,
    isSpeaking: false,
    isProcessing: false,
    messages: [],
    sessionId: 'sid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
  };

  // ─── DOM References ───────────────────────────────────────────────
  let container = null;
  let button = null;
  let panel = null;
  let messagesContainer = null;
  let micButton = null;
  let statusDot = null;
  let statusText = null;

  // ─── Voice Engine References ──────────────────────────────────────
  let conversationEngine = null;
  let speechToText = null;
  let textToSpeech = null;

  // ─── SVG Icons (inline, no external deps) ────────────────────────
  const ICONS = {
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    wave: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2a8 8 0 0 1 8 8"/><path d="M11 6a5 5 0 0 1 5 5"/><path d="M8 10a2 2 0 0 1 2 2"/></svg>`,
    speaker: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
    speakerOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`,
  };

  // ─── Inject Styles ───────────────────────────────────────────────
  function injectStyles() {
    const styleId = 'sitemind-widget-styles';
    if (document.getElementById(styleId)) return;

    const css = `
      /* ─── Reset & Base ─── */
      .smnd-widget *,
      .smnd-widget *::before,
      .smnd-widget *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      /* ─── Floating Button ─── */
      .smnd-widget-btn {
        position: fixed;
        z-index: 2147483000;
        bottom: 24px;
        right: 24px;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        padding: 0;
        background: transparent;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        -webkit-tap-highlight-color: transparent;
        outline: none;
      }
      .smnd-widget-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 28px rgba(0,0,0,0.2);
      }
      .smnd-widget-btn:active {
        transform: scale(0.95);
      }

      .smnd-widget-btn-avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        display: block;
        box-shadow: 0 0 0 3px white, 0 0 0 4px rgba(0,0,0,0.06);
      }

      /* ─── Pulse Ring ─── */
      .smnd-widget-btn-pulse {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 3px solid ${CONFIG.primaryColor};
        opacity: 0;
        animation: smnd-pulse 2.5s ease-in-out infinite;
      }
      .smnd-widget-btn-pulse:nth-child(2) {
        animation-delay: 0.8s;
      }
      .smnd-widget-btn-pulse:nth-child(3) {
        animation-delay: 1.6s;
      }

      @keyframes smnd-pulse {
        0% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.25); opacity: 0; }
        100% { transform: scale(1.4); opacity: 0; }
      }

      /* ─── Panel ─── */
      .smnd-widget-panel {
        position: fixed;
        z-index: 2147483001;
        bottom: 100px;
        right: 24px;
        width: 380px;
        max-width: calc(100vw - 48px);
        height: 560px;
        max-height: calc(100vh - 140px);
        background: white;
        border-radius: 20px;
        box-shadow: 0 16px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
        display: flex;
        flex-direction: column;
        transform-origin: bottom right;
        transform: scale(0.9) translateY(20px);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .smnd-widget-panel.open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      /* ─── Header ─── */
      .smnd-widget-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: ${CONFIG.primaryColor};
        color: white;
        flex-shrink: 0;
        border-radius: 20px 20px 0 0;
      }
      .smnd-widget-header-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255,255,255,0.3);
        flex-shrink: 0;
      }
      .smnd-widget-header-info {
        flex: 1;
        min-width: 0;
      }
      .smnd-widget-header-title {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.3;
      }
      .smnd-widget-header-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        opacity: 0.85;
        line-height: 1.3;
      }
      .smnd-widget-header-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #4ade80;
        display: inline-block;
        animation: smnd-dot-pulse 2s ease-in-out infinite;
      }
      .smnd-widget-header-dot.listening {
        background: #f59e0b;
        animation-duration: 0.8s;
      }
      .smnd-widget-header-dot.processing {
        background: #60a5fa;
        animation-duration: 0.5s;
      }
      .smnd-widget-header-dot.speaking {
        background: #a78bfa;
        animation-duration: 0.6s;
      }
      .smnd-widget-header-dot.error {
        background: #ef4444;
        animation: none;
      }
      @keyframes smnd-dot-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      .smnd-widget-header-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        width: 32px;
        height: 32px;
        padding: 6px;
        border-radius: 8px;
        opacity: 0.7;
        transition: opacity 0.2s, background 0.2s;
        flex-shrink: 0;
      }
      .smnd-widget-header-close:hover {
        opacity: 1;
        background: rgba(255,255,255,0.15);
      }
      .smnd-widget-header-close svg {
        width: 100%;
        height: 100%;
      }

      /* ─── Messages ─── */
      .smnd-widget-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: #f8f9fb;
        scroll-behavior: smooth;
      }
      .smnd-widget-messages::-webkit-scrollbar {
        width: 4px;
      }
      .smnd-widget-messages::-webkit-scrollbar-track {
        background: transparent;
      }
      .smnd-widget-messages::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 2px;
      }

      .smnd-msg {
        display: flex;
        gap: 8px;
        max-width: 88%;
        animation: smnd-msg-in 0.3s ease;
      }
      @keyframes smnd-msg-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .smnd-msg.bot {
        align-self: flex-start;
      }
      .smnd-msg.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .smnd-msg-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .smnd-msg-bubble {
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
        white-space: pre-wrap;
      }
      .smnd-msg.bot .smnd-msg-bubble {
        background: white;
        color: #1f2937;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      }
      .smnd-msg.user .smnd-msg-bubble {
        background: ${CONFIG.primaryColor};
        color: white;
        border-bottom-right-radius: 4px;
      }

      /* ─── TTS Speaker Button on Bot Messages ─── */
      .smnd-msg-speaker {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        color: #9ca3af;
        flex-shrink: 0;
        margin-top: 4px;
        transition: color 0.2s, background 0.2s;
        display: none;
      }
      .smnd-msg-speaker:hover {
        color: ${CONFIG.primaryColor};
        background: rgba(0,0,0,0.04);
      }
      .smnd-msg-speaker svg {
        width: 100%;
        height: 100%;
      }
      .smnd-msg.bot:hover .smnd-msg-speaker {
        display: block;
      }
      .smnd-msg-speaker.playing {
        display: block;
        color: ${CONFIG.primaryColor};
        background: rgba(99,102,241,0.1);
      }

      /* ─── Typing Indicator ─── */
      .smnd-typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 12px 16px;
      }
      .smnd-typing span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #9ca3af;
        display: inline-block;
        animation: smnd-bounce 1.2s ease-in-out infinite;
      }
      .smnd-typing span:nth-child(2) { animation-delay: 0.2s; }
      .smnd-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes smnd-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-8px); }
      }

      /* ─── Input Area ─── */
      .smnd-widget-input {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid #e5e7eb;
        background: white;
        flex-shrink: 0;
      }
      .smnd-widget-input-field {
        flex: 1;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 10px 14px;
        font-size: 14px;
        font-family: inherit;
        line-height: 1.4;
        outline: none;
        resize: none;
        max-height: 120px;
        transition: border-color 0.2s, box-shadow 0.2s;
        min-height: 42px;
      }
      .smnd-widget-input-field:focus {
        border-color: ${CONFIG.primaryColor};
        box-shadow: 0 0 0 3px ${CONFIG.primaryColor}22;
      }
      .smnd-widget-input-field::placeholder {
        color: #9ca3af;
      }

      .smnd-widget-input-btn {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        border: none;
        background: ${CONFIG.primaryColor};
        color: white;
        cursor: pointer;
        padding: 10px;
        transition: background 0.2s, transform 0.15s;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .smnd-widget-input-btn:hover {
        filter: brightness(1.1);
      }
      .smnd-widget-input-btn:active {
        transform: scale(0.92);
      }
      .smnd-widget-input-btn.listening {
        background: #ef4444;
        animation: smnd-mic-pulse 1.2s ease-in-out infinite;
      }
      @keyframes smnd-mic-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      }
      .smnd-widget-input-btn svg {
        width: 100%;
        height: 100%;
      }

      /* ─── Voice Waveform (listening) ─── */
      .smnd-widget-wave {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 42px;
        padding: 0 8px;
      }
      .smnd-widget-wave.active {
        display: flex;
      }
      .smnd-widget-wave-bar {
        width: 4px;
        background: ${CONFIG.primaryColor};
        border-radius: 2px;
        animation: smnd-wave 0.6s ease-in-out infinite alternate;
      }
      .smnd-widget-wave-bar:nth-child(1) { height: 16px; animation-delay: 0s; }
      .smnd-widget-wave-bar:nth-child(2) { height: 24px; animation-delay: 0.1s; }
      .smnd-widget-wave-bar:nth-child(3) { height: 32px; animation-delay: 0.2s; }
      .smnd-widget-wave-bar:nth-child(4) { height: 20px; animation-delay: 0.15s; }
      .smnd-widget-wave-bar:nth-child(5) { height: 28px; animation-delay: 0.05s; }
      @keyframes smnd-wave {
        from { transform: scaleY(0.5); }
        to { transform: scaleY(1); }
      }

      /* ─── Booking Status Bar ─── */
      .smnd-booking-bar {
        display: none;
        align-items: center;
        gap: 8px;
        padding: 8px 20px;
        background: #f0fdf4;
        border-bottom: 1px solid #bbf7d0;
        font-size: 12px;
        color: #166534;
        flex-shrink: 0;
      }
      .smnd-booking-bar.active {
        display: flex;
      }
      .smnd-booking-bar-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }
      .smnd-booking-bar-icon svg {
        width: 100%;
        height: 100%;
      }
      .smnd-booking-bar-text {
        flex: 1;
      }
      .smnd-booking-bar-step {
        display: flex;
        gap: 4px;
        align-items: center;
      }
      .smnd-booking-bar-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #d1d5db;
      }
      .smnd-booking-bar-dot.active {
        background: #22c55e;
      }
      .smnd-booking-bar-dot.done {
        background: #22c55e;
      }

      /* ─── Mobile Responsive ─── */
      @media (max-width: 480px) {
        .smnd-widget-btn {
          bottom: 16px;
          right: 16px;
          width: 56px;
          height: 56px;
        }
        .smnd-widget-panel {
          bottom: 0;
          right: 0;
          left: 0;
          width: 100%;
          max-width: 100%;
          height: 100%;
          max-height: 100%;
          border-radius: 0;
        }
        .smnd-widget-header {
          border-radius: 0;
          padding: 14px 16px;
        }
        .smnd-widget-messages {
          padding: 12px 16px;
        }
      }
    `;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Default Avatar ───────────────────────────────────────────────
  function getDefaultAvatarSrc() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${CONFIG.primaryColor}"/>
          <stop offset="100%" style="stop-color:${CONFIG.primaryColor}dd"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="512" fill="url(#bg)"/>
      <circle cx="512" cy="380" r="160" fill="white" opacity="0.9"/>
      <ellipse cx="512" cy="820" rx="260" ry="200" fill="white" opacity="0.9"/>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  // ─── Initialize Voice Engine ──────────────────────────────────────
  function initVoiceEngine() {
    const Voice = window.SiteMindVoice;
    if (!Voice) {
      console.warn('[SiteMind] voice-engine.js not loaded. Run in demo mode.');
      return false;
    }

    // Create conversation engine
    conversationEngine = Voice.createEngine({
      language: CONFIG.language,
      autoDetect: CONFIG.autoDetect,
      businessName: CONFIG.businessName,
      onStateChange: handleConversationState,
      onBookingComplete: handleBookingComplete,
      onResponse: () => {},
    });

    // Create speech-to-text
    if (CONFIG.voiceEnabled && Voice.SpeechToText.isSupported()) {
      speechToText = new Voice.SpeechToText({
        language: Voice.LanguageDetector.getSTTCode(CONFIG.language),
        continuous: false,
        interimResults: true,
        onResult: handleSpeechResult,
        onInterim: handleSpeechInterim,
        onEnd: handleSpeechEnd,
        onError: handleSpeechError,
      });
    }

    // Create text-to-speech
    if (CONFIG.ttsEnabled && Voice.TextToSpeech.isSupported()) {
      textToSpeech = new Voice.TextToSpeech({
        language: Voice.LanguageDetector.getSpeechCode(CONFIG.language),
        rate: 1.0,
        pitch: 1.0,
        onStart: () => {
          state.isSpeaking = true;
          updateStatus('speaking');
        },
        onEnd: () => {
          state.isSpeaking = false;
          updateStatus('online');
        },
        onError: () => {
          state.isSpeaking = false;
          updateStatus('online');
        },
      });
    }

    return true;
  }

  // ─── Conversation State Handler ───────────────────────────────────
  function handleConversationState(step) {
    const bar = document.getElementById('smnd-booking-bar');
    const text = document.getElementById('smnd-booking-text');
    if (!bar || !text) return;

    const stepLabels = {
      idle: '',
      booking_name: 'Booking: Tell me your name...',
      booking_contact: 'Booking: What is your contact info?',
      booking_date: 'Booking: What date works for you?',
      booking_time: 'Booking: What time works best?',
      booking_service: 'Booking: What service do you need?',
      booking_confirm: 'Booking: Please confirm the details...',
      booking_confirmed: 'Booking: Confirmed! ✅',
    };

    if (step === 'idle' || step === 'booking_confirmed') {
      bar.classList.remove('active');
    } else {
      bar.classList.add('active');
      text.textContent = stepLabels[step] || 'Booking in progress...';
    }
  }

  // ─── Booking Complete Handler ─────────────────────────────────────
  function handleBookingComplete(data) {
    console.log('[SiteMind] Booking completed:', data);
    // TODO: Send booking data to backend API
    // This will be connected to Google Calendar/Calendly/email in next phase
  }

  // ─── Create Widget Structure ─────────────────────────────────────
  function createWidget() {
    container = document.createElement('div');
    container.className = 'smnd-widget';
    container.setAttribute('aria-label', 'SiteMind AI Assistant');

    // ─── Floating Button ───
    button = document.createElement('button');
    button.className = 'smnd-widget-btn';
    button.setAttribute('aria-label', 'Open AI Assistant');
    
    const btnInner = document.createElement('div');
    btnInner.style.cssText = 'position:relative;width:100%;height:100%;';
    
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement('div');
      ring.className = 'smnd-widget-btn-pulse';
      btnInner.appendChild(ring);
    }
    
    const avatarImg = document.createElement('img');
    avatarImg.className = 'smnd-widget-btn-avatar';
    avatarImg.src = CONFIG.avatarUrl || getDefaultAvatarSrc();
    avatarImg.alt = 'AI Assistant';
    avatarImg.draggable = false;
    btnInner.appendChild(avatarImg);
    
    button.appendChild(btnInner);

    // ─── Panel ───
    panel = document.createElement('div');
    panel.className = 'smnd-widget-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'smnd-widget-header';
    header.innerHTML = `
      <img class="smnd-widget-header-avatar" src="${CONFIG.avatarUrl || getDefaultAvatarSrc()}" alt="AI" draggable="false">
      <div class="smnd-widget-header-info">
        <div class="smnd-widget-header-title">SiteMind AI</div>
        <div class="smnd-widget-header-status">
          <span class="smnd-widget-header-dot" id="smnd-status-dot"></span>
          <span id="smnd-status-text">Online</span>
        </div>
      </div>
      <button class="smnd-widget-header-close" id="smnd-close-btn" aria-label="Close">
        ${ICONS.close}
      </button>
    `;
    panel.appendChild(header);

    // Booking progress bar
    const bookingBar = document.createElement('div');
    bookingBar.className = 'smnd-booking-bar';
    bookingBar.id = 'smnd-booking-bar';
    bookingBar.innerHTML = `
      <div class="smnd-booking-bar-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <span class="smnd-booking-bar-text" id="smnd-booking-text">Booking in progress...</span>
    `;
    panel.appendChild(bookingBar);

    // Messages
    messagesContainer = document.createElement('div');
    messagesContainer.className = 'smnd-widget-messages';
    messagesContainer.id = 'smnd-messages';
    panel.appendChild(messagesContainer);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'smnd-widget-input';
    inputArea.innerHTML = `
      <textarea class="smnd-widget-input-field" id="smnd-input" 
        placeholder="Type your message..." rows="1" 
        aria-label="Type your message"></textarea>
      <div class="smnd-widget-wave" id="smnd-wave">
        <div class="smnd-widget-wave-bar"></div>
        <div class="smnd-widget-wave-bar"></div>
        <div class="smnd-widget-wave-bar"></div>
        <div class="smnd-widget-wave-bar"></div>
        <div class="smnd-widget-wave-bar"></div>
      </div>
      <button class="smnd-widget-input-btn" id="smnd-mic-btn" aria-label="Voice input">
        ${ICONS.mic}
      </button>
    `;
    panel.appendChild(inputArea);

    container.appendChild(button);
    container.appendChild(panel);
    document.body.appendChild(container);

    // ─── Cache refs ───
    statusDot = document.getElementById('smnd-status-dot');
    statusText = document.getElementById('smnd-status-text');
    messagesContainer = document.getElementById('smnd-messages');
    micButton = document.getElementById('smnd-mic-btn');

    // ─── Bind Events ───
    button.addEventListener('click', togglePanel);
    document.getElementById('smnd-close-btn').addEventListener('click', closePanel);
    
    const input = document.getElementById('smnd-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleTextInput(input.value);
        input.value = '';
        input.style.height = 'auto';
      }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    micButton.addEventListener('click', toggleListening);

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (state.isOpen && !container.contains(e.target)) {
        closePanel();
      }
    });

    // Esc key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) closePanel();
    });
  }

  // ─── Panel Toggle ────────────────────────────────────────────────
  function togglePanel() {
    if (state.isOpen) closePanel();
    else openPanel();
  }

  function openPanel() {
    state.isOpen = true;
    panel.classList.add('open');
    button.style.opacity = '0';
    button.style.pointerEvents = 'none';
    
    // Show greeting if no messages
    if (state.messages.length === 0) {
      const greeting = conversationEngine
        ? conversationEngine.getGreeting()
        : getBasicGreeting();
      setTimeout(() => addBotMessage(greeting), 400);
    }
    
    document.getElementById('smnd-input').focus();
    updateStatus('online');
  }

  function closePanel() {
    state.isOpen = false;
    panel.classList.remove('open');
    button.style.opacity = '1';
    button.style.pointerEvents = 'all';
    if (state.isListening) stopListening();
    if (state.isSpeaking && textToSpeech) textToSpeech.stop();
  }

  // ─── Basic Greeting (fallback without voice engine) ──────────────
  function getBasicGreeting() {
    const hour = new Date().getHours();
    let t = '';
    if (hour < 12) t = 'Good morning';
    else if (hour < 17) t = 'Good afternoon';
    else t = 'Good evening';
    return `${t}! ${CONFIG.greeting}`;
  }

  // ─── Messages ────────────────────────────────────────────────────
  function addBotMessage(text, skipTts) {
    state.messages.push({ role: 'bot', text });
    renderMessage('bot', text);
    
    // Auto-speak bot messages (unless suppressed)
    if (CONFIG.ttsEnabled && textToSpeech && !skipTts && !state.isSpeaking) {
      const lang = conversationEngine
        ? window.SiteMindVoice.LanguageDetector.getSpeechCode(conversationEngine.currentLanguage)
        : 'en-US';
      textToSpeech.speak(text, lang);
    }
  }

  function addUserMessage(text) {
    state.messages.push({ role: 'user', text });
    renderMessage('user', text);
  }

  function renderMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `smnd-msg ${role}`;
    
    if (role === 'bot') {
      const avatarImg = document.createElement('img');
      avatarImg.className = 'smnd-msg-avatar';
      avatarImg.src = CONFIG.avatarUrl || getDefaultAvatarSrc();
      avatarImg.alt = 'AI';
      avatarImg.draggable = false;
      msgDiv.appendChild(avatarImg);
      
      // Speaker button for TTS
      if (textToSpeech) {
        const speakerBtn = document.createElement('button');
        speakerBtn.className = 'smnd-msg-speaker';
        speakerBtn.innerHTML = ICONS.speaker;
        speakerBtn.setAttribute('aria-label', 'Listen to this message');
        speakerBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (textToSpeech.isSpeaking) {
            textToSpeech.stop();
            speakerBtn.classList.remove('playing');
          } else {
            const lang = conversationEngine
              ? window.SiteMindVoice.LanguageDetector.getSpeechCode(conversationEngine.currentLanguage)
              : 'en-US';
            textToSpeech.speak(text, lang);
            speakerBtn.classList.add('playing');
            textToSpeech.onEnd = () => {
              speakerBtn.classList.remove('playing');
              textToSpeech.onEnd = () => { state.isSpeaking = false; updateStatus('online'); };
            };
          }
        });
        msgDiv.appendChild(speakerBtn);
      }
    }
    
    const bubble = document.createElement('div');
    bubble.className = 'smnd-msg-bubble';
    bubble.textContent = text;
    msgDiv.appendChild(bubble);
    
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'smnd-msg bot';
    typing.id = 'smnd-typing-indicator';
    
    const avatarImg = document.createElement('img');
    avatarImg.className = 'smnd-msg-avatar';
    avatarImg.src = CONFIG.avatarUrl || getDefaultAvatarSrc();
    avatarImg.alt = 'AI';
    avatarImg.draggable = false;
    typing.appendChild(avatarImg);
    
    const bubble = document.createElement('div');
    bubble.className = 'smnd-msg-bubble smnd-typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    typing.appendChild(bubble);
    
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTyping() {
    const typing = document.getElementById('smnd-typing-indicator');
    if (typing) typing.remove();
  }

  // ─── Status Updates ──────────────────────────────────────────────
  function updateStatus(type) {
    if (!statusDot || !statusText) return;
    
    statusDot.className = 'smnd-widget-header-dot';
    switch (type) {
      case 'listening':
        statusDot.classList.add('listening');
        statusText.textContent = 'Listening...';
        break;
      case 'processing':
        statusDot.classList.add('processing');
        statusText.textContent = 'Thinking...';
        break;
      case 'speaking':
        statusDot.classList.add('speaking');
        statusText.textContent = 'Speaking...';
        break;
      case 'error':
        statusDot.classList.add('error');
        statusText.textContent = 'Connection issue';
        break;
      default:
        statusText.textContent = 'Online';
        break;
    }
  }

  // ─── Text Input Handling ─────────────────────────────────────────
  function handleTextInput(text) {
    const trimmed = text.trim();
    if (!trimmed || state.isProcessing) return;
    
    // If speaking, stop
    if (state.isSpeaking && textToSpeech) {
      textToSpeech.stop();
    }
    
    addUserMessage(trimmed);
    state.isProcessing = true;
    updateStatus('processing');
    showTyping();
    
    // Route to server if configured
    if (CONFIG.serverUrl) {
      sendToServer(trimmed);
      return;
    }
    
    // Process with conversation engine or demo mode
    setTimeout(() => {
      hideTyping();
      if (conversationEngine) {
        const response = conversationEngine.process(trimmed);
        if (response) {
          addBotMessage(response);
        } else {
          addBotMessage(getBasicGreeting());
        }
      } else {
        processWithAIDemo(trimmed);
      }
      state.isProcessing = false;
      updateStatus('online');
    }, 500 + Math.random() * 400);
  }

  // ─── Send to Backend Server ─────────────────────────────────────
  async function sendToServer(text) {
    try {
      const res = await fetch(CONFIG.serverUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: state.sessionId,
          language: CONFIG.language,
          businessName: CONFIG.businessName,
        }),
      });
      
      const data = await res.json();
      hideTyping();
      
      if (data.response) {
        addBotMessage(data.response);
      } else {
        addBotMessage("I'm sorry, I couldn't process that right now. Please try again.");
      }
      
      // If a booking was completed, send it to the bookings endpoint
      if (data.booking && data.booking.name) {
        sendBookingToServer(data.booking);
      }
      
      state.isProcessing = false;
      updateStatus('online');
    } catch (err) {
      hideTyping();
      console.error('[SiteMind] Server error:', err);
      addBotMessage("I'm having trouble connecting. Please try again in a moment.");
      state.isProcessing = false;
      updateStatus('online');
    }
  }

  async function sendBookingToServer(booking) {
    if (!CONFIG.serverUrl) return;
    try {
      await fetch(CONFIG.serverUrl + '/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          booking: booking,
          agentId: CONFIG.agentId,
        }),
      });
    } catch (e) {
      console.warn('[SiteMind] Failed to save booking:', e);
    }
  }

  // ─── Voice Input ─────────────────────────────────────────────────
  function toggleListening() {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    if (!window.SiteMindVoice || !CONFIG.voiceEnabled) {
      addBotMessage('Voice input is not available. Please type your message instead.');
      return;
    }
    
    if (!speechToText) {
      addBotMessage('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
      return;
    }
    
    // Update language before starting
    const langCode = conversationEngine
      ? window.SiteMindVoice.LanguageDetector.getSTTCode(conversationEngine.currentLanguage)
      : 'en-US';
    speechToText.setLanguage(langCode);
    
    state.isListening = true;
    micButton.classList.add('listening');
    document.getElementById('smnd-wave').classList.add('active');
    document.getElementById('smnd-input').placeholder = 'Listening...';
    updateStatus('listening');
    
    speechToText.start();
  }

  function stopListening() {
    state.isListening = false;
    micButton.classList.remove('listening');
    document.getElementById('smnd-wave').classList.remove('active');
    document.getElementById('smnd-input').placeholder = 'Type your message...';
    
    if (speechToText) {
      speechToText.stop();
    }
    
    // Only go back to online if not processing
    if (!state.isProcessing) {
      updateStatus('online');
    }
  }

  // ─── Speech Recognition Handlers ─────────────────────────────────
  function handleSpeechResult(text) {
    // Stop listening once we have a result
    stopListening();
    
    // Display what was heard and process it
    if (text && text.trim()) {
      // Temporarily show the spoken text as a "heard" indicator
      handleTextInput(text.trim());
    }
  }

  function handleSpeechInterim(text) {
    // Update placeholder with what's being heard
    const input = document.getElementById('smnd-input');
    if (input) {
      input.placeholder = text ? `Heard: ${text}...` : 'Listening...';
    }
  }

  function handleSpeechEnd() {
    state.isListening = false;
    micButton.classList.remove('listening');
    document.getElementById('smnd-wave').classList.remove('active');
    
    if (!state.isProcessing) {
      updateStatus('online');
    }
  }

  function handleSpeechError(error) {
    state.isListening = false;
    micButton.classList.remove('listening');
    document.getElementById('smnd-wave').classList.remove('active');
    document.getElementById('smnd-input').placeholder = 'Type your message...';
    
    switch (error) {
      case 'NO_SPEECH':
        // Silent - just stop listening
        break;
      case 'NO_MIC':
        addBotMessage('I couldn\'t access your microphone. Please check your mic settings or type your message.');
        break;
      case 'PERMISSION_DENIED':
        addBotMessage('Microphone access was denied. Please allow microphone access in your browser settings, or type your message.');
        break;
      case 'NOT_SUPPORTED':
        addBotMessage('Voice input isn\'t supported in this browser. Please try Chrome or Edge, or type your message.');
        break;
      default:
        addBotMessage('There was an issue with voice recognition. Please try again or type your message.');
    }
    
    updateStatus('online');
  }

  // ─── Demo AI Processing (fallback when voice-engine not loaded) ──
  function processWithAIDemo(userText) {
    const lower = userText.toLowerCase();
    let response = '';
    
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      response = 'Hello! How can I help you today? I can answer questions, book appointments, or connect you with the right person.';
    } else if (lower.includes('book') || lower.includes('appointment') || lower.includes('schedule')) {
      response = 'I\'d be happy to help you book an appointment! Could you let me know what date and time works best for you?';
    } else if (lower.includes('price') || lower.includes('cost') || lower.includes('pricing') || lower.includes('how much')) {
      response = 'Great question! Our pricing depends on the specific services you need. Could you tell me a bit more about what you\'re looking for so I can provide accurate information?';
    } else if (lower.includes('hour') || lower.includes('time') || lower.includes('open') || lower.includes('close')) {
      response = 'We\'re here to help! Our business hours are Monday through Friday, 9 AM to 6 PM. We also offer after-hours support through this assistant.';
    } else if (lower.includes('thank')) {
      response = 'You\'re very welcome! Is there anything else I can help you with?';
    } else if (lower.includes('contact') || lower.includes('phone') || lower.includes('email') || lower.includes('reach')) {
      response = 'I\'ll make sure your message gets to the right team member. Could you share your contact details and I\'ll have someone reach out to you shortly?';
    } else if (lower.includes('language') || lower.includes('spanish') || lower.includes('french')) {
      response = 'This assistant supports multiple languages! I can help you in English, Spanish, French, German, and more. Just let me know your preference.';
    } else {
      response = 'Thank you for your message! Let me look into that for you. In the meantime, would you like to book a consultation so one of our specialists can assist you further?';
    }
    
    addBotMessage(response);
  }

  // ─── Initialize ──────────────────────────────────────────────────
  function init() {
    if (document.querySelector('.smnd-widget')) return;
    
    // Initialize voice engine
    initVoiceEngine();
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectStyles();
        createWidget();
      });
    } else {
      injectStyles();
      createWidget();
    }
  }

  init();
})();