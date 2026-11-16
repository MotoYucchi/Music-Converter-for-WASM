import { buildZipBlob } from '../utils/zipBuilder.js';

function triggerDownload(blobOrUrl, filename) {
  const isUrl = typeof blobOrUrl === 'string';
  const url = isUrl ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (!isUrl) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function downloadTrack(track) {
  if (!track.convertedBlob) return;
  triggerDownload(track.convertedUrl || track.convertedBlob, track.convertedName || 'converted.audio');
}

export async function downloadAllAsZip(tracks) {
  const converted = tracks.filter((t) => t.status === 'converted' && t.convertedBlob);
  if (converted.length === 0) return;

  // Deduplicate filenames inside ZIP
  const usedNames = new Map();
  const entries = converted.map((t) => {
    let name = t.convertedName || `track_${t.id}.audio`;
    const count = usedNames.get(name) || 0;
    usedNames.set(name, count + 1);
    if (count > 0) {
      const dot = name.lastIndexOf('.');
      name = dot > 0
        ? `${name.slice(0, dot)} (${count})${name.slice(dot)}`
        : `${name} (${count})`;
    }
    return { name, data: t.convertedBlob };
  });

  const zipBlob = await buildZipBlob(entries);
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  triggerDownload(zipBlob, `converted_music_${timestamp}.zip`);
}
