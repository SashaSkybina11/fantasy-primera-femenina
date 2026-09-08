const fs=require('fs'); const edit=(p,f)=>fs.writeFileSync(p,f(fs.readFileSync(p,'utf8')));
edit('backend/tests/scoring-prices.test.mjs',s=>s.replace('{ ...stats, ...create }','{ ...stats, adjustmentPoints: 0, ...create }'));
const errors = {
 'Пользователь не найден':['No se encontró al usuario.','Користувача не знайдено.'],
 'Некорректный диапазон дат тура':['Las fechas de la jornada no son válidas.','Некоректні дати туру.'],
 'Тур или игрок не найден':['No se encontró la jornada o la jugadora.','Тур або гравчиню не знайдено.'],
 'Сначала повторно откройте завершённый тур':['Primero vuelve a abrir la jornada finalizada.','Спочатку повторно відкрийте завершений тур.'],
 'Укажите причину корректировки':['Indica el motivo del ajuste.','Вкажіть причину коригування.'],
 'Тур не найден':['No se encontró la jornada.','Тур не знайдено.'],
 'Тур не завершён':['La jornada todavía no ha finalizado.','Тур ще не завершено.'],
 'Тур или пользователь не найден':['No se encontró la jornada o el usuario.','Тур або користувача не знайдено.'],
 'Нельзя удалить собственный аккаунт администратора':['No puedes eliminar tu propia cuenta de administración.','Не можна видалити власний обліковий запис адміністратора.'],
 'Не удалось создать код приглашения':['No se pudo crear el código de invitación.','Не вдалося створити код запрошення.'],
 'Unsupported image format':['El formato de imagen no es compatible.','Формат зображення не підтримується.'],
 'Текущий пароль указан неверно':['La contraseña actual es incorrecta.','Поточний пароль неправильний.'],
 'Клуб не найден':['No se encontró el club.','Клуб не знайдено.'],
 'Некорректный Instagram':['Comprueba el nombre de Instagram.','Перевірте ім’я в Instagram.'],
 'Введите WhatsApp в международном формате':['Introduce WhatsApp en formato internacional.','Введіть WhatsApp у міжнародному форматі.'],
 'Недействительный токен':['Vuelve a iniciar sesión.','Увійдіть знову.'],
};
edit('frontend/src/services/api.ts',s=>s.replace('const apiMessages: Record<string, { es: string; uk: string }> = {','const apiMessages: Record<string, { es: string; uk: string }> = {\n'+Object.entries(errors).map(([k,[es,uk]])=>`  ${JSON.stringify(k)}: ${JSON.stringify({es,uk})},`).join('\n')));
const keys={
 'brand.title':['Fantasy Primera División Fútbol Sala Femenino','Фентезі Першого дивізіону жіночого футзалу'],
 'competition.title':['Primera División Fútbol Sala Femenino','Перший дивізіон жіночого футзалу'],
 'auth.emailPlaceholder':['nombre@ejemplo.es','ім’я@приклад.ua'],
 'validation.invalid':['Comprueba el valor de este campo.','Перевірте значення цього поля.'],
};
edit('frontend/src/contexts/LocaleContext.tsx',s=>s.replace('const spanish = {','const spanish = {\n'+Object.entries(keys).map(([k,v])=>`  "${k}": ${JSON.stringify(v[0])},`).join('\n')).replace('const ukrainian: Record<TranslationKey, string> = {','const ukrainian: Record<TranslationKey, string> = {\n'+Object.entries(keys).map(([k,v])=>`  "${k}": ${JSON.stringify(v[1])},`).join('\n')));
for(const p of ['HomePage','CalendarPage','ClubPage','TeamsPage','AuthPage','FriendLeaguesPage'])edit(`frontend/src/pages/${p}.tsx`,s=>s.replace('Fantasy Primera División<br />Fútbol Sala Femenino','{t("brand.title")}').replace('>Fantasy Primera División Fútbol Sala Femenino<','>{t("brand.title")}<').replace(/>Primera División (?:Fútbol Sala Femenino|Femenina)</g,'>{t("competition.title")}<').replace('>Fantasy<','>{t("home.eyebrow")}<').replace('placeholder="you@example.com"','placeholder={t("auth.emailPlaceholder")}'));
edit('frontend/src/layouts/AppShell.tsx',s=>s.replace(/const projectName = \([\s\S]*?\);/,'').replaceAll('{projectName}','{t("brand.title")}'));
edit('frontend/src/contexts/LocaleContext.tsx',s=>s.replace('import { createContext','import toast from "react-hot-toast";\nimport { createContext').replace('    document.documentElement.lang = locale;', `    toast.dismiss();
    const invalid = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) input.setCustomValidity(dictionaries[locale]["validation.invalid"]);
    };
    const clear = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) input.setCustomValidity("");
    };
    document.querySelectorAll("input, textarea, select").forEach(input => (input as HTMLInputElement).setCustomValidity(""));
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", clear, true);
    document.documentElement.lang = locale;`).replace('    localStorage.setItem(storageKey, locale);','    localStorage.setItem(storageKey, locale);\n    return () => { document.removeEventListener("invalid", invalid, true); document.removeEventListener("input", clear, true); };'));
