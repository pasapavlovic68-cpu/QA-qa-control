// QA regulation config — edit here to change scoring rules, violation categories, and forbidden phrases.
// This file is the single source of truth for the sales department regulation sent to the AI worker.

export const SALES_DEPARTMENT_REGULATION = {
  role: 'sales_quality_control',
  instruction:
    'Оценивай диалоги строго по регламенту отдела продаж. Не выдумывай нарушения: каждое замечание должно опираться на видимый текст диалога, таймстемпы или явный контекст.',
  criticalViolations: [
    'promises of guaranteed profit',
    'promises of insurance/refund/compensation',
    'claims about platform errors or secret methods',
    'claims of special/exclusive conditions from Pocket',
    'insider information claims',
    'external links to partners/bloggers/Telegram/YouTube',
    'work with restricted countries: Russia, USA, Israel',
    'misleading trader/client',
    'no follow-up after client withdrew money',
    'communication during stream if visible in dialogue',
    'no objection handling in a clear sales-critical moment',
  ],
  highSeverity: [
    'reply delay over 10 minutes if timestamps are present',
    'no follow-up after trading session if visible',
    'no initiative',
    'weak lead control',
    'weak objection handling',
    'no clear next step',
    'client doubts are ignored',
    'financial difficulty objection is not handled',
  ],
  mediumSeverity: [
    'dry or generic replies',
    'weak empathy',
    'poor message structure',
    'no CTA',
    'too much vague text',
    'weak closing',
  ],
  restrictedCountries: ['Russia', 'USA', 'Israel'],
  scoring: {
    base: 100,
    // Penalty ranges per severity — worker applies these when violations are found
    critical: { min: 30, max: 60 },
    high:     { min: 10, max: 20 },
    medium:   { min: 5,  max: 10 },
    low:      { min: 1,  max: 5  },
    constraints: [
      'Never invent violations.',
      'If timestamps are absent, do not penalize response delay.',
      'If country/client geo is not visible, do not assume.',
      'If stream context is not visible, do not penalize.',
      'Be strict but evidence-based.',
    ],
  },
  outputContract: {
    score: 'number 0-100',
    management_summary: 'string',
    critical_violations: 'array',
    mistakes: 'array with severity: critical / high / medium / low',
    strengths: 'array',
    recommendations: 'array',
    next_step_quality: 'string',
    objection_handling_quality: 'string',
    follow_up_quality: 'string',
    risk_flags: 'array',
  },
};

// Forbidden phrases always checked regardless of custom rules
export const DEFAULT_FORBIDDEN_PHRASES = [
  'guaranteed profit',
  'insurance',
  'refund',
  'compensation',
  'platform error',
  'secret method',
  'special conditions from Pocket',
  'exclusive conditions from Pocket',
  'insider information',
  'Telegram',
  'YouTube',
];
