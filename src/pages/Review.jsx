import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FolderUp, Play } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { parseDialogue } from '../lib/parseDialogue.js';
import { PremiumCard } from '../components/shared.jsx';
import { AnalysisState, PremiumDropdown } from '../components/display.jsx';

const WORKER_URL = 'https://qa-control-ai-proxy.pasapavlovic68.workers.dev';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function Review({ analysis, setAnalysis, employees }) {
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

    const workerController = new AbortController();
    const workerAbortTimer = setTimeout(() => workerController.abort(), 45000);

    try {
      setAnalysisStage('reading_dialogues');
      const { data: dialogues, error: dialoguesError } = await supabase
        .from('uploaded_dialogues')
        .select('file_name, raw_text')
        .eq('check_id', currentCheckId);

      if (dialoguesError) throw new Error('Не удалось загрузить диалоги из базы данных.');
      if (!dialogues || dialogues.length === 0) throw new Error('Нет загруженных диалогов для анализа.');

      setAnalysisStage('loading_rules');
      const { data: rules, error: rulesError } = await supabase
        .from('qa_rules')
        .select('title, description, category')
        .eq('enabled', true);

      if (rulesError) throw new Error('Не удалось загрузить правила QA.');

      setAnalysisStage('contacting_ai');
      const workerStartedAt = performance.now();
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: selectedEmployeeName,
          dialogues: dialogues.map((d) => {
            const meta = parseDialogue(d.raw_text);
            return {
              fileName: d.file_name,
              rawText: d.raw_text,
              cleanedText: meta.cleanedText,
              detectedFormat: meta.detectedFormat,
              messageCount: meta.messageCount,
              clientMessageCount: meta.clientMessageCount,
              operatorMessageCount: meta.operatorMessageCount
            };
          }),
          rules: (rules ?? []).map((r) => ({
            title: r.title,
            description: r.description,
            category: r.category || ''
          })),
          analysisContext: {
            language: 'ru',
            outputStyle: 'management_report',
            strictness: 'high',
            requireEvidence: true
          }
        }),
        signal: workerController.signal
      });
      console.log(`[Review] worker ms: ${Math.round(performance.now() - workerStartedAt)}`);

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

      const report = {
        score: typeof rawReport.score === 'number' ? rawReport.score : 0,
        title: typeof rawReport.title === 'string' && rawReport.title.trim() ? rawReport.title.trim() : 'Отчёт',
        management_summary: typeof rawReport.management_summary === 'string' ? rawReport.management_summary : '',
        mistakes: Array.isArray(rawReport.mistakes) ? rawReport.mistakes : [],
        positives: Array.isArray(rawReport.positives) ? rawReport.positives : [],
        recommendations: Array.isArray(rawReport.recommendations) ? rawReport.recommendations : [],
        evidence: Array.isArray(rawReport.evidence) ? rawReport.evidence : [],
      };

      const criticalCount = report.mistakes.filter((m) => m.severity === 'critical').length;

      setAnalysisStage('saving_report');
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          check_id: currentCheckId,
          employee_id: selectedEmployee.id,
          score: report.score,
          title: report.title,
          management_summary: report.management_summary,
          mistakes: report.mistakes,
          positives: report.positives,
          recommendations: report.recommendations,
          evidence: report.evidence
        });

      if (reportError) throw new Error('Не удалось сохранить отчёт в базе данных.');

      const { error: checkUpdateError } = await supabase
        .from('qa_checks')
        .update({
          status: 'complete',
          score: report.score,
          completed_at: new Date().toISOString(),
          summary: report.management_summary,
          critical_errors_count: criticalCount
        })
        .eq('id', currentCheckId);

      if (checkUpdateError) throw checkUpdateError;

      setAnalysisStage('completed');
      console.log(`[Review] total analysis ms: ${Math.round(performance.now() - startedAt)}`);
      setAnalysis('complete');
      setAnalysisMessage({ type: 'success', text: 'Отчёт сформирован и сохранён.' });
    } catch (err) {
      const userMessage = err.name === 'AbortError'
        ? 'AI timeout: сервер не ответил за 45 секунд.'
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
      clearTimeout(workerAbortTimer);
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
                }}
              />
            ) : (
              <span className="premium-select-trigger" style={{ opacity: 0.5, cursor: 'default', pointerEvents: 'none' }}>
                Сначала добавьте сотрудника
              </span>
            )}
          </label>
          <label>
            <span>Набор правил QA</span>
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

        <motion.button
          className="primary-button large"
          whileTap={{ scale: 0.97 }}
          whileHover={{ y: -2 }}
          disabled={analyzing || uploading}
          onClick={handleStartAnalysis}
        >
          <Play size={18} />
          {analyzing ? 'Анализируем…' : 'Начать анализ'}
        </motion.button>

        {analysisMessage && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: '0.82rem',
              color: analysisMessage.type === 'success' ? '#5bb97b' : '#e05c5c',
              textAlign: 'center',
              marginTop: 8
            }}
          >
            {analysisMessage.text}
          </motion.p>
        )}
      </PremiumCard>

      <PremiumCard title="Состояние анализа" action={analysisCardAction}>
        <AnalysisState status={analysis} stage={analysisStage} />
      </PremiumCard>
    </div>
  );
}
