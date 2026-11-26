import type { Element as XmlElement, Node as XmlNode } from '@xmldom/xmldom';

/**
 * Bidirectional converter between Word OMML (<m:oMath>) and LaTeX math syntax.
 */

const SYMBOL_MAP: Record<string, string> = {
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'δ': '\\delta',
  'ε': '\\epsilon',
  'θ': '\\theta',
  'λ': '\\lambda',
  'μ': '\\mu',
  'π': '\\pi',
  'σ': '\\sigma',
  'φ': '\\phi',
  'ω': '\\omega',
  'Δ': '\\Delta',
  'Σ': '\\Sigma',
  'Π': '\\Pi',
  'Ω': '\\Omega',
  '∑': '\\sum',
  '∫': '\\int',
  '∏': '\\prod',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '≈': '\\approx',
  '×': '\\times',
  '·': '\\cdot',
  '∞': '\\infty',
  '→': '\\to',
  '∈': '\\in',
};

const REVERSE_SYMBOL_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_MAP).map(([k, v]) => [v, k]),
);

function localName(node: XmlNode): string {
  const el = node as XmlElement;
  return el.localName || (el.nodeName ? el.nodeName.replace(/^.*:/, '') : '');
}

function childElements(node: XmlNode): XmlElement[] {
  const res: XmlElement[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 1) {
      res.push(child as XmlElement);
    }
  }
  return res;
}

function findChild(node: XmlNode, name: string): XmlElement | undefined {
  return childElements(node).find((el) => localName(el) === name);
}

function getAttrVal(el: XmlElement | undefined): string {
  if (!el) return '';
  return el.getAttribute('m:val') || el.getAttribute('val') || '';
}

function convertTextSymbols(text: string): string {
  let out = '';
  for (const ch of text) {
    out += SYMBOL_MAP[ch] ? `${SYMBOL_MAP[ch]} ` : ch;
  }
  return out.trimEnd();
}

export function ommlNodeToLatex(node: XmlNode): string {
  const name = localName(node);

  if (name === 'oMathPara') {
    const parts = childElements(node)
      .filter((c) => localName(c) === 'oMath')
      .map((c) => ommlNodeToLatex(c));
    return parts.join(' \\\\ ');
  }

  if (name === 'oMath' || name === 'e' || name === 'num' || name === 'den' || name === 'sup' || name === 'sub' || name === 'deg') {
    return childElements(node).map((c) => ommlNodeToLatex(c)).join('');
  }

  if (name === 'r') {
    const tNodes = childElements(node).filter((c) => localName(c) === 't');
    const raw = tNodes.map((t) => t.textContent ?? '').join('');
    return convertTextSymbols(raw);
  }

  if (name === 't') {
    return convertTextSymbols(node.textContent ?? '');
  }

  if (name === 'f') {
    const num = findChild(node, 'num');
    const den = findChild(node, 'den');
    return `\\frac{${num ? ommlNodeToLatex(num) : ''}}{${den ? ommlNodeToLatex(den) : ''}}`;
  }

  if (name === 'sSup') {
    const e = findChild(node, 'e');
    const sup = findChild(node, 'sup');
    return `${e ? ommlNodeToLatex(e) : ''}^{${sup ? ommlNodeToLatex(sup) : ''}}`;
  }

  if (name === 'sSub') {
    const e = findChild(node, 'e');
    const sub = findChild(node, 'sub');
    return `${e ? ommlNodeToLatex(e) : ''}_{${sub ? ommlNodeToLatex(sub) : ''}}`;
  }

  if (name === 'sSubSup') {
    const e = findChild(node, 'e');
    const sub = findChild(node, 'sub');
    const sup = findChild(node, 'sup');
    return `${e ? ommlNodeToLatex(e) : ''}_{${sub ? ommlNodeToLatex(sub) : ''}}^{${sup ? ommlNodeToLatex(sup) : ''}}`;
  }

  if (name === 'rad') {
    const deg = findChild(node, 'deg');
    const e = findChild(node, 'e');
    const degText = deg ? ommlNodeToLatex(deg).trim() : '';
    const inner = e ? ommlNodeToLatex(e) : '';
    return degText ? `\\sqrt[${degText}]{${inner}}` : `\\sqrt{${inner}}`;
  }

  if (name === 'nary') {
    const pr = findChild(node, 'naryPr');
    const chr = getAttrVal(pr ? findChild(pr, 'chr') : undefined) || '∑';
    const op = SYMBOL_MAP[chr] || '\\sum';
    const sub = findChild(node, 'sub');
    const sup = findChild(node, 'sup');
    const e = findChild(node, 'e');
    const subStr = sub ? ommlNodeToLatex(sub).trim() : '';
    const supStr = sup ? ommlNodeToLatex(sup).trim() : '';
    return `${op}${subStr ? `_{${subStr}}` : ''}${supStr ? `^{${supStr}}` : ''} ${e ? ommlNodeToLatex(e) : ''}`.trim();
  }

  if (name === 'd') {
    const pr = findChild(node, 'dPr');
    const beg = getAttrVal(pr ? findChild(pr, 'begChr') : undefined) || '(';
    const end = getAttrVal(pr ? findChild(pr, 'endChr') : undefined) || ')';
    const inner = childElements(node)
      .filter((c) => localName(c) === 'e')
      .map((c) => ommlNodeToLatex(c))
      .join(', ');
    return `\\left${beg}${inner}\\right${end}`;
  }

  if (name === 'm') {
    const rows = childElements(node)
      .filter((c) => localName(c) === 'mr')
      .map((mr) =>
        childElements(mr)
          .filter((c) => localName(c) === 'e')
          .map((e) => ommlNodeToLatex(e))
          .join(' & '),
      );
    return `\\begin{bmatrix}${rows.join(' \\\\ ')}\\end{bmatrix}`;
  }

  // Fallback: recurse into children or read text
  const children = childElements(node);
  if (children.length > 0) {
    return children.map((c) => ommlNodeToLatex(c)).join('');
  }
  return convertTextSymbols(node.textContent ?? '');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function readBracedGroup(src: string, idx: number): { content: string; nextIdx: number } {
  if (src[idx] !== '{') {
    return { content: src[idx] ?? '', nextIdx: idx + 1 };
  }
  let depth = 0;
  let i = idx;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: src.slice(idx + 1, i), nextIdx: i + 1 };
      }
    }
    i++;
  }
  return { content: src.slice(idx + 1), nextIdx: src.length };
}

function latexBodyToOmmlInner(latex: string): string {
  let out = '';
  let i = 0;
  const s = latex.trim();

  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      i += 5;
      while (s[i] === ' ') i++;
      const num = readBracedGroup(s, i);
      i = num.nextIdx;
      while (s[i] === ' ') i++;
      const den = readBracedGroup(s, i);
      i = den.nextIdx;
      out += `<m:f><m:num>${latexBodyToOmmlInner(num.content)}</m:num><m:den>${latexBodyToOmmlInner(den.content)}</m:den></m:f>`;
      continue;
    }

    if (s.startsWith('\\sqrt', i)) {
      i += 5;
      let degXml = '<m:deg/>';
      if (s[i] === '[') {
        const close = s.indexOf(']', i);
        if (close > i) {
          degXml = `<m:deg>${latexBodyToOmmlInner(s.slice(i + 1, close))}</m:deg>`;
          i = close + 1;
        }
      }
      const inner = readBracedGroup(s, i);
      i = inner.nextIdx;
      out += `<m:rad>${degXml}<m:e>${latexBodyToOmmlInner(inner.content)}</m:e></m:rad>`;
      continue;
    }

    if (s[i] === '\\') {
      const match = s.slice(i).match(/^\\[a-zA-Z]+/);
      if (match) {
        const cmd = match[0];
        i += cmd.length;
        const sym = REVERSE_SYMBOL_MAP[cmd] ?? cmd;
        out += `<m:r><m:t>${escapeXml(sym)}</m:t></m:r>`;
        continue;
      }
    }

    // Handle base^{sup} or base_{sub}
    if (i + 1 < s.length && (s[i + 1] === '^' || s[i + 1] === '_')) {
      const base = s[i];
      const op = s[i + 1];
      const grp = readBracedGroup(s, i + 2);
      i = grp.nextIdx;
      if (op === '^') {
        out += `<m:sSup><m:e><m:r><m:t>${escapeXml(base)}</m:t></m:r></m:e><m:sup>${latexBodyToOmmlInner(grp.content)}</m:sup></m:sSup>`;
      } else {
        out += `<m:sSub><m:e><m:r><m:t>${escapeXml(base)}</m:t></m:r></m:e><m:sub>${latexBodyToOmmlInner(grp.content)}</m:sub></m:sSub>`;
      }
      continue;
    }

    // Collect plain characters run
    let j = i;
    while (
      j < s.length &&
      s[j] !== '\\' &&
      !(j + 1 < s.length && (s[j + 1] === '^' || s[j + 1] === '_'))
    ) {
      j++;
    }
    const chunk = s.slice(i, j);
    if (chunk) {
      out += `<m:r><m:t xml:space="preserve">${escapeXml(chunk)}</m:t></m:r>`;
    }
    i = j;
  }

  return out || `<m:r><m:t>${escapeXml(s)}</m:t></m:r>`;
}

export function latexToOmmlXml(latex: string, displayMode = false): string {
  const inner = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${latexBodyToOmmlInner(latex)}</m:oMath>`;
  if (displayMode) {
    return `<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${inner}</m:oMathPara>`;
  }
  return inner;
}
