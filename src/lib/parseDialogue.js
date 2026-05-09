const CLIENT_RE = /^(Клиент|Покупатель|Пользователь|Client|User|Customer)\s*:/i;
const OPERATOR_RE = /^(Оператор|Агент|Менеджер|Поддержка|Support|Agent|Manager)\s*:/i;
const SEPARATOR_RE = /^[-=]{2,}$/;
const MAX_CHARS = 50_000;

export function parseDialogue(rawText) {
  if (!rawText || !rawText.trim()) {
    return { cleanedText: '', detectedFormat: 'freeform', messageCount: 0, clientMessageCount: 0, operatorMessageCount: 0 };
  }

  const lines = rawText.split('\n').map((l) => l.trim());

  let clientMessageCount = 0;
  let operatorMessageCount = 0;
  const cleaned = [];
  let blankRun = 0;

  for (const line of lines) {
    if (CLIENT_RE.test(line)) clientMessageCount++;
    if (OPERATOR_RE.test(line)) operatorMessageCount++;

    if (line === '') {
      blankRun++;
      if (blankRun <= 1) cleaned.push('');
    } else if (SEPARATOR_RE.test(line)) {
      blankRun = 0;
    } else {
      blankRun = 0;
      cleaned.push(line);
    }
  }

  const messageCount = clientMessageCount + operatorMessageCount;
  const detectedFormat = clientMessageCount > 0 && operatorMessageCount > 0 ? 'structured' : 'freeform';

  let cleanedText = cleaned.join('\n').trim();
  if (cleanedText.length > MAX_CHARS) {
    cleanedText = cleanedText.slice(0, MAX_CHARS) + '\n[Диалог обрезан до 50 000 символов]';
  }

  return { cleanedText, detectedFormat, messageCount, clientMessageCount, operatorMessageCount };
}
