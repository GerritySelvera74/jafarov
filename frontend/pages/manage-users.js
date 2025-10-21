import { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import axios from 'axios';
import { Trash2, Edit2, Plus, Activity } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  
  // Форма добавления
  const [newUser, setNewUser] = useState({
    tiktok_id: '',
    nick: '',
    tg_id: '',
    phone: '',
  });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchLogs();
    
    // Обновляем логи каждые 2 секунды
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/users`);
      setUsers(res.data);
    } catch (error) {
      console.error('Ошибка получения пользователей:', error);
      alert('❌ Ошибка при загрузке пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/registration-logs`);
      setLogs(res.data);
    } catch (error) {
      console.error('Ошибка получения логов:', error);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.tiktok_id.trim() || !newUser.nick.trim()) {
      alert('⚠️ Заполни TikTok ID и Nick!');
      return;
    }

    setAdding(true);
    try {
      await axios.post(`${API_URL}/api/users`, {
        tiktok_id: newUser.tiktok_id.trim(),
        nick: newUser.nick.trim(),
        tg_id: newUser.tg_id.trim() || null,
        phone: newUser.phone.trim() || null,
      });
      
      setNewUser({ tiktok_id: '', nick: '', tg_id: '', phone: '' });
      fetchUsers();
      alert('✅ Пользователь добавлен!');
    } catch (error) {
      alert('❌ Ошибка при добавлении пользователя');
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('⚠️ Точно удалить пользователя?')) return;

    try {
      await axios.delete(`${API_URL}/api/users/${id}`);
      setUsers(users.filter(u => u.id !== id));
      alert('✅ Пользователь удален');
    } catch (error) {
      alert('❌ Ошибка при удалении');
      console.error(error);
    }
  };

  const handleEdit = (user) => {
    setEditingId(user.id);
    setEditData({
      tiktok_id: user.tiktok_id,
      nick: user.nick,
      tg_id: user.tg_id || '',
      phone: user.phone || '',
    });
  };

  const handleSaveEdit = async (id) => {
    if (!editData.tiktok_id.trim() || !editData.nick.trim()) {
      alert('⚠️ Заполни TikTok ID и Nick!');
      return;
    }

    try {
      await axios.put(`${API_URL}/api/users/${id}`, editData);
      fetchUsers();
      setEditingId(null);
      alert('✅ Пользователь обновлен');
    } catch (error) {
      alert('❌ Ошибка при обновлении');
      console.error(error);
    }
  };

  const getLogStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return '✅ Успешно';
      case 'failed':
        return '❌ Ошибка';
      case 'already_queued':
        return '⚠️ Уже в очереди';
      default:
        return status;
    }
  };

  const getLogStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'already_queued':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <>
      <Navigation />
      <main className="container-custom py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold gradient-text">👥 Управление пользователями</h1>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="btn-primary flex items-center gap-2"
          >
            <Activity size={20} />
            {showLogs ? 'Скрыть логи' : 'Показать логи'}
          </button>
        </div>

        {/* Logs Panel */}
        {showLogs && (
          <div className="card mb-8">
            <h2 className="text-2xl font-bold mb-6 gradient-text">📊 Логи регистраций из TikTok</h2>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-400 text-center py-8">Нет логов</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="bg-dark/50 p-3 rounded-lg text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">
                          @{log.tiktok_username} <span className="text-purple-400">({log.nick})</span>
                        </p>
                        <p className={`text-xs mt-1 ${getLogStatusColor(log.status)}`}>
                          {getLogStatusBadge(log.status)}
                        </p>
                        {log.message && (
                          <p className="text-xs text-gray-400 mt-1">{log.message}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                        {new Date(log.created_at).toLocaleTimeString('ru-RU')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Form Add User */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-6 gradient-text">➕ Добавить нового пользователя</h2>
          
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="text-sm text-gray-400 block mb-2">🎵 TikTok ID *</label>
              <input
                type="text"
                placeholder="jafarov110"
                value={newUser.tiktok_id}
                onChange={(e) => setNewUser({ ...newUser, tiktok_id: e.target.value })}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">👤 Nick в игре *</label>
              <input
                type="text"
                placeholder="Иван"
                value={newUser.nick}
                onChange={(e) => setNewUser({ ...newUser, nick: e.target.value })}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">💬 Telegram ID (опционально)</label>
              <input
                type="text"
                placeholder="123456789"
                value={newUser.tg_id}
                onChange={(e) => setNewUser({ ...newUser, tg_id: e.target.value })}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">☎️ Номер телефона (опционально)</label>
              <input
                type="text"
                placeholder="+79999999999"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                className="input-field w-full"
              />
            </div>
          </div>

          <button
            onClick={handleAddUser}
            disabled={adding}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {adding ? '⏳ Добавляю...' : 'Добавить пользователя'}
          </button>
        </div>

        {/* Users List */}
        <div>
          <h2 className="text-2xl font-bold mb-6">📋 Список пользователей ({users.length})</h2>

          {loading ? (
            <div className="text-center py-8">⏳ Загрузка...</div>
          ) : users.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">Нет зарегистрированных пользователей</p>
              <p className="text-sm text-gray-500 mt-2">
                Добавь их вручную через форму выше 👆
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {users.map((user) => (
                <div key={user.id} className="card">
                  {editingId === user.id ? (
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm text-gray-400">TikTok ID:</label>
                          <input
                            type="text"
                            value={editData.tiktok_id}
                            onChange={(e) => setEditData({ ...editData, tiktok_id: e.target.value })}
                            className="input-field w-full mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Nick:</label>
                          <input
                            type="text"
                            value={editData.nick}
                            onChange={(e) => setEditData({ ...editData, nick: e.target.value })}
                            className="input-field w-full mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Telegram ID:</label>
                          <input
                            type="text"
                            value={editData.tg_id}
                            onChange={(e) => setEditData({ ...editData, tg_id: e.target.value })}
                            className="input-field w-full mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-sm text-gray-400">Телефон:</label>
                          <input
                            type="text"
                            value={editData.phone}
                            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                            className="input-field w-full mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(user.id)}
                          className="btn-primary flex-1"
                        >
                          💾 Сохранить
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="btn-primary flex-1 bg-gray-600 hover:bg-gray-700"
                        >
                          ❌ Отмена
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-xl font-bold">{user.nick}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          <p className="text-gray-400">🎵 TikTok: <span className="text-purple-400">{user.tiktok_id}</span></p>
                          {user.tg_id && <p className="text-gray-400">💬 TG: <span className="text-purple-400">{user.tg_id}</span></p>}
                          {user.phone && <p className="text-gray-400">☎️ Телефон: <span className="text-purple-400">{user.phone}</span></p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="btn-primary p-2"
                          title="Редактировать"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="btn-primary p-2 bg-red-600 hover:bg-red-700"
                          title="Удалить"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}