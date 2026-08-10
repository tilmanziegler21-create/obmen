import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3001);
const distDir = path.join(__dirname, 'dist');
const dataDir = path.join(__dirname, 'data');
const statePath = path.join(dataDir, 'state.json');

const botToken = (process.env.VITE_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const fallbackChatId = (process.env.VITE_CHAT_ID || process.env.CHAT_ID || '').trim();
const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const requireTelegramInit = process.env.REQUIRE_TELEGRAM_INIT === 'true';
const startVideoFileIdEnv = (process.env.START_VIDEO_FILE_ID || '').trim();
const startVideoUrlEnv = (process.env.START_VIDEO_URL || '').trim();
const startVideoPath = path.join(__dirname, 'public', 'start.mp4');
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

// Глобальный логгер всех запросов для отладки
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

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
    rateMode: 'auto',
    rateSpread: 4,
    rateUpdatedAt: new Date().toISOString(),
    orders: [],
    usdtReserve: 2500,
    antiPhishingCode: 'BULL',
    supportLink: 'cryptobull_manager',
    startVideoFileId: '',
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
    rateMode: ['manual', 'auto'].includes(raw.rateMode) ? raw.rateMode : defaults.rateMode,
    rateSpread: (() => {
      const spread = typeof raw.rateSpread === 'number' && !isNaN(raw.rateSpread) ? Number(raw.rateSpread) : defaults.rateSpread;
      // Старый дефолт 0.5 ломал клиентскую комиссию
      return spread === 0.5 ? 4 : spread;
    })(),
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
    supportLink: ensureString(raw.supportLink) || defaults.supportLink,
    startVideoFileId: ensureString(raw.startVideoFileId) || defaults.startVideoFileId,
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
    rateMode: state.rateMode,
    rateSpread: state.rateSpread,
    rateUpdatedAt: state.rateUpdatedAt,
    orders: state.orders,
    usdtReserve: state.usdtReserve,
    antiPhishingCode: state.antiPhishingCode,
    supportLink: state.supportLink,
  };
}

async function exportToGoogleSheet(order) {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  // Обрабатываем экранированные переносы строк и возможные кавычки в приватном ключе
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (privateKey) {
    // Поддержка любых вариаций переносов: \n, \\n, /n, \/n
    privateKey = privateKey
      .replace(/^"|"$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\/n/g, '\n')
      .replace(/\\\n/g, '\n')
      .replace(/\s+BEGIN/g, ' BEGIN')
      .replace(/END\s+/g, 'END ');
  }
  const spreadsheetId = process.env.SPREADSHEET_ID;

  console.log(`[Google Sheets] Starting export for order ${order.id}`);
  console.log(`[Google Sheets] Credentials check: Email: ${!!clientEmail}, Key: ${!!privateKey}, SheetID: ${!!spreadsheetId}`);
  if (privateKey) {
    console.log(`[Google Sheets] Key prefix: ${privateKey.substring(0, 35)}... Key suffix: ...${privateKey.substring(privateKey.length - 30)}`);
    console.log(`[Google Sheets] Key contains actual newlines: ${privateKey.includes('\n')}`);
  }

  if (!clientEmail || !privateKey || !spreadsheetId) {
    console.log('[Google Sheets] Missing credentials. Skip export.');
    return;
  }
  
  try {
    console.log('[Google Sheets] Authenticating...');
    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    const sheets = google.sheets({ version: 'v4', auth });

    const values = [
      [
        order.id,
        new Date(order.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Berlin' }),
        order.direction === 'GIVE_CASH' ? 'Наличные -> USDT' : 'USDT -> Наличные',
        order.cityKey,
        `${order.giveAmount} ${order.giveCurrency}`,
        `${order.getAmount} ${order.getCurrency}`,
        order.rate,
        order.userHandle,
        order.wallet || '',
        order.status
      ]
    ];

    console.log('[Google Sheets] Appending data to sheet...');
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      // Указываем просто столбцы, чтобы Google сам нашел первый лист, 
      // независимо от того, как он называется (Лист1, Sheet1, orders и т.д.)
      range: 'A:J',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log(`[Google Sheets] Order ${order.id} exported successfully`);
  } catch (err) {
    console.error(`[Google Sheets] Failed to export order ${order.id}:`, err);
  }
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
  
  // Допускаем пустые amount на этапе парсинга, чтобы не откидывать заявку тихо
  const giveAmount = ensureString(payload.giveAmount) || '0';
  const getAmount = ensureString(payload.getAmount) || '0';
  const rate = ensureString(payload.rate) || '1.00';

  if (!direction) {
    console.log('[Server] Invalid payload direction:', payload.direction);
    return null;
  }

  return {
    id: ensureString(payload.id) || null,
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

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTelegramOrderMessage(order, isVerified) {
  const routeDetails = [
    order.network ? `🔗 <b>Сеть:</b> ${escapeHtml(order.network)}` : null,
    order.wallet ? `💼 <b>Кошелек:</b> <code>${escapeHtml(order.wallet)}</code>` : null,
    order.cardNumber ? `💳 <b>Карта UAH:</b> <code>${escapeHtml(order.cardNumber)}</code>` : null,
    order.contact ? `📱 <b>Контакт:</b> ${escapeHtml(order.contact)}` : null,
  ].filter(Boolean).join('\n');
  const verificationLabel = isVerified ? 'verified' : 'not verified';
  const referralLabel = order.referralCodeUsed ? escapeHtml(order.referralCodeUsed) : 'none';

  let headerText = '🚨 <b>Новая заявка на обмен</b>';
  if (order.status === 'processing') headerText = '⏳ <b>Заявка в работе</b>';
  if (order.status === 'ready') headerText = '✅ <b>Заявка успешно выполнена</b>';
  if (order.status === 'rejected') headerText = '❌ <b>Заявка отклонена</b>';

  return `
${headerText}

#${order.id}
📍 <b>Статус:</b> ${formatStatus(order.status)}
🔄 <b>Направление:</b> ${formatDirection(order)}
🏙 <b>Город:</b> ${escapeHtml(order.cityKey)}
💰 <b>Отдают:</b> ${order.giveAmount} ${order.giveCurrency}
💸 <b>Получают:</b> ${order.getAmount} ${order.getCurrency}
📊 <b>Курс клиента:</b> 1 ${formatAssetLabel(order.giveAsset, order.giveCurrency)} = ${order.rate} ${order.getCurrency}
💎 <b>Комиссия:</b> ${order.commissionPercent.toFixed(1)}%
🎁 <b>Скидка:</b> ${order.discountPercent.toFixed(1)}%
🏷 <b>Рефкод:</b> ${referralLabel}

${routeDetails}

🛡 <b>Anti-Phishing:</b> <code>${escapeHtml(order.antiPhishingCode)}</code>
👤 <b>Клиент:</b> ${escapeHtml(order.userHandle)}
👨‍💼 <b>Менеджер:</b> ${escapeHtml(order.managerName ?? '-')}
✅ <b>Telegram initData:</b> ${verificationLabel}
  `.trim();
}

function getOrderKeyboard(order) {
  if (order.status === 'ready' || order.status === 'rejected') {
    return { inline_keyboard: [] };
  }

  if (order.status === 'processing') {
    return {
      inline_keyboard: [
        [{ text: '✅ Готово', callback_data: `order:${order.id}:ready` }],
        [{ text: '❌ Отклонить', callback_data: `order:${order.id}:rejected` }],
      ],
    };
  }

  return {
    inline_keyboard: [
      [{ text: '⏳ В работу', callback_data: `order:${order.id}:processing` }],
      [{ text: '❌ Отклонить', callback_data: `order:${order.id}:rejected` }],
    ],
  };
}

async function callTelegram(method, payload) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  console.log(`[Telegram API] Calling ${url} with payload:`, JSON.stringify(payload));

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000); // 10 seconds timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    const data = await response.json().catch(() => ({}));
    console.log(`[Telegram API] Response from ${method}:`, JSON.stringify(data));

    if (!response.ok || data.ok === false) {
      const errorMessage = typeof data.description === 'string' ? data.description : 'Telegram API error';
      throw new Error(errorMessage);
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Telegram API timeout (10s)');
    }
    throw error;
  }
}

async function sendTelegramMessage(chatId, message, replyMarkup) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    reply_markup: replyMarkup,
  });
}

function getStartReplyMarkup() {
  if (!publicBaseUrl) {
    return undefined;
  }

  return {
    inline_keyboard: [
      [
        {
          text: 'ОБМЕН',
          web_app: { url: publicBaseUrl },
        },
      ],
    ],
  };
}

function getStartCaption() {
  return [
    '👋 <b>Добро пожаловать в CryptoBull!</b>',
    '',
    'Нажмите кнопку <b>ОБМЕН</b> ниже, чтобы открыть приложение и создать заявку.',
  ].join('\n');
}

async function callTelegramMultipart(method, formData) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  console.log(`[Telegram API] Calling multipart ${method}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 60000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json().catch(() => ({}));
    console.log(`[Telegram API] Response from ${method}:`, JSON.stringify(data));

    if (!response.ok || data.ok === false) {
      const errorMessage = typeof data.description === 'string' ? data.description : 'Telegram API error';
      throw new Error(errorMessage);
    }

    return data.result;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error('Telegram API timeout (60s)');
    }
    throw error;
  }
}

function resolveStartVideoSource(state) {
  const cachedFileId = ensureString(state?.startVideoFileId) || startVideoFileIdEnv;
  if (cachedFileId) {
    return { type: 'file_id', value: cachedFileId };
  }

  if (startVideoUrlEnv) {
    return { type: 'url', value: startVideoUrlEnv };
  }

  if (publicBaseUrl && fs.existsSync(startVideoPath)) {
    return { type: 'url', value: `${publicBaseUrl}/start.mp4` };
  }

  if (fs.existsSync(startVideoPath)) {
    return { type: 'file', value: startVideoPath };
  }

  return null;
}

async function sendStartWelcome(chatId) {
  const replyMarkup = getStartReplyMarkup();
  const caption = getStartCaption();
  const state = readState();
  const videoSource = resolveStartVideoSource(state);

  if (!videoSource) {
    console.warn('[Telegram] start.mp4 not found — sending text welcome only');
    return sendTelegramMessage(chatId, caption, replyMarkup);
  }

  if (videoSource.type === 'file') {
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(videoSource.value);
    formData.append('chat_id', String(chatId));
    formData.append('caption', caption);
    formData.append('parse_mode', 'HTML');
    formData.append('supports_streaming', 'true');
    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup));
    }
    formData.append('video', new Blob([fileBuffer], { type: 'video/mp4' }), 'start.mp4');

    const result = await callTelegramMultipart('sendVideo', formData);
    const fileId = result?.video?.file_id;
    if (fileId && state.startVideoFileId !== fileId) {
      state.startVideoFileId = fileId;
      writeState(state);
      console.log('[Telegram] Cached start video file_id');
    }
    return result;
  }

  const result = await callTelegram('sendVideo', {
    chat_id: chatId,
    video: videoSource.value,
    caption,
    parse_mode: 'HTML',
    supports_streaming: true,
    reply_markup: replyMarkup,
  });

  const fileId = result?.video?.file_id;
  if (fileId && state.startVideoFileId !== fileId) {
    state.startVideoFileId = fileId;
    writeState(state);
    console.log('[Telegram] Cached start video file_id');
  }

  return result;
}

async function handleStartCommand(message) {
  const chatId = message?.chat?.id;
  if (!chatId) {
    return;
  }

  try {
    await sendStartWelcome(chatId);
  } catch (error) {
    console.error('[Telegram] Failed to send /start welcome:', error.message);
    try {
      await sendTelegramMessage(chatId, getStartCaption(), getStartReplyMarkup());
    } catch (fallbackError) {
      console.error('[Telegram] Failed to send /start text fallback:', fallbackError.message);
    }
  }
}

async function editTelegramMessage(order, isVerified) {
  if (!order.telegramChatId || !order.telegramMessageId) {
    return;
  }

  if (order.status === 'rejected') {
    try {
      await callTelegram('deleteMessage', {
        chat_id: order.telegramChatId,
        message_id: order.telegramMessageId,
      });
    } catch (e) {
      console.error('[Telegram API] Failed to delete message:', e.message);
    }
    return;
  }

  await callTelegram('editMessageText', {
    chat_id: order.telegramChatId,
    message_id: order.telegramMessageId,
    text: formatTelegramOrderMessage(order, isVerified),
    parse_mode: 'HTML',
    reply_markup: getOrderKeyboard(order),
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
  }
  // Remove cash limit check since we no longer track it

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
  }
  // Remove cash limit restoring since we no longer track it

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
      allowed_updates: ['callback_query', 'message'],
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
    timestamp: Date.now()
  });
});

// Пингуем сами себя каждые 14 минут, чтобы Render не усыплял Web Service (он засыпает через 15 минут бездействия)
if (publicBaseUrl) {
  setInterval(() => {
    fetch(`${publicBaseUrl}/api/health`)
      .then(res => res.json())
      .then(data => console.log(`[KeepAlive] Ping successful:`, data.timestamp))
      .catch(err => console.error(`[KeepAlive] Ping failed:`, err.message));
  }, 14 * 60 * 1000);
}

// Автообновление курсов (каждую минуту). Binance + fallback на Coinbase / open.er-api
async function fetchJsonSafe(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch {
    return null;
  }
}

async function fetchEurUsdtRate() {
  const binance = await fetchJsonSafe('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
  const binancePrice = Number(binance?.price);
  if (Number.isFinite(binancePrice) && binancePrice > 0) {
    return { source: 'binance', eurUsdt: binancePrice };
  }

  const coinbase = await fetchJsonSafe('https://api.coinbase.com/v2/exchange-rates?currency=USDT');
  const eurPerUsdt = Number(coinbase?.data?.rates?.EUR);
  if (Number.isFinite(eurPerUsdt) && eurPerUsdt > 0) {
    return { source: 'coinbase', eurUsdt: 1 / eurPerUsdt };
  }

  const openEr = await fetchJsonSafe('https://open.er-api.com/v6/latest/USD');
  const eurPerUsd = Number(openEr?.rates?.EUR);
  if (Number.isFinite(eurPerUsd) && eurPerUsd > 0) {
    return { source: 'open.er-api', eurUsdt: 1 / eurPerUsd };
  }

  return null;
}

async function fetchUsdtUahRate() {
  const binance = await fetchJsonSafe('https://api.binance.com/api/v3/ticker/price?symbol=USDTUAH');
  const binancePrice = Number(binance?.price);
  if (Number.isFinite(binancePrice) && binancePrice > 0) {
    return { source: 'binance', usdtUah: binancePrice };
  }

  const coinbase = await fetchJsonSafe('https://api.coinbase.com/v2/exchange-rates?currency=USDT');
  const uahPerUsdt = Number(coinbase?.data?.rates?.UAH);
  if (Number.isFinite(uahPerUsdt) && uahPerUsdt > 0) {
    return { source: 'coinbase', usdtUah: uahPerUsdt };
  }

  const openEr = await fetchJsonSafe('https://open.er-api.com/v6/latest/USD');
  const uahPerUsd = Number(openEr?.rates?.UAH);
  if (Number.isFinite(uahPerUsd) && uahPerUsd > 0) {
    return { source: 'open.er-api', usdtUah: uahPerUsd };
  }

  return null;
}

async function fetchBinanceRate() {
  try {
    const state = readState();

    const [eurResult, uahResult] = await Promise.all([
      fetchEurUsdtRate(),
      fetchUsdtUahRate(),
    ]);

    let changed = false;

    // EUR обновляем из рынка только в auto; в manual оставляем ручной EUR
    if (state.rateMode === 'auto' && eurResult) {
      state.rates.EUR_USDT = Number(eurResult.eurUsdt.toFixed(4));
      changed = true;
    }

    // UAH всегда тянем с рынка — иначе гривна зависает на дефолте
    if (uahResult) {
      state.rates.UAH_USDT = Number((1 / uahResult.usdtUah).toFixed(8));
      changed = true;
    }

    if (state.rates.EUR_USDT > 0 && state.rates.UAH_USDT > 0) {
      state.rates.EUR_UAH = Number((state.rates.EUR_USDT / state.rates.UAH_USDT).toFixed(2));
      changed = true;
    }

    if (!changed) {
      console.warn('[Rates] No EUR/UAH quotes available from Binance or fallbacks');
      return;
    }

    state.rateUpdatedAt = new Date().toISOString();
    writeState(state);
    console.log(
      `[Rates] Updated via EUR=${state.rateMode === 'auto' ? (eurResult?.source || 'keep') : 'manual'}, UAH=${uahResult?.source || 'keep'}. ` +
      `EUR/USDT: ${state.rates.EUR_USDT}, UAH/USDT: ${(1 / state.rates.UAH_USDT).toFixed(2)}, EUR/UAH: ${state.rates.EUR_UAH}`,
    );
  } catch (e) {
    console.error('[Rates] Failed to fetch rate:', e.message);
  }
}

// Запускаем каждую минуту
setInterval(fetchBinanceRate, 60 * 1000);
// И один раз при старте
fetchBinanceRate();

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const state = readState();
    const updatedAtMs = Date.parse(state.rateUpdatedAt);
    const isStale = !Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs > 60_000;
    if (isStale) {
      await fetchBinanceRate();
    }
  } catch (error) {
    console.error('[Rates] bootstrap refresh failed', error);
  }

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

app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
  const state = readState();

  if (req.body?.rate !== undefined) {
    state.rates.EUR_USDT = Number(req.body.rate) || state.rates.EUR_USDT;
    state.rateUpdatedAt = new Date().toISOString();
  }

  // usdtUah = сколько гривен за 1 USDT (опциональный ручной ввод)
  if (req.body?.usdtUah !== undefined) {
    const usdtUah = Number(req.body.usdtUah);
    if (Number.isFinite(usdtUah) && usdtUah > 0) {
      state.rates.UAH_USDT = Number((1 / usdtUah).toFixed(8));
      state.rateUpdatedAt = new Date().toISOString();
    }
  }

  if (req.body?.rateMode !== undefined) {
    state.rateMode = ['manual', 'auto'].includes(req.body.rateMode) ? req.body.rateMode : state.rateMode;
  }

  if (req.body?.rateSpread !== undefined) {
    const nextSpread = Number(req.body.rateSpread);
    state.rateSpread = Number.isFinite(nextSpread) ? Math.max(0, Math.min(20, nextSpread)) : state.rateSpread;
  }

  if (state.rates.EUR_USDT > 0 && state.rates.UAH_USDT > 0) {
    state.rates.EUR_UAH = Number((state.rates.EUR_USDT / state.rates.UAH_USDT).toFixed(2));
  }

  if (req.body?.usdtReserve !== undefined) {
    state.usdtReserve = Math.max(0, Number(req.body.usdtReserve) || 0);
  }

  if (req.body?.antiPhishingCode !== undefined) {
    state.antiPhishingCode = ensureString(req.body.antiPhishingCode) || 'BULL';
  }

  if (req.body?.supportLink !== undefined) {
    state.supportLink = ensureString(req.body.supportLink) || 'cryptobull_manager';
  }

  writeState(state);

  // auto: EUR+UAH с рынка; manual: EUR не затираем, UAH обновляем
  await fetchBinanceRate();
  res.json({ ok: true, state: getPublicState(readState()) });
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
  try {
    console.log(`[Server] Received order request. Payload:`, JSON.stringify(req.body));
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
      console.log('[Server] Validation failed: Invalid order payload. Raw body:', JSON.stringify(req.body));
      res.status(400).json({ error: 'Invalid order payload' });
      return;
    }

    if (!telegramInitData && requireTelegramInit) {
      res.status(401).json({ error: 'Telegram initData is required' });
      return;
    }

    const isVerified = telegramInitData ? verifyTelegramInitData(telegramInitData, botToken) : false;
    if (telegramInitData && !isVerified && requireTelegramInit) {
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

    const MIN_EXCHANGE_EUR = 100;
    const giveAmountNumber = Number(orderDraft.giveAmount);
    const giveCurrency = orderDraft.giveCurrency || 'EUR';
    let giveAmountInEur = giveAmountNumber;
    if (giveCurrency === 'UAH') {
      giveAmountInEur = state.rates.EUR_UAH > 0 ? giveAmountNumber / state.rates.EUR_UAH : 0;
    } else if (giveCurrency === 'USDT') {
      giveAmountInEur = state.rates.EUR_USDT > 0 ? giveAmountNumber / state.rates.EUR_USDT : 0;
    }

    if (!Number.isFinite(giveAmountInEur) || giveAmountInEur + 1e-9 < MIN_EXCHANGE_EUR) {
      res.status(400).json({
        error: `Minimum exchange amount is ${MIN_EXCHANGE_EUR} EUR (or equivalent)`,
        minExchangeEUR: MIN_EXCHANGE_EUR,
      });
      return;
    }
    
    // Добавляем фоллбек для города: если не нашли, берем первый попавшийся активный
    let city = state.cities.find((item) => item.id === orderDraft.cityId || item.cityKey === orderDraft.cityKey);
    if (!city && state.cities.length > 0) {
      city = state.cities.find(c => c.isActive) || state.cities[0];
      console.log(`[Server] City mismatch! Requested: ${orderDraft.cityId}/${orderDraft.cityKey}. Fallback to: ${city.id}/${city.cityKey}`);
    }

    if (!city) {
      res.status(400).json({ error: 'City not found' });
      return;
    }

    const targetChatId = fallbackChatId;
    if (!targetChatId) {
      console.log(`[Server] Missing CHAT_ID in environment variables!`);
    }

    const createdOrder = {
      ...orderDraft,
      cityId: city.id,
      cityKey: city.cityKey,
      antiPhishingCode: state.antiPhishingCode,
      id: orderDraft.id || `CB-${Date.now().toString().slice(-8)}`,
      createdAt: new Date().toISOString(),
      status: 'accepted',
      telegramChatId: null,
      telegramMessageId: null,
    };

    console.log(`[Server] Created order before save:`, JSON.stringify(createdOrder));

    let nextState = applyOrderReservesOnCreate(state, createdOrder);

    if (!botToken || !targetChatId) {
      console.warn('BOT_TOKEN or CHAT_ID is missing. Order will be saved, but Telegram notification will not be sent.');
      writeState(nextState);
      exportToGoogleSheet(createdOrder).catch(console.error);
      return res.json({
        ok: true,
        isVerified,
        telegramDeliveryOk: false,
        warning: 'BOT_TOKEN or CHAT_ID is missing',
        createdOrder,
        state: getPublicState(nextState),
      });
    }

    try {
      const telegramMessage = await sendTelegramMessage(
        targetChatId,
        formatTelegramOrderMessage(createdOrder, isVerified),
        getOrderKeyboard(createdOrder),
      );

      createdOrder.telegramChatId = String(telegramMessage.chat?.id ?? targetChatId);
      createdOrder.telegramMessageId = Number(telegramMessage.message_id) || null;
      
      // ИЩЕМ заявку в nextState.orders и обновляем ее (а не просто мапим)
      const existingOrderIndex = nextState.orders.findIndex(o => o.id === createdOrder.id);
      if (existingOrderIndex !== -1) {
        nextState.orders[existingOrderIndex] = createdOrder;
      } else {
        nextState.orders = [createdOrder, ...nextState.orders];
      }
      
      writeState(nextState);
      
      console.log(`[Server] Order ${createdOrder.id} saved to local state successfully`);

      // Асинхронно отправляем в Google Sheets (не блокируем ответ пользователю)
      exportToGoogleSheet(createdOrder).catch(e => console.error('[Google Sheets Error]', e));

      return res.json({
        ok: true,
        isVerified,
        telegramDeliveryOk: true,
        createdOrder,
        state: getPublicState(nextState),
      });
    } catch (error) {
      console.error('[Server] Failed to send Telegram notification', error);
      // If sending to Telegram fails, we still want to save the order
      writeState(nextState);
      
      console.log(`[Server] Order ${createdOrder.id} saved to local state despite Telegram error`);
      
      // Асинхронно отправляем в Google Sheets даже если Telegram упал
      exportToGoogleSheet(createdOrder).catch(e => console.error('[Google Sheets Error]', e));
      
      return res.json({
        ok: true,
        isVerified,
        telegramDeliveryOk: false,
        warning: error instanceof Error ? error.message : 'Failed to send Telegram notification',
        createdOrder,
        state: getPublicState(nextState),
      });
    }
  } catch (criticalError) {
    console.error('[Server] CRITICAL ERROR in /api/orders:', criticalError);
    res.status(500).json({ error: criticalError instanceof Error ? criticalError.message : 'Internal Server Error' });
  }
});

app.post('/api/telegram/webhook', async (req, res) => {
  const message = req.body?.message;
  const messageText = ensureString(message?.text);
  if (messageText === '/start' || messageText.startsWith('/start ')) {
    res.json({ ok: true });
    handleStartCommand(message).catch((error) => {
      console.error('Failed to process /start command', error);
    });
    return;
  }

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
}

// Раздаём public/ (в т.ч. start.mp4 для /start), даже без dist
app.use(express.static(path.join(__dirname, 'public')));

if (fs.existsSync(distDir)) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`CryptoBull server listening on http://localhost:${port}`);
  ensureTelegramWebhook();
});
