import { store } from '../state/store.js';
import { parseAudioFile } from '../services/metadataParser.js';
import { showToast } from '../utils/toast.js';
import { t } from '../i18n/i18n.js';

const ACCEPTED_EXTS = new Set([
  'mp3', 'aac', 'm4a', 'wav', 'flac', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'webm', 'mka'
]);

function isAudioFile(file) {
  if (file.type && file.type.startsWith('audio/')) return true;
  const dot = file.name.lastIndexOf('.');
  if (dot < 0) return false;
  return ACCEPTED_EXTS.has(file.name.slice(dot + 1).toLowerCase());
}

export function initDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-input');
  const btnSelectFiles = document.getElementById('btn-select-files');
  const btnSelectFolder = document.getElementById('btn-select-folder');

  async function handleFiles(fileList) {
    const validFiles = Array.from(fileList || []).filter(isAudioFile);
    if (validFiles.length === 0) {
      showToast(t('toast.noValidFiles'), 'error');
      return;
    }

    const addedTracks = store.addTracks(validFiles);
    showToast(t('toast.filesAdded', { count: addedTracks.length }), 'info');

    // Parse existing metadata & artwork in parallel
    await Promise.all(
      addedTracks.map(async (track) => {
        const { metadata, info } = await parseAudioFile(track.file, track.sourceUrl);
        store.updateTrack(track.id, {
          duration: info.duration,
          sampleRate: info.sampleRate || track.sampleRate,
          channels: info.channels || track.channels,
          metadata
        });
      })
    );
  }

  btnSelectFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  btnSelectFolder.addEventListener('click', (e) => {
    e.stopPropagation();
    folderInput.click();
  });

  dropzone.addEventListener('click', () => {
    fileInput.click();
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFiles(fileInput.files);
      fileInput.value = '';
    }
  });

  folderInput.addEventListener('change', () => {
    if (folderInput.files.length > 0) {
      handleFiles(folderInput.files);
      folderInput.value = '';
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer?.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  });
}
