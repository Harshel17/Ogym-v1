import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { resetBodyStyles } from '@/hooks/use-keyboard';

export type DikaIcon = 'circle' | 'sunflower' | 'bat';

interface DikaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUpChips?: string[];
}

interface DikaPosition {
  x: number;
  y: number;
}

interface DikaLocalSettings {
  position: DikaPosition;
  icon: DikaIcon;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  followUpChips?: string[];
}

const STORAGE_KEY_PREFIX = 'dika_settings_';
const HISTORY_KEY_PREFIX = 'dika_history_';
const MAX_HISTORY_MESSAGES = 50;

function getDefaultPosition(): DikaPosition {
  const bottomNavHeight = 80;
  return {
    x: Math.max(10, window.innerWidth - 70),
    y: Math.max(10, window.innerHeight - 140 - bottomNavHeight),
  };
}

function getStorageKey(userId: number): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function loadLocalSettings(userId: number): DikaLocalSettings {
  const defaultPos = getDefaultPosition();
  try {
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) {
      const parsed = JSON.parse(stored);
      let position = parsed.position || defaultPos;
      
      const bottomNavHeight = 80;
      const maxY = window.innerHeight - 44 - 10 - bottomNavHeight;
      const maxX = window.innerWidth - 44 - 10;
      
      position = {
        x: Math.max(10, Math.min(position.x, maxX)),
        y: Math.max(10, Math.min(position.y, maxY)),
      };
      
      return {
        position,
        icon: parsed.icon || 'circle',
      };
    }
  } catch (e) {
    console.error('Failed to load Dika settings:', e);
  }
  return { position: defaultPos, icon: 'circle' };
}

function saveLocalSettings(userId: number, settings: DikaLocalSettings): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save Dika settings:', e);
  }
}

function getHistoryKey(userId: number): string {
  return `${HISTORY_KEY_PREFIX}${userId}`;
}

function loadLocalHistory(userId: number): DikaMessage[] {
  try {
    const stored = localStorage.getItem(getHistoryKey(userId));
    if (stored) {
      const parsed: StoredMessage[] = JSON.parse(stored);
      return parsed.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }));
    }
  } catch (e) {
    console.error('Failed to load Dika history:', e);
  }
  return [];
}

function saveLocalHistory(userId: number, messages: DikaMessage[]): void {
  try {
    const toStore: StoredMessage[] = messages.slice(-MAX_HISTORY_MESSAGES).map(m => ({
      ...m,
      timestamp: m.timestamp.toISOString(),
    }));
    localStorage.setItem(getHistoryKey(userId), JSON.stringify(toStore));
  } catch (e) {
    console.error('Failed to save Dika history:', e);
  }
}

function clearLocalHistory(userId: number): void {
  try {
    localStorage.removeItem(getHistoryKey(userId));
  } catch (e) {
    console.error('Failed to clear Dika history:', e);
  }
}

function messagesToStored(messages: DikaMessage[]): StoredMessage[] {
  return messages.slice(-MAX_HISTORY_MESSAGES).map(m => ({
    ...m,
    timestamp: m.timestamp.toISOString(),
  }));
}

function storedToMessages(stored: StoredMessage[]): DikaMessage[] {
  return stored.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

export function useDika(userId: number, hideDika: boolean) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DikaMessage[]>(() => 
    loadLocalHistory(userId)
  );
  const [localSettings, setLocalSettings] = useState<DikaLocalSettings>(() => 
    loadLocalSettings(userId)
  );
  const [serverLoaded, setServerLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMessagesRef = useRef<DikaMessage[] | null>(null);

  const syncToServer = useCallback((msgs: DikaMessage[]) => {
    const stored = messagesToStored(msgs);
    pendingMessagesRef.current = null;
    apiRequest('PUT', '/api/dika/conversations', { messages: stored }).catch(err => {
      console.error('Failed to sync dika to server:', err);
    });
  }, []);

  const { data: serverConvo } = useQuery<{ messages: StoredMessage[] }>({
    queryKey: ['/api/dika/conversations'],
    enabled: !serverLoaded,
    staleTime: 0,
  });

  useEffect(() => {
    if (serverConvo && !serverLoaded) {
      setServerLoaded(true);
      const serverMessages = storedToMessages(serverConvo.messages || []);
      const localMessages = loadLocalHistory(userId);
      
      if (serverMessages.length === 0 && localMessages.length === 0) {
        return;
      }
      
      if (serverMessages.length === 0 && localMessages.length > 0) {
        setMessages(localMessages);
        syncToServer(localMessages);
      } else if (serverMessages.length > 0 && localMessages.length === 0) {
        setMessages(serverMessages);
        saveLocalHistory(userId, serverMessages);
      } else {
        const serverLatest = new Date(serverMessages[serverMessages.length - 1].timestamp).getTime();
        const localLatest = new Date(localMessages[localMessages.length - 1].timestamp).getTime();
        
        if (serverLatest >= localLatest) {
          setMessages(serverMessages);
          saveLocalHistory(userId, serverMessages);
        } else {
          setMessages(localMessages);
          syncToServer(localMessages);
        }
      }
    }
  }, [serverConvo, serverLoaded, userId, syncToServer]);

  useEffect(() => {
    setLocalSettings(loadLocalSettings(userId));
    setMessages(loadLocalHistory(userId));
    setServerLoaded(false);
  }, [userId]);

  useEffect(() => {
    if (messages.length > 0) {
      saveLocalHistory(userId, messages);
      pendingMessagesRef.current = messages;
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        syncToServer(messages);
      }, 1000);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, userId, syncToServer]);

  useEffect(() => {
    const flushPending = () => {
      if (pendingMessagesRef.current && pendingMessagesRef.current.length > 0) {
        const stored = messagesToStored(pendingMessagesRef.current);
        const blob = new Blob([JSON.stringify({ messages: stored })], { type: 'application/json' });
        navigator.sendBeacon('/api/dika/conversations-beacon', blob);
      }
    };
    window.addEventListener('beforeunload', flushPending);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushPending();
      }
    });
    return () => {
      window.removeEventListener('beforeunload', flushPending);
    };
  }, []);

  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: ['/api/dika/suggestions'],
    enabled: isOpen,
  });

  const askMutation = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));
      const res = await apiRequest('POST', '/api/dika/ask', { message, conversationHistory: history });
      return res.json();
    },
    onSuccess: (data, message) => {
      const assistantMessage: DikaMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        followUpChips: data.followUpChips || [],
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.answer?.includes('MEAL_LOG_DATA:')) {
        queryClient.invalidateQueries({ queryKey: ['/api/nutrition/logs'] });
        queryClient.invalidateQueries({ queryKey: ['/api/nutrition/summary'] });
        queryClient.invalidateQueries({ queryKey: ['/api/nutrition/analytics'] });
      }
    },
  });

  const toggleHideMutation = useMutation({
    mutationFn: async (hide: boolean) => {
      const res = await apiRequest('PATCH', '/api/dika/settings', { hideDika: hide });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const sendMessage = useCallback((content: string) => {
    const userMessage: DikaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    askMutation.mutate(content);
  }, [askMutation]);

  const updatePosition = useCallback((position: DikaPosition) => {
    setLocalSettings(prev => {
      const updated = { ...prev, position };
      saveLocalSettings(userId, updated);
      return updated;
    });
  }, [userId]);

  const updateIcon = useCallback((icon: DikaIcon) => {
    setLocalSettings(prev => {
      const updated = { ...prev, icon };
      saveLocalSettings(userId, updated);
      return updated;
    });
  }, [userId]);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    try {
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.hide().catch(() => {});
      }).catch(() => {});
    } catch {}
    setIsOpen(false);
    resetBodyStyles();
    const intervals = [50, 150, 300, 500, 800, 1200];
    intervals.forEach(ms => setTimeout(() => resetBodyStyles(), ms));
    const observer = new MutationObserver(() => {
      const h = document.body.style.height;
      if (h && h !== '100%' && h !== '') {
        document.body.style.removeProperty('height');
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    setTimeout(() => observer.disconnect(), 2000);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    clearLocalHistory(userId);
    apiRequest('DELETE', '/api/dika/conversations').catch(err => {
      console.error('Failed to clear server dika history:', err);
    });
  }, [userId]);

  const hideDikaButton = useCallback(() => {
    toggleHideMutation.mutate(true);
  }, [toggleHideMutation]);

  const showDikaButton = useCallback(() => {
    toggleHideMutation.mutate(false);
  }, [toggleHideMutation]);

  return {
    isOpen,
    messages,
    suggestions: suggestionsData?.suggestions || [],
    position: localSettings.position,
    icon: localSettings.icon,
    isLoading: askMutation.isPending,
    isHidden: hideDika,
    sendMessage,
    updatePosition,
    updateIcon,
    openDrawer,
    closeDrawer,
    clearHistory,
    hideDikaButton,
    showDikaButton,
  };
}
