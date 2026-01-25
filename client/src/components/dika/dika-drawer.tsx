import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Circle, Flower2, Shield, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { DikaIcon } from '@/hooks/use-dika';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const iconOptions: { value: DikaIcon; icon: typeof Circle; label: string }[] = [
    { value: 'circle', icon: Circle, label: 'Circle' },
    { value: 'sunflower', icon: Flower2, label: 'Sunflower' },
    { value: 'bat', icon: Shield, label: 'Hero' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md flex flex-col p-0"
        data-testid="drawer-dika"
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-semibold">Ask Dika</SheetTitle>
              <p className="text-xs text-muted-foreground">Your gym's memory</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                data-testid="button-dika-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                data-testid="button-dika-close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                Dika answers questions about workouts, attendance, and payments. It doesn't give advice.
              </p>
              
              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Try asking:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map((suggestion, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="cursor-pointer hover-elevate"
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
            <div key={message.id} className="space-y-2">
              <div
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-3 py-2 rounded-lg text-sm",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                  data-testid={`message-${message.role}`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
              {message.role === 'assistant' && message.followUpChips && message.followUpChips.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-1">
                  {message.followUpChips.map((chip, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover-elevate text-xs"
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
              <div className="bg-muted px-3 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="p-4 border-t flex gap-2 flex-shrink-0"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            disabled={isLoading}
            className="flex-1"
            data-testid="input-dika-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            data-testid="button-dika-send"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
