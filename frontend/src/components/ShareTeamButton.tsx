import { useCallback, useEffect, useState } from "react";
import { FiShare } from "react-icons/fi";
import toast from "react-hot-toast";
import { useLocale } from "../contexts/LocaleContext";
import type { FantasyTeam } from "../types";
import { Modal } from "./Modal";
import { ShareTeamCard } from "./ShareTeamCard";

const fileName = "fantasy-mi-equipo.png";

export function ShareTeamButton({ team, className = "button button--secondary" }: { team: FantasyTeam; className?: string }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [shareSupported, setShareSupported] = useState(false);

  const onReady = useCallback((image: Blob) => { setBlob(image); setError(false); }, []);
  const onError = useCallback(() => { setBlob(null); setError(true); }, []);

  useEffect(() => {
    if (!blob) { setShareSupported(false); return; }
    const file = new File([blob], fileName, { type: "image/png" });
    const browser = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    setShareSupported(typeof browser.share === "function" && typeof browser.canShare === "function" && browser.canShare({ files: [file] }));
  }, [blob]);

  const openShare = () => {
    if (team.players.filter(player => player.status === "STARTER").length !== 5) {
      toast.error(t("share.incomplete"));
      return;
    }
    setBlob(null); setError(false); setAttempt(value => value + 1); setOpen(true);
  };

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = fileName; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: t("share.dialogTitle") });
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      toast.error(t("share.error"));
    }
  };

  return <>
    <button type="button" className={className} onClick={openShare}><FiShare aria-hidden="true" /> {t("share.button")}</button>
    {open && <Modal title={t("share.dialogTitle")} onClose={() => setOpen(false)} className="share-team-modal">
      {error ? <div className="state-card state-card--error" role="alert"><p>{t("share.error")}</p><button type="button" className="button button--secondary" onClick={() => { setError(false); setBlob(null); setAttempt(value => value + 1); }}>{t("share.retry")}</button></div>
        : <>
          {!blob && <p className="share-team-loading" role="status">{t("share.generating")}</p>}
          <ShareTeamCard key={attempt} team={team} onReady={onReady} onError={onError} />
          <div className="modal-actions share-team-actions">
            <button type="button" className="button" disabled={!blob} onClick={download}>{t("share.download")}</button>
            {shareSupported && <button type="button" className="button button--secondary" disabled={!blob} onClick={() => void share()}><FiShare aria-hidden="true" /> {t("share.share")}</button>}
          </div>
        </>}
    </Modal>}
  </>;
}
