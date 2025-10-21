import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { startTikTokListener, stopTikTokListener } from './tiktok-listener.js';
import { initializeTelegramBot } from './telegram-bot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database initialization
const dbPath = path.join(__dirname, 'data', 'game.db');
const db = new Database(dbPath);

// Initialize database tables
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tiktok_id TEXT UNIQUE NOT NULL,
      nick TEXT NOT NULL,
      tg_id TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Queue table
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      position INTEGER,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Games table
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME
    )
  `);

  // Game players table
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      card_sent INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Role presets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      player_count INTEGER NOT NULL,
      roles TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Registration logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS registration_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      tiktok_username TEXT NOT NULL,
      nick TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  console.log('✅ База данных инициализирована');
}

initializeDatabase();

// ==================== CONFIG ROUTES ====================

// GET config value
app.get('/api/config/:key', (req, res) => {
  try {
    const { key } = req.params;
    const stmt = db.prepare('SELECT value FROM config WHERE key = ?');
    const result = stmt.get(key);
    
    if (!result) {
      return res.json({ key, value: '' });
    }
    
    res.json({ key, value: result.value });
  } catch (error) {
    console.error('Ошибка получения конфига:', error);
    res.status(500).json({ error: 'Ошибка при получении конфига' });
  }
});

// POST update config value
app.post('/api/config/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    stmt.run(key, value);

    // If TikTok username changed, restart listener
    if (key === 'tiktok_username') {
      console.log(`🔄 Переподключение к TikTok: ${value}`);
      startTikTokListener();
    }

    res.json({ key, value });
  } catch (error) {
    console.error('Ошибка обновления конфига:', error);
    res.status(500).json({ error: 'Ошибка при обновлении конфига' });
  }
});

// ==================== STATUS ROUTES ====================

// GET system status
app.get('/api/status', (req, res) => {
  try {
    res.json({
      db: true,
      tiktok: global.tiktokConnected || false,
      bot: true,
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при получении статуса' });
  }
});

// ==================== USERS ROUTES ====================

// GET all users
app.get('/api/users', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    const users = stmt.all();
    res.json(users);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователей' });
  }
});

// POST - add new user (with TG ID auto detection!)
app.post('/api/users', async (req, res) => {
  try {
    let { tiktok_id, nick, tg_username, phone } = req.body;
    let tg_id = null;

    if (!tiktok_id || !nick) {
      return res.status(400).json({ error: 'TikTok ID и Nick обязательны' });
    }

    // Если есть tg_username, попытаемся получить TG ID через Telegram API
    if (tg_username && tg_username.startsWith('@')) {
      const usernameClean = tg_username.replace('@', '');
      try {
        // Используем метод getChat
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const url = `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${usernameClean}`;
        const resp = await axios.get(url);
        if (resp.data.ok && resp.data.result && resp.data.result.id) {
          tg_id = resp.data.result.id.toString();
        }
      } catch (e) {
        console.log('❌ Не удалось получить TG ID по username:', tg_username);
      }
    }

    // Сохраняем пользователя
    const stmt = db.prepare(`
      INSERT INTO users (tiktok_id, nick, tg_id, phone)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(tiktok_id, nick, tg_id, phone || null);

    res.json({
      id: result.lastInsertRowid,
      tiktok_id,
      nick,
      tg_id,
      phone: phone || null,
    });
  } catch (error) {
    console.error('Ошибка при добавлении пользователя:', error);
    res.status(500).json({ error: 'Ошибка при добавлении пользователя' });
  }
});

// PUT - update user
app.put('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { tiktok_id, nick, tg_id, phone } = req.body;

    if (!tiktok_id || !nick) {
      return res.status(400).json({ error: 'TikTok ID и Nick обязательны' });
    }

    const stmt = db.prepare(`
      UPDATE users 
      SET tiktok_id = ?, nick = ?, tg_id = ?, phone = ?
      WHERE id = ?
    `);

    stmt.run(tiktok_id, nick, tg_id || null, phone || null, id);

    res.json({
      id: parseInt(id),
      tiktok_id,
      nick,
      tg_id: tg_id || null,
      phone: phone || null,
    });
  } catch (error) {
    console.error('Ошибка при обновлении пользователя:', error);
    res.status(500).json({ error: 'Ошибка при обновлении пользователя' });
  }
});

// DELETE - remove user
app.delete('/api/users/:id', (req, res) => {
  try {
    const { id } = req.params;

    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении пользователя:', error);
    res.status(500).json({ error: 'Ошибка при удалении пользователя' });
  }
});

// ==================== QUEUE ROUTES ====================

// GET queue
app.get('/api/queue', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT u.* FROM users u
      JOIN queue q ON u.id = q.user_id
      ORDER BY q.position ASC
    `);
    const queue = stmt.all();
    res.json(queue);
  } catch (error) {
    console.error('Ошибка получения очереди:', error);
    res.status(500).json({ error: 'Ошибка при получении очереди' });
  }
});

// POST - add user to queue
app.post('/api/queue', (req, res) => {
  try {
    const { user_id } = req.body;

    // Check if user already in queue
    const checkStmt = db.prepare('SELECT id FROM queue WHERE user_id = ?');
    if (checkStmt.get(user_id)) {
      return res.status(400).json({ error: 'Пользователь уже в очереди' });
    }

    // Get next position
    const posStmt = db.prepare('SELECT MAX(position) as max_pos FROM queue');
    const result = posStmt.get();
    const position = (result.max_pos || 0) + 1;

    const stmt = db.prepare('INSERT INTO queue (user_id, position) VALUES (?, ?)');
    stmt.run(user_id, position);

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при добавлении в очередь:', error);
    res.status(500).json({ error: 'Ошибка при добавлении в очередь' });
  }
});

// DELETE - remove from queue
app.delete('/api/queue/:user_id', (req, res) => {
  try {
    const { user_id } = req.params;
    const stmt = db.prepare('DELETE FROM queue WHERE user_id = ?');
    stmt.run(user_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении из очереди:', error);
    res.status(500).json({ error: 'Ошибка при удалении из очереди' });
  }
});

// POST - clear queue
app.post('/api/queue/clear', (req, res) => {
  try {
    db.exec('DELETE FROM queue');
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при очистке очереди:', error);
    res.status(500).json({ error: 'Ошибка при очистке очереди' });
  }
});

// ==================== ROLE PRESETS ROUTES ====================

// GET all presets
app.get('/api/role-presets', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM role_presets ORDER BY created_at DESC');
    const presets = stmt.all().map(p => ({
      ...p,
      roles: JSON.parse(p.roles),
    }));
    res.json(presets);
  } catch (error) {
    console.error('Ошибка получения пресетов:', error);
    res.status(500).json({ error: 'Ошибка при получении пресетов' });
  }
});

// POST - create preset
app.post('/api/role-presets', (req, res) => {
  try {
    const { name, player_count, roles } = req.body;

    if (!name || !player_count || !roles || roles.length === 0) {
      return res.status(400).json({ error: 'Заполни все поля' });
    }

    if (roles.length !== player_count) {
      return res.status(400).json({ error: 'Количество ролей должно совпадать с количеством игроков' });
    }

    const stmt = db.prepare(`
      INSERT INTO role_presets (name, player_count, roles)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(name, player_count, JSON.stringify(roles));

    res.json({
      id: result.lastInsertRowid,
      name,
      player_count,
      roles,
    });
  } catch (error) {
    console.error('Ошибка при создании пресета:', error);
    res.status(500).json({ error: 'Ошибка при создании пресета' });
  }
});

// DELETE - remove preset
app.delete('/api/role-presets/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM role_presets WHERE id = ?');
    stmt.run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при удалении пресета:', error);
    res.status(500).json({ error: 'Ошибка при удалении пресета' });
  }
});

// ==================== GAME ROUTES ====================

// GET current game
app.get('/api/game/current', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT gp.*, u.nick, u.tiktok_id 
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      JOIN users u ON gp.user_id = u.id
      WHERE g.status = 'active'
      ORDER BY gp.id ASC
    `);
    const players = stmt.all();
    res.json(players);
  } catch (error) {
    console.error('Ошибка получения игры:', error);
    res.status(500).json({ error: 'Ошибка при получении игры' });
  }
});

// POST - start game
app.post('/api/game/start', (req, res) => {
  try {
    const { preset_id, player_count } = req.body;

    // Get queue players
    const queueStmt = db.prepare(`
      SELECT u.* FROM users u
      JOIN queue q ON u.id = q.user_id
      ORDER BY q.position ASC
      LIMIT ?
    `);
    const queuePlayers = queueStmt.all(player_count);

    if (queuePlayers.length < player_count) {
      return res.status(400).json({ error: 'Недостаточно игроков в очереди' });
    }

    // Get preset
    const presetStmt = db.prepare('SELECT * FROM role_presets WHERE id = ?');
    const preset = presetStmt.get(preset_id);

    if (!preset) {
      return res.status(400).json({ error: 'Пресет не найден' });
    }

    const roles = JSON.parse(preset.roles);

    // Create game
    const gameStmt = db.prepare('INSERT INTO games (preset_id, status) VALUES (?, ?)');
    const gameResult = gameStmt.run(preset_id, 'active');
    const gameId = gameResult.lastInsertRowid;

    // Add players to game
    const playerStmt = db.prepare(`
      INSERT INTO game_players (game_id, user_id, role)
      VALUES (?, ?, ?)
    `);

    const gamePlayers = queuePlayers.map((player, idx) => ({
      id: player.id,
      nick: player.nick,
      tiktok_id: player.tiktok_id,
      tg_id: player.tg_id,
      role: roles[idx],
      card_sent: 0,
    }));

    gamePlayers.forEach((player, idx) => {
      playerStmt.run(gameId, player.id, roles[idx]);
    });

    res.json({
      game_id: gameId,
      game: gamePlayers,
    });
  } catch (error) {
    console.error('Ошибка при запуске игры:', error);
    res.status(500).json({ error: 'Ошибка при запуске игры' });
  }
});

// POST - send cards (заготовка для реальной отправки в Telegram!)
app.post('/api/game/send-cards', async (req, res) => {
  try {
    // Get current game players
    const stmt = db.prepare(`
      SELECT gp.id, gp.game_id, gp.user_id, gp.role, u.nick, u.tg_id
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      JOIN users u ON gp.user_id = u.id
      WHERE g.status = 'active' AND gp.card_sent = 0
    `);
    const players = stmt.all();

    // Отправка карт через Telegram API
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    let sentCount = 0;
    for (const player of players) {
      if (player.tg_id) {
        try {
          const text = `Ваша роль: ${player.role}\nНик: ${player.nick}`;
          const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
          await axios.post(url, {
            chat_id: player.tg_id,
            text: text,
            parse_mode: 'HTML'
          });
          sentCount++;
        } catch (e) {
          console.log(`❌ Не удалось отправить карту игроку ${player.nick} (${player.tg_id})`);
        }
      }
    }

    // Mark cards as sent
    const updateStmt = db.prepare('UPDATE game_players SET card_sent = 1 WHERE card_sent = 0 AND game_id IN (SELECT id FROM games WHERE status = ?)');
    updateStmt.run('active');

    res.json({ success: true, sent: sentCount });
  } catch (error) {
    console.error('Ошибка при отправке карт:', error);
    res.status(500).json({ error: 'Ошибка при отправке карт' });
  }
});

// POST - end game
app.post('/api/game/end', (req, res) => {
  try {
    // End active game
    const stmt = db.prepare('UPDATE games SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE status = ?');
    stmt.run('ended', 'active');

    // Clear queue
    db.exec('DELETE FROM queue');

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при завершении игры:', error);
    res.status(500).json({ error: 'Ошибка при завершении игры' });
  }
});

// ==================== TIKTOK CONNECTION ROUTES ====================

// POST - connect to TikTok
app.post('/api/tiktok/connect', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    // Save username to config
    const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    stmt.run('tiktok_username', username);

    // Start listener
    startTikTokListener();

    res.json({ success: true, message: 'Connecting to TikTok...' });
  } catch (error) {
    console.error('Ошибка подключения TikTok:', error);
    res.status(500).json({ error: 'Ошибка подключения' });
  }
});

// POST - disconnect from TikTok
app.post('/api/tiktok/disconnect', async (req, res) => {
  try {
    await stopTikTokListener();
    global.tiktokConnected = false;

    res.json({ success: true, message: 'Disconnected from TikTok' });
  } catch (error) {
    console.error('Ошибка отключения TikTok:', error);
    res.status(500).json({ error: 'Ошибка отключения' });
  }
});

// ==================== REGISTRATION LOGS ROUTES ====================

// GET registration logs
app.get('/api/registration-logs', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM registration_logs
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const logs = stmt.all();
    res.json(logs);
  } catch (error) {
    console.error('Ошибка получения логов:', error);
    res.status(500).json({ error: 'Ошибка при получении логов' });
  }
});

// GET registration logs count
app.get('/api/registration-logs/count', (req, res) => {
  try {
    const stmt1 = db.prepare('SELECT COUNT(*) as count FROM registration_logs WHERE status = ?');
    const successful = stmt1.get('success').count;
    
    const stmt2 = db.prepare('SELECT COUNT(*) as count FROM registration_logs WHERE status = ?');
    const failed = stmt2.get('failed').count;
    
    res.json({ successful, failed });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка при получении статистики' });
  }
});

// ==================== INITIALIZE SERVICES ====================

// Initialize Telegram bot
initializeTelegramBot();

// Start TikTok listener
startTikTokListener();

// ==================== START SERVER ====================

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});