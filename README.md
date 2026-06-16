# CryptoBull

Telegram Mini App для обмена `EUR ⇄ USDT` с premium dark UI, ручным управлением лимитами по городам и уведомлениями о заявках в Telegram.

## Стек

- `React`
- `TypeScript`
- `Vite`
- `TailwindCSS`
- `Zustand`
- `Telegram Web Apps SDK`
- `Express`

## Что Уже Есть

- Главный экран обмена `EUR -> USDT` и `USDT -> EUR`
- Лимит обмена `500 EUR`
- Ручное управление резервом наличных по городам
- Скрытая админка `/admin` с доступом по `VITE_ADMIN_IDS`
- Серверный endpoint `/api/orders` для отправки заявок в Telegram
- Базовая проверка `Telegram WebApp initData` на backend
- Мультиязычность `RU / EN / UK / DE`

## Переменные Окружения

Скопируй `.env.example` в `.env` и заполни значения:

```env
BOT_TOKEN=1234567890:your_bot_token
CHAT_ID=-1001234567890
PUBLIC_BASE_URL=https://your-render-domain.onrender.com
REQUIRE_TELEGRAM_INIT=false
ADMIN_IDS=123456789,987654321
VITE_ADMIN_IDS=123456789,987654321
```

## Локальный Запуск

```bash
npm install
npm run dev
```

`npm run dev` теперь поднимает сразу:

- Vite-клиент
- Node/Express backend на `http://localhost:3001`

## Простая схема по городам

- У каждого города в админке есть свой `Telegram group chat id`
- Если у города задан свой `groupChatId`, заявка уходит именно в эту группу
- Если поле пустое, используется общий `CHAT_ID`
- Под каждой заявкой бот добавляет кнопки:
- `В работу`
- `Готово`
- `Отклонить`
- Нажатие кнопки в группе обновляет статус заявки и синхронизирует его в приложении

## Telegram webhook

- Для работы кнопок в группах нужен публичный `PUBLIC_BASE_URL`
- После деплоя можно вызвать:

```bash
curl -X POST https://your-render-domain.onrender.com/api/telegram/set-webhook
```

- Либо сервер сам попытается установить webhook при старте, если заданы `BOT_TOKEN` и `PUBLIC_BASE_URL`

## Проверка

```bash
npm run lint
npm run check
npm run build
```

## Production

```bash
npm run build
npm run start
```

## Деплой

Проект переведен на Node web service деплой. Для Render используется `render.yaml`, backend раздает `dist` и обрабатывает `/api/*`.
