const fs = require('fs');
const file = 'frontend/src/contexts/LocaleContext.tsx';
let s = fs.readFileSync(file,'utf8');
const rows = {
 title:['Resultados','Результати','Results'], admin:['Partidos y puntos','Матчі та очки','Matches and points'],
 intro:['Selecciona una jornada y abre el acta de un partido.','Оберіть тур і відкрийте протокол матчу.','Choose a gameweek and open a match report.'],
 create:['Añadir partido','Додати матч','Add match'], home:['Local','Господарі','Home'], away:['Visitante','Гості','Away'],
 kickoff:['Fecha y hora','Дата й час','Date and time'], unscheduled:['Horario pendiente','Час ще не визначено','Time to be confirmed'],
 empty:['Todavía no hay partidos en esta jornada.','У цьому турі ще немає матчів.','No matches in this gameweek yet.'],
 report:['Acta del partido','Протокол матчу','Match report'], pending:['Acta pendiente','Протокол готується','Report pending'],
 published:['Publicado','Опубліковано','Published'], draft:['Borrador','Чернетка','Draft'], edit:['Editar acta','Редагувати протокол','Edit report'],
 save:['Guardar borrador','Зберегти чернетку','Save draft'], publish:['Publicar y calcular puntos','Опублікувати й нарахувати очки','Publish and calculate points'],
 saved:['Borrador guardado. Los puntos no han cambiado.','Чернетку збережено. Очки не змінено.','Draft saved. Points are unchanged.'],
 done:['Acta publicada y puntos actualizados.','Протокол опубліковано, очки оновлено.','Report published and points updated.'],
 starters:['Quinteto inicial','Стартова п’ятірка','Starting five'], others:['Otras jugadoras','Інші гравчині','Other players'],
 count:['Titulares: {{count}}/5 · Porteras: {{keepers}}/1','Старт: {{count}}/5 · Воротарки: {{keepers}}/1','Starters: {{count}}/5 · Goalkeepers: {{keepers}}/1'],
 previous:['Usar el quinteto anterior','Взяти попередню стартову п’ятірку','Use previous starting five'],
 noPrevious:['No hay quinteto anterior disponible.','Попереднього стартового складу ще немає.','No previous starting five available.'],
 ownGoals:['Goles en propia puerta','Автоголи','Own goals'],
 ownHelp:['Los autogoles se suman al marcador rival, sin asignar un gol a otra jugadora.','Автоголи додаються до рахунку суперника, без зарахування гола іншій гравчині.','Own goals count toward the opponent’s score without crediting another player.'],
 points:['Puntos Fantasy','Fantasy-очки','Fantasy points'], breakdown:['Desglose de puntos','Розрахунок очок','Points breakdown'],
 back:['Volver a resultados','Назад до результатів','Back to results'], loading:['Cargando partidos…','Завантаження матчів…','Loading matches…'],
 error:['No se pudieron cargar los partidos.','Не вдалося завантажити матчі.','Could not load matches.'], retry:['Reintentar','Спробувати ще раз','Retry'],
 locked:['Jornada finalizada. Reábrela desde la gestión de puntos para editar el acta.','Тур завершено. Відкрийте його знову в керуванні очками, щоб змінити протокол.','Gameweek completed. Reopen it in points management to edit the report.'],
 legacy:['Correcciones y cierre de jornada','Коригування та завершення туру','Adjustments and gameweek completion'],
 dirty:['Hay cambios sin guardar.','Є незбережені зміни.','You have unsaved changes.'],
 leave:['¿Descartar los cambios sin guardar?','Відкинути незбережені зміни?','Discard unsaved changes?'],
 scoreHelp:['Para publicar: 5 titulares y 1 portera por equipo; los goles y autogoles deben coincidir con el marcador.','Для публікації: 5 стартових гравчинь і 1 воротарка в кожній команді; голи та автоголи мають відповідати рахунку.','To publish: 5 starters and 1 goalkeeper per team; goals and own goals must match the score.'],
 editorHelp:['Marca el quinteto y añade los eventos. Los puntos se calculan al publicar.','Позначте стартову п’ятірку та додайте події. Очки нараховуються під час публікації.','Select the starting five and add events. Points are applied when you publish.'],
 adjustment:['Ajuste','Коригування','Adjustment'], result:['Resultado del equipo','Результат команди','Team result'],
 hatTrick:['Bonus por hat-trick','Бонус за хет-трик','Hat-trick bonus'], cleanSheet:['Portería a cero','Сухий матч','Clean sheet'],
};
for (const [i, marker] of ['const spanish = {','const ukrainian: Record<TranslationKey, string> = {','const english: Record<TranslationKey, string> = {'].entries()) {
 s=s.replace(marker,marker+'\n'+Object.entries(rows).map(([k,v])=>'  '+JSON.stringify('matches.'+k)+': '+JSON.stringify(v[i])+',').join('\n'));
}
fs.writeFileSync(file,s);
const errors={
 MATCH_NOT_FOUND:['Partido o jornada no encontrado.','Матч або тур не знайдено.','Match or gameweek not found.'],
 MATCH_TEAMS:['Selecciona dos equipos diferentes.','Оберіть дві різні команди.','Select two different teams.'],
 MATCH_DUPLICATE:['Uno de estos equipos ya tiene un partido en esta jornada.','Одна з команд уже має матч у цьому турі.','One of these teams already has a match in this gameweek.'],
 MATCH_LOCKED:['Reabre la jornada antes de editar el partido.','Відкрийте тур знову перед редагуванням матчу.','Reopen the gameweek before editing this match.'],
 MATCH_STALE:['El acta ha cambiado. Recarga la página antes de guardar.','Протокол змінився. Оновіть сторінку перед збереженням.','The report has changed. Reload before saving.'],
 MATCH_ROSTER:['La plantilla ha cambiado. Recarga el editor.','Склад команди змінився. Оновіть редактор.','The roster has changed. Reload the editor.'],
 MATCH_STARTERS:['Selecciona 5 titulares y una portera por equipo.','Оберіть 5 стартових гравчинь і одну воротарку в кожній команді.','Select 5 starters and one goalkeeper for each team.'],
 MATCH_SCORE:['Los goles y autogoles deben coincidir con el marcador.','Голи й автоголи мають відповідати рахунку.','Goals and own goals must match the score.'],
 MATCH_USE_EDITOR:['Edita estas estadísticas desde el acta del partido.','Редагуйте цю статистику через протокол матчу.','Edit these statistics in the match report.'],
};
const api='frontend/src/services/api.ts'; s=fs.readFileSync(api,'utf8');
s=s.replace('const apiMessages: Record<string, Record<Locale, string>> = {','const apiMessages: Record<string, Record<Locale, string>> = {\n'+Object.entries(errors).map(([k,v])=>'  '+k+': '+JSON.stringify({es:v[0],uk:v[1],en:v[2]})+',').join('\n'));
s='import type { MatchRecord, MatchEditorData, MatchProtocol } from "../types/matches";\n'+s;
s=s.replace('export const api = {',`export const api = {
  matchWeeks: () => request<Gameweek[]>("/matches/weeks"),
  matches: (week: string) => request<MatchRecord[]>(\`/matches?gameweekId=\${week}\`),
  match: (id: string) => request<MatchRecord>(\`/matches/\${id}\`),
  matchEditor: (id: string) => request<MatchEditorData>(\`/matches/\${id}/editor\`),
  createMatch: (data: { gameweekId: string; homeId: string; awayId: string; kickoffAt: string | null }) => request<MatchRecord>("/matches", { method: "POST", body: JSON.stringify(data) }),
  saveMatch: (id: string, data: { protocol: MatchProtocol; version: number; publish: boolean; kickoffAt: string | null }) => request<MatchRecord>(\`/matches/\${id}/editor\`, { method: "PUT", body: JSON.stringify(data) }),`);
fs.writeFileSync(api,s);
const calendar='frontend/src/pages/CalendarPage.tsx';s=fs.readFileSync(calendar,'utf8').replace(/^const rfefResultsUrl.*\r?\n/m,'').replace(/    \{\s*title: t\("calendar.resultsTitle"\),[\s\S]*?href: rfefResultsUrl,\s*\},\r?\n/,'');fs.writeFileSync(calendar,s);
