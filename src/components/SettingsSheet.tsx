import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PullSheet } from "@/components/PullSheet";
import { QrSheet } from "@/components/QrSheet";
import { AppSettings, LanguageSelect, MemoryControls } from "@/components/SettingsBody";
import type { SheetLevel } from "@/components/sheetSwipe";
import { useMenuT } from "@/lib/i18n/menuText";
import { LANG_LABELS, useLangPref } from "@/lib/voice/langPref";

type View = "you" | "settings" | "memory";

const RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]";
const ROW = `relative flex min-h-12 w-full items-center gap-3 px-3 text-left text-[15px] font-medium text-[#f1f5f9] hover:bg-white/5 ${RING}`;
const GROUP = "flex flex-col divide-y divide-[#263449] overflow-hidden rounded-[14px] bg-[rgba(15,23,42,0.6)]";
const Chev = () => <ChevronRight className="h-4 w-4 shrink-0 text-[#a5b4cb]" aria-hidden />;

function Label({ text, sub }: { text: string; sub?: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{text}</span>
      {sub ? <span className="truncate text-[13px] font-normal text-[#a5b4cb]">{sub}</span> : null}
    </span>
  );
}

function Go({ to, testId, text, sub, end }: { to: string; testId: string; text: string; sub?: string; end?: ReactNode }) {
  // Static pages under public/ are not in the app's router, so they load as plain links.
  const page = to.endsWith(".html") || to.endsWith("/");
  const body = <><Label text={text} sub={sub} />{end}<Chev /></>;
  return page
    ? <a href={to} data-testid={testId} className={ROW}>{body}</a>
    : <Link to={to} data-testid={testId} className={ROW}>{body}</Link>;
}

/**
 * The You card, opened by the person button at the chat bar's right end, like
 * Apple Maps' account card: settings, language and what we remember, then the
 * pages that are not about getting around (owner, 2026-11-27). Settings and
 * What we remember open as the card's next view with a Back arrow.
 */
export default function SettingsSheet({ onClose }: { onClose: () => void }) {
  const t = useMenuT();
  const lang = useLangPref();
  const [level, setLevel] = useState<SheetLevel>(1);
  const [view, setView] = useState<View>("you");
  const [qr, setQr] = useState(false);
  const title = view === "settings" ? t("settings") : view === "memory" ? t("whatWeRemember") : t("you");
  return (
    <>
      <PullSheet testId="settings-sheet" label={title} level={level} onLevel={(l) => (l ? setLevel(l) : onClose())} onClose={onClose}
        header={
          <div className="flex min-h-12 items-center gap-2 px-1">
            {view !== "you" ? (
              <button type="button" aria-label="Back" data-testid="you-back" onClick={() => setView("you")} className="task-action task-close">
                <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
            <span className="flex-1 truncate text-[17px] font-semibold text-slate-100">{title}</span>
            <button type="button" aria-label={`Close ${title}`} onClick={onClose} className="task-action task-close">
              <X className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        }>
        <div className="pull-sheet-body flex flex-col gap-3 text-[#f1f5f9]" data-testid="you-card" style={{ maxHeight: "min(52dvh, 520px)" }}>
          {view === "settings" ? <AppSettings />
            : view === "memory" ? <MemoryControls />
            : <>
              <div className={GROUP}>
                <button type="button" data-testid="you-settings" className={ROW} onClick={() => setView("settings")}><Label text={t("settings")} /><Chev /></button>
                {/* A native select over the row, so a phone opens its own picker in one tap (#10). */}
                <label data-testid="you-language" className={`${ROW} cursor-pointer`}>
                  <Label text={t("language")} />
                  <span className="text-[14px] text-[#a5b4cb]">{lang ? LANG_LABELS[lang] : t("thisPhone")}</span>
                  <Chev />
                  <LanguageSelect className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0" />
                </label>
                <button type="button" data-testid="you-memory" className={ROW} onClick={() => setView("memory")}><Label text={t("whatWeRemember")} /><Chev /></button>
              </div>
              <p className="m-0 px-3 text-[13px] font-semibold text-[#a5b4cb]">{t("more")}</p>
              <div className={GROUP}>
                <Go to="/city-data" testId="open-city-data" text={t("cityData")} sub={t("cityDataSub")} />
                <Go to="/present" testId="open-presenter" text={t("presenter")} />
                <Go to="/record" testId="open-recorder" text={t("recordWalk")} />
                <Go to="/tracker-health" testId="open-tracker-health" text={t("trackerHealth")} />
                <Go to="/coming-soon.html" testId="open-coming-soon" text={t("whatsComing")} />
                <button type="button" data-testid="qr-button" className={ROW} onClick={() => setQr(true)}>
                  <Label text={t("shareApp")} /><span className="text-[14px] text-[#a5b4cb]">QR</span><Chev />
                </button>
                <Go to="/info/" testId="open-info" text={t("aboutProject")} />
              </div>
            </>}
        </div>
      </PullSheet>
      {qr ? <QrSheet onClose={() => setQr(false)} /> : null}
    </>
  );
}
