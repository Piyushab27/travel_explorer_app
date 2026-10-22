/** Central design tokens so every screen shares the same look. */
export const colors = {
  primary: '#0E7C86',
  primaryDark: '#0A5A62',
  primarySoft: '#E4F3F4',
  accent: '#FF7A59',
  accentSoft: '#FFF1EC',
  background: '#F7F4EF',
  card: '#FFFFFF',
  text: '#1B2A32',
  muted: '#6F7780',
  border: '#ECE6DD',
  heart: '#E53E5C',
  success: '#1B7F4B',
  successSoft: '#E6F6EC',
  warn: '#9A5B00',
  warnSoft: '#FFF3DC',
};

export const radius = { sm: 10, md: 16, lg: 22 };

/** Consistent text sizes: keeps headings, body and captions easy to scan. */
export const type = {
  title: { fontSize: 28, fontWeight: '900' as const, color: colors.text },
  section: { fontSize: 17, fontWeight: '800' as const, color: colors.text },
  body: { fontSize: 15, lineHeight: 23, color: colors.text },
  caption: { fontSize: 12, lineHeight: 18, color: colors.muted },
};

/** Soft card shadow used on raised surfaces. */
export const shadow = {
  elevation: 2,
  shadowColor: '#3B2F1E',
  shadowOpacity: 0.07,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
};
