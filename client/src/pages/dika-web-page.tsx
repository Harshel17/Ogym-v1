import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Loader2, Copy, Check, Trash2, Plus, Search, Menu, X,
  Utensils, Dumbbell, TrendingUp, Heart, Pin, PinOff,
  ChevronDown, ChevronRight, MessageSquare, Pencil,
  Zap, Lightbulb, Activity, Sparkles, Camera, ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { RoboDIcon } from '@/components/dika/dika-icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { AiDataConsentDialog, useAiConsent } from '@/components/ai-data-consent-dialog';

interface DikaChat {
  id: number;
  userId: number;
  title: string;
  category: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
}

interface DikaChatMessage {
  id: number;
  chatId: number;
  role: 'user' | 'assistant';
  content: string;
  followUpChips: string[] | null;
  metadata: any;
  createdAt: string;
}

interface DikaInsight {
  id: number;
  userId: number;
  insightKey: string;
  insightValue: string;
  source: string;
  updatedAt: string;
}

interface DikaActionFeed {
  id: number;
  userId: number;
  chatId: number;
  actionType: string;
  summary: string;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const CATEGORY_ICONS: Record<string, { icon: typeof Utensils; color: string; bg: string }> = {
  nutrition: { icon: Utensils, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  workouts: { icon: Dumbbell, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  sports: { icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/15' },
  general: { icon: MessageSquare, color: 'text-slate-400', bg: 'bg-slate-500/15' },
};

function CategoryBadge({ category }: { category: string }) {
  const config = CATEGORY_ICONS[category] || CATEGORY_ICONS.general;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full', config.bg, config.color)}>
      <Icon className="w-2.5 h-2.5" />
      {category}
    </span>
  );
}

function stripSpecialTags(content: string): string {
  return content
    .replace(/\n?<!-- MEAL_LOG_DATA:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- MEAL_LOG_DATA:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- WORKOUT_PLAN_DATA:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- WORKOUT_PLAN_DATA:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- WEEKLY_REPORT_DATA:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- WEEKLY_REPORT_DATA:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- DIKA_ACTION_DATA:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- DIKA_ACTION_DATA:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- DIKA_FIND_FOOD -->/g, '')
    .replace(/\n?&lt;!-- DIKA_FIND_FOOD --&gt;/g, '')
    .replace(/\n?<!-- PENDING_BODY_MEASUREMENT:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- PENDING_BODY_MEASUREMENT:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- PENDING_EXERCISE_SWAP:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- PENDING_EXERCISE_SWAP:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- PENDING_GOAL:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- PENDING_GOAL:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- PENDING_MEAL_SUGGESTION:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- PENDING_MEAL_SUGGESTION:[\s\S]+? --&gt;/g, '')
    .replace(/\n?<!-- PENDING_MATCH_LOG:[\s\S]+? -->/g, '')
    .replace(/\n?&lt;!-- PENDING_MATCH_LOG:[\s\S]+? --&gt;/g, '')
    .trim();
}

function MarkdownContent({ content }: { content: string }) {
  const cleaned = stripSpecialTags(content);
  const lines = cleaned.split('\n');

  const elements: JSX.Element[] = [];
  let listItems: JSX.Element[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      if (listType === 'ul') {
        elements.push(<ul key={`list-${listKey++}`} className="list-disc pl-4 space-y-0.5 my-1.5">{listItems}</ul>);
      } else {
        elements.push(<ol key={`list-${listKey++}`} className="list-decimal pl-4 space-y-0.5 my-1.5">{listItems}</ol>);
      }
      listItems = [];
      listType = null;
    }
  };

  const parseInline = (text: string): (string | JSX.Element)[] => {
    const parts: (string | JSX.Element)[] = [];
    const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
      if (match[1]) parts.push(<strong key={match.index} className="font-semibold text-white">{match[1]}</strong>);
      if (match[2] && match[3]) parts.push(<a key={match.index} href={match[3]} className="underline text-amber-400 hover:text-amber-300" target="_blank" rel="noopener noreferrer">{match[2]}</a>);
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  };

  lines.forEach((line, i) => {
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.*)/);
    const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.*)/);

    if (bulletMatch) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listItems.push(<li key={i} className="text-[13px] leading-relaxed">{parseInline(bulletMatch[1])}</li>);
    } else if (numberedMatch) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(<li key={i} className="text-[13px] leading-relaxed">{parseInline(numberedMatch[2])}</li>);
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(<p key={i} className="text-[13px] leading-relaxed">{parseInline(line)}</p>);
      }
    }
  });
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

function MessageBubble({ message, isLast }: { message: DikaChatMessage; isLast: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(stripSpecialTags(message.content));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.content]);

  if (isUser) {
    return (
      <div className="flex justify-end mb-4" data-testid="message-user">
        <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-br-sm bg-gradient-to-br from-amber-500/90 to-orange-600/90 text-white shadow-lg shadow-amber-500/10">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4 group" data-testid="message-assistant">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mt-0.5 shadow-md shadow-amber-500/20">
        <RoboDIcon className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-sm bg-[#1a2236] border border-slate-700/40 text-slate-200 relative shadow-lg shadow-black/10">
          <MarkdownContent content={message.content} />
          <button
            onClick={handleCopy}
            className="absolute -bottom-3 right-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700/50 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
            data-testid="button-copy-message"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
        <RoboDIcon className="w-4.5 h-4.5 text-white" />
      </div>
      <div className="px-5 py-4 rounded-2xl rounded-bl-sm bg-[#1a2236] border border-slate-700/40 shadow-lg shadow-black/10">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Log a Meal', icon: Utensils, gradient: 'from-emerald-500 to-teal-600', message: 'I want to log a meal' },
  { label: 'Generate Workout', icon: Dumbbell, gradient: 'from-blue-500 to-indigo-600', message: 'Generate a workout plan for me' },
  { label: 'Check Stats', icon: TrendingUp, gradient: 'from-violet-500 to-purple-600', message: 'Show me my stats and progress' },
  { label: 'Health Report', icon: Heart, gradient: 'from-rose-500 to-pink-600', message: 'Generate my weekly health report' },
];

export default function DikaWebPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [optimisticMessages, setOptimisticMessages] = useState<DikaChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [deleteDialogChat, setDeleteDialogChat] = useState<DikaChat | null>(null);
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [feedOpen, setFeedOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { hasConsent, isLoading: consentLoading } = useAiConsent();
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<{ text: string; imageBase64?: string } | null>(null);

  const { data: chatsData, isLoading: chatsLoading } = useQuery<{ chats: DikaChat[] }>({
    queryKey: ['/api/dika/chats'],
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ messages: DikaChatMessage[] }>({
    queryKey: ['/api/dika/chats', activeChatId, 'messages'],
    enabled: !!activeChatId,
  });

  const { data: insightsData } = useQuery<{ insights: DikaInsight[] }>({
    queryKey: ['/api/dika/insights'],
  });

  const { data: feedData } = useQuery<{ feed: DikaActionFeed[] }>({
    queryKey: ['/api/dika/action-feed'],
  });

  const { data: suggestionsData } = useQuery<{ suggestions: string[]; quickActions: Array<{ label: string; icon: string; message: string }> }>({
    queryKey: ['/api/dika/suggestions'],
  });

  const { data: searchData } = useQuery<{ results: Array<{ messageId: number; chatId: number; role: string; content: string; createdAt: string; chatTitle: string; chatCategory: string }> }>({
    queryKey: [`/api/dika/search?q=${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.length >= 2,
  });

  const chats = chatsData?.chats || [];
  const messages = messagesData?.messages || [];
  const insights = insightsData?.insights || [];
  const feed = feedData?.feed || [];
  const suggestions = suggestionsData?.suggestions || [];

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  const filteredChats = useMemo(() => {
    if (searchQuery.length >= 2 && searchData?.results) {
      const chatIds = new Set(searchData.results.map(r => r.chatId));
      return chats.filter(c => chatIds.has(c.id));
    }
    if (searchQuery.length > 0) {
      return chats.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return chats;
  }, [chats, searchQuery, searchData]);

  const allMessages = useMemo(() => {
    return [...messages, ...optimisticMessages];
  }, [messages, optimisticMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages, isSending]);

  const createChatMutation = useMutation({
    mutationFn: async (body: { title?: string; category?: string }) => {
      const res = await apiRequest('POST', '/api/dika/chats', body);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dika/chats'] });
      setActiveChatId(data.chat.id);
      setSidebarOpen(false);
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({ chatId, body }: { chatId: number; body: { title?: string; category?: string; isPinned?: boolean } }) => {
      const res = await apiRequest('PATCH', `/api/dika/chats/${chatId}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dika/chats'] });
      setEditingTitle(null);
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: number) => {
      const res = await apiRequest('DELETE', `/api/dika/chats/${chatId}`);
      return res.json();
    },
    onSuccess: (_, chatId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dika/chats'] });
      if (activeChatId === chatId) setActiveChatId(null);
      setDeleteDialogChat(null);
    },
  });

  const deleteInsightMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/dika/insights/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dika/insights'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, message, imageBase64 }: { chatId: number; message: string; imageBase64?: string }) => {
      const res = await apiRequest('POST', `/api/dika/chats/${chatId}/messages`, { message, platform: 'web', imageBase64 });
      return res.json();
    },
    onSuccess: () => {
      setOptimisticMessages([]);
      setIsSending(false);
      queryClient.invalidateQueries({ queryKey: ['/api/dika/chats', activeChatId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dika/chats'] });
    },
    onError: () => {
      setOptimisticMessages([]);
      setIsSending(false);
      toast({ title: 'Error', description: 'Failed to send message. Please try again.', variant: 'destructive' });
    },
  });

  const doSendMessage = useCallback(async (text?: string, imgBase64?: string) => {
    const msg = text || messageInput.trim();
    if (!msg) return;
    setMessageInput('');

    let chatId = activeChatId;
    if (!chatId) {
      try {
        const res = await apiRequest('POST', '/api/dika/chats', { title: msg.slice(0, 50) });
        const data = await res.json();
        chatId = data.chat.id;
        setActiveChatId(chatId);
        queryClient.invalidateQueries({ queryKey: ['/api/dika/chats'] });
        setSidebarOpen(false);
      } catch {
        toast({ title: 'Error', description: 'Failed to create chat.', variant: 'destructive' });
        return;
      }
    }

    const optimistic: DikaChatMessage = {
      id: -Date.now(),
      chatId: chatId!,
      role: 'user',
      content: msg,
      followUpChips: null,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    setOptimisticMessages([optimistic]);
    setIsSending(true);
    if (imgBase64) {
      sendMessageMutation.mutate({ chatId: chatId!, message: msg, imageBase64: imgBase64 });
    } else {
      sendMessageMutation.mutate({ chatId: chatId!, message: msg });
    }
  }, [messageInput, activeChatId, sendMessageMutation, toast]);

  const handleSendMessage = useCallback((text?: string) => {
    if (!hasConsent) {
      setPendingMessage({ text: text || messageInput.trim() });
      setShowConsentDialog(true);
      return;
    }
    doSendMessage(text);
  }, [hasConsent, doSendMessage, messageInput]);

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Photo too large', description: 'Please use a photo under 4MB.', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const msg = "Analyze this food photo and log it";

      if (!hasConsent) {
        setPendingMessage({ text: msg, imageBase64: base64 });
        setShowConsentDialog(true);
        return;
      }

      let chatId = activeChatId;
      if (!chatId) {
        try {
          const res = await apiRequest('POST', '/api/dika/chats', { title: 'Food Photo Log' });
          const data = await res.json();
          chatId = data.chat.id;
          setActiveChatId(chatId);
          queryClient.invalidateQueries({ queryKey: ['/api/dika/chats'] });
          setSidebarOpen(false);
        } catch {
          toast({ title: 'Error', description: 'Failed to create chat.', variant: 'destructive' });
          return;
        }
      }

      const optimistic: DikaChatMessage = {
        id: -Date.now(),
        chatId: chatId!,
        role: 'user',
        content: `[Photo attached] ${msg}`,
        followUpChips: null,
        metadata: null,
        createdAt: new Date().toISOString(),
      };
      setOptimisticMessages([optimistic]);
      setIsSending(true);
      sendMessageMutation.mutate({ chatId: chatId!, message: msg, imageBase64: base64 });
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, [activeChatId, sendMessageMutation, toast, hasConsent]);

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setOptimisticMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleSelectChat = useCallback((chatId: number) => {
    setActiveChatId(chatId);
    setOptimisticMessages([]);
    setSidebarOpen(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleTitleEdit = useCallback((chatId: number, currentTitle: string) => {
    setEditingTitle(chatId);
    setEditTitleValue(currentTitle);
  }, []);

  const handleTitleSave = useCallback((chatId: number) => {
    if (editTitleValue.trim()) {
      updateChatMutation.mutate({ chatId, body: { title: editTitleValue.trim() } });
    }
    setEditingTitle(null);
  }, [editTitleValue, updateChatMutation]);

  const lastAssistantMessage = useMemo(() => {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'assistant') return allMessages[i];
    }
    return null;
  }, [allMessages]);

  const pinnedChats = useMemo(() => filteredChats.filter(c => c.isPinned), [filteredChats]);
  const unpinnedChats = useMemo(() => filteredChats.filter(c => !c.isPinned), [filteredChats]);

  return (
    <div className="flex h-dvh w-full bg-[#0a0f1a]" data-testid="page-dika-web">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[300px] bg-[#0d1424] border-r border-slate-800/50 text-white flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <RoboDIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight">Dika AI</div>
                <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </div>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="lg:hidden text-slate-400 rounded-xl"
              onClick={() => setSidebarOpen(false)}
              data-testid="button-sidebar-close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={handleNewChat}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0 rounded-xl font-medium shadow-lg shadow-amber-500/20"
            data-testid="button-new-chat"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9 h-9 bg-[#131d30] border-slate-700/40 text-white placeholder:text-slate-500 text-xs rounded-xl focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="pb-2">
            {pinnedChats.length > 0 && (
              <div className="mb-3">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-amber-400/80 uppercase tracking-widest flex items-center gap-1.5">
                  <Pin className="w-3 h-3" /> Pinned
                </div>
                <div className="space-y-0.5">
                  {pinnedChats.map(chat => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={handleSelectChat}
                      onDelete={setDeleteDialogChat}
                      onTogglePin={(id, pinned) => updateChatMutation.mutate({ chatId: id, body: { isPinned: !pinned } })}
                      editingTitle={editingTitle}
                      editTitleValue={editTitleValue}
                      onTitleEdit={handleTitleEdit}
                      onTitleChange={setEditTitleValue}
                      onTitleSave={handleTitleSave}
                    />
                  ))}
                </div>
              </div>
            )}

            {unpinnedChats.length > 0 && (
              <div className="mb-3">
                <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  {pinnedChats.length > 0 ? 'Recent' : 'Conversations'}
                </div>
                <div className="space-y-0.5">
                  {unpinnedChats.map(chat => (
                    <ChatListItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={handleSelectChat}
                      onDelete={setDeleteDialogChat}
                      onTogglePin={(id, pinned) => updateChatMutation.mutate({ chatId: id, body: { isPinned: !pinned } })}
                      editingTitle={editingTitle}
                      editTitleValue={editTitleValue}
                      onTitleEdit={handleTitleEdit}
                      onTitleChange={setEditTitleValue}
                      onTitleSave={handleTitleSave}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredChats.length === 0 && !chatsLoading && (
              <div className="px-4 py-8 text-center">
                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <div className="text-xs text-slate-500">
                  {searchQuery ? 'No chats found' : 'No conversations yet'}
                </div>
              </div>
            )}
          </div>

          {insights.length > 0 && (
            <div className="border-t border-slate-800/50 py-2 mx-1">
              <button
                onClick={() => setInsightsOpen(!insightsOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 w-full text-left text-[10px] font-semibold text-amber-400/70 uppercase tracking-widest hover:text-amber-400 transition-colors"
                data-testid="button-toggle-insights"
              >
                {insightsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Lightbulb className="w-3 h-3" />
                Pinned Insights
              </button>
              {insightsOpen && (
                <div className="space-y-1 mt-1">
                  {insights.slice(0, 5).map(insight => (
                    <div key={insight.id} className="px-2 py-2 rounded-lg bg-[#131d30] border border-slate-800/40 flex items-start justify-between gap-2 group hover:border-amber-500/20 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-amber-400/60 font-medium truncate">{insight.insightKey}</div>
                        <div className="text-[11px] text-slate-300 truncate">{insight.insightValue}</div>
                      </div>
                      <button
                        onClick={() => deleteInsightMutation.mutate(insight.id)}
                        className="invisible group-hover:visible flex-shrink-0 p-0.5 text-slate-600 hover:text-red-400 transition-colors"
                        data-testid={`button-delete-insight-${insight.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {feed.length > 0 && (
            <div className="border-t border-slate-800/50 py-2 mx-1">
              <button
                onClick={() => setFeedOpen(!feedOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 w-full text-left text-[10px] font-semibold text-slate-500 uppercase tracking-widest hover:text-slate-400 transition-colors"
                data-testid="button-toggle-activity"
              >
                {feedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Activity className="w-3 h-3" />
                Activity
              </button>
              {feedOpen && (
                <div className="space-y-1 mt-1">
                  {feed.slice(0, 8).map(item => (
                    <div key={item.id} className="px-2 py-1.5 flex items-start gap-2 rounded-lg hover:bg-slate-800/30 transition-colors">
                      <Zap className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-slate-300 truncate">{item.summary}</div>
                        <div className="text-[10px] text-slate-600">{formatRelativeTime(item.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-slate-800/50">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#131d30]">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
              {(user?.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-white truncate">{user?.username || 'User'}</div>
              <div className="text-[10px] text-slate-500 capitalize">{user?.role || 'member'}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800/50 bg-[#0d1424]/80 backdrop-blur-xl flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden text-slate-400 rounded-xl"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-sidebar-toggle"
          >
            <Menu className="w-5 h-5" />
          </Button>
          {activeChat ? (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
                <RoboDIcon className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                {editingTitle === activeChat.id ? (
                  <Input
                    value={editTitleValue}
                    onChange={e => setEditTitleValue(e.target.value)}
                    onBlur={() => handleTitleSave(activeChat.id)}
                    onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(activeChat.id); if (e.key === 'Escape') setEditingTitle(null); }}
                    className="text-sm font-semibold max-w-[250px] bg-slate-800 border-slate-700 text-white rounded-lg"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => handleTitleEdit(activeChat.id, activeChat.title)}
                    className="text-sm font-semibold text-white truncate max-w-[250px] text-left flex items-center gap-1.5 hover:text-amber-400 transition-colors group"
                    data-testid="button-edit-chat-title"
                  >
                    {activeChat.title}
                    <Pencil className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <CategoryBadge category={activeChat.category} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                <RoboDIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Dika AI</div>
                <div className="text-[10px] text-slate-500">Your fitness assistant</div>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 bg-gradient-to-b from-[#0a0f1a] to-[#0d1220]">
          {activeChatId && messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <span className="text-xs text-slate-500">Loading messages...</span>
              </div>
            </div>
          ) : activeChatId ? (
            <div className="max-w-2xl mx-auto">
              {allMessages.map((msg, i) => (
                <MessageBubble key={msg.id} message={msg} isLast={i === allMessages.length - 1} />
              ))}
              {isSending && <TypingIndicator />}
              {lastAssistantMessage?.followUpChips && lastAssistantMessage.followUpChips.length > 0 && !isSending && (
                <div className="flex flex-wrap gap-2 ml-11 mb-4">
                  {lastAssistantMessage.followUpChips.map((chip, i) => (
                    <button
                      key={i}
                      className="text-xs px-3 py-1.5 rounded-full bg-[#131d30] border border-slate-700/40 text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition-all"
                      onClick={() => handleSendMessage(chip)}
                      data-testid={`button-chip-${i}`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <WelcomeScreen
              suggestions={suggestions}
              onQuickAction={handleSendMessage}
              onNewChat={handleNewChat}
              userName={user?.username || ''}
            />
          )}
        </div>

        <div className="flex-shrink-0 border-t border-slate-800/50 bg-[#0d1424]/80 backdrop-blur-xl px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 items-center bg-[#131d30] border border-slate-700/40 rounded-2xl px-4 py-2 focus-within:border-amber-500/40 focus-within:ring-2 focus-within:ring-amber-500/10 transition-all">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
                data-testid="input-dika-web-photo"
              />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={isSending}
                className="text-slate-400 transition-colors disabled:opacity-30 flex-shrink-0"
                data-testid="button-dika-web-photo"
              >
                <Camera className="w-5 h-5" />
              </button>
              <Input
                ref={inputRef}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Dika..."
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-white placeholder:text-slate-500 px-0"
                disabled={isSending}
                data-testid="input-dika-web-message"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={!messageInput.trim() || isSending}
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-30 disabled:shadow-none"
                size="icon"
                data-testid="button-dika-web-send"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-slate-600">Dika can make mistakes. Always verify important information.</span>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteDialogChat} onOpenChange={(open) => { if (!open) setDeleteDialogChat(null); }}>
        <AlertDialogContent className="bg-[#131d30] border-slate-700/50 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Chat</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Are you sure you want to delete "{deleteDialogChat?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300" data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogChat && deleteChatMutation.mutate(deleteDialogChat.id)}
              className="bg-red-500/90 text-white"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AiDataConsentDialog
        open={showConsentDialog}
        onConsentGranted={() => {
          setShowConsentDialog(false);
          if (pendingMessage) {
            doSendMessage(pendingMessage.text, pendingMessage.imageBase64);
            setPendingMessage(null);
          }
        }}
        onDeclined={() => {
          setShowConsentDialog(false);
          setPendingMessage(null);
        }}
      />
    </div>
  );
}

function ChatListItem({
  chat,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
  editingTitle,
  editTitleValue,
  onTitleEdit,
  onTitleChange,
  onTitleSave,
}: {
  chat: DikaChat;
  isActive: boolean;
  onSelect: (id: number) => void;
  onDelete: (chat: DikaChat) => void;
  onTogglePin: (id: number, isPinned: boolean) => void;
  editingTitle: number | null;
  editTitleValue: string;
  onTitleEdit: (id: number, title: string) => void;
  onTitleChange: (val: string) => void;
  onTitleSave: (id: number) => void;
}) {
  const config = CATEGORY_ICONS[chat.category] || CATEGORY_ICONS.general;

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl cursor-pointer transition-all',
        isActive
          ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20'
          : 'hover:bg-slate-800/40 border border-transparent'
      )}
      onClick={() => onSelect(chat.id)}
      data-testid={`chat-list-item-${chat.id}`}
    >
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
        <config.icon className={cn('w-3.5 h-3.5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        {editingTitle === chat.id ? (
          <Input
            value={editTitleValue}
            onChange={e => onTitleChange(e.target.value)}
            onBlur={() => onTitleSave(chat.id)}
            onKeyDown={e => { if (e.key === 'Enter') onTitleSave(chat.id); e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            className="h-5 text-xs bg-slate-800 border-slate-700 text-white px-1.5 rounded-lg"
            autoFocus
          />
        ) : (
          <div className={cn('text-xs font-medium truncate', isActive ? 'text-amber-200' : 'text-slate-200')}>
            {chat.title}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('text-[10px]', isActive ? 'text-amber-400/60' : 'text-slate-600')}>
            {formatRelativeTime(chat.lastMessageAt || chat.updatedAt)}
          </span>
          {chat.isPinned && <Pin className="w-2.5 h-2.5 text-amber-500/50" />}
        </div>
      </div>
      <div className="invisible group-hover:visible flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onTitleEdit(chat.id, chat.title); }}
          className="p-1 text-slate-600 hover:text-slate-300 rounded-md transition-colors"
          data-testid={`button-edit-chat-${chat.id}`}
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onTogglePin(chat.id, chat.isPinned); }}
          className="p-1 text-slate-600 hover:text-amber-400 rounded-md transition-colors"
          data-testid={`button-pin-chat-${chat.id}`}
        >
          {chat.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(chat); }}
          className="p-1 text-slate-600 hover:text-red-400 rounded-md transition-colors"
          data-testid={`button-delete-chat-${chat.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({
  suggestions,
  onQuickAction,
  onNewChat,
  userName,
}: {
  suggestions: string[];
  onQuickAction: (msg: string) => void;
  onNewChat: () => void;
  userName: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto px-4">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30">
          <RoboDIcon className="w-12 h-12 text-white" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0a0f1a] flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">
        Hey{userName ? `, ${userName}` : ''}!
      </h2>
      <p className="text-sm text-slate-400 mb-8 text-center leading-relaxed">
        I'm Dika, your AI fitness assistant. Ask me anything about workouts, nutrition, or your progress.
      </p>

      <div className="grid grid-cols-2 gap-3 w-full mb-8">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => onQuickAction(action.message)}
            className={cn(
              'flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-gradient-to-br text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg',
              action.gradient
            )}
            data-testid={`button-quick-action-${i}`}
          >
            <action.icon className="w-7 h-7" />
            <span className="text-xs font-semibold">{action.label}</span>
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="w-full">
          <div className="text-[10px] text-slate-500 mb-2.5 text-center font-medium uppercase tracking-wider">Suggestions</div>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.slice(0, 4).map((s, i) => (
              <button
                key={i}
                className="text-xs px-4 py-2 rounded-full bg-[#131d30] border border-slate-700/40 text-slate-300 hover:text-amber-400 hover:border-amber-500/30 transition-all"
                onClick={() => onQuickAction(s)}
                data-testid={`button-suggestion-${i}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
