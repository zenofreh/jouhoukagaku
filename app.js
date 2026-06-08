(function () {
  const FEEDBACK_DELAY_MS = 650;

  const state = {
    allQuestions: [],
    groups: new Map(),
    quiz: [],
    index: 0,
    answers: [],
    locked: false,
    advanceTimer: null,
  };

  const els = {
    startView: document.getElementById("startView"),
    quizView: document.getElementById("quizView"),
    resultView: document.getElementById("resultView"),
    startRandomButton: document.getElementById("startRandomButton"),
    startAllButton: document.getElementById("startAllButton"),
    homeButton: document.getElementById("homeButton"),
    retryButton: document.getElementById("retryButton"),
    startQuestionCount: document.getElementById("startQuestionCount"),
    startVariantCount: document.getElementById("startVariantCount"),
    progressText: document.getElementById("progressText"),
    scoreText: document.getElementById("scoreText"),
    progressBar: document.getElementById("progressBar"),
    questionNumber: document.getElementById("questionNumber"),
    variantBadge: document.getElementById("variantBadge"),
    sourceBadge: document.getElementById("sourceBadge"),
    questionText: document.getElementById("questionText"),
    optionList: document.getElementById("optionList"),
    resultMessage: document.getElementById("resultMessage"),
    finalScore: document.getElementById("finalScore"),
    finalMessage: document.getElementById("finalMessage"),
    reviewList: document.getElementById("reviewList"),
  };

  function normalizeData(payload) {
    const source = Array.isArray(payload) ? payload : payload.questions;
    if (!Array.isArray(source)) return [];

    return source
      .map((item, idx) => ({
        id: item.id || `question-${idx}`,
        number: Number(item.number),
        variant: item.variant || null,
        source: item.source || "画像",
        question: String(item.question || "").trim(),
        options: Array.isArray(item.options)
          ? item.options.map((opt) => ({
              label: String(opt.label || "").trim().toUpperCase(),
              text: String(opt.text || "").trim(),
            }))
          : [],
        answer: String(item.answer || "").trim().toUpperCase(),
        explanation: String(item.explanation || "").trim(),
      }))
      .filter((item) => (
        Number.isFinite(item.number)
        && item.question
        && item.answer
        && item.options.length >= 2
      ));
  }

  function regroup() {
    state.groups = new Map();
    state.allQuestions.forEach((item) => {
      if (!state.groups.has(item.number)) state.groups.set(item.number, []);
      state.groups.get(item.number).push(item);
    });
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function buildQuiz(mode) {
    clearAdvanceTimer();
    state.quiz = mode === "all"
      ? [...state.allQuestions].sort((a, b) => (
          a.number - b.number
          || Number(a.variant || 0) - Number(b.variant || 0)
          || String(a.id).localeCompare(String(b.id))
        ))
      : [...state.groups.keys()]
          .sort((a, b) => a - b)
          .map((number) => randomItem(state.groups.get(number)));
    state.index = 0;
    state.answers = [];
    state.locked = false;
  }

  function clearAdvanceTimer() {
    if (!state.advanceTimer) return;
    window.clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
  }

  function showOnly(view) {
    els.startView.hidden = view !== "start";
    els.quizView.hidden = view !== "quiz";
    els.resultView.hidden = view !== "result";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function startQuiz(mode) {
    buildQuiz(mode);
    showOnly("quiz");
    renderQuestion();
  }

  function returnHome() {
    clearAdvanceTimer();
    state.index = 0;
    state.answers = [];
    state.locked = false;
    state.quiz = [];
    els.optionList.innerHTML = "";
    els.resultMessage.textContent = "";
    showOnly("start");
  }

  function currentQuestion() {
    return state.quiz[state.index];
  }

  function score() {
    return state.answers.filter((entry) => entry.correct).length;
  }

  function renderQuestion() {
    const item = currentQuestion();
    if (!item) {
      showResults();
      return;
    }

    const variants = state.groups.get(item.number) || [];
    const progress = state.quiz.length ? ((state.index) / state.quiz.length) * 100 : 0;

    els.progressText.textContent = `${state.index + 1} / ${state.quiz.length}`;
    els.scoreText.textContent = `${score()}点`;
    els.progressBar.style.width = `${progress}%`;
    els.questionNumber.textContent = item.number;
    els.variantBadge.textContent = `候補 ${variants.length}`;
    els.sourceBadge.textContent = item.source || "画像";
    els.questionText.textContent = item.question;
    els.resultMessage.textContent = "";
    els.resultMessage.className = "result-message";
    els.optionList.innerHTML = "";

    item.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.dataset.label = option.label;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = option.label;

      const text = document.createElement("span");
      text.textContent = option.text;
      button.append(label, text);

      button.addEventListener("click", () => chooseAnswer(option.label));
      els.optionList.append(button);
    });
  }

  function chooseAnswer(label) {
    if (state.locked) return;

    const item = currentQuestion();
    if (!item) return;

    state.locked = true;
    const correct = label === item.answer;
    state.answers.push({ item, selected: label, correct });

    [...els.optionList.querySelectorAll(".option")].forEach((button) => {
      button.disabled = true;
      if (button.dataset.label === item.answer) button.classList.add("correct");
      if (button.dataset.label === label && !correct) button.classList.add("incorrect");
    });

    els.scoreText.textContent = `${score()}点`;
    els.resultMessage.textContent = correct ? "正解" : `不正解  正解は ${item.answer}`;
    els.resultMessage.className = correct ? "result-message good" : "result-message bad";

    state.advanceTimer = window.setTimeout(() => {
      state.advanceTimer = null;
      state.index += 1;
      state.locked = false;
      if (state.index >= state.quiz.length) {
        showResults();
      } else {
        renderQuestion();
      }
    }, FEEDBACK_DELAY_MS);
  }

  function showResults() {
    const total = state.quiz.length;
    const correct = score();
    const rate = total ? Math.round((correct / total) * 100) : 0;

    els.progressBar.style.width = "100%";
    els.finalScore.textContent = `${correct} / ${total}`;
    els.finalMessage.textContent = `正答率 ${rate}%`;
    renderReview();
    showOnly("result");
  }

  function renderReview() {
    els.reviewList.innerHTML = "";
    [...state.answers]
      .sort((a, b) => Number(a.correct) - Number(b.correct) || a.item.number - b.item.number)
      .forEach(({ item, selected, correct }) => {
      const selectedOption = item.options.find((opt) => opt.label === selected);
      const answerOption = item.options.find((opt) => opt.label === item.answer);

      const row = document.createElement("article");
      row.className = `review-item ${correct ? "is-correct" : "is-wrong"}`;
      row.innerHTML = `
        <div class="review-title">
          <strong>問題 ${escapeHtml(item.number)}</strong>
          <span>${correct ? "正解" : "不正解"}</span>
        </div>
        <p class="review-question">${escapeHtml(item.question)}</p>
        <p>あなたの回答: ${escapeHtml(selected)} ${escapeHtml(selectedOption?.text || "")}</p>
        <p>正解: ${escapeHtml(item.answer)} ${escapeHtml(answerOption?.text || "")}</p>
        <p class="explanation">${escapeHtml(explanationFor(item))}</p>
      `;
      els.reviewList.append(row);
    });
  }

  function explanationFor(item) {
    if (item.explanation) return item.explanation;
    const answer = item.options.find((opt) => opt.label === item.answer);
    return answer
      ? `この問題では「${item.answer}. ${answer.text}」が最も適切です。`
      : `正解は ${item.answer} です。`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function init() {
    state.allQuestions = normalizeData(window.DEFAULT_QUESTION_DATA || { questions: [] });
    regroup();
    els.startQuestionCount.textContent = `${state.groups.size}問`;
    els.startVariantCount.textContent = `${state.allQuestions.length}問`;

    els.startRandomButton.addEventListener("click", () => startQuiz("random"));
    els.startAllButton.addEventListener("click", () => startQuiz("all"));
    els.homeButton.addEventListener("click", returnHome);
    els.retryButton.addEventListener("click", () => {
      returnHome();
    });

    showOnly("start");
  }

  init();
})();
