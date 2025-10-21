const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../database/mafia.db');
const db = new sqlite3.Database(dbPath);

// Инициализация БД
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Таблица пользователей
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tg_id INTEGER UNIQUE NOT NULL,
          tiktok_id TEXT UNIQUE NOT NULL,
          nick TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Таблица очереди
      db.run(`
        CREATE TABLE IF NOT EXISTS queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `);

      // Таблица пресетов ролей
      db.run(`
        CREATE TABLE IF NOT EXISTS role_presets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          player_count INTEGER NOT NULL,
          roles TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Таблица текущей игры
      db.run(`
        CREATE TABLE IF NOT EXISTS current_game (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          role TEXT NOT NULL,
          card_sent BOOLEAN DEFAULT 0,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });

      // Таблица конфига (username ведущего)
      db.run(`
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `, (err) => {
        if (err) reject(err);
        else {
          // Вставляем дефолтный username
          db.run(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`, 
            ['tiktok_username', 'jafarov110']
          );
          resolve();
        }
      });
    });
  });
};

// Методы работы с БД
const dbMethods = {
  // ===== USERS =====
  addUser: (tg_id, tiktok_id, nick) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO users (tg_id, tiktok_id, nick) VALUES (?, ?, ?)`,
        [tg_id, tiktok_id, nick],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getUserByTikTokId: (tiktok_id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE tiktok_id = ?`,
        [tiktok_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  getUserByTgId: (tg_id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM users WHERE tg_id = ?`,
        [tg_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  },

  getAllUsers: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM users ORDER BY created_at DESC`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  deleteUser: (id) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM users WHERE id = ?`, [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  updateUser: (id, tiktok_id, nick) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET tiktok_id = ?, nick = ? WHERE id = ?`,
        [tiktok_id, nick, id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  // ===== QUEUE =====
  addToQueue: (user_id) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO queue (user_id) VALUES (?)`,
        [user_id],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getQueue: () => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT q.id, u.id as user_id, u.tg_id, u.tiktok_id, u.nick 
         FROM queue q 
         JOIN users u ON q.user_id = u.id 
         ORDER BY q.added_at ASC`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  getQueueCount: () => {
    return new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM queue`, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  },

  removeFromQueue: (queue_id) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM queue WHERE id = ?`, [queue_id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  clearQueue: () => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM queue`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  checkUserInQueue: (user_id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT id FROM queue WHERE user_id = ?`,
        [user_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        }
      );
    });
  },

  // ===== ROLE PRESETS =====
  addRolePreset: (name, player_count, roles) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO role_presets (name, player_count, roles) VALUES (?, ?, ?)`,
        [name, player_count, JSON.stringify(roles)],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  },

  getRolePresets: () => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM role_presets ORDER BY player_count ASC`,
        (err, rows) => {
          if (err) reject(err);
          else {
            const parsed = rows.map(r => ({
              ...r,
              roles: JSON.parse(r.roles)
            }));
            resolve(parsed || []);
          }
        }
      );
    });
  },

  getRolePresetById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM role_presets WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) reject(err);
          else if (row) {
            row.roles = JSON.parse(row.roles);
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  },

  deleteRolePreset: (id) => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM role_presets WHERE id = ?`, [id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // ===== CURRENT GAME =====
  startGame: (players, roles) => {
    return new Promise((resolve, reject) => {
      // Очистить старую игру
      db.run(`DELETE FROM current_game`, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Перемешать роли
        const shuffledRoles = roles.sort(() => Math.random() - 0.5);

        // Вставить игроков с ролями
        let inserted = 0;
        players.forEach((player, index) => {
          db.run(
            `INSERT INTO current_game (user_id, role) VALUES (?, ?)`,
            [player.user_id, shuffledRoles[index]],
            (err) => {
              if (err) reject(err);
              inserted++;
              if (inserted === players.length) {
                resolve();
              }
            }
          );
        });
      });
    });
  },

  getCurrentGame: () => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cg.*, u.tg_id, u.nick 
         FROM current_game cg 
         JOIN users u ON cg.user_id = u.id`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  },

  markCardAsSent: (game_id) => {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE current_game SET card_sent = 1 WHERE id = ?`,
        [game_id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  },

  clearCurrentGame: () => {
    return new Promise((resolve, reject) => {
      db.run(`DELETE FROM current_game`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  // ===== CONFIG =====
  getConfig: (key) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT value FROM config WHERE key = ?`,
        [key],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.value : null);
        }
      );
    });
  },

  setConfig: (key, value) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`,
        [key, value],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
};

module.exports = { db, initDatabase, ...dbMethods };