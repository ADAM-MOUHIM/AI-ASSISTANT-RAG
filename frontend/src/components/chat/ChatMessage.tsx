import type { Message } from '@/types/chat';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex gap-2 sm:gap-3 mb-4 sm:mb-6',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-1">
        <AvatarFallback className={cn(
          'transition-colors',
          isUser && 'bg-primary text-primary-foreground',
          isAssistant && 'bg-muted text-muted-foreground'
        )}>
          {isUser ? <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div className={cn(
        'flex flex-col max-w-[85%] sm:max-w-[80%]',
        isUser && 'items-end'
      )}>
        {/* Message Bubble */}
        <Card className={cn(
          'px-3 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed transition-all duration-200 hover:shadow-md',
          isUser && 'bg-primary text-primary-foreground border-primary shadow-sm',
          isAssistant && 'bg-muted/50 hover:bg-muted/70'
        )}>
          <div className="whitespace-pre-wrap break-words [word-break:break-word]">
            {message.content}
          </div>
        </Card>

        {/* Timestamp */}
        <div className={cn(
          'text-xs text-muted-foreground mt-1 px-1 opacity-70',
          isUser && 'text-right'
        )}>
          {message.timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
      </div>
    </div>
  );
} 