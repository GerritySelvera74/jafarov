import { WebcastPushConnection } from 'tiktok-live-connector';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'game.db');
const db = new Database(dbPath);

let tiktokConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export async function startTikTokListener() {
  try {
    const username = process.env.TIKTOK_USERNAME;

    if (!username) {
      console.log('⚠️ TikTok username не установлен в .env');
      return;
    }

    if (tiktokConnection) {
      try {
        await tiktokConnection.disconnect();
      } catch (e) {
        // Ignore
      }
    }

    tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.on('connect', () => {
      console.log('✅ Подключено к TikTok стриму:', username);
      global.tiktokConnected = true;
      reconnectAttempts = 0;
    });

    tiktokConnection.on('disconnect', () => {
      console.log('❌ Отключено от TikTok стрима');
      global.tiktokConnected = false;
      attemptReconnect();
    });

    tiktokConnection.on('error', (error) => {
      console.error('❌ Ошибка TikTok:', error);
      global.tiktokConnected = false;
      attemptReconnect();
    });

    // 🎯 СЛУШАЕМ КОМАНДЫ !reg ИЗ ЧАТА
    tiktokConnection.on('chat', (data) => {
      const message = data.comment.toLowerCase().trim();
      const tiktokUsername = data.uniqueId;

      // Проверяем команду !reg
      if (message === '!reg') {
        handleRegistration(tiktokUsername);
      }
    });

    tiktokConnection.on('like', (data) => {
      console.log(`❤️ ${data.uniqueId} лайкнул стрим`);
    });

    tiktokConnection.on('follow', (data) => {
      console.log(`🔔 ${data.uniqueId} подписался`);
    });

    await tiktokConnection.connect();
  } catch (error) {
    console.error('❌ Ошибка при подключении к TikTok:', error.message);
    global.tiktokConnected = false;
    attemptReconnect();
  }
}

// 🎯 ОБРАБОТКА КОМАНДЫ !reg
function handleRegistration(tiktokUsername) {
  try {
    // Ищем пользователя в БД по tiktok_id
    const userStmt = db.prepare('SELECT id, nick FROM users WHERE tiktok_id = ?');
    const user = userStmt.get(tiktokUsername);

    // Если пользователя нет в БД
    if (!user) {
      const logStmt = db.prepare(`
        INSERT INTO registration_logs (tiktok_username, nick, status, message)
        VALUES (?, ?, ?, ?)
      `);
      logStmt.run(tiktokUsername, tiktokUsername, 'failed', 'Не зарегистрирован на сайте');
      
      console.log(`❌ ${tiktokUsername}: не зарегистрирован на сайте`);
      return;
    }

    // Проверяем есть ли уже в очереди
    const queueCheckStmt = db.prepare('SELECT id FROM queue WHERE user_id = ?');
    const inQueue = queueCheckStmt.get(user.id);

    if (inQueue) {
      const logStmt = db.prepare(`
        INSERT INTO registration_logs (user_id, tiktok_username, nick, status, message)
        VALUES (?, ?, ?, ?, ?)
      `);
      logStmt.run(user.id, tiktokUsername, user.nick, 'already_queued', 'Уже в очереди');
      
      console.log(`⚠️ ${tiktokUsername} (${user.nick}) уже в очереди!`);
      return;
    }

    // Добавляем в очередь
    const posStmt = db.prepare('SELECT MAX(position) as max_pos FROM queue');
    const posResult = posStmt.get();
    const position = (posResult.max_pos || 0) + 1;

    const queueStmt = db.prepare('INSERT INTO queue (user_id, position) VALUES (?, ?)');
    queueStmt.run(user.id, position);

    // Логируем успешную регистрацию
    const logStmt = db.prepare(`
      INSERT INTO registration_logs (user_id, tiktok_username, nick, status, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    logStmt.run(user.id, tiktokUsername, user.nick, 'success', `Добавлен в очередь. Позиция: ${position}`);

    console.log(`✅ ${tiktokUsername} (${user.nick}) добавлен в очередь! Позиция: ${position}`);
  } catch (error) {
    console.error('❌ Ошибка при регистрации:', error);
  }
}

function attemptReconnect() {
  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    console.log(`🔄 Попытка переподключения... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
    setTimeout(() => {
      startTikTokListener();
    }, 5000);
  } else {
    console.log('❌ Не удалось подключиться к TikTok после нескольких попыток');
  }
}

export async function stopTikTokListener() {
  if (tiktokConnection) {
    try {
      await tiktokConnection.disconnect();
      console.log('✅ TikTok соединение закрыто');
    } catch (error) {
      console.error('Ошибка при закрытии соединения:', error);
    }
  }
}