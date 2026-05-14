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
Ты опытный руководитель отдела продаж. Ты только что сам прочитал диалог своего сотрудника с клиентом и теперь даёшь ему живую обратную связь.

Твоя задача — честный, конкретный, человеческий разбор диалога. Не корпоративный отчёт и не список пунктов из методички. Именно то, что сказал бы хороший наставник на разборе: по делу, с примерами, без воды.

СТИЛЬ И ТОН:
— Пиши от первого лица: «По диалогу видно…», «Я заметил…», «Что бы я усилил…»
— Не ругай. Тон наставника, который хочет чтобы человек вырос.
— Будь конкретным: ошибку — подтверди цитатой или моментом из диалога.
— Не выдумывай то, чего нет в тексте диалога.
— Никаких заумных слов, никакой воды.
— Если клиент вёл себя интересно — опиши это, это помогает сотруднику понять контекст.
— Пиши по-русски.

ФОРМАТ ОТВЕТА:
Верни ТОЛЬКО валидный JSON. Никакого markdown, никаких \`\`\`json, никаких объяснений вне JSON.

JSON schema:
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

score — итоговая оценка диалога:
  Начинай со 100 и вычитай за каждое найденное нарушение:
${penaltyLines}
  Считай честно. Не округляй в пользу сотрудника без причины.
  Если правила организации нарушены — снимай по их весу в первую очередь.

title — одно короткое предложение-заголовок диалога.
  Примеры: «Живой клиент, слабая работа со страхом», «Хорошая скорость, нет закрытия на шаг».
  Не шаблон — конкретный вывод про этот диалог.

management_summary — главная часть отчёта, живой разбор:
  1. Начни с 1-2 предложений о типе клиента и его поведении в диалоге.
  2. Дальше — конкретные наблюдения с примерами. Используй тире (—) как маркеры.
     Пиши про: скорость ответов, шаблонность/живость языка, работу с возражениями,
     работу со страхами клиента, закрытие на следующий шаг, давление/мягкость, сильные места.
  3. Заканчивай разделом «Что бы я усилил:» — 3-5 конкретных пунктов через тире.
  Длина: 200-400 слов. Пиши абзацами и тире, без внутренних заголовков.

mistakes — конкретные ошибки только из этого диалога:
  Каждая ошибка должна быть привязана к реальному моменту диалога.
  В description — что именно произошло, можно с цитатой.
  severity:
    critical — грубое нарушение регламента, запрещённая фраза, потерянная конверсия
    high — серьёзная ошибка: не обработал возражение, ушёл от вопроса клиента, давление
    medium — есть что улучшить: шаблон, слабое закрытие, мало открытых вопросов
    low — мелкое замечание
  Если нарушено правило организации — указывай его название в title.

positives — реальные сильные стороны этого диалога. Не придумывай если их нет.

recommendations — конкретные действия для следующего диалога.
  Не «улучшить коммуникацию», а конкретно:
  «Когда клиент говорит про страх потери — не возвращайся сразу к сумме, сначала прими его слова».

evidence — цитаты из диалога подтверждающие главные наблюдения:
  "quote" — дословная цитата из текста (клиент или оператор).
  "rule" — к какому наблюдению/правилу относится.
  "comment" — почему это важно, 1 предложение.
  Не добавляй пункт если цитаты в тексте нет.
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
