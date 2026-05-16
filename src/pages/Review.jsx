import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FileText, FolderUp, Play, ScrollText } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { parseDialogue } from '../lib/parseDialogue.js';
import { PremiumCard } from '../components/shared.jsx';
import { AiButton } from '../components/AiButton.jsx';
import { AnalysisState, PremiumDropdown } from '../components/display.jsx';
import { useToast } from '../components/Toast.jsx';
import { ReviewReportModal } from '../components/modals.jsx';
import { SALES_DEPARTMENT_REGULATION, DEFAULT_FORBIDDEN_PHRASES } from '../lib/regulation.js';
import { Topbar } from '../components/layout.jsx';

const WORKER_URL = 'https://qa-control-ai-proxy.pasapavlovic68.workers.dev';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function normalizeTextList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (!item || typeof item !== 'object') return '';
      return item.text || item.description || item.title || '';
    })
    .filter(Boolean);
}

function normalizeMistakeList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { title: item, description: '', severity: 'medium' };
      }
      if (!item || typeof item !== 'object') return null;
      const severity = ['critical', 'high', 'medium', 'low'].includes(item.severity)
        ? item.severity
        : 'medium';
      return {
        ...item,
        title: item.title || item.category || item.name || 'Замечание',
        description: item.description || item.evidence || item.explanation || '',
        severity,
      };
    })
    .filter(Boolean);
}

function normalizeCriticalViolations(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') {
        return { title: item, description: '', severity: 'critical' };
      }
      if (!item || typeof item !== 'object') return null;
      return {
        ...item,
        title: item.title || item.category || item.name || 'Критическое нарушение',
        description: item.description || item.evidence || item.explanation || '',
        severity: 'critical',
      };
    })
    .filter(Boolean);
}

function normalizeQualityValue(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.summary || value.description || value.text || JSON.stringify(value);
  }
  return '';
}

function dedupeMistakes(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.severity}|${item.title}|${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDialogueTitle(fileName, index) {
  const cleanName = (fileName || '').replace(/\.[^.]+$/, '').trim();
  return cleanName ? `Диалог: ${cleanName}` : `Диалог ${index + 1}`;
}

function normalizeAiReport(rawReport, fallbackTitle) {
  const criticalViolations = normalizeCriticalViolations(rawReport.critical_violations);
  const mistakes = normalizeMistakeList(rawReport.mistakes);
  const strengths = normalizeTextList(rawReport.strengths);
  const positives = Array.isArray(rawReport.positives)
    ? normalizeTextList(rawReport.positives)
    : strengths;
  const riskFlags = normalizeTextList(rawReport.risk_flags);
  const nextStepQuality = normalizeQualityValue(rawReport.next_step_quality);
  const objectionHandlingQuality = normalizeQualityValue(rawReport.objection_handling_quality);
  const followUpQuality = normalizeQualityValue(rawReport.follow_up_quality);
  const regulationEvidence = {
    type: 'sales_department_regulation',
    critical_violations: criticalViolations,
    risk_flags: riskFlags,
    next_step_quality: nextStepQuality,
    objection_handling_quality: objectionHandlingQuality,
    follow_up_quality: followUpQuality,
  };

  return {
    score: typeof rawReport.score === 'number' ? Math.max(0, Math.min(100, Math.round(rawReport.score))) : 0,
    title: typeof rawReport.title === 'string' && rawReport.title.trim() ? rawReport.title.trim() : fallbackTitle,
    management_summary: typeof rawReport.management_summary === 'string' ? rawReport.management_summary : '',
    critical_violations: criticalViolations,
    mistakes: dedupeMistakes([...criticalViolations, ...mistakes]),
    strengths,
    positives,
    recommendations: Array.isArray(rawReport.recommendations) ? rawReport.recommendations : [],
    next_step_quality: nextStepQuality,
    objection_handling_quality: objectionHandlingQuality,
    follow_up_quality: followUpQuality,
    risk_flags: riskFlags,
    evidence: Array.isArray(rawReport.evidence)
      ? [...rawReport.evidence, regulationEvidence]
      : [regulationEvidence],
    examples: Array.isArray(rawReport.examples)
      ? rawReport.examples.map((ex) => ({ ...ex, type: 'dialogue_example' }))
      : [],
    violations: Array.isArray(rawReport.violations) ? rawReport.violations : [],
    funnel_check: rawReport.funnel_check || null,
  };
}

function buildAggregatePreviewReport(reports, employeeName) {
  const dialogueCount = reports.length;
  const avgScore = dialogueCount
    ? Math.round(reports.reduce((sum, report) => sum + (report.score || 0), 0) / dialogueCount)
    : 0;
  const allMistakes = reports.flatMap((report) => report.mistakes ?? []);
  const criticalCount = allMistakes.filter((mistake) => mistake.severity === 'critical').length;
  const recommendations = reports.flatMap((report) => report.recommendations ?? []).slice(0, 6);
  const summaries = reports
    .map((report) => report.management_summary)
    .filter(Boolean)
    .slice(0, 4);

  return {
    score: avgScore,
    title: `Сводный отчёт: ${employeeName}`,
    management_summary: summaries.length
      ? summaries.join('\n\n')
      : `Проверено диалогов: ${dialogueCount}. Средняя оценка: ${avgScore}.`,
    mistakes: dedupeMistakes(allMistakes),
    positives: reports.flatMap((report) => report.positives ?? []).slice(0, 6),
    recommendations,
    evidence: [{ type: 'batch_summary', reports_count: reports.length, critical_count: criticalCount }],
    employeeName,
    dialogueCount,
    createdAt: new Date().toISOString(),
  };
}

export function Review({ analysis, setAnalysis, employees, organizationId, onDialogueAnalyzed }) {
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Стандарт поддержки');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [currentCheckId, setCurrentCheckId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState(null);
  const [analysisStage, setAnalysisStage] = useState(null);
  const [analysisDlgCount, setAnalysisDlgCount] = useState(0);
  const [analysisCurrentDlg, setAnalysisCurrentDlg] = useState(0);
  const [analysisTotalDlg, setAnalysisTotalDlg] = useState(0);
  const [previewReport, setPreviewReport] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeName) {
      setSelectedEmployeeName(employees[0].name);
    }
  }, [employees]);

  const parseXlsx = async (file) => {
    const { read, utils } = await import('@e965/xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = read(arrayBuffer, { type: 'array' });
    if (!workbook.SheetNames.length) throw new Error('XLSX файл не содержит листов.');
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return utils.sheet_to_csv(firstSheet, { blankrows: false });
  };

  const handleFiles = async (fileList) => {
    const supported = Array.from(fileList).filter(
      (f) => f.name.endsWith('.txt') || f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
    );

    if (supported.length === 0) {
      setUploadError('Поддерживаются только .txt, .csv и .xlsx файлы.');
      return;
    }

    const selectedEmployee = employees.find((e) => e.name === selectedEmployeeName);
    if (!selectedEmployee) {
      setUploadError('Сначала выберите сотрудника.');
      return;
    }

    if (!organizationId) {
      setUploadError('Организация не загружена. Повторите попытку.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    setAnalysisMessage(null);

    try {
      const fileData = await Promise.all(
        supported.map(async (file) => ({
          file,
          text: file.name.endsWith('.xlsx') ? await parseXlsx(file) : await file.text()
        }))
      );

      const { data: check, error: checkError } = await supabase
        .from('qa_checks')
        .insert({
          employee_id: selectedEmployee.id,
          organization_id: organizationId,
          status: 'uploaded',
          dialogues_count: supported.length
        })
        .select()
        .single();

      if (checkError) throw checkError;

      const { error: dialoguesError } = await supabase
        .from('uploaded_dialogues')
        .insert(
          fileData.map(({ file, text }) => ({
            check_id: check.id,
            employee_id: selectedEmployee.id,
            organization_id: organizationId,
            file_name: file.name,
            file_type: file.name.split('.').pop(),
            file_size: file.size,
            raw_text: text,
            status: 'uploaded'
          }))
        );

      if (dialoguesError) throw dialoguesError;

      setCurrentCheckId(check.id);
      setUploadedFiles(fileData.map(({ file }) => ({ name: file.name, size: file.size })));
      setAnalysis('idle');
    } catch (err) {
      console.error('[Review] upload error:', err);
      setUploadError(err.message || 'Ошибка загрузки. Проверьте соединение и попробуйте снова.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!organizationId) {
      setUploadError('Организация не загружена. Повторите попытку.');
      return;
    }
    if (!selectedEmployeeName) {
      setUploadError('Сначала выберите сотрудника.');
      return;
    }
    if (!currentCheckId) {
      setUploadError('Сначала загрузите файлы диалогов.');
      return;
    }

    const selectedEmployee = employees.find((e) => e.name === selectedEmployeeName);
    if (!selectedEmployee) {
      setUploadError('Сотрудник не найден.');
      return;
    }

    const startedAt = performance.now();
    setAnalyzing(true);
    setAnalysisMessage(null);
    setUploadError(null);
    setAnalysis('running');
    setAnalysisStage('preparing');

    try {
      setAnalysisStage('reading_dialogues');
      const { data: dialogues, error: dialoguesError } = await supabase
        .from('uploaded_dialogues')
        .select('file_name, raw_text')
        .eq('check_id', currentCheckId);

      if (dialoguesError) throw new Error('Не удалось загрузить диалоги из базы данных.');
      if (!dialogues || dialogues.length === 0) throw new Error('Нет загруженных диалогов для анализа.');

      const dialogueCount = dialogues.length;
      setAnalysisDlgCount(dialogueCount);
      console.log(`[ReviewCounters] loaded ${dialogueCount} dialogue(s) for check_id=${currentCheckId}`);

      setAnalysisStage('loading_rules');
      const { data: rules, error: rulesError } = await supabase
        .from('qa_rules')
        .select('title, description, category')
        .eq('organization_id', organizationId)
        .eq('enabled', true);

      if (rulesError) throw new Error('Не удалось загрузить правила QA.');

      let settings = {};
      const { data: settingsRows, error: settingsError } = await supabase
        .from('team_settings')
        .select('*')
        .eq('organization_id', organizationId)
        .order('key');

      if (settingsError) {
        console.error('[Review] team settings fetch error:', settingsError);
      } else {
        (settingsRows ?? []).forEach((row) => {
          settings[row.key] = row.value ?? '';
        });
      }

      const parseList = (str) =>
        (str || '').split('\n').map((s) => s.trim()).filter(Boolean);
      const settingsForbiddenPhrases = parseList(settings.forbidden_phrases);
      const analysisContext = {
        language: 'ru',
        outputStyle: settings.report_style || 'management_report',
        strictness: 'high',
        requireEvidence: true,
        domain: 'sales_department_quality_control',
        regulationInstruction: SALES_DEPARTMENT_REGULATION.instruction,
        expectedReportFields: SALES_DEPARTMENT_REGULATION.outputContract,
        scoringRules: SALES_DEPARTMENT_REGULATION.scoring,
        severityCategories: {
          critical: SALES_DEPARTMENT_REGULATION.criticalViolations,
          high: SALES_DEPARTMENT_REGULATION.highSeverity,
          medium: SALES_DEPARTMENT_REGULATION.mediumSeverity,
        },
        restrictedCountries: SALES_DEPARTMENT_REGULATION.restrictedCountries,
        companyInstruction: settings.company_instruction || '',
        salesGoal: settings.sales_goal || '',
        forbiddenPhrases: [...new Set([...DEFAULT_FORBIDDEN_PHRASES, ...settingsForbiddenPhrases])],
        upsellStrategy: settings.upsell_strategy || '',
        criticalMoments: parseList(settings.critical_moments),
        // Custom rules priority: checked first, deductions applied by weight before regulation
        customRulesInstruction: (rules ?? []).filter((r) => r.enabled !== false).length > 0
          ? `ОБЯЗАТЕЛЬНО: В организации есть ${(rules ?? []).filter((r) => r.enabled !== false).length} кастомных правил. Проверь каждое правило отдельно. Нарушение правила снижает балл по весу: Критичная = -20...-30, Высокая = -10...-15, Средняя = -5...-10, Низкая = -2...-5. Кастомные правила имеют приоритет над общим регламентом.`
          : null,
      };
      const rulePayload = (rules ?? []).map((r) => {
        // category field stores "Category · Weight" (e.g. "Процесс · Критичная")
        const [category, weight] = (r.category || '').split(' · ');
        return {
          title: r.title,
          description: r.description,
          category: category || '',
          weight: weight || 'Средняя',
        };
      });
      const dialoguePayloads = dialogues.map((dialogue, index) => {
        const meta = parseDialogue(dialogue.raw_text);
        return {
          fileName: dialogue.file_name,
          rawText: dialogue.raw_text,
          cleanedText: meta.cleanedText,
          detectedFormat: meta.detectedFormat,
          messageCount: meta.messageCount,
          clientMessageCount: meta.clientMessageCount,
          operatorMessageCount: meta.operatorMessageCount,
          fallbackTitle: getDialogueTitle(dialogue.file_name, index),
        };
      });
      const analyzedReports = [];
      const failedDialogues = [];

      setAnalysisStage('contacting_ai');
      setAnalysisTotalDlg(dialoguePayloads.length);
      setAnalysisCurrentDlg(0);

      // Fetch previous mistakes for context
      let previousMistakes = [];
      if (selectedEmployee) {
        const { data: prevReports } = await supabase
          .from('employee_reports')
          .select('mistakes')
          .eq('employee_id', selectedEmployee.id)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(3);
        if (prevReports?.length) {
          previousMistakes = prevReports
            .flatMap((r) => Array.isArray(r.mistakes) ? r.mistakes : [])
            .filter((m) => m?.title)
            .slice(0, 8);
        }
      }

      for (let index = 0; index < dialoguePayloads.length; index += 1) {
        const dialogue = dialoguePayloads[index];
        setAnalysisCurrentDlg(index);
        setAnalysisMessage({ type: 'success', text: `Анализируем диалог ${index + 1} из ${dialoguePayloads.length}: ${dialogue.fileName}` });
        const workerController = new AbortController();
        const workerAbortTimer = setTimeout(() => workerController.abort(), 90000);
        const workerStartedAt = performance.now();

        try {
          const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employeeName: selectedEmployeeName,
              dialogues: [dialogue],
              rules: rulePayload,
              salesDepartmentRegulation: SALES_DEPARTMENT_REGULATION,
              previousMistakes,
              analysisContext: {
                ...analysisContext,
                batch: {
                  currentDialogue: index + 1,
                  totalDialogues: dialoguePayloads.length,
                  fileName: dialogue.fileName,
                },
              }
            }),
            signal: workerController.signal
          });
          console.log(`[Review] worker ms for ${dialogue.fileName}: ${Math.round(performance.now() - workerStartedAt)}`);

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Worker недоступен (${response.status}): ${errText}`);
          }

          let parsed;
          try {
            parsed = await response.json();
          } catch {
            throw new Error('Worker вернул некорректный JSON.');
          }

          const rawReport = parsed?.report;
          if (!rawReport || typeof rawReport !== 'object') {
            throw new Error('Worker вернул неверный формат отчёта.');
          }

          analyzedReports.push(normalizeAiReport(rawReport, dialogue.fallbackTitle));
        } catch (dialogueErr) {
          // Don't abort entire batch — save successful dialogues, report failures separately
          const errMsg = dialogueErr.name === 'AbortError' ? 'Timeout (90s): AI не ответил, попробуй ещё раз' : dialogueErr.message;
          failedDialogues.push({ fileName: dialogue.fileName, error: errMsg });
          console.error(`[Review] dialogue ${index + 1}/${dialoguePayloads.length} failed (${dialogue.fileName}):`, dialogueErr);
        } finally {
          clearTimeout(workerAbortTimer);
        }
      }

      // All dialogues failed — nothing to save
      if (analyzedReports.length === 0) {
        throw new Error(
          failedDialogues.length === 1
            ? `Диалог не удалось проанализировать: ${failedDialogues[0].error}`
            : `Все ${failedDialogues.length} диалогов завершились с ошибкой.`
        );
      }

      // Some failed — warn user but continue saving the successful ones
      if (failedDialogues.length > 0) {
        showToast(`Сохранено ${analyzedReports.length} из ${dialoguePayloads.length} — ${failedDialogues.length} диал. не удалось`, 'error');
      }

      const aggregateReport = buildAggregatePreviewReport(analyzedReports, selectedEmployeeName);
      const criticalCount = aggregateReport.mistakes.filter((m) => m.severity === 'critical').length;

      // ── Generate aggregate summary ────────────────────────────────────────
      let aggregateAiData = null;
      try {
        const mistakeCounts = analyzedReports
          .flatMap((r) => r.mistakes ?? [])
          .reduce((acc, m) => {
            const key = m.title || 'Замечание';
            if (!acc[key]) acc[key] = { title: key, severity: m.severity, count: 0 };
            acc[key].count += 1;
            return acc;
          }, {});
        const topMistakesForAgg = Object.values(mistakeCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6);
        const evidenceForAgg = analyzedReports
          .flatMap((r) => (r.evidence ?? []).filter((e) => e.quote && e.type !== 'sales_department_regulation' && e.type !== 'batch_summary'))
          .slice(0, 12);
        const summariesForAgg = analyzedReports.map((r) => r.management_summary).filter(Boolean);

        const aggResponse = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'aggregate',
            employeeName: selectedEmployeeName,
            summaries: summariesForAgg,
            topMistakes: topMistakesForAgg,
            evidenceItems: evidenceForAgg,
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (aggResponse.ok) {
          const aggJson = await aggResponse.json();
          aggregateAiData = aggJson.aggregate ?? null;
        }
      } catch (aggErr) {
        console.warn('[Aggregate] failed, skipping:', aggErr?.message);
      }

      setAnalysisStage('saving_report');
      const { error: reportError } = await supabase
        .from('reports')
        .insert(analyzedReports.map((report) => ({
          check_id: currentCheckId,
          employee_id: selectedEmployee.id,
          organization_id: organizationId,
          score: report.score,
          title: report.title,
          management_summary: report.management_summary,
          mistakes: report.mistakes,
          positives: report.positives,
          recommendations: report.recommendations,
          evidence: [
            ...(report.evidence ?? []),
            ...(report.examples ?? []),
            ...(report.violations?.length ? [{ type: 'violations_summary', items: report.violations }] : []),
            ...(report.funnel_check ? [{ type: 'funnel_check', ...report.funnel_check }] : []),
          ],
        })));

      if (reportError) throw new Error('Не удалось сохранить отчёт в базе данных.');

      // Save aggregate report as special record
      if (aggregateAiData) {
        await supabase.from('reports').insert({
          check_id: currentCheckId,
          employee_id: selectedEmployee.id,
          organization_id: organizationId,
          score: aggregateReport.score,
          title: '__aggregate__',
          management_summary: aggregateAiData.overall_summary ?? '',
          mistakes: [],
          positives: [],
          recommendations: [],
          evidence: aggregateAiData.dialogue_examples ?? [],
        });
      }

      const { error: checkUpdateError } = await supabase
        .from('qa_checks')
        .update({
          status: 'complete',
          score: aggregateReport.score,
          completed_at: new Date().toISOString(),
          summary: aggregateReport.management_summary,
          critical_errors_count: criticalCount
        })
        .eq('id', currentCheckId);

      if (checkUpdateError) throw checkUpdateError;

      // Recalculate employee score as true average across ALL their reports (not just this batch)
      const { data: allEmployeeReports, error: allReportsErr } = await supabase
        .from('reports')
        .select('score')
        .eq('employee_id', selectedEmployee.id)
        .eq('organization_id', organizationId);

      const trueAvgScore = (!allReportsErr && allEmployeeReports && allEmployeeReports.length > 0)
        ? Math.round(allEmployeeReports.reduce((sum, r) => sum + (r.score || 0), 0) / allEmployeeReports.length)
        : aggregateReport.score;

      console.log(`[PostAnalysisDataFlow] updating employee id=${selectedEmployee.id}: checks_count +${dialogueCount}, score=${trueAvgScore} (avg of ${allEmployeeReports?.length ?? 1} reports)`);
      const { data: empRow, error: empFetchErr } = await supabase
        .from('employees')
        .select('checks_count')
        .eq('id', selectedEmployee.id)
        .single();

      if (empFetchErr) {
        console.error(`[PostAnalysisDataFlow] failed to fetch employee checks_count:`, empFetchErr);
      } else {
        const newCount = (empRow.checks_count ?? 0) + analyzedReports.length;
        const { error: empUpdateErr } = await supabase
          .from('employees')
          .update({ checks_count: newCount, score: trueAvgScore })
          .eq('id', selectedEmployee.id);

        if (empUpdateErr) {
          console.error(`[PostAnalysisDataFlow] failed to update employee id=${selectedEmployee.id}:`, empUpdateErr);
        } else {
          console.log(`[PostAnalysisDataFlow] employee updated: id=${selectedEmployee.id} checks_count=${newCount} score=${trueAvgScore}`);
          onDialogueAnalyzed?.(selectedEmployee.id, dialogueCount, trueAvgScore);
        }
      }

      setAnalysisStage('completed');
      console.log(`[Review] total analysis ms: ${Math.round(performance.now() - startedAt)}`);
      setAnalysis('complete');
      setAnalysisMessage({ type: 'success', text: `Сформировано отчётов: ${analyzedReports.length}.` });
      setPreviewReport(aggregateReport);
      showToast('Отчёт сформирован и сохранён');
    } catch (err) {
      const userMessage = err.name === 'AbortError'
        ? 'AI timeout: сервер не ответил за 90 секунд.'
        : err.message || 'Неизвестная ошибка анализа.';
      console.error('[Review] analysis error:', err);
      setAnalysisStage('failed');
      setAnalysis('error');
      setAnalysisMessage({ type: 'error', text: userMessage });

      if (currentCheckId) {
        supabase
          .from('qa_checks')
          .update({ status: 'failed' })
          .eq('id', currentCheckId)
          .then(({ error }) => {
            if (error) console.error('[Review] failed to mark check as failed:', error);
          });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) handleFiles(event.dataTransfer.files);
  };

  const analysisCardAction =
    analysis === 'running' ? 'В процессе' :
    analysis === 'complete' ? 'Завершён' :
    'Ожидает запуска';

  return (
    <>
    <Topbar title="Проверка" />
    <div className="review-layout">
      <PremiumCard className="review-main" title="Новая проверка диалогов" action="Загрузка файлов">
        <div className="form-row">
          <label>
            <span>Сотрудник</span>
            {employees.length > 0 ? (
              <PremiumDropdown
                value={selectedEmployeeName}
                options={employees.map((e) => e.name)}
                onChange={(name) => {
                  setSelectedEmployeeName(name);
                  setUploadedFiles([]);
                  setCurrentCheckId(null);
                  setUploadError(null);
                  setAnalysisMessage(null);
                  setAnalysis('idle');
                  setAnalysisStage(null);
                  setAnalysisDlgCount(0);
                  setPreviewReport(null);
                }}
              />
            ) : (
              <span className="premium-select-trigger" style={{ opacity: 0.5, cursor: 'default', pointerEvents: 'none' }}>
                Сначала добавьте сотрудника
              </span>
            )}
          </label>
          <label>
            <span>Набор правил проверки</span>
            <PremiumDropdown
              value={selectedPreset}
              options={['Стандарт поддержки', 'Продажи и удержание', 'B2B сопровождение']}
              onChange={setSelectedPreset}
            />
          </label>
        </div>

        <motion.div
          className="upload-zone"
          tabIndex={0}
          style={{ cursor: uploading ? 'wait' : 'pointer' }}
          whileHover={{ scale: 1.006, borderColor: '#8d7cf6' }}
          whileFocus={{ scale: 1.006, borderColor: '#8d7cf6' }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <FolderUp size={30} />
          <strong>{uploading ? 'Загружаем файлы…' : 'Перетащите или нажмите для выбора'}</strong>
          <span>Поддерживаются .txt, .csv и .xlsx файлы диалогов</span>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.xlsx"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
        />

        {uploadError && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: '0.82rem', color: '#e05c5c', textAlign: 'center', marginBottom: 8 }}
          >
            {uploadError}
          </motion.p>
        )}

        <div className="file-list">
          {uploadedFiles.length > 0 ? (
            uploadedFiles.map((file) => (
              <motion.div
                className="file-row"
                key={file.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <FileText size={16} />
                <span>{file.name}</span>
                <b>{formatSize(file.size)}</b>
              </motion.div>
            ))
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0', opacity: 0.4 }}>
              <span style={{ fontSize: '0.875rem' }}>Файлы пока не загружены</span>
            </div>
          )}
        </div>

        {analysisMessage && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: '0.82rem',
              color: analysisMessage.type === 'success' ? '#5bb97b' : '#e05c5c',
              textAlign: 'center',
              marginBottom: 4,
            }}
          >
            {analysisMessage.text}
          </motion.p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AiButton
            onClick={handleStartAnalysis}
            disabled={analyzing || uploading}
            label={analyzing ? 'Анализируем…' : 'Начать анализ'}
          />

          <AnimatePresence>
            {analysis === 'complete' && previewReport && (
              <motion.button
                className="primary-button large"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -2 }}
                onClick={() => setPreviewOpen(true)}
                style={{ flexShrink: 0 }}
              >
                <ScrollText size={18} />
                Просмотреть отчёт
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </PremiumCard>

      <PremiumCard title="Состояние анализа" action={analysisCardAction}>
        <AnalysisState
          status={analysis}
          stage={analysisStage}
          filesCount={uploadedFiles.length}
          dialogueCount={analysisDlgCount}
          employeeName={selectedEmployeeName}
          errorMessage={analysisMessage?.type === 'error' ? analysisMessage.text : null}
          currentDialogue={analysisCurrentDlg}
          totalDialogues={analysisTotalDlg}
        />
      </PremiumCard>

      <AnimatePresence>
        {previewOpen && previewReport && (
          <ReviewReportModal
            report={previewReport}
            onClose={() => setPreviewOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
