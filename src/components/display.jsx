import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { Check, ChevronDown, Sparkles, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { qualityPoints } from '../data/demoData.js';
import { AnimatedProgress } from './shared.jsx';

export function KpiCard({ label, value, delta, icon: Icon, onClick }) {
  return (
    <motion.div
      className="kpi-card"
      whileHover={{ y: -3, boxShadow: '0 4px 6px rgba(0,0,0,.05), 0 10px 30px rgba(0,0,0,.08)' }}
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div className="kc-head">
        <div className="kc-label">{label}</div>
        {Icon && <div className="kc-icon"><Icon size={16} /></div>}
      </div>
      <div className="kc-value">{value}</div>
      <div className="kc-trend">
        <span className="trend-chip trend-neu">{delta}</span>
      </div>
    </motion.div>
  );
}

export function TrendChart({ compact = false, data }) {
  const rawPoints = data ?? qualityPoints;
  const points = useMemo(
    () => rawPoints.map((value, index) => `${(index / (rawPoints.length - 1)) * 100},${100 - value}`).join(' '),
    [rawPoints]
  );
  return (
    <div className={`trend ${compact ? 'compact-trend' : ''}`}>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none">
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8d7cf6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#8d7cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.polyline points={points} fill="none" stroke="#7765e3" strokeWidth="2.4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <polygon points={`0,36 ${points} 100,36`} fill="url(#trendFill)" />
      </svg>
      {!compact && <div className="chart-labels"><span>Март</span><span>Апрель</span><span>Май</span></div>}
    </div>
  );
}


const ANALYSIS_STEPS = [
  { id: 'files',     label: 'Файлы загружены',     stages: ['preparing'] },
  { id: 'dialogues', label: 'Диалоги сохранены',   stages: ['reading_dialogues', 'loading_rules'] },
  { id: 'ai',        label: 'AI анализирует',       stages: ['contacting_ai'] },
  { id: 'report',    label: 'Отчёт сохранён',       stages: ['saving_report'] },
  { id: 'counters',  label: 'Счётчики обновлены',   stages: ['completed'] },
];

const STAGE_ORDER = ['preparing', 'reading_dialogues', 'loading_rules', 'contacting_ai', 'saving_report', 'completed'];

const STAGE_PROGRESS = {
  preparing:         20,
  reading_dialogues: 40,
  loading_rules:     40,
  contacting_ai:     65,
  saving_report:     85,
  completed:        100,
};

const STEP_CURRENT_LABEL = {
  preparing:         'Файлы загружены',
  reading_dialogues: 'Диалоги сохранены',
  loading_rules:     'Диалоги сохранены',
  contacting_ai:     'AI анализирует',
  saving_report:     'Отчёт сохранён',
  completed:         'Счётчики обновлены',
};

function AnimatedCounter({ value }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = to;
    if (from === to) return;
    const controls = animate(from, to, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span className="asp-pct">{display}%</span>;
}

export function AnalysisState({ status, stage, filesCount = 0, dialogueCount = 0, employeeName = '', errorMessage = null, currentDialogue = 0, totalDialogues = 0 }) {
  const lastActiveStageRef = useRef(null);

  useEffect(() => {
    if (stage && stage !== 'failed') {
      lastActiveStageRef.current = stage;
    }
  }, [stage]);

  const effectiveStage = stage === 'failed' ? lastActiveStageRef.current : stage;
  const currentStageIndex = STAGE_ORDER.indexOf(effectiveStage);

  const getStepState = (step) => {
    if (!stage || status === 'idle') return 'pending';
    const stepMin = Math.min(...step.stages.map((s) => STAGE_ORDER.indexOf(s)));
    const stepMax = Math.max(...step.stages.map((s) => STAGE_ORDER.indexOf(s)));
    if (status === 'complete') return 'done';
    if (status === 'error') {
      if (currentStageIndex > stepMax) return 'done';
      if (step.stages.includes(effectiveStage)) return 'error';
      return 'pending';
    }
    if (currentStageIndex > stepMax) return 'done';
    if (currentStageIndex >= stepMin) return 'active';
    return 'pending';
  };

  const baseProgress = !stage || status === 'idle' ? 0 : status === 'complete' ? 100 : STAGE_PROGRESS[effectiveStage] ?? 0;
  // During AI analysis interpolate progress per dialogue: 65% → 85%
  const progress = effectiveStage === 'contacting_ai' && totalDialogues > 0
    ? Math.round(65 + (currentDialogue / totalDialogues) * 20)
    : baseProgress;

  const currentStepLabel = effectiveStage ? (STEP_CURRENT_LABEL[effectiveStage] ?? '') : null;
  const isIdle     = !stage || status === 'idle';
  const isComplete = status === 'complete';
  const isError    = status === 'error';

  return (
    <div className="asp-panel">
      {/* Header: orb + progress bar */}
      <div className="asp-header">
        <div className={`asp-orb ${isComplete ? 'success' : isError ? 'error' : ''}`}>
          {isComplete ? <CheckCircle2 size={20} /> : isError ? <AlertCircle size={20} /> : <Sparkles size={20} />}
        </div>
        <div className="asp-progress-wrap">
          <div className="asp-bar-bg">
            <motion.div
              className={`asp-bar-fill ${isError ? 'error' : isComplete ? 'complete' : ''}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="asp-bar-meta">
            <AnimatedCounter value={progress} />
            {!isIdle && !isComplete && !isError && currentStepLabel && (
              <span className="asp-current-step">Текущий этап: {currentStepLabel}</span>
            )}
            {isComplete && <span className="asp-status-label success">Анализ завершён</span>}
            {isError    && <span className="asp-status-label error">Ошибка анализа</span>}
          </div>
        </div>
      </div>

      {/* Stats row */}
      {(filesCount > 0 || dialogueCount > 0) && (
        <div className="asp-stats">
          {filesCount > 0 && (
            <div className="asp-stat">
              <span>Файлов загружено</span>
              <b>{filesCount}</b>
            </div>
          )}
          {dialogueCount > 0 && (
            <div className="asp-stat">
              <span>Диалогов прочитано</span>
              <b>{dialogueCount}</b>
            </div>
          )}
        </div>
      )}

      {/* Step list */}
      <div className="asp-steps">
        {ANALYSIS_STEPS.map((step, i) => {
          const state = getStepState(step);
          return (
            <motion.div
              key={step.id}
              className={`asp-step ${state}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.22 }}
            >
              <div className="asp-step-icon">
                {state === 'done'    && <Check size={12} />}
                {state === 'error'   && <AlertCircle size={12} />}
                {state === 'pending' && <Clock size={12} />}
                {state === 'active'  && (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                    style={{ display: 'flex' }}
                  >
                    <Loader2 size={12} />
                  </motion.span>
                )}
              </div>
              <span className="asp-step-label">{step.label}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Error details */}
      {isError && errorMessage && (
        <motion.div
          className="asp-message error"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertCircle size={14} />
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {/* Success summary */}
      {isComplete && (
        <motion.div
          className="asp-message success"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle2 size={14} />
          <div className="asp-message-body">
            <strong>Анализ завершён</strong>
            {employeeName  && <span>Сотрудник: {employeeName}</span>}
            {dialogueCount > 0 && <span>Проверено диалогов: {dialogueCount}</span>}
          </div>
        </motion.div>
      )}

      {/* Idle hint */}
      {isIdle && (
        <p className="asp-idle">Загрузите файлы диалогов и нажмите «Начать анализ».</p>
      )}
    </div>
  );
}

export function RuleToggle({ active, onClick }) {
  return (
    <button className={`rule-toggle ${active ? 'active' : ''}`} type="button" onClick={onClick}>
      <span>{active ? 'Активно' : 'Выключено'}</span>
      <motion.i layout transition={{ type: 'spring', damping: 18, stiffness: 260 }} />
    </button>
  );
}

export function PremiumDropdown({ value, options, onChange, dropUp = false, placeholder = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="premium-select">
      <motion.button
        type="button"
        className={`premium-select-trigger ${open ? 'open' : ''}`}
        whileTap={{ scale: 0.985 }}
        onClick={() => setOpen((current) => !current)}
      >
        <span style={!value && placeholder ? { opacity: 0.45 } : {}}>{value || placeholder}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={17} />
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`premium-select-menu${dropUp ? ' drop-up' : ''}`}
            initial={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropUp ? 6 : -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            {options.map((option) => (
              <motion.button
                type="button"
                className={`premium-select-option ${option === value ? 'selected' : ''}`}
                key={option}
                whileHover={{ x: 3 }}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span>{option}</span>
                {option === value && <Check size={16} />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
