import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaRegNewspaper } from "react-icons/fa6";
import { ClubLogo } from "../components/ClubLogo";
import { Loader } from "../components/Loader";
import { useAuth } from "../contexts/AuthContext";
import { useLocale, type TranslationKey } from "../contexts/LocaleContext";
import { api, imageUrl } from "../services/api";
import type { Gameweek, IdealFiveEntry, IdealFiveSlot, Player } from "../types";

const sourceUrl = "https://rfef.es/es/noticias/futbol-sala/primera-femenina-futsal?baseFilters=79393";
const slots: Array<{ id: IdealFiveSlot; key: TranslationKey; role: Player["role"]; goalkeeper?: boolean }> = [
  { id: "GOALKEEPER", key: "idealFive.goalkeeper", role: "PORTERA", goalkeeper: true },
  { id: "PIVOT", key: "idealFive.slotPivot", role: "PIVOT" },
  { id: "CLOSER", key: "idealFive.slotCloser", role: "CIERRE" },
  { id: "WINGER_ONE", key: "idealFive.slotWingerOne", role: "ALA" },
  { id: "WINGER_TWO", key: "idealFive.slotWingerTwo", role: "ALA" },
];

function IdealPlayerCard({ entry, label }: { entry?: IdealFiveEntry; label: string }) {
  const { t } = useLocale();
  if (!entry) return <article className="ideal-five-card ideal-five-card--empty"><span className="ideal-five-card__portrait">—</span><strong>{label}</strong></article>;
  const photo = imageUrl(entry.player.photoUrl);
  return <article className="ideal-five-card">
    <div className="ideal-five-card__portrait">
      {photo ? <img src={photo} alt={entry.player.name} /> : <span aria-hidden="true">{entry.player.name.slice(0, 1).toUpperCase()}</span>}
      <b>#{entry.player.displayNumber ?? entry.player.number}</b>
    </div>
    <strong className="ideal-five-card__name">{entry.player.name}</strong>
    <div className="ideal-five-card__club"><ClubLogo club={entry.player.club} /><span>{entry.player.club.name}</span></div>
    <span className="ideal-five-card__position">{label || t("idealFive.fieldPlayer")}</span>
  </article>;
}

export function IdealFivePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const [selectedWeekId, setSelectedWeekId] = useState("");
  const [draft, setDraft] = useState<Partial<Record<IdealFiveSlot, string>>>({});
  const [clubFilters, setClubFilters] = useState<Partial<Record<IdealFiveSlot, string>>>({});
  const currentWeek = useQuery({ queryKey: ["current-gameweek"], queryFn: api.currentGameweek });
  const history = useQuery({ queryKey: ["ideal-five-history"], queryFn: api.idealFiveHistory });
  const adminWeeks = useQuery({ queryKey: ["admin-gameweeks"], queryFn: api.adminGameweeks, enabled: isAdmin });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs, enabled: isAdmin });
  const players = useQuery({ queryKey: ["ideal-five-players"], queryFn: () => api.players({}), enabled: isAdmin });
  const weeks = useMemo<Gameweek[]>(() => {
    if (isAdmin) return adminWeeks.data ?? [];
    const published = Array.from(new Map((history.data ?? []).map(entry => [entry.gameweekId, entry.gameweek])).values());
    if (currentWeek.data && !published.some(item => item.id === currentWeek.data!.id)) published.push(currentWeek.data);
    return published.sort((a, b) => b.number - a.number);
  }, [adminWeeks.data, currentWeek.data, history.data, isAdmin]);

  useEffect(() => {
    if (selectedWeekId) return;
    const fallback = currentWeek.data?.id ?? weeks[0]?.id;
    if (fallback) setSelectedWeekId(fallback);
  }, [currentWeek.data, isAdmin, selectedWeekId, weeks]);

  const savedEntries = useMemo(() => (history.data ?? []).filter(entry => entry.gameweekId === selectedWeekId), [history.data, selectedWeekId]);
  useEffect(() => {
    setDraft(Object.fromEntries(savedEntries.map(entry => [entry.slot, entry.playerId])));
  }, [savedEntries]);

  const save = useMutation({
    mutationFn: () => api.saveIdealFive(selectedWeekId, slots.map(slot => ({ slot: slot.id, playerId: draft[slot.id]! }))),
    onSuccess: async () => { toast.success(t("idealFive.saved")); await queryClient.invalidateQueries(); },
    onError: error => toast.error(error.message),
  });

  const week: Gameweek | undefined = weeks.find(item => item.id === selectedWeekId) ?? currentWeek.data ?? undefined;
  const heading = week ? t("idealFive.heading", { number: week.number }) : t("idealFive.title");
  const chosenEntries: IdealFiveEntry[] = isAdmin
    ? slots.flatMap(slot => {
      const player = players.data?.find(item => item.id === draft[slot.id]);
      return player?.club ? [{ id: slot.id, gameweekId: selectedWeekId, playerId: player.id, slot: slot.id, gameweek: week!, player: player as IdealFiveEntry["player"] }] : [];
    })
    : savedEntries;
  const chosenBySlot = new Map(chosenEntries.map(entry => [entry.slot, entry]));
  const savingReady = slots.every(slot => Boolean(draft[slot.id])) && new Set(slots.map(slot => draft[slot.id])).size === 5;

  return <div className="page ideal-five-page">
    <header className="page-heading">
      <h1>{heading}</h1>
      <a className="ideal-five-source" href={sourceUrl} target="_blank" rel="noreferrer"><FaRegNewspaper aria-hidden="true" /> {t("idealFive.source")}</a>
    </header>

    {(currentWeek.isPending || history.isPending || (isAdmin && (adminWeeks.isPending || players.isPending || clubs.isPending))) && <Loader label={t("loading.app")} />}
    {(currentWeek.isError || history.isError || (isAdmin && (adminWeeks.isError || players.isError || clubs.isError))) && <p className="state-card" role="alert">{t("error.generic")}</p>}

    {weeks.length > 0 && <label className="ideal-five-round-picker">{t("idealFive.selectRound")}
      <select value={selectedWeekId} onChange={event => setSelectedWeekId(event.target.value)}>
        {weeks.map(item => <option key={item.id} value={item.id}>{t("idealFive.roundOption", { number: item.number })}</option>)}
      </select>
    </label>}

    {isAdmin && selectedWeekId && <section className="ideal-five-editor" aria-label={t("idealFive.adminHelp")}>
      <p>{t("idealFive.adminHelp")}</p>
      <div className="ideal-five-editor__slots">
        {slots.map(slot => {
          const available = (players.data ?? []).filter(player => player.role === slot.role && player.position === (slot.goalkeeper ? "GOALKEEPER" : "FIELD_PLAYER") && (!clubFilters[slot.id] || player.clubId === clubFilters[slot.id]) && (player.id === draft[slot.id] || !Object.values(draft).includes(player.id)));
          return <fieldset className="ideal-five-editor__slot" key={slot.id}>
            <legend>{t(slot.key)}</legend>
            <label>{t("idealFive.chooseClub")}
              <select value={clubFilters[slot.id] ?? ""} onChange={event => setClubFilters(current => ({ ...current, [slot.id]: event.target.value }))}>
                <option value="">{t("player.allClubs")}</option>
                {(clubs.data ?? []).map(club => <option value={club.id} key={club.id}>{club.name}</option>)}
              </select>
            </label>
            <label>{t("idealFive.choosePlayer")}
              <select value={draft[slot.id] ?? ""} onChange={event => setDraft(current => ({ ...current, [slot.id]: event.target.value }))}>
                <option value="">{t("idealFive.choosePlayer")}</option>
                {available.map(player => <option key={player.id} value={player.id}>#{player.displayNumber ?? player.number} · {player.name} · {player.club?.name}</option>)}
              </select>
            </label>
          </fieldset>;
        })}
      </div>
      {!savingReady && <p className="ideal-five-editor__hint">{t("idealFive.incomplete")}</p>}
      <button className="button" type="button" disabled={!savingReady || save.isPending} onClick={() => save.mutate()}>{save.isPending ? t("idealFive.saving") : t("idealFive.save")}</button>
    </section>}

    <section className="ideal-five-field" aria-label={heading}>
      {slots.map(slot => <IdealPlayerCard key={slot.id} entry={chosenBySlot.get(slot.id)} label={t(slot.key)} />)}
    </section>
  </div>;
}
