import { AUDIO_FORMATS, BIT_DEPTHS, SAMPLE_RATES } from '../constants/audioConfig.js';
import { store } from '../state/store.js';
import { downloadTrack } from '../services/downloadService.js';
import { escapeHtml, formatBytes, formatDuration, formatSampleRate } from '../utils/formatters.js';
import { i18n, t } from '../i18n/i18n.js';

export function initTrackList({ onConvertTrack, onOpenMetadataModal }) {
  const trackListEl = document.getElementById('track-list');
  const emptyStateEl = document.getElementById('empty-state');
  const queueSummaryEl = document.getElementById('queue-summary');
  const btnConvertAll = document.getElementById('btn-convert-all');
  const btnAlbumMeta = document.getElementById('btn-open-album-meta');
  const btnDownloadZip = document.getElementById('btn-download-zip');
  const btnClearQueue = document.getElementById('btn-clear-queue');

  const openPlayers = new Set();

  function render() {
    const tracks = store.tracks;
    const totalSize = tracks.reduce((sum, t) => sum + t.originalSize, 0);
    const convertedCount = tracks.filter((t) => t.status === 'converted').length;

    queueSummaryEl.textContent = tracks.length === 0
      ? t('queue.emptyCount')
      : convertedCount > 0
        ? t('queue.summaryConverted', { count: tracks.length, size: formatBytes(totalSize), done: convertedCount })
        : t('queue.summary', { count: tracks.length, size: formatBytes(totalSize) });

    btnConvertAll.disabled = tracks.length === 0 || store.isBatchConverting;
    btnAlbumMeta.disabled = tracks.length === 0 || store.isBatchConverting;
    btnDownloadZip.disabled = convertedCount === 0 || store.isBatchConverting;
    btnClearQueue.disabled = tracks.length === 0 || store.isBatchConverting;

    if (tracks.length === 0) {
      trackListEl.innerHTML = '';
      trackListEl.appendChild(emptyStateEl);
      emptyStateEl.classList.remove('hidden');
      return;
    }

    emptyStateEl.classList.add('hidden');
    const html = tracks.map((track) => renderTrackCard(track)).join('');
    trackListEl.innerHTML = html;
  }

  function renderTrackCard(track) {
    const meta = track.metadata || {};
    const title = meta.title || track.originalName;
    const artistAlbum = [meta.artist, meta.album].filter(Boolean).join(' — ') || track.originalName;
    const specsParts = [
      track.originalFormat,
      track.sampleRate ? formatSampleRate(track.sampleRate) : null,
      track.duration ? formatDuration(track.duration) : null,
      formatBytes(track.originalSize)
    ].filter(Boolean);

    const statusClass = track.status === 'converted'
      ? 'is-converted'
      : track.status === 'error'
        ? 'is-error'
        : '';

    const statusBadge = track.status === 'converted'
      ? `<span class="track-badge badge-converted">${escapeHtml(t('track.converted', { size: formatBytes(track.convertedBlob?.size || 0) }))}</span>`
      : track.status === 'converting'
        ? `<span class="track-badge badge-converting">${escapeHtml(t('track.converting', { pct: track.progress }))}</span>`
        : track.status === 'error'
          ? `<span class="track-badge badge-error">${escapeHtml(t('track.error'))}</span>`
          : `<span class="track-badge">${escapeHtml(track.settings.useMaster ? t('track.masterBadge') : t('track.customBadge'))}</span>`;

    const coverHtml = meta.artwork?.url
      ? `<img src="${meta.artwork.url}" alt="Cover" />`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

    const formatOptions = Object.values(AUDIO_FORMATS)
      .map((f) => `<option value="${f.id}" ${track.settings.format === f.id ? 'selected' : ''}>${f.id.toUpperCase()}</option>`)
      .join('');

    const bitOptions = BIT_DEPTHS
      .map((b) => `<option value="${b.id}" ${track.settings.bitDepth === b.id ? 'selected' : ''}>${b.label}</option>`)
      .join('');

    const rateOptions = SAMPLE_RATES
      .map((r) => `<option value="${r.value}" ${Number(track.settings.sampleRate) === r.value ? 'selected' : ''}>${r.label}</option>`)
      .join('');

    const isConverting = track.status === 'converting' || store.isBatchConverting;
    const playerOpen = openPlayers.has(track.id);
    const playSrc = track.convertedUrl || track.sourceUrl;
    const playLabel = track.convertedUrl ? t('track.convertedLabel') : t('track.sourceLabel');

    return `
      <article class="track-card ${statusClass}" data-track-id="${track.id}">
        <div class="track-main-row">
          <div class="track-identity">
            <div class="track-cover">${coverHtml}</div>
            <div class="track-info">
              <div class="track-title-line">
                ${meta.track ? `<span class="track-badge mono">#${escapeHtml(meta.track)}</span>` : ''}
                <span class="track-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                ${statusBadge}
              </div>
              <div class="track-meta-sub" title="${escapeHtml(artistAlbum)}">${escapeHtml(artistAlbum)}</div>
              <div class="track-specs mono">${escapeHtml(specsParts.join(' · '))}</div>
            </div>
          </div>

          <div class="track-controls-row">
            <select class="track-inline-select" data-action="change-format" ${isConverting ? 'disabled' : ''}>
              ${formatOptions}
            </select>
            <select class="track-inline-select" data-action="change-bit" ${isConverting ? 'disabled' : ''}>
              ${bitOptions}
            </select>
            <select class="track-inline-select" data-action="change-rate" ${isConverting ? 'disabled' : ''}>
              ${rateOptions}
            </select>
          </div>

          <div class="track-actions">
            <button class="btn btn-ghost btn-xs" type="button" data-action="toggle-player">
              ${escapeHtml(playerOpen ? t('track.previewClose') : t('track.previewOpen'))}
            </button>
            <button class="btn btn-secondary btn-xs" type="button" data-action="edit-meta" ${isConverting ? 'disabled' : ''}>
              ${escapeHtml(t('track.editMeta'))}
            </button>
            <button class="btn btn-primary btn-xs" type="button" data-action="convert" ${isConverting ? 'disabled' : ''}>
              ${escapeHtml(track.status === 'converted' ? t('track.reconvert') : t('track.convert'))}
            </button>
            ${track.status === 'converted' ? `
              <button class="btn btn-success btn-xs" type="button" data-action="download">
                ${escapeHtml(t('track.save'))}
              </button>
            ` : ''}
            <button class="icon-btn btn-danger-ghost" type="button" data-action="remove" aria-label="Remove" ${isConverting ? 'disabled' : ''}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          </div>
        </div>

        ${track.status === 'converting' ? `
          <div class="track-progress-wrap">
            <div class="progress-track">
              <div class="progress-fill" style="width: ${track.progress}%"></div>
            </div>
            <span class="track-progress-pct mono">${track.progress}%</span>
          </div>
        ` : ''}

        ${track.status === 'error' && track.error ? `
          <div class="track-error-msg">${escapeHtml(track.error)}</div>
        ` : ''}

        ${playerOpen ? `
          <div class="track-player-bar">
            <span class="track-badge">${playLabel}</span>
            <audio controls preload="metadata" src="${playSrc}"></audio>
          </div>
        ` : ''}
      </article>
    `;
  }

  trackListEl.addEventListener('change', (e) => {
    const card = e.target.closest('.track-card');
    if (!card) return;
    const id = card.dataset.trackId;
    const action = e.target.dataset.action;

    if (action === 'change-format') {
      const fmt = AUDIO_FORMATS[e.target.value];
      store.updateTrackSettings(id, {
        format: fmt.id,
        bitrate: fmt.lossy ? fmt.defaultBitrate : store.getTrack(id)?.settings.bitrate
      });
    } else if (action === 'change-bit') {
      store.updateTrackSettings(id, { bitDepth: e.target.value });
    } else if (action === 'change-rate') {
      store.updateTrackSettings(id, { sampleRate: Number(e.target.value) });
    }
  });

  trackListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const card = btn.closest('.track-card');
    if (!card) return;
    const id = card.dataset.trackId;
    const track = store.getTrack(id);
    if (!track) return;

    const action = btn.dataset.action;
    if (action === 'edit-meta') {
      onOpenMetadataModal(id);
    } else if (action === 'convert') {
      onConvertTrack(id);
    } else if (action === 'download') {
      downloadTrack(track);
    } else if (action === 'remove') {
      openPlayers.delete(id);
      store.removeTrack(id);
    } else if (action === 'toggle-player') {
      if (openPlayers.has(id)) openPlayers.delete(id);
      else openPlayers.add(id);
      render();
    }
  });

  store.subscribe(render);
  i18n.subscribe(render);
  render();
}
