import { useEffect, useState } from 'react';
import Navigation from '../components/Navigation';
import axios from 'axios';
import { Trash2, Plus } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const AVAILABLE_ROLES = [
  { name: 'Мирный', emoji: '👤', color: 'blue' },
  { name: 'Мафия', emoji: '🎭', color: 'red' },
  { name: 'Комиссар', emoji: '🔍', color: 'yellow' },
  { name: 'Охотник', emoji: '🏹', color: 'green' },
  { name: 'Врач', emoji: '⚕️', color: 'pink' },
];

export default function ManageRoles() {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playerCount, setPlayerCount] = useState(6);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [presetName, setPresetName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPresets();
  }, []);

  useEffect(() => {
    // Initialize roles array based on player count
    setSelectedRoles(Array(playerCount).fill('Мирный'));
  }, [playerCount]);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/role-presets`);
      setPresets(res.data);
    } catch (error) {
      console.error('Ошибка получения пресетов:', error);
      alert('❌ Ошибка при загрузке пресетов');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePreset = async () => {
    if (!presetName.trim()) {
      alert('⚠️ Введи название пресета!');
      return;
    }

    setCreating(true);
    try {
      await axios.post(`${API_URL}/api/role-presets`, {
        name: presetName,
        player_count: playerCount,
        roles: selectedRoles,
      });

      setPresetName('');
      setPlayerCount(6);
      setSelectedRoles(Array(6).fill('Мирный'));
      fetchPresets();
      alert('✅ Пресет создан!');
    } catch (error) {
      alert('❌ Ошибка при создании пресета');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePreset = async (id) => {
    if (!confirm('⚠️ Точно удалить пресет?')) return;

    try {
      await axios.delete(`${API_URL}/api/role-presets/${id}`);
      fetchPresets();
      alert('✅ Пресет удален');
    } catch (error) {
      alert('❌ Ошибка при удалении');
      console.error(error);
    }
  };

  const updateRole = (index, role) => {
    const newRoles = [...selectedRoles];
    newRoles[index] = role;
    setSelectedRoles(newRoles);
  };

  return (
    <>
      <Navigation />
      <main className="container-custom py-8">
        <h1 className="text-4xl font-bold gradient-text mb-8">🎭 Управление ролями</h1>

        {/* Create Preset */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-6 gradient-text">➕ Создать новый пресет</h2>

          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-2">📝 Название пресета</label>
            <input
              type="text"
              placeholder="Например: Стандартная 6 игроков"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="input-field w-full"
            />
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-400 block mb-4">👥 Выбери количество игроков</label>
            <div className="flex gap-2 flex-wrap">
              {[3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <button
                  key={num}
                  onClick={() => setPlayerCount(num)}
                  className={`px-4 py-2 rounded-lg font-bold transition ${
                    playerCount === num
                      ? 'btn-primary bg-purple-600'
                      : 'btn-primary bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <label className="text-sm text-gray-400 block mb-4">🎭 Распредели роли</label>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedRoles.map((role, idx) => (
                <div key={idx} className="bg-dark/50 p-3 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2">Игрок {idx + 1}</p>
                  <select
                    value={role}
                    onChange={(e) => updateRole(idx, e.target.value)}
                    className="input-field w-full"
                  >
                    {AVAILABLE_ROLES.map(r => (
                      <option key={r.name} value={r.name}>
                        {r.emoji} {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreatePreset}
            disabled={creating}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            {creating ? '⏳ Создаю...' : 'Создать пресет'}
          </button>
        </div>

        {/* Presets List */}
        <div>
          <h2 className="text-2xl font-bold mb-6">📋 Сохраненные пресеты ({presets.length})</h2>

          {loading ? (
            <div className="text-center py-8">⏳ Загрузка...</div>
          ) : presets.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-400">Нет сохраненных пресетов</p>
              <p className="text-sm text-gray-500 mt-2">
                Создай первый пресет выше 👆
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {presets.map((preset) => {
                const roleCounts = {};
                preset.roles.forEach(role => {
                  roleCounts[role] = (roleCounts[role] || 0) + 1;
                });

                return (
                  <div key={preset.id} className="card">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold">{preset.name}</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          👥 {preset.player_count} игроков
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="btn-primary p-2 bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="space-y-2 text-sm">
                      {Object.entries(roleCounts).map(([role, count]) => {
                        const roleObj = AVAILABLE_ROLES.find(r => r.name === role);
                        return (
                          <div key={role} className="flex justify-between text-gray-300">
                            <span>{roleObj?.emoji} {role}:</span>
                            <span className="font-bold">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}