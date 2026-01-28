import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

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

const STORAGE_KEY_PREFIX = 'dika_settings_';

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
      
      // Ensure position is within visible bounds
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

export function useDika(userId: number, hideDika: boolean) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DikaMessage[]>([]);
  const [localSettings, setLocalSettings] = useState<DikaLocalSettings>(() => 
    loadLocalSettings(userId)
  );

  useEffect(() => {
    setLocalSettings(loadLocalSettings(userId));
  }, [userId]);

  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: ['/api/dika/suggestions'],
    enabled: isOpen,
  });

  const askMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest('POST', '/api/dika/ask', { message });
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
    setIsOpen(false);
    setMessages([]);
  }, []);

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
    hideDikaButton,
    showDikaButton,
  };
}
