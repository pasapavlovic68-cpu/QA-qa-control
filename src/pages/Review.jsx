import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderUp, Play } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard } from '../components/shared.jsx';
import { AnalysisState, PremiumDropdown } from '../components/display.jsx';

export function Review({ analysis }) {
  const [liveEmployees, setLiveEmployees] = useState([]);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Стандарт поддержки');
  const [notReady, setNotReady] = useState(false);

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Review] fetch employees error:', error);
          return;
        }
        const list = data ?? [];
        setLiveEmployees(list);
        if (list.length > 0) setSelectedEmployeeName(list[0].name);
      });
  }, []);

  return (
    <div className="review-layout">
      <PremiumCard className="review-main" title="Новая проверка диалогов" action="Скоро">
        <div className="form-row">
          <label>
            <span>Сотрудник</span>
            {liveEmployees.length > 0 ? (
              <PremiumDropdown
                value={selectedEmployeeName}
                options={liveEmployees.map((e) => e.name)}
                onChange={setSelectedEmployeeName}
              />
            ) : (
              <span className="premium-select-trigger" style={{ opacity: 0.5, cursor: 'default', pointerEvents: 'none' }}>
                Сначала добавьте сотрудника
              </span>
            )}
          </label>
          <label>
            <span>Набор правил QA</span>
            <PremiumDropdown
              value={selectedPreset}
              options={['Стандарт поддержки', 'Продажи и удержание', 'B2B сопровождение']}
              onChange={setSelectedPreset}
            />
          </label>
        </div>
        <motion.div className="upload-zone" tabIndex={0} whileHover={{ scale: 1.006, borderColor: '#8d7cf6' }} whileFocus={{ scale: 1.006, borderColor: '#8d7cf6' }}>
          <FolderUp size={30} />
          <strong>Перетащите файлы диалогов сюда</strong>
          <span>CSV, XLSX, TXT — подключение загрузки на следующем этапе.</span>
        </motion.div>
        <div className="file-list" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', opacity: 0.4 }}>
          <span style={{ fontSize: '0.875rem' }}>Файлы пока не загружены — реальная загрузка файлов будет подключена на следующем этапе.</span>
        </div>
        <motion.button
          className="primary-button large"
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -2 }}
          onClick={() => setNotReady(true)}
        >
          <Play size={18} />
          Начать анализ
        </motion.button>
        {notReady && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: '0.82rem', opacity: 0.55, textAlign: 'center', marginTop: 8 }}
          >
            AI-анализ ещё не подключён — сначала будет подключена загрузка файлов и OpenAI API.
          </motion.p>
        )}
      </PremiumCard>
      <PremiumCard title="Состояние анализа" action="Ожидает запуска">
        <AnalysisState status={analysis} />
      </PremiumCard>
    </div>
  );
}
