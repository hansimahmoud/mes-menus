export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-stone-200 bg-white">
      <div
        className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-2 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:px-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <p>Menus en ligne &amp; QR codes pour restaurants — simple, gratuit, sans inscription.</p>
        <p>© {new Date().getFullYear()}</p>
      </div>
    </footer>
  )
}
