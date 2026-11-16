import { AUDIO_FORMATS, BIT_DEPTHS, SAMPLE_RATES, resolveSampleRateForFormat } from '../constants/audioConfig.js';
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { i18n, t } from '../i18n/i18n.js';

export function initConversionSettings() {
  const formatSel = document.getElementById('master-format');
  const bitSel = document.getElementById('master-bit-depth');
  const rateSel = document.getElementById('master-sample-rate');
  const bitrateSel = document.getElementById('master-bitrate');
  const bitrateGroup = document.getElementById('master-bitrate-group');
  const channelsSel = document.getElementById('master-channels');
  const noteEl = document.getElementById('master-compatibility-note');
  const applyAllBtn = document.getElementById('btn-apply-master-all');

  // Populate format options
  formatSel.innerHTML = Object.values(AUDIO_FORMATS)
    .map((f) => `<option value="${f.id}">${f.label}</option>`)
    .join('');

  // Populate bit depth options
  bitSel.innerHTML = BIT_DEPTHS
    .map((b) => `<option value="${b.id}">${b.label}</option>`)
    .join('');

  // Populate sample rate options
  rateSel.innerHTML = SAMPLE_RATES
    .map((r) => `<option value="${r.value}">${r.label}</option>`)
    .join('');

  function syncUI() {
    const s = store.masterSettings;
    const fmt = AUDIO_FORMATS[s.format];

    formatSel.value = s.format;
    bitSel.value = s.bitDepth;
    rateSel.value = String(s.sampleRate);
    channelsSel.value = s.channels;

    // Bitrate options for lossy formats
    if (fmt.lossy) {
      bitrateGroup.classList.remove('hidden');
      bitrateSel.innerHTML = fmt.bitrates
        .map((br) => `<option value="${br}">${br}bps</option>`)
        .join('');
      bitrateSel.value = fmt.bitrates.includes(s.bitrate) ? s.bitrate : fmt.defaultBitrate;
    } else {
      bitrateGroup.classList.add('hidden');
    }

    // Compatibility note
    const resolvedRate = resolveSampleRateForFormat(fmt.id, Number(s.sampleRate));
    const baseNote = t(`fmt.note.${fmt.id}`);
    if (resolvedRate !== Number(s.sampleRate)) {
      noteEl.className = 'compatibility-note is-warning';
      noteEl.textContent = `${baseNote}${t('settings.rateAdjusted', { req: s.sampleRate / 1000, res: resolvedRate / 1000 })}`;
    } else {
      noteEl.className = 'compatibility-note';
      noteEl.textContent = baseNote;
    }

    applyAllBtn.disabled = store.tracks.length === 0 || store.isBatchConverting;
  }

  formatSel.addEventListener('change', () => {
    const fmt = AUDIO_FORMATS[formatSel.value];
    const patch = { format: fmt.id };
    if (fmt.lossy) {
      patch.bitrate = fmt.defaultBitrate;
    }
    store.setMasterSettings(patch);
  });

  bitSel.addEventListener('change', () => {
    store.setMasterSettings({ bitDepth: bitSel.value });
  });

  rateSel.addEventListener('change', () => {
    store.setMasterSettings({ sampleRate: Number(rateSel.value) });
  });

  bitrateSel.addEventListener('change', () => {
    store.setMasterSettings({ bitrate: bitrateSel.value });
  });

  channelsSel.addEventListener('change', () => {
    store.setMasterSettings({ channels: channelsSel.value });
  });

  applyAllBtn.addEventListener('click', () => {
    store.applyMasterToAllTracks();
    showToast(t('toast.masterApplied'), 'success');
  });

  store.subscribe(syncUI);
  i18n.subscribe(syncUI);
  syncUI();
}
