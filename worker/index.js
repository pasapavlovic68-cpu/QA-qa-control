const corsHeaders = {
  "Access-Control-Allow-Origin": "https://pasapavlovic68-cpu.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }
    if (!env.OPENAI_API_KEY) {
      return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const dialogues = Array.isArray(payload.dialogues) ? payload.dialogues : [];
    const rules = Array.isArray(payload.rules) ? payload.rules : [];
    const employeeName = String(payload.employeeName || "Сотрудник");
    const ctx = payload.analysisContext || {};
    const reg = payload.salesDepartmentRegulation || {};

    // ── Aggregate summary mode ───────────────────────────────────────────────
    if (payload.mode === 'aggregate') {
      const aggEmployeeName = String(payload.employeeName || 'Сотрудник');
      const aggFirstName = aggEmployeeName.trim().split(/\s+/)[0];
      const aggFirstNameLower = aggFirstName.toLowerCase();
      const aggEndsInAya = /[аяАЯ]$/u.test(aggFirstName);
      const AGG_MALE_NAMES = new Set([
        'гриша','миша','саша','коля','серёжа','сережа','лёша','леша','витя','петя','федя',
        'дима','стёпа','степа','сеня','тёма','тема','женя','слава','ваня','паша','вася',
        'лёня','леня','гена','толя','тима','боря','яша','сёма','сема','кеша','лёва','лева',
        'митя','вова','кузя','алёша','алеша','илюша','филя','никита','данила','кирюша','андрюша',
      ]);
      let aggIsFemale;
      if (payload.employeeGender === 'female') {
        aggIsFemale = true;
      } else if (payload.employeeGender === 'male') {
        aggIsFemale = false;
      } else {
        aggIsFemale = aggEndsInAya && !AGG_MALE_NAMES.has(aggFirstNameLower);
      }
      const aggGenderNote = aggIsFemale
        ? `Сотрудник женского пола. Используй женский род: сотрудница, она, её, «ты сделала», «ты пропустила», «ты справилась».`
        : `Сотрудник мужского пола. Используй мужской род: сотрудник, он, его, «ты сделал», «ты пропустил», «ты справился».`;

      const aggDialogueCount = Array.isArray(payload.summaries) ? payload.summaries.length : 1;
      const aggCountNote = aggDialogueCount === 1
        ? 'Передан ОДИН диалог. Не пиши «во всех диалогах» или «снова и снова» — пиши «в этом диалоге».'
        : `Передано диалогов: ${aggDialogueCount}. Обобщай паттерны которые повторяются.`;

      const summaries = Array.isArray(payload.summaries) ? payload.summaries : [];
      const topMistakes = Array.isArray(payload.topMistakes) ? payload.topMistakes : [];
      const evidenceItems = Array.isArray(payload.evidenceItems) ? payload.evidenceItems : [];

      const aggSystemPrompt = `
Ты — руководитель отдела продаж. Ты проанализировал диалоги сотрудника за этот период и пишешь итоговый разбор.

${aggGenderNote}
Это требование — проверяй каждый глагол.

КОЛИЧЕСТВО ДИАЛОГОВ:
${aggCountNote}

ЯЗЫК — ТОЛЬКО РУССКИЙ:
Весь текст пиши по-русски. Запрещены английские термины: follow-up → «повторный контакт», SLA → «регламент», KPI → «показатели».

СТРОГОЕ ПРАВИЛО — НЕ ПРИДУМЫВАЙ:
Пиши только о том что реально есть в переданных диалогах и цитатах.
Если какого-то события в диалогах не было — не упоминай это как ошибку.

ГЛАВНОЕ ПРАВИЛО: Пиши про СОТРУДНИКА, а не про конкретных клиентов.
— НЕ упоминай имена клиентов/лидов вообще — они не важны для итогового разбора
— НЕ описывай один конкретный диалог если их несколько — обобщай паттерны
— Если диалог один — анализируй его, не придумывай паттерны из нескольких диалогов

ФОРМАТ ОТВЕТА: ТОЛЬКО валидный JSON. Без markdown, без \`\`\`json.

{
  "overall_summary": string,
  "dialogue_examples": [
    {
      "context": string,
      "client_message": string,
      "client_message_ru": string,
      "employee_response": string,
      "employee_response_ru": string,
      "ideal_response": string,
      "why": string
    }
  ]
}

ТРЕБОВАНИЯ:

overall_summary — итоговый разбор про сотрудника, 150-250 слов, три абзаца через \\n\\n:
  Абзац 1: какой ты сотрудник в целом — сильные стороны и главная слабость.
  Абзац 2: конкретные наблюдения через тире — что получилось хорошо, что нужно улучшить. Без имён клиентов. Говори только о том что реально есть в диалогах.
  Абзац 3: «Что бы я усилил:» (мужской) или «Что бы я усилила:» (женский) — 3-4 пункта через тире, конкретные действия на "ты".

dialogue_examples — 2-3 реальных момента из цитат которые тебе дали:
  context — ситуация (без имени клиента, например «Когда клиент говорит о маленьком капитале»)
  client_message — оригинальная реплика клиента (дословно)
  client_message_ru — перевод на русский (если уже по-русски — продублируй)
  employee_response — что сотрудник ответил (оригинал)
  employee_response_ru — перевод на русский
  ideal_response — как надо было ответить (напиши по-русски, живо, как реальный менеджер)
  why — почему этот ответ лучше (1 предложение по-русски)
`.trim();

      const aggUserPrompt = `
Сотрудник: ${aggEmployeeName}

ЧАСТЫЕ ОШИБКИ:
${topMistakes.map((m, i) => `${i + 1}. ${m.title} [${m.severity}] — встречается ${m.count || 1} раз`).join('\n')}

РАЗБОРЫ ДИАЛОГОВ:
${summaries.map((s, i) => `--- Диалог ${i + 1} ---\n${s}`).join('\n\n')}

ЦИТАТЫ ИЗ ДИАЛОГОВ:
${evidenceItems.slice(0, 10).map((e) => `• "${e.quote}" — ${e.comment || e.rule || ''}`).join('\n')}
`.trim();

      try {
        const aggResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            input: [
              { role: 'system', content: aggSystemPrompt },
              { role: 'user', content: aggUserPrompt },
            ],
            temperature: 0.4,
          }),
        });

        const aggData = await aggResponse.json();
        if (!aggResponse.ok) {
          return jsonResponse({ error: 'OpenAI aggregate request failed', details: aggData }, aggResponse.status);
        }

        const aggRaw = aggData.output_text || aggData.output?.[0]?.content?.[0]?.text || '';
        const aggStripped = aggRaw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const aggStart = aggStripped.indexOf('{');
        const aggEnd = aggStripped.lastIndexOf('}');
        const aggClean = aggStart !== -1 && aggEnd !== -1 ? aggStripped.slice(aggStart, aggEnd + 1) : aggStripped;

        let aggResult;
        try {
          aggResult = JSON.parse(aggClean);
        } catch {
          return jsonResponse({ error: 'OpenAI returned non-JSON aggregate response', raw: aggRaw }, 502);
        }

        return jsonResponse({ aggregate: aggResult });
      } catch (error) {
        return jsonResponse({ error: 'Aggregate worker request failed', details: String(error?.message || error) }, 500);
      }
    }

    if (!dialogues.length) {
      return jsonResponse({ error: "No dialogues provided" }, 400);
    }

    // ── Response time calculation (deterministic, JS-side) ───────────────────
    function calcResponseTimeMinutes(rawText) {
      const lines = rawText.split('\n');
      const entries = [];
      for (const line of lines) {
        // Matches: SALE(15.05.2026 20:54): or CUSTOMER(20:47):
        const full = line.match(/^(SALE|CUSTOMER)\((\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\):/);
        if (full) {
          const [, role, d, t] = full;
          const [dd, mm, yyyy] = d.split('.');
          entries.push({ role, dt: new Date(`${yyyy}-${mm}-${dd}T${t}:00`) });
          continue;
        }
        const timeOnly = line.match(/^(SALE|CUSTOMER)\((\d{2}:\d{2})\):/);
        if (timeOnly) {
          const [, role, t] = timeOnly;
          entries.push({ role, dt: new Date(`1970-01-01T${t}:00`) });
        }
      }
      if (!entries.length) return null;
      const customers = entries.filter(e => e.role === 'CUSTOMER');
      const sales = entries.filter(e => e.role === 'SALE');
      if (!customers.length || !sales.length) return null;
      const firstCustomer = customers.reduce((a, b) => a.dt < b.dt ? a : b);
      const firstSale = sales.reduce((a, b) => a.dt < b.dt ? a : b);
      const diffMs = firstSale.dt - firstCustomer.dt;
      if (diffMs <= 0) return 0; // SALE initiated
      return Math.round(diffMs / 60000);
    }

    // ── Trim pre-registration bot messages ───────────────────────────────────
    // Before the registration link is sent, a bot handles the conversation.
    // Only the post-registration part (real employee) should be analyzed.
    // Messages are in REVERSE chronological order (newest at top, oldest at bottom).
    // Registration link line = oldest occurrence of shortink/pocketoption URL in SALE message.
    // We keep everything ABOVE that line (= post-registration, real employee).
    function trimToPostRegistration(rawText) {
      const lines = rawText.split('\n');
      let linkLineIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^SALE\(/.test(line) && (
          /shortink\.io/i.test(line) ||
          /pocketoption\.com/i.test(line) ||
          /pocket\.com/i.test(line) ||
          /[?&]utm_campaign=/i.test(line) ||
          /\/register/i.test(line)
        )) {
          linkLineIndex = i; // keep looking — last match = chronologically first link
        }
      }
      if (linkLineIndex === -1) return rawText; // no registration link found, analyze all
      // Keep lines above the link line (post-registration conversation)
      const postReg = lines.slice(0, linkLineIndex).join('\n').trim();
      return postReg || rawText; // fallback to full text if nothing above
    }

    const allRawText = dialogues.map(d => String(d.rawText || '')).join('\n');
    const trimmedRawText = trimToPostRegistration(allRawText);
    const wasTrimmmed = trimmedRawText !== allRawText;
    const responseTimeMinutes = calcResponseTimeMinutes(trimmedRawText);

    // ── Dialogue text ────────────────────────────────────────────────────────
    const dialogueText = dialogues
      .map((item, i) => {
        const name = item.fileName || `dialogue_${i + 1}`;
        const full = String(item.rawText || "");
        const trimmed = trimToPostRegistration(full);
        const text = trimmed.slice(0, 18000);
        return `=== Файл: ${name} ===\n${text}`;
      })
      .join("\n\n");

    // ── Custom rules with weights ────────────────────────────────────────────
    const customRulesText = rules.length
      ? rules
          .map((r, i) => {
            const weight = r.weight ? ` [${r.weight}]` : "";
            const cat = r.category ? ` (${r.category})` : "";
            return `${i + 1}. ${r.title}${cat}${weight}\n   ${r.description || ""}`;
          })
          .join("\n")
      : null;

    // ── Scoring formula from regulation ──────────────────────────────────────
    const scoring = reg.scoring || {};
    const penaltyLines = [
      scoring.critical
        ? `  • критичное нарушение: −${scoring.critical.min}…−${scoring.critical.max} баллов`
        : "  • критичное нарушение: −30…−60 баллов",
      scoring.high
        ? `  • высокое: −${scoring.high.min}…−${scoring.high.max} баллов`
        : "  • высокое: −10…−20 баллов",
      scoring.medium
        ? `  • среднее: −${scoring.medium.min}…−${scoring.medium.max} баллов`
        : "  • среднее: −5…−10 баллов",
      scoring.low
        ? `  • низкое: −${scoring.low.min}…−${scoring.low.max} баллов`
        : "  • низкое: −1…−5 баллов",
    ].join("\n");

    // ── Context sections ─────────────────────────────────────────────────────
    const contextParts = [];

    if (ctx.companyInstruction) {
      contextParts.push(`КОНТЕКСТ КОМПАНИИ:\n${ctx.companyInstruction}`);
    }
    if (ctx.salesGoal) {
      contextParts.push(`ЦЕЛЬ ПРОДАЖ:\n${ctx.salesGoal}`);
    }
    if (ctx.upsellStrategy) {
      contextParts.push(`СТРАТЕГИЯ АПСЕЛА:\n${ctx.upsellStrategy}`);
    }
    if (ctx.forbiddenPhrases && ctx.forbiddenPhrases.length) {
      contextParts.push(
        `ЗАПРЕЩЁННЫЕ ФРАЗЫ (каждое использование = отдельная ошибка severity high):\n${ctx.forbiddenPhrases.join(", ")}`
      );
    }
    if (ctx.criticalMoments && ctx.criticalMoments.length) {
      contextParts.push(
        `КРИТИЧЕСКИЕ МОМЕНТЫ ДЛЯ ПРОВЕРКИ:\n${ctx.criticalMoments.map((m) => `— ${m}`).join("\n")}`
      );
    }
    if (customRulesText) {
      contextParts.push(
        `ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА ОРГАНИЗАЦИИ (приоритет над базовым регламентом):\n${customRulesText}`
      );
    }

    const prevMistakes = Array.isArray(payload.previousMistakes) ? payload.previousMistakes : [];
    if (prevMistakes.length > 0) {
      const prevList = prevMistakes.slice(0, 5).map((m, i) => `${i + 1}. ${m.title}${m.severity ? ` [${m.severity}]` : ''}`).join('\n');
      contextParts.push(
        `ПРЕДЫДУЩИЕ ОШИБКИ СОТРУДНИКА (из прошлых проверок):\n${prevList}\n\nВ management_summary отметь: какие из этих ошибок повторились снова («снова допустил[а]»), а какие исправлены («молодец, на этот раз»). Если ошибка повторилась — это важно подчеркнуть.`
      );
    }

    // Determine gender: use explicit field if provided, otherwise detect from Russian name.
    let isFemale;
    if (payload.employeeGender === 'female') {
      isFemale = true;
    } else if (payload.employeeGender === 'male') {
      isFemale = false;
    } else {
      // Auto-detect: male short names ending in а/я must not be treated as female.
      const MALE_NAMES_ENDING_A = new Set([
        'гриша','миша','саша','коля','серёжа','сережа','лёша','леша','витя','петя','федя',
        'дима','стёпа','степа','сеня','тёма','тема','женя','слава','ваня','паша','вася',
        'лёня','леня','гена','толя','тима','боря','яша','сёма','сема','кеша','лёва','лева',
        'митя','вова','кузя','алёша','алеша','илюша','филя','фёдя','федя','никита',
        'данила','данила','кирюша','андрюша','стасик',
      ]);
      const firstName = employeeName.trim().split(/\s+/)[0];
      const firstNameLower = firstName.toLowerCase();
      const endsInAya = /[аяАЯ]$/u.test(firstName);
      isFemale = endsInAya && !MALE_NAMES_ENDING_A.has(firstNameLower);
    }
    const genderNote = isFemale
      ? `Сотрудник женского пола. Используй женский род последовательно везде: сотрудница, она, её, «ты сделала», «ты пропустила», «ты справилась», «ты включилась» и т.д.`
      : `Сотрудник мужского пола. Используй мужской род везде: сотрудник, он, его, «ты сделал», «ты пропустил», «ты справился».`;

    // ── System prompt ────────────────────────────────────────────────────────
    const systemPrompt = `
Ты — руководитель отдела продаж. Ты читаешь диалог своего сотрудника с клиентом и пишешь ему живую обратную связь — как будто разбираешь звонок вместе, один на один.

ФОРМАТ ДИАЛОГА — читай внимательно:
В диалоге каждое сообщение помечено меткой в начале строки:
  SALE — это сообщения сотрудника (того кого ты проверяешь)
  CUSTOMER — это сообщения клиента
Никогда не путай их. Если написано SALE — это сказал сотрудник. Если CUSTOMER — это сказал клиент.
Сообщения идут в обратном хронологическом порядке (новые сверху, старые снизу) — читай снизу вверх чтобы понять ход разговора.

ГЕНДЕР — СТРОГО ОБЯЗАТЕЛЬНО:
${genderNote}
Это не рекомендация — это требование. Проверь каждый глагол в тексте.

ЯЗЫК — ТОЛЬКО РУССКИЙ:
Весь текст ответа пиши исключительно по-русски. Запрещены английские термины:
  ✗ follow-up → пиши «повторный контакт» или «дожим»
  ✗ SLA → пиши «регламент»
  ✗ KPI → пиши «показатели»
  ✗ lead → пиши «клиент» или «лид»
Цитаты из диалога оставляй на языке оригинала — только они.

СТРОГОЕ ПРАВИЛО — НЕ ПРИДУМЫВАЙ:
Фиксируй ТОЛЬКО то что реально есть в тексте диалога.
  ✗ Нельзя писать об ошибке «не сделал повторный контакт после торговой сессии» — если в диалоге сессии ещё не было
  ✗ Нельзя писать «несколько диалогов» или «во всех диалогах» — если передан один диалог
  ✗ Нельзя придумывать реплики клиента или сотрудника которых нет в тексте
  ✓ Если событие не произошло в этом конкретном диалоге — не упоминай его вообще

СТИЛЬ — это самое важное:
Пиши так, как будто ты сам сидишь рядом с сотрудником и говоришь ему в лицо. Не отчёт, не методичка. Живые предложения, конкретные примеры, без воды и без канцелярщины.
— Начинай сразу с сути: «Смотри, вот что я вижу в этом диалоге…»
— Говори "ты", обращайся к сотруднику напрямую: «ты пропустил момент», «тут ты хорошо сделал», «вот это убери»
— Не пиши "сотрудник сделал" — пиши "ты сделал/сделала"
— Не пиши "По диалогу видно" — пиши "Смотрю на диалог и вижу", "Вот что бросается в глаза"
— Тон — как у старшего коллеги который хочет чтобы ты вырос/выросла, не судья
— Если что-то хорошо — скажи честно. Если плохо — скажи прямо, но без унижения
— Пиши по-русски, даже если диалог на другом языке

ПРАВИЛО ПРО СУММЫ И ДОХОД — важно:
Упоминать конкретные суммы заработка РАЗРЕШЕНО. Запрещено только ГАРАНТИРОВАТЬ доход.
  ✓ Нормально: «можно зарабатывать 300 в день», «клиенты выходят на 500 в неделю», «потенциал от 200 до 1000»
  ✗ Нарушение: «вы БУДЕТЕ зарабатывать 300», «гарантированный доход 500», «guaranteed profit», «ingreso estable»
Фраза содержит запрещённое слово-гарантию (guaranteed, garantizado, стабильный доход, точно заработаешь)?
  → нарушение. Просто называет цифру без гарантии? → не нарушение, не упоминай вообще.

ПРАВИЛА КОМПАНИИ — ПРОВЕРЯЙ ОБЯЗАТЕЛЬНО:

1. СТРУКТУРА ДИАЛОГА:
   Менеджер обязан проявлять инициативу, удерживать лидерство и закрывать возражения.
   Обязательные этапы воронки (в порядке):
     а) Приветствие и знакомство
     б) Выявление потребности (вопросы о целях, ситуации, опыте клиента)
     в) Презентация / объяснение продукта
     г) Закрытие возражений (страх, отсутствие денег, недоверие)
     д) Призыв к действию (регистрация, депозит, следующий шаг)
   Проверь каждый этап: пройден / пропущен / выполнен частично.
   Ссылку на регистрацию слать только после выявления потребности — иначе нарушение (medium).

2. СКОРОСТЬ ОТВЕТА:
   Первый ответ менеджера лиду — не более 10 минут.
   Время уже посчитано системой точно: response_time_minutes = ${responseTimeMinutes !== null ? responseTimeMinutes : 'неизвестно (нет таймстампов)'}.
   НЕ пересчитывай его сам — используй только это значение.
   Используй его в funnel_check.response_time_minutes (число или null).
   Если значение > 10 — это нарушение severity high.

3. СТРОГО ЗАПРЕЩЕНО (каждое найденное → violations, severity critical):
   — Обещать страховку, возврат депозита или гарантированную прибыль
   — Ссылаться на ошибки платформы или секретные приёмы для заработка
   — Давать обещания которые невозможно выполнить
   — Заявлять о договорённостях или эксклюзивных условиях от имени Pocket Option
   — Представляться как сотрудник / партнёр Pocket Option с особым доступом

   Конкретные запрещённые фразы и их аналоги (на любом языке):
   • «Если что-то пойдет не так, я верну вам депозит» / «te devuelvo el depósito»
   • «Сейчас на платформе есть ошибка, позволяющая легко получать прибыль»
   • «Я работаю напрямую с Pocket, у меня особые условия» / «trabajo directamente con Pocket»
   • «У меня есть инсайдерская информация от Pocket» / «tengo información de Pocket»
   • «Не волнуйтесь, я всё уладил, вам выплатят компенсацию»
   • «garantía», «te aseguro», «sin riesgo» в контексте прибыли или возврата
   • «operar sin riesgos ni pérdidas» — обещание работы без рисков и потерь (запрещено)
   • «empezar a ganar dinero conmigo hoy mismo» — обещание немедленного заработка (запрещено)

   РАЗРЕШЕНО и НЕ является нарушением:
   ✓ Отправлять ссылки (на регистрацию, на Telegram-группу, на платформу) — это нормальная практика
   ✓ Называть конкретные суммы заработка без гарантий
   ✓ Предлагать обучение и поддержку

ФОРМАТ ОТВЕТА:
Верни ТОЛЬКО валидный JSON. Никакого markdown, никаких \`\`\`json, никаких объяснений вне JSON.

{
  "score": number,
  "title": string,
  "management_summary": string,
  "funnel_check": {
    "stages_completed": [string],
    "stages_missed": [string],
    "response_time_minutes": number | null,
    "initiative_rating": "low" | "medium" | "high",
    "initiative_comment": string
  },
  "violations": [
    { "rule": string, "quote": string, "timestamp": string | null, "severity": "critical" | "high", "explanation": string }
  ],
  "mistakes": [
    { "title": string, "description": string, "severity": "low" | "medium" | "high" | "critical", "timestamp": string | null }
  ],
  "positives": [
    { "title": string, "description": string }
  ],
  "recommendations": [
    { "title": string, "description": string }
  ],
  "evidence": [
    { "rule": string, "quote": string, "comment": string }
  ],
  "examples": [
    {
      "context": string,
      "client_message": string,
      "client_message_ru": string,
      "employee_response": string,
      "employee_response_ru": string,
      "ideal_response": string,
      "why": string
    }
  ]
}

ТРЕБОВАНИЯ К КАЖДОМУ ПОЛЮ:

score — итоговая оценка:
  Начинай со 100, вычитай за каждое нарушение:
${penaltyLines}
  Дополнительно: за каждое нарушение из раздела СТРОГО ЗАПРЕЩЕНО → −30…−60 (critical).
  За скорость ответа > 10 минут → −10…−20 (high).
  За пропущенный обязательный этап воронки → −5…−15 (зависит от этапа).
  Считай честно. Не занижай и не завышай без причины.
  Правила организации — в приоритете над базовым регламентом.

title — одна фраза-заголовок про этот конкретный диалог.
  Примеры: «Живой клиент, ты его не дожал», «Хорошая скорость, но закрытия нет».
  Если есть критичное нарушение — отрази это: «Запрещённые обещания: диалог под угрозой».
  Не шаблон — реальный вывод.

management_summary — главный текст разбора, пиши от себя, обращаясь к сотруднику на "ты":
  ОБЯЗАТЕЛЬНО разбей на три чётких абзаца, разделённых двойным переносом строки (\n\n):

  Абзац 1 — Клиент (1-2 предложения): определи имя клиента/лида из диалога (если есть) и обращайся к нему по имени. Опиши кто он, как себя вёл, насколько был готов к покупке. ВАЖНО: каждый раз начинай по-разному — не повторяй одни и те же вводные фразы. Варианты начала: «Смотрю на диалог с [имя клиента] и вижу...», «Вот что я заметил[а] в переписке с [имя]...», «[Имя клиента] — типичный [тип клиента]...», «Интересный диалог с [имя]...» и т.д.

  Абзац 2 — Наблюдения (основной блок): конкретные наблюдения через тире (—). Каждый пункт с новой строки (\n). Пиши про: скорость ответа (если есть таймстампы), работу с возражениями и страхами, прохождение этапов воронки, закрытие на шаг, удержание инициативы, запрещённые фразы если были.

  Абзац 3 — Что бы я усилил: начни с этой фразы, затем 3-5 конкретных пунктов через тире (—) с новой строки (\n). Каждый пункт — конкретное действие на "ты".

  Длина: 180-350 слов. Используй \n\n между абзацами и \n перед каждым тире внутри абзацев.
  Если были нарушения из раздела СТРОГО ЗАПРЕЩЕНО — обязательно упомяни их в абзаце 2.

funnel_check — анализ прохождения воронки:
  stages_completed — список пройденных этапов (из: "Приветствие", "Выявление потребности", "Презентация", "Закрытие возражений", "Призыв к действию")
  stages_missed — список пропущенных этапов
  response_time_minutes — СТРОГО используй значение ${responseTimeMinutes !== null ? responseTimeMinutes : 'null'} — оно уже посчитано системой. НЕ меняй его.
  initiative_rating — "high" если менеджер задаёт вопросы, ведёт, не даёт диалогу умереть; "medium" если частично; "low" если клиент ведёт разговор
  initiative_comment — 1 предложение: что конкретно говорит об уровне инициативы

violations — ТОЛЬКО жёсткие нарушения правил компании:
  Сюда попадает только то что прямо запрещено (раздел СТРОГО ЗАПРЕЩЕНО) + скорость ответа > 10 мин.
  rule — название нарушенного правила
  quote — дословная цитата из диалога (если нарушение выражено конкретной фразой)
  timestamp — время сообщения из диалога где зафиксировано нарушение, формат "ЧЧ:ММ" (извлеки из таймстампа рядом с цитатой). Если таймстампа нет — null.
  severity — "critical" для запрещённых фраз/обещаний, "high" для скорости ответа
  explanation — почему это нарушение, 1 предложение
  Если нарушений нет — пустой массив [].

mistakes — качественные ошибки в работе (техника продаж, структура, коммуникация):
  description — что именно произошло, можно с цитатой.
  timestamp — время сообщения из диалога где зафиксирована ошибка, формат "ЧЧ:ММ" (извлеки из таймстампа рядом с описываемым событием). Если таймстамп неизвестен — null.
  severity:
    critical — потерянная конверсия, полный провал закрытия
    high — не обработал возражение, ушёл от вопроса, пропустил ключевой этап
    medium — шаблон, слабое закрытие, мало живых вопросов, слишком быстро дал ссылку
    low — мелкое замечание
  Нарушено правило организации — укажи его название в title.
  НЕ дублируй сюда то что уже попало в violations.

positives — реальные сильные стороны. Не придумывай если их нет.

recommendations — конкретные действия на следующий диалог, на "ты".
  Не «улучши коммуникацию» — а: «Когда клиент говорит про страх — сначала прими, потом предложи шаг».

evidence — цитаты подтверждающие ключевые наблюдения:
  "quote" — дословная цитата из текста диалога (оригинальный язык).
  "quote_ru" — перевод цитаты на русский (если уже по-русски — продублируй).
  "rule" — к какому наблюдению/ошибке относится.
  "comment" — почему важно, 1 предложение по-русски.
  "ideal_response" — как НАДО было ответить в этот момент (напиши по-русски, живо, как реальный менеджер, 1-2 предложения).
  Не добавляй пункт если цитаты в тексте нет. Не придумывай цитаты.

examples — 2-3 конкретных момента из ЭТОГО диалога, где сотрудник мог ответить лучше:
  context — ситуация (например «Клиент говорит что боится потерять деньги»).
  client_message — ТОЛЬКО реплика помеченная CUSTOMER в диалоге (дословно, оригинал). Не ставь сюда реплику SALE.
  client_message_ru — перевод на русский (если уже по-русски — продублируй).
  employee_response — ТОЛЬКО реплика помеченная SALE в диалоге (дословно, оригинал). Не ставь сюда реплику CUSTOMER.
  employee_response_ru — перевод на русский.
  ideal_response — как надо было ответить (по-русски, живо, как реальный менеджер, 1-3 предложения).
  why — почему этот ответ лучше (1 предложение по-русски).
  ВАЖНО: client_message и employee_response должны быть из одного и того же момента диалога — реплика клиента и следующий за ней ответ сотрудника.
  Бери только реальные моменты из диалога. Не придумывай реплики. Если не можешь найти подходящий момент — не включай пример.
`.trim();

    // ── User prompt ──────────────────────────────────────────────────────────
    const userPrompt = `
Сотрудник: ${employeeName}

${wasTrimmmed ? `ВАЖНО: Диалог обрезан — удалена часть до отправки ссылки на регистрацию (это писал бот, не сотрудник). Ты видишь только реальный диалог сотрудника с клиентом после регистрации.\n\n` : ''}${contextParts.length ? contextParts.join("\n\n") + "\n\n" : ""}ДИАЛОГ ДЛЯ РАЗБОРА:
${dialogueText}
`.trim();

    // ── Call OpenAI ──────────────────────────────────────────────────────────
    try {
      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_output_tokens: 3000,
        }),
      });

      const data = await openaiResponse.json();

      if (!openaiResponse.ok) {
        return jsonResponse(
          { error: "OpenAI request failed", details: data },
          openaiResponse.status
        );
      }

      const raw =
        data.output_text ||
        data.output?.[0]?.content?.[0]?.text ||
        "";

      // Strip markdown fences, then find the JSON object/array
      const stripped = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const jsonStart = stripped.indexOf('{');
      const jsonEnd = stripped.lastIndexOf('}');
      const clean = jsonStart !== -1 && jsonEnd !== -1
        ? stripped.slice(jsonStart, jsonEnd + 1)
        : stripped;

      let report;
      try {
        report = JSON.parse(clean);
      } catch {
        return jsonResponse(
          { error: "OpenAI returned non-JSON response", raw },
          502
        );
      }

      return jsonResponse({ report });
    } catch (error) {
      return jsonResponse(
        { error: "Worker request failed", details: String(error?.message || error) },
        500
      );
    }
  },
};
