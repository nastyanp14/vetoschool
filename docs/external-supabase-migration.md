# Vetoschool: миграция с Lovable Cloud на внешний Supabase

Аудит выполнен по текущему коду. Production на Lovable Cloud **не тронут**, переключения не сделано.

## B. Найденные зависимости от backend

| Слой | Где | Зависимость |
| --- | --- | --- |
| Клиент БД/Auth | `src/integrations/supabase/client.ts` | только `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` — хардкода нет, готово к смене проекта |
| Worker (SSR-мета, Stripe-хелперы) | `src/worker.ts`, `src/lib/stripeCheckoutServer.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (только server-side, в бандл не попадает) |
| Storage | `src/lib/content.ts` (`content`), `src/lib/workbooks.ts` (`workbook-assets`), `src/lib/cardAudio.ts` (`lesson-audio`), `src/lib/avatarUrl.ts` + `src/lib/teachers.ts` (`avatars`) | обращение по **имени бакета и относительному пути**, домен не хардкодится → после переноса файлов ссылки останутся валидными |
| Edge Functions | `supabase/functions/*` | вызовы из фронта через `supabase.functions.invoke` (без путей `/api/...`) |
| Cron | `supabase/migrations/20260805014116_*.sql` | `cron.schedule('telegram-process-due')` c **хардкоженным URL старого проекта** — нужно перезаписать (см. §I) |
| Email | `supabase/functions/auth-email-hook`, `process-email-queue` | `LOVABLE_API_KEY` + `npm:@lovable.dev/email-js` — **работает только внутри Lovable Cloud**, это главный блокер (см. §D) |
| DB-функции | `email_queue_dispatch()`, `email_queue_wake()` | внутри тела хардкожен URL старого проекта + vault-секрет `email_queue_service_role_key` |

## C. Что уже готово

- Схема `public`, данные, auth-пользователи, profiles/UUID перенесены; миграция `dictionary_words.image_url` применена.
- Клиентский код полностью работает через env-переменные — код менять не нужно.
- Все Storage-обращения используют относительные пути → после копирования файлов ничего в БД править не придётся.
- Edge Functions лежат в репозитории и деплоятся в новый проект как есть.
- Добавлен скрипт переноса Storage: `scripts/migrate-storage.mjs`.
- Добавлен шаблон cron для нового проекта: `scripts/new-supabase-cron.sql`.

## D. Что ещё надо перенести / решить

1. **Файлы Storage**: `content`, `workbook-assets`, `lesson-audio` (bucket `avatars` пустой, `database_export_24_08_26` не переносим).
2. **Storage RLS-политики и настройки бакетов** — они в миграциях; если бэкап их не принёс, применить миграции `20260704002544`, `20260707010609`, `20260711001000_lesson_audio_storage`, `20260723090000_teacher_avatars_storage`, `20260805161921`, `20260805162500`.
3. **Email**: `@lovable.dev/email-js` вне Lovable Cloud недоступен. Варианты: (a) оставить письма на Lovable Cloud временно, (b) переписать `process-email-queue` и `auth-email-hook` на Resend/SendPulse SMTP. Требуется ваше решение — я не менял этот код.
4. **pg_cron / pg_net + vault-секреты** в новом проекте.
5. **Auth-настройки нового проекта**: Site URL, Redirect URLs, Google OAuth, шаблоны письма/Auth Hook.
6. **Stripe и Telegram webhook URL** — переставить на новый домен функций (§J).

## E. Изменения кода

- Кода фронта менять не нужно (всё на env). Обновлён только `.env.example` с полным перечнем переменных.
- После переключения: заменить в `.env` три `VITE_SUPABASE_*` значения на новые (URL, publishable/anon key, project id). Service role key — только в секретах Edge Functions / Cloudflare, никогда в `VITE_*`.
- В новом проекте пересоздать cron из `scripts/new-supabase-cron.sql` (URL нового проекта).

## F. Migration scripts

```bash
# сначала прогон без записи
DRY_RUN=1 \
OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
node scripts/migrate-storage.mjs

# реальный перенос (идемпотентный, повторный запуск догоняет остаток)
OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
node scripts/migrate-storage.mjs
```

Скрипт: рекурсивно обходит папки, сохраняет пути/UUID-папки/имена/MIME, создаёт бакет с теми же настройками приватности, пропускает уже существующие файлы того же размера, ничего не удаляет из старого Storage, печатает лог и итог.

## G. Secrets для нового Supabase

Нужны (Edge Functions → Secrets):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (новый — сгенерируется при создании нового endpoint)
- `STRIPE_PORTAL_CONFIGURATION_ID`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID` (при необходимости `TELEGRAM_ADMIN_CHAT_IDS`, `TELEGRAM_BOT_USERNAME`)
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_CRON_SECRET`
- `ELEVENLABS_API_KEY`
- `APP_URL` (`https://vetoschool.eu`)
- `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET` (+ `SENDPULSE_FROM_EMAIL`, `SENDPULSE_FROM_NAME`, `SENDPULSE_EMAIL_ENDPOINT`) — если письма уходят на SendPulse
- `TRIAL_BOOKING_ALLOWED_ORIGINS` (опционально)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет сам.

Не нужны: `LOVABLE_API_KEY`, `LOVABLE_SEND_URL` (только Lovable Email), `STRIPE_PUBLISHABLE_KEY` (публичный, живёт в фронте), `GOOGLE_SEARCH_CONSOLE_API_KEY` (это интеграция Lovable, к backend не относится).

## H. Edge Functions к деплою в новый проект

| Функция | Вызывается | Secrets | verify_jwt |
| --- | --- | --- | --- |
| `create-checkout-session` | фронт (`src/lib/stripe.ts`) | Stripe | true |
| `create-portal-session` | фронт | Stripe, `STRIPE_PORTAL_CONFIGURATION_ID` | true |
| `create-refund` | админка | Stripe | true |
| `stripe-webhook` | Stripe | Stripe, SendPulse, Telegram, `APP_URL` | false |
| `telegram-notifications` | фронт + cron | Telegram, `TELEGRAM_CRON_SECRET`, `APP_URL` | false |
| `telegram-webhook` | Telegram Bot API | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | false |
| `submit-trial-booking` | публичная форма | — | false |
| `generate-card-audio` | фронт (`src/lib/cardAudio.ts`) | `ELEVENLABS_API_KEY` | true |
| `admin-delete-user` | админка | — | true |
| `auth-email-hook` | Auth Hook | `LOVABLE_API_KEY` → требует замены провайдера | false |
| `process-email-queue` | cron/триггер | `LOVABLE_API_KEY` → требует замены провайдера | true |

`supabase/config.toml` содержит `project_id` старого проекта — при деплое через CLI используйте `supabase link --project-ref <новый ref>`.

## I. Cron / Jobs

1. `telegram-process-due` — каждую минуту, POST на `/functions/v1/telegram-notifications` с заголовком `x-cron-secret` из vault (`telegram_cron_secret`).
2. `process-email-queue` — не постоянный: включается триггером `email_queue_wake` на pgmq-очередях и снимается `email_queue_dispatch()`, когда очередь пуста. Внутри обеих функций URL старого проекта → переписать под новый ref, а также пересоздать vault-секрет `email_queue_service_role_key`.

SQL для нового проекта: `scripts/new-supabase-cron.sql`.

## J. Порядок переключения

1. Прогнать `scripts/migrate-storage.mjs` (DRY_RUN → реальный запуск), проверить количество объектов в каждом бакете.
2. Применить/проверить Storage-политики и все миграции, которых нет в бэкапе.
3. Завести секреты из §G, задеплоить функции из §H (`supabase functions deploy <name>`).
4. Включить `pg_cron`/`pg_net`, применить `scripts/new-supabase-cron.sql` с новым ref.
5. Настроить Auth: Site URL и Redirect URLs (`https://vetoschool.eu`, `.../auth/callback`, превью-домен), Google provider (client id/secret + новый redirect в Google Console), шаблоны password reset / email confirmation, Auth Hook на `auth-email-hook` (после решения по email-провайдеру).
6. Проверить роли и RLS: `user_roles`, `has_role`, политики admin/teacher/student, а также `GRANT`ы на таблицах `public`.
7. Поднять **тестовую** сборку (отдельный `.env` c новыми `VITE_SUPABASE_*`) и проверить: логин ученика/учителя/админа, уроки и интерактив, Storage (картинки, аудио, воркбуки), Stripe в test-режиме, Telegram-привязку родителя.
8. Stripe: создать новый webhook endpoint `https://<new-ref>.supabase.co/functions/v1/stripe-webhook`, положить новый `STRIPE_WEBHOOK_SECRET`, проверить checkout → активация подписки → отмена/продление → refund. Старый endpoint пока оставить активным.
9. Telegram: `setWebhook` на `https://<new-ref>.supabase.co/functions/v1/telegram-webhook` с `secret_token` = `TELEGRAM_WEBHOOK_SECRET` (у бота один webhook — этот шаг фактически и есть точка переключения, делать последним).
10. Переключить production `.env` / Cloudflare env на новый проект, задеплоить фронт, снять старый Stripe endpoint, и только затем гасить Lovable Cloud.

### URL, которые меняются

- Stripe webhook: `https://<old-ref>.supabase.co/functions/v1/stripe-webhook` → `https://<new-ref>...`
- Telegram webhook: `.../functions/v1/telegram-webhook`
- Cron `net.http_post` URL в `telegram-process-due`, `email_queue_dispatch()`, `email_queue_wake()`
- Google OAuth redirect: `https://<new-ref>.supabase.co/auth/v1/callback`
- Supabase Auth Site URL / Redirect URLs
