import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Bot } from 'lucide-react';

export function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      {/* Typing Animation */}
      <div className="flex flex-col max-w-[80%]">
        <Card className="px-4 py-3 bg-muted/50">
          <div className="flex items-center gap-1">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" 
                   style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" 
                   style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" 
                   style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground ml-2">AI is thinking...</span>
          </div>
        </Card>
      </div>
    </div>
  );
} 