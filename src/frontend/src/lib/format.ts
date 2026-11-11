export const TIME_ZONE = 'Asia/Ho_Chi_Minh'
export const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
export const timeLabel = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
export const interval = (start: string, end: string) =>
  `${dateLabel(start)} · ${timeRange(start, end)}`
export function timeRange(start: string, end: string) {
  const startDay = localDay(new Date(start))
  const endDay = localDay(new Date(end))
  const endLabel =
    startDay === endDay
      ? timeLabel(end)
      : localDay(new Date(new Date(end).getTime() - 1)) === startDay
        ? '24:00'
        : `${dateLabel(end)} · ${timeLabel(end)}`
  return `${timeLabel(start)}–${endLabel}`
}
export function localDay(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
export const toInstant = (value: string) =>
  value ? `${value.length === 16 ? `${value}:00` : value}+07:00` : ''
export function localInput(value: string) {
  const shifted = new Date(new Date(value).getTime() + 7 * 3600000)
  return shifted.toISOString().slice(0, 16)
}
export const minuteTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
export function formValue(data: FormData, key: string) {
  return String(data.get(key) || '').trim()
}
