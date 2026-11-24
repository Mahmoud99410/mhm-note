// Notification tone: built-in tones or a sound file the user picks.
import { registerPlugin } from '@capacitor/core';
import { platform } from './native';
import { db } from './db';
import { setSettings } from './settings';

export const TONES = ['default', 'mhm_chime', 'mhm_bell', 'mhm_soft', 'mhm_digital', 'mhm_alarm'];
const LS = 'mhm-tone';
const MhmTone = platform === 'android' ? registerPlugin('MhmTone') : null;

export function getTone() {
  try {
    return JSON.parse(localStorage.getItem(LS) || 'null') || { id: 'default' };
  } catch {
    return { id: 'default' };
  }
}
export const channelId = () => localStorage.getItem('mhm-channel') || undefined;

let audio = null;
function play(url) {
  try {
    audio?.pause();
    audio = new Audio(url);
    audio.play().catch(() => {});
  } catch {}
}

export async function previewTone(id, fileBytes, type) {
  if (id === 'custom') {
    let bytes = fileBytes;
    if (!bytes) {
      const f = await db.getMeta('tone-file');
      if (!f) return;
      bytes = f.bytes;
      type = f.type;
    }
    play(URL.createObjectURL(new Blob([bytes], { type: type || 'audio/mpeg' })));
  } else play(`./tones/${id === 'default' ? 'mhm_chime' : id}.wav`);
}

export async function playReminderTone() {
  const t = getTone();
  if (t.id === 'default' && platform !== 'web') return; // system sound plays with the notification
  await previewTone(t.id);
}

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// choice: { id, name?, bytes?, type? }
export async function applyTone(choice, label = 'MHM NOTE') {
  const stamp = Date.now();
  if (platform === 'android') {
    const id = 'mhm-tone-' + stamp;
    if (choice.id === 'custom') {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const ext = (choice.name || 'tone.mp3').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
      const r = await Filesystem.writeFile({ path: `tones/custom-${stamp}.${ext}`, data: b64(choice.bytes), directory: Directory.Data, recursive: true });
      await MhmTone.createChannel({ id, name: label, path: r.uri });
    } else if (choice.id === 'default') {
      await MhmTone.createChannel({ id, name: label });
    } else {
      await MhmTone.createChannel({ id, name: label, raw: choice.id });
    }
    localStorage.setItem('mhm-channel', id);
  }
  if (choice.id === 'custom') await db.setMeta('tone-file', { bytes: choice.bytes, type: choice.type });
  localStorage.setItem(LS, JSON.stringify({ id: choice.id, name: choice.name }));
  setSettings({ toneRev: stamp }); // re-schedules reminders on the new channel
}
