const fs=require('fs');function edit(f,fn){fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')));}
edit('frontend/src/contexts/LocaleContext.tsx',s=>s.replace('const spanish = {','const spanish = {\n  "matches.remove": "Eliminar partido sin publicar",\n  "matches.removeConfirm": "¿Eliminar este partido y su borrador?",').replace('const ukrainian: Record<TranslationKey, string> = {','const ukrainian: Record<TranslationKey, string> = {\n  "matches.remove": "Видалити неопублікований матч",\n  "matches.removeConfirm": "Видалити цей матч і його чернетку?",').replace('const english: Record<TranslationKey, string> = {','const english: Record<TranslationKey, string> = {\n  "matches.remove": "Delete unpublished match",\n  "matches.removeConfirm": "Delete this match and its draft?",'));
edit('frontend/src/services/api.ts',s=>s.replace('export const api = {','export const api = {\n  deleteMatch: (id: string) => request<{ ok: boolean }>(`/matches/${id}`, { method: "DELETE" }),'));
edit('backend/src/routes/matches.ts',s=>s.replace('export default router;',`router.delete("/:id", requireAdmin, asyncRoute(async (req, res) => {
 const id = z.string().cuid().parse(req.params.id);
 await inTransaction(async tx => {
  const match = await tx.match.findUnique({ where: { id }, include: { gameweek: true } });
  if (!match) throw new ApiError(404, "MATCH_NOT_FOUND");
  if (match.publishedAt || match.gameweek.status === "COMPLETED") throw new ApiError(409, "MATCH_LOCKED");
  await audit(tx, req.auth!.userId, "PLAYER_STATS_UPDATED", "Match", id, match, { deleted: true });
  await tx.match.delete({ where: { id } });
 });
 res.json({ ok: true });
}));
export default router;`));
edit('frontend/src/pages/AdminMatchesPage.tsx',s=>s.replace('const { t } = useLocale(); const client = useQueryClient();','const { t } = useLocale(); const client = useQueryClient(); const navigate = useNavigate();').replace('const update = (playerId:', 'const remove = useMutation({ mutationFn: () => api.deleteMatch(data.match.id), onSuccess: () => { setDirty(false); void client.invalidateQueries(); navigate(`/admin/matches?week=${data.match.gameweekId}`); }, onError: e => toast.error(e.message) });\n  const update = (playerId:').replace('<fieldset disabled={locked || save.isPending}', '<fieldset disabled={locked || save.isPending || remove.isPending}').replace('<div className="match-save-bar"><p>','<div className="match-save-bar">{!data.match.publishedAt && <button type="button" className="button button--secondary" onClick={() => { if (window.confirm(t("matches.removeConfirm"))) remove.mutate(); }}>{t("matches.remove")}</button>}<p>'));
