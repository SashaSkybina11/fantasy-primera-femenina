import { RxCross1 } from "react-icons/rx";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocale } from "../contexts/LocaleContext";

export function Modal({ title, onClose, children, className = "", hideCloseButton = false }: { title: string; onClose: () => void; children: ReactNode; className?: string; hideCloseButton?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLocale();
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      document.documentElement.style.overflow = rootOverflow;
      window.scrollTo({ left: scrollX, top: scrollY, behavior: "instant" });
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`app-modal ${className}`} aria-label={title}
    onCancel={(event) => event.preventDefault()}
    onPointerDown={(event) => { if (event.target === event.currentTarget) event.preventDefault(); }}>
    {!hideCloseButton && <button type="button" className="compact-modal__close" aria-label={t("friends.close")} onClick={onClose} autoFocus><RxCross1 className="ui-cross" aria-hidden="true" /></button>}
    <h2 className="app-modal__title">{title}</h2>
    {children}
  </dialog>;
}
