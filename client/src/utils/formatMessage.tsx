import React from 'react';
import Markdown from 'react-markdown';

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <Markdown
        components={{
          h1: ({children}) => <div style={{fontSize: 20, fontWeight: 700, margin: '16px 0 8px', color: 'var(--text-primary, #1a1a1a)'}}>{children}</div>,
          h2: ({children}) => <div style={{fontSize: 18, fontWeight: 700, margin: '14px 0 6px', color: 'var(--text-primary, #1a1a1a)'}}>{children}</div>,
          h3: ({children}) => <div style={{fontSize: 16, fontWeight: 700, margin: '12px 0 4px', color: 'var(--text-primary, #1a1a1a)'}}>{children}</div>,
          p: ({children}) => <p style={{margin: '8px 0', lineHeight: 1.7, color: 'var(--text-primary, #1a1a1a)'}}>{children}</p>,
          ul: ({children}) => <ul style={{margin: '6px 0', paddingLeft: 20, listStyleType: 'disc'}}>{children}</ul>,
          ol: ({children}) => <ol style={{margin: '6px 0', paddingLeft: 20}}>{children}</ol>,
          li: ({children}) => <li style={{margin: '3px 0', lineHeight: 1.6}}>{children}</li>,
          strong: ({children}) => <strong style={{fontWeight: 700}}>{children}</strong>,
          em: ({children}) => <em>{children}</em>,
          code: ({className, children}) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <pre style={{background: '#1e1e1e', color: '#d4d4d4', padding: '12px 16px', borderRadius: 8, fontSize: 13, overflow: 'auto', margin: '8px 0', fontFamily: 'Consolas, monospace', lineHeight: 1.5}}><code>{children}</code></pre>;
            }
            return <code style={{background: 'var(--bg-hover, #f0f0f0)', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'Consolas, monospace'}}>{children}</code>;
          },
          blockquote: ({children}) => <blockquote style={{borderLeft: '3px solid #6264a7', paddingLeft: 12, margin: '8px 0', color: 'var(--text-secondary, #616161)'}}>{children}</blockquote>,
          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{color: '#6264a7', textDecoration: 'underline'}}>{children}</a>,
          hr: () => <hr style={{border: 'none', borderTop: '1px solid var(--border, #e0e0e0)', margin: '12px 0'}} />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

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
    return <React.Fragment key={i}>{formatTextBlock(part.content)}</React.Fragment>;
  });
}

// Process a text block line-by-line for headers, lists, and paragraphs
function formatTextBlock(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Headers: ## or ###
    if (/^#{1,3}\s+/.test(trimmed)) {
      const headerMatch = trimmed.match(/^(#{1,3})\s+(.*)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const fontSize = level <= 2 ? 16 : 15;
        result.push(
          <div key={key++} style={{
            fontWeight: 600, fontSize, marginTop: 8, marginBottom: 2,
            color: 'var(--text-primary)',
          }}>
            {formatInline(headerMatch[2])}
          </div>
        );
        i++;
        continue;
      }
    }

    // Bullet list: collect consecutive lines starting with - or *
    if (/^[-*]\s+/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const bm = lines[i].trimStart().match(/^[-*]\s+(.*)/);
        if (!bm) break;
        items.push(<li key={items.length} style={{ marginBottom: 1 }}>{formatInline(bm[1])}</li>);
        i++;
      }
      result.push(
        <ul key={key++} style={{ margin: '2px 0', paddingLeft: 20, listStyleType: 'disc' }}>
          {items}
        </ul>
      );
      continue;
    }

    // Numbered list: collect consecutive lines starting with N.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const nm = lines[i].trimStart().match(/^\d+\.\s+(.*)/);
        if (!nm) break;
        items.push(<li key={items.length} style={{ marginBottom: 1 }}>{formatInline(nm[1])}</li>);
        i++;
      }
      result.push(
        <ol key={key++} style={{ margin: '2px 0', paddingLeft: 20 }}>
          {items}
        </ol>
      );
      continue;
    }

    // Empty line → spacing
    if (trimmed === '') {
      result.push(<div key={key++} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Regular text line
    result.push(
      <span key={key++}>
        {formatInline(line)}
        {i < lines.length - 1 && lines[i + 1]?.trim() !== '' ? <br /> : null}
      </span>
    );
    i++;
  }

  return result;
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
