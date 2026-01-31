import { useState, useRef, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Send, Loader2, Settings, Sparkles, Copy, Check, Trash2, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';
import { DikaCircleIcon, SunflowerIcon, BatIcon } from './dika-icons';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

function parseMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let keyCounter = 0;

  const flushList = () => {
    if (currentList.length > 0 && listType) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag 
          key={`list-${keyCounter++}`} 
          className={cn(
            "my-1 ml-4",
            listType === 'ol' ? "list-decimal" : "list-disc"
          )}
        >
          {currentList.map((item, i) => (
            <li key={i} className="ml-1">{parseInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      currentList = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      currentList.push(bulletMatch[1]);
      continue;
    }
    
    const numberedMatch = line.match(/^[\s]*(\d+)[.)]\s+(.+)$/);
    if (numberedMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      currentList.push(numberedMatch[2]);
      continue;
    }
    
    flushList();
    
    if (line.trim() === '') {
      elements.push(<br key={`br-${keyCounter++}`} />);
    } else {
      elements.push(
        <span key={`line-${keyCounter++}`} className="block">
          {parseInlineMarkdown(line)}
        </span>
      );
    }
  }
  
  flushList();
  return elements;
}

function parseInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    
    let nextMatch: { type: 'bold' | 'italic' | 'link'; match: RegExpMatchArray } | null = null;
    
    if (boldMatch && boldMatch.index !== undefined) {
      if (!nextMatch || boldMatch.index < (nextMatch.match.index ?? Infinity)) {
        nextMatch = { type: 'bold', match: boldMatch };
      }
    }
    if (italicMatch && italicMatch.index !== undefined) {
      if (!nextMatch || italicMatch.index < (nextMatch.match.index ?? Infinity)) {
        nextMatch = { type: 'italic', match: italicMatch };
      }
    }
    if (linkMatch && linkMatch.index !== undefined) {
      if (!nextMatch || linkMatch.index < (nextMatch.match.index ?? Infinity)) {
        nextMatch = { type: 'link', match: linkMatch };
      }
    }
    
    if (nextMatch && nextMatch.match.index !== undefined) {
      if (nextMatch.match.index > 0) {
        parts.push(remaining.slice(0, nextMatch.match.index));
      }
      if (nextMatch.type === 'bold') {
        parts.push(<strong key={`bold-${keyCounter++}`} className="font-semibold">{nextMatch.match[1]}</strong>);
      } else if (nextMatch.type === 'italic') {
        parts.push(<em key={`italic-${keyCounter++}`}>{nextMatch.match[1]}</em>);
      } else if (nextMatch.type === 'link') {
        parts.push(
          <a 
            key={`link-${keyCounter++}`} 
            href={nextMatch.match[2]} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
          >
            {nextMatch.match[1]}
          </a>
        );
      }
      remaining = remaining.slice(nextMatch.match.index + nextMatch.match[0].length);
      continue;
    }
    
    parts.push(remaining);
    break;
  }

  return parts;
}

function MarkdownContent({ content }: { content: string }) {
  const parsed = useMemo(() => parseMarkdown(content), [content]);
  return <div className="leading-relaxed">{parsed}</div>;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        setIsListening(false);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, isSupported, toggleListening };
}

function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Fallback for web: use visual viewport
      const viewport = window.visualViewport;
      if (!viewport) return;

      const handleResize = () => {
        const windowHeight = window.innerHeight;
        const viewportHeight = viewport.height;
        const newKeyboardHeight = Math.max(0, windowHeight - viewportHeight);
        setKeyboardHeight(newKeyboardHeight);
      };

      viewport.addEventListener('resize', handleResize);
      viewport.addEventListener('scroll', handleResize);
      
      return () => {
        viewport.removeEventListener('resize', handleResize);
        viewport.removeEventListener('scroll', handleResize);
      };
    }

    // Native platform: use Capacitor Keyboard plugin
    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight);
    });

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showListener.then(handle => handle.remove());
      hideListener.then(handle => handle.remove());
    };
  }, []);

  return keyboardHeight;
}

interface DikaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUpChips?: string[];
}

interface DikaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: DikaMessage[];
  suggestions: string[];
  isLoading: boolean;
  currentIcon: DikaIcon;
  onSend: (message: string) => void;
  onIconChange: (icon: DikaIcon) => void;
  onHide: () => void;
  onClearHistory: () => void;
}

export function DikaDrawer({
  isOpen,
  onClose,
  messages,
  suggestions,
  isLoading,
  currentIcon,
  onSend,
  onIconChange,
  onHide,
  onClearHistory,
}: DikaDrawerProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(prev => prev ? `${prev} ${text}` : text);
  }, []);
  
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput(handleVoiceTranscript);
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardHeight = useKeyboardHeight();

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (keyboardHeight > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [keyboardHeight]);

  const handleInputFocus = () => {
    // Scroll input into view when keyboard opens on mobile
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input.trim());
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onSend(suggestion);
  };

  const iconOptions: { value: DikaIcon; icon: React.FC<{ className?: string }>; label: string }[] = [
    { value: 'circle', icon: DikaCircleIcon, label: 'Dika' },
    { value: 'sunflower', icon: SunflowerIcon, label: 'Sunflower' },
    { value: 'bat', icon: BatIcon, label: 'Bat' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md flex flex-col p-0"
        style={{ 
          height: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh',
          maxHeight: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh'
        }}
        data-testid="drawer-dika"
      >
        <SheetHeader className="px-4 py-4 flex-shrink-0 pr-12 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/30 via-pink-300/30 to-white/30 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-xl font-black text-white font-display drop-shadow-md">D</span>
                  </div>
                </div>
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-300 drop-shadow-lg" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-lg font-semibold text-white">Dika AI</SheetTitle>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 text-white/90 font-medium">
                    Powered by AI
                  </span>
                </div>
                <p className="text-xs text-white/70">Your intelligent gym assistant</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white/80 hover:text-white hover:bg-white/10"
              data-testid="button-dika-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {showSettings && (
          <div className="px-4 py-3 border-b bg-muted/50 flex-shrink-0">
            <p className="text-sm font-medium mb-2">Choose Dika Icon</p>
            <div className="flex gap-2">
              {iconOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={currentIcon === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onIconChange(option.value)}
                  className="flex items-center gap-1"
                  data-testid={`button-icon-${option.value}`}
                >
                  <option.icon className="w-4 h-4" />
                  <span className="text-xs">{option.label}</span>
                </Button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onHide}
                className="text-xs text-muted-foreground"
                data-testid="button-hide-dika"
              >
                Hide Dika
              </Button>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearHistory}
                  className="text-xs text-destructive hover:text-destructive"
                  data-testid="button-clear-history"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear history
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-violet-50/50 to-transparent dark:from-violet-950/20 dark:to-transparent relative">
          {/* Background Art */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Floating circles */}
            <div className="absolute top-10 left-4 w-20 h-20 rounded-full bg-gradient-to-br from-violet-200/30 to-pink-200/30 dark:from-violet-500/10 dark:to-pink-500/10 blur-xl" />
            <div className="absolute top-1/3 right-6 w-16 h-16 rounded-full bg-gradient-to-br from-cyan-200/30 to-blue-200/30 dark:from-cyan-500/10 dark:to-blue-500/10 blur-xl" />
            <div className="absolute bottom-1/4 left-8 w-24 h-24 rounded-full bg-gradient-to-br from-pink-200/20 to-orange-200/20 dark:from-pink-500/10 dark:to-orange-500/10 blur-2xl" />
            <div className="absolute bottom-10 right-10 w-14 h-14 rounded-full bg-gradient-to-br from-purple-200/30 to-indigo-200/30 dark:from-purple-500/10 dark:to-indigo-500/10 blur-xl" />
            
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{ 
              backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }} />
            
            {/* Decorative shapes */}
            <div className="absolute top-20 right-1/4 w-3 h-3 rounded-full bg-violet-300/40 dark:bg-violet-400/20 animate-pulse" style={{ animationDelay: '0s' }} />
            <div className="absolute top-1/2 left-1/4 w-2 h-2 rounded-full bg-pink-300/40 dark:bg-pink-400/20 animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute bottom-1/3 right-1/3 w-2.5 h-2.5 rounded-full bg-cyan-300/40 dark:bg-cyan-400/20 animate-pulse" style={{ animationDelay: '2s' }} />
            
            {/* Gradient lines */}
            <div className="absolute top-0 left-1/2 w-px h-32 bg-gradient-to-b from-violet-200/50 to-transparent dark:from-violet-500/20" />
            <div className="absolute bottom-0 right-1/3 w-px h-24 bg-gradient-to-t from-pink-200/50 to-transparent dark:from-pink-500/20" />
          </div>
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-24 h-24 mx-auto mb-5 relative group">
                {/* Outer glow ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400 via-pink-400 to-cyan-400 opacity-30 blur-xl animate-pulse" />
                {/* Animated gradient ring */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-400 via-pink-500 to-cyan-400 p-[3px]" style={{ animation: 'spin 8s linear infinite' }}>
                  <div className="w-full h-full rounded-full bg-white dark:bg-gray-900" />
                </div>
                {/* Inner circle with D - light vibrant gradient */}
                <div className="absolute inset-[6px] rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-pink-400 shadow-xl shadow-pink-400/30 flex items-center justify-center overflow-hidden">
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-white/20" />
                  <span className="text-4xl font-black text-white font-display tracking-tight drop-shadow-lg relative z-10" style={{ textShadow: '0 2px 8px rgba(168, 85, 247, 0.4)' }}>D</span>
                </div>
                {/* Sparkle decorations */}
                <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-yellow-400 drop-shadow-lg animate-pulse" />
                <Sparkles className="absolute -bottom-2 -left-2 w-5 h-5 text-pink-400 drop-shadow-lg animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute top-1/2 -right-3 w-4 h-4 text-cyan-400 drop-shadow-lg animate-pulse" style={{ animationDelay: '1s' }} />
                {/* Floating dots */}
                <div className="absolute -top-2 left-1/4 w-2 h-2 rounded-full bg-gradient-to-r from-yellow-300 to-orange-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="absolute -bottom-1 right-1/4 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-pink-300 to-rose-400 animate-bounce" style={{ animationDelay: '0.7s' }} />
              </div>
              <h3 className="text-lg font-semibold mb-1 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 dark:from-violet-400 dark:via-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">How can I help you today?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Ask me about workouts, attendance, payments, and more
              </p>
              
              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Suggestions</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map((suggestion, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer hover-elevate bg-white dark:bg-gray-800 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                        onClick={() => handleSuggestionClick(suggestion)}
                        data-testid={`chip-suggestion-${i}`}
                      >
                        {suggestion}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className={cn("space-y-2", message.role === 'assistant' && "mb-6")}>
              <div
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full mr-2 flex-shrink-0 relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-pink-400 shadow-md shadow-pink-400/25" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-white/10 rounded-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-black text-white font-display drop-shadow-sm">D</span>
                    </div>
                    <Sparkles className="absolute -top-0.5 -right-0.5 w-3 h-3 text-yellow-400 drop-shadow-sm" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm group relative",
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-br-md'
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-bl-md'
                  )}
                  data-testid={`message-${message.role}`}
                >
                  {message.role === 'assistant' ? (
                    <MarkdownContent content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => handleCopy(message.id, message.content)}
                      className="absolute -bottom-6 left-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-copy-${message.id}`}
                    >
                      {copiedId === message.id ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              {message.role === 'assistant' && message.followUpChips && message.followUpChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-9">
                  {message.followUpChips.map((chip, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover-elevate text-xs bg-white dark:bg-gray-800 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300"
                      onClick={() => handleSuggestionClick(chip)}
                      data-testid={`chip-followup-${i}`}
                    >
                      {chip}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full mr-2 flex-shrink-0 relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-pink-400 shadow-md shadow-pink-400/25 animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-white/10 rounded-full" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-black text-white font-display drop-shadow-sm">D</span>
                </div>
                <Sparkles className="absolute -top-0.5 -right-0.5 w-3 h-3 text-yellow-400 drop-shadow-sm animate-pulse" />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-md shadow-sm">
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="p-4 border-t flex gap-2 flex-shrink-0 bg-background"
          style={{ paddingBottom: `max(1rem, env(safe-area-inset-bottom))` }}
        >
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleInputFocus}
              placeholder={isListening ? "Listening..." : "Ask Dika anything..."}
              disabled={isLoading}
              className={cn(
                "pr-4 rounded-full border-gray-200 dark:border-gray-700 focus:border-violet-400 focus:ring-violet-400/20",
                isListening && "border-red-400 animate-pulse"
              )}
              enterKeyHint="send"
              data-testid="input-dika-message"
            />
          </div>
          {voiceSupported && (
            <Button
              type="button"
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              onClick={toggleListening}
              disabled={isLoading}
              aria-label={isListening ? "Stop listening" : "Start voice input"}
              aria-pressed={isListening}
              className={cn(
                "rounded-full",
                isListening && "animate-pulse"
              )}
              data-testid="button-dika-voice"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="rounded-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
            data-testid="button-dika-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
