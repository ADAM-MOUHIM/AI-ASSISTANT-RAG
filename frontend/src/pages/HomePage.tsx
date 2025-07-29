import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useChat } from '@/context/ChatContext';
import { 
  MessageSquare, 
  Sparkles,
} from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const { createNewChat } = useChat();

  const handleNewChat = () => {
    const newChatId = createNewChat();
    navigate(`/chats/${newChatId}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-bold">Welcome to AI Assistant</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your intelligent companion for coding, learning, and problem-solving. 
              Start a conversation and explore what's possible.
            </p>
          </div>

          <Button 
            onClick={handleNewChat}
            size="lg" 
            className="gap-2 h-12 px-8"
          >
            <MessageSquare className="h-5 w-5" />
            Start New Conversation
          </Button>
        </div>
      </div>
    </div>
  );
} 