const MAX_TEXT = 4000;
const MAX_CHILDREN = 10;

export function escapeMarkdown(value = '') {
  return String(value).replace(/[\\`*_{}\[\]()<>#+\-.!|~]/g, '\\$&');
}

function validateHttpUrl(url, label = 'URL') {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw new TypeError(`${label} must be a valid HTTP or HTTPS URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError(`${label} must use HTTP or HTTPS.`);
  }
  return parsed.toString();
}

function textDisplay(content) {
  const value = String(content ?? '').trim() || '\u200b';
  if (value.length > MAX_TEXT) throw new RangeError(`Container text must be ${MAX_TEXT} characters or fewer.`);
  return { type: 10, content: value };
}

function normalizeThumbnail(thumbnail) {
  if (!thumbnail) return null;
  const raw = typeof thumbnail === 'string' ? { url: thumbnail } : thumbnail;
  if (!raw?.url) return null;
  const url = validateHttpUrl(raw.url, 'Thumbnail URL');
  const accessory = { type: 11, media: { url } };
  if (raw.description) accessory.description = String(raw.description).slice(0, 256);
  if (raw.spoiler === true) accessory.spoiler = true;
  return accessory;
}

function normalizeMediaGallery(items = []) {
  const list = (Array.isArray(items) ? items : [items])
    .filter(Boolean)
    .slice(0, 10)
    .map((entry) => {
      const raw = typeof entry === 'string' ? { url: entry } : entry;
      const rawUrl = raw?.media?.url || raw?.url;
      if (!rawUrl) return null;
      const url = validateHttpUrl(rawUrl, 'Media gallery URL');
      const item = { media: { url } };
      if (raw.description) item.description = String(raw.description).slice(0, 256);
      if (raw.spoiler === true) item.spoiler = true;
      return item;
    })
    .filter(Boolean);
  return list.length ? { type: 12, items: list } : null;
}

function parseAccentColor(accentColor) {
  if (typeof accentColor === 'string' && /^#?[0-9a-f]{6}$/i.test(accentColor.trim())) {
    return Number.parseInt(accentColor.trim().replace(/^#/, ''), 16);
  }
  if (Number.isInteger(accentColor) && accentColor >= 0 && accentColor <= 0xffffff) {
    return accentColor;
  }
  return 0x5865f2;
}

export function createContainer({
  title,
  description,
  thumbnail,
  images = [],
  media = [],
  gallery = [],
  sections = [],
  footer,
  footerDivider = true,
  accentColor = 0x5865f2,
  spoiler = false,
  linkButtons = [],
  actionRows = [],
  components = [],
} = {}) {
  const children = [];
  const thumbAccessory = normalizeThumbnail(thumbnail);

  if (thumbAccessory && (title || description)) {
    const sectionText = [];
    if (title) sectionText.push(textDisplay(`## ${title}`));
    if (description) sectionText.push(textDisplay(description));
    children.push({ type: 9, components: sectionText, accessory: thumbAccessory });
  } else {
    if (title) children.push(textDisplay(`## ${title}`));
    if (description) children.push(textDisplay(description));
  }

  const galleryItems = [...(Array.isArray(images) ? images : [images]), ...(Array.isArray(media) ? media : [media]), ...(Array.isArray(gallery) ? gallery : [gallery])].filter(Boolean);
  const mediaGallery = normalizeMediaGallery(galleryItems);
  if (mediaGallery && children.length < MAX_CHILDREN) {
    children.push(mediaGallery);
  }

  for (const section of sections) {
    if (!section || children.length >= MAX_CHILDREN - 1) break;
    const spacing = section.spacing === 2 ? 2 : 1;
    if (section.divider && children.length) {
      children.push({ type: 14, divider: true, spacing });
    }
    if (children.length >= MAX_CHILDREN) break;
    const sectionThumb = normalizeThumbnail(section.thumbnail);
    if (section.content && sectionThumb) {
      children.push({ type: 9, components: [textDisplay(section.content)], accessory: sectionThumb });
    } else if (section.content) {
      children.push(textDisplay(section.content));
    }
    if (section.media && children.length < MAX_CHILDREN) {
      const sectionGallery = normalizeMediaGallery(section.media);
      if (sectionGallery) children.push(sectionGallery);
    }
  }

  if (footer && children.length < MAX_CHILDREN) {
    if (footerDivider && children.length) children.push({ type: 14, divider: true, spacing: 1 });
    if (children.length < MAX_CHILDREN) children.push(textDisplay(`-# ${footer}`));
  }

  const safeColor = parseAccentColor(accentColor);

  if (linkButtons.length) {
    const buttons = linkButtons.slice(0, 5).map(({ label, url }) => {
      if (typeof label !== 'string' || !label.trim() || label.length > 80) throw new TypeError('Link button labels must be 1–80 characters.');
      const validUrl = validateHttpUrl(url, 'Link buttons');
      return { type: 2, style: 5, label, url: validUrl };
    });
    if (children.length >= MAX_CHILDREN) throw new RangeError('The container has no room for link buttons.');
    children.push({ type: 1, components: buttons });
  }

  const extraRows = [...(Array.isArray(actionRows) ? actionRows : []), ...(Array.isArray(components) ? components : [])];
  for (const row of extraRows) {
    if (!row || row.type !== 1 || !Array.isArray(row.components) || !row.components.length) continue;
    if (children.length >= MAX_CHILDREN) break;
    children.push(row);
  }

  if (!children.length) children.push(textDisplay(' '));
  return [{
    type: 17,
    accent_color: safeColor,
    ...(spoiler === true ? { spoiler: true } : {}),
    components: children,
  }];
}

export function isValidContainerPayload(components) {
  return Array.isArray(components) && components.length === 1 && components[0]?.type === 17 && Array.isArray(components[0].components);
}
