import { useState } from "react";
import { BUSINESS_INK, KIND_GLYPH, RESTROOM_GREEN } from "@/lib/map/restroomIcons";
import { RESTROOM_PICTOGRAM } from "@/lib/map/restroomPictogram";
import type { RestroomOption } from "./pick";

function Figures({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true" className={className}>
      {RESTROOM_PICTOGRAM.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/**
 * The same icon the map draws (src/lib/map/restroomIcons.ts): a green disc
 * with the restroom figures for a public restroom; for a business, its kind
 * or brand logo with a small green restroom badge.
 */
export function RestroomKindIcon({ option }: { option: Pick<RestroomOption, "kind" | "brandWikidata"> }) {
  const [logoFailed, setLogoFailed] = useState(false);
  if (option.kind === "public") {
    return (
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: RESTROOM_GREEN }} aria-hidden="true">
        <Figures className="h-5 w-5" />
      </span>
    );
  }
  const logo = option.brandWikidata && !logoFailed ? `/api/v1/storefronts/logo?qid=${option.brandWikidata}` : null;
  return (
    <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-300 bg-white" aria-hidden="true">
      {logo ? (
        <img src={logo} alt="" className="h-6 w-6 object-contain" onError={() => setLogoFailed(true)} />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke={BUSINESS_INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          {KIND_GLYPH[option.kind].map((d) => <path key={d} d={d} />)}
        </svg>
      )}
      <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white" style={{ background: RESTROOM_GREEN }}>
        <Figures className="h-2.5 w-2.5" />
      </span>
    </span>
  );
}
