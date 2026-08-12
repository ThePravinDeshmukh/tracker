import { TickMarkType, UTCTimestamp } from 'lightweight-charts';

const IST_TZ = 'Asia/Kolkata';

function toIstDate(time: UTCTimestamp): Date {
  return new Date((time as number) * 1000);
}

// Ticks that land on a day/month/year boundary are rendered as a date
// instead of a time — otherwise a hint like "1h" candles only ever show
// the hour, so a day rollover is indistinguishable from any other tick.
export function formatIstTick(time: UTCTimestamp, tickMarkType: TickMarkType, dateOnly: boolean): string {
  const d = toIstDate(time);
  const isDateBoundary = tickMarkType === TickMarkType.Year
    || tickMarkType === TickMarkType.Month
    || tickMarkType === TickMarkType.DayOfMonth;
  if (dateOnly || isDateBoundary) {
    return d.toLocaleDateString('en-GB', {
      timeZone: IST_TZ,
      day: '2-digit',
      month: 'short',
      year: tickMarkType === TickMarkType.Year ? 'numeric' : undefined,
    });
  }
  return d.toLocaleTimeString('en-GB', {
    timeZone: IST_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: tickMarkType === TickMarkType.TimeWithSeconds ? '2-digit' : undefined,
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
