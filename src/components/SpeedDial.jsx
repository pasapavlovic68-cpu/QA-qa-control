import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';

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

export function SpeedDial({ actions }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* "+" button — stays fixed, mouse hovers here */}
      <motion.button
        type="button"
        style={{ ...btnStyle, color: 'var(--text-secondary)' }}
        whileHover={{ scale: 1.08, background: 'rgba(119,101,227,0.1)', color: 'var(--primary)' }}
        whileTap={{ scale: 0.93 }}
        aria-label="Действия"
      >
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex' }}
        >
          <Plus size={14} />
        </motion.div>
      </motion.button>

      {/* Action buttons — float absolutely to the right, zero layout shift */}
      <AnimatePresence>
        {open && (
          <motion.div
            style={{
              position: 'absolute',
              left: 'calc(100% + 6px)',
              top: '50%',
              translateY: '-50%',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              zIndex: 50,
              pointerEvents: 'auto',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {actions.map((action, i) => (
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
                transition={{ duration: 0.16, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
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
