import { StyleSheet } from 'react-native';
import { Colors } from './colors';
export const featureStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48, gap: 12 },
  title: { color: Colors.primary, fontSize: 28, fontWeight: '800' },
  heading: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
  text: { color: Colors.textPrimary, lineHeight: 22, flexShrink: 1 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  bar: { backgroundColor: Colors.primary, height: 10, borderRadius: 5 },
});
