import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, FolderUp, Play } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { PremiumCard } from '../components/shared.jsx';
import { AnalysisState, PremiumDropdown } from '../components/display.jsx';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function Review({ analysis, employees }) {
  const fileInputRef = useRef(null);

  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('Стандарт поддержки');
  const [notReady, setNotReady] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    if (employees.length > 0 && !selectedEmployeeName) {
      setSelectedEmployeeName(employees[0].name);
    }
  }, [employees]);

  const handleFiles = async (fileList) => {
    const supported = Array.from(fileList).filter(
      (f) => f.name.endsWith('.txt') || f.name.endsWith('.csv')
    );

    if (supported.length === 0) {
      setUploadError('Поддерживаются только .txt и .csv файлы. XLSX будет добавлен позже.');
      return;
    }

    const selectedEmployee = employees.find((e) => e.name === selectedEmployeeName);
    if (!selectedEmployee) {
      setUploadError('Сначала выберите сотрудника.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const fileData = await Promise.all(
        supported.map(async (file) => ({ file, text: await file.text() }))
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

      setUploadedFiles(
        fileData.map(({ file }) => ({ name: file.name, size: file.size, checkId: check.id }))
      );
    } catch (err) {
      console.error('[Review] upload error:', err);
      setUploadError('Ошибка загрузки. Проверьте соединение и попробуйте снова.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) handleFiles(event.dataTransfer.files);
  };

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
                  setUploadError(null);
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
          <span>Поддерживаются .txt и .csv файлы диалогов</span>
        </motion.div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
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
          onClick={() => setNotReady(true)}
        >
          <Play size={18} />
          Начать анализ
        </motion.button>
        {notReady && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: '0.82rem', opacity: 0.55, textAlign: 'center', marginTop: 8 }}
          >
            AI-анализ ещё не подключён — сначала будет подключена загрузка файлов и OpenAI API.
          </motion.p>
        )}
      </PremiumCard>

      <PremiumCard title="Состояние анализа" action="Ожидает запуска">
        <AnalysisState status={analysis} />
      </PremiumCard>
    </div>
  );
}
