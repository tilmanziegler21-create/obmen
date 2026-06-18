import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3001);
const distDir = path.join(__dirname, 'dist');
const dataDir = path.join(__dirname, 'data');
const statePath = path.join(dataDir, 'state.json');

const botToken = process.env.BOT_TOKEN || process.env.VITE_BOT_TOKEN || '';
const fallbackChatId = process.env.CHAT_ID || process.env.VITE_CHAT_ID || '';
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const requireTelegramInit = process.env.REQUIRE_TELEGRAM_INIT === 'true';
const adminIds = new Set(
  (process.env.ADMIN_IDS || process.env.VITE_ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

// #region debug-point A:reporter
function reportDebugEvent(runId, hypothesisId, location, msg, data = {}) {
  try {
    const envPath = path.join(__dirname, '.dbg', 'save-state-failure.env');
    let debugUrl = 'http://127.0.0.1:7777/event';
    let sessionId = 'save-state-failure';
    if (fs.existsSync(envPath)) {
      const envRaw = fs.readFileSync(envPath, 'utf8');
      debugUrl = envRaw.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugUrl;
      sessionId = envRaw.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || sessionId;
    }
    fetch(debugUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, runId, hypothesisId, location, msg, data, ts: Date.now() }),
    }).catch(() => {});
  } catch {}
}
// #endregion

app.use(express.json({ limit: '256kb' }));

function buildTelegramSecret(botTokenValue) {
  return crypto.createHmac('sha256', 'WebAppData').update(botTokenValue).digest();
}

function verifyTelegramInitData(initData, botTokenValue) {
  if (!initData || !botTokenValue) {
    return false;
  }

  const searchParams = new URLSearchParams(initData);
  const providedHash = searchParams.get('hash');
  if (!providedHash) {
    return false;
  }

  const dataCheckString = [...searchParams.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = buildTelegramSecret(botTokenValue);
  const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  if (providedHash.length !== calculatedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(calculatedHash));
}

function getTelegramUserFromInitData(initData) {
  if (!initData) {
    return null;
  }

  const searchParams = new URLSearchParams(initData);
  const rawUser = searchParams.get('user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  if (!requireTelegramInit) {
    return next();
  }

  const telegramInitData = req.headers['x-telegram-init-data'] || req.body?.telegramInitData;
  if (!telegramInitData) {
    return res.status(401).json({ error: 'Telegram initData is required' });
  }

  const isVerified = verifyTelegramInitData(telegramInitData, botToken);
  if (!isVerified) {
    return res.status(401).json({ error: 'Invalid Telegram initData' });
  }

  const telegramUser = getTelegramUserFromInitData(telegramInitData);
  const userId = telegramUser?.id ? String(telegramUser.id) : null;
  const isAdmin = userId ? adminIds.has(userId) : false;

  if (!isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

function ensureString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getDefaultCities() {
  return [
    { id: '1', cityKey: 'berlin', isActive: true, limitEUR: 500 },
    { id: '2', cityKey: 'munich', isActive: true, limitEUR: 500 },
    { id: '3', cityKey: 'hamburg', isActive: true, limitEUR: 500 },
    { id: '4', cityKey: 'frankfurt', isActive: true, limitEUR: 500 },
    { id: '5', cityKey: 'cologne', isActive: true, limitEUR: 500 },
    { id: '6', cityKey: 'dusseldorf', isActive: true, limitEUR: 500 },
    { id: '7', cityKey: 'stuttgart', isActive: true, limitEUR: 500 },
    { id: '8', cityKey: 'leipzig', isActive: true, limitEUR: 500 },
    { id: '9', cityKey: 'dortmund', isActive: true, limitEUR: 500 },
    { id: '10', cityKey: 'essen', isActive: true, limitEUR: 500 },
    { id: '11', cityKey: 'bremen', isActive: true, limitEUR: 500 },
    { id: '12', cityKey: 'hannover', isActive: true, limitEUR: 500 },
    { id: '13', cityKey: 'nuremberg', isActive: true, limitEUR: 500 },
  ];
}

function createDefaultState() {
  return {
    cities: getDefaultCities(),
    rates: {
      EUR_USDT: 52.01 / 44.82,
      UAH_USDT: 1 / 44.82,
      EUR_UAH: 52.01,
    },
    rateUpdatedAt: new Date().toISOString(),
    orders: [],
    usdtReserve: 2500,
    antiPhishingCode: 'BULL',
  };
}

function normalizeState(rawState) {
  const defaults = createDefaultState();
  const raw = rawState && typeof rawState === 'object' ? rawState : {};

  return {
    cities: Array.isArray(raw.cities)
      ? raw.cities.map((city, index) => ({
          id: ensureString(city?.id) || defaults.cities[index]?.id || String(index + 1),
          cityKey: ensureString(city?.cityKey) || defaults.cities[index]?.cityKey || 'berlin',
          isActive: city?.isActive !== false,
          limitEUR: Number(city?.limitEUR) || 0,
        }))
      : defaults.cities,
    rates: {
      EUR_USDT: Number(raw.rates?.EUR_USDT) || defaults.rates.EUR_USDT,
      UAH_USDT: Number(raw.rates?.UAH_USDT) || defaults.rates.UAH_USDT,
      EUR_UAH: Number(raw.rates?.EUR_UAH) || defaults.rates.EUR_UAH,
    },
    rateUpdatedAt: ensureString(raw.rateUpdatedAt) || defaults.rateUpdatedAt,
    orders: Array.isArray(raw.orders)
      ? raw.orders.map((order) => ({
          ...order,
          id: ensureString(order?.id),
          createdAt: ensureString(order?.createdAt) || new Date().toISOString(),
          giveAsset: ensureString(order?.giveAsset) || (ensureString(order?.giveCurrency) === 'USDT' ? 'USDT' : ensureString(order?.giveCurrency) === 'UAH' ? 'UAH_CARD' : 'EUR_CASH'),
          managerName: ensureString(order?.managerName) || null,
          getAsset: ensureString(order?.getAsset) || (ensureString(order?.getCurrency) === 'USDT' ? 'USDT' : ensureString(order?.getCurrency) === 'UAH' ? 'UAH_CARD' : 'EUR_CASH'),
          antiPhishingCode: ensureString(order?.antiPhishingCode) || 'BULL',
          commissionPercent: Number(order?.commissionPercent) || 0,
          discountPercent: Number(order?.discountPercent) || 0,
          referralCodeUsed: ensureString(order?.referralCodeUsed) || null,
          cardNumber: ensureString(order?.cardNumber) || null,
          telegramChatId: ensureString(order?.telegramChatId) || null,
          telegramMessageId: Number(order?.telegramMessageId) || null,
          status: ['accepted', 'processing', 'ready', 'rejected'].includes(order?.status) ? order.status : 'accepted',
        }))
      : [],
    usdtReserve: Number(raw.usdtReserve) || defaults.usdtReserve,
    antiPhishingCode: ensureString(raw.antiPhishingCode) || defaults.antiPhishingCode,
  };
}

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readState() {
  ensureDataDir();

  if (!fs.existsSync(statePath)) {
    const defaults = createDefaultState();
    fs.writeFileSync(statePath, JSON.stringify(defaults, null, 2), 'utf8');
    return defaults;
  }

  try {
    const rawState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const normalized = normalizeState(rawState);
    fs.writeFileSync(statePath, JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
  } catch {
    const defaults = createDefaultState();
    fs.writeFileSync(statePath, JSON.stringify(defaults, null, 2), 'utf8');
    return defaults;
  }
}

function writeState(state) {
  ensureDataDir();
  // #region debug-point A:write-state-before
  reportDebugEvent('pre-fix', 'A', 'server.js:writeState:before', '[DEBUG] writeState start', {
    cities: Array.isArray(state?.cities) ? state.cities.length : null,
    orders: Array.isArray(state?.orders) ? state.orders.length : null,
    statePath,
  });
  // #endregion
  fs.writeFileSync(statePath, JSON.stringify(normalizeState(state), null, 2), 'utf8');
  // #region debug-point A:write-state-after
  reportDebugEvent('pre-fix', 'A', 'server.js:writeState:after', '[DEBUG] writeState success', {
    statePath,
    exists: fs.existsSync(statePath),
  });
  // #endregion
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unknown server error';
}

function getPublicState(state) {
  return {
    cities: state.cities,
    rates: state.rates,
    rateUpdatedAt: state.rateUpdatedAt,
    orders: state.orders,
    usdtReserve: state.usdtReserve,
    antiPhishingCode: state.antiPhishingCode,
  };
}

function normalizeOrderPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const direction =
    payload.direction === 'GIVE_USDT'
      ? 'GIVE_USDT'
      : payload.direction === 'GIVE_CASH'
        ? 'GIVE_CASH'
        : null;
  const giveAmount = ensureString(payload.giveAmount);
  const getAmount = ensureString(payload.getAmount);
  const rate = ensureString(payload.rate);

  if (!direction || !giveAmount || !getAmount || !rate) {
    return null;
  }

  return {
    direction,
    giveAsset: ensureString(payload.giveAsset) || (ensureString(payload.giveCurrency) === 'USDT' ? 'USDT' : ensureString(payload.giveCurrency) === 'UAH' ? 'UAH_CARD' : 'EUR_CASH'),
    cityId: ensureString(payload.cityId),
    city: ensureString(payload.city),
    cityKey: ensureString(payload.cityKey),
    giveAmount,
    giveCurrency: ensureString(payload.giveCurrency),
    getAsset: ensureString(payload.getAsset) || (ensureString(payload.getCurrency) === 'USDT' ? 'USDT' : ensureString(payload.getCurrency) === 'UAH' ? 'UAH_CARD' : 'EUR_CASH'),
    getAmount,
    getCurrency: ensureString(payload.getCurrency),
    rate,
    network: ensureString(payload.network) || null,
    wallet: ensureString(payload.wallet) || null,
    contact: ensureString(payload.contact) || null,
    cardNumber: ensureString(payload.cardNumber) || null,
    antiPhishingCode: ensureString(payload.antiPhishingCode) || 'BULL',
    userHandle: ensureString(payload.userHandle) || 'Unknown',
    commissionPercent: Number(payload.commissionPercent) || 0,
    discountPercent: Number(payload.discountPercent) || 0,
    referralCodeUsed: ensureString(payload.referralCodeUsed) || null,
    managerName: ensureString(payload.managerName) || null,
    userId: payload.userId ? String(payload.userId) : null,
  };
}

function formatStatus(status) {
  switch (status) {
    case 'processing':
      return 'В обработке';
    case 'ready':
      return 'Готово';
    case 'rejected':
      return 'Отклонено';
    default:
      return 'Принято';
  }
}

function formatAssetLabel(asset, fallbackCurrency) {
  switch (asset) {
    case 'EUR_CASH':
      return 'EUR наличные';
    case 'UAH_CARD':
      return 'UAH карта';
    case 'USDT':
      return 'USDT';
    default:
      return fallbackCurrency || '-';
  }
}

function formatDirection(order) {
  const left = formatAssetLabel(order.giveAsset, order.giveCurrency);
  const right = formatAssetLabel(order.getAsset, order.getCurrency);
  return `${left} -> ${right}`;
}

function formatTelegramOrderMessage(order, isVerified) {
  const routeDetails = [
    order.network ? `🔗 <b>Сеть:</b> ${order.network}` : null,
    order.wallet ? `💼 <b>Кошелек:</b> <code>${order.wallet}</code>` : null,
    order.cardNumber ? `💳 <b>Карта UAH:</b> <code>${order.cardNumber}</code>` : null,
    order.contact ? `📱 <b>Контакт:</b> ${order.contact}` : null,
  ].filter(Boolean).join('\n');
  const verificationLabel = isVerified ? 'verified' : 'not verified';
  const referralLabel = order.referralCodeUsed ? order.referralCodeUsed : 'none';

  return `
🚨 <b>Новая заявка на обмен</b>

#${order.id}
📍 <b>Статус:</b> ${formatStatus(order.status)}
🔄 <b>Направление:</b> ${formatDirection(order)}
🏙 <b>Город:</b> ${order.cityKey}
💰 <b>Отдают:</b> ${order.giveAmount} ${order.giveCurrency}
💸 <b>Получают:</b> ${order.getAmount} ${order.getCurrency}
📊 <b>Курс клиента:</b> 1 ${formatAssetLabel(order.giveAsset, order.giveCurrency)} = ${order.rate} ${order.getCurrency}
💎 <b>Комиссия:</b> ${order.commissionPercent.toFixed(1)}%
🎁 <b>Скидка:</b> ${order.discountPercent.toFixed(1)}%
🏷 <b>Рефкод:</b> ${referralLabel}

${routeDetails}

🛡 <b>Anti-Phishing:</b> <code>${order.antiPhishingCode}</code>
👤 <b>Клиент:</b> ${order.userHandle}
👨‍💼 <b>Менеджер:</b> ${order.managerName ?? '-'}
✅ <b>Telegram initData:</b> ${verificationLabel}
  `.trim();
}

function getOrderKeyboard(orderId) {
  return {
    inline_keyboard: [
      [
        { text: 'В работу', callback_data: `order:${orderId}:processing` },
        { text: 'Готово', callback_data: `order:${orderId}:ready` },
      ],
      [{ text: 'Отклонить', callback_data: `order:${orderId}:rejected` }],
    ],
  };
}

async function callTelegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    const errorMessage = typeof data.description === 'string' ? data.description : 'Telegram API error';
    throw new Error(errorMessage);
  }

  return data.result;
}

async function sendTelegramMessage(chatId, message, replyMarkup) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });
}

async function editTelegramMessage(order, isVerified) {
  if (!order.telegramChatId || !order.telegramMessageId) {
    return;
  }

  await callTelegram('editMessageText', {
    chat_id: order.telegramChatId,
    message_id: order.telegramMessageId,
    text: formatTelegramOrderMessage(order, isVerified),
    parse_mode: 'HTML',
    reply_markup: getOrderKeyboard(order.id),
  });
}

function answerCallbackQuery(callbackQueryId, text) {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

function applyOrderReservesOnCreate(state, order) {
  const nextState = structuredClone(state);

  if (order.direction === 'GIVE_CASH') {
    nextState.usdtReserve = Math.max(0, nextState.usdtReserve - Number(order.getAmount));
  } else {
    nextState.cities = nextState.cities.map((city) =>
      city.id === order.cityId
        ? { ...city, limitEUR: Math.max(0, city.limitEUR - Number(order.getAmount)) }
        : city,
    );
  }

  nextState.orders = [order, ...nextState.orders];
  return nextState;
}

function applyOrderStatusChange(state, orderId, status, managerName) {
  const nextState = structuredClone(state);
  const existingOrder = nextState.orders.find((order) => order.id === orderId);

  if (!existingOrder || existingOrder.status === status) {
    return nextState;
  }

  const wasActive = ['accepted', 'processing'].includes(existingOrder.status);
  const isActive = ['accepted', 'processing'].includes(status);
  const shouldReleaseReserve = wasActive && !isActive && status === 'rejected';
  const shouldReserveAgain = !wasActive && isActive && existingOrder.status === 'rejected';

  if (existingOrder.direction === 'GIVE_CASH') {
    if (shouldReleaseReserve) {
      nextState.usdtReserve += Number(existingOrder.getAmount);
    } else if (shouldReserveAgain) {
      nextState.usdtReserve = Math.max(0, nextState.usdtReserve - Number(existingOrder.getAmount));
    }
  } else {
    nextState.cities = nextState.cities.map((city) => {
      if (city.id !== existingOrder.cityId) {
        return city;
      }

      if (shouldReleaseReserve) {
        return { ...city, limitEUR: city.limitEUR + Number(existingOrder.getAmount) };
      }

      if (shouldReserveAgain) {
        return { ...city, limitEUR: Math.max(0, city.limitEUR - Number(existingOrder.getAmount)) };
      }

      return city;
    });
  }

  nextState.orders = nextState.orders.map((order) =>
    order.id === orderId
      ? {
          ...order,
          status,
          managerName: managerName !== undefined ? managerName : order.managerName,
        }
      : order,
  );

  return nextState;
}

async function ensureTelegramWebhook() {
  if (!botToken || !publicBaseUrl) {
    return;
  }

  try {
    await callTelegram('setWebhook', {
      url: `${publicBaseUrl}/api/telegram/webhook`,
      allowed_updates: ['callback_query'],
    });
  } catch (error) {
    console.error('Failed to set Telegram webhook', error);
  }
}

function getManagerNameFromTelegramUser(user) {
  if (!user) {
    return null;
  }

  if (typeof user.username === 'string' && user.username.trim()) {
    return `@${user.username.trim()}`;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || null;
}

app.get('/api/health', (_req, res) => {
  const state = readState();

  res.json({
    ok: true,
    service: 'cryptobull-api',
    hasBotToken: Boolean(botToken),
    hasChatId: Boolean(fallbackChatId),
    hasPublicBaseUrl: Boolean(publicBaseUrl),
    orders: state.orders.length,
  });
});

app.get('/api/bootstrap', (_req, res) => {
  res.json(getPublicState(readState()));
});

app.post('/api/admin/access', (req, res) => {
  const telegramInitData = ensureString(req.body?.telegramInitData);
  const telegramUser = getTelegramUserFromInitData(telegramInitData);
  const isVerified = telegramInitData ? verifyTelegramInitData(telegramInitData, botToken) : false;
  const userId = telegramUser?.id ? String(telegramUser.id) : null;
  const isAdmin = userId ? adminIds.has(userId) : false;

  res.json({
    ok: true,
    isVerified,
    isAdmin,
    userId,
  });
});

app.put('/api/admin/cities/:id', requireAdmin, (req, res) => {
  try {
    const state = readState();
    const city = state.cities.find((item) => item.id === req.params.id);
    // #region debug-point B:city-save-request
    reportDebugEvent('pre-fix', 'B', 'server.js:/api/admin/cities', '[DEBUG] city save request', {
      cityId: req.params.id,
      body: req.body,
      cityFound: Boolean(city),
    });
    // #endregion

    if (!city) {
      res.status(404).json({ error: 'City not found' });
      return;
    }

    if (req.body?.limitEUR !== undefined) {
      city.limitEUR = Math.max(0, Number(req.body.limitEUR) || 0);
    }
    if (req.body?.isActive !== undefined) {
      city.isActive = req.body.isActive !== false;
    }

    writeState(state);
    // #region debug-point B:city-save-response
    reportDebugEvent('pre-fix', 'B', 'server.js:/api/admin/cities', '[DEBUG] city save success response', {
      cityId: city.id,
      limitEUR: city.limitEUR,
      isActive: city.isActive,
    });
    // #endregion
    res.json({ ok: true, state: getPublicState(state) });
  } catch (error) {
    console.error('Failed to save city settings', error);
    // #region debug-point B:city-save-error
    reportDebugEvent('pre-fix', 'B', 'server.js:/api/admin/cities', '[DEBUG] city save error', {
      cityId: req.params.id,
      error: getErrorMessage(error),
    });
    // #endregion
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

app.post('/api/admin/cities', requireAdmin, (req, res) => {
  try {
    const state = readState();
    const newCityId = String(Date.now());
    const newCity = {
      id: newCityId,
      cityKey: ensureString(req.body?.cityKey) || 'new_city',
      isActive: true,
      limitEUR: 0,
    };
    state.cities.push(newCity);
    writeState(state);
    res.json({ ok: true, state: getPublicState(state) });
  } catch (error) {
    console.error('Failed to add city', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

app.delete('/api/admin/cities/:id', requireAdmin, (req, res) => {
  try {
    const state = readState();
    state.cities = state.cities.filter((item) => item.id !== req.params.id);
    writeState(state);
    res.json({ ok: true, state: getPublicState(state) });
  } catch (error) {
    console.error('Failed to delete city', error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

app.patch('/api/admin/settings', (req, res) => {
  const state = readState();

  if (req.body?.rate !== undefined) {
    state.rates.EUR_USDT = Number(req.body.rate) || state.rates.EUR_USDT;
    state.rateUpdatedAt = new Date().toISOString();
  }

  if (req.body?.usdtReserve !== undefined) {
    state.usdtReserve = Math.max(0, Number(req.body.usdtReserve) || 0);
  }

  if (req.body?.antiPhishingCode !== undefined) {
    state.antiPhishingCode = ensureString(req.body.antiPhishingCode) || 'BULL';
  }

  writeState(state);
  res.json({ ok: true, state: getPublicState(state) });
});

app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  const state = readState();
  const existingOrder = state.orders.find((order) => order.id === req.params.id);

  if (!existingOrder) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const nextStatus = ['accepted', 'processing', 'ready', 'rejected'].includes(req.body?.status)
    ? req.body.status
    : existingOrder.status;
  const nextManagerName =
    req.body?.managerName !== undefined ? (ensureString(req.body.managerName) || null) : existingOrder.managerName;

  const nextState = applyOrderStatusChange(state, existingOrder.id, nextStatus, nextManagerName);
  writeState(nextState);

  try {
    const updatedOrder = nextState.orders.find((order) => order.id === existingOrder.id);
    if (updatedOrder) {
      await editTelegramMessage(updatedOrder, true);
    }
  } catch (error) {
    console.error('Failed to sync Telegram message after admin patch', error);
  }

  res.json({ ok: true, state: getPublicState(nextState) });
});

app.post('/api/orders', async (req, res) => {
  const orderDraft = normalizeOrderPayload(req.body?.order);
  const telegramInitData = ensureString(req.body?.telegramInitData);
  // #region debug-point C:order-request
  reportDebugEvent('pre-fix', 'C', 'server.js:/api/orders', '[DEBUG] order request received', {
    hasOrderDraft: Boolean(orderDraft),
    cityId: req.body?.order?.cityId ?? null,
    cityKey: req.body?.order?.cityKey ?? null,
    giveAsset: req.body?.order?.giveAsset ?? null,
    getAsset: req.body?.order?.getAsset ?? null,
  });
  // #endregion

  if (!orderDraft) {
    res.status(400).json({ error: 'Invalid order payload' });
    return;
  }

  if (!telegramInitData && requireTelegramInit) {
    res.status(401).json({ error: 'Telegram initData is required' });
    return;
  }

  const isVerified = telegramInitData ? verifyTelegramInitData(telegramInitData, botToken) : false;
  if (telegramInitData && !isVerified) {
    res.status(401).json({ error: 'Invalid Telegram initData' });
    return;
  }

  const telegramUser = getTelegramUserFromInitData(telegramInitData);
  const verifiedUserId = telegramUser?.id ? String(telegramUser.id) : null;

  if (isVerified && orderDraft.userId && verifiedUserId && orderDraft.userId !== verifiedUserId) {
    res.status(403).json({ error: 'Telegram user mismatch' });
    return;
  }

  const state = readState();
  const city = state.cities.find((item) => item.id === orderDraft.cityId || item.cityKey === orderDraft.cityKey);

  if (!city) {
    res.status(400).json({ error: 'City not found' });
    return;
  }

  const targetChatId = fallbackChatId;

  const createdOrder = {
    ...orderDraft,
    cityId: city.id,
    cityKey: city.cityKey,
    antiPhishingCode: state.antiPhishingCode,
    id: `CB-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    status: 'accepted',
    telegramChatId: null,
    telegramMessageId: null,
  };

  let nextState = applyOrderReservesOnCreate(state, createdOrder);
  let telegramDeliveryOk = false;
  let warning = null;

  writeState(nextState);
  // #region debug-point C:order-written
  reportDebugEvent('pre-fix', 'C', 'server.js:/api/orders', '[DEBUG] order written to state', {
    createdOrderId: createdOrder.id,
    ordersAfterWrite: nextState.orders.length,
    topOrderId: nextState.orders[0]?.id ?? null,
  });
  // #endregion

  if (!botToken) {
    warning = 'Order saved, but BOT_TOKEN is missing';
  } else if (!targetChatId) {
    warning = 'Order saved, but CHAT_ID is missing';
  } else {
    try {
      const telegramMessage = await sendTelegramMessage(
        targetChatId,
        formatTelegramOrderMessage(createdOrder, isVerified),
        getOrderKeyboard(createdOrder.id),
      );

      createdOrder.telegramChatId = String(telegramMessage.chat?.id ?? targetChatId);
      createdOrder.telegramMessageId = Number(telegramMessage.message_id) || null;
      nextState = {
        ...nextState,
        orders: nextState.orders.map((order) => (order.id === createdOrder.id ? createdOrder : order)),
      };
      writeState(nextState);
      telegramDeliveryOk = true;
    } catch (error) {
      warning = error instanceof Error ? error.message : 'Failed to send Telegram notification';
      console.error('Failed to send Telegram notification', error);
    }
  }

  res.json({
    ok: true,
    isVerified,
    telegramDeliveryOk,
    warning,
    createdOrder,
    state: getPublicState(nextState),
  });
  // #region debug-point D:order-response
  reportDebugEvent('pre-fix', 'D', 'server.js:/api/orders', '[DEBUG] order response sent', {
    createdOrderId: createdOrder.id,
    telegramDeliveryOk,
    warning,
    returnedOrders: nextState.orders.length,
  });
  // #endregion
});

app.post('/api/telegram/webhook', async (req, res) => {
  const callbackQuery = req.body?.callback_query;
  const callbackData = ensureString(callbackQuery?.data);

  if (!callbackQuery || !callbackData.startsWith('order:')) {
    res.json({ ok: true });
    return;
  }

  const [, orderId, status] = callbackData.split(':');
  if (!orderId || !['processing', 'ready', 'rejected'].includes(status)) {
    res.json({ ok: true });
    return;
  }

  const state = readState();
  const managerName = getManagerNameFromTelegramUser(callbackQuery.from);
  const nextState = applyOrderStatusChange(
    state,
    orderId,
    status,
    status === 'processing' && managerName ? managerName : undefined,
  );

  writeState(nextState);

  try {
    const updatedOrder = nextState.orders.find((order) => order.id === orderId);
    if (updatedOrder) {
      await editTelegramMessage(updatedOrder, true);
    }
    await answerCallbackQuery(callbackQuery.id, `Заявка ${orderId} -> ${formatStatus(status)}`);
  } catch (error) {
    console.error('Failed to process Telegram callback', error);
  }

  res.json({ ok: true });
});

app.post('/api/telegram/set-webhook', async (_req, res) => {
  if (!botToken || !publicBaseUrl) {
    res.status(400).json({ error: 'BOT_TOKEN or PUBLIC_BASE_URL is missing' });
    return;
  }

  try {
    await ensureTelegramWebhook();
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to set webhook',
    });
  }
});

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`CryptoBull server listening on http://localhost:${port}`);
  ensureTelegramWebhook();
});
