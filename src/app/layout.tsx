/**
 * Root layout is a pass-through: the `<html>` element is rendered by the
 * locale layout so `lang` always matches the URL locale (next-intl pattern).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
