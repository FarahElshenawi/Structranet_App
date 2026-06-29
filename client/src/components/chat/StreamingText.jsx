import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function StreamingText({ text }) {
  return (
    <div className="flex gap-3 animate-fade-in">
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
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-ink-900">StructuraNet AI</span>
          <span className="inline-flex items-center gap-1 text-[10px] text-brand-600 uppercase tracking-wider font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-500" />
            </span>
            Streaming
          </span>
        </div>
        <div className="chat-markdown streaming-cursor">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
