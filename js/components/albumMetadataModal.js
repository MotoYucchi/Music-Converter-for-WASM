import { store } from '../state/store.js';
import { ffmpegService } from '../services/ffmpegService.js';
import { escapeHtml, stripExtension } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';

const SHARED_FIELDS = [
  'album',
  'albumArtist',
  'artist',
  'genre',
  'year',
  'composer',
  'lyricist',
  'copyright',
  'comment'
];

export function initAlbumMetadataModal({ onOpenTrackMetadata }) {
  const modal = document.getElementById('album-modal');
  const btnClose = document.getElementById('btn-close-album-modal');
  const btnCancel = document.getElementById('btn-cancel-album');
  const btnApply = document.getElementById('btn-apply-album');

  const btnAutoNumber = document.getElementById('btn-album-autonumber');
  const btnTitlesFromFiles = document.getElementById('btn-album-titles-from-files');
  const tbody = document.getElementById('album-tracks-tbody');

  const applyArtworkCheckbox = document.getElementById('album-apply-artwork');
  const artworkDrop = document.getElementById('album-artwork-drop');
  const artworkInput = document.getElementById('album-artwork-input');
  const artworkPreview = document.getElementById('album-artwork-preview');
  const artworkPlaceholder = document.getElementById('album-artwork-placeholder');
  const btnArtSelect = document.getElementById('btn-album-artwork-select');
  const btnArtRemove = document.getElementById('btn-album-artwork-remove');

  let sharedArtwork = null;
  let artworkDirty = false;
  let draftRows = [];

  function updateArtworkUI(art) {
    if (art && art.url) {
      artworkPreview.src = art.url;
      artworkPreview.classList.remove('hidden');
      artworkPlaceholder.classList.add('hidden');
      btnArtRemove.disabled = false;
    } else {
      artworkPreview.removeAttribute('src');
      artworkPreview.classList.add('hidden');
      artworkPlaceholder.classList.remove('hidden');
      btnArtRemove.disabled = true;
    }
  }

  async function setArtworkFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('JPEG / PNG / WebP 画像を選択してください', 'error');
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const blob = new Blob([buf], { type: file.type });
    if (artworkDirty && sharedArtwork?.url) {
      URL.revokeObjectURL(sharedArtwork.url);
    }
    sharedArtwork = {
      data: buf,
      mime: file.type,
      url: URL.createObjectURL(blob)
    };
    artworkDirty = true;
    updateArtworkUI(sharedArtwork);
  }

  function renderTable() {
    tbody.innerHTML = draftRows.map((row, idx) => `
      <tr data-row-index="${idx}">
        <td><input type="text" class="input-control mono" data-col="track" value="${escapeHtml(row.track)}" placeholder="${idx + 1}" /></td>
        <td><input type="text" class="input-control mono" data-col="disc" value="${escapeHtml(row.disc)}" placeholder="1" /></td>
        <td><input type="text" class="input-control" data-col="title" value="${escapeHtml(row.title)}" /></td>
        <td><input type="text" class="input-control" data-col="artist" value="${escapeHtml(row.artist)}" /></td>
        <td><input type="number" min="1" max="999" step="0.1" class="input-control mono" data-col="bpm" value="${escapeHtml(row.bpm)}" /></td>
        <td>
          <button type="button" class="btn btn-ghost btn-xs" data-action="detail" data-track-id="${row.id}">
            全項目編集
          </button>
        </td>
      </tr>
    `).join('');
  }

  function open() {
    if (store.tracks.length === 0) return;

    // Pre-fill shared fields from first track that has values
    const firstMeta = store.tracks[0].metadata || {};
    for (const key of SHARED_FIELDS) {
      const input = document.getElementById(`album-meta-${key}`);
      if (input) {
        const found = store.tracks.find((t) => t.metadata?.[key]);
        input.value = found ? found.metadata[key] : (firstMeta[key] || '');
      }
    }

    const foundArt = store.tracks.find((t) => t.metadata?.artwork)?.metadata.artwork || null;
    sharedArtwork = foundArt;
    artworkDirty = false;
    updateArtworkUI(sharedArtwork);

    draftRows = store.tracks.map((t) => ({
      id: t.id,
      originalName: t.originalName,
      track: t.metadata?.track || '',
      disc: t.metadata?.disc || '',
      title: t.metadata?.title || '',
      artist: t.metadata?.artist || '',
      bpm: t.metadata?.bpm || ''
    }));

    renderTable();
    modal.classList.remove('hidden');
  }

  function close() {
    if (artworkDirty && sharedArtwork?.url) {
      URL.revokeObjectURL(sharedArtwork.url);
    }
    sharedArtwork = null;
    artworkDirty = false;
    modal.classList.add('hidden');
  }

  tbody.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    const idx = Number(tr.dataset.rowIndex);
    const col = e.target.dataset.col;
    if (draftRows[idx] && col) {
      draftRows[idx][col] = e.target.value;
    }
  });

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="detail"]');
    if (!btn) return;
    const trackId = btn.dataset.trackId;
    close();
    onOpenTrackMetadata?.(trackId);
  });

  btnAutoNumber.addEventListener('click', () => {
    const total = draftRows.length;
    draftRows.forEach((row, idx) => {
      row.track = `${idx + 1}/${total}`;
      if (!row.disc) row.disc = '1/1';
    });
    renderTable();
  });

  btnTitlesFromFiles.addEventListener('click', () => {
    draftRows.forEach((row) => {
      row.title = stripExtension(row.originalName);
    });
    renderTable();
  });

  btnArtSelect.addEventListener('click', () => artworkInput.click());
  artworkDrop.addEventListener('click', () => artworkInput.click());
  artworkDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      artworkInput.click();
    }
  });

  artworkInput.addEventListener('change', () => {
    if (artworkInput.files?.[0]) {
      setArtworkFromFile(artworkInput.files[0]);
      artworkInput.value = '';
    }
  });

  btnArtRemove.addEventListener('click', () => {
    if (artworkDirty && sharedArtwork?.url) {
      URL.revokeObjectURL(sharedArtwork.url);
    }
    sharedArtwork = null;
    artworkDirty = true;
    updateArtworkUI(null);
  });

  btnApply.addEventListener('click', async () => {
    const sharedPatch = {};
    for (const key of SHARED_FIELDS) {
      const cb = modal.querySelector(`input[data-album-field="${key}"]`);
      const input = document.getElementById(`album-meta-${key}`);
      if (cb?.checked && input) {
        sharedPatch[key] = input.value;
      }
    }

    const shouldApplyArt = applyArtworkCheckbox.checked && (artworkDirty || sharedArtwork !== null);

    btnApply.disabled = true;
    btnApply.textContent = '反映中...';

    try {
      for (const row of draftRows) {
        const track = store.getTrack(row.id);
        if (!track) continue;

        const patch = {
          ...sharedPatch,
          track: row.track,
          disc: row.disc,
          title: row.title,
          bpm: row.bpm
        };

        // Only overwrite artist from row if shared artist checkbox wasn't checked
        if (!('artist' in sharedPatch)) {
          patch.artist = row.artist;
        }

        if (shouldApplyArt) {
          if (sharedArtwork) {
            const clonedBytes = sharedArtwork.data.slice();
            patch.artwork = {
              data: clonedBytes,
              mime: sharedArtwork.mime,
              url: URL.createObjectURL(new Blob([clonedBytes], { type: sharedArtwork.mime }))
            };
          } else {
            patch.artwork = null;
          }
          if (track.metadata?.artwork?.url) {
            URL.revokeObjectURL(track.metadata.artwork.url);
          }
        }

        store.updateTrackMetadata(track.id, patch);

        if (track.status === 'converted' && track.convertedBlob) {
          const updated = await ffmpegService.reapplyMetadataToConverted(store.getTrack(track.id), {
            onStatus: (s, t) => store.setWasmStatus(s, t)
          });
          if (updated) {
            if (track.convertedUrl) URL.revokeObjectURL(track.convertedUrl);
            store.updateTrack(track.id, {
              convertedBlob: updated.blob,
              convertedUrl: URL.createObjectURL(updated.blob),
              convertedName: updated.filename
            });
          }
        }
      }

      showToast(`${draftRows.length} トラックにアルバムメタ情報を反映しました`, 'success');
      close();
    } catch (err) {
      showToast(`アルバム反映中にエラーが発生しました: ${err.message}`, 'error');
    } finally {
      btnApply.disabled = false;
      btnApply.textContent = 'アルバム設定を全トラックに反映';
    }
  });

  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  return { open, close };
}
