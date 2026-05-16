import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, X } from 'lucide-react';

const btnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.75)',
  background: 'var(--surface, #fff)',
  boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
  cursor: 'pointer',
  flexShrink: 0,
};

export function SpeedDial({ actions, editAction }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  // Focus input when edit mode opens
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const startEdit = () => {
    setEditValue(editAction?.initialValue ?? '');
    setEditing(true);
    setOpen(false);
  };

  const saveEdit = () => {
    editAction?.onSave?.(editValue.trim());
    setEditing(false);
    setOpen(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setOpen(false);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => !editing && setOpen(true)}
      onMouseLeave={() => !editing && setOpen(false)}
    >
      {/* "+" / "×" trigger button */}
      <motion.button
        type="button"
        style={{ ...btnStyle, color: editing ? 'var(--primary)' : 'var(--text-secondary)' }}
        whileHover={{ scale: 1.08, background: 'rgba(119,101,227,0.1)', color: 'var(--primary)' }}
        whileTap={{ scale: 0.93 }}
        onClick={() => editing ? cancelEdit() : setOpen(v => !v)}
        aria-label="Действия"
      >
        <motion.div
          animate={{ rotate: (open && !editing) ? 45 : 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex' }}
        >
          <Plus size={14} />
        </motion.div>
      </motion.button>

      {/* Floating panel: either action buttons OR inline edit form */}
      <AnimatePresence mode="wait">

        {/* EDIT MODE */}
        {editing && (
          <motion.div
            key="edit"
            style={{
              position: 'absolute',
              left: 'calc(100% + 6px)',
              top: '50%',
              y: '-50%',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              zIndex: 60,
              background: 'var(--surface)',
              borderRadius: 12,
              padding: '5px 6px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid rgba(119,101,227,0.2)',
            }}
            initial={{ opacity: 0, x: -8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -6, scale: 0.95 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
              style={{
                width: 130,
                fontSize: '0.82rem',
                fontWeight: 600,
                padding: '4px 8px',
                border: '1px solid rgba(119,101,227,0.35)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text)',
                outline: 'none',
                boxShadow: '0 0 0 3px rgba(119,101,227,0.1)',
              }}
            />
            {/* Save */}
            <motion.button
              type="button"
              style={{ ...btnStyle, width: 28, height: 28, borderRadius: 8, color: 'var(--primary)', borderColor: 'rgba(119,101,227,0.3)' }}
              whileHover={{ scale: 1.1, background: 'rgba(119,101,227,0.1)' }}
              whileTap={{ scale: 0.92 }}
              onClick={saveEdit}
            >
              <Check size={13} />
            </motion.button>
            {/* Cancel */}
            <motion.button
              type="button"
              style={{ ...btnStyle, width: 28, height: 28, borderRadius: 8, color: 'var(--text-secondary)' }}
              whileHover={{ scale: 1.1, background: 'rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.92 }}
              onClick={cancelEdit}
            >
              <X size={13} />
            </motion.button>
          </motion.div>
        )}

        {/* ACTIONS MODE */}
        {open && !editing && (
          <motion.div
            key="actions"
            style={{
              position: 'absolute',
              left: 'calc(100% + 6px)',
              top: '50%',
              y: '-50%',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              zIndex: 50,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.13 }}
          >
            {/* Edit action button (special) */}
            {editAction && (
              <motion.button
                type="button"
                style={{ ...btnStyle, color: 'var(--text-secondary)' }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ scale: 1.1, background: 'rgba(119,101,227,0.1)', color: 'var(--primary)' }}
                whileTap={{ scale: 0.92 }}
                onClick={startEdit}
              >
                {editAction.icon}
              </motion.button>
            )}

            {/* Regular actions */}
            {actions?.map((action, i) => (
              <motion.button
                key={action.key}
                type="button"
                style={{
                  ...btnStyle,
                  color: action.danger ? 'var(--danger, #dc3545)' : 'var(--text-secondary)',
                  borderColor: action.danger ? 'rgba(220,53,69,0.25)' : 'rgba(255,255,255,0.75)',
                }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15, delay: (editAction ? 1 : 0 + i) * 0.04, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{
                  scale: 1.1,
                  background: action.danger ? 'rgba(220,53,69,0.08)' : 'rgba(119,101,227,0.1)',
                  color: action.danger ? 'var(--danger, #dc3545)' : 'var(--primary)',
                }}
                whileTap={{ scale: 0.92 }}
                onClick={() => { action.action(); setOpen(false); }}
              >
                {action.icon}
              </motion.button>
            ))}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
