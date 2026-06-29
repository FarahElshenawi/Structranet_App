import { useState, useRef, useEffect } from 'react';

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="max-w-3xl mx-auto">
      <div
        className={`relative flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-soft-lg transition-all duration-150 ${
          disabled
            ? 'border-ink-200 opacity-90'
            : 'border-ink-200 focus-within:border-brand-400 focus-within:shadow-glow-brand'
        }`}
      >
        <textarea
          ref={textareaRef}
          data-chat-input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? 'Generating response…' : 'Describe a network, ask for changes, or request an export…'}
          className="flex-1 resize-none bg-transparent border-0 outline-none focus:ring-0 text-[15px] text-ink-900 placeholder-ink-400 px-2.5 py-2 max-h-40 leading-6"
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
            canSend
              ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-soft hover:from-brand-400 hover:to-brand-500 hover:shadow-glow-brand active:scale-95'
              : 'bg-ink-100 text-ink-400 cursor-not-allowed'
          }`}
          title="Send (Enter)"
          aria-label="Send message"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>

      <p className="text-[11px] text-ink-400 mt-2 text-center">
        Press <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-[10px] font-mono border border-ink-200">Enter</kbd> to send ·{' '}
        <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-[10px] font-mono border border-ink-200">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
