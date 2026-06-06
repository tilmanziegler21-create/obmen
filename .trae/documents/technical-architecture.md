## 1. Архитектурный дизайн
```mermaid
graph TD
    subgraph Frontend["Telegram Mini App (React)"]
        A["UI Компоненты (Tailwind)"]
        B["Telegram Web Apps SDK"]
        C["API Клиент (Axios/Fetch)"]
    end
    subgraph Backend["Backend (Node.js/FastAPI)"]
        D["API Endpoints"]
        E["Telegram Bot Service"]
    end
    subgraph Data["База данных"]
        F["PostgreSQL / Redis"]
    end
    A --> B
    A --> C
    C --> D
    D --> E
    D --> F
```

## 2. Описание технологий
- Frontend: React@18 + TailwindCSS@3 + Vite + Telegram Web Apps SDK (@twa-dev/sdk).
- Инструмент инициализации: vite (React + TypeScript).
- Backend (рекомендуемый, моки на клиенте для прототипа): Node.js (Express/FastAPI), PostgreSQL.
- Интеграция: Telegram Bot API для уведомлений администраторов.

## 3. Определение маршрутов (Frontend)
| Маршрут | Назначение |
|---------|------------|
| `/` | Главный экран: выбор направления обмена и города |
| `/calculator` | Экран калькулятора обмена |
| `/checkout` | Экран ввода реквизитов и подтверждения заявки |

## 4. Определение API (Backend)
- `POST /api/auth/verify` - Валидация Telegram InitData.
- `GET /api/cities` - Получение списка городов и их лимитов (USD, EUR).
- `GET /api/rates` - Получение актуального курса валют (USDT/USD, USDT/EUR).
- `POST /api/orders` - Создание новой заявки на обмен.

## 5. Диаграмма архитектуры сервера
```mermaid
graph TD
    A["Controller (API Routes)"] --> B["Service (Business Logic)"]
    B --> C["Telegram Service (Уведомления)"]
    B --> D["Repository (DB Access)"]
    D --> E["PostgreSQL"]
```

## 6. Модель данных
### 6.1 ER Диаграмма
```mermaid
erDiagram
    CITY {
        int id PK
        string name
        boolean is_active
        float limit_usd
        float limit_eur
    }
    ORDER {
        int id PK
        string user_id
        string username
        string type
        string city_name
        float amount_in
        string currency_in
        float amount_out
        string currency_out
        string network
        string wallet_address
        string status
    }
```
