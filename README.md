## Architecture

### Component Structure
```
src/
├── components/
│   ├── ui/              # shadcn/ui base components
│   └── chat/            # Chat-specific components
│       ├── ChatHeader.tsx      # Top navigation bar
│       ├── ChatContainer.tsx   # Scrollable message area
│       ├── ChatInput.tsx       # Input field with send button
│       ├── ChatMessage.tsx     # Individual message component
│       ├── TypingIndicator.tsx # AI thinking animation
│       └── index.ts            # Component exports
├── hooks/
│   └── useChat.ts       # Chat state management
├── types/
│   └── chat.ts          # TypeScript interfaces
├── data/
│   └── dummyMessages.ts # Sample conversation data
└── lib/
    └── utils.ts         # Utility functions
```

### Installation

1. **Clone and install dependencies:**
```bash
cd frontend
pnpm install
```

2. **Start development server:**
```bash
pnpm dev
```

3. **Open in browser:**
Visit `http://localhost:5173` to see the chatbot

### Building for Production

```bash
pnpm build
```

The build will be optimized and ready for deployment in the `dist/` folder.

## 🎯 Usage

### Basic Chat Flow
1. **Welcome**: New users see a welcoming empty state
2. **Type Message**: Enter text in the growing input field
3. **Send**: Click send button or press Enter
4. **AI Response**: Watch typing indicator, then receive response
5. **Continue**: Build an ongoing conversation

### Keyboard Shortcuts
- `Enter`: Send message
- `Shift + Enter`: New line in message
- Message input auto-expands as you type

## Customization

### Theming
The app uses shadcn/ui's theming system. Customize colors in `src/index.css`:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  /* ... more variables */
}
```