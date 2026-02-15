import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Loader2, Copy, Check, Trash2, Plus, Search, Menu, X,
  Utensils, Dumbbell, TrendingUp, Heart, Pin, PinOff,
  ChevronDown, ChevronRight, Clock, MessageSquare, Pencil,
  Zap, Lightbulb, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CATEGORY_COLORS: Record<string, string> = {
  nutrition: 'bg-green-500/10 text-green-500',
  workouts: 'bg-blue-500/10 text-blue-500',
  sports: 'bg-purple-500/10 text-purple-500',
  general: 'bg-gray-500/10 text-gray-500',
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 border-0 no-default-hover-elevate no-default-active-elevate', colors)}>
      {category}
    </Badge>
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
        elements.push(<ul key={`list-${listKey++}`} className="list-disc pl-4 space-y-0.5 my-1">{listItems}</ul>);
      } else {
        elements.push(<ol key={`list-${listKey++}`} className="list-decimal pl-4 space-y-0.5 my-1">{listItems}</ol>);
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
      if (match[1]) parts.push(<strong key={match.index} className="font-semibold">{match[1]}</strong>);
      if (match[2] && match[3]) parts.push(<a key={match.index} href={match[3]} className="underline text-amber-500" target="_blank" rel="noopener noreferrer">{match[2]}</a>);
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
      listItems.push(<li key={i} className="text-xs leading-relaxed">{parseInline(bulletMatch[1])}</li>);
    } else if (numberedMatch) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(<li key={i} className="text-xs leading-relaxed">{parseInline(numberedMatch[2])}</li>);
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />);
      } else {
        elements.push(<p key={i} className="text-xs leading-relaxed">{parseInline(line)}</p>);
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
      <div className="flex justify-end mb-3" data-testid="message-user">
        <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-br from-slate-700 to-slate-800 text-white">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-3 group" data-testid="message-assistant">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mt-0.5">
        <RoboDIcon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="max-w-[90%] px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-800 dark:text-gray-200 relative">
          <MarkdownContent content={message.content} />
          <div className="absolute top-2 right-2 p-1 rounded-md bg-gray-100 dark:bg-slate-700 invisible group-hover:visible">
            <button onClick={handleCopy}>
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 mb-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
        <RoboDIcon className="w-4 h-4 text-white" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Log a Meal', icon: Utensils, gradient: 'from-amber-400 to-orange-500', message: 'I want to log a meal' },
  { label: 'Generate Workout', icon: Dumbbell, gradient: 'from-blue-400 to-indigo-500', message: 'Generate a workout plan for me' },
  { label: 'Check My Stats', icon: TrendingUp, gradient: 'from-emerald-400 to-teal-500', message: 'Show me my stats and progress' },
  { label: 'Health Report', icon: Heart, gradient: 'from-rose-400 to-pink-500', message: 'Generate my weekly health report' },
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
    mutationFn: async ({ chatId, message }: { chatId: number; message: string }) => {
      const res = await apiRequest('POST', `/api/dika/chats/${chatId}/messages`, { message, platform: 'web' });
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

  const handleSendMessage = useCallback(async (text?: string) => {
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
    sendMessageMutation.mutate({ chatId: chatId!, message: msg });
  }, [messageInput, activeChatId, sendMessageMutation, toast]);

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
    <div className="flex h-[calc(100dvh-120px)] md:h-full w-full relative" data-testid="page-dika-web">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] bg-slate-950 text-white flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-3 flex flex-col gap-2 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <RoboDIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-sm">Dika AI</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="lg:hidden text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={handleNewChat}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"
            size="sm"
            data-testid="button-new-chat"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="pl-8 h-8 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 text-xs"
              data-testid="input-search-chats"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {pinnedChats.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Pin className="w-3 h-3" /> Pinned
                </div>
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
            )}

            {unpinnedChats.length > 0 && (
              <div className="mb-2">
                {pinnedChats.length > 0 && (
                  <div className="px-2 py-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">Recent</div>
                )}
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
            )}

            {filteredChats.length === 0 && !chatsLoading && (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                {searchQuery ? 'No chats found' : 'No chats yet. Start a new one!'}
              </div>
            )}
          </div>

          {insights.length > 0 && (
            <div className="border-t border-slate-800 px-2 py-2">
              <button
                onClick={() => setInsightsOpen(!insightsOpen)}
                className="flex items-center gap-1 px-2 py-1 w-full text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider"
              >
                {insightsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Lightbulb className="w-3 h-3" />
                Insights
              </button>
              {insightsOpen && (
                <div className="space-y-1 mt-1">
                  {insights.slice(0, 5).map(insight => (
                    <div key={insight.id} className="px-2 py-1.5 rounded-md bg-slate-900 flex items-start justify-between gap-1 group">
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-slate-400 truncate">{insight.insightKey}</div>
                        <div className="text-[11px] text-slate-300 truncate">{insight.insightValue}</div>
                      </div>
                      <button
                        onClick={() => deleteInsightMutation.mutate(insight.id)}
                        className="invisible group-hover:visible flex-shrink-0 p-0.5 text-slate-500 hover:text-red-400"
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
            <div className="border-t border-slate-800 px-2 py-2">
              <button
                onClick={() => setFeedOpen(!feedOpen)}
                className="flex items-center gap-1 px-2 py-1 w-full text-left text-[10px] font-medium text-slate-500 uppercase tracking-wider"
              >
                {feedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Activity className="w-3 h-3" />
                Action Feed
              </button>
              {feedOpen && (
                <div className="space-y-1 mt-1">
                  {feed.slice(0, 8).map(item => (
                    <div key={item.id} className="px-2 py-1.5 flex items-start gap-2">
                      <Zap className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-slate-300 truncate">{item.summary}</div>
                        <div className="text-[10px] text-slate-500">{formatRelativeTime(item.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            data-testid="button-sidebar-toggle"
          >
            <Menu className="w-5 h-5" />
          </Button>
          {activeChat ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <RoboDIcon className="w-3.5 h-3.5 text-white" />
              </div>
              {editingTitle === activeChat.id ? (
                <Input
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  onBlur={() => handleTitleSave(activeChat.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(activeChat.id); if (e.key === 'Escape') setEditingTitle(null); }}
                  className="h-7 text-sm font-medium max-w-[200px]"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => handleTitleEdit(activeChat.id, activeChat.title)}
                  className="text-sm font-medium truncate max-w-[200px] text-left flex items-center gap-1"
                >
                  {activeChat.title}
                  <Pencil className="w-3 h-3 text-gray-400 invisible group-hover:visible" />
                </button>
              )}
              <CategoryBadge category={activeChat.category} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <RoboDIcon className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium">Dika AI</span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeChatId && messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : activeChatId ? (
            <div className="max-w-2xl mx-auto">
              {allMessages.map((msg, i) => (
                <MessageBubble key={msg.id} message={msg} isLast={i === allMessages.length - 1} />
              ))}
              {isSending && <TypingIndicator />}
              {lastAssistantMessage?.followUpChips && lastAssistantMessage.followUpChips.length > 0 && !isSending && (
                <div className="flex flex-wrap gap-1.5 ml-9 mb-3">
                  {lastAssistantMessage.followUpChips.map((chip, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs rounded-full"
                      onClick={() => handleSendMessage(chip)}
                    >
                      {chip}
                    </Button>
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

        <div className="flex-shrink-0 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Dika anything..."
              className="flex-1"
              disabled={isSending}
              data-testid="input-dika-web-message"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!messageInput.trim() || isSending}
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white"
              size="icon"
              data-testid="button-dika-web-send"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteDialogChat} onOpenChange={(open) => { if (!open) setDeleteDialogChat(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDialogChat?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialogChat && deleteChatMutation.mutate(deleteDialogChat.id)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors',
        isActive ? 'bg-slate-800' : 'hover-elevate'
      )}
      onClick={() => onSelect(chat.id)}
      data-testid={`chat-list-item-${chat.id}`}
    >
      <MessageSquare className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {editingTitle === chat.id ? (
          <Input
            value={editTitleValue}
            onChange={e => onTitleChange(e.target.value)}
            onBlur={() => onTitleSave(chat.id)}
            onKeyDown={e => { if (e.key === 'Enter') onTitleSave(chat.id); e.stopPropagation(); }}
            onClick={e => e.stopPropagation()}
            className="h-5 text-xs bg-slate-700 border-slate-600 text-white px-1"
            autoFocus
          />
        ) : (
          <div className="text-xs text-slate-200 truncate">{chat.title}</div>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <CategoryBadge category={chat.category} />
          <span className="text-[10px] text-slate-500">{formatRelativeTime(chat.lastMessageAt || chat.updatedAt)}</span>
        </div>
      </div>
      <div className="invisible group-hover:visible flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onTitleEdit(chat.id, chat.title); }}
          className="p-1 text-slate-500 hover:text-slate-300"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onTogglePin(chat.id, chat.isPinned); }}
          className="p-1 text-slate-500 hover:text-slate-300"
        >
          {chat.isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(chat); }}
          className="p-1 text-slate-500 hover:text-red-400"
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
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4">
        <RoboDIcon className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
        Hey{userName ? `, ${userName}` : ''}!
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
        I'm Dika, your AI fitness assistant. How can I help you today?
      </p>

      <div className="grid grid-cols-2 gap-3 w-full mb-6">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => onQuickAction(action.message)}
            className={cn(
              'flex flex-col items-center gap-2 p-4 rounded-lg bg-gradient-to-br text-white transition-transform hover:scale-[1.02] active:scale-[0.98]',
              action.gradient
            )}
            data-testid={`button-quick-action-${i}`}
          >
            <action.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="w-full">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">Suggested</div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {suggestions.slice(0, 4).map((s, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs rounded-full"
                onClick={() => onQuickAction(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
