/**
 * Renders the assistant's lightweight formatting ("## heading", "- bullet", **bold**) as native text.
 * Anything else is shown as plain text, so unexpected model output can never become markup or code.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme';

function inline(text: string, keyBase: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <Text key={`${keyBase}-${i}`} style={styles.bold}>{part.slice(2, -2)}</Text>
    ) : (
      <Text key={`${keyBase}-${i}`}>{part.replace(/\*\*/g, '')}</Text>
    ),
  );
}

/**
 * Some models return a whole answer on one line. If there are no line breaks, split before
 * "Day 1:" style markers and before " - " list items so the answer is still easy to read.
 */
export function normalise(text: string): string {
  if (text.includes('\n') || text.length < 160) return text;
  return text
    .replace(/\s+(?=Day \d+\s*[:.\-–])/g, '\n')
    .replace(/\s+-\s+(?=[A-Z*])/g, '\n- ')
    .replace(/^(#{1,4}\s+[^.:\n]{3,70}[.:])\s+/, '$1\n');
}

export default function RichText({ text }: { text: string }) {
  const lines = normalise(text).split('\n');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 2 }} />;
        const heading = line.match(/^#{1,4}\s+(.*)$/);
        // Only short lines are headings; a long line that merely starts with "#" is a paragraph.
        if (heading && heading[1].length <= 80) return <Text key={i} style={styles.heading}>{inline(heading[1], `h${i}`)}</Text>;
        if (heading) return <Text key={i} style={type.body}>{inline(heading[1], `p${i}`)}</Text>;
        const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
        if (bullet) {
          const nested = bullet[1].length >= 2;
          return (
            <View key={i} style={[styles.bulletRow, nested && { marginLeft: 16 }]}>
              <Text style={styles.dot}>•</Text>
              <Text style={[type.body, { flex: 1 }]}>{inline(bullet[2], `b${i}`)}</Text>
            </View>
          );
        }
        return <Text key={i} style={type.body}>{inline(line.trim(), `p${i}`)}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.section, color: colors.primaryDark, marginTop: 6 },
  bold: { fontWeight: '800' },
  bulletRow: { flexDirection: 'row', gap: 8 },
  dot: { color: colors.accent, fontWeight: '900', lineHeight: 23 },
});
