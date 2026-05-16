import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

function Tooltip({ text, children }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--surface-raised, #1e1b2e)',
              color: 'var(--text)',
              fontSize: '0.72rem',
              fontWeight: 500,
              padding: '4px 8px',
              borderRadius: 6,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const btnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.7)',
  background: 'var(--surface, #fff)',
  boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  transition: 'background 0.15s, color 0.15s',
  flexShrink: 0,
};

export function SpeedDial({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Main "+" button */}
      <motion.button
        type="button"
        style={btnStyle}
        whileHover={{ scale: 1.08, background: 'var(--primary-light, rgba(119,101,227,0.1))', color: 'var(--primary)' }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((v) => !v)}
        aria-label="Действия"
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex' }}
        >
          <Plus size={15} />
        </motion.div>
      </motion.button>

      {/* Action buttons */}
      <AnimatePresence>
        {open && (
          <motion.div
            style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'visible' }}
            initial={{ opacity: 0, scaleX: 0, originX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {actions.map((action, i) => (
              <motion.div
                key={action.key}
                initial={{ opacity: 0, x: -10, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -6, scale: 0.85 }}
                transition={{ duration: 0.18, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              >
                <Tooltip text={action.label}>
                  <motion.button
                    type="button"
                    style={{
                      ...btnStyle,
                      color: action.danger ? 'var(--danger, #e05)' : 'var(--text-secondary)',
                      borderColor: action.danger ? 'rgba(220,50,50,0.25)' : 'rgba(255,255,255,0.7)',
                    }}
                    whileHover={{
                      scale: 1.1,
                      background: action.danger ? 'rgba(220,50,50,0.08)' : 'var(--primary-light, rgba(119,101,227,0.1))',
                      color: action.danger ? 'var(--danger, #e05)' : 'var(--primary)',
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { action.action(); setOpen(false); }}
                  >
                    {action.icon}
                  </motion.button>
                </Tooltip>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
