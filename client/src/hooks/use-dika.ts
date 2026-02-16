import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { resetBodyStyles } from '@/hooks/use-keyboard';
import { isNative, isIOS } from '@/lib/capacitor-init';

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

export function useDikaPage(userId: number) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<DikaMessage[]>(() => 
    loadLocalHistory(userId)
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
      if (serverMessages.length === 0 && localMessages.length === 0) return;
      if (serverMessages.length === 0 && localMessages.length > 0) { setMessages(localMessages); syncToServer(localMessages); }
      else if (serverMessages.length > 0 && localMessages.length === 0) { setMessages(serverMessages); saveLocalHistory(userId, serverMessages); }
      else {
        const serverLatest = new Date(serverMessages[serverMessages.length - 1].timestamp).getTime();
        const localLatest = new Date(localMessages[localMessages.length - 1].timestamp).getTime();
        if (serverLatest >= localLatest) { setMessages(serverMessages); saveLocalHistory(userId, serverMessages); }
        else { setMessages(localMessages); syncToServer(localMessages); }
      }
    }
  }, [serverConvo, serverLoaded, userId, syncToServer]);

  useEffect(() => {
    setMessages(loadLocalHistory(userId));
    setServerLoaded(false);
    briefingFetchedRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (messages.length > 0) {
      saveLocalHistory(userId, messages);
      pendingMessagesRef.current = messages;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => syncToServer(messages), 1000);
    }
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
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
    const visHandler = () => { if (document.visibilityState === 'hidden') flushPending(); };
    document.addEventListener('visibilitychange', visHandler);
    return () => { window.removeEventListener('beforeunload', flushPending); document.removeEventListener('visibilitychange', visHandler); };
  }, []);

  const suggestionsUrl = isNative() && isIOS() ? '/api/dika/suggestions?platform=ios_native' : '/api/dika/suggestions';
  const { data: suggestionsData } = useQuery<{ suggestions: string[]; quickActions?: Array<{ label: string; icon: string; message: string }> }>({
    queryKey: [suggestionsUrl],
  });

  const briefingFetchedRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0 && serverLoaded && !briefingFetchedRef.current) {
      briefingFetchedRef.current = true;
      apiRequest('GET', '/api/dika/briefing')
        .then(res => res.json())
        .then(data => {
          if (data.answer) {
            const briefingMsg: DikaMessage = {
              id: `briefing-${Date.now()}`,
              role: 'assistant',
              content: data.answer,
              timestamp: new Date(),
              followUpChips: data.followUpChips || [],
            };
            setMessages([briefingMsg]);
          }
        })
        .catch(() => {});
    }
  }, [messages.length, serverLoaded]);

  const askMutation = useMutation({
    mutationFn: async ({ message, imageBase64 }: { message: string; imageBase64?: string }) => {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));
      const platform = isNative() && isIOS() ? 'ios_native' : undefined;
      const res = await apiRequest('POST', '/api/dika/ask', { message, conversationHistory: history, platform, imageBase64 });
      return res.json();
    },
    onSuccess: (data) => {
      const assistantMessage: DikaMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        followUpChips: data.followUpChips || [],
      };
      setMessages(prev => [...prev, assistantMessage]);
      if (data.answer?.includes('MEAL_LOG_DATA:')) {
        queryClient.invalidateQueries({ queryKey: ['/api/nutrition/page-data'] });
        queryClient.invalidateQueries({ queryKey: ['/api/nutrition/analytics'] });
      }
    },
  });

  const sendMessage = useCallback((content: string, imageBase64?: string) => {
    const userMessage: DikaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: imageBase64 ? `[Photo attached] ${content}` : content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    askMutation.mutate({ message: content, imageBase64 });
  }, [askMutation]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    clearLocalHistory(userId);
    briefingFetchedRef.current = false;
    apiRequest('DELETE', '/api/dika/conversations').catch(err => {
      console.error('Failed to clear server dika history:', err);
    });
  }, [userId]);

  return {
    messages,
    suggestions: suggestionsData?.suggestions || [],
    quickActions: suggestionsData?.quickActions || [],
    isLoading: askMutation.isPending,
    sendMessage,
    clearHistory,
  };
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
    briefingFetchedRef.current = false;
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

  const drawerSuggestionsUrl = isNative() && isIOS() ? '/api/dika/suggestions?platform=ios_native' : '/api/dika/suggestions';
  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: [drawerSuggestionsUrl],
    enabled: isOpen,
  });

  const briefingFetchedRef = useRef(false);
  useEffect(() => {
    if (isOpen && messages.length === 0 && serverLoaded && !briefingFetchedRef.current) {
      briefingFetchedRef.current = true;
      apiRequest('GET', '/api/dika/briefing')
        .then(res => res.json())
        .then(data => {
          if (data.answer) {
            const briefingMsg: DikaMessage = {
              id: `briefing-${Date.now()}`,
              role: 'assistant',
              content: data.answer,
              timestamp: new Date(),
              followUpChips: data.followUpChips || [],
            };
            setMessages([briefingMsg]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, messages.length, serverLoaded]);

  const askMutation = useMutation({
    mutationFn: async ({ message, imageBase64 }: { message: string; imageBase64?: string }) => {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));
      const platform = isNative() && isIOS() ? 'ios_native' : undefined;
      const res = await apiRequest('POST', '/api/dika/ask', { message, conversationHistory: history, platform, imageBase64 });
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
        queryClient.invalidateQueries({ queryKey: ['/api/nutrition/page-data'] });
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

  const sendMessage = useCallback((content: string, imageBase64?: string) => {
    const userMessage: DikaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: imageBase64 ? `[Photo attached] ${content}` : content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    askMutation.mutate({ message: content, imageBase64 });
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

  const savedScrollRef = useRef<{ el: Element | null; top: number }>({ el: null, top: 0 });

  const openDrawer = useCallback(() => {
    const mainScroll = document.querySelector('.app-main-scroll');
    if (mainScroll) {
      savedScrollRef.current = { el: mainScroll, top: mainScroll.scrollTop };
    }
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

    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('touch-action');
    resetBodyStyles();

    const { el, top } = savedScrollRef.current;
    const restoreScroll = () => {
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('touch-action');
      resetBodyStyles();
      if (el) {
        el.scrollTop = top;
      }
      window.scrollTo(0, 0);
    };
    const intervals = [50, 150, 300, 500, 800, 1200];
    intervals.forEach(ms => setTimeout(restoreScroll, ms));
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
    briefingFetchedRef.current = false;
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
