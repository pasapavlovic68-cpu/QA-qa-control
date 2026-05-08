import React from 'react';
import { motion, useInView } from 'framer-motion';

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
