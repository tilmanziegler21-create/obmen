function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const routeDetails = `🔗 <b>Сеть:</b> ${escapeHtml('TRC-20')}\n💼 <b>Кошелек:</b> <code>${escapeHtml('T1234567890')}</code>`;

const text = `
🚨 <b>Новая заявка на обмен</b>

#CB-12345678
📍 <b>Статус:</b> Принято
🔄 <b>Направление:</b> EUR наличные -> USDT
🏙 <b>Город:</b> ${escapeHtml('berlin')}
💰 <b>Отдают:</b> 100 EUR
💸 <b>Получают:</b> 108 USDT
📊 <b>Курс клиента:</b> 1 EUR наличные = 1.0800 USDT
💎 <b>Комиссия:</b> ${(4).toFixed(1)}%
🎁 <b>Скидка:</b> ${(0).toFixed(1)}%
🏷 <b>Рефкод:</b> none

${routeDetails}

🛡 <b>Anti-Phishing:</b> <code>${escapeHtml('BULL')}</code>
👤 <b>Клиент:</b> ${escapeHtml('@test')}
👨‍💼 <b>Менеджер:</b> ${escapeHtml('-')}
✅ <b>Telegram initData:</b> not verified
`.trim();

console.log(JSON.stringify({
  chat_id: "-1003863631303",
  text: text,
  parse_mode: 'HTML'
}));
