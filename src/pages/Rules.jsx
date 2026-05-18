import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Plus, Settings2, Trash2 } from 'lucide-react';
import { supabase, fetchWithTimeout } from '../lib/supabase.js';
import { RuleToggle } from '../components/display.jsx';
import { RuleModal, DeleteRuleModal } from '../components/modals.jsx';
import { useToast } from '../components/Toast.jsx';
import { runModalSuccessFlow } from '../lib/modalSuccess.js';
import { Topbar } from '../components/layout.jsx';

function toRule(row) {
  const [category, weight] = (row.category || 'Процесс').split(' · ');
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: category || 'Процесс',
    weight: weight || 'Средняя',
    active: row.enabled ?? true
  };
}

export function Rules({ organizationId }) {
  const showToast = useToast();
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
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    fetchWithTimeout(
      supabase.from('qa_rules').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }),
      'Rules'
    ).then(({ data, error }) => {
      if (error) { setLoading(false); return; }
      setRules((data ?? []).map(toRule));
      setLoading(false);
    });
  }, [organizationId]);

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
    if (!organizationId) {
      console.error('[Rules] organizationId missing, aborting save');
      return;
    }
    const title = ruleForm.title.trim();
    const description = ruleForm.description.trim();
    const categoryWithWeight = `${ruleForm.category} · ${ruleForm.weight}`;

    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        if (modalMode === 'edit') {
          const { data, error } = await supabase
            .from('qa_rules')
            .update({
              title,
              description,
              category: categoryWithWeight,
              enabled: ruleForm.active
            })
            .eq('id', ruleForm.id)
            .eq('organization_id', organizationId)
            .select()
            .single();
          if (error) throw error;
          return { mode: 'edit', data };
        }

        const insertPayload = {
          title,
          description,
          category: categoryWithWeight,
          enabled: ruleForm.active,
          organization_id: organizationId
        };

        console.log('[Rules] organizationId', organizationId);
        console.log('[Rules] insert payload', insertPayload);

        const { data, error } = await supabase
          .from('qa_rules')
          .insert(insertPayload)
          .select('*')
          .single();

        console.log('[Rules] insert data', data);
        console.error('[Rules] insert error', error);
        if (error) throw error;
        return { mode: 'add', data };
      },
      reset: ({ mode, data }) => {
        if (mode === 'edit') {
          setRules((current) => current.map((rule) => rule.id === data.id ? toRule(data) : rule));
        } else {
          setRules((current) => [toRule(data), ...current]);
        }
      },
      toast: ({ mode }) => showToast(mode === 'edit' ? 'Правило обновлено' : 'Правило добавлено'),
      close: closeModal,
      onError: (error) => {
        console.error(modalMode === 'edit' ? '[Rules] update error:' : '[Rules] insert error:', error);
      },
    });
  };

  const toggleRule = async (ruleId) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;
    if (!organizationId) {
      console.error('[Rules] organizationId missing, aborting toggle');
      return;
    }
    const newEnabled = !rule.active;

    const { error } = await supabase
      .from('qa_rules')
      .update({ enabled: newEnabled })
      .eq('id', ruleId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[Rules] toggle error:', error);
      return;
    }

    setRules((current) => current.map((r) => r.id === ruleId ? { ...r, active: newEnabled } : r));
  };

  const confirmDeleteRule = async () => {
    if (!deleteTarget || deleteSaving) return;
    if (!organizationId) {
      console.error('[Rules] organizationId missing, aborting delete');
      setDeleteTarget(null);
      return;
    }

    await runModalSuccessFlow({
      setSaving: setDeleteSaving,
      action: async () => {
        const { error } = await supabase
          .from('qa_rules')
          .delete()
          .eq('id', deleteTarget.id)
          .eq('organization_id', organizationId);
        if (error) throw error;
        return deleteTarget.id;
      },
      reset: (ruleId) => setRules((current) => current.filter((rule) => rule.id !== ruleId)),
      toast: () => showToast('Правило удалено'),
      close: () => setDeleteTarget(null),
      onError: (error) => {
        console.error('[Rules] delete error:', error);
      },
    });
  };

  return (
    <>
      <Topbar title="Правила">
        <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={openAddModal}>
          <Plus size={17} />
          Добавить правило
        </motion.button>
      </Topbar>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Загружаем правила…</p>
        </div>
      ) : rules.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 8, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, opacity: 0.65, fontSize: '1rem' }}>Правил пока нет</p>
          <p style={{ opacity: 0.4, fontSize: '0.875rem' }}>Добавьте первое правило проверки.</p>
        </div>
      ) : (
      <motion.div className="rules-grid-v2" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.065 } } }}>
        <AnimatePresence mode="popLayout">
          {rules.map((rule) => (
            <motion.article
              layout
              className="rule-card-v2"
              key={rule.id}
              variants={{ hidden: { opacity: 0, y: 18, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1 } }}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -3, boxShadow: '0 4px 6px rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.08)' }}
            >
              <div className="r-head">
                <span className={`r-tag ${rule.weight === 'Критическая' ? 't-c' : rule.weight === 'Высокая' ? 't-h' : 't-m'}`}>
                  {rule.weight}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <motion.button className="rule-action" aria-label={`Редактировать ${rule.title}`} whileTap={{ scale: 0.9 }} onClick={() => openEditModal(rule)}>
                    <Pencil size={14} />
                  </motion.button>
                  <motion.button className="rule-action danger" aria-label={`Удалить ${rule.title}`} whileTap={{ scale: 0.9 }} onClick={() => setDeleteTarget(rule)}>
                    <Trash2 size={14} />
                  </motion.button>
                </div>
              </div>
              <div className="r-title">{rule.title}</div>
              <div className="r-desc">{rule.description || '—'}</div>
              <div className="r-foot">
                <div className="r-type">{rule.category}</div>
                <RuleToggle active={rule.active} onClick={() => toggleRule(rule.id)} />
              </div>
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
            saving={saving}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteRuleModal
            rule={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={confirmDeleteRule}
            saving={deleteSaving}
          />
        )}
      </AnimatePresence>
    </>
  );
}
