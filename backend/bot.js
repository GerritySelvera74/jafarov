const TelegramBot = require('node-telegram-bot-api');
const { 
  addUser, 
  getUserByTgId, 
  getUserByTikTokId, 
  addToQueue,
  checkUserInQueue,
  getQueueCount
} = require('./database');

const token = process.env.TG_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

console.log('🤖 TG Bot запущен!');

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  const text = `
🎮 Добро пожаловать в MAFIA TT Game!

Для регистрации напиши команду:
/reg TikTok_ID Nick

Пример:
/reg jafarov_fan_123 VasyaGamer

После этого ты сможешь писать !reg в TikTok чате для регистрации в очередь на игру.
  `;

  bot.sendMessage(chatId, text);
});

// Команда /reg TikTok_ID Nick
bot.onText(/\/reg (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tg_id = msg.from.id;
  const tiktok_id = match[1];
  const nick = match[2];

  try {
    // Проверяем, не зарегистрирован ли уже
    const existing = await getUserByTgId(tg_id);
    if (existing) {
      bot.sendMessage(chatId, `❌ Ты уже зарегистрирован как: ${existing.nick}\n\nДля изменения данных напиши в админов.`);
      return;
    }

    // Добавляем пользователя
    await addUser(tg_id, tiktok_id, nick);
    
    bot.sendMessage(
      chatId,
      `✅ Регистрация успешна!\n\n👤 Твои данные:\n📱 Nick: ${nick}\n🎵 TikTok ID: ${tiktok_id}\n\nТеперь пиши !reg в TikTok чате для участия в игре!`
    );

  } catch (error) {
    console.error('Ошибка при регистрации:', error);
    bot.sendMessage(chatId, '❌ Ошибка при регистрации. Возможно такой TikTok ID уже существует.');
  }
});

// Функция для отправки карты в ЛС
const sendCard = async (tg_id, nick, role) => {
  try {
    const text = `
🎴 Твоя роль в игре мафия:

👑 ${role}

Держи в секрете! 🤐
    `;
    await bot.sendMessage(tg_id, text);
    console.log(`✅ Карта отправлена ${nick} (${role})`);
  } catch (error) {
    console.error(`❌ Ошибка при отправке карты ${nick}:`, error.message);
  }
};

// Функция для добавления в очередь из TikTok
const addToQueueFromTikTok = async (tiktok_id) => {
  try {
    const user = await getUserByTikTokId(tiktok_id);
    
    if (!user) {
      console.log(`❌ Пользователь ${tiktok_id} не зарегистрирован`);
      return false;
    }

    const isInQueue = await checkUserInQueue(user.id);
    if (isInQueue) {
      console.log(`⚠️ ${user.nick} уже в очереди`);
      return false;
    }

    const queueCount = await getQueueCount();
    if (queueCount >= 8) {
      console.log(`⚠️ Очередь полна! ${user.nick} не добавлен`);
      return false;
    }

    await addToQueue(user.id);
    console.log(`✅ ${user.nick} добавлен в очередь (${queueCount + 1}/8)`);
    
    // Отправляем ему подтверждение
    const queuePos = queueCount + 1;
    bot.sendMessage(user.tg_id, `✅ Ты добавлен в очередь!\n\n📍 Позиция: ${queuePos}/8`);
    
    return true;
  } catch (error) {
    console.error('Ошибка при добавлении в очередь:', error);
    return false;
  }
};

module.exports = { bot, sendCard, addToQueueFromTikTok };