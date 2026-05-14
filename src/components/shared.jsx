import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

export function PremiumCard({ title, action, children, className = '', compact = false }) {
  return (
    <motion.article className={`premium-card ${compact ? 'compact' : ''} ${className}`} whileHover={{ y: compact ? 0 : -3 }}>
      <div className="card-title">
        <h2>{title}</h2>
        {action && <span>{action}</span>}
      </div>
      {children}
    </motion.article>
  );
}

export function RevealCard(props) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.45 }}>
      <PremiumCard {...props} />
    </motion.div>
  );
}

export function Stagger({ children, className }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.075 } } }}>
      {React.Children.map(children, (child) => (
        <motion.div variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function AnimatedProgress({ value }) {
  return (
    <div className="progress">
      <motion.span initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
    </div>
  );
}

export function Avatar({ name, large = false }) {
  return <div className={`avatar ${large ? 'large' : ''}`}>{name.split(' ').map((part) => part[0]).join('')}</div>;
}

export function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

export function Evidence({ title, text, tone }) {
  return (
    <div className={`evidence ${tone}`}>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export function ChatSnippet({ role, text, good }) {
  return (
    <div className={`chat-snippet ${good ? 'good' : ''}`}>
      <span>{role}</span>
      <p>{text}</p>
    </div>
  );
}

export function CustomSelect({ value, options, onChange, placeholder = 'Выбрать' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayOptions = [...options].reverse();

  return (
    <div ref={ref} className="custom-select">
      <button
        type="button"
        className={`custom-select-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected?.label || placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={16} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="custom-select-menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {displayOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`custom-select-option${opt.value === value ? ' selected' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <span>{opt.label}</span>
                {opt.value === value && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
