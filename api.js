const BASE = 'https://apihub.agnes-ai.com';
const DEFAULT_KEY = 'sk-Ub0CZYPi03fDasvt6QtaNFghR9DfwXpOVct1yKiY0M0IhMzd';

export async function textToImage(apiKey, prompt, size, ratio) {
  const resp = await fetch(`${BASE}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey || DEFAULT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'agnes-image-2.1-flash',
      prompt,
      size,
      ratio,
      extra_body: { response_format: 'url' },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `HTTP ${resp.status}`);
  return data.data[0].url;
}

export async function createVideo(apiKey, prompt, width, height, numFrames, frameRate) {
  const resp = await fetch(`${BASE}/v1/videos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey || DEFAULT_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'agnes-video-v2.0',
      prompt,
      width,
      height,
      num_frames: numFrames,
      frame_rate: frameRate,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `HTTP ${resp.status}`);
  return { videoId: data.video_id || data.id, seconds: data.seconds, size: data.size };
}

export async function pollVideo(apiKey, videoId) {
  const resp = await fetch(`${BASE}/agnesapi?video_id=${videoId}`, {
    headers: { 'Authorization': `Bearer ${apiKey || DEFAULT_KEY}` },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `HTTP ${resp.status}`);
  return data;
}

export const SIZE_OPTIONS = ['1K', '2K', '3K', '4K'];
export const RATIO_OPTIONS = ['1:1', '16:9', '9:16', '3:4', '4:3', '2:3', '3:2', '21:9'];

export const SIZE_RATIO_PIXELS = {
  '1K': { '1:1': '1024x1024', '16:9': '1312x736', '9:16': '736x1312', '3:4': '864x1152', '4:3': '1152x864', '2:3': '832x1248', '3:2': '1248x832', '21:9': '1568x672' },
  '2K': { '1:1': '2048x2048', '16:9': '2624x1472', '9:16': '1472x2624', '3:4': '1728x2304', '4:3': '2304x1728', '2:3': '1664x2496', '3:2': '2496x1664', '21:9': '3136x1344' },
  '3K': { '1:1': '3072x3072', '16:9': '3936x2208', '9:16': '2208x3936', '3:4': '2592x3456', '4:3': '3456x2592', '2:3': '2496x3744', '3:2': '3744x2496', '21:9': '4704x2016' },
  '4K': { '1:1': '4096x4096', '16:9': '5248x2944', '9:16': '2944x5248', '3:4': '3456x4608', '4:3': '4608x3456', '2:3': '3328x4992', '3:2': '4992x3328', '21:9': '6272x2688' },
};

export const DURATION_PRESETS = [
  { label: '3 秒', numFrames: 81, frameRate: 24 },
  { label: '5 秒', numFrames: 121, frameRate: 24 },
  { label: '10 秒', numFrames: 241, frameRate: 24 },
  { label: '18 秒', numFrames: 441, frameRate: 24 },
];
