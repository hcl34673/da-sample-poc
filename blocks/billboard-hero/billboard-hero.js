const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

/**
 * Resolve Dynamic Media smart-crop URL for a given width.
 * Returns the original src unchanged if not a DM URL.
 * @param {string} src - image source URL
 * @param {number} width - desired rendition width
 * @returns {string} resolved URL
 */
function getDMRendition(src, width) {
  if (!src) return src;
  const isDM = src.includes('/is/image/') || src.includes('.scene7.com');
  if (!isDM) return src;
  try {
    const url = new URL(src);
    url.searchParams.set('wid', width);
    url.searchParams.set('fit', 'constrain');
    url.searchParams.set('fmt', 'webp');
    return url.toString();
  } catch (e) {
    return src;
  }
}

/**
 * Decorate the existing <picture> element with BEM classes and
 * update sources for DM smart-crop renditions if applicable.
 * Re-uses the authored element — does not create a new one.
 * @param {HTMLPictureElement} picture - existing picture element from DA
 * @returns {HTMLPictureElement} the same picture, decorated
 */
function decoratePicture(picture) {
  picture.classList.add('bg-image');

  const img = picture.querySelector('img');
  if (img) {
    img.classList.add('bg-image-img');
    img.loading = 'eager';
    img.decoding = 'async';

    const src = img.src || img.getAttribute('src');
    const isDM = src && (src.includes('/is/image/') || src.includes('.scene7.com'));

    if (isDM) {
      // Replace existing sources with DM smart-crop renditions
      picture.querySelectorAll('source').forEach((s) => s.remove());

      const dmSources = [
        { media: `(min-width: ${BREAKPOINTS.tablet + 1}px)`, width: 2400 },
        { media: `(min-width: ${BREAKPOINTS.mobile + 1}px)`, width: 1200 },
      ];

      dmSources.forEach(({ media, width }) => {
        const source = document.createElement('source');
        source.setAttribute('media', media);
        source.setAttribute('srcset', getDMRendition(src, width));
        source.setAttribute('type', 'image/webp');
        picture.prepend(source);
      });

      img.src = getDMRendition(src, BREAKPOINTS.mobile);
    }
  }

  return picture;
}

/**
 * Extract or build a <video> element from a cell.
 * Re-uses an existing <video> if present; builds one from a video link otherwise.
 * @param {HTMLElement} cell - the media cell
 * @returns {HTMLVideoElement|null}
 */
function extractVideo(cell) {
  const existing = cell.querySelector('video');
  if (existing) {
    existing.classList.add('bg-video');
    existing.autoplay = true;
    existing.muted = true;
    existing.loop = true;
    existing.playsInline = true;
    existing.setAttribute('aria-hidden', 'true');
    return existing;
  }

  const link = cell.querySelector('a[href]');
  if (link && /\.(mp4|webm|ogg)(\?|$)/i.test(link.href)) {
    const vid = document.createElement('video');
    vid.src = link.href;
    vid.className = 'bg-video';
    vid.autoplay = true;
    vid.muted = true;
    vid.loop = true;
    vid.playsInline = true;
    vid.setAttribute('aria-hidden', 'true');
    return vid;
  }

  return null;
}

/**
 * Build the video pause/play toggle button using authored icon elements.
 * @param {HTMLVideoElement} videoEl - the background video element
 * @param {HTMLElement|null} pauseIcon - .icon element from pause row
 * @param {HTMLElement|null} playIcon - .icon element from play row
 * @returns {HTMLButtonElement}
 */
function buildPauseButton(videoEl, pauseIcon, playIcon) {
  const btn = document.createElement('button');
  btn.className = 'pause-btn';
  btn.setAttribute('aria-label', 'Pause background video');
  btn.setAttribute('type', 'button');

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'pause-icon';

  // Start with pause icon — video autoplays on load
  if (pauseIcon) iconWrapper.append(pauseIcon.cloneNode(true));
  btn.append(iconWrapper);

  btn.addEventListener('click', () => {
    iconWrapper.replaceChildren();
    if (videoEl.paused) {
      videoEl.play();
      if (pauseIcon) iconWrapper.append(pauseIcon.cloneNode(true));
      btn.setAttribute('aria-label', 'Pause background video');
    } else {
      videoEl.pause();
      if (playIcon) iconWrapper.append(playIcon.cloneNode(true));
      btn.setAttribute('aria-label', 'Play background video');
    }
  });

  return btn;
}

/**
 * Decorate the Billboard Hero block.
 * @param {Element} block the block
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // --- Parse authored rows ---
  // Row 0: media — image or video (single cell)
  // Row 1: headline (col 0) | theme: "dark" or "light" (col 1)
  // Row 2: subtext (single cell)
  // Row 3: CTA — "Button Label [icon] | URL" (single cell)
  // Row 4: play icon (single cell, video only)
  // Row 5: pause icon (single cell, video only)
  const [mediaRow, titleRow, textRow, ctaRow, playIconRow, pauseIconRow] = rows;

  // Theme — read from col 1 of title row
  const themeCell = titleRow?.querySelector(':scope > div:last-child');
  const theme = themeCell?.textContent?.trim().toLowerCase() === 'dark' ? 'dark' : 'light';

  // Headline — col 0 of title row
  const titleCell = titleRow?.querySelector(':scope > div:first-child');
  const headlineText = titleCell?.textContent?.trim() || '';

  // Subtext — re-use existing <p> from cell
  const subTextCell = textRow?.querySelector(':scope > div:first-child');
  const subTextEl = subTextCell?.querySelector('p') || null;

  // CTA parsing — handles three DA output patterns:
  // 1. "Button Label | https://url"         plain text
  // 2. "Button Label [icon] | <a>URL</a>"   DA auto-links the URL
  // 3. "<a>Button Label</a>"                whole cell is a hyperlink
  const ctaCell = ctaRow?.querySelector(':scope > div:first-child');
  let ctaLabel = '';
  let ctaHref = '';
  let ctaIcon = null;

  if (ctaCell) {
    const ctaLink = ctaCell.querySelector('a');
    const iconEl = ctaCell.querySelector('.icon');
    if (iconEl) ctaIcon = iconEl.cloneNode(true);

    const fullText = ctaCell.textContent || '';
    const pipeIndex = fullText.indexOf('|');

    if (pipeIndex !== -1) {
      ctaLabel = fullText.slice(0, pipeIndex).replace(iconEl?.textContent || '', '').trim();
      ctaHref = ctaLink ? ctaLink.href : fullText.slice(pipeIndex + 1).trim();
    } else if (ctaLink) {
      ctaLabel = ctaLink.textContent.trim();
      ctaHref = ctaLink.href;
    }
  }

  // Play / pause icons from rows 4 & 5
  const playIcon = playIconRow?.querySelector(':scope > div:first-child .icon') || null;
  const pauseIcon = pauseIconRow?.querySelector(':scope > div:first-child .icon') || null;

  // --- Build DOM ---
  // Use replaceChildren to avoid innerHTML; add theme modifier
  block.classList.add(theme);

  // __bg
  const bg = document.createElement('div');
  bg.className = 'bg';

  let videoEl = null;
  const mediaCell = mediaRow?.querySelector(':scope > div:first-child');

  if (mediaCell) {
    videoEl = extractVideo(mediaCell);
    if (videoEl) {
      bg.append(videoEl);
    } else {
      const picture = mediaCell.querySelector('picture');
      if (picture) bg.append(decoratePicture(picture));
    }
  }

  // __overlay
  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  // __content
  const content = document.createElement('div');
  content.className = 'content';

  // __title — enforce single H1 per page
  if (headlineText) {
    const existingH1 = document.querySelector('h1');
    const titleEl = existingH1 ? document.createElement('p') : document.createElement('h1');
    titleEl.className = 'hero-title';
    titleEl.textContent = headlineText;
    content.append(titleEl);
  }

  // __description — re-use existing <p> if available
  if (subTextEl) {
    subTextEl.className = 'hero-description';
    content.append(subTextEl);
  }

  // __cta
  if (ctaLabel && ctaHref) {
    const cta = document.createElement('a');
    cta.className = 'hero-cta';
    cta.href = ctaHref;
    cta.setAttribute('role', 'button');

    const label = document.createElement('span');
    label.textContent = ctaLabel;
    cta.append(label);

    if (ctaIcon) {
      ctaIcon.classList.add('cta-icon');
      cta.append(ctaIcon);
    }

    content.append(cta);
  }

  // __pause (video only)
  const pauseBtn = videoEl ? buildPauseButton(videoEl, pauseIcon, playIcon) : null;

  block.replaceChildren(bg, overlay, content);
  if (pauseBtn) block.append(pauseBtn);
}
