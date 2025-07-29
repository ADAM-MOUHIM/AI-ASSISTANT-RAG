import type { Message } from '../types/chat';

export const dummyMessages: Message[] = [
  {
    id: '1',
    content: 'Hello! How can I assist you today?',
    role: 'assistant',
    timestamp: new Date(Date.now() - 300000), // 5 minutes ago
  },
  {
    id: '2',
    content: 'I\'m looking for help with building a React application. Can you guide me through the best practices?',
    role: 'user',
    timestamp: new Date(Date.now() - 240000), // 4 minutes ago
  },
  {
    id: '3',
    content: 'Absolutely! I\'d be happy to help you with React best practices. Here are some key areas to focus on:\n\n1. **Component Structure**: Keep components small and focused on a single responsibility\n2. **State Management**: Use useState for local state, and consider Context API or external libraries for global state\n3. **Performance**: Utilize React.memo, useMemo, and useCallback to prevent unnecessary re-renders\n4. **TypeScript**: Use TypeScript for better type safety and developer experience\n\nWhat specific aspect would you like to dive deeper into?',
    role: 'assistant',
    timestamp: new Date(Date.now() - 180000), // 3 minutes ago
  },
  {
    id: '4',
    content: 'That\'s very helpful! Can you tell me more about performance optimization?',
    role: 'user',
    timestamp: new Date(Date.now() - 120000), // 2 minutes ago
  },
  {
    id: '5',
    content: 'Great question! Performance optimization in React is crucial for smooth user experiences. Here are the key strategies:\n\n**React.memo()**: Wrap functional components to prevent re-renders when props haven\'t changed\n\n**useMemo()**: Memoize expensive calculations\n```javascript\nconst expensiveValue = useMemo(() => {\n  return heavyComputation(data);\n}, [data]);\n```\n\n**useCallback()**: Memoize functions to prevent child re-renders\n```javascript\nconst handleClick = useCallback(() => {\n  // handle click\n}, [dependency]);\n```\n\n**Code Splitting**: Use React.lazy() and Suspense for route-based code splitting\n\n**Virtual Scrolling**: For large lists, consider libraries like react-window\n\nWould you like me to elaborate on any of these techniques?',
    role: 'assistant',
    timestamp: new Date(Date.now() - 60000), // 1 minute ago
  },
]; 