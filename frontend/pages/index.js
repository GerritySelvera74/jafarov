import { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const [status, setStatus] = useState({});
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchTiktokUsername();
    
    // Poll status every 2 seconds
    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/status`);
      setStatus(res.data);
    } catch (error) {
      console.error('Ошибка получения статуса:', error);
    }
  };

  const fetchTiktokUsername = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/config/tiktok_username`);
      setTiktokUsername(res.data.value);
      setNewUsername(res.data.value);
    } catch (error) {
      console.error('Ошибка получения username:', error);
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      alert('Введи username!');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/config/tiktok_username`, {
        value: newUsername.trim(),
      });
      setTiktokUsername(newUsername);
      alert('✅ Username обновлен!');
    } catch (error) {
      alert('❌ Ошибка при обновлении username');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!tiktokUsername) {
      alert('❌ Сначала установи TikTok username!');
      return;
    }

    setConnecting(true);
    try {
      await axios.post(`${API_URL}/api/tiktok/connect`, {
        username: tiktokUsername,
      });
      alert('✅ Подключение к TikTok инициировано!');
      await fetchStatus();
    } catch (error) {
      alert('❌ Ошибка при подключении');
      console.error(error);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnecting(true);
    try {
      await axios.post(`${API_URL}/api/tiktok/disconnect`);
      alert('✅ Отключено от TikTok!');
      await fetchStatus();
    } catch (error) {
      alert('❌ Ошибка при отключении');
      console.error(error);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      <Navigation />
      <main className="container-custom py-12">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Welcome Card */}
          <div className="card">
            <h1 className="gradient-text text-4xl font-bold mb-4">
              🎮 MAFIA TT Game
            </h1>
            <p className="text-gray-300 mb-6">
              Система управления игрой в мафию на TikTok стримах. Регистрируй игроков, управляй ролями и раздавай карты!
            </p>
            <div className="space-y-3">
              <p className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                Бот для ТГ: <span className="font-bold text-purple-400">@TTMAFbot</span>
              </p>
              <p className="text-sm text-gray-400">
                Люди могут зарегистрироваться через веб-интерфейс и участвовать в очереди!
              </p>
            </div>
          </div>

          {/* Status Card */}
          <div className="card">
            <h2 className="text-2xl font-bold mb-4 gradient-text">📊 Статус системы</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>База данных:</span>
                <span className={status.db ? '🟢 Активна' : '🔴 Отключена'}>
                  {status.db ? '🟢 Активна' : '🔴 Отключена'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>TikTok стрим:</span>
                <span>
                  {status.tiktok ? '🟢 Подключено' : '🔴 Отключено'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-dark/50 rounded-lg">
                <span>Telegram Bot:</span>
                <span>
                  {status.bot ? '🟢 Работает' : '🔴 Не работает'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TikTok Username Config */}
        <div className="card mt-8">
          <h2 className="text-2xl font-bold mb-6 gradient-text">⚙️ Настройки TikTok</h2>
          
          <div className="bg-dark/50 p-4 rounded-lg mb-6 border border-purple-500/20">
            <p className="text-sm text-gray-300 mb-2">Текущий username:</p>
            <p className="text-xl font-bold text-purple-400">@{tiktokUsername || 'не установлен'}</p>
          </div>

          <div className="flex gap-3 flex-wrap mb-6">
            <input
              type="text"
              placeholder="Введи новый username (без @)"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="input-field flex-1 min-w-[200px]"
            />
            <button
              onClick={handleUpdateUsername}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? '⏳ Сохранение...' : '💾 Сохранить'}
            </button>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            ℹ️ Измени username TikTok ведущего. Бот будет слушать его стрим и ловить команды !reg
          </p>

          {/* Connect/Disconnect Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleConnect}
              disabled={connecting || status.tiktok}
              className={`flex-1 py-3 rounded-lg font-bold transition ${
                status.tiktok
                  ? 'bg-green-600/50 text-green-300 cursor-not-allowed'
                  : 'btn-primary hover:bg-green-600'
              }`}
            >
              {connecting ? '⏳ Подключаю...' : status.tiktok ? '✅ Подключено' : '🔗 Подключиться'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={connecting || !status.tiktok}
              className={`flex-1 py-3 rounded-lg font-bold transition ${
                !status.tiktok
                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                  : 'btn-primary bg-red-600 hover:bg-red-700'
              }`}
            >
              {connecting ? '⏳ Отключаю...' : '❌ Отключиться'}
            </button>
          </div>
        </div>

        {/* Bot Link */}
        <div className="card mt-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30">
          <h3 className="text-xl font-bold mb-3">🔗 Поделись ссылкой на бота</h3>
          <div className="bg-dark/50 p-4 rounded-lg mb-4 font-mono text-sm">
            https://t.me/TTMAFbot
          </div>
          <p className="text-sm text-gray-300">
            Отправь эту ссылку людям, чтобы они зарегистрировались через веб-интерфейс
          </p>
        </div>
      </main>
    </>
  );
}