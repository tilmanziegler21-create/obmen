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
