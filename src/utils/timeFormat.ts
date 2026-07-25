import { UTCTimestamp } from 'lightweight-charts';

const IST_TZ = 'Asia/Kolkata';

function toIstDate(time: UTCTimestamp): Date {
  return new Date((time as number) * 1000);
}

export function formatIstTick(time: UTCTimestamp, secondsVisible: boolean, dateOnly: boolean): string {
  const d = toIstDate(time);
  if (dateOnly) {
    return d.toLocaleDateString('en-GB', { timeZone: IST_TZ, day: '2-digit', month: 'short' });
  }
  return d.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: secondsVisible ? '2-digit' : undefined,
    hour12: false,
  });
}

export function formatIstCrosshair(time: UTCTimestamp, secondsVisible: boolean): string {
  const d = toIstDate(time);
  const date = d.toLocaleDateString('en-GB', { timeZone: IST_TZ, day: '2-digit', month: 'short', year: 'numeric' });
  const t = d.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: secondsVisible ? '2-digit' : undefined,
    hour12: false,
  });
  return `${date} ${t} IST`;
}
