import { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import axios from 'axios';
import { Play, Send, Square } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function GameControl() {
  const [presets, setPresets] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentGame, setCurrentGame] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameActive, setGameActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [presetsRes, queueRes, gameRes] = await Promise.all([
        axios.get(`${API_URL}/api/role-presets`),
        axios.get(`${API_URL}/api/queue`),
        axios.get(`${API_URL}/api/game/current`),
      ]);

      setPresets(presetsRes.data);
      setQueue(queueRes.data);
      setCurrentGame(gameRes.data);
      setGameActive(gameRes.data.length > 0);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка получения данных:', error);
    }
  };

  const handleStartGame = async () => {
    if (!selectedPreset) {
      alert('⚠️ Выбери пресет роли!');
      return;
    }

    if (queue.length < selectedPreset.player_count) {
      alert(`⚠️ Недостаточно игроков! Нужно: ${selectedPreset.player_count}, есть: ${queue.length}`);
      return;
    }

    setStarting(true);
    try {
      await axios.post(`${API_URL}/api/game/start`, {
        preset_id: selectedPreset.id,
        player_count: selectedPreset.player_count,
      });

      alert('✅ Игра запущена!');
      fetchData();
    } catch (error) {
      alert('❌ Ошибка при запуске игры');
      console.error(error);
    } finally {
      setStarting(false);
    }
  };

  const handleSendCards = async () => {
    setSending(true);
    try {
      await axios.post(`${API_URL}/api/game/send-cards`);
      alert('✅ Карты отправлены в ТГ!');
      fetchData();
    } catch (error) {
      alert('❌ Ошибка при отправке карт');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleEndGame = async () => {
    if (!confirm('⚠️ Точно завершить игру?')) return;

    try {
      await axios.post(`${API_URL}/api/game/end`);
      alert('✅ Игра завершена!');
      setGameActive(false);
      fetchData();
    } catch (error) {
      alert('❌ Ошибка при завершении игры');
      console.error(error);
    }
  };

  if (loading) {
    return (
      <>
        <Navigation />
        <main className="container-custom py-8">⏳ Загрузка...</main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="container-custom py-8">
        <h1 className="text-4xl font-bold gradient-text mb-8">🎮 Управление игрой</h1>

        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Start Game Panel */}
          <div className="card md:col-span-2">
            <h2 className="text-2xl font-bold mb-6 gradient-text">🚀 Запустить игру</h2>

            <div className="mb-6">
              <label className="text-sm text-gray-400 block mb-3">Выбери пресет ролей:</label>
              <select
                value={selectedPreset?.id || ''}
                onChange={(e) => {
                  const preset = presets.find(p => p.id === parseInt(e.target.value));
                  setSelectedPreset(preset);
                }}
                className="input-field w-full"
              >
                <option value="">-- Выбери пресет --</option>
                {presets.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.player_count} игроков)
                  </option>
                ))}
              </select>
            </div>

            {selectedPreset && (
              <div className="bg-dark/50 p-4 rounded-lg mb-6 border border-purple-500/20">
                <p className="text-sm text-gray-400 mb-3">Роли в этом пресете:</p>
                <div className="space-y-1">
                  {selectedPreset.roles.map((role, idx) => (
                    <p key={idx} className="text-sm">
                      {idx + 1}. <span className="text-purple-400 font-bold">{role}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 p-4 bg-blue-900/20 rounded-lg border border-blue-500/20">
              <p className="text-sm text-gray-300">
                ℹ️ В очереди: <span className="font-bold text-blue-400">{queue.length}</span> игроков
              </p>
              {selectedPreset && (
                <p className="text-sm text-gray-300 mt-2">
                  Нужно для игры: <span className="font-bold text-blue-400">{selectedPreset.player_count}</span> игроков
                </p>
              )}
            </div>

            <button
              onClick={handleStartGame}
              disabled={starting || gameActive}
              className={`w-full py-3 rounded-lg font-bold transition flex items-center justify-center gap-2 ${
                gameActive
                  ? 'btn-primary bg-gray-600 cursor-not-allowed'
                  : 'btn-primary bg-green-600 hover:bg-green-700'
              }`}
            >
              <Play size={20} />
              {starting ? '⏳ Запускаю...' : gameActive ? '🎮 Игра уже запущена' : '🚀 Запустить игру'}
            </button>
          </div>

          {/* Queue Panel */}
          <div className="card">
            <h3 className="text-xl font-bold mb-4 gradient-text">📋 Очередь ({queue.length})</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {queue.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Очередь пуста</p>
              ) : (
                queue.map((player, idx) => (
                  <div key={player.id} className="bg-dark/50 p-2 rounded text-sm">
                    <p className="font-bold text-purple-400">{idx + 1}. {player.nick}</p>
                    <p className="text-xs text-gray-500">@{player.tiktok_id}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Current Game */}
        {gameActive && currentGame.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-2xl font-bold mb-6 gradient-text">🎭 Текущая игра</h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {currentGame.map((player) => (
                <div key={player.id} className="bg-dark/50 p-4 rounded-lg">
                  <p className="font-bold text-lg">{player.nick}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-gray-400">
                      🎵 TikTok: <span className="text-purple-400">{player.tiktok_id}</span>
                    </p>
                    <p className="text-gray-400">
                      🎭 Роль: <span className="text-yellow-400 font-bold">{player.role}</span>
                    </p>
                    <p className="text-gray-400">
                      {player.card_sent ? '✅ Карта отправлена' : '⏳ Ожидает карту'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendCards}
                disabled={sending}
                className="flex-1 btn-primary bg-blue-600 hover:bg-blue-700 py-3 flex items-center justify-center gap-2"
              >
                <Send size={20} />
                {sending ? '⏳ Отправляю...' : '📤 Отправить карты'}
              </button>
              <button
                onClick={handleEndGame}
                className="flex-1 btn-primary bg-red-600 hover:bg-red-700 py-3 flex items-center justify-center gap-2"
              >
                <Square size={20} />
                Завершить игру
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}