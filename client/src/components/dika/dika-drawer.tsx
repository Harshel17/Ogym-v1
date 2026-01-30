import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Settings, Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';
import { DikaCircleIcon, SunflowerIcon, BatIcon } from './dika-icons';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
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
}: DikaDrawerProps) {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/30">
                <Sparkles className="w-5 h-5 text-white" />
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onHide}
              className="mt-2 text-xs text-muted-foreground"
              data-testid="button-hide-dika"
            >
              Hide Dika button
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-violet-50/50 to-transparent dark:from-violet-950/20 dark:to-transparent">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="text-base font-medium mb-1">How can I help you today?</h3>
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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
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
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mr-2 flex-shrink-0 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-white" />
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
              placeholder="Ask Dika anything..."
              disabled={isLoading}
              className="pr-4 rounded-full border-gray-200 dark:border-gray-700 focus:border-violet-400 focus:ring-violet-400/20"
              enterKeyHint="send"
              data-testid="input-dika-message"
            />
          </div>
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
