import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
let isInitialized = false;

export function initializeTelegramBot() {
  if (isInitialized) return;

  try {
    bot.start((ctx) => {
      ctx.reply('👋 Привет! Я бот для игры в мафию на TikTok стримах.');
    });

    bot.command('help', (ctx) => {
      ctx.reply(`
📖 Доступные команды:
/start - Начать
/help - Помощь
/reg - Зарегистрироваться на игру
      `);
    });

    isInitialized = true;
    console.log('🤖 TG Bot инициализирован');
  } catch (error) {
    console.error('❌ Ошибка инициализации TG Bot:', error);
  }
}

export function sendCardToPlayer(tgId, nick, role) {
  try {
    if (!tgId) return;
    
    const message = `
🎮 Ты в игре "Мафия"!
👤 Твой ник: ${nick}
🎭 Твоя роль: ${role}

Удачи! 🍀
    `;
    
    bot.telegram.sendMessage(tgId, message).catch(err => {
      console.error(`Ошибка отправки сообщения ${tgId}:`, err);
    });
  } catch (error) {
    console.error('Ошибка при отправке карты:', error);
  }
}