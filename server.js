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
const ordersLogPath = path.join(dataDir, 'orders.ndjson');

const botToken = process.env.BOT_TOKEN || process.env.VITE_BOT_TOKEN || '';
const chatId = process.env.CHAT_ID || process.env.VITE_CHAT_ID || '';
const requireTelegramInit = process.env.REQUIRE_TELEGRAM_INIT === 'true';
const adminIds = new Set(
  (process.env.ADMIN_IDS || process.env.VITE_ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

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

function ensureString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrderPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const direction = payload.direction === 'GIVE_USDT' ? 'GIVE_USDT' : payload.direction === 'GIVE_CASH' ? 'GIVE_CASH' : null;
  const giveAmount = ensureString(payload.giveAmount);
  const getAmount = ensureString(payload.getAmount);
  const rate = ensureString(payload.rate);

  if (!direction || !giveAmount || !getAmount || !rate) {
    return null;
  }

  return {
    direction,
    city: ensureString(payload.city),
    cityKey: ensureString(payload.cityKey),
    giveAmount,
    giveCurrency: ensureString(payload.giveCurrency),
    getAmount,
    getCurrency: ensureString(payload.getCurrency),
    rate,
    network: ensureString(payload.network) || null,
    wallet: ensureString(payload.wallet) || null,
    contact: ensureString(payload.contact) || null,
    antiPhishingCode: ensureString(payload.antiPhishingCode) || 'BULL',
    userHandle: ensureString(payload.userHandle) || 'Unknown',
    commissionPercent: Number(payload.commissionPercent) || 0,
    discountPercent: Number(payload.discountPercent) || 0,
    referralCodeUsed: ensureString(payload.referralCodeUsed) || null,
    managerName: ensureString(payload.managerName) || null,
    userId: payload.userId ? String(payload.userId) : null,
  };
}

function formatTelegramOrderMessage(order, isVerified) {
  const directionLabel =
    order.direction === 'GIVE_CASH' ? 'Наличные EUR -> USDT' : 'USDT -> Наличные EUR';
  const routeDetails =
    order.direction === 'GIVE_CASH'
      ? `🔗 <b>Сеть:</b> ${order.network ?? '-'}\n💼 <b>Кошелек:</b> <code>${order.wallet ?? '-'}</code>`
      : `📱 <b>Контакт:</b> ${order.contact ?? '-'}`;
  const verificationLabel = isVerified ? 'verified' : 'not verified';
  const referralLabel = order.referralCodeUsed ? order.referralCodeUsed : 'none';

  return `
🚨 <b>Новая заявка на обмен</b>

🔄 <b>Направление:</b> ${directionLabel}
🏙 <b>Город:</b> ${order.city || order.cityKey || '-'}
💰 <b>Отдают:</b> ${order.giveAmount} ${order.giveCurrency}
💸 <b>Получают:</b> ${order.getAmount} ${order.getCurrency}
📊 <b>Курс клиента:</b> 1 EUR = ${order.rate} USDT
💎 <b>Комиссия:</b> ${order.commissionPercent.toFixed(1)}%
🎁 <b>Скидка:</b> ${order.discountPercent.toFixed(1)}%
🏷 <b>Рефкод:</b> ${referralLabel}

${routeDetails}

🛡 <b>Anti-Phishing:</b> <code>${order.antiPhishingCode}</code>
👤 <b>Клиент:</b> ${order.userHandle}
✅ <b>Telegram initData:</b> ${verificationLabel}
  `.trim();
}

async function sendTelegramMessage(message) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const messageText = typeof errorData.description === 'string' ? errorData.description : 'Telegram API error';
    throw new Error(messageText);
  }
}

function persistOrderLog(order, meta) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(
    ordersLogPath,
    `${JSON.stringify({
      createdAt: new Date().toISOString(),
      order,
      meta,
    })}\n`,
    'utf8',
  );
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cryptobull-api',
    hasBotToken: Boolean(botToken),
    hasChatId: Boolean(chatId),
  });
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

app.post('/api/orders', async (req, res) => {
  if (!botToken || !chatId) {
    res.status(500).json({
      error: 'Server Telegram config is missing',
    });
    return;
  }

  const order = normalizeOrderPayload(req.body?.order);
  const telegramInitData = ensureString(req.body?.telegramInitData);

  if (!order) {
    res.status(400).json({
      error: 'Invalid order payload',
    });
    return;
  }

  if (!telegramInitData && requireTelegramInit) {
    res.status(401).json({
      error: 'Telegram initData is required',
    });
    return;
  }

  const isVerified = telegramInitData ? verifyTelegramInitData(telegramInitData, botToken) : false;

  if (telegramInitData && !isVerified) {
    res.status(401).json({
      error: 'Invalid Telegram initData',
    });
    return;
  }

  const telegramUser = getTelegramUserFromInitData(telegramInitData);
  const verifiedUserId = telegramUser?.id ? String(telegramUser.id) : null;

  if (isVerified && order.userId && verifiedUserId && order.userId !== verifiedUserId) {
    res.status(403).json({
      error: 'Telegram user mismatch',
    });
    return;
  }

  try {
    const message = formatTelegramOrderMessage(order, isVerified);
    await sendTelegramMessage(message);
    persistOrderLog(order, {
      isVerified,
      verifiedUserId,
    });

    res.json({
      ok: true,
      isVerified,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to send Telegram notification',
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
});
