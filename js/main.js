import { store } from './state/store.js';
import { ffmpegService } from './services/ffmpegService.js';
import { downloadAllAsZip } from './services/downloadService.js';
import { initConversionSettings } from './components/conversionSettings.js';
import { initDropzone } from './components/dropzone.js';
import { initTrackList } from './components/trackList.js';
import { initMetadataEditorModal } from './components/metadataEditorModal.js';
import { initAlbumMetadataModal } from './components/albumMetadataModal.js';
import { showToast } from './utils/toast.js';

function initApp() {
  const statusBadge = document.getElementById('wasm-status-badge');
  const statusText = document.getElementById('wasm-status-text');
  const btnConvertAll = document.getElementById('btn-convert-all');
  const btnOpenAlbumMeta = document.getElementById('btn-open-album-meta');
  const btnDownloadZip = document.getElementById('btn-download-zip');
  const btnClearQueue = document.getElementById('btn-clear-queue');

  const globalProgress = document.getElementById('global-progress-bar');
  const globalProgressLabel = document.getElementById('global-progress-label');
  const globalProgressCount = document.getElementById('global-progress-count');
  const globalProgressFill = document.getElementById('global-progress-fill');

  // Sync WASM status badge
  store.subscribe((s) => {
    statusBadge.className = `status-badge status-${s.wasmStatus}`;
    statusText.textContent = s.wasmStatusText;
  });

  async function convertSingleTrack(trackId) {
    const track = store.getTrack(trackId);
    if (!track) return false;

    if (track.convertedUrl) {
      URL.revokeObjectURL(track.convertedUrl);
    }

    store.updateTrack(trackId, {
      status: 'converting',
      progress: 0,
      error: null,
      convertedBlob: null,
      convertedUrl: null
    });

    try {
      const result = await ffmpegService.convertTrack(track, {
        onStatus: (status, text) => store.setWasmStatus(status, text),
        onProgress: (pct) => {
          const current = store.getTrack(trackId);
          if (current && current.status === 'converting') {
            store.updateTrack(trackId, { progress: pct });
          }
        }
      });

      const convertedUrl = URL.createObjectURL(result.blob);
      store.updateTrack(trackId, {
        status: 'converted',
        progress: 100,
        convertedBlob: result.blob,
        convertedUrl,
        convertedName: result.filename,
        convertedFormat: result.format
      });
      return true;
    } catch (err) {
      store.updateTrack(trackId, {
        status: 'error',
        progress: 0,
        error: err?.message || '変換中にエラーが発生しました'
      });
      showToast(`${track.originalName} の変換に失敗しました`, 'error');
      return false;
    }
  }

  async function convertAllTracks() {
    if (store.tracks.length === 0 || store.isBatchConverting) return;

    const targets = [...store.tracks];
    store.isBatchConverting = true;
    store.notify();

    globalProgress.classList.remove('hidden');
    let successCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      globalProgressLabel.textContent = `変換中: ${t.metadata?.title || t.originalName}`;
      globalProgressCount.textContent = `${i + 1} / ${targets.length}`;
      globalProgressFill.style.width = `${Math.round((i / targets.length) * 100)}%`;

      const ok = await convertSingleTrack(t.id);
      if (ok) successCount++;
    }

    globalProgressFill.style.width = '100%';
    store.isBatchConverting = false;
    store.notify();

    setTimeout(() => {
      globalProgress.classList.add('hidden');
      globalProgressFill.style.width = '0%';
    }, 1200);

    if (successCount === targets.length) {
      showToast(`${successCount} 件すべての変換が完了しました`, 'success');
    } else {
      showToast(`${successCount} / ${targets.length} 件の変換が完了しました`, 'info');
    }
  }

  const metadataModal = initMetadataEditorModal();
  const albumModal = initAlbumMetadataModal({
    onOpenTrackMetadata: (trackId) => metadataModal.open(trackId)
  });

  initConversionSettings();
  initDropzone();
  initTrackList({
    onConvertTrack: (trackId) => convertSingleTrack(trackId),
    onOpenMetadataModal: (trackId) => metadataModal.open(trackId)
  });

  btnConvertAll.addEventListener('click', convertAllTracks);
  btnOpenAlbumMeta.addEventListener('click', () => albumModal.open());

  btnDownloadZip.addEventListener('click', async () => {
    try {
      btnDownloadZip.disabled = true;
      await downloadAllAsZip(store.tracks);
      showToast('ZIPファイルのダウンロードを開始しました', 'success');
    } catch (err) {
      showToast(`ZIP作成エラー: ${err.message}`, 'error');
    } finally {
      btnDownloadZip.disabled = store.tracks.filter((t) => t.status === 'converted').length === 0;
    }
  });

  btnClearQueue.addEventListener('click', () => {
    store.clearTracks();
    showToast('トラックキューをクリアしました', 'info');
  });
}

document.addEventListener('DOMContentLoaded', initApp);
