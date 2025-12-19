/**
 * Markdown enhancer - auto-style common patterns
 */

/**
 * Extract inline metadata from text
 * Example: "Email subject (2h ago) [Archive](#archive)"
 * Returns: { text: "Email subject", metadata: "2h ago", actions: [...] }
 */
function extractInlineMetadata(line) {
  // Match (metadata) in parentheses
  const metadataMatch = line.match(/\(([^)]+)\)/);
  const metadata = metadataMatch ? metadataMatch[1] : null;
  
  // Extract text without metadata and actions
  let text = line.replace(/\([^)]+\)/g, '').replace(/\[([^\]]+)\]\(#[^)]+\)/g, '').trim();
  
  // Extract action links
  const actionRegex = /\[([^\]]+)\]\(#([^)]+)\)/g;
  const actions = [];
  let match;
  while ((match = actionRegex.exec(line)) !== null) {
    actions.push({
      text: match[1],
      action: match[2]
    });
  }
  
  return { text, metadata, actions };
}

/**
 * Enhance checkbox lists
 * - [ ] Task -> Styled checkbox with task
 * - [x] Task -> Styled checkbox (checked) with strikethrough
 * - [!] Task -> Alert/important styling
 */
export function enhanceCheckboxes(markdown) {
  return markdown.replace(/^(\s*)- \[([ x!])\] (.+)$/gm, (match, indent, status, text) => {
    const { text: mainText, metadata, actions } = extractInlineMetadata(text);
    
    let statusClass = '';
    let icon = '';
    let textClass = '';
    
    if (status === 'x') {
      statusClass = 'text-green-600';
      icon = '✓';
      textClass = 'line-through text-gray-500';
    } else if (status === '!') {
      statusClass = 'text-red-600';
      icon = '!';
      textClass = 'font-medium';
    } else {
      statusClass = 'text-gray-400';
      icon = '○';
      textClass = '';
    }
    
    const metadataHtml = metadata ? `<span class="text-xs text-gray-500 ml-2">${metadata}</span>` : '';
    const actionsHtml = actions.map(a => 
      `<a href="#${a.action}" class="ml-2 text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">${a.text}</a>`
    ).join('');
    
    return `${indent}<div class="flex items-center gap-2 py-1"><span class="${statusClass}">${icon}</span><span class="${textClass}">${mainText}</span>${metadataHtml}${actionsHtml}</div>`;
  });
}

/**
 * Enhance regular lists with inline actions
 * - Item text [Action](#action) -> Styled as card with action button
 */
export function enhanceListActions(markdown) {
  // Match list items with actions
  return markdown.replace(/^(\s*)- ([^\n]+\[[^\]]+\]\(#[^)]+\)[^\n]*)$/gm, (match, indent, content) => {
    const { text, metadata, actions } = extractInlineMetadata(content);
    
    if (actions.length === 0) return match; // No actions, leave as-is
    
    const metadataHtml = metadata ? `<span class="text-xs text-gray-500">${metadata}</span>` : '';
    const actionsHtml = actions.map(a => 
      `<a href="#${a.action}" class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">${a.text}</a>`
    ).join(' ');
    
    return `${indent}<div class="flex items-center justify-between p-3 border rounded hover:bg-gray-50 mb-2"><div><span>${text}</span>${metadataHtml ? ' ' + metadataHtml : ''}</div><div class="flex gap-2">${actionsHtml}</div></div>`;
  });
}

/**
 * Enhance wiki-style links
 * [[page-name]] -> ?page=page-name
 * [[page-name|Display Text]] -> ?page=page-name with custom text
 */
export function enhanceWikiLinks(markdown) {
  // [[text|display]]
  markdown = markdown.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (match, page, display) => {
    return `[${display}](?page=${encodeURIComponent(page)})`;
  });
  
  // [[text]]
  markdown = markdown.replace(/\[\[([^\]]+)\]\]/g, (match, page) => {
    return `[${page}](?page=${encodeURIComponent(page)})`;
  });
  
  return markdown;
}

/**
 * Apply all enhancements
 */
export function enhanceMarkdown(markdown) {
  let enhanced = markdown;
  enhanced = enhanceWikiLinks(enhanced);
  enhanced = enhanceCheckboxes(enhanced);
  enhanced = enhanceListActions(enhanced);
  return enhanced;
}
