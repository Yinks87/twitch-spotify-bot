// Schlanker Markdown-Renderer für GitHub-Patchnotes. Es wird nie HTML eingefügt: der Text
// wird zu React-Elementen, Links werden nur für https-Adressen erzeugt (Öffnen im System-Browser).

const INLINE =
  /(`+)([^`]+?)\1|!?\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\*([^\s*][^*]*?)\*|(?<![\w])_([^\s_][^_]*?)_(?![\w])|(https:\/\/[^\s<>)]+)/g;

const isSafeUrl = (url) => /^https:\/\//i.test(url);

function Link({ href, children }) {
  if (!isSafeUrl(href)) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
}

function renderInline(text, keyPrefix = 'i') {
  const nodes = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${index++}`;
    const [, , code, linkText, href, strongA, strongB, strike, emA, emB, bareUrl] = match;
    if (code !== undefined) nodes.push(<code key={key}>{code}</code>);
    else if (href !== undefined) {
      nodes.push(
        <Link key={key} href={href}>
          {renderInline(linkText || href, key)}
        </Link>
      );
    } else if (strongA ?? strongB)
      nodes.push(<strong key={key}>{renderInline(strongA ?? strongB, key)}</strong>);
    else if (strike !== undefined) nodes.push(<del key={key}>{renderInline(strike, key)}</del>);
    else if (emA ?? emB) nodes.push(<em key={key}>{renderInline(emA ?? emB, key)}</em>);
    else if (bareUrl) {
      const trimmed = bareUrl.replace(/[.,;:!?]+$/, '');
      nodes.push(
        <Link key={key} href={trimmed}>
          {trimmed}
        </Link>
      );
      if (trimmed.length < bareUrl.length) nodes.push(bareUrl.slice(trimmed.length));
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BULLET = /^\s*(?:[-*+])\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s*(```|~~~)/;

function parseBlocks(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
    } else if (FENCE.test(line)) {
      const fence = line.trim().slice(0, 3);
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: code.join('\n') });
    } else if (HEADING.test(line)) {
      const [, hashes, text] = line.match(HEADING);
      blocks.push({ type: 'heading', level: hashes.length, text });
      i++;
    } else if (RULE.test(line)) {
      blocks.push({ type: 'rule' });
      i++;
    } else if (/^\s*>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ type: 'quote', blocks: parseBlocks(quote.join('\n')) });
    } else if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = !BULLET.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(lines[i].match(pattern)[1]);
        i++;
        // Fortsetzungszeilen (eingerückt) gehören zum vorherigen Eintrag.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !pattern.test(lines[i])) {
          items[items.length - 1] += ` ${lines[i++].trim()}`;
        }
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
    } else {
      const paragraph = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !FENCE.test(lines[i]) &&
        !HEADING.test(lines[i]) &&
        !RULE.test(lines[i]) &&
        !/^\s*>/.test(lines[i]) &&
        !BULLET.test(lines[i]) &&
        !ORDERED.test(lines[i])
      ) {
        paragraph.push(lines[i++].trim());
      }
      blocks.push({ type: 'p', text: paragraph.join('\n') });
    }
  }
  return blocks;
}

// Zeilenumbrüche innerhalb eines Absatzes bleiben wie bei GitHub-Releases sichtbar.
function renderText(text, key) {
  return text
    .split('\n')
    .flatMap((part, index) => [
      ...(index ? [<br key={`${key}-br-${index}`} />] : []),
      ...renderInline(part, `${key}-${index}`)
    ]);
}

function renderBlocks(blocks, keyPrefix = 'b') {
  return blocks.map((block, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (block.type) {
      case 'heading': {
        const Tag = `h${Math.min(block.level + 2, 6)}`;
        return <Tag key={key}>{renderInline(block.text, key)}</Tag>;
      }
      case 'code':
        return (
          <pre key={key}>
            <code>{block.text}</code>
          </pre>
        );
      case 'rule':
        return <hr key={key} />;
      case 'quote':
        return <blockquote key={key}>{renderBlocks(block.blocks, key)}</blockquote>;
      case 'ul':
      case 'ol': {
        const Tag = block.type;
        return (
          <Tag key={key}>
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
            ))}
          </Tag>
        );
      }
      default:
        return <p key={key}>{renderText(block.text, key)}</p>;
    }
  });
}

export default function Markdown({ source }) {
  return <div className="markdown">{renderBlocks(parseBlocks(source ?? ''))}</div>;
}
