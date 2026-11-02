import React from "react";

interface WhatsAppPreviewProps {
  text: string;
  title?: string;
}

/**
 * Parses simple WhatsApp formatting (*bold*, _italic_, ~strike~)
 * into safe React nodes with realistic WhatsApp chat styling.
 */
export function formatWhatsAppMarkup(raw: string): React.ReactNode[] {
  // Split into lines to preserve paragraphs and linebreaks
  const lines = raw.split("\n");

  return lines.map((line, lineIdx) => {
    if (!line.trim()) {
      return <div key={lineIdx} className="wa-gap" />;
    }

    // Parse tokens inside the line
    // Regex matches *bold*, _italic_, or URL links
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let keyCounter = 0;

    // Pattern to catch bold (*...*), italic (_..._), links (https?://...)
    const tokenRegex = /(\*[^*]+\*|_[^_]+_|https?:\/\/[^\s]+)/g;
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      const token = match[0];
      if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
        parts.push(
          <strong key={`${lineIdx}-${keyCounter++}`} className="wa-bold">
            {token.slice(1, -1)}
          </strong>
        );
      } else if (token.startsWith("_") && token.endsWith("_") && token.length > 2) {
        parts.push(
          <em key={`${lineIdx}-${keyCounter++}`} className="wa-italic">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith("http")) {
        parts.push(
          <span
            key={`${lineIdx}-${keyCounter++}`}
            className="wa-link"
          >
            {token}
          </span>
        );
      } else {
        parts.push(token);
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return (
      <div key={lineIdx} className="wa-line">
        {parts.length > 0 ? parts : "\u00A0"}
      </div>
    );
  });
}

export function WhatsAppPreview({ text, title = "Anteprima messaggio WhatsApp" }: WhatsAppPreviewProps) {
  if (!text || !text.trim()) return null;

  return (
    <div className="wa-preview-wrapper">
      <div className="wa-preview-label">💬 {title}</div>
      <div className="wa-bubble">
        <div className="wa-content">{formatWhatsAppMarkup(text)}</div>
        <div className="wa-timestamp">
          <span>Adesso</span>
          <span className="wa-ticks">✓✓</span>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, isVisible }: { message: string; isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <div className="toast-floating" role="status" aria-live="polite">
      <span>{message}</span>
    </div>
  );
}
