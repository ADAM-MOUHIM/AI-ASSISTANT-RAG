import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface ChatInputProps {
  // ✅ Now supports optional `stream` flag (keeps compat with single-arg handlers)
  onSendMessage: (message: string, stream?: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Type your message...',
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      // ✅ Ask for streaming by default
      onSendMessage(input.trim(), true);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const effectivePlaceholder = disabled
    ? 'Assistant is responding…'
    : placeholder;

  return (
    <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container max-w-4xl mx-auto p-3 sm:p-4">
        <div className="flex items-end gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={effectivePlaceholder}
              disabled={disabled}
              className="min-h-[44px] max-h-[120px] sm:max-h-[200px] resize-none text-sm leading-relaxed border-input focus:border-ring transition-colors"
              rows={1}
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            size="icon"
            className="h-11 w-11 shrink-0 transition-all duration-200 hover:scale-105"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-2 px-1 hidden sm:block">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
