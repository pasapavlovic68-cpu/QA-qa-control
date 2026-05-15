const ACCENT = '#7765e3';
const DANGER = '#be3c44';
const WARNING = '#b97812';
const SUCCESS = '#27ae60';
const MUTED = '#8b8fa8';
const TEXT = '#1a1d2e';
const LINE = '#e8e9f0';
const BG = '#ffffff';

function scoreColor(score) {
  if (score >= 85) return SUCCESS;
  if (score >= 70) return WARNING;
  return DANGER;
}

function severityColor(severity) {
  if (severity === 'critical') return DANGER;
  if (severity === 'high') return DANGER;
  if (severity === 'medium') return WARNING;
  return ACCENT;
}

function severityLabel(severity) {
  if (severity === 'critical') return 'Критично';
  if (severity === 'high') return 'Высокое';
  if (severity === 'medium') return 'Среднее';
  return 'Замечание';
}

function label(text) {
  return `<div style="font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">${text}</div>`;
}

function sectionTitle(text, color = MUTED) {
  return `<div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.7px;margin-bottom:10px;margin-top:20px;padding-top:16px;border-top:1px solid ${LINE}">${text}</div>`;
}

function exampleCard(ex) {
  const clientMsg = ex.client_message || '';
  const clientRu = ex.client_message_ru || '';
  const empMsg = ex.employee_response || '';
  const empRu = ex.employee_response_ru || '';
  const idealMsg = ex.ideal_response || '';
  const showClientRu = clientRu && clientRu !== clientMsg;
  const showEmpRu = empRu && empRu !== empMsg;

  return `
    <div style="border-radius:12px;border:1px solid rgba(119,101,227,0.18);overflow:hidden;margin-bottom:12px">
      ${ex.context ? `<div style="padding:7px 14px;font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(119,101,227,0.12);background:rgba(119,101,227,0.05)">${ex.context}</div>` : ''}
      ${clientMsg ? `<div style="padding:10px 14px;border-bottom:1px solid ${LINE}">
        ${label('Клиент')}
        <div style="font-size:13px;color:${TEXT};font-style:italic;line-height:1.5">«${clientMsg}»</div>
        ${showClientRu ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">Перевод: ${clientRu}</div>` : ''}
      </div>` : ''}
      ${empMsg ? `<div style="padding:10px 14px;border-bottom:1px solid ${LINE}">
        ${label('<span style="color:' + DANGER + '">Как ответила</span>')}
        <div style="font-size:13px;color:${TEXT};font-style:italic;line-height:1.5">«${empMsg}»</div>
        ${showEmpRu ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">Перевод: ${empRu}</div>` : ''}
      </div>` : ''}
      ${idealMsg ? `<div style="padding:10px 14px;background:rgba(119,101,227,0.04)">
        ${label('<span style="color:' + ACCENT + '">Как надо было</span>')}
        <div style="font-size:13px;color:${TEXT};line-height:1.5">${idealMsg}</div>
        ${ex.why ? `<div style="font-size:11px;color:${MUTED};margin-top:5px">${ex.why}</div>` : ''}
      </div>` : ''}
    </div>`;
}

function summaryBlocks(text) {
  if (!text) return '';
  return text.split(/\n\n+/).filter(Boolean).map((block) => {
    const isImprove = block.trimStart().startsWith('Что бы я усилил');
    const lines = block.split(/\n/).filter(Boolean);
    const linesHtml = lines.map((line, i) => {
      const isBullet = line.trimStart().startsWith('—');
      return `<p style="margin:${isBullet ? '4px 0 0' : '0'};font-size:14px;line-height:1.65;color:${TEXT};padding-left:${isBullet ? '4px' : '0'};font-weight:${i === 0 && isImprove ? '600' : '400'}">${line}</p>`;
    }).join('');
    if (isImprove) {
      return `<div style="background:rgba(119,101,227,0.05);border:1px solid rgba(119,101,227,0.14);border-radius:12px;padding:12px 16px;margin-top:4px">${linesHtml}</div>`;
    }
    return `<div style="margin-top:4px">${linesHtml}</div>`;
  }).join('');
}

function mistakeCard(m, color, bgColor, borderColor) {
  return `<div style="padding:10px 14px;border-radius:12px;background:${bgColor};border:1px solid ${borderColor};margin-bottom:8px">
    ${m.title ? `<div style="font-size:13px;font-weight:600;color:${color};margin-bottom:${m.description ? '4px' : '0'}">${m.title}${m.count > 1 ? ` <span style="font-size:11px;opacity:0.7">×${m.count}</span>` : ''}</div>` : ''}
    ${m.description ? `<div style="font-size:12px;color:${TEXT};line-height:1.5">${m.description}</div>` : ''}
  </div>`;
}

function buildAggregateHtml(group) {
  const sc = scoreColor(group.avgScore);
  const date = group.latest?.date || '';
  const aggText = group.aggregateReport?.summary || group.aggregateReport?.management_summary || group.summary || '';
  const aggExamples = (group.aggregateReport?.evidence ?? []).filter((e) => e.client_message);
  const topMistakes = group.topMistakes ?? [];
  const criticalMistakes = topMistakes.filter((m) => m.severity === 'critical' || m.severity === 'high');
  const mediumMistakes = topMistakes.filter((m) => m.severity === 'medium');
  const minorMistakes = topMistakes.filter((m) => !['critical', 'high', 'medium'].includes(m.severity));

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${BG};color:${TEXT};padding:32px;max-width:800px;margin:0 auto}</style>
  </head><body>

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid ${LINE}">
    <div style="width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,${ACCENT},#9b8af0);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="font-size:22px;font-weight:800;color:#fff">${(group.employee || '?')[0].toUpperCase()}</span>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px">Общий отчёт</div>
      <div style="font-size:22px;font-weight:800;color:${TEXT};margin-top:2px">${group.employee}</div>
      ${date ? `<div style="font-size:12px;color:${MUTED};margin-top:2px">${date}</div>` : ''}
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:32px;font-weight:800;color:${sc}">${group.avgScore}</div>
      <div style="font-size:11px;color:${MUTED}">средняя оценка</div>
    </div>
  </div>

  <!-- Stats -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:4px">
    <div style="padding:14px;border-radius:12px;background:#f8f7ff;border:1px solid rgba(119,101,227,0.12);text-align:center">
      <div style="font-size:22px;font-weight:800;color:${ACCENT}">${group.avgScore}</div>
      <div style="font-size:11px;color:${MUTED};margin-top:3px">Средняя оценка</div>
    </div>
    <div style="padding:14px;border-radius:12px;background:#f8f7ff;border:1px solid rgba(119,101,227,0.12);text-align:center">
      <div style="font-size:22px;font-weight:800;color:${ACCENT}">${group.reportCount}</div>
      <div style="font-size:11px;color:${MUTED};margin-top:3px">Проверок</div>
    </div>
    <div style="padding:14px;border-radius:12px;background:#fff0f1;border:1px solid rgba(190,60,68,0.15);text-align:center">
      <div style="font-size:22px;font-weight:800;color:${DANGER}">${group.critical}</div>
      <div style="font-size:11px;color:${MUTED};margin-top:3px">Критично</div>
    </div>
  </div>

  <!-- Общий вывод -->
  ${aggText ? `${sectionTitle('Общий вывод')}${summaryBlocks(aggText)}` : ''}

  <!-- Примеры из диалогов -->
  ${aggExamples.length ? `${sectionTitle('Примеры из диалогов')}${aggExamples.slice(0, 3).map(exampleCard).join('')}` : ''}

  <!-- Частые ошибки -->
  ${topMistakes.length ? `
    ${sectionTitle('Частые ошибки')}
    ${criticalMistakes.map((m) => mistakeCard(m, DANGER, 'rgba(190,60,68,0.06)', 'rgba(190,60,68,0.16)')).join('')}
    ${mediumMistakes.map((m) => mistakeCard(m, WARNING, 'rgba(185,120,18,0.06)', 'rgba(185,120,18,0.16)')).join('')}
    ${minorMistakes.map((m) => mistakeCard(m, ACCENT, 'rgba(119,101,227,0.05)', 'rgba(119,101,227,0.14)')).join('')}
  ` : ''}

  </body></html>`;
}

function buildDialogueHtml(report) {
  const sc = scoreColor(report.score);
  const employeeName = report.employeeName || report.employee || '';
  const summaryText = report.management_summary || report.summary || '';
  const allMistakes = report.mistakes ?? [];
  const criticalMistakes = allMistakes.filter((m) => m.severity === 'critical' || m.severity === 'high');
  const mediumMistakes = allMistakes.filter((m) => m.severity === 'medium');
  const minorMistakes = allMistakes.filter((m) => !['critical', 'high', 'medium'].includes(m.severity));
  const recommendations = report.recommendations ?? [];
  const evidence = (report.evidence ?? []);
  const exampleItems = evidence.filter((e) => e.type === 'dialogue_example');
  const quoteItems = evidence.filter((e) => e && e.type !== 'sales_department_regulation' && e.type !== 'batch_summary' && e.type !== 'dialogue_example' && (e.quote || e.text));
  const formattedDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : (report.date || '');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${BG};color:${TEXT};padding:32px;max-width:800px;margin:0 auto}</style>
  </head><body>

  <!-- Header -->
  <div style="margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid ${LINE}">
    <div style="font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px">Отчёт по проверке</div>
    <div style="font-size:20px;font-weight:800;color:${TEXT};line-height:1.3">${report.title || 'Отчёт'}</div>
    ${(employeeName || formattedDate) ? `<div style="font-size:12px;color:${MUTED};margin-top:5px">${[employeeName, formattedDate].filter(Boolean).join(' · ')}</div>` : ''}
  </div>

  <!-- Score -->
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:4px">
    <div style="width:56px;height:56px;border-radius:16px;background:#f8f7ff;border:1.5px solid ${sc}44;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:${sc};flex-shrink:0">${report.score}</div>
    <div>
      <div style="font-size:11px;color:${MUTED};margin-bottom:2px">Итоговая оценка</div>
      <div style="font-size:15px;font-weight:600;color:${sc}">${report.score >= 85 ? 'Высокий уровень' : report.score >= 70 ? 'Средний уровень' : 'Низкий уровень'}</div>
    </div>
  </div>

  <!-- Summary -->
  ${summaryText ? `${sectionTitle('Резюме')}${summaryBlocks(summaryText)}` : ''}

  <!-- Примеры -->
  ${exampleItems.length ? `${sectionTitle('Примеры')}${exampleItems.map(exampleCard).join('')}` : ''}

  <!-- Рекомендации -->
  ${recommendations.length ? `
    ${sectionTitle('Рекомендации')}
    <ul style="padding-left:18px;display:flex;flex-direction:column;gap:7px">
      ${recommendations.map((rec) => `<li style="font-size:13px;line-height:1.6;color:${TEXT}">${typeof rec === 'string' ? rec : (rec.text || rec.description || rec.title || '')}</li>`).join('')}
    </ul>
  ` : ''}

  <!-- Критичные ошибки -->
  ${criticalMistakes.length ? `
    ${sectionTitle('Критично', DANGER)}
    ${criticalMistakes.map((m) => mistakeCard(m, DANGER, 'rgba(190,60,68,0.06)', 'rgba(190,60,68,0.16)')).join('')}
  ` : ''}

  <!-- Средние ошибки -->
  ${mediumMistakes.length ? `
    ${sectionTitle('Требует внимания', WARNING)}
    ${mediumMistakes.map((m) => mistakeCard(m, WARNING, 'rgba(185,120,18,0.06)', 'rgba(185,120,18,0.16)')).join('')}
  ` : ''}

  <!-- Замечания -->
  ${minorMistakes.length ? `
    ${sectionTitle('Замечание', ACCENT)}
    ${minorMistakes.map((m) => mistakeCard(m, ACCENT, 'rgba(119,101,227,0.05)', 'rgba(119,101,227,0.14)')).join('')}
  ` : ''}

  <!-- Цитаты -->
  ${quoteItems.length ? `
    ${sectionTitle('Цитаты из диалога')}
    ${quoteItems.map((e) => {
      const origQuote = e.quote || e.text || '';
      const ruQuote = e.quote_ru || '';
      const showTranslation = ruQuote && ruQuote !== origQuote;
      const lbl = e.rule || e.title || e.context || '';
      const ideal = e.ideal_response || '';
      return `<div style="border-radius:12px;border:1px solid rgba(119,101,227,0.15);overflow:hidden;margin-bottom:10px">
        ${lbl ? `<div style="padding:7px 14px;font-size:10px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(119,101,227,0.10);background:rgba(119,101,227,0.04)">${lbl}</div>` : ''}
        <div style="padding:10px 14px${ideal ? ';border-bottom:1px solid rgba(119,101,227,0.10)' : ''}">
          <div style="font-size:13px;color:${TEXT};font-style:italic;line-height:1.5">«${origQuote}»</div>
          ${showTranslation ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">Перевод: ${ruQuote}</div>` : ''}
          ${e.comment ? `<div style="font-size:11px;color:${MUTED};margin-top:5px">${e.comment}</div>` : ''}
        </div>
        ${ideal ? `<div style="padding:10px 14px;background:rgba(119,101,227,0.04)">
          <div style="font-size:10px;font-weight:700;color:${ACCENT};margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Как надо было</div>
          <div style="font-size:13px;color:${TEXT};line-height:1.5">${ideal}</div>
        </div>` : ''}
      </div>`;
    }).join('')}
  ` : ''}

  </body></html>`;
}

export async function downloadAggregatePdf(group) {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = buildAggregateHtml(group);

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const safeName = (group.employee || 'Отчёт').replace(/\s+/g, '_');
  const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');

  await html2pdf()
    .set({
      margin: 0,
      filename: `${safeName}_общий_${date}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container.firstElementChild)
    .save();

  document.body.removeChild(container);
}

export async function downloadDialoguePdf(report) {
  const html2pdf = (await import('html2pdf.js')).default;
  const html = buildDialogueHtml(report);

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  const safeName = (report.employeeName || report.employee || 'Диалог').replace(/\s+/g, '_');
  const safeTitle = (report.title || 'отчёт').slice(0, 30).replace(/\s+/g, '_').replace(/[^\wа-яА-Я_-]/g, '');
  const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');

  await html2pdf()
    .set({
      margin: 0,
      filename: `${safeName}_${safeTitle}_${date}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(container.firstElementChild)
    .save();

  document.body.removeChild(container);
}
