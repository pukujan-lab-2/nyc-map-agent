import { useEffect } from "react";
import { Link } from "react-router-dom";

const LIVE_URL = "https://nyc.design-bakery.com";

/** The live app's QR code, so someone nearby can scan it. A tap around the code or Escape closes it. */
export function QrSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4" data-testid="qr-sheet">
      <button type="button" aria-label="Close QR code" tabIndex={-1} className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Scan to open the app"
        className="relative flex w-[min(300px,100%)] flex-col items-center gap-3 rounded-[24px] bg-white p-5 text-center text-[#0f172a] shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <button type="button" aria-label="Close QR code" onClick={onClose}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#0b1220] text-xl leading-none text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">×</button>
        <p className="pr-10 text-left text-[15px] font-semibold">Scan to open the app</p>
        <img src="/qr-live.svg" alt={`QR code for ${LIVE_URL}`} width={220} height={220} className="h-[220px] w-[220px] [image-rendering:pixelated]" />
        <p className="text-[13px] font-medium text-[#334155]">nyc.design-bakery.com</p>
        {/* More than a code: what the project is, in one tap (owner, 2026-11-18). */}
        <Link to="/present" data-testid="qr-more-presenter" onClick={onClose}
          className="flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#0b1220] px-4 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">Meet Design Baker →</Link>
        <Link to="/record" data-testid="qr-more-record" onClick={onClose}
          className="flex min-h-11 w-full items-center justify-center rounded-[10px] border border-[#0b1220]/25 px-4 text-[14px] font-semibold text-[#0b1220] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">Record a station walk →</Link>
        <a href="/coming-soon.html" data-testid="coming-soon-link"
          className="flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#0b1220] px-4 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">See what is coming →</a>
      </div>
    </div>
  );
}
