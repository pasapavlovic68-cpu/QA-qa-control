import { useState, useEffect } from 'react';
import { CustomSelect } from '../components/shared.jsx';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, FileText, ShieldAlert, SlidersHorizontal, Target, TrendingUp, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useToast } from '../components/Toast.jsx';
import { modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from '../components/modal.jsx';
import { runModalSuccessFlow } from '../lib/modalSuccess.js';

const FIELD_META = {
  company_instruction: {
    label: 'Инструкция для компании',
    hint: 'Общий контекст о компании для AI-анализа',
    type: 'textarea',
    icon: Building2,
    rows: 7,
  },
  sales_goal: {
    label: 'Цель продаж',
    hint: 'Описание целей и KPI для менеджеров',
    type: 'textarea',
    icon: Target,
    rows: 5,
  },
  report_style: {
    label: 'Стиль отчёта',
    hint: 'Формат итогового отчёта по проверке',
    type: 'select',
    icon: FileText,
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
    icon: ShieldAlert,
    rows: 6,
    lineHint: 'Каждая строка — отдельное правило',
  },
  upsell_strategy: {
    label: 'Стратегия допродаж',
    hint: 'Инструкции по апселлу для AI-анализа',
    type: 'textarea',
    icon: TrendingUp,
    rows: 6,
  },
  critical_moments: {
    label: 'Критические моменты',
    hint: 'Каждый момент с новой строки',
    type: 'textarea',
    icon: Zap,
    rows: 5,
    lineHint: 'Каждая строка — отдельное правило',
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

const settingsSharedTransition = {
  layout: { type: 'spring', damping: 34, stiffness: 360 },
  opacity: { duration: 0.18 },
  scale: { duration: 0.18 },
};

function getPreviewText(meta, val) {
  if (!val) return null;
  if (meta.type === 'select') {
    const opt = (meta.options ?? []).find((o) => o.value === val);
    return opt?.label ?? val;
  }
  const firstLine = val.split('\n')[0].trim();
  return firstLine.length > 72 ? firstLine.slice(0, 70) + '…' : firstLine;
}

function SettingEditModal({ fieldKey, meta, initialValue, layoutId, onClose, onSaved }) {
  useModalScrollLock();

  const showToast = useToast();
  const [draft, setDraft] = useState(initialValue ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { organizationId } = onSaved;

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    const payload = { key: fieldKey, value: draft ?? '', organization_id: organizationId };
    console.log('[SettingsSave] organizationId', organizationId);
    console.log('[SettingsSave] payload', payload);
    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        const existingResponse = await supabase
          .from('team_settings')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('key', fieldKey)
          .maybeSingle();

        console.log('[SettingsSave] response', existingResponse);
        console.log('[SettingsSave] error', existingResponse.error);

        if (existingResponse.error) throw existingResponse.error;

        const saveResponse = existingResponse.data?.id
          ? await supabase
              .from('team_settings')
              .update({ value: payload.value })
              .eq('id', existingResponse.data.id)
              .eq('organization_id', organizationId)
              .select('id, key, value, organization_id')
              .maybeSingle()
          : await supabase
              .from('team_settings')
              .insert(payload)
              .select('id, key, value, organization_id')
              .maybeSingle();

        console.log('[SettingsSave] response', saveResponse);
        console.log('[SettingsSave] error', saveResponse.error);

        if (saveResponse.error) throw saveResponse.error;
        if (!saveResponse.data) throw new Error('Настройка не сохранена: Supabase вернул пустой ответ.');
        return draft;
      },
      reset: (value) => onSaved.fn(fieldKey, value),
      toast: () => showToast('Настройки сохранены'),
      close: onClose,
      onError: (err) => {
        console.error('[SettingsSave] error', err);
        setError(err?.message || 'Ошибка при сохранении.');
      },
    });
  };

  return (
    <ModalPortal>
      <motion.div
        className="modal-backdrop employee-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          layoutId={layoutId}
          className="modal-shell modal-shell--medium"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          transition={settingsSharedTransition}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">

            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Настройки анализа</span>
                <h2 style={{ margin: '2px 0 0', fontSize: 20 }}>{meta.label}</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}><X size={18} /></button>
            </motion.div>

            <motion.p
              variants={modalSectionVariants}
              style={{ margin: '0 0 16px', fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.5 }}
            >
              {meta.hint}
            </motion.p>

            <motion.div variants={modalSectionVariants}>
              {meta.type === 'select' ? (
                <CustomSelect
                  value={draft}
                  options={meta.options}
                  onChange={setDraft}
                />
              ) : (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={meta.rows ?? 5}
                    placeholder="Не заполнено"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: '1px solid var(--line)',
                      borderRadius: 15,
                      background: 'rgba(255,255,255,0.84)',
                      color: 'var(--text)',
                      fontSize: '0.9rem',
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.6,
                      boxSizing: 'border-box',
                    }}
                  />
                  {meta.lineHint && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {meta.lineHint}
                    </p>
                  )}
                </>
              )}
            </motion.div>

            {error && (
              <motion.p
                variants={modalSectionVariants}
                style={{ margin: '12px 0 0', fontSize: '0.82rem', color: 'var(--danger)' }}
              >
                {error}
              </motion.p>
            )}

            <motion.div className="modal-actions" variants={modalSectionVariants} style={{ marginTop: 20 }}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                Отмена
              </motion.button>
              <motion.button
                className="primary-button"
                type="button"
                whileTap={{ scale: saving ? 1 : 0.97 }}
                disabled={saving}
                onClick={handleSave}
              >
                <SlidersHorizontal size={15} />
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </motion.button>
            </motion.div>

          </motion.div>
        </motion.div>
      </motion.div>
    </ModalPortal>
  );
}

export function Settings({ organizationId }) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState(null);

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
        setLoading(false);
      });
  }, [organizationId]);

  const handleSaved = (key, newVal) => {
    setValues((prev) => ({ ...prev, [key]: newVal }));
  };

  const orderedKeys = KEY_ORDER.filter((k) => k in FIELD_META);

  return (
    <>
      <div className="rules-head">
        <div>
          <span className="eyebrow">Команда / AI</span>
          <h2>Настройки анализа</h2>
        </div>
      </div>

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
            const Icon = meta.icon ?? SlidersHorizontal;
            const preview = getPreviewText(meta, val);
            const filled = val.trim().length > 0;

            return (
              <motion.button
                key={key}
                layout
                layoutId={`settings-${key}`}
                className="rule-card rule-card--setting"
                role="button"
                tabIndex={0}
                variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
                transition={settingsSharedTransition}
                whileHover={{ y: -5, scale: 1.008 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => setEditKey(key)}
                style={{ textAlign: 'left', width: '100%', border: 'none', background: 'none' }}
              >
                <div className="rule-card-top">
                  <div className="rule-icon"><Icon size={18} /></div>
                  <span className={`rule-status ${filled ? 'active' : 'disabled'}`}>
                    {filled ? 'Заполнено' : 'Не заполнено'}
                  </span>
                </div>
                <h3>{meta.label}</h3>
                <p className="setting-card-desc" style={{ opacity: 0.48, fontSize: '0.78rem' }}>{meta.hint}</p>
                <p
                  className="setting-card-preview"
                  style={{
                    color: filled ? 'var(--text)' : 'var(--muted)',
                    fontStyle: filled ? 'normal' : 'italic',
                    opacity: filled ? 0.72 : 0.42,
                  }}
                >
                  {preview ?? 'Нажмите для редактирования'}
                </p>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {editKey && (
          <SettingEditModal
            key={editKey}
            fieldKey={editKey}
            meta={FIELD_META[editKey]}
            initialValue={values[editKey] ?? ''}
            layoutId={`settings-${editKey}`}
            onClose={() => setEditKey(null)}
            onSaved={{ fn: handleSaved, organizationId }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
