import { Route, TrainFront } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ExitStairsIcon, RestroomIcon } from "./homeIcons";
import { useT } from "@/lib/i18n/appLang";

export interface TaskHandlers {
  restroom: () => void;
  train: () => void;
  plan: () => void;
  exit: () => void;
}

// Small pills in one row everywhere: on a phone the tasks are suggestions over the chat, not tiles that cover the map (owner, 2026-10-25).
const TASK = "h-10 shrink-0 gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3.5 text-[13px] font-semibold text-slate-100 shadow-lg backdrop-blur-md hover:bg-slate-800/95 hover:text-white [&_svg]:!h-[18px] [&_svg]:!w-[18px]";

/** The four task buttons above the chat bar on the idle home (#370). */
export function TaskButtons({ on }: { on: TaskHandlers }) {
  const t = useT();
  const tasks: Array<[string, ReactNode, () => void]> = [
    [t("restroom"), <RestroomIcon key="i" className="!h-6 !w-6" />, on.restroom],
    [t("myTrain"), <TrainFront key="i" className="!h-[22px] !w-[22px]" aria-hidden="true" />, on.train],
    [t("planTrip"), <Route key="i" className="!h-[22px] !w-[22px]" aria-hidden="true" />, on.plan],
    [t("findExit"), <ExitStairsIcon key="i" className="!h-[22px] !w-[22px]" />, on.exit],
  ];
  return (
    <div className="pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:justify-center" data-testid="home-tasks">
      {tasks.map(([label, icon, run]) => (
        <Button key={label} type="button" variant="ghost" className={TASK} onClick={run}>
          {icon}
          <span className="whitespace-nowrap">{label}</span>
        </Button>
      ))}
    </div>
  );
}
