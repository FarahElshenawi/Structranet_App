import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MessageList({ messages }) {
  if (!messages || messages.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-ink-100 mb-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm text-ink-500">Describe a network and the AI will design it for you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {messages.map((msg, i) => (
        <MessageBubble key={i} message={msg} />
      ))}
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-ink-800 to-ink-950 text-white flex items-center justify-center shadow-sm ring-1 ring-inset ring-white/10">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="6" r="2" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <circle cx="12" cy="12" r="2" />
        <path d="M6 8v8M18 8v8M8 6h8M8 18h8M8 8l2.5 2.5M16 8l-2.5 2.5M8 16l2.5-2.5M16 16l-2.5-2.5" />
      </svg>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="flex items-start gap-3 max-w-[85%] flex-row-reverse">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-xs font-semibold shadow-sm">
            You
          </div>
          <div className="rounded-2xl rounded-tr-md bg-gradient-to-br from-brand-600 to-brand-700 text-white px-4 py-2.5 shadow-soft">
            <p className="text-[15px] leading-7 whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="flex gap-3 animate-fade-in">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-ink-900">StructuraNet AI</span>
          <span className="text-[10px] text-ink-400 uppercase tracking-wider">Assistant</span>
        </div>
        <div className="chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
        {message.toolSummary && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-600 bg-ink-100 rounded-md px-2.5 py-1 ring-1 ring-inset ring-ink-200">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-success-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <span className="font-medium">{message.toolSummary}</span>
          </div>
        )}
      </div>
    </div>
  );
}
