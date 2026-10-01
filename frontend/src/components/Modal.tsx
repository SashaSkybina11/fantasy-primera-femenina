import { RxCross1 } from "react-icons/rx";
import { useEffect, useRef, type ReactNode } from "react";
import { useLocale } from "../contexts/LocaleContext";

export function Modal({ title, onClose, children, className = "", hideCloseButton = false }: { title: string; onClose: () => void; children: ReactNode; className?: string; hideCloseButton?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useLocale();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`app-modal ${className}`} aria-label={title}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === ref.current) { const r = ref.current!.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) onClose(); } }}>
    {!hideCloseButton && <button type="button" className="compact-modal__close" aria-label={t("friends.close")} onClick={onClose} autoFocus><RxCross1 className="ui-cross" aria-hidden="true" /></button>}
    <h2 className="app-modal__title">{title}</h2>
    {children}
  </dialog>;
}
