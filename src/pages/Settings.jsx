import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal } from 'lucide-react';
import { supabase } from '../lib/supabase.js';

const FIELD_META = {
  company_instruction: {
    label: 'Инструкция для компании',
    hint: 'Общий контекст о компании для AI-анализа',
    type: 'textarea',
  },
  sales_goal: {
    label: 'Цель продаж',
    hint: 'Описание целей и KPI для менеджеров',
    type: 'textarea',
  },
  report_style: {
    label: 'Стиль отчёта',
    hint: 'Формат итогового отчёта по проверке',
    type: 'select',
    options: [
      { value: 'management_report', label: 'Управленческий отчёт' },
      { value: 'detailed', label: 'Детальный' },
      { value: 'brief', label: 'Краткий' },
    ],
  },
  forbidden_phrases: {
    label: 'Запрещённые фразы',
    hint: 'Каждая фраза с новой строки',
    type: 'textarea',
  },
  upsell_strategy: {
    label: 'Стратегия допродаж',
    hint: 'Инструкции по апселлу для AI-анализа',
    type: 'textarea',
  },
  critical_moments: {
    label: 'Критические моменты',
    hint: 'Каждый момент с новой строки',
    type: 'textarea',
  },
};

const KEY_ORDER = [
  'company_instruction',
  'sales_goal',
  'report_style',
  'forbidden_phrases',
  'upsell_strategy',
  'critical_moments',
];

export function Settings({ organizationId }) {
  const [values, setValues] = useState({});
  const [original, setOriginal] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // 'success' | 'error' | null

  useEffect(() => {
    if (!organizationId) return;
    supabase
      .from('team_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .order('key')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Settings] fetch error:', error);
          setLoading(false);
          return;
        }
        const map = {};
        (data ?? []).forEach((row) => {
          map[row.key] = row.value ?? '';
        });
        setValues(map);
        setOriginal(map);
        setLoading(false);
      });
  }, [organizationId]);

  const handleChange = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setStatus(null);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!organizationId) {
      console.error('[Settings] organizationId missing, aborting save');
      setStatus('error');
      return;
    }
    setSaving(true);
    setStatus(null);

    const upserts = Object.entries(values).map(([key, value]) => ({ key, value: value ?? '', organization_id: organizationId }));

    const { error } = await supabase
      .from('team_settings')
      .upsert(upserts, { onConflict: 'organization_id,key' });

    setSaving(false);

    if (error) {
      console.error('[Settings] save error:', error);
      setStatus('error');
      return;
    }

    setOriginal({ ...values });
    setStatus('success');
  };

  const orderedKeys = KEY_ORDER.filter((k) => k in values || k in FIELD_META);

  return (
    <>
      <div className="rules-head">
        <div>
          <span className="eyebrow">Команда / AI</span>
          <h2>Настройки анализа</h2>
        </div>
        <motion.button
          className="primary-button"
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -2 }}
          onClick={handleSave}
          disabled={saving}
        >
          <SlidersHorizontal size={17} />
          {saving ? 'Сохраняем…' : 'Сохранить настройки'}
        </motion.button>
      </div>

      {status === 'success' && (
        <p style={{ color: 'var(--green, #34d399)', fontSize: '0.875rem', marginBottom: 8 }}>
          Настройки успешно сохранены.
        </p>
      )}
      {status === 'error' && (
        <p style={{ color: 'var(--red, #f87171)', fontSize: '0.875rem', marginBottom: 8 }}>
          Ошибка при сохранении. Проверьте соединение с базой данных.
        </p>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Загружаем настройки…</p>
        </div>
      ) : (
        <motion.div
          className="rules-grid"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        >
          {orderedKeys.map((key) => {
            const meta = FIELD_META[key];
            if (!meta) return null;
            const val = values[key] ?? '';

            return (
              <motion.article
                key={key}
                className="rule-card"
                variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="rule-card-top">
                  <div className="rule-icon"><SlidersHorizontal size={18} /></div>
                </div>
                <div className="rule-title-row" style={{ marginBottom: 4 }}>
                  <h3 style={{ marginBottom: 0 }}>{meta.label}</h3>
                </div>
                {meta.hint && (
                  <p style={{ opacity: 0.5, fontSize: '0.78rem', margin: '2px 0 10px' }}>{meta.hint}</p>
                )}

                {meta.type === 'select' ? (
                  <select
                    value={val}
                    onChange={(e) => handleChange(key, e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: 'inherit',
                      padding: '8px 10px',
                      fontSize: '0.875rem',
                      outline: 'none',
                    }}
                  >
                    <option value="">— не выбрано —</option>
                    {meta.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    value={val}
                    onChange={(e) => handleChange(key, e.target.value)}
                    rows={key === 'company_instruction' || key === 'upsell_strategy' ? 5 : 3}
                    placeholder="Не заполнено"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 8,
                      color: 'inherit',
                      padding: '8px 10px',
                      fontSize: '0.875rem',
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </motion.article>
            );
          })}
        </motion.div>
      )}
    </>
  );
}
