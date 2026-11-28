import { useCallback, useRef } from "react";

/**
 * A callback ref that publishes the element's height as a CSS variable on the root, so buttons that
 * share its corner can step above it; removed when the element goes. `gap` is added to the height.
 */
export function useCssHeight(name: string, gap = 0): (el: HTMLElement | null) => void {
  const ro = useRef<ResizeObserver | null>(null);
  return useCallback((el: HTMLElement | null) => {
    const root = document.documentElement;
    ro.current?.disconnect();
    ro.current = null;
    if (!el) { root.style.removeProperty(name); return; }
    const publish = () => root.style.setProperty(name, `${Math.ceil(el.getBoundingClientRect().height) + gap}px`);
    publish();
    if (typeof ResizeObserver !== "undefined") { ro.current = new ResizeObserver(publish); ro.current.observe(el); }
  }, [name, gap]);
}
