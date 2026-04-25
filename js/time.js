export const toInstant = (ts) =>
  ts == null ? null : Temporal.Instant.fromEpochMilliseconds(ts.toMillis?.() ?? +ts);

export const fmtISO = (ts) => toInstant(ts)?.toString() ?? '';

export const wasEdited = (d) => {
  const u = toInstant(d.updatedAt),
    c = toInstant(d.createdAt);
  return u != null && c != null && Temporal.Instant.compare(u, c) > 0;
};

export const fmtAbsolute = (ts) => {
  const d = toInstant(ts);
  if (!d) {
    return '';
  }
  const date = new Date(d.epochMilliseconds);
  const month = date.toLocaleDateString('en-GB', { month: 'long' });
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${month}, ${date.getFullYear()} - ${hh}:${mm}`;
};

export const timeAgo = (ts) => {
  const d = toInstant(ts);
  if (!d) {
    return '';
  }
  const secs = Math.round((Date.now() - d.epochMilliseconds) / 1000);
  if (secs < 60) {
    return 'just now';
  }
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
};

export const articleMetaHover = (data) => {
  if (!data) {
    return '';
  }
  const ms = (ts) => ts?.toMillis?.() ?? 0;
  const candidates = [
    { key: 'posted', ts: data.createdAt, show: true },
    {
      key: 'active',
      ts: data.lastReplyAt,
      show: !!data.lastReplyAt && ms(data.lastReplyAt) !== ms(data.createdAt),
    },
    { key: 'edited', ts: data.updatedAt, show: wasEdited(data) },
  ].filter((m) => m.show && m.ts);
  if (!candidates.length) {
    return '';
  }
  const latest = candidates.reduce((a, b) => (ms(b.ts) > ms(a.ts) ? b : a));
  return `${latest.key} ${timeAgo(latest.ts)}`;
};

window.fmtISO = fmtISO;
window.fmtAbsolute = fmtAbsolute;
window.articleMetaHover = articleMetaHover;
