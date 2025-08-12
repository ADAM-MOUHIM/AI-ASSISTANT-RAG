// src/components/layout/ChatSidebar.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  PlusIcon,
  MessageSquare,
  MoreHorizontal,
  Edit3,
  Calendar,
  Settings,
  User,
  LogOut,
  Moon,
  Bell,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';

type Session = {
  id: number;
  title: string;
  created_at: string;
  updated_at?: string | null;
};

interface ChatSidebarProps {
  className?: string;
}

export function ChatSidebar({ className }: ChatSidebarProps) {
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { user, logout } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('access_token')!;
        const res = await fetch(`${API_BASE}/chat/sessions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`list sessions: ${res.status}`);
        const data: Session[] = await res.json();
        if (alive) setSessions(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const handleNewChat = async () => {
    try {
      const token = localStorage.getItem('access_token')!;
      const res = await fetch(`${API_BASE}/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`create session: ${res.status}`);
      const created: Session = await res.json();
      setSessions((prev) => [created, ...prev]);
      navigate(`/chats/${created.id}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteChat = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const token = localStorage.getItem('access_token')!;
      const res = await fetch(`${API_BASE}/chat/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error(`delete session: ${res.status}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (String(chatId) === String(id)) {
        // go to first remaining or home
        const next = sessions.find((s) => s.id !== id);
        navigate(next ? `/chats/${next.id}` : '/');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatDateKey = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    if (diff < 24) return 'Today';
    if (diff < 48) return 'Yesterday';
    if (diff < 24 * 7) return `${Math.floor(diff / 24)} days ago`;
    return d.toLocaleDateString();
  };

  const grouped = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    for (const s of sessions) {
      const key = formatDateKey(s.updated_at ?? s.created_at);
      (groups[key] = groups[key] || []).push(s);
    }
    return groups;
  }, [sessions]);

  const displayName =
    user?.name || user?.username || (user?.email ? user.email.split('@')[0] : 'User');
  const initials = displayName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleNavigation = (path: string) => navigate(path);

  const handleSignOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-gradient-to-b from-background to-muted/20 border-r border-border/50', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-3 h-11 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 hover:border-primary/30"
          variant="outline"
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>}

          {Object.entries(grouped).map(([dateGroup, list]) => (
            <div key={dateGroup} className="space-y-1">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground/80 flex items-center gap-2 sticky top-0 bg-background/80 backdrop-blur-sm">
                <Calendar className="h-3 w-3" />
                {dateGroup}
              </div>

              {list.map((s) => {
                const active = String(chatId) === String(s.id);
                const time = new Date(s.updated_at ?? s.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'group relative rounded-xl transition-all duration-200 hover:bg-muted/50 hover:shadow-sm',
                      active && 'bg-primary/5 border border-primary/20 shadow-sm'
                    )}
                  >
                    <Link to={`/chats/${s.id}`} className="flex items-center gap-3 p-3 rounded-xl w-full text-left">
                      <MessageSquare className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm font-medium truncate', active ? 'text-primary' : 'text-foreground')}>
                          {s.title || 'New Chat'}
                        </div>
                        <div className="text-xs text-muted-foreground/70">{time}</div>
                      </div>
                    </Link>

                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-background/80"
                            onClick={(e) => e.preventDefault()}
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditingId(s.id)} className="flex items-center gap-2">
                            <Edit3 className="h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteChat(s.id, e)}
                            className="flex items-center gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}

              <Separator className="my-3 bg-border/30" />
            </div>
          ))}

          {!loading && sessions.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No conversations yet</div>
          )}
        </div>
      </ScrollArea>

      {/* User Profile Section */}
      <div className="p-4 border-t border-border/50 bg-muted/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-auto p-3 hover:bg-muted/50 transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email ?? ''}</div>
              </div>
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{displayName}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email ?? ''}</div>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation('/profile')}>
              <User className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation('/settings')}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation('/notifications')}>
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation('/appearance')}>
              <Moon className="h-4 w-4" />
              <span>Appearance</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="flex items-center gap-3 cursor-pointer" onClick={() => handleNavigation('/help')}>
              <HelpCircle className="h-4 w-4" />
              <span>Help & Support</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem className="flex items-center gap-3 text-destructive focus:text-destructive cursor-pointer" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mt-3 text-xs text-muted-foreground/70 text-center">
          {sessions.length} conversation{sessions.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
