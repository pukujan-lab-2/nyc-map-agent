import { useEffect } from "react";
import type { Map as MaplibreMap } from "maplibre-gl";
import { X } from "lucide-react";
import { PullSheet } from "@/components/PullSheet";
import { bulletFace, lineColor } from "@/lib/transit/bullets";
import type { LineChoice } from "./lineChoice";

/**
 * The lines where a tap landed (src/features/transit/lineChoice.ts): a row of bullets, plus the station when
 * the tap was on one. It is a view of the one sheet (the left card from 640 px), so the tapped spot stays in
 * view and nothing floats over the map (owner, 2026-11-27). Esc, a pan or any other tap closes it.
 */
export function LineChooser({ map, choice, onLine, onStation, onClose }: {
  map: MaplibreMap; at: [number, number]; choice: LineChoice;
  onLine: (route: string) => void; onStation: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    map.on("dragstart", onClose);
    window.addEventListener("keydown", key);
    return () => { map.off("dragstart", onClose); window.removeEventListener("keydown", key); };
  }, [map, onClose]);
  return (
    <PullSheet testId="line-chooser" label="Pick a line" level={1} onLevel={(l) => { if (!l) onClose(); }} onClose={onClose}
      header={<div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
          {choice.routes.map((r) => {
            const { text, darkText } = bulletFace(r);
            return (
              <button key={r} type="button" data-line={r} onClick={() => onLine(r)} aria-label={`${r} line`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[17px] font-bold outline-offset-2"
                style={{ background: lineColor(r), color: darkText ? "#111111" : "#ffffff" }}>
                {text}
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="task-action task-close"><X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden /></button>
      </div>}>
      {choice.station ? (
        <button type="button" onClick={onStation} data-station={choice.station.id}
          className="mt-1 min-h-11 w-full truncate rounded-[14px] bg-white/10 px-3 text-left text-[15px] font-semibold text-white hover:bg-white/20">
          {choice.station.name} station
        </button>
      ) : null}
    </PullSheet>
  );
}
