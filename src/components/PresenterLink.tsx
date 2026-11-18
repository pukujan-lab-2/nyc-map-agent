import { Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { useMenuT } from "@/lib/i18n/menuText";

/**
 * The way into the guided presentation at /present (NMA-0064), in Settings:
 * Design Baker walks a visitor through the recorded station walk and answers
 * questions about the project. The page also opens by its address.
 */
export function PresenterLink() {
  const t = useMenuT();
  return (
    <Link to="/present" data-testid="open-presenter"
      className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60a5fa]">
      <Moon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{t("presenter")}</span>
      <span aria-hidden>→</span>
    </Link>
  );
}