import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current);
    setToast({ message, type, id: Date.now() });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const isSuccess = toast?.type === 'success';

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 20px 11px 14px',
                borderRadius: 20,
                background: 'rgba(252,253,252,0.97)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: isSuccess
                  ? '1px solid rgba(25,138,98,0.22)'
                  : '1px solid rgba(190,60,68,0.22)',
                boxShadow: isSuccess
                  ? '0 6px 28px rgba(25,138,98,0.16), 0 2px 10px rgba(0,0,0,0.06)'
                  : '0 6px 28px rgba(190,60,68,0.16), 0 2px 10px rgba(0,0,0,0.06)',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text)',
                whiteSpace: 'nowrap',
                maxWidth: 'calc(100vw - 48px)',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  display: 'grid',
                  placeItems: 'center',
                  background: isSuccess
                    ? 'rgba(25,138,98,0.1)'
                    : 'rgba(190,60,68,0.1)',
                }}
              >
                {isSuccess ? (
                  <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                ) : (
                  <XCircle size={15} style={{ color: 'var(--danger)' }} />
                )}
              </div>
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
