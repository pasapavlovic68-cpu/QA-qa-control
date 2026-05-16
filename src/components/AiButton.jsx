import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkle, Sparkles } from 'lucide-react';

const PARTICLES = [
  { x: -68, y: -28, delay: 0,    size: 10, rotate: 20 },
  { x:  62, y: -38, delay: 0.12, size: 8,  rotate: -15 },
  { x: -42, y:  38, delay: 0.25, size: 7,  rotate: 45 },
  { x:  52, y:  32, delay: 0.08, size: 9,  rotate: -30 },
  { x: -75, y:   4, delay: 0.38, size: 6,  rotate: 10 },
  { x:  72, y: -12, delay: 0.18, size: 8,  rotate: 60 },
  { x:   8, y: -52, delay: 0.3,  size: 7,  rotate: -20 },
  { x:  18, y:  50, delay: 0.05, size: 6,  rotate: 35 },
  { x: -30, y: -50, delay: 0.45, size: 5,  rotate: -45 },
  { x:  45, y: -50, delay: 0.22, size: 5,  rotate: 25 },
];

function Star({ x, y, delay, size, rotate }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        pointerEvents: 'none',
        zIndex: 0,
        color: 'white',
        display: 'flex',
      }}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
      animate={{
        x: [0, x * 0.6, x],
        y: [0, y * 0.6, y],
        opacity: [0, 1, 0],
        scale: [0, 1.2, 0],
        rotate: [0, rotate],
      }}
      transition={{
        duration: 0.85,
        delay,
        ease: [0.17, 0.55, 0.55, 1],
        repeat: Infinity,
        repeatDelay: 1.2,
      }}
    >
      <Sparkle size={size} fill="white" stroke="none" />
    </motion.div>
  );
}

export function AiButton({ onClick, disabled = false, done = false, label = 'Начать анализ' }) {
  const [hovering, setHovering] = useState(false);
  const inactive = disabled || done;

  return (
    <motion.button
      type="button"
      disabled={inactive}
      onClick={inactive ? undefined : onClick}
      onHoverStart={() => !inactive && setHovering(true)}
      onHoverEnd={() => setHovering(false)}
      whileTap={inactive ? {} : { scale: 0.97 }}
      style={{
        position: 'relative',
        padding: 2,
        borderRadius: 999,
        background: disabled && !done
          ? 'rgba(119,101,227,0.25)'
          : 'linear-gradient(135deg, rgba(119,101,227,0.45) 0%, rgba(99,147,255,0.35) 100%)',
        border: 'none',
        cursor: done ? 'default' : disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !done ? 0.5 : 1,
        flex: 1,
      }}
    >
      {/* Glow ring */}
      {!disabled && hovering && (
        <motion.div
          style={{
            position: 'absolute',
            inset: -4,
            borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(119,101,227,0.35), rgba(99,147,255,0.25))',
            filter: 'blur(8px)',
            zIndex: -1,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

      {/* Inner gradient pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '13px 28px',
          borderRadius: 999,
          background: disabled
            ? 'rgba(80,70,160,0.6)'
            : 'linear-gradient(135deg, #7765E3 0%, #6393FF 100%)',
          color: 'white',
          fontWeight: 600,
          fontSize: '1rem',
          position: 'relative',
          zIndex: 1,
          boxShadow: disabled ? 'none' : '0 4px 24px rgba(119,101,227,0.4)',
          letterSpacing: '0.01em',
        }}
      >
        {/* Main sparkle icon */}
        <motion.div
          animate={disabled ? {} : {
            rotate: [0, 15, -8, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ display: 'flex', flexShrink: 0 }}
        >
          <Sparkles size={20} fill="rgba(255,255,255,0.9)" strokeWidth={1.5} />
        </motion.div>

        <span style={{ position: 'relative', zIndex: 1 }}>{label}</span>

        {/* Tiny decorative sparkles on the pill */}
        {!disabled && [
          { style: { position: 'absolute', bottom: 8, left: 18 }, delay: '0s', dur: '2s', size: 7 },
          { style: { position: 'absolute', top: 7,   left: 26 }, delay: '1s', dur: '2.2s', size: 5 },
          { style: { position: 'absolute', top: 6,   left: 20 }, delay: '1.6s', dur: '2.5s', size: 4 },
        ].map((s, i) => (
          <motion.div
            key={i}
            style={{ ...s.style, color: 'rgba(255,255,255,0.85)', display: 'flex', pointerEvents: 'none' }}
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.85, 1, 0.85] }}
            transition={{ duration: parseFloat(s.dur), delay: parseFloat(s.delay), repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkle size={s.size} fill="white" stroke="none" />
          </motion.div>
        ))}
      </div>

      {/* Flying particles on hover */}
      <AnimatePresence>
        {hovering && !disabled && PARTICLES.map((p, i) => (
          <Star key={i} {...p} />
        ))}
      </AnimatePresence>
    </motion.button>
  );
}
