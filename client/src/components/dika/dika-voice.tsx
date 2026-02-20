import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, VolumeX, Settings2, Square, MessageCircle, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDikaVoiceService, getAvailableVoices, getSupportedLanguages } from '@/lib/voice-service';
import type { VoiceState } from '@/lib/voice-service';
import { apiRequest } from '@/lib/queryClient';
import { isNative, isIOS } from '@/lib/capacitor-init';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function DikaVoice() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [, setSettingsVersion] = useState(0);
  const voiceService = useRef(getDikaVoiceService());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<VoiceMessage[]>([]);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const loadVoices = () => {
      const voices = getAvailableVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    const vs = voiceService.current;
    vs.setCallbacks({
      onStateChange: setVoiceState,
      onTranscript: (text, isFinal) => {
        if (isFinal) {
          finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + text).trim();
          setTranscript(finalTranscriptRef.current);
          setInterimTranscript('');

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (finalTranscriptRef.current.trim()) {
              handleSendVoice(finalTranscriptRef.current.trim());
            }
          }, 1800);
        } else {
          setInterimTranscript(text);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        }
      },
      onError: (err) => setError(err),
    });
    return () => {
      vs.destroy();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendVoice = useCallback(async (text: string) => {
    if (!text.trim() || !user) return;

    voiceService.current.stopListening();
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    const userMsg: VoiceMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    conversationRef.current = [...conversationRef.current, userMsg];

    setVoiceState('processing');

    try {
      const history = conversationRef.current.slice(-8).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const platform = isNative() && isIOS() ? 'ios_native' : undefined;
      const detectedLang = voiceService.current.getDetectedLanguage();

      const res = await apiRequest('POST', '/api/dika/ask', {
        message: text,
        conversationHistory: history,
        platform,
        voiceMode: true,
        detectedLanguage: detectedLang,
      });
      const data = await res.json();

      let answer = data.answer || "I didn't catch that. Could you try again?";
      answer = answer.replace(/\[chips:.*?\]/g, '').trim();

      const assistantMsg: VoiceMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: answer,
      };
      setMessages(prev => [...prev, assistantMsg]);
      conversationRef.current = [...conversationRef.current, assistantMsg];

      if (!isMuted) {
        voiceService.current.speak(answer, () => {
          const settings = voiceService.current.getSettings();
          if (settings.continuousMode && isOpen) {
            setTimeout(() => {
              voiceService.current.startListening();
            }, 400);
          }
        });
      } else {
        setVoiceState('idle');
        const settings = voiceService.current.getSettings();
        if (settings.continuousMode && isOpen) {
          setTimeout(() => {
            voiceService.current.startListening();
          }, 400);
        }
      }
    } catch (err) {
      setError('Failed to get response. Please try again.');
      setVoiceState('idle');
    }
  }, [user, isMuted, isOpen]);

  const toggleListening = useCallback(() => {
    if (voiceState === 'listening') {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (finalTranscriptRef.current.trim()) {
        handleSendVoice(finalTranscriptRef.current.trim());
      } else {
        voiceService.current.stopListening();
      }
    } else if (voiceState === 'speaking') {
      voiceService.current.stopSpeaking();
    } else {
      setError(null);
      finalTranscriptRef.current = '';
      setTranscript('');
      setInterimTranscript('');
      voiceService.current.startListening();
    }
  }, [voiceState, handleSendVoice]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setError(null);
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: "Hey! I'm Dika, your voice fitness coach. Just tap the mic and talk to me — ask about your workouts, nutrition, health, or tell me to log something. I'm all ears!",
      }]);
    }
  }, [messages.length]);

  const handleClose = useCallback(() => {
    voiceService.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setIsOpen(false);
    setShowSettings(false);
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: "Fresh start! What's on your mind?",
    }]);
    conversationRef.current = [];
  }, []);

  if (!user || user.hideDika) return null;

  const vs = voiceService.current;
  const isSupported = vs.isSupported();
  const settings = vs.getSettings();

  if (!isSupported) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          data-testid="button-dika-voice-open"
          aria-label="Open Dika Voice"
        >
          <Mic className="w-5 h-5" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-md" data-testid="dika-voice-panel">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold" data-testid="text-dika-voice-title">Dika Voice</h2>
                <p className="text-xs text-muted-foreground">
                  {voiceState === 'listening' ? (settings.language !== 'auto' && settings.language !== 'en' 
                    ? `Listening in ${getSupportedLanguages().find(l => l.code === settings.language)?.label || settings.language}...` 
                    : 'Listening...') :
                   voiceState === 'processing' ? 'Thinking...' :
                   voiceState === 'speaking' ? 'Speaking...' : 'Tap mic to talk'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMuted(!isMuted)} data-testid="button-voice-mute">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)} data-testid="button-voice-settings">
                <Settings2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearConversation} data-testid="button-voice-clear">
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose} data-testid="button-dika-voice-close">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {showSettings && (
            <div className="px-4 py-3 border-b space-y-3 bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Language (important for non-English)</Label>
                <Select
                  value={settings.language}
                  onValueChange={(val) => { vs.updateSettings({ language: val }); setSettingsVersion(v => v + 1); }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="select-voice-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getSupportedLanguages().map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {settings.language === 'auto' && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">Set your language for best recognition accuracy</p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Continuous Conversation</Label>
                <Switch
                  checked={settings.continuousMode}
                  onCheckedChange={(checked) => { vs.updateSettings({ continuousMode: checked }); setSettingsVersion(v => v + 1); }}
                  data-testid="switch-continuous-mode"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Voice</Label>
                <Select
                  value={settings.voiceURI || 'default'}
                  onValueChange={(val) => { vs.updateSettings({ voiceURI: val === 'default' ? null : val }); setSettingsVersion(v => v + 1); }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid="select-voice-type">
                    <SelectValue placeholder="Default (Natural)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (Natural)</SelectItem>
                    {availableVoices.map(v => (
                      <SelectItem key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Speed: {settings.rate.toFixed(2)}x</Label>
                <Slider
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={[settings.rate]}
                  onValueChange={([val]) => { vs.updateSettings({ rate: val }); setSettingsVersion(v => v + 1); }}
                  data-testid="slider-voice-speed"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.role === 'user'
                    ? 'ml-auto bg-emerald-600 text-white rounded-br-md'
                    : 'mr-auto bg-muted rounded-bl-md'
                )}
                data-testid={`voice-message-${msg.role}-${msg.id}`}
              >
                {msg.content}
              </div>
            ))}

            {(transcript || interimTranscript) && voiceState === 'listening' && (
              <div className="ml-auto max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-emerald-600/50 text-white rounded-br-md" data-testid="voice-interim-transcript">
                {transcript}{interimTranscript && <span className="opacity-60"> {interimTranscript}</span>}
              </div>
            )}

            {voiceState === 'processing' && (
              <div className="mr-auto max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-muted rounded-bl-md" data-testid="voice-thinking-indicator">
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            )}

            {error && (
              <div className="text-center text-xs text-destructive px-4 py-2" data-testid="voice-error">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="border-t px-4 py-4 flex flex-col items-center gap-3">
            {voiceState === 'listening' && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 items-end h-6">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-emerald-500 rounded-full animate-pulse"
                      style={{
                        height: `${12 + Math.random() * 12}px`,
                        animationDelay: `${i * 100}ms`,
                        animationDuration: '0.6s',
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Listening...</span>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button
                onClick={toggleListening}
                className={cn(
                  'w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg',
                  voiceState === 'listening'
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-500/30'
                    : voiceState === 'speaking'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30'
                    : voiceState === 'processing'
                    ? 'bg-muted cursor-wait'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-emerald-500/30'
                )}
                disabled={voiceState === 'processing'}
                data-testid="button-voice-mic"
                aria-label={voiceState === 'listening' ? 'Stop listening' : voiceState === 'speaking' ? 'Stop speaking' : 'Start listening'}
              >
                {voiceState === 'listening' ? (
                  <Square className="w-6 h-6" />
                ) : voiceState === 'speaking' ? (
                  <VolumeX className="w-6 h-6" />
                ) : voiceState === 'processing' ? (
                  <div className="w-6 h-6 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {voiceState === 'listening' ? 'Tap to send' :
               voiceState === 'speaking' ? 'Tap to stop' :
               voiceState === 'processing' ? 'Getting response...' :
               'Tap to speak'}
            </p>
            {settings.language === 'auto' && voiceState === 'idle' && (
              <p className="text-[10px] text-muted-foreground/60 text-center mt-1" data-testid="text-language-hint">
                For Telugu/Hindi/other languages, select your language in settings above
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
