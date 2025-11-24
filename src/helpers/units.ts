export function formatNumber(bytes: number, digits = 0): string {
  const def: { value: number; symbol: string }[] = [
    { value: 1, symbol: '' },
    { value: 1e3, symbol: 'K' },
    { value: 1e6, symbol: 'M' },
    { value: 1e9, symbol: 'B' },
    { value: 1e12, symbol: 'T' },
    { value: 1e15, symbol: 'Q' },
    { value: 1e18, symbol: 'Z' },
  ];

  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  let i = def.length - 1;

  for (; i > 0; i--) {
    if (bytes >= def[i].value) {
      break;
    }
  }

  const formatted = (bytes / def[i].value)
    .toFixed(digits)
    .replace(rx, '$1');

  return `${formatted}${def[i].symbol}`;
}

export function formatBytes(bytes: number | string): string {
  let value: number
    = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;

  const units: string[] = [
    'bytes',
    'KB',
    'MB',
    'GB',
    'TB',
    'PB',
    'EB',
    'ZB',
    'YB',
  ];

  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const decimals = value < 10 && unitIndex > 0 ? 1 : 0;

  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function formatBytesPerSec(bps: number): string {
  const units = ['B/s', 'KiB/s', 'MiB/s', 'GiB/s'];
  let idx = 0;
  let value = bps;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(1)} ${units[idx]}`;
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
