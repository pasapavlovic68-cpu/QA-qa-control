import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { RuleToggle } from '../components/display.jsx';
import { RuleModal, DeleteRuleModal } from '../components/modals.jsx';

function toRule(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'Процесс',
    weight: 'Средняя',
    active: row.enabled ?? true
  };
}

export function Rules() {
  const emptyRule = {
    title: '',
    category: 'Процесс',
    description: '',
    weight: 'Средняя',
    active: true
  };

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState(null);
  const [ruleForm, setRuleForm] = useState(emptyRule);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('qa_rules')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('[Rules] fetch error:', error);
          setLoading(false);
          return;
        }
        setRules((data ?? []).map(toRule));
        setLoading(false);
      });
  }, []);

  const openAddModal = () => {
    setRuleForm(emptyRule);
    setModalMode('add');
  };

  const openEditModal = (rule) => {
    setRuleForm(rule);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setRuleForm(emptyRule);
  };

  const saveRule = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);

    if (modalMode === 'edit') {
      const { data, error } = await supabase
        .from('qa_rules')
        .update({
          title: ruleForm.title.trim() || 'Новое правило',
          description: ruleForm.description.trim(),
          category: ruleForm.category,
          enabled: ruleForm.active
        })
        .eq('id', ruleForm.id)
        .select()
        .single();

      setSaving(false);
      if (error) { console.error('[Rules] update error:', error); return; }

      setRules((current) => current.map((rule) => rule.id === data.id ? toRule(data) : rule));
    } else {
      const { data, error } = await supabase
        .from('qa_rules')
        .insert({
          title: ruleForm.title.trim() || 'Новое правило',
          description: ruleForm.description.trim() || 'Описание правила пока не заполнено.',
          category: ruleForm.category,
          enabled: ruleForm.active
        })
        .select()
        .single();

      setSaving(false);
      if (error) { console.error('[Rules] insert error:', error); return; }

      setRules((current) => [toRule(data), ...current]);
    }

    closeModal();
  };

  const toggleRule = async (ruleId) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    const newEnabled = !rule.active;

    const { error } = await supabase
      .from('qa_rules')
      .update({ enabled: newEnabled })
      .eq('id', ruleId);

    if (error) {
      console.error('[Rules] toggle error:', error);
      return;
    }

    setRules((current) => current.map((r) => r.id === ruleId ? { ...r, active: newEnabled } : r));
  };

  const confirmDeleteRule = async () => {
    if (!deleteTarget) return;

    const { error } = await supabase
      .from('qa_rules')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      console.error('[Rules] delete error:', error);
      setDeleteTarget(null);
      return;
    }

    setRules((current) => current.filter((rule) => rule.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="rules-head">
        <div>
          <span className="eyebrow">Конфигурация QA</span>
          <h2>Правила проверки</h2>
        </div>
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={openAddModal}>
          <Plus size={17} />
          Добавить правило
        </motion.button>
      </div>

      {loading ? (
        <div className="rules-grid" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Загружаем правила…</p>
        </div>
      ) : rules.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Правил пока нет</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Добавьте первое правило проверки.</p>
        </div>
      ) : (
      <motion.div className="rules-grid" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065 } } }}>
        <AnimatePresence mode="popLayout">
          {rules.map((rule) => (
            <motion.article
              layout
              className="rule-card"
              key={rule.id}
              variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -5, scale: 1.008 }}
            >
              <div className="rule-card-top">
                <div className="rule-icon"><Settings2 size={18} /></div>
                <div className="rule-actions">
                  <motion.button className="rule-action" aria-label={`Редактировать ${rule.title}`} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(rule)}>
                    <Pencil size={15} />
                  </motion.button>
                  <motion.button className="rule-action danger" aria-label={`Удалить ${rule.title}`} whileTap={{ scale: 0.9 }} onClick={() => setDeleteTarget(rule)}>
                    <Trash2 size={15} />
                  </motion.button>
                </div>
              </div>
              <div className="rule-title-row">
                <h3>{rule.title}</h3>
                <span className={`rule-status ${rule.active ? 'active' : 'disabled'}`}>{rule.active ? 'Активно' : 'Выключено'}</span>
              </div>
              <p>{rule.description}</p>
              <div className="rule-meta">
                <span>{rule.category}</span>
                <b>{rule.weight}</b>
              </div>
              <RuleToggle active={rule.active} onClick={() => toggleRule(rule.id)} />
            </motion.article>
          ))}
        </AnimatePresence>
      </motion.div>
      )}

      <AnimatePresence>
        {modalMode && (
          <RuleModal
            mode={modalMode}
            rule={ruleForm}
            setRule={setRuleForm}
            onClose={closeModal}
            onSubmit={saveRule}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteRuleModal
            rule={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteRule}
          />
        )}
      </AnimatePresence>
    </>
  );
}
