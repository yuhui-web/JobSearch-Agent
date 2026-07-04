(() => {
  const SCRIPT_ID = 'job-agent-boss-real-collector-v3';
  const API_BASE = 'http://127.0.0.1:8011';
  const AUTO_INTERVAL_MS = 60000;

  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  let autoTimer = null;

  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const uniq = (items) => [...new Set(items.map(clean).filter(Boolean))];

  const CARD_SELECTORS = [
    '.job-card-wrapper',
    '.job-card-body',
    '.job-card-box',
    '.job-card',
    '.job-primary',
    '.job-list-box li',
    '.search-job-box li',
    '.search-job-result li',
    '.job-list li',
    'li[class*="job-card"]',
    'li[class*="job-item"]',
    'div[class*="job-card"]',
    'div[class*="job-item"]'
  ];

  const DETAIL_LINK_SELECTORS = [
    'a[href*="/job_detail/"]',
    'a[href*="/web/geek/job"]'
  ];

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = clean(node?.innerText || node?.textContent || node?.getAttribute?.('title'));
      if (value) return value;
    }
    return '';
  }

  function absoluteUrl(href) {
    if (!href) return window.location.href;
    try {
      return new URL(href, window.location.href).href;
    } catch {
      return window.location.href;
    }
  }

  function isUsefulCard(node) {
    const text = clean(node?.innerText);
    if (text.length < 20) return false;
    return /(\d{1,3}\s*[-~]\s*\d{1,3}\s*[kK]|元\/天|元\/月|学历|经验|实习|社招|校招)/.test(text);
  }

  function closestCard(node) {
    if (!node) return null;
    const root = node.closest(
      [
        '.job-card-wrapper',
        '.job-card-body',
        '.job-card-box',
        '.job-card',
        '.job-primary',
        '.job-list-box li',
        '.search-job-box li',
        '.search-job-result li',
        '.job-list li',
        'li',
        'article',
        'section',
        'div'
      ].join(',')
    );
    return root && isUsefulCard(root) ? root : null;
  }

  function cardNodes() {
    const nodes = new Set();

    for (const selector of CARD_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        if (isUsefulCard(node)) nodes.add(node);
      });
    }

    for (const selector of DETAIL_LINK_SELECTORS) {
      document.querySelectorAll(selector).forEach((anchor) => {
        const card =
          closestCard(anchor) ||
          closestCard(anchor.parentElement) ||
          closestCard(anchor.closest('li, article, section, div'));
        if (card) nodes.add(card);
      });
    }

    return Array.from(nodes);
  }

  function parseCard(card) {
    const linkNode = card.querySelector(DETAIL_LINK_SELECTORS.join(','));
    const title =
      firstText(card, [
        '.job-name',
        '.job-title',
        '.job-card-title',
        '[class*="job-name"]',
        '[class*="job-title"]',
        '[class*="job-card-title"]'
      ]) ||
      clean(linkNode?.innerText || linkNode?.textContent).split(/\s+/)[0];

    const company =
      firstText(card, [
        '.company-name a',
        '.company-name',
        '.company-info a',
        '[class*="company-name"]',
        '[class*="company"] a',
        '[class*="brand"]',
        '[class*="company"]'
      ]) ||
      clean(card.querySelector('img[alt]')?.getAttribute('alt'));

    const jobLocation = firstText(card, [
      '.job-area',
      '.job-location',
      '.job-area-wrapper',
      '[class*="job-area"]',
      '[class*="job-location"]',
      '[class*="location"]',
      '[class*="area"]'
    ]);

    const salary =
      firstText(card, ['.salary', '.job-salary', '[class*="salary"]']) ||
      (clean(card.innerText).match(/(\d{1,3}\s*[-~]\s*\d{1,3}\s*[kK]|[\d.]+\s*[kK]|[\d.]+\s*元\/天|[\d.]+\s*元\/月)/)?.[1] || '');

    const tags = uniq(
      Array.from(
        card.querySelectorAll(
          '.tag-list span, .job-tags span, [class*="tag"] span, .info-desc, .job-card-footer span, [class*="skill"] span'
        )
      ).map((node) => node.innerText || node.textContent)
    ).slice(0, 12);

    if (!title || !company) return null;

    return {
      name: title,
      title,
      company,
      location: jobLocation,
      salary,
      tags,
      detail: clean(card.innerText).slice(0, 1200),
      link: absoluteUrl(linkNode?.getAttribute('href')),
      source_page: window.location.href,
      collected_at: new Date().toISOString()
    };
  }

  function collectVisibleJobs() {
    const jobs = [];
    const seen = new Set();

    for (const card of cardNodes()) {
      const job = parseCard(card);
      if (!job) continue;
      const key = `${job.name}|${job.company}|${job.location}|${job.salary}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(job);
    }

    return jobs;
  }

  function pageQuery() {
    const input =
      document.querySelector('input[name="query"]') ||
      document.querySelector('input[placeholder*="搜索"]') ||
      document.querySelector('input[type="search"]') ||
      document.querySelector('.search-form input');
    return clean(input?.value);
  }

  function pageCity() {
    for (const selector of ['.city-label', '.nav-city', '.search-city', '.city-name']) {
      const text = clean(document.querySelector(selector)?.innerText || document.querySelector(selector)?.textContent);
      if (text && text.length <= 20) return text;
    }
    return '';
  }

  function setStatus(text) {
    const status = document.querySelector('#job-agent-boss-collector-status');
    if (status) status.textContent = text;
  }

  async function importJobs({ silent = false, source = 'boss_chrome_extension' } = {}) {
    setStatus(silent ? 'Auto syncing visible jobs...' : 'Importing visible BOSS jobs...');
    const jobs = collectVisibleJobs();

    if (!jobs.length) {
      setStatus(silent ? 'Auto sync skipped: no visible job cards' : 'No visible job cards found');
      if (!silent) {
        alert('No BOSS job cards were detected. Open a BOSS job search result page first.');
      }
      return null;
    }

    const title = pageQuery() || document.title || 'BOSS visible jobs';
    const city = pageCity();
    const response = await fetch(`${API_BASE}/imports/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: title,
        locations: city ? [city] : [],
        job_type: 'internship',
        experience_level: 'entry-level',
        max_jobs: jobs.length,
        candidate_profile: '',
        source,
        jobs
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.detail || 'Import failed');
    }

    const count = data.job_count || jobs.length;
    setStatus(
      silent
        ? `Auto synced ${count} jobs at ${new Date().toLocaleTimeString()}`
        : `Imported ${count} jobs`
    );
    if (!silent) {
      alert(`Imported ${count} real jobs to JobSearch-Agent. Search ID: ${data.search_id}`);
    }
    return data;
  }

  function startAutoSync(autoButton) {
    const syncOnce = () => {
      importJobs({ silent: true, source: 'boss_monitor_extension' }).catch((error) => {
        setStatus(`Auto sync failed: ${error.message}`);
      });
    };
    autoButton.textContent = 'Auto sync: on';
    syncOnce();
    autoTimer = setInterval(syncOnce, AUTO_INTERVAL_MS);
  }

  function stopAutoSync(autoButton) {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = null;
    autoButton.textContent = 'Auto sync: off';
    setStatus('Auto sync stopped');
  }

  function mountPanel() {
    if (document.querySelector('#job-agent-boss-collector')) return;

    const panel = document.createElement('div');
    panel.id = 'job-agent-boss-collector';
    panel.innerHTML = `
      <button type="button" data-action="import">Import to JobSearch-Agent</button>
      <button type="button" data-action="auto">Auto sync: off</button>
      <span id="job-agent-boss-collector-status">Waiting for BOSS job cards</span>
    `;

    Object.assign(panel.style, {
      position: 'fixed',
      right: '24px',
      bottom: '24px',
      zIndex: '2147483647',
      display: 'grid',
      gap: '8px',
      padding: '14px',
      borderRadius: '18px',
      background: 'linear-gradient(135deg, rgba(20,28,34,.96), rgba(13,92,78,.92))',
      color: '#fff',
      boxShadow: '0 22px 60px rgba(0,0,0,.35)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      minWidth: '220px'
    });

    panel.querySelectorAll('button').forEach((button) => {
      Object.assign(button.style, {
        border: '0',
        borderRadius: '999px',
        padding: '10px 16px',
        background: '#23e0b0',
        color: '#06140f',
        fontWeight: '800',
        cursor: 'pointer'
      });
    });

    const status = panel.querySelector('#job-agent-boss-collector-status');
    Object.assign(status.style, {
      fontSize: '12px',
      lineHeight: '1.4',
      color: 'rgba(255,255,255,.82)'
    });

    const importButton = panel.querySelector('[data-action="import"]');
    const autoButton = panel.querySelector('[data-action="auto"]');

    importButton.addEventListener('click', () => {
      importJobs().catch((error) => {
        setStatus('Import failed');
        alert(`Import failed: ${error.message}`);
      });
    });

    autoButton.addEventListener('click', () => {
      if (autoTimer) {
        stopAutoSync(autoButton);
      } else {
        startAutoSync(autoButton);
      }
    });

    document.documentElement.appendChild(panel);
    setStatus(`Loaded, detected ${collectVisibleJobs().length} visible jobs`);
  }

  mountPanel();
})();
