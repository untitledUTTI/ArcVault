import type { EditorFormat } from '../../types/archive';

/**
 * Converts between Markdown and LaTeX representations for dual-format backup sync.
 */
export function markdownToLatex(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (!inTable || tableRows.length === 0) return;
    const cols = tableRows[0].length;
    out.push(`\\begin{table}[htbp]`);
    out.push(`\\centering`);
    out.push(`\\begin{tabular}{${'l'.repeat(cols)}}`);
    out.push(`\\hline`);
    tableRows.forEach((row, idx) => {
      out.push(`${row.join(' & ')} \\\\`);
      if (idx === 0) out.push(`\\hline`);
    });
    out.push(`\\hline`);
    out.push(`\\end{tabular}`);
    out.push(`\\end{table}`);
    inTable = false;
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      // Skip separator row like | --- | --- |
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        inTable = true;
        continue;
      }
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      out.push(`\\section{${h1[1]}}`);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      out.push(`\\subsection{${h2[1]}}`);
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      out.push(`\\subsubsection{${h3[1]}}`);
      continue;
    }

    const img = line.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (img) {
      out.push(`\\begin{figure}[htbp]\n\\centering\n\\includegraphics{${img[2]}}\n\\caption{${img[1]}}\n\\end{figure}`);
      continue;
    }

    const fn = line.match(/^\[\^fn(\d+)\]:\s*(.+)$/);
    if (fn) {
      out.push(`% [Footnote ${fn[1]}]: ${fn[2]}`);
      continue;
    }

    const converted = line
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}')
      .replace(/\*(.+?)\*/g, '\\textit{$1}');
    out.push(converted);
  }

  if (inTable) flushTable();
  return out.join('\n');
}

export function latexToMarkdown(tex: string): string {
  const lines = tex.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const s1 = line.match(/^\\section\{(.+)\}$/);
    if (s1) {
      out.push(`# ${s1[1]}`);
      continue;
    }
    const s2 = line.match(/^\\subsection\{(.+)\}$/);
    if (s2) {
      out.push(`## ${s2[1]}`);
      continue;
    }
    const s3 = line.match(/^\\subsubsection\{(.+)\}$/);
    if (s3) {
      out.push(`### ${s3[1]}`);
      continue;
    }
    if (
      /^\\begin\{(table|tabular|figure)\}/.test(line) ||
      /^\\end\{(table|tabular|figure)\}/.test(line) ||
      line.trim() === '\\centering' ||
      line.trim() === '\\hline'
    ) {
      continue;
    }
    const fnComment = line.match(/^%\s*\[Footnote (\d+)\]:\s*(.+)$/);
    if (fnComment) {
      out.push(`[^fn${fnComment[1]}]: ${fnComment[2]}`);
      continue;
    }
    const converted = line
      .replace(/\\textbf\{(.+?)\}/g, '**$1**')
      .replace(/\\textit\{(.+?)\}/g, '*$1*')
      .replace(/\s*\\\\$/, '');
    out.push(converted);
  }

  return out.join('\n');
}

export function syncFormatText(
  sourceText: string,
  fromFormat: EditorFormat,
  toFormat: EditorFormat,
): string {
  if (fromFormat === toFormat) return sourceText;
  return fromFormat === 'markdown' ? markdownToLatex(sourceText) : latexToMarkdown(sourceText);
}
