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

    if (!dialogues.length) {
      return jsonResponse({ error: "No dialogues provided" }, 400);
    }

    // ── Dialogue text ────────────────────────────────────────────────────────
    const dialogueText = dialogues
      .map((item, i) => {
        const name = item.fileName || `dialogue_${i + 1}`;
        const text = String(item.rawText || "").slice(0, 18000);
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

    // ── System prompt ────────────────────────────────────────────────────────
    const systemPrompt = `
Ты — руководитель отдела продаж. Ты читаешь диалог своего сотрудника с клиентом и пишешь ему живую обратную связь — как будто разбираешь звонок вместе, один на один.

ГЕНДЕР СОТРУДНИКА:
Имя сотрудника передаётся в начале запроса. Определи пол по имени и используй правильные формы:
— Женское имя (Анна, Мария, Екатерина, Лена и т.д.) → «ты сделала», «ты пропустила», «ты хорошо справилась»
— Мужское имя → «ты сделал», «ты пропустил», «ты хорошо справился»
Используй правильный род последовательно по всему тексту.

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

ФОРМАТ ОТВЕТА:
Верни ТОЛЬКО валидный JSON. Никакого markdown, никаких \`\`\`json, никаких объяснений вне JSON.

{
  "score": number,
  "title": string,
  "management_summary": string,
  "mistakes": [
    { "title": string, "description": string, "severity": "low" | "medium" | "high" | "critical" }
  ],
  "positives": [
    { "title": string, "description": string }
  ],
  "recommendations": [
    { "title": string, "description": string }
  ],
  "evidence": [
    { "rule": string, "quote": string, "comment": string }
  ]
}

ТРЕБОВАНИЯ К КАЖДОМУ ПОЛЮ:

score — итоговая оценка:
  Начинай со 100, вычитай за каждое нарушение:
${penaltyLines}
  Считай честно. Не занижай и не завышай без причины.
  Правила организации — в приоритете.

title — одна фраза-заголовок про этот конкретный диалог.
  Примеры: «Живой клиент, ты его не дожал», «Хорошая скорость, но закрытия нет».
  Не шаблон — реальный вывод.

management_summary — главный текст разбора, пиши от себя, обращаясь к сотруднику на "ты":
  ОБЯЗАТЕЛЬНО разбей на три чётких абзаца, разделённых двойным переносом строки (\n\n):

  Абзац 1 — Клиент (1-2 предложения): кто клиент, как себя вёл, насколько был готов к покупке.

  Абзац 2 — Наблюдения (основной блок): конкретные наблюдения через тире (—). Каждый пункт с новой строки (\n). Пиши про: скорость и живость языка, работу с возражениями и страхами, закрытие на шаг, давление vs мягкость, сильные моменты.

  Абзац 3 — Что бы я усилил: начни с этой фразы, затем 3-5 конкретных пунктов через тире (—) с новой строки (\n). Каждый пункт — конкретное действие на "ты".

  Длина: 150-300 слов. Используй \n\n между абзацами и \n перед каждым тире внутри абзацев.

mistakes — только реальные ошибки из этого диалога, с привязкой к моменту.
  description — что именно произошло, можно с цитатой.
  severity:
    critical — грубое нарушение, запрещённая фраза с гарантией, потерянная конверсия
    high — не обработал возражение, ушёл от вопроса, давил неуместно
    medium — шаблон, слабое закрытие, мало живых вопросов
    low — мелкое замечание
  Нарушено правило организации — укажи его название в title.

positives — реальные сильные стороны. Не придумывай если их нет.

recommendations — конкретные действия на следующий диалог, на "ты".
  Не «улучши коммуникацию» — а: «Когда клиент говорит про страх — сначала прими, потом предложи шаг».

evidence — цитаты подтверждающие ключевые наблюдения:
  "quote" — дословно из текста.
  "rule" — к какому наблюдению относится.
  "comment" — почему важно, 1 предложение.
  Не добавляй если цитаты нет в тексте.
`.trim();

    // ── User prompt ──────────────────────────────────────────────────────────
    const userPrompt = `
Сотрудник: ${employeeName}

${contextParts.length ? contextParts.join("\n\n") + "\n\n" : ""}ДИАЛОГ ДЛЯ РАЗБОРА:
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
          model: "gpt-4.1-mini",
          input: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
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

      // Strip markdown fences if model wraps output in ```json ... ```
      const clean = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

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
