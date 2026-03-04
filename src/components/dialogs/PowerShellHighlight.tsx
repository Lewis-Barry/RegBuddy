import React from 'react';

// ── Token types & colours (VS Code Dark+ palette) ────────────────────────────

type TT =
  | 'comment'    // #6a9955  green
  | 'string'     // #ce9178  peach
  | 'keyword'    // #569cd6  blue
  | 'variable'   // #9cdcfe  light blue
  | 'parameter'  // #9cdcfe  light blue
  | 'type'       // #4ec9b0  teal
  | 'cmdlet'     // #dcdcaa  yellow
  | 'number'     // #b5cea8  light green
  | 'operator'   // #d4d4d4  default
  | 'plain';     // #d4d4d4

const COLOR: Record<TT, string> = {
  comment:   '#6a9955',
  string:    '#ce9178',
  keyword:   '#569cd6',
  variable:  '#9cdcfe',
  parameter: '#9cdcfe',
  type:      '#4ec9b0',
  cmdlet:    '#dcdcaa',
  number:    '#b5cea8',
  operator:  '#d4d4d4',
  plain:     '#d4d4d4',
};

interface Token { type: TT; text: string }

// ── Keyword set ───────────────────────────────────────────────────────────────

const KEYWORDS = new Set([
  'if','else','elseif','foreach','for','while','do','switch',
  'try','catch','finally','function','param','return','break',
  'continue','exit','throw','class','enum','filter','workflow',
  'begin','process','end','in','not','and','or','xor','eq','ne',
  'lt','le','gt','ge','like','notlike','match','notmatch',
  'contains','notcontains','is','isnot',
]);

// ── Tokeniser ─────────────────────────────────────────────────────────────────

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = src.length;

  function push(type: TT, text: string) {
    tokens.push({ type, text });
    i += text.length;
  }

  while (i < len) {
    const rest = src.slice(i);

    // ── Block comment  <# ... #> ──────────────────────────────────────────
    if (rest.startsWith('<#')) {
      const end = rest.indexOf('#>');
      const text = end === -1 ? rest : rest.slice(0, end + 2);
      push('comment', text);
      continue;
    }

    // ── Line comment  # ... \n ────────────────────────────────────────────
    if (src[i] === '#') {
      const nl = rest.indexOf('\n');
      push('comment', nl === -1 ? rest : rest.slice(0, nl));
      continue;
    }

    // ── Here-string double  @" \n ... \n "@ ──────────────────────────────
    {
      const m = rest.match(/^@"\s*\n[\s\S]*?\n"@/);
      if (m) { push('string', m[0]); continue; }
    }

    // ── Here-string single  @' \n ... \n '@ ──────────────────────────────
    {
      const m = rest.match(/^@'\s*\n[\s\S]*?\n'@/);
      if (m) { push('string', m[0]); continue; }
    }

    // ── Double-quoted string  "..." (backtick escape) ─────────────────────
    if (src[i] === '"') {
      let j = i + 1;
      while (j < len) {
        if (src[j] === '`') { j += 2; continue; }
        if (src[j] === '"') { j++; break; }
        j++;
      }
      push('string', src.slice(i, j));
      continue;
    }

    // ── Single-quoted string  '...' ('' = literal single quote) ──────────
    if (src[i] === "'") {
      let j = i + 1;
      while (j < len) {
        if (src[j] === "'" && src[j + 1] === "'") { j += 2; continue; }
        if (src[j] === "'") { j++; break; }
        j++;
      }
      push('string', src.slice(i, j));
      continue;
    }

    // ── Type literal  [TypeName]  or  [TypeName[]] ────────────────────────
    {
      const m = rest.match(/^\[[A-Za-z_][\w.]*(?:\[\])?\]/);
      if (m) { push('type', m[0]); continue; }
    }

    // ── Variable  $name  or  ${name} ─────────────────────────────────────
    {
      const m = rest.match(/^\$(?:\{[^}]*\}|[A-Za-z_?][\w]*)/);
      if (m) { push('variable', m[0]); continue; }
    }

    // ── Word (keyword, cmdlet, or plain identifier) ───────────────────────
    {
      const m = rest.match(/^[A-Za-z_]\w*/);
      if (m) {
        const word = m[0];
        const lower = word.toLowerCase();
        if (KEYWORDS.has(lower)) {
          push('keyword', word); continue;
        }
        // Cmdlet: Verb-Noun (capital, lowercase, hyphen, capital, letters)
        if (/^[A-Z][a-z]+-[A-Z][A-Za-z]+$/.test(word)) {
          push('cmdlet', word); continue;
        }
        push('plain', word); continue;
      }
    }

    // ── Switch / named parameter  -Word ───────────────────────────────────
    {
      const m = rest.match(/^-[A-Za-z]\w*/);
      if (m) { push('parameter', m[0]); continue; }
    }

    // ── Number ────────────────────────────────────────────────────────────
    {
      const m = rest.match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
      if (m) { push('number', m[0]); continue; }
    }

    // ── Hex number  0x... ─────────────────────────────────────────────────
    {
      const m = rest.match(/^0x[0-9A-Fa-f]+/);
      if (m) { push('number', m[0]); continue; }
    }

    // ── Single char (operator, punctuation, whitespace, newline…) ─────────
    push('plain', src[i]);
  }

  return tokens;
}

// ── React component ───────────────────────────────────────────────────────────

interface Props {
  code: string;
  className?: string;
}

export const PowerShellHighlight: React.FC<Props> = ({ code, className }) => {
  const tokens = tokenize(code);

  return (
    <pre className={className}>
      <code>
        {tokens.map((tok, idx) => (
          tok.type === 'plain'
            ? tok.text   // avoid millions of spans for whitespace/punctuation
            : (
              <span key={idx} style={{ color: COLOR[tok.type] }}>
                {tok.text}
              </span>
            )
        ))}
      </code>
    </pre>
  );
};
