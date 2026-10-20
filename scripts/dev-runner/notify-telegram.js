const path = require('path');

const BOT_TOKEN = '8893277284:AAE-BSTQyqk3gez_PsLdSCNnHEM82K3ZArg';
const CHAT_ID = '1585873135';

async function send(text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Error enviando a Telegram:', err.message);
  }
}

const message = process.argv.slice(2).join(' ') || 'Mensaje de prueba';
send(message).then(d => console.log('TELEGRAM_SENT:', d?.ok));
