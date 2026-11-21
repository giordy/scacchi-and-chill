// Rendered HTML -> the text a person reads, one block per line, for golden files that show text
// changes and not markup changes. Inline elements are joined without a break (so a missing space
// between "vince" and a name shows), block elements start a new line, and the texts that are not
// content (title, aria-label, placeholder, alt, value of buttons and inputs) are kept on their own line.
// Bold is written *bold* and italic _italic_, as in the WhatsApp messages.
const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'button', 'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'label', 'legend',
  'li', 'main', 'nav', 'ol', 'option', 'p', 'pre', 'section', 'select', 'summary', 'table', 'tbody', 'td', 'textarea', 'tfoot',
  'th', 'thead', 'tr', 'ul',
]);
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'value', 'data-tip'];

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

export function htmlText(html: string): string {
  // Scripts, styles and SVG drawings carry no text for a reader (SVG <title> is kept)
  const clean = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .replace(/<path[^>]*>/g, '');
  const out: string[] = [];
  let line = '';
  const flush = () => {
    const t = line.replace(/[ \t\r\n]+/g, ' ').trim();
    if (t) out.push(t);
    line = '';
  };
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let pre = 0;
  while ((m = re.exec(clean))) {
    if (m[4] !== undefined) {
      const text = decode(m[4]);
      if (pre > 0) {
        // Pre-formatted text (WhatsApp previews, prompts): keep its lines
        const lines = text.split('\n');
        lines.forEach((l, i) => {
          if (i > 0) flush();
          line += l;
        });
      } else {
        line += text;
      }
      continue;
    }
    const [, closing, rawTag, attrs] = m;
    const tag = rawTag.toLowerCase();
    if ((tag === 'pre' || tag === 'textarea') && !closing) pre++;
    if ((tag === 'pre' || tag === 'textarea') && closing) pre = Math.max(0, pre - 1);
    if (BLOCK.has(tag)) flush();
    // Bold and italic as in WhatsApp, so that a lost *bold* of a message shows too
    if (tag === 'b' || tag === 'strong') line += '*';
    if (tag === 'em' || tag === 'i') line += '_';
    if (!closing) {
      for (const a of ATTRS) {
        const v = new RegExp(`\\s${a}="([^"]*)"`).exec(attrs);
        if (v && v[1].trim()) {
          flush();
          out.push(`[${a}: ${decode(v[1]).replace(/\s+/g, ' ').trim()}]`);
        }
      }
    }
  }
  flush();
  return out.join('\n') + '\n';
}
