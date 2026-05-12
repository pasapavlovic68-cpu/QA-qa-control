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
import { runModalSuccessFlow } from '../lib/modalSuccess.js';
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
  if (analysis === 'complete' || analysis === 'running' || analysis === 'idle') return 'connected';
  if (analysis === 'error') return 'degraded';
  return 'checking';
}

function featureStatus(value, fallback = 'checking') {
  if (value === 'connected' || value === 'active') return 'connected';
  if (value === 'offline' || value === 'degraded') return value;
  if (value === 'checking') return 'checking';
  return fallback;
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
    const payload = { name: nextName };

    console.group('[OrganizationRename] save');
    console.log('[OrganizationRename] organizationId:', organizationId);
    console.log('[OrganizationRename] payload:', payload);

    if (!nextName) {
      console.warn('[OrganizationRename] blocked: empty name');
      console.groupEnd();
      setError('Введите название организации.');
      return;
    }

    if (nextName.length > 60) {
      console.warn('[OrganizationRename] blocked: name is too long', nextName.length);
      console.groupEnd();
      setError('Название не должно быть длиннее 60 символов.');
      return;
    }

    if (!organizationId) {
      console.error('[OrganizationRename] blocked: organizationId is missing');
      console.groupEnd();
      setError('Организация не загружена. Повторите попытку.');
      return;
    }

    if (saving) {
      console.warn('[OrganizationRename] blocked: save already in progress');
      console.groupEnd();
      return;
    }

    setError('');

    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        const { error: updateError } = await supabase
          .from('organizations')
          .update(payload)
          .eq('id', organizationId);

        console.log('[OrganizationRename] updateError:', updateError);

        if (updateError) {
          updateError.uiMessage = 'Не удалось сохранить название. Повторите попытку.';
          throw updateError;
        }

        const { data: verifyData, error: verifyError } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', organizationId)
          .maybeSingle();

        console.log('[OrganizationRename] verifyData:', verifyData);
        console.log('[OrganizationRename] verifyError:', verifyError);

        if (verifyError) {
          verifyError.uiMessage = 'Не удалось сохранить название. Повторите попытку.';
          throw verifyError;
        }

        if (!verifyData) {
          console.error('[OrganizationRename] verify returned no row. Possible id mismatch or SELECT policy issue.', { organizationId, payload });
          throw Object.assign(new Error('Сохранение заблокировано политикой доступа к организации.'), {
            uiMessage: 'Сохранение заблокировано политикой доступа к организации.',
          });
        }

        const savedName = verifyData.name || nextName;
        if (savedName !== nextName) {
          console.error('[OrganizationRename] update did not persist. Possible RLS UPDATE policy block or trigger rollback.', {
            organizationId,
            payload,
            savedName,
            verifyRow: verifyData,
          });
          throw Object.assign(new Error('Сохранение заблокировано политикой доступа к организации.'), {
            uiMessage: 'Сохранение заблокировано политикой доступа к организации.',
          });
        }

        console.log('[OrganizationRename] saved organization name:', savedName);
        console.groupEnd();
        return savedName;
      },
      reset: (savedName) => onSaved(savedName),
      toast: () => showToast?.('Название организации обновлено'),
      close: onClose,
      onError: (error) => {
        console.groupEnd();
        setError(error.uiMessage || 'Не удалось сохранить название. Повторите попытку.');
      },
    });
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function OrganizationInviteModal({ organizationId, onClose }) {
  useModalScrollLock();

  const showToast = useToast();
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  const loadInvites = async () => {
    if (!organizationId) {
      setLoading(false);
      setError('Организация не загружена. Повторите попытку.');
      return;
    }

    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('organization_invites')
      .select('id, email, status, invited_at')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false });

    setLoading(false);

    if (loadError) {
      console.error('[OrganizationInvites] load error:', loadError);
      setError('Не удалось загрузить приглашения.');
      return;
    }

    setInvites(data ?? []);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    loadInvites();
  }, [organizationId]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Введите email.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Введите корректный email.');
      return;
    }

    if (!organizationId || saving) return;

    setError('');
    await runModalSuccessFlow({
      setSaving,
      action: async () => {
        const { data, error: insertError } = await supabase
          .from('organization_invites')
          .insert({
            organization_id: organizationId,
            email: normalizedEmail,
            status: 'pending',
          })
          .select('id, email, status, invited_at')
          .maybeSingle();
        if (insertError) throw insertError;
        return data;
      },
      reload: async (data) => {
        if (!data) await loadInvites();
      },
      reset: (data) => {
        if (data) {
          setInvites((current) => [data, ...current.filter((invite) => invite.id !== data.id)]);
        }
        setEmail('');
      },
      toast: () => showToast?.('Доступ добавлен'),
      close: onClose,
      onError: (insertError) => {
        console.error('[OrganizationInvites] insert error:', insertError);
        setError('Не удалось добавить доступ.');
      },
    });
  };

  const handleDelete = async (inviteId) => {
    if (!inviteId || deletingId) return;

    setError('');
    await runModalSuccessFlow({
      setSaving: (active) => setDeletingId(active ? inviteId : null),
      action: async () => {
        const { error: deleteError } = await supabase
          .from('organization_invites')
          .delete()
          .eq('id', inviteId)
          .eq('organization_id', organizationId);
        if (deleteError) throw deleteError;
        return inviteId;
      },
      reset: (deletedId) => setInvites((current) => current.filter((invite) => invite.id !== deletedId)),
      toast: () => showToast?.('Доступ удалён'),
      close: onClose,
      onError: (deleteError) => {
        console.error('[OrganizationInvites] delete error:', deleteError);
        setError('Не удалось удалить приглашение.');
      },
    });
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
                <span className="eyebrow">Доступ к организации</span>
                <h2>Добавить доступ</h2>
              </div>
              <button className="icon-button" type="button" onClick={onClose}>
                <X size={18} />
              </button>
            </motion.div>

            <motion.p className="invite-modal-helper" variants={modalSectionVariants}>
              Если человек войдёт или зарегистрируется с этой почтой, он попадёт в эту организацию.
            </motion.p>

            <motion.label className="org-modal-field" variants={modalSectionVariants}>
              <span>Email</span>
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                autoFocus
                inputMode="email"
                placeholder="name@example.com"
              />
            </motion.label>

            {error && <motion.p className="org-modal-error" variants={modalSectionVariants}>{error}</motion.p>}

            <motion.div className="invite-list" variants={modalSectionVariants}>
              <div className="invite-list-head">
                <span>Ожидают входа</span>
                <b>{loading ? '…' : invites.length}</b>
              </div>
              {loading ? (
                <p className="invite-list-empty">Загружаем приглашения…</p>
              ) : invites.length === 0 ? (
                <p className="invite-list-empty">Пока нет активных приглашений.</p>
              ) : (
                invites.map((invite) => (
                  <div className="invite-row" key={invite.id}>
                    <div>
                      <strong>{invite.email}</strong>
                      <span>{invite.status}</span>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === invite.id}
                      onClick={() => handleDelete(invite.id)}
                    >
                      {deletingId === invite.id ? 'Удаляем…' : 'Удалить'}
                    </button>
                  </div>
                ))
              )}
            </motion.div>

            <motion.div className="modal-actions" variants={modalSectionVariants}>
              <motion.button className="ghost-button" type="button" whileTap={{ scale: 0.97 }} onClick={onClose}>
                Закрыть
              </motion.button>
              <motion.button className="primary-button" type="submit" whileTap={{ scale: saving ? 1 : 0.97 }} disabled={saving}>
                {saving ? 'Добавляем…' : 'Добавить доступ'}
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
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

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

              <motion.button
                type="button"
                whileHover={{ background: 'rgba(119,101,227,0.07)' }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setOpen(false);
                  setInviteModalOpen(true);
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
                <UserPlus size={14} />
                <span style={{ flex: 1 }}>Добавить доступ</span>
              </motion.button>

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
      <AnimatePresence>
        {inviteModalOpen && (
          <OrganizationInviteModal
            organizationId={organizationId}
            onClose={() => setInviteModalOpen(false)}
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
            { label: 'Загрузка файлов', value: featureStatus(systemStatus.upload) },
            { label: 'База данных', value: systemStatus.supabase ?? 'checking' },
            { label: 'API', value: systemStatus.supabase === 'connected' ? 'connected' : systemStatus.supabase === 'offline' ? 'offline' : 'checking' },
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
