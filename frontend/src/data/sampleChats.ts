import type { ChatSession } from '@/types/chat';

export const sampleChatSessions: ChatSession[] = [
  {
    id: 'default',
    title: 'React Best Practices',
    messages: [
      {
        id: '1',
        content: 'Hello! How can I assist you today?',
        role: 'assistant',
        timestamp: new Date(Date.now() - 300000),
      },
      {
        id: '2',
        content: 'I\'m looking for help with building a React application. Can you guide me through the best practices?',
        role: 'user',
        timestamp: new Date(Date.now() - 240000),
      },
      {
        id: '3',
        content: 'Absolutely! I\'d be happy to help you with React best practices. Here are some key areas to focus on:\n\n1. **Component Structure**: Keep components small and focused on a single responsibility\n2. **State Management**: Use useState for local state, and consider Context API or external libraries for global state\n3. **Performance**: Utilize React.memo, useMemo, and useCallback to prevent unnecessary re-renders\n4. **TypeScript**: Use TypeScript for better type safety and developer experience\n\nWhat specific aspect would you like to dive deeper into?',
        role: 'assistant',
        timestamp: new Date(Date.now() - 180000),
      },
    ],
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    updatedAt: new Date(Date.now() - 180000),
  },
  {
    id: 'typescript-guide',
    title: 'TypeScript with React',
    messages: [
      {
        id: 't1',
        content: 'Can you help me understand TypeScript with React?',
        role: 'user',
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      },
      {
        id: 't2',
        content: 'Of course! TypeScript adds static type checking to JavaScript, making your React code more reliable and easier to maintain. Here are the key benefits:\n\n**Type Safety**: Catch errors at compile time\n**Better IDE Support**: Enhanced autocomplete and refactoring\n**Self-Documenting Code**: Types serve as documentation\n\nWould you like to see some practical examples of typed React components?',
        role: 'assistant',
        timestamp: new Date(Date.now() - 7180000),
      },
      {
        id: 't3',
        content: 'Yes, please show me some examples!',
        role: 'user',
        timestamp: new Date(Date.now() - 7140000),
      },
      {
        id: 't4',
        content: 'Here\'s a simple typed React component:\n\n```typescript\ninterface UserProps {\n  name: string;\n  age: number;\n  isOnline?: boolean;\n}\n\nfunction User({ name, age, isOnline = false }: UserProps) {\n  return (\n    <div>\n      <h2>{name}</h2>\n      <p>Age: {age}</p>\n      <span>{isOnline ? "Online" : "Offline"}</span>\n    </div>\n  );\n}\n```\n\nThis ensures type safety for props and helps catch errors early!',
        role: 'assistant',
        timestamp: new Date(Date.now() - 7120000),
      },
    ],
    createdAt: new Date(Date.now() - 7200000),
    updatedAt: new Date(Date.now() - 7120000),
  },
  {
    id: 'api-integration',
    title: 'API Integration Patterns',
    messages: [
      {
        id: 'a1',
        content: 'What are the best practices for API integration in React?',
        role: 'user',
        timestamp: new Date(Date.now() - 172800000), // 2 days ago
      },
      {
        id: 'a2',
        content: 'Great question! Here are the key patterns for React API integration:\n\n**1. Custom Hooks**: Create reusable hooks for API calls\n**2. Error Handling**: Implement proper error boundaries and user feedback\n**3. Loading States**: Show loading indicators during requests\n**4. Caching**: Use libraries like React Query or SWR for intelligent caching\n**5. Optimistic Updates**: Update UI immediately for better UX\n\nWould you like me to elaborate on any of these patterns?',
        role: 'assistant',
        timestamp: new Date(Date.now() - 172780000),
      },
    ],
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 172780000),
  },
  {
    id: 'performance-tips',
    title: 'React Performance Optimization',
    messages: [
      {
        id: 'p1',
        content: 'My React app is getting slow. Any performance tips?',
        role: 'user',
        timestamp: new Date(Date.now() - 604800000), // 1 week ago
      },
      {
        id: 'p2',
        content: 'I can help you optimize your React app! Here are the most impactful techniques:\n\n**React.memo()**: Prevent unnecessary re-renders\n**useMemo()**: Cache expensive calculations\n**useCallback()**: Memoize event handlers\n**Code Splitting**: Lazy load components with React.lazy()\n**Bundle Analysis**: Use tools like webpack-bundle-analyzer\n\nLet\'s start with identifying the bottlenecks. Do you have any specific slow components?',
        role: 'assistant',
        timestamp: new Date(Date.now() - 604780000),
      },
    ],
    createdAt: new Date(Date.now() - 604800000),
    updatedAt: new Date(Date.now() - 604780000),
  },
]; 