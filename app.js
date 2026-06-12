(function () {
  const FEEDBACK_DELAY_MS = 650;
  const EXPLANATION_DELAY_MS = 2600;
  const STORAGE_KEYS = {
    profile: "jouhouQuizProfile",
    history: "jouhouQuizHistory",
    marked: "jouhouQuizMarked",
  };

  const state = {
    examQuestions: [],
    comprehensionQuestions: [],
    june09Questions: [],
    allQuestions: [],
    groups: new Map(),
    quiz: [],
    index: 0,
    answers: [],
    locked: false,
    advanceTimer: null,
    shuffleOptions: true,
    progressionMode: "auto",
    explanationMode: "result",
    currentOptions: [],
    activeTitle: "情報科学基礎",
    markedIds: new Set(),
    history: [],
    currentModeLabel: "理解度テスト",
  };

  const els = {
    startView: document.getElementById("startView"),
    quizView: document.getElementById("quizView"),
    resultView: document.getElementById("resultView"),
    startRandomButton: document.getElementById("startRandomButton"),
    startAllButton: document.getElementById("startAllButton"),
    startComprehensionButton: document.getElementById("startComprehensionButton"),
    startJune09Button: document.getElementById("startJune09Button"),
    startWeakButton: document.getElementById("startWeakButton"),
    startMarkedButton: document.getElementById("startMarkedButton"),
    openSettingsButton: document.getElementById("openSettingsButton"),
    closeSettingsButton: document.getElementById("closeSettingsButton"),
    settingsPanel: document.getElementById("settingsPanel"),
    openHistoryButton: document.getElementById("openHistoryButton"),
    closeHistoryButton: document.getElementById("closeHistoryButton"),
    historyPanel: document.getElementById("historyPanel"),
    shuffleInputs: [...document.querySelectorAll('input[name="shuffleOptions"]')],
    comprehensionSizeInputs: [...document.querySelectorAll('input[name="comprehensionSize"]')],
    progressionModeInputs: [...document.querySelectorAll('input[name="progressionMode"]')],
    explanationModeInputs: [...document.querySelectorAll('input[name="explanationMode"]')],
    playerNameInput: document.getElementById("playerNameInput"),
    weakCategorySelect: document.getElementById("weakCategorySelect"),
    historySummary: document.getElementById("historySummary"),
    localLeaderboard: document.getElementById("localLeaderboard"),
    remoteStatus: document.getElementById("remoteStatus"),
    homeButton: document.getElementById("homeButton"),
    retryButton: document.getElementById("retryButton"),
    retryWrongButton: document.getElementById("retryWrongButton"),
    retryMarkedButton: document.getElementById("retryMarkedButton"),
    manualNav: document.getElementById("manualNav"),
    prevQuestionButton: document.getElementById("prevQuestionButton"),
    nextQuestionButton: document.getElementById("nextQuestionButton"),
    startQuestionCount: document.getElementById("startQuestionCount"),
    startVariantCount: document.getElementById("startVariantCount"),
    startComprehensionCount: document.getElementById("startComprehensionCount"),
    startJune09Count: document.getElementById("startJune09Count"),
    progressText: document.getElementById("progressText"),
    scoreText: document.getElementById("scoreText"),
    progressBar: document.getElementById("progressBar"),
    quizTitle: document.getElementById("quizTitle"),
    questionNumber: document.getElementById("questionNumber"),
    variantBadge: document.getElementById("variantBadge"),
    sourceBadge: document.getElementById("sourceBadge"),
    questionText: document.getElementById("questionText"),
    optionList: document.getElementById("optionList"),
    resultMessage: document.getElementById("resultMessage"),
    inlineExplanation: document.getElementById("inlineExplanation"),
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

  function shuffled(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function selectedShuffleSetting() {
    return els.shuffleInputs.find((input) => input.checked)?.value !== "off";
  }

  function selectedComprehensionSize() {
    const value = els.comprehensionSizeInputs.find((input) => input.checked)?.value || "10";
    if (value === "all") return state.comprehensionQuestions.length;
    return Math.min(Number(value), state.comprehensionQuestions.length);
  }

  function selectedProgressionMode() {
    return els.progressionModeInputs.find((input) => input.checked)?.value || "auto";
  }

  function selectedExplanationMode() {
    return els.explanationModeInputs.find((input) => input.checked)?.value || "result";
  }

  function playerName() {
    const value = els.playerNameInput?.value.trim();
    return value || "guest";
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
    state.currentModeLabel = mode === "all" ? "全問版" : "ランダム版";
  }

  function buildLimitedRandomQuiz(questions, count) {
    clearAdvanceTimer();
    state.quiz = shuffled(questions)
      .slice(0, count)
      .sort((a, b) => a.number - b.number);
    state.index = 0;
    state.answers = [];
    state.locked = false;
    state.currentModeLabel = "理解度テスト";
  }

  function activateDataset(title, questions) {
    state.activeTitle = title;
    state.allQuestions = [...questions];
    regroup();
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

  function startQuiz(mode, dataset = "exam") {
    state.shuffleOptions = selectedShuffleSetting();
    state.progressionMode = selectedProgressionMode();
    state.explanationMode = selectedExplanationMode();
    saveProfile();
    if (dataset === "comprehension") {
      activateDataset("理解度テスト", state.comprehensionQuestions);
      buildLimitedRandomQuiz(state.comprehensionQuestions, selectedComprehensionSize());
      state.currentModeLabel = `理解度テスト ${state.quiz.length}問`;
      showOnly("quiz");
      renderQuestion();
      return;
    } else if (dataset === "june09") {
      activateDataset("6/9日テスト", state.june09Questions);
    } else {
      activateDataset("情報科学基礎", state.examQuestions);
    }
    buildQuiz(mode);
    showOnly("quiz");
    renderQuestion();
  }

  function startQuestionSet(title, questions, modeLabel) {
    if (!questions.length) return;

    clearAdvanceTimer();
    state.shuffleOptions = selectedShuffleSetting();
    state.progressionMode = selectedProgressionMode();
    state.explanationMode = selectedExplanationMode();
    saveProfile();
    activateDataset(title, questions);
    buildLimitedRandomQuiz(questions, Math.min(selectedComprehensionSize(), questions.length));
    state.currentModeLabel = modeLabel;
    showOnly("quiz");
    renderQuestion();
  }

  function startWeakCategoryQuiz() {
    const category = els.weakCategorySelect?.value;
    const questions = state.comprehensionQuestions.filter((item) => categoryFor(item) === category);
    startQuestionSet(`分野別: ${category}`, questions, `分野別 ${category}`);
  }

  function startMarkedQuiz() {
    const questions = state.comprehensionQuestions.filter((item) => state.markedIds.has(item.id));
    startQuestionSet("要復習", questions, "要復習");
  }

  function startWrongOnlyQuiz() {
    const wrongItems = state.answers
      .filter(Boolean)
      .filter((entry) => !entry.correct)
      .map((entry) => entry.item);

    if (!wrongItems.length) return;

    clearAdvanceTimer();
    state.shuffleOptions = selectedShuffleSetting();
    state.progressionMode = selectedProgressionMode();
    state.explanationMode = selectedExplanationMode();
    saveProfile();
    state.quiz = wrongItems;
    state.index = 0;
    state.answers = [];
    state.locked = false;
    state.currentOptions = [];
    showOnly("quiz");
    renderQuestion();
  }

  function returnHome() {
    clearAdvanceTimer();
    state.index = 0;
    state.answers = [];
    state.locked = false;
    state.quiz = [];
    state.currentOptions = [];
    els.optionList.innerHTML = "";
    els.resultMessage.textContent = "";
    hideInlineExplanation();
    renderManualNavigation();
    renderHomeMeta();
    closeFloatingPanels();
    showOnly("start");
  }

  function currentQuestion() {
    return state.quiz[state.index];
  }

  function currentAnswer() {
    return state.answers[state.index] || null;
  }

  function score() {
    return state.answers.filter((entry) => entry && entry.correct).length;
  }

  function renderQuestion() {
    const item = currentQuestion();
    if (!item) {
      showResults();
      return;
    }

    const variants = state.groups.get(item.number) || [];
    const progress = state.quiz.length ? ((state.index) / state.quiz.length) * 100 : 0;

    els.quizTitle.textContent = state.activeTitle;
    els.progressText.textContent = `${state.index + 1} / ${state.quiz.length}`;
    els.scoreText.textContent = `${score()}点`;
    els.progressBar.style.width = `${progress}%`;
    els.questionNumber.textContent = item.number;
    els.variantBadge.textContent = state.activeTitle === "理解度テスト"
      ? "理解度"
      : `候補 ${variants.length}`;
    els.sourceBadge.textContent = item.source || "画像";
    els.questionText.textContent = item.question;
    els.resultMessage.textContent = "";
    els.resultMessage.className = "result-message";
    hideInlineExplanation();
    els.optionList.innerHTML = "";
    const existingAnswer = currentAnswer();
    state.currentOptions = existingAnswer?.options || (
      state.shuffleOptions ? shuffled(item.options) : [...item.options]
    ).map((option, index) => ({
      ...option,
      originalLabel: option.label,
      displayLabel: String.fromCharCode(65 + index),
    }));

    state.currentOptions.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.dataset.label = option.originalLabel;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = option.displayLabel;

      const text = document.createElement("span");
      text.textContent = option.text;
      button.append(label, text);

      button.addEventListener("click", () => chooseAnswer(option.originalLabel, option.displayLabel));
      els.optionList.append(button);
    });

    state.locked = Boolean(existingAnswer);
    if (existingAnswer) applyAnswerState(existingAnswer);
    renderManualNavigation();
  }

  function chooseAnswer(label, displayLabel) {
    if (state.locked) return;

    const item = currentQuestion();
    if (!item) return;

    state.locked = true;
    const correct = label === item.answer;
    const answerDisplay = state.currentOptions.find((option) => option.originalLabel === item.answer)?.displayLabel || item.answer;
    const answerEntry = {
      item,
      selected: label,
      selectedDisplay: displayLabel,
      answerDisplay,
      correct,
      options: state.currentOptions,
    };
    state.answers[state.index] = answerEntry;

    applyAnswerState(answerEntry);
    renderManualNavigation();

    if (state.progressionMode === "manual") return;

    state.advanceTimer = window.setTimeout(() => {
      state.advanceTimer = null;
      state.index += 1;
      state.locked = false;
      if (state.index >= state.quiz.length) {
        showResults();
      } else {
        renderQuestion();
      }
    }, state.explanationMode === "instant" ? EXPLANATION_DELAY_MS : FEEDBACK_DELAY_MS);
  }

  function applyAnswerState(answerEntry) {
    const { item, selected, answerDisplay, correct } = answerEntry;
    [...els.optionList.querySelectorAll(".option")].forEach((button) => {
      button.disabled = true;
      if (button.dataset.label === item.answer) button.classList.add("correct");
      if (button.dataset.label === selected && !correct) button.classList.add("incorrect");
    });

    els.scoreText.textContent = `${score()}点`;
    els.resultMessage.textContent = correct ? "正解" : `不正解  正解は ${answerDisplay}`;
    els.resultMessage.className = correct ? "result-message good" : "result-message bad";
    renderInlineExplanation(answerEntry);
  }

  function renderInlineExplanation(answerEntry) {
    if (!els.inlineExplanation) return;
    if (state.explanationMode !== "instant") {
      hideInlineExplanation();
      return;
    }

    els.inlineExplanation.hidden = false;
    els.inlineExplanation.textContent = explanationFor(answerEntry.item);
  }

  function hideInlineExplanation() {
    if (!els.inlineExplanation) return;
    els.inlineExplanation.hidden = true;
    els.inlineExplanation.textContent = "";
  }

  function renderManualNavigation() {
    if (!els.manualNav) return;

    const isManual = state.progressionMode === "manual" && !els.quizView.hidden && state.quiz.length > 0;
    els.manualNav.hidden = !isManual;
    if (!isManual) return;

    const answered = Boolean(currentAnswer());
    els.prevQuestionButton.disabled = state.index === 0;
    els.nextQuestionButton.disabled = !answered;
    els.nextQuestionButton.textContent = state.index >= state.quiz.length - 1 ? "結果を見る" : "次へ";
  }

  function goToPreviousQuestion() {
    clearAdvanceTimer();
    if (state.index <= 0) return;
    state.index -= 1;
    renderQuestion();
  }

  function goToNextQuestion() {
    clearAdvanceTimer();
    if (!currentAnswer()) return;
    if (state.index >= state.quiz.length - 1) {
      showResults();
      return;
    }
    state.index += 1;
    renderQuestion();
  }

  function showResults() {
    const total = state.quiz.length;
    const correct = score();
    const rate = total ? Math.round((correct / total) * 100) : 0;

    els.progressBar.style.width = "100%";
    els.finalScore.textContent = `${correct} / ${total}`;
    els.finalMessage.textContent = `正答率 ${rate}%`;
    els.retryWrongButton.hidden = correct === total;
    els.retryMarkedButton.hidden = state.markedIds.size === 0;
    saveAttempt(correct, total, rate);
    renderReview();
    renderManualNavigation();
    showOnly("result");
  }

  function renderReview() {
    els.reviewList.innerHTML = "";
    [...state.answers]
      .filter(Boolean)
      .sort((a, b) => Number(a.correct) - Number(b.correct) || a.item.number - b.item.number)
      .forEach(({ item, selected, selectedDisplay, answerDisplay, correct }) => {
      const selectedOption = item.options.find((opt) => opt.label === selected);
      const answerOption = item.options.find((opt) => opt.label === item.answer);
      const marked = state.markedIds.has(item.id);

      const row = document.createElement("article");
      row.className = `review-item ${correct ? "is-correct" : "is-wrong"}`;
      row.innerHTML = `
        <div class="review-title">
          <strong>問題 ${escapeHtml(item.number)}</strong>
          <span>${correct ? "正解" : "不正解"}</span>
        </div>
        <p class="review-question">${escapeHtml(item.question)}</p>
        <p>あなたの回答: ${escapeHtml(selectedDisplay || selected)} ${escapeHtml(selectedOption?.text || "")}</p>
        <p>正解: ${escapeHtml(answerDisplay || item.answer)} ${escapeHtml(answerOption?.text || "")}</p>
        <p class="explanation">${escapeHtml(explanationFor(item))}</p>
        <button class="mark-button ${marked ? "is-marked" : ""}" type="button" data-id="${escapeHtml(item.id)}">${marked ? "要復習を解除" : "要復習に追加"}</button>
      `;
      els.reviewList.append(row);
    });

    els.reviewList.querySelectorAll(".mark-button").forEach((button) => {
      button.addEventListener("click", () => toggleMarked(button.dataset.id));
    });
  }

  function toggleMarked(id) {
    if (!id) return;
    if (state.markedIds.has(id)) {
      state.markedIds.delete(id);
    } else {
      state.markedIds.add(id);
    }
    saveMarkedIds();
    renderReview();
    renderHomeMeta();
  }

  function explanationFor(item) {
    if (item.explanation && !isGenericExplanation(item)) return item.explanation;
    const detailed = buildDetailedExplanation(item);
    if (detailed) return detailed;
    const answer = item.options.find((opt) => opt.label === item.answer);
    return answer
      ? `この問題では「${item.answer}. ${answer.text}」が最も適切です。`
      : `正解は ${item.answer} です。`;
  }

  function isGenericExplanation(item) {
    const explanation = String(item.explanation || "").trim();
    if (!explanation) return true;
    return /^正解は[A-Z]です。.+が最も適切です。$/.test(explanation)
      || explanation.length < 38;
  }

  function buildDetailedExplanation(item) {
    const answer = item.options.find((opt) => opt.label === item.answer);
    if (!answer) return "";

    const question = normalizeForHint(item.question);
    const answerText = answer.text;
    const note = conceptNoteFor(question, answerText);
    const distractors = item.options
      .filter((opt) => opt.label !== item.answer)
      .slice(0, 3)
      .map((opt) => `${opt.label}は「${opt.text}」なので、今回問われている内容とは少しずれます。`)
      .join(" ");

    return [
      `正解は${item.answer}です。`,
      `「${answerText}」が、問題文の条件に直接対応しています。`,
      note,
      distractors ? `他の選択肢を見ると、${distractors}` : "",
      "同じ種類の問題では、問題文のキーワードと選択肢の用語が何を指しているかを対応づけると判断しやすくなります。",
    ].filter(Boolean).join("\n");
  }

  function normalizeForHint(value) {
    return String(value || "").replace(/\s+/g, "");
  }

  function conceptNoteFor(question, answerText) {
    const text = `${question} ${answerText}`;
    const hints = [
      {
        test: /教師なし学習|クラスタリング|グループ分け/,
        note: "教師なし学習は、正解ラベルをあらかじめ与えず、データ同士の似ている度合いや構造を見つける考え方です。クラスタリングやグループ分けが代表例です。",
      },
      {
        test: /深層学習|特徴量/,
        note: "深層学習では、多層のニューラルネットワークがデータから特徴を段階的に学習します。人が特徴量を細かく設計しなくてもよい点が重要です。",
      },
      {
        test: /汎用型AI|生成AI|AI/,
        note: "AIの問題では、現在実用化されている特定用途のAIと、人間のように幅広い課題へ柔軟に対応する汎用型AIを区別するのがポイントです。",
      },
      {
        test: /データサイエンス|価値|分析結果/,
        note: "データサイエンスでは、単にデータを集めたり分析したりするだけでなく、意思決定や改善につながる価値を生み出すことが重要です。",
      },
      {
        test: /Webアンケート|調査データ|アンケート/,
        note: "調査データは目的を決めて人から集めるデータです。Webアンケートでは回答者がネット利用者などに偏りやすい点に注意します。",
      },
      {
        test: /構造化データ|非構造化データ|表形式/,
        note: "構造化データは表のように項目と値が整理されたデータです。画像・音声・自由記述文のように形が一定でないものは非構造化データに分類されます。",
      },
      {
        test: /ログデータ|アクセス記録|自動で収集/,
        note: "ログデータは、システムやサービスの利用・動作の記録として自動的に蓄積されるデータです。アクセス履歴や操作履歴が典型例です。",
      },
      {
        test: /判断支援|計画策定|原因究明|知識発見|仮説検証/,
        note: "データ活用の目的を問う問題では、何をしたいのかに注目します。判断支援は意思決定、原因究明は理由の分析、知識発見は隠れた規則性の発見です。",
      },
      {
        test: /相関|因果|比較対象/,
        note: "相関は2つの事柄が一緒に変化する関係、因果は一方がもう一方を引き起こす関係です。片方の集団だけを見ると比較対象がなく、結論を急ぎやすくなります。",
      },
      {
        test: /バスケット分析|購買パターン|組み合わせ/,
        note: "バスケット分析は、同時に選ばれやすい商品や科目などの組み合わせを見つける分析です。「一緒に買われる・選ばれる」が合図になります。",
      },
      {
        test: /層別|ピーク|ヒストグラム/,
        note: "層別は、性別・地域・条件などの層に分けてデータを見る方法です。ヒストグラムの山が複数あるときは、異なる集団が混ざっている可能性があります。",
      },
      {
        test: /回帰|予測/,
        note: "回帰分析は、数値の関係から将来の値や結果を予測するためによく使われます。予測的データ分析と結びつけて覚えると整理しやすいです。",
      },
      {
        test: /レコメンデーション|推薦/,
        note: "レコメンデーションは、閲覧履歴や購買履歴などをもとに、利用者に合いそうな商品・動画・情報を提示する仕組みです。",
      },
      {
        test: /サーベイランス|監視|警告/,
        note: "サーベイランスは、状態や行動を継続的に観測・監視して異常を見つける考え方です。不審な利用の検出などと関係します。",
      },
      {
        test: /CPU|コア|クロック|スレッド/,
        note: "CPU性能では、コア数・スレッド数・クロック周波数などが代表的な指標です。容量あたりの価格は記憶装置などで使われやすい観点です。",
      },
      {
        test: /主記憶|補助記憶|揮発|不揮発/,
        note: "主記憶装置は高速ですが電源を切ると内容が失われやすく、補助記憶装置は比較的低速でも長期保存に向きます。揮発性・不揮発性の区別が鍵です。",
      },
      {
        test: /標本化|量子化|符号化|デジタル化/,
        note: "デジタル化は、標本化で一定間隔に取り出し、量子化で段階値に丸め、符号化でビット列にする流れで整理できます。",
      },
      {
        test: /PNG|JPEG|可逆|非可逆|画像フォーマット/,
        note: "PNGは可逆圧縮、JPEGは非可逆圧縮が代表的です。画質を完全に戻せるか、写真向きかどうかで見分けると覚えやすいです。",
      },
      {
        test: /文字化け|文字コード|ASCII|Shift_JIS/,
        note: "文字化けは、保存時と読み込み時の文字コードの解釈が一致しないときに起こります。ASCIIだけの文字は多くの文字コードで共通に読めます。",
      },
      {
        test: /スイッチ|ルータ|DNS|IPアドレス|プライベートIP/,
        note: "ネットワーク機器は役割で区別します。スイッチはLAN内接続、ルータは異なるネットワーク間接続、DNSは名前とIPアドレスの対応づけです。",
      },
      {
        test: /公開鍵|秘密鍵|共通鍵|暗号/,
        note: "公開鍵暗号では、公開鍵は相手に渡してよく、秘密鍵は本人だけが管理します。共通鍵暗号では同じ鍵を使うため、その共通鍵自体を秘密にします。",
      },
      {
        test: /SMTP|POP3|IMAP|DHCP|メール/,
        note: "メール送信にはSMTP、受信や閲覧にはPOP3やIMAPが関係します。DHCPはIPアドレスを自動割り当てする仕組みなのでメール送受信そのものではありません。",
      },
      {
        test: /ELSI|倫理|法的|社会/,
        note: "ELSIはEthical, Legal and Social Issuesの略で、科学技術が社会にもたらす倫理的・法的・社会的課題をまとめて考える枠組みです。",
      },
      {
        test: /オプトイン|オプトアウト|GDPR|個人データ/,
        note: "オプトインは事前に同意すること、オプトアウトは利用拒否の意思を示すことです。個人データの扱いでは、本人の同意や権利保護が重要です。",
      },
      {
        test: /機密性|完全性|可用性|アクセス制御|二重化|デジタル署名/,
        note: "情報セキュリティの3要素は、機密性・完全性・可用性です。機密性はアクセス制御、完全性は改ざん検知、可用性は二重化などと対応します。",
      },
      {
        test: /ランサムウェア|マルウェア|パスワード|セキュリティ/,
        note: "セキュリティ対策では、攻撃手口の理解、ソフトウェア更新、設定確認、パスワードの使い回し防止が基本です。",
      },
      {
        test: /バイアス|公平性|透明性|説明可能性|人間中心/,
        note: "AIの社会利用では、データの偏りを減らす公平性、判断理由を説明できる説明可能性、仕組みを理解できる透明性が重要になります。",
      },
    ];

    return hints.find((hint) => hint.test.test(text))?.note
      || "この問題は、用語の定義そのものよりも、問題文の状況に最も合う概念を選ぶ力が問われています。";
  }

  function categoryFor(item) {
    const text = `${item.question} ${item.options.map((opt) => opt.text).join(" ")}`;
    const rules = [
      ["AI・データ活用", /AI|機械学習|深層学習|教師|生成AI|判断支援|知識発見|仮説検証|計画策定|原因究明/],
      ["データ分析", /相関|因果|回帰|予測|クラスタリング|バスケット|層別|ヒストグラム|オッズ|データ分析/],
      ["データの種類", /構造化|非構造化|ログデータ|調査データ|観測|アンケート|尺度|質的|量的/],
      ["ネットワーク", /DNS|IPアドレス|ルータ|スイッチ|SMTP|POP3|IMAP|DHCP|LAN|ネットワーク/],
      ["セキュリティ", /暗号|公開鍵|秘密鍵|共通鍵|マルウェア|ランサム|パスワード|機密性|完全性|可用性|アクセス制御|署名/],
      ["デジタル表現", /デジタル|標本化|量子化|符号化|PNG|JPEG|文字化け|文字コード|CPU|主記憶|補助記憶/],
      ["ELSI・倫理", /ELSI|倫理|GDPR|オプト|個人データ|バイアス|公平性|透明性|説明可能性|人間中心/],
    ];

    return rules.find(([, pattern]) => pattern.test(text))?.[0] || "その他";
  }

  function readJson(key, fallback) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Local storage may be unavailable in private or restricted browser modes.
    }
  }

  function loadProfile() {
    const profile = readJson(STORAGE_KEYS.profile, {});
    if (profile.name && els.playerNameInput) els.playerNameInput.value = profile.name;
  }

  function saveProfile() {
    writeJson(STORAGE_KEYS.profile, { name: playerName() });
  }

  function closeFloatingPanels() {
    if (els.settingsPanel) els.settingsPanel.hidden = true;
    if (els.historyPanel) els.historyPanel.hidden = true;
  }

  function openSettingsPanel() {
    if (!els.settingsPanel) return;
    if (els.historyPanel) els.historyPanel.hidden = true;
    els.settingsPanel.hidden = false;
  }

  function openHistoryPanel() {
    if (!els.historyPanel) return;
    if (els.settingsPanel) els.settingsPanel.hidden = true;
    renderLocalLeaderboard();
    els.historyPanel.hidden = false;
  }

  function loadMarkedIds() {
    state.markedIds = new Set(readJson(STORAGE_KEYS.marked, []));
  }

  function saveMarkedIds() {
    writeJson(STORAGE_KEYS.marked, [...state.markedIds]);
  }

  function loadHistory() {
    state.history = readJson(STORAGE_KEYS.history, []);
  }

  function saveAttempt(correct, total, rate) {
    const wrongItems = state.answers
      .filter(Boolean)
      .filter((entry) => !entry.correct)
      .map((entry) => ({
        id: entry.item.id,
        number: entry.item.number,
        category: categoryFor(entry.item),
      }));

    const record = {
      id: `attempt-${Date.now()}`,
      name: playerName(),
      mode: state.currentModeLabel,
      correct,
      total,
      rate,
      wrongItems,
      createdAt: new Date().toISOString(),
    };

    state.history = [record, ...state.history].slice(0, 80);
    writeJson(STORAGE_KEYS.history, state.history);
    renderHomeMeta();
    submitRemoteAttempt(record);
  }

  function renderHomeMeta() {
    renderCategoryOptions();
    renderLocalLeaderboard();
    renderRemoteStatus();
    if (els.startMarkedButton) {
      els.startMarkedButton.disabled = state.markedIds.size === 0;
      els.startMarkedButton.textContent = state.markedIds.size
        ? `要復習だけ解く (${state.markedIds.size})`
        : "要復習だけ解く";
    }
  }

  function renderCategoryOptions() {
    if (!els.weakCategorySelect) return;

    const categories = [...new Set(state.comprehensionQuestions.map(categoryFor))].sort();
    const weak = weakestCategory();
    els.weakCategorySelect.innerHTML = "";
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category === weak ? `${category}（苦手候補）` : category;
      els.weakCategorySelect.append(option);
    });
    if (weak) els.weakCategorySelect.value = weak;
    if (els.startWeakButton) els.startWeakButton.disabled = categories.length === 0;
  }

  function weakestCategory() {
    const counts = new Map();
    state.history.forEach((record) => {
      (record.wrongItems || []).forEach((item) => {
        counts.set(item.category, (counts.get(item.category) || 0) + 1);
      });
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function renderLocalLeaderboard() {
    if (!els.localLeaderboard || !els.historySummary) return;

    const attempts = [...state.history].sort((a, b) => (
      b.rate - a.rate
      || b.correct - a.correct
      || new Date(b.createdAt) - new Date(a.createdAt)
    ));
    const best = attempts[0];
    const recent = state.history[0];

    els.historySummary.textContent = best
      ? `最高 ${best.correct}/${best.total} (${best.rate}%)。直近は ${recent.correct}/${recent.total} (${recent.rate}%) です。`
      : "まだ記録がありません。";
    els.localLeaderboard.innerHTML = "";

    attempts.slice(0, 5).forEach((record, index) => {
      const row = document.createElement("li");
      row.innerHTML = `
        <span>${index + 1}. ${escapeHtml(record.name)} / ${escapeHtml(record.mode)}</span>
        <strong>${escapeHtml(record.correct)} / ${escapeHtml(record.total)} (${escapeHtml(record.rate)}%)</strong>
      `;
      els.localLeaderboard.append(row);
    });
  }

  function supabaseConfig() {
    const config = window.QUIZ_SUPABASE_CONFIG || {};
    const url = String(config.url || "").replace(/\/+$/, "");
    const anonKey = String(config.anonKey || "");
    const table = String(config.table || "quiz_attempts");
    return { url, anonKey, table };
  }

  function hasRemoteConfig() {
    const { url, anonKey } = supabaseConfig();
    return url.startsWith("https://") && anonKey.length > 20;
  }

  function renderRemoteStatus(message) {
    if (!els.remoteStatus) return;
    els.remoteStatus.textContent = message || (
      hasRemoteConfig()
        ? "オンライン保存が有効です。成績はSupabaseにも記録されます。"
        : "オンライン保存は未設定です。"
    );
  }

  async function submitRemoteAttempt(record) {
    if (!hasRemoteConfig()) {
      renderRemoteStatus("ローカルに保存しました。オンライン保存は未設定です。");
      return;
    }

    const { url, anonKey, table } = supabaseConfig();
    const payload = {
      client_attempt_id: record.id,
      display_name: record.name,
      mode: record.mode,
      correct: record.correct,
      total: record.total,
      rate: record.rate,
      wrong_count: record.wrongItems.length,
      wrong_items: record.wrongItems,
      created_at: record.createdAt,
    };

    try {
      const response = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Supabase request failed: ${response.status}`);
      }

      renderRemoteStatus("オンラインにも保存しました。");
    } catch (error) {
      console.warn("Supabase save failed", error);
      renderRemoteStatus("オンライン保存に失敗しました。ローカルには保存済みです。");
    }
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
    state.examQuestions = normalizeData(window.DEFAULT_QUESTION_DATA || { questions: [] });
    state.comprehensionQuestions = normalizeData(window.COMPREHENSION_QUESTION_DATA || { questions: [] });
    state.june09Questions = normalizeData(window.JUNE09_QUESTION_DATA || { questions: [] });
    activateDataset("情報科学基礎", state.examQuestions);
    regroup();
    els.startQuestionCount.textContent = `${state.groups.size}問`;
    els.startVariantCount.textContent = `${state.examQuestions.length}問`;
    els.startComprehensionCount.textContent = `${state.comprehensionQuestions.length}問`;
    els.startJune09Count.textContent = `${state.june09Questions.length}問`;
    loadProfile();
    loadMarkedIds();
    loadHistory();
    renderHomeMeta();

    els.startRandomButton.addEventListener("click", () => startQuiz("random"));
    els.startAllButton.addEventListener("click", () => startQuiz("all"));
    els.startComprehensionButton.addEventListener("click", () => startQuiz("all", "comprehension"));
    els.startJune09Button.addEventListener("click", () => startQuiz("all", "june09"));
    els.startWeakButton.addEventListener("click", startWeakCategoryQuiz);
    els.startMarkedButton.addEventListener("click", startMarkedQuiz);
    els.openSettingsButton.addEventListener("click", openSettingsPanel);
    els.closeSettingsButton.addEventListener("click", closeFloatingPanels);
    els.openHistoryButton.addEventListener("click", openHistoryPanel);
    els.closeHistoryButton.addEventListener("click", closeFloatingPanels);
    els.playerNameInput.addEventListener("change", saveProfile);
    els.homeButton.addEventListener("click", returnHome);
    els.prevQuestionButton.addEventListener("click", goToPreviousQuestion);
    els.nextQuestionButton.addEventListener("click", goToNextQuestion);
    els.retryWrongButton.addEventListener("click", startWrongOnlyQuiz);
    els.retryMarkedButton.addEventListener("click", startMarkedQuiz);
    els.retryButton.addEventListener("click", () => {
      returnHome();
    });

    showOnly("start");
  }

  init();
})();
