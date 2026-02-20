type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceSettings {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  continuousMode: boolean;
  language: string;
}

const VOICE_SETTINGS_KEY = 'dika_voice_settings';

const DEFAULT_SETTINGS: VoiceSettings = {
  voiceURI: null,
  rate: 0.95,
  pitch: 1.0,
  continuousMode: true,
  language: 'auto',
};

function loadSettings(): VoiceSettings {
  try {
    const stored = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings: VoiceSettings) {
  try {
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

const LANGUAGE_MAP: Record<string, string> = {
  'auto': '',
  'en': 'en-US',
  'te': 'te-IN',
  'hi': 'hi-IN',
  'ar': 'ar-SA',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'pt': 'pt-BR',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'zh': 'zh-CN',
  'ta': 'ta-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'mr': 'mr-IN',
  'bn': 'bn-IN',
  'gu': 'gu-IN',
  'ur': 'ur-PK',
};

export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function getSupportedLanguages() {
  return Object.entries(LANGUAGE_MAP).map(([code, bcp]) => ({
    code,
    bcp,
    label: code === 'auto' ? 'Auto-detect' :
      code === 'en' ? 'English' :
      code === 'te' ? 'Telugu (తెలుగు)' :
      code === 'hi' ? 'Hindi (हिन्दी)' :
      code === 'ar' ? 'Arabic (العربية)' :
      code === 'es' ? 'Spanish (Español)' :
      code === 'fr' ? 'French (Français)' :
      code === 'de' ? 'German (Deutsch)' :
      code === 'pt' ? 'Portuguese (Português)' :
      code === 'ja' ? 'Japanese (日本語)' :
      code === 'ko' ? 'Korean (한국어)' :
      code === 'zh' ? 'Chinese (中文)' :
      code === 'ta' ? 'Tamil (தமிழ்)' :
      code === 'kn' ? 'Kannada (ಕನ್ನಡ)' :
      code === 'ml' ? 'Malayalam (മലയാളം)' :
      code === 'mr' ? 'Marathi (मराठी)' :
      code === 'bn' ? 'Bengali (বাংলা)' :
      code === 'gu' ? 'Gujarati (ગુજરાતી)' :
      code === 'ur' ? 'Urdu (اردو)' : code,
  }));
}

function pickBestVoice(lang?: string): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (voices.length === 0) return null;

  const settings = loadSettings();
  if (settings.voiceURI) {
    const saved = voices.find(v => v.voiceURI === settings.voiceURI);
    if (saved) return saved;
  }

  if (lang && lang !== 'auto' && lang !== 'en') {
    const bcp = LANGUAGE_MAP[lang] || lang;
    const langPrefix = bcp.split('-')[0];
    const langVoice = voices.find(v => v.lang.startsWith(langPrefix));
    if (langVoice) return langVoice;
  }

  const preferred = [
    'Samantha', 'Karen', 'Moira', 'Tessa',
    'Google UK English Female', 'Google US English',
    'Microsoft Zira', 'Microsoft Aria',
  ];
  for (const name of preferred) {
    const found = voices.find(v => v.name.includes(name));
    if (found) return found;
  }

  const femaleVoice = voices.find(v =>
    /female|woman|zira|samantha|karen|moira|tessa|aria/i.test(v.name)
  );
  if (femaleVoice) return femaleVoice;

  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) return englishVoice;

  return voices[0];
}

function detectLanguageFromText(text: string): string {
  const teluguRange = /[\u0C00-\u0C7F]/;
  const hindiRange = /[\u0900-\u097F]/;
  const arabicRange = /[\u0600-\u06FF]/;
  const japaneseRange = /[\u3040-\u309F\u30A0-\u30FF]/;
  const koreanRange = /[\uAC00-\uD7AF]/;
  const chineseRange = /[\u4E00-\u9FFF]/;
  const tamilRange = /[\u0B80-\u0BFF]/;
  const kannadaRange = /[\u0C80-\u0CFF]/;
  const bengaliRange = /[\u0980-\u09FF]/;

  if (teluguRange.test(text)) return 'te';
  if (hindiRange.test(text)) return 'hi';
  if (arabicRange.test(text)) return 'ar';
  if (japaneseRange.test(text)) return 'ja';
  if (koreanRange.test(text)) return 'ko';
  if (chineseRange.test(text)) return 'zh';
  if (tamilRange.test(text)) return 'ta';
  if (kannadaRange.test(text)) return 'kn';
  if (bengaliRange.test(text)) return 'bn';

  return 'en';
}

export class DikaVoiceService {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private settings: VoiceSettings;
  private state: VoiceState = 'idle';
  private onStateChange: ((state: VoiceState) => void) | null = null;
  private onTranscript: ((text: string, isFinal: boolean) => void) | null = null;
  private onError: ((error: string) => void) | null = null;
  private isRecognitionActive = false;
  private shouldRestart = false;
  private detectedLanguage = 'en';

  constructor() {
    this.settings = loadSettings();
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
      this.initRecognition();
    }
  }

  private initRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    if (this.settings.language !== 'auto') {
      this.recognition.lang = LANGUAGE_MAP[this.settings.language] || this.settings.language;
    }

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.detectedLanguage = detectLanguageFromText(finalTranscript);
        this.onTranscript?.(finalTranscript.trim(), true);
      } else if (interimTranscript) {
        this.onTranscript?.(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      this.onError?.(event.error === 'not-allowed'
        ? 'Microphone access denied. Please allow microphone access in your browser settings.'
        : `Voice recognition error: ${event.error}`);
      this.stopListening();
    };

    this.recognition.onend = () => {
      this.isRecognitionActive = false;
      if (this.shouldRestart && this.state === 'listening') {
        setTimeout(() => {
          if (this.shouldRestart) this.startRecognitionSafely();
        }, 100);
      }
    };
  }

  private startRecognitionSafely() {
    if (this.isRecognitionActive || !this.recognition) return;
    try {
      this.isRecognitionActive = true;
      this.recognition.start();
    } catch {
      this.isRecognitionActive = false;
    }
  }

  private setState(newState: VoiceState) {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  isSupported(): boolean {
    const hasSpeechRecognition = typeof window !== 'undefined' &&
      (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));
    return hasSpeechRecognition;
  }

  hasTTS(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  getState(): VoiceState { return this.state; }
  getSettings(): VoiceSettings { return { ...this.settings }; }
  getDetectedLanguage(): string { return this.detectedLanguage; }

  setCallbacks(callbacks: {
    onStateChange?: (state: VoiceState) => void;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
  }) {
    this.onStateChange = callbacks.onStateChange || null;
    this.onTranscript = callbacks.onTranscript || null;
    this.onError = callbacks.onError || null;
  }

  updateSettings(partial: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...partial };
    saveSettings(this.settings);
    if (partial.language && this.recognition) {
      if (partial.language !== 'auto') {
        this.recognition.lang = LANGUAGE_MAP[partial.language] || partial.language;
      } else {
        this.recognition.lang = '';
      }
    }
  }

  startListening() {
    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) {
        this.onError?.('Speech recognition is not supported in this browser.');
        return;
      }
    }
    this.stopSpeaking();
    this.shouldRestart = true;
    this.setState('listening');
    this.startRecognitionSafely();
  }

  stopListening() {
    this.shouldRestart = false;
    if (this.recognition && this.isRecognitionActive) {
      try { this.recognition.stop(); } catch {}
      this.isRecognitionActive = false;
    }
    if (this.state === 'listening') {
      this.setState('idle');
    }
  }

  speak(text: string, onComplete?: () => void) {
    if (!this.synthesis || !this.hasTTS()) {
      onComplete?.();
      return;
    }

    this.synthesis.cancel();

    const cleanText = text
      .replace(/\[chips:.*?\]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/[*_#]/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, '. ')
      .trim();

    if (!cleanText) {
      onComplete?.();
      return;
    }

    const chunks = this.splitIntoChunks(cleanText);
    this.setState('speaking');
    this.speakChunks(chunks, 0, onComplete);
  }

  private splitIntoChunks(text: string): string[] {
    if (text.length <= 180) return [text];
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let current = '';
    for (const sentence of sentences) {
      if (current.length + sentence.length > 180 && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += (current ? ' ' : '') + sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  private speakChunks(chunks: string[], index: number, onComplete?: () => void) {
    if (index >= chunks.length || this.state !== 'speaking') {
      if (this.state === 'speaking') this.setState('idle');
      onComplete?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    const voice = pickBestVoice(this.detectedLanguage);
    if (voice) utterance.voice = voice;
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;

    if (this.detectedLanguage !== 'en') {
      const bcp = LANGUAGE_MAP[this.detectedLanguage];
      if (bcp) utterance.lang = bcp;
    }

    utterance.onend = () => {
      this.speakChunks(chunks, index + 1, onComplete);
    };

    utterance.onerror = () => {
      this.speakChunks(chunks, index + 1, onComplete);
    };

    this.synthesis!.speak(utterance);
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    if (this.state === 'speaking') {
      this.setState('idle');
    }
  }

  stop() {
    this.stopSpeaking();
    this.stopListening();
    this.setState('idle');
  }

  destroy() {
    this.stop();
    this.onStateChange = null;
    this.onTranscript = null;
    this.onError = null;
  }
}

let instance: DikaVoiceService | null = null;

export function getDikaVoiceService(): DikaVoiceService {
  if (!instance) {
    instance = new DikaVoiceService();
  }
  return instance;
}

export type { VoiceState, VoiceSettings };
