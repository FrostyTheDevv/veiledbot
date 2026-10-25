const MAX_TEXT = 4000;
const MAX_CHILDREN = 10;

export function escapeMarkdown(value = '') {
  return String(value).replace(/[\\`*_{}\[\]()<>#+\-.!|~]/g, '\\$&');
}

function textDisplay(content) {
  const value = String(content ?? '').trim() || '\u200b';
  if (value.length > MAX_TEXT) throw new RangeError(`Container text must be ${MAX_TEXT} characters or fewer.`);
  return { type: 10, content: value };
}

export function createContainer({ title, description, sections = [], footer, accentColor = 0x5865f2, linkButtons = [] } = {}) {
  const children = [];
  if (title) children.push(textDisplay(`## ${title}`));
  if (description) children.push(textDisplay(description));
  for (const section of sections) {
    if (children.length >= MAX_CHILDREN - 1) break;
    if (section?.divider && children.length) children.push({ type: 14, divider: true, spacing: 1 });
    if (section?.content) children.push(textDisplay(section.content));
  }
  if (footer && children.length < MAX_CHILDREN) {
    if (children.length) children.push({ type: 14, divider: true, spacing: 1 });
    if (children.length < MAX_CHILDREN) children.push(textDisplay(`-# ${footer}`));
  }
  const safeColor = Number.isInteger(accentColor) && accentColor >= 0 && accentColor <= 0xffffff ? accentColor : 0x5865f2;
  if (linkButtons.length) {
    const buttons = linkButtons.slice(0, 5).map(({ label, url }) => {
      if (typeof label !== 'string' || !label.trim() || label.length > 80) throw new TypeError('Link button labels must be 1–80 characters.');
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new TypeError('Link buttons must use HTTP or HTTPS.');
      return { type: 2, style: 5, label, url: parsed.toString() };
    });
    if (children.length >= MAX_CHILDREN) throw new RangeError('The container has no room for link buttons.');
    children.push({ type: 1, components: buttons });
  }
  if (!children.length) children.push(textDisplay(' '));
  return [{ type: 17, accent_color: safeColor, components: children }];
}

export function isValidContainerPayload(components) {
  return Array.isArray(components) && components.length === 1 && components[0]?.type === 17 && Array.isArray(components[0].components);
}