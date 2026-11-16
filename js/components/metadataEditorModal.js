import { METADATA_KEYS } from '../constants/metadataFields.js';
import { store } from '../state/store.js';
import { ffmpegService } from '../services/ffmpegService.js';
import { formatBytes } from '../utils/formatters.js';
import { showToast } from '../utils/toast.js';
import { t } from '../i18n/i18n.js';

export function initMetadataEditorModal() {
  const modal = document.getElementById('metadata-modal');
  const form = document.getElementById('metadata-form');
  const subtitleEl = document.getElementById('metadata-modal-subtitle');
  const targetBanner = document.getElementById('metadata-target-banner');
  const btnClose = document.getElementById('btn-close-metadata-modal');
  const btnCancel = document.getElementById('btn-cancel-metadata');
  const btnSave = document.getElementById('btn-save-metadata');

  const artworkDrop = document.getElementById('meta-artwork-drop');
  const artworkInput = document.getElementById('meta-artwork-input');
  const artworkPreview = document.getElementById('meta-artwork-preview');
  const artworkPlaceholder = document.getElementById('meta-artwork-placeholder');
  const artworkInfo = document.getElementById('meta-artwork-info');
  const btnArtSelect = document.getElementById('btn-meta-artwork-select');
  const btnArtRemove = document.getElementById('btn-meta-artwork-remove');

  let activeTrackId = null;
  let draftArtwork = null; // { data: Uint8Array, mime: string, url: string } | null
  let artworkDirty = false;

  function updateArtworkUI(art) {
    if (art && art.url) {
      artworkPreview.src = art.url;
      artworkPreview.classList.remove('hidden');
      artworkPlaceholder.classList.add('hidden');
      btnArtRemove.disabled = false;
      artworkInfo.textContent = `${art.mime || 'image'} · ${formatBytes(art.data?.length || 0)}`;
    } else {
      artworkPreview.removeAttribute('src');
      artworkPreview.classList.add('hidden');
      artworkPlaceholder.classList.remove('hidden');
      btnArtRemove.disabled = true;
      artworkInfo.textContent = t('meta.artworkNone');
    }
  }

  async function setArtworkFromFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast(t('toast.invalidImage'), 'error');
      return;
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const blob = new Blob([buf], { type: file.type });
    if (draftArtwork?.url && artworkDirty) {
      URL.revokeObjectURL(draftArtwork.url);
    }
    draftArtwork = {
      data: buf,
      mime: file.type,
      url: URL.createObjectURL(blob)
    };
    artworkDirty = true;
    updateArtworkUI(draftArtwork);
  }

  function open(trackId) {
    const track = store.getTrack(trackId);
    if (!track) return;

    activeTrackId = trackId;
    artworkDirty = false;
    draftArtwork = track.metadata?.artwork || null;

    subtitleEl.textContent = track.originalName;
    if (track.status === 'converted') {
      targetBanner.textContent = t('meta.convertedBanner');
      targetBanner.classList.remove('hidden');
    } else {
      targetBanner.classList.add('hidden');
    }

    for (const key of METADATA_KEYS) {
      const input = form.elements.namedItem(key);
      if (input) {
        input.value = track.metadata?.[key] ?? '';
      }
    }

    updateArtworkUI(draftArtwork);
    modal.classList.remove('hidden');
  }

  function close() {
    if (artworkDirty && draftArtwork?.url) {
      URL.revokeObjectURL(draftArtwork.url);
    }
    activeTrackId = null;
    draftArtwork = null;
    artworkDirty = false;
    modal.classList.add('hidden');
  }

  btnClose.addEventListener('click', close);
  btnCancel.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
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

  artworkDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    artworkDrop.style.borderColor = 'var(--accent-primary)';
  });
  artworkDrop.addEventListener('dragleave', () => {
    artworkDrop.style.borderColor = '';
  });
  artworkDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    artworkDrop.style.borderColor = '';
    if (e.dataTransfer?.files?.[0]) {
      setArtworkFromFile(e.dataTransfer.files[0]);
    }
  });

  btnArtRemove.addEventListener('click', () => {
    if (artworkDirty && draftArtwork?.url) {
      URL.revokeObjectURL(draftArtwork.url);
    }
    draftArtwork = null;
    artworkDirty = true;
    updateArtworkUI(null);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeTrackId) return;
    const track = store.getTrack(activeTrackId);
    if (!track) return;

    const patch = {};
    for (const key of METADATA_KEYS) {
      const input = form.elements.namedItem(key);
      if (input) {
        patch[key] = input.value;
      }
    }

    if (artworkDirty) {
      if (track.metadata?.artwork?.url && track.metadata.artwork.url !== draftArtwork?.url) {
        URL.revokeObjectURL(track.metadata.artwork.url);
      }
      patch.artwork = draftArtwork;
      artworkDirty = false; // Ownership transferred to store
    }

    store.updateTrackMetadata(activeTrackId, patch);

    if (track.status === 'converted' && track.convertedBlob) {
      btnSave.disabled = true;
      btnSave.textContent = t('meta.saving');
      try {
        const updated = await ffmpegService.reapplyMetadataToConverted(store.getTrack(activeTrackId), {
          onStatus: (s, key) => store.setWasmStatus(s, key)
        });
        if (updated) {
          if (track.convertedUrl) URL.revokeObjectURL(track.convertedUrl);
          store.updateTrack(activeTrackId, {
            convertedBlob: updated.blob,
            convertedUrl: URL.createObjectURL(updated.blob),
            convertedName: updated.filename
          });
        }
        showToast(t('toast.metaSavedRetagged'), 'success');
      } catch (err) {
        showToast(t('toast.retagError', { msg: err.message }), 'error');
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = t('meta.save');
      }
    } else {
      showToast(t('toast.metaSaved'), 'success');
    }

    close();
  });

  return { open, close };
}
