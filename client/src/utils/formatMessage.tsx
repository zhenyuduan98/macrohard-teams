import React from 'react';

// Format message text with markdown-like syntax
export function formatMessage(text: string): React.ReactNode[] {
  // First handle code blocks
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts: { type: 'text' | 'codeblock'; content: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'codeblock', content: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }
  if (parts.length === 0) parts.push({ type: 'text', content: text });

  return parts.map((part, i) => {
    if (part.type === 'codeblock') {
      return (
        <pre key={i} style={{
          background: '#1e1e1e', color: '#d4d4d4', padding: '8px 12px',
          borderRadius: 6, fontSize: 13, overflow: 'auto', margin: '4px 0',
          fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <code>{part.content.trim()}</code>
        </pre>
      );
    }
    return <React.Fragment key={i}>{formatInline(part.content)}</React.Fragment>;
  });
}

function formatInline(text: string): React.ReactNode[] {
  // Combined regex for inline formatting
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(~~(.+?)~~)|(@\S+)|(https?:\/\/[^\s<]+)/g;
  const result: React.ReactNode[] = [];
  let lastIdx = 0;
  let m;
  let key = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      result.push(text.slice(lastIdx, m.index));
    }

    if (m[1]) { // **bold**
      result.push(<strong key={key++}>{m[2]}</strong>);
    } else if (m[3]) { // *italic*
      result.push(<em key={key++}>{m[4]}</em>);
    } else if (m[5]) { // `code`
      result.push(
        <code key={key++} style={{
          background: 'var(--bg-hover)', padding: '1px 4px',
          borderRadius: 3, fontSize: '0.9em', fontFamily: 'monospace',
        }}>{m[6]}</code>
      );
    } else if (m[7]) { // ~~strikethrough~~
      result.push(<del key={key++}>{m[8]}</del>);
    } else if (m[0].startsWith('@')) { // @mention
      result.push(<span key={key++} style={{ color: '#6264a7', fontWeight: 600 }}>{m[0]}</span>);
    } else { // URL
      result.push(
        <a key={key++} href={m[0]} target="_blank" rel="noopener noreferrer"
          style={{ color: '#6264a7', textDecoration: 'underline' }}>{m[0]}</a>
      );
    }
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < text.length) {
    result.push(text.slice(lastIdx));
  }

  return result;
}
