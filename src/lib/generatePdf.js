const ACCENT = '#7765e3';
const DANGER = '#be3c44';
const WARNING = '#b97812';
const SUCCESS = '#27ae60';
const MUTED = '#8b8fa8';
const TEXT = '#1a1d2e';
const LINE = '#e8e9f0';

function scoreColor(score) {
  if (score >= 85) return SUCCESS;
  if (score >= 70) return WARNING;
  return DANGER;
}

function lbl(text, color = MUTED) {
  return `<div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">${text}</div>`;
}

function sectionTitle(text, color = MUTED) {
  return `<div style="font-size:10px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.7px;margin-bottom:10px;margin-top:22px;padding-top:16px;border-top:1px solid ${LINE}">${text}</div>`;
}

function summaryBlocks(text) {
  if (!text) return '';
  return text.split(/\n\n+/).filter(Boolean).map((block) => {
    const isImprove = block.trimStart().startsWith('Что бы я усилил');
    const lines = block.split(/\n/).filter(Boolean);
    const inner = lines.map((line, i) => {
      const isBullet = line.trimStart().startsWith('—');
      return `<p style="margin:${isBullet ? '5px 0 0' : '0'};font-size:13px;line-height:1.65;color:${TEXT};font-weight:${i === 0 && isImprove ? '600' : '400'}">${line}</p>`;
    }).join('');
    return isImprove
      ? `<div style="background:rgba(119,101,227,0.06);border:1px solid rgba(119,101,227,0.15);border-radius:10px;padding:12px 14px;margin-top:6px">${inner}</div>`
      : `<div style="margin-top:6px">${inner}</div>`;
  }).join('');
}

function exampleCard(ex) {
  const clientMsg = ex.client_message || '';
  const clientRu = ex.client_message_ru || '';
  const empMsg = ex.employee_response || '';
  const empRu = ex.employee_response_ru || '';
  const idealMsg = ex.ideal_response || '';
  const showClientRu = clientRu && clientRu !== clientMsg;
  const showEmpRu = empRu && empRu !== empMsg;

  return `<div style="border-radius:10px;border:1px solid rgba(119,101,227,0.2);overflow:hidden;margin-bottom:10px">
    ${ex.context ? `<div style="padding:7px 12px;font-size:9px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(119,101,227,0.12);background:rgba(119,101,227,0.05)">${ex.context}</div>` : ''}
    ${clientMsg ? `<div style="padding:9px 12px;border-bottom:1px solid ${LINE}">
      ${lbl('Клиент')}
      <div style="font-size:12px;color:${TEXT};font-style:italic;line-height:1.5">«${clientMsg}»</div>
      ${showClientRu ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">Перевод: ${clientRu}</div>` : ''}
    </div>` : ''}
    ${empMsg ? `<div style="padding:9px 12px;border-bottom:1px solid ${LINE}">
      ${lbl('Как ответила', DANGER)}
      <div style="font-size:12px;color:${TEXT};font-style:italic;line-height:1.5">«${empMsg}»</div>
      ${showEmpRu ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">Перевод: ${empRu}</div>` : ''}
    </div>` : ''}
    ${idealMsg ? `<div style="padding:9px 12px;background:rgba(119,101,227,0.04)">
      ${lbl('Как надо было', ACCENT)}
      <div style="font-size:12px;color:${TEXT};line-height:1.5">${idealMsg}</div>
      ${ex.why ? `<div style="font-size:11px;color:${MUTED};margin-top:4px">${ex.why}</div>` : ''}
    </div>` : ''}
  </div>`;
}

function mistakeCard(m, color, bg, border) {
  const countBadge = m.count > 1
    ? ` <span style="font-size:10px;font-weight:700;color:${color};background:${bg};padding:1px 7px;border-radius:20px;margin-left:6px">×${m.count}</span>`
    : '';
  return `<div style="padding:9px 12px;border-radius:10px;background:${bg};border:1px solid ${border};margin-bottom:7px">
    ${m.title ? `<div style="font-size:12px;font-weight:600;color:${color};margin-bottom:${m.description ? '3px' : '0'}">${m.title}${countBadge}</div>` : ''}
    ${m.description ? `<div style="font-size:11px;color:${TEXT};line-height:1.5">${m.description}</div>` : ''}
  </div>`;
}

function buildAggregateHtml(group) {
  const sc = scoreColor(group.avgScore);
  const date = group.latest?.date || '';
  const aggText = group.aggregateReport?.summary || group.aggregateReport?.management_summary || group.summary || '';
  const aggExamples = (group.aggregateReport?.evidence ?? []).filter((e) => e.client_message);
  const topMistakes = group.topMistakes ?? [];
  const critical = topMistakes.filter((m) => m.severity === 'critical' || m.severity === 'high');
  const medium = topMistakes.filter((m) => m.severity === 'medium');
  const minor = topMistakes.filter((m) => !['critical', 'high', 'medium'].includes(m.severity));

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;color:${TEXT};padding:36px 40px;width:794px;box-sizing:border-box">

  <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:2px solid ${LINE}">
    <div style="width:48px;height:48px;border-radius:14px;background:${ACCENT};display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="font-size:20px;font-weight:800;color:#fff">${(group.employee || '?')[0].toUpperCase()}</span>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px">Общий отчёт</div>
      <div style="font-size:20px;font-weight:800;color:${TEXT};margin-top:2px">${group.employee}</div>
      ${date ? `<div style="font-size:11px;color:${MUTED};margin-top:2px">${date}</div>` : ''}
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:30px;font-weight:800;color:${sc};line-height:1">${group.avgScore}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">средняя оценка</div>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:4px">
    <div style="flex:1;padding:12px;border-radius:10px;background:#f8f7ff;border:1px solid rgba(119,101,227,0.14);text-align:center">
      <div style="font-size:20px;font-weight:800;color:${ACCENT}">${group.avgScore}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">Средняя оценка</div>
    </div>
    <div style="flex:1;padding:12px;border-radius:10px;background:#f8f7ff;border:1px solid rgba(119,101,227,0.14);text-align:center">
      <div style="font-size:20px;font-weight:800;color:${ACCENT}">${group.reportCount}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">Проверок</div>
    </div>
    <div style="flex:1;padding:12px;border-radius:10px;background:#fff0f1;border:1px solid rgba(190,60,68,0.16);text-align:center">
      <div style="font-size:20px;font-weight:800;color:${DANGER}">${group.critical}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">Критично</div>
    </div>
  </div>

  ${aggText ? `${sectionTitle('Общий вывод')}${summaryBlocks(aggText)}` : ''}
  ${aggExamples.length ? `${sectionTitle('Примеры из диалогов')}${aggExamples.slice(0, 3).map(exampleCard).join('')}` : ''}
  ${topMistakes.length ? `
    ${sectionTitle('Частые ошибки')}
    ${critical.map((m) => mistakeCard(m, DANGER, 'rgba(190,60,68,0.06)', 'rgba(190,60,68,0.16)')).join('')}
    ${medium.map((m) => mistakeCard(m, WARNING, 'rgba(185,120,18,0.06)', 'rgba(185,120,18,0.16)')).join('')}
    ${minor.map((m) => mistakeCard(m, ACCENT, 'rgba(119,101,227,0.05)', 'rgba(119,101,227,0.14)')).join('')}
  ` : ''}

</div>`;
}

function buildDialogueHtml(report) {
  const sc = scoreColor(report.score);
  const employeeName = report.employeeName || report.employee || '';
  const summaryText = report.management_summary || report.summary || '';
  const allMistakes = report.mistakes ?? [];
  const critical = allMistakes.filter((m) => m.severity === 'critical' || m.severity === 'high');
  const medium = allMistakes.filter((m) => m.severity === 'medium');
  const minor = allMistakes.filter((m) => !['critical', 'high', 'medium'].includes(m.severity));
  const recommendations = report.recommendations ?? [];
  const evidence = report.evidence ?? [];
  const examples = evidence.filter((e) => e.type === 'dialogue_example');
  const quotes = evidence.filter((e) => e && e.type !== 'sales_department_regulation' && e.type !== 'batch_summary' && e.type !== 'dialogue_example' && (e.quote || e.text));
  const formattedDate = report.createdAt
    ? new Date(report.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : (report.date || '');

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;color:${TEXT};padding:36px 40px;width:794px;box-sizing:border-box">

  <div style="margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid ${LINE}">
    <div style="font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px;margin-bottom:5px">Отчёт по проверке</div>
    <div style="font-size:18px;font-weight:800;color:${TEXT};line-height:1.3">${report.title || 'Отчёт'}</div>
    ${(employeeName || formattedDate) ? `<div style="font-size:11px;color:${MUTED};margin-top:4px">${[employeeName, formattedDate].filter(Boolean).join(' · ')}</div>` : ''}
  </div>

  <div style="display:flex;align-items:center;gap:14px">
    <div style="width:52px;height:52px;border-radius:14px;background:${sc}18;border:1.5px solid ${sc}44;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:${sc};flex-shrink:0">${report.score}</div>
    <div>
      <div style="font-size:10px;color:${MUTED};margin-bottom:2px">Итоговая оценка</div>
      <div style="font-size:14px;font-weight:600;color:${sc}">${report.score >= 85 ? 'Высокий уровень' : report.score >= 70 ? 'Средний уровень' : 'Низкий уровень'}</div>
    </div>
  </div>

  ${summaryText ? `${sectionTitle('Резюме')}${summaryBlocks(summaryText)}` : ''}
  ${examples.length ? `${sectionTitle('Примеры')}${examples.map(exampleCard).join('')}` : ''}

  ${recommendations.length ? `
    ${sectionTitle('Рекомендации')}
    <ul style="margin:0;padding-left:16px;display:flex;flex-direction:column;gap:6px">
      ${recommendations.map((rec) => `<li style="font-size:12px;line-height:1.6;color:${TEXT}">${typeof rec === 'string' ? rec : (rec.text || rec.description || rec.title || '')}</li>`).join('')}
    </ul>
  ` : ''}

  ${critical.length ? `${sectionTitle('Критично', DANGER)}${critical.map((m) => mistakeCard(m, DANGER, 'rgba(190,60,68,0.06)', 'rgba(190,60,68,0.16)')).join('')}` : ''}
  ${medium.length ? `${sectionTitle('Требует внимания', WARNING)}${medium.map((m) => mistakeCard(m, WARNING, 'rgba(185,120,18,0.06)', 'rgba(185,120,18,0.16)')).join('')}` : ''}
  ${minor.length ? `${sectionTitle('Замечание', ACCENT)}${minor.map((m) => mistakeCard(m, ACCENT, 'rgba(119,101,227,0.05)', 'rgba(119,101,227,0.14)')).join('')}` : ''}

  ${quotes.length ? `
    ${sectionTitle('Цитаты из диалога')}
    ${quotes.map((e) => {
      const origQuote = e.quote || e.text || '';
      const ruQuote = e.quote_ru || '';
      const showTr = ruQuote && ruQuote !== origQuote;
      const elbl = e.rule || e.title || e.context || '';
      const ideal = e.ideal_response || '';
      return `<div style="border-radius:10px;border:1px solid rgba(119,101,227,0.16);overflow:hidden;margin-bottom:8px">
        ${elbl ? `<div style="padding:6px 12px;font-size:9px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(119,101,227,0.10);background:rgba(119,101,227,0.04)">${elbl}</div>` : ''}
        <div style="padding:9px 12px${ideal ? ';border-bottom:1px solid rgba(119,101,227,0.10)' : ''}">
          <div style="font-size:12px;color:${TEXT};font-style:italic;line-height:1.5">«${origQuote}»</div>
          ${showTr ? `<div style="font-size:11px;color:${MUTED};margin-top:3px">Перевод: ${ruQuote}</div>` : ''}
          ${e.comment ? `<div style="font-size:11px;color:${MUTED};margin-top:4px">${e.comment}</div>` : ''}
        </div>
        ${ideal ? `<div style="padding:9px 12px;background:rgba(119,101,227,0.04)">
          ${lbl('Как надо было', ACCENT)}
          <div style="font-size:12px;color:${TEXT};line-height:1.5">${ideal}</div>
        </div>` : ''}
      </div>`;
    }).join('')}
  ` : ''}

</div>`;
}

async function renderPdf(innerHtml, filename) {
  const html2pdf = (await import('html2pdf.js')).default;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:794px',
    'z-index:-9999',
    'pointer-events:none',
    'opacity:0.01',
    'background:#ffffff',
  ].join(';');
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);

  try {
    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794,
        },
        jsPDF: { unit: 'px', format: [794, 1123], orientation: 'portrait', hotfixes: ['px_scaling'] },
        pagebreak: { mode: ['avoid-all', 'css'] },
      })
      .from(wrapper.firstElementChild)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}

function buildCheckHtml(checkGroup, employeeName) {
  const sc = scoreColor(checkGroup.avgScore);
  const date = checkGroup.date
    ? new Date(checkGroup.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const aggText = checkGroup.aggregateReport?.summary || checkGroup.aggregateReport?.management_summary || '';
  const aggExamples = (checkGroup.aggregateReport?.evidence ?? []).filter((e) => e.client_message);
  const topMistakes = checkGroup.topMistakes ?? [];
  const criticalM = topMistakes.filter((m) => m.severity === 'critical' || m.severity === 'high');
  const mediumM = topMistakes.filter((m) => m.severity === 'medium');
  const minorM = topMistakes.filter((m) => !['critical', 'high', 'medium'].includes(m.severity));

  const dialogsHtml = (checkGroup.reports ?? []).map((r, i) => {
    const rSc = scoreColor(r.score);
    const firstPara = (r.management_summary || r.summary || '').split(/\n\n/)[0] || '';
    const critMistakes = (r.mistakes ?? []).filter((m) => m.severity === 'critical' || m.severity === 'high').slice(0, 3);
    return `
      <div style="border-radius:12px;border:1px solid ${LINE};overflow:hidden;margin-bottom:10px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;background:#fafafa;border-bottom:1px solid ${LINE}">
          <div style="width:38px;height:38px;border-radius:10px;background:${rSc}18;border:1.5px solid ${rSc}44;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800;color:${rSc};flex-shrink:0">${r.score}</div>
          <div style="min-width:0">
            <div style="font-size:13px;font-weight:700;color:${TEXT};line-height:1.3">${r.title || `Диалог ${i + 1}`}</div>
            ${r.date ? `<div style="font-size:11px;color:${MUTED}">${r.date}</div>` : ''}
          </div>
        </div>
        ${firstPara ? `<div style="padding:10px 14px;font-size:12px;color:${TEXT};line-height:1.55${critMistakes.length ? ';border-bottom:1px solid ' + LINE : ''}">${firstPara}</div>` : ''}
        ${critMistakes.length ? `<div style="padding:8px 14px;background:rgba(190,60,68,0.03)">
          ${critMistakes.map((m) => `<div style="font-size:11px;color:${DANGER};padding:2px 0;font-weight:500">⚠ ${m.title}</div>`).join('')}
        </div>` : ''}
      </div>`;
  }).join('');

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#ffffff;color:${TEXT};padding:36px 40px;width:794px;box-sizing:border-box">

  <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;padding-bottom:18px;border-bottom:2px solid ${LINE}">
    <div style="width:48px;height:48px;border-radius:14px;background:${ACCENT};display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <span style="font-size:20px;font-weight:800;color:#fff">${(employeeName || '?')[0].toUpperCase()}</span>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.6px">Отчёт за проверку</div>
      <div style="font-size:20px;font-weight:800;color:${TEXT};margin-top:2px">${employeeName}</div>
      ${date ? `<div style="font-size:11px;color:${MUTED};margin-top:2px">${date}</div>` : ''}
    </div>
    <div style="margin-left:auto;text-align:right">
      <div style="font-size:30px;font-weight:800;color:${sc};line-height:1">${checkGroup.avgScore}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">средняя оценка</div>
    </div>
  </div>

  <div style="display:flex;gap:10px;margin-bottom:4px">
    <div style="flex:1;padding:12px;border-radius:10px;background:#f8f7ff;border:1px solid rgba(119,101,227,0.14);text-align:center">
      <div style="font-size:20px;font-weight:800;color:${ACCENT}">${checkGroup.count}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">Диалогов</div>
    </div>
    <div style="flex:1;padding:12px;border-radius:10px;background:#f8f7ff;border:1px solid rgba(119,101,227,0.14);text-align:center">
      <div style="font-size:20px;font-weight:800;color:${sc}">${checkGroup.avgScore}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">Средняя оценка</div>
    </div>
    <div style="flex:1;padding:12px;border-radius:10px;background:#fff0f1;border:1px solid rgba(190,60,68,0.16);text-align:center">
      <div style="font-size:20px;font-weight:800;color:${DANGER}">${checkGroup.critical}</div>
      <div style="font-size:10px;color:${MUTED};margin-top:3px">Критичных</div>
    </div>
  </div>

  ${aggText ? `${sectionTitle('Общий анализ')}${summaryBlocks(aggText)}` : ''}

  ${topMistakes.length ? `
    ${sectionTitle('Частые ошибки')}
    ${criticalM.map((m) => mistakeCard(m, DANGER, 'rgba(190,60,68,0.06)', 'rgba(190,60,68,0.16)')).join('')}
    ${mediumM.map((m) => mistakeCard(m, WARNING, 'rgba(185,120,18,0.06)', 'rgba(185,120,18,0.16)')).join('')}
    ${minorM.map((m) => mistakeCard(m, ACCENT, 'rgba(119,101,227,0.05)', 'rgba(119,101,227,0.14)')).join('')}
  ` : ''}

  ${aggExamples.length ? `${sectionTitle('Примеры из диалогов')}${aggExamples.slice(0, 2).map(exampleCard).join('')}` : ''}

  ${sectionTitle(`Диалоги (${checkGroup.count})`)}
  ${dialogsHtml}

</div>`;
}

export async function downloadCheckPdf(checkGroup, employeeName) {
  const safeName = (employeeName || 'Отчёт').replace(/\s+/g, '_');
  const dateStr = checkGroup.date
    ? new Date(checkGroup.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-')
    : new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');
  await renderPdf(buildCheckHtml(checkGroup, employeeName), `${safeName}_${dateStr}.pdf`);
}

export async function downloadAggregatePdf(group) {
  const safeName = (group.employee || 'Отчёт').replace(/\s+/g, '_');
  const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');
  await renderPdf(buildAggregateHtml(group), `${safeName}_общий_${date}.pdf`);
}

export async function downloadDialoguePdf(report) {
  const safeName = (report.employeeName || report.employee || 'Диалог').replace(/\s+/g, '_');
  const safeTitle = (report.title || 'отчёт').slice(0, 25).replace(/[^\wа-яА-Я]/g, '_');
  const date = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '-');
  await renderPdf(buildDialogueHtml(report), `${safeName}_${safeTitle}_${date}.pdf`);
}
