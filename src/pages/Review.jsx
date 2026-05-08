import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FolderUp, Play } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard } from '../components/shared.jsx';
import { AnalysisState, PremiumDropdown } from '../components/display.jsx';

export function Review({ analysis, setAnalysis }) {
  const [liveEmployees, setLiveEmployees] = useState([]);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Стандарт поддержки');

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

  useEffect(() => {
    if (analysis !== 'running') return undefined;

    const timer = window.setTimeout(() => {
      setAnalysis('complete');
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [analysis, setAnalysis]);

  const startAnalysis = () => {
    setAnalysis('running');
  };

  return (
    <div className="review-layout">
      <PremiumCard className="review-main" title="Новая проверка диалогов" action="Демо-режим">
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
          <span>CSV, XLSX, TXT. Только визуальная зона, без загрузки и парсинга.</span>
        </motion.div>
        <div className="file-list">
          {['dialogs_april_shift_a.csv', 'chat_export_romanova_184.xlsx', 'support_cases_sample.txt'].map((file, index) => (
            <div className="file-row" key={file}>
              <FileText size={16} />
              <span>{file}</span>
              <b>{index === 0 ? 'Готов' : 'В очереди'}</b>
            </div>
          ))}
        </div>
        <motion.button className="primary-button large glow" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={startAnalysis}>
          <Play size={18} />
          {analysis === 'running' ? 'Анализ выполняется' : 'Начать анализ'}
        </motion.button>
      </PremiumCard>
      <PremiumCard title="Состояние анализа" action={analysis === 'complete' ? 'Готово' : analysis === 'running' ? 'Выполняется' : 'Ожидает запуска'}>
        <AnalysisState status={analysis} />
      </PremiumCard>
    </div>
  );
}
