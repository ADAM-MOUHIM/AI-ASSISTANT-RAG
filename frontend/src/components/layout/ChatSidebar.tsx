import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  PlusIcon, 
  MessageSquare, 
  Trash2, 
  MoreHorizontal,
  Edit3,
  Calendar,
  Settings,
  User,
  LogOut,
  Moon,
  Bell,
  HelpCircle,
} from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { mockUser } from '@/data/mockUser';

interface ChatSidebarProps {
  className?: string;
}

export function ChatSidebar({ className }: ChatSidebarProps) {
  const { state, createNewChat, deleteChat, selectChat } = useChat();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleNewChat = () => {
    const newChatId = createNewChat();
    navigate(`/chats/${newChatId}`);
  };

  const handleSelectChat = (sessionId: string) => {
    selectChat(sessionId);
    navigate(`/chats/${sessionId}`);
  };

  const handleDeleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteChat(sessionId);
    
    // Navigate to remaining chat or home
    if (chatId === sessionId) {
      const remainingChats = state.sessions.filter(s => s.id !== sessionId);
      if (remainingChats.length > 0) {
        navigate(`/chats/${remainingChats[0].id}`);
      } else {
        navigate('/');
      }
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return 'Today';
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group chats by date
  const groupedChats = state.sessions.reduce((groups, session) => {
    const dateKey = formatDate(session.updatedAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(session);
    return groups;
  }, {} as Record<string, typeof state.sessions>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };


  return (
    <div className={cn("flex flex-col h-full bg-gradient-to-b from-background to-muted/20 border-r border-border/50", className)}>
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
          {Object.entries(groupedChats).map(([dateGroup, sessions]) => (
            <div key={dateGroup} className="space-y-1">
              {/* Date Header */}
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground/80 flex items-center gap-2 sticky top-0 bg-background/80 backdrop-blur-sm">
                <Calendar className="h-3 w-3" />
                {dateGroup}
              </div>
              
              {/* Chat Items */}
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group relative rounded-xl transition-all duration-200 hover:bg-muted/50 hover:shadow-sm",
                    chatId === session.id && "bg-primary/5 border border-primary/20 shadow-sm"
                  )}
                >
                  <Link
                    to={`/chats/${session.id}`}
                    onClick={() => handleSelectChat(session.id)}
                    className="flex items-center gap-3 p-3 rounded-xl w-full text-left"
                  >
                    <MessageSquare className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      chatId === session.id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        "text-sm font-medium truncate transition-colors",
                        chatId === session.id ? "text-primary" : "text-foreground"
                      )}>
                        {session.title}
                      </div>
                      <div className="text-xs text-muted-foreground/70 flex items-center gap-1">
                        <span>{session.messages.length} messages</span>
                        <span>•</span>
                        <span>{session.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Action Menu */}
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
                        <DropdownMenuItem
                          onClick={() => setEditingId(session.id)}
                          className="flex items-center gap-2"
                        >
                          <Edit3 className="h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteChat(session.id, e)}
                          className="flex items-center gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              
              {dateGroup !== Object.keys(groupedChats)[Object.keys(groupedChats).length - 1] && (
                <Separator className="my-3 bg-border/30" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* User Profile Section */}
      <div className="p-4 border-t border-border/50 bg-muted/20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-auto p-3 hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {getInitials(mockUser.name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">{mockUser.name}</div>
              </div>
              
              <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-64" sideOffset={8}>
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(mockUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{mockUser.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{mockUser.email}</div>
                </div>
              </div>
            </DropdownMenuLabel>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="flex items-center gap-3">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="flex items-center gap-3">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="flex items-center gap-3">
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="flex items-center gap-3">
              <Moon className="h-4 w-4" />
              <span>Appearance</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="flex items-center gap-3">
              <HelpCircle className="h-4 w-4" />
              <span>Help & Support</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="flex items-center gap-3 text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Stats */}
        <div className="mt-3 text-xs text-muted-foreground/70 text-center">
          {state.sessions.length} conversation{state.sessions.length !== 1 ? 's' : ''} • Member since {mockUser.joinedAt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
} 