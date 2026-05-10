import { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ClipboardCheck,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
  UserPlus,
  UsersRound
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../lib/supabase.js';
import { modalMotion, modalContentVariants, modalSectionVariants, useModalScrollLock, ModalPortal } from './modal.jsx';
import { useToast } from './Toast.jsx';

export const tabs = [
  { id: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { id: 'employees', label: 'Сотрудники', icon: UsersRound },
  { id: 'sales', label: 'Продажи', icon: DollarSign },
  { id: 'review', label: 'Проверка', icon: ClipboardCheck },
  { id: 'report', label: 'Отчёт', icon: FileText },
  { id: 'rules', label: 'Правила', icon: Settings2 },
  { id: 'settings', label: 'Настройки', icon: SlidersHorizontal }
];

const STATUS_LABEL = {
  checking: 'проверка…',
  connected: 'подключена',
  active: 'активен',
  beta: 'бета',
  degraded: 'сбой',
  offline: 'недоступна',
  not_implemented: 'в разработке',
};

const STATUS_DOT = {
  checking: 'demo',
  connected: 'ready',
  active: 'ready',
  beta: 'demo',
  not_implemented: 'demo',
  degraded: 'warn',
  offline: 'warn',
};

function analysisToStatus(analysis) {
  if (analysis === 'complete' || analysis === 'running') return 'active';
  if (analysis === 'error') return 'degraded';
  return 'beta';
}

function OrganizationNameModal({ organizationId, orgName, onClose, onSaved }) {
  useModalScrollLock();

  const showToast = useToast();
  const [name, setName] = useState(orgName || 'Моя организация');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextName = name.trim();

    if (!nextName) {
      setError('Введите название организации.');
      return;
    }

    if (nextName.length > 60) {
      setError('Название не должно быть длиннее 60 символов.');
      return;
    }

    if (!organizationId || saving) return;

    setSaving(true);
    setError('');

    const { data, error: updateError } = await supabase
      .from('organizations')
      .update({ name: nextName })
      .eq('id', organizationId)
      .select('name')
      .single();

    setSaving(false);

    if (updateError) {
      setError('Не удалось сохранить название. Повторите попытку.');
      return;
    }

    onSaved(data?.name || nextName);
    showToast?.('Название организации обновлено');
    onClose();
  };

  return (
    <ModalPortal>
      <motion.div className="modal-backdrop org-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.form
          className="modal-shell modal-shell--small org-modal"
          role="dialog"
          aria-modal="true"
          initial={modalMotion.initial}
          animate={modalMotion.animate}
          exit={modalMotion.exit}
          transition={modalMotion.transition}
          onClick={(event) => event.stopPropagation()}
          onSubmit={handleSubmit}
        >
          <motion.div variants={modalContentVariants} initial="hidden" animate="show" exit="exit">
            <motion.div className="modal-title" variants={modalSectionVariants}>
              <div>
                <span className="eyebrow">Профиль организации</span>
                <h2>Редактировать организацию</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}>
                <X size={18} />
              </button>
            </motion.div>

            <motion.label className="org-modal-field" variants={modalSectionVariants}>
              <span>Название организации</span>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value.slice(0, 60));
                  setError('');
                }}
                autoFocus
                maxLength={60}
                placeholder="Моя организация"
              />
              <small>{name.trim().length}/60</small>
            </motion.label>

            {error && <motion.p className="org-modal-error" variants={modalSectionVariants}>{error}</motion.p>}

            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                Отмена
              </motion.button>
              <motion.button className="primary-button" type="submit" whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving}>
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.form>
      </motion.div>
    </ModalPortal>
  );
}

function ProfileBlock({ user, orgName, organizationId, onOrgNameChange }) {
  const [open, setOpen] = useState(false);
  const [orgModalOpen, setOrgModalOpen] = useState(false);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Пользователь';

  const email = user?.email ?? '';
  const org = orgName?.trim() || 'Моя организация';

  const initials = displayName
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 11px',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.62)',
          border: '1px solid rgba(119,101,227,0.13)',
          boxShadow: '0 2px 10px rgba(35,31,58,0.05)',
          cursor: 'pointer',
          textAlign: 'left',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Avatar */}
        <div style={{
          flexShrink: 0,
          width: 34,
          height: 34,
          borderRadius: 11,
          background: 'linear-gradient(135deg, #ece9ff, #ddd7ff)',
          border: '1px solid rgba(119,101,227,0.18)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--accent)',
          letterSpacing: 0.4,
        }}>
          {initials}
        </div>

        {/* Name + org */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName}
          </div>
          <div style={{
            fontSize: 11,
            color: 'var(--muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}>
            {org}
          </div>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, color: 'var(--muted)' }}
        >
          <ChevronDown size={14} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop to close on outside click */}
            <div
              onClick={() => setOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            />

            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                right: 0,
                zIndex: 50,
                background: 'rgba(253,252,255,0.98)',
                border: '1px solid rgba(119,101,227,0.14)',
                borderRadius: 18,
                boxShadow: '0 20px 56px rgba(35,31,58,0.14)',
                padding: '14px 14px 10px',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* User info */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{email}</div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  color: 'var(--muted)',
                  marginTop: 6,
                }}>
                  <Building2 size={11} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {org}
                  </span>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--line)', margin: '10px 0' }} />

              <motion.button
                type="button"
                whileHover={{ background: 'rgba(119,101,227,0.07)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setOpen(false);
                  setOrgModalOpen(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 12,
                  fontSize: 13,
                  color: 'var(--text)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Building2 size={14} />
                Редактировать организацию
              </motion.button>

              <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />

              {/* Добавить доступ — disabled placeholder */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 12,
                fontSize: 13,
                color: 'var(--muted)',
                opacity: 0.55,
                cursor: 'not-allowed',
                userSelect: 'none',
              }}>
                <UserPlus size={14} />
                <span style={{ flex: 1 }}>Добавить доступ</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  letterSpacing: 0.3,
                }}>
                  Скоро
                </span>
              </div>

              <div style={{ height: 1, background: 'var(--line)', margin: '8px 0' }} />

              {/* Выйти */}
              <motion.button
                type="button"
                whileHover={{ color: 'var(--danger)', background: 'rgba(190,60,68,0.06)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { supabase.auth.signOut(); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 12,
                  fontSize: 13,
                  color: 'var(--muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <LogOut size={14} />
                Выйти
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {orgModalOpen && (
          <OrganizationNameModal
            organizationId={organizationId}
            orgName={org}
            onClose={() => setOrgModalOpen(false)}
            onSaved={onOrgNameChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar({ active, setActive, user, orgName, organizationId, onOrgNameChange, systemStatus = {} }) {
  return (
    <aside className="sidebar">
      <ProfileBlock user={user} orgName={orgName} organizationId={organizationId} onOrgNameChange={onOrgNameChange} />

      <motion.div className="brand" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="brand-mark"><ShieldCheck size={22} /></div>
        <div>
          <strong>LeadProof</strong>
          <span>AI-контроль качества продаж</span>
        </div>
      </motion.div>

      <nav className="nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={`nav-item ${active === tab.id ? 'active' : ''}`} onClick={() => setActive(tab.id)}>
              {active === tab.id && <motion.span layoutId="active-tab" className="nav-indicator" />}
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <motion.div className="ai-card" whileHover={{ y: -4, scale: 1.01 }}>
        <div className="mvp-card-title">
          <Sparkles size={18} />
          <strong>Статус MVP</strong>
        </div>
        <div className="mvp-status-list">
          {[
            { label: 'AI-анализ', value: analysisToStatus(systemStatus.analysis) },
            { label: 'Загрузка файлов', value: systemStatus.upload ?? 'beta' },
            { label: 'База данных', value: systemStatus.supabase ?? 'checking' },
            { label: 'API', value: systemStatus.supabase === 'connected' ? 'connected' : systemStatus.supabase === 'offline' ? 'offline' : 'checking' },
            { label: 'PDF-экспорт', value: systemStatus.pdf ?? 'not_implemented' },
          ].map(({ label, value }) => (
            <div className="mvp-status-row" key={label}>
              <span><i className={`dot ${STATUS_DOT[value] ?? 'demo'}`} />{label}</span>
              <b>{STATUS_LABEL[value] ?? value}</b>
            </div>
          ))}
        </div>
      </motion.div>
    </aside>
  );
}

export function Topbar({ title, onNewReview, showNewReview = false }) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">Внутренний контур качества</span>
        <h1>{title}</h1>
      </div>
      {showNewReview && (
        <div className="topbar-actions">
          <motion.button className="primary-button" whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }} onClick={onNewReview}>
            <Sparkles size={17} />
            Новая проверка
          </motion.button>
        </div>
      )}
    </header>
  );
}
