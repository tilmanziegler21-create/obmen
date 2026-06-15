# CryptoBull

Telegram Mini App для обмена `EUR ⇄ USDT` с premium dark UI, ручным управлением лимитами по городам и уведомлениями о заявках в Telegram.

## Стек

- `React`
- `TypeScript`
- `Vite`
- `TailwindCSS`
- `Zustand`
- `Telegram Web Apps SDK`

## Что Уже Есть

- Главный экран обмена `EUR -> USDT` и `USDT -> EUR`
- Лимит обмена `500 EUR`
- Ручное управление резервом наличных по городам
- Скрытая админка `/admin` с доступом по `VITE_ADMIN_IDS`
- Уведомления о новых заявках через Telegram Bot API
- Мультиязычность `RU / EN / UK / DE`

## Переменные Окружения

Скопируй `.env.example` в `.env` и заполни значения:

```env
VITE_BOT_TOKEN=1234567890:your_bot_token
VITE_CHAT_ID=-1001234567890
VITE_ADMIN_IDS=123456789,987654321
```

## Локальный Запуск

```bash
npm install
npm run dev
```

## Проверка

```bash
npm run lint
npm run check
```

## Деплой

Проект подготовлен под статический деплой. Для Render используется `render.yaml`.
