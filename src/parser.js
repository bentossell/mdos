import matter from 'gray-matter';
import { readFileSync } from 'fs';
import { Liquid } from 'liquidjs';

const liquid = new Liquid();

/**
 * Parse markdown file with frontmatter and template substitution
 */
export function parseMarkdown(filePath, state = {}) {
  const content = readFileSync(filePath, 'utf8');
  const { data: frontmatter, content: body } = matter(content);
  
  return {
    frontmatter,
    body,
    tools: frontmatter.tools || {},
    statePath: frontmatter.state || null,
    refresh: frontmatter.refresh || null
  };
}

/**
 * Extract action definitions from markdown
 * Formats:
 * [#action-name]: !command args
 * [widget-name]: !command args
 */
export function extractActions(body) {
  const actions = {};
  const widgets = {};
  
  // Match [#name]: !command or [name]: !command
  const actionRegex = /^\[#?([^\]]+)\]:\s*!(.+)$/gm;
  let match;
  
  while ((match = actionRegex.exec(body)) !== null) {
    const [, name, command] = match;
    if (name.startsWith('#')) {
      actions[name.slice(1)] = command.trim();
    } else {
      widgets[name] = command.trim();
    }
  }
  
  return { actions, widgets };
}

/**
 * Extract action links from markdown
 * Format: [Text](#action-name)
 */
export function extractActionLinks(body) {
  const links = [];
  const linkRegex = /\[([^\]]+)\]\(#([^\)]+)\)/g;
  let match;
  
  while ((match = linkRegex.exec(body)) !== null) {
    links.push({
      text: match[1],
      action: match[2]
    });
  }
  
  return links;
}

/**
 * Render template with state
 */
export async function renderTemplate(template, state) {
  try {
    return await liquid.parseAndRender(template, state);
  } catch (error) {
    console.error('Template error:', error.message);
    return template;
  }
}

/**
 * Clean body - remove action/widget definitions for display
 */
export function cleanBody(body) {
  return body.replace(/^\[#?[^\]]+\]:\s*!.+$/gm, '').trim();
}
