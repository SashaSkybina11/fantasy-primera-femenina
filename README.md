# Fantasy Primera División Femenina

Закрытая fantasy-игра для небольшой группы друзей по женской испанской футзальной Primera División Femenina. Интерфейс полностью русскоязычный; названия испанских клубов и имена игроков сохраняются в оригинальном написании.

## Технологии

- Frontend: React, TypeScript, Vite, React Router, TanStack Query.
- Backend: Node.js, Express, TypeScript, REST API, Prisma.
- Данные: PostgreSQL и Prisma seed.
- Защита: bcrypt, JWT, серверная валидация бюджета и состава.

## Требования

- Node.js 20+ и npm 10+.
- Запущенный PostgreSQL 15+.

## Установка

1. Установите все зависимости из корня проекта:

   ```bash
   npm install
   ```

2. Скопируйте файл окружения и задайте строку подключения PostgreSQL:

   ```bash
   Copy-Item .env.example .env
   Copy-Item .env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

3. В `backend/.env` задайте корректные `DATABASE_URL` и длинный случайный `JWT_SECRET`.

4. Создайте таблицы и запишите стартовые данные:

   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Запустите backend и frontend одной командой:

   ```bash
   npm run dev
   ```

Откройте [http://localhost:5173](http://localhost:5173). API по умолчанию работает на `http://localhost:4000`.

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Запустить Vite и Express в режиме разработки |
| `npm run build` | Собрать frontend и backend |
| `npm run db:generate` | Сгенерировать Prisma Client |
| `npm run db:migrate` | Создать/применить Prisma migration |
| `npm run db:seed` | Добавить 16 клубов, игроков Futsi и STV Roldán, основную лигу |

## Что реализовано

- Регистрация, вход, выход, восстановление JWT-сессии и защищённые маршруты.
- Автоматическое создание команды с бюджетом €50 000 и membership в основной лиге.
- Профиль, редактирование имени и названия команды, локальная загрузка/удаление аватара. Хранилище изолировано маршрутом профиля и может быть заменено на Cloudinary/S3.
- 16 реальных клубов; составы Futsi Atlético Navalcarnero и STV Roldán находятся в Prisma seed, остальные клубы корректно показывают пустой состав.
- Выбор игроков через фильтрацию по команде, позиции и имени; сервер атомарно проверяет бюджет, лимит и дубликаты.
- Основной состав, запасные, капитан и валидация корректной футзальной формации при сохранении.
- Просмотр участников лиги, чужих команд и сравнение составов.
- Адаптивная desktop sidebar / mobile bottom navigation и сохранение светлой/тёмной темы.

## Архитектура

```text
frontend/   React-клиент, страницы, контексты, компоненты, API-сервис
backend/    Express API, middleware, Prisma schema, seed-данные
```

Игровые цены и реальные игроки не дублируются во frontend: интерфейс запрашивает их у REST API.
