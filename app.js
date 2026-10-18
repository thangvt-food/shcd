(() => {
  "use strict";

  const DATA = window.SHCD_DATA;
  const view = document.getElementById("view");
  if (!DATA || !Array.isArray(DATA.subjects)) {
    view.innerHTML =
      '<div class="empty"><h2>Không tải được dữ liệu</h2><p>Kiểm tra tệp data.js và tải lại trang.</p></div>';
    return;
  }

  const subjects = DATA.subjects;
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const subjectOrder = new Map(subjects.map((subject, index) => [subject.id, index]));
  const fallbackSubject = subjects[0];
  const COHORT_KEY = "shcd_cohort";
  const COHORTS = ["K25", "K22–K24"];
  const ASSET_VERSION = "20261018f";
  let storedCohort = null;
  try {
    storedCohort = window.localStorage.getItem(COHORT_KEY);
  } catch (error) {
    storedCohort = null;
  }
  const firstRun = !COHORTS.includes(storedCohort);

  const els = {
    view,
    nav: document.getElementById("subject-nav"),
    search: document.getElementById("search-input"),
    searchBox: document.querySelector(".search"),
    clear: document.getElementById("search-clear"),
    topbarTitle: document.getElementById("topbar-title"),
    total: document.getElementById("total-count"),
    subjectCount: document.getElementById("subject-count"),
    cohortSwitch: document.getElementById("cohort-switch"),
    cohortCurrent: document.getElementById("cohort-current"),
    cohortModal: document.getElementById("cohort-modal"),
    cohortBackdrop: document.getElementById("cohort-backdrop"),
    cohortClose: document.getElementById("cohort-close"),
    cohortOptions: document.querySelectorAll(".cohort-option"),
    status: document.getElementById("search-status"),
    backToTop: document.getElementById("back-to-top"),
    feedbackModal: document.getElementById("feedback-modal"),
    feedbackBackdrop: document.getElementById("feedback-backdrop"),
    feedbackClose: document.getElementById("feedback-close"),
    feedbackLater: document.getElementById("feedback-later"),
    feedbackLink: document.getElementById("feedback-link"),
  };

  const state = {
    cohort: COHORTS.includes(storedCohort) ? storedCohort : "K25",
    filter: "all",
    lastSubject: fallbackSubject.id,
    query: "",
    currentView: null,
  };

  const ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ENTITIES[char]);
  }

  function foldWithMap(text) {
    let folded = "";
    const map = [];
    let index = 0;
    for (const char of String(text)) {
      const start = index;
      index += char.length;
      const base = char
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
      for (const piece of base) {
        folded += piece;
        map.push([start, index]);
      }
    }
    return { folded, map };
  }

  function fold(text) {
    return foldWithMap(text).folded;
  }

  function normalize(text) {
    return fold(text).replace(/\s+/g, " ").trim();
  }

  const ALIASES = {
    quyche: "qc quy che dao tao tin chi",
    nghiquyet: "nq nq71 nq 71 nghi quyet 71",
    tthcm: "tthcm hcm tu tuong ho chi minh",
    kiemtra: "kt de kiem tra k22 k24",
    exam25: "kt test k25 de test k25 de kiem tra k25",
  };

  const entries = [];
  for (const subject of subjects) {
    const subjectAlias = ALIASES[subject.id] || "";
    for (const question of subject.questions) {
      const optionText = question.options.map((option) => option.text).join(" ");
      const questionAliases = `c${question.id} q${question.id} cau${question.id}`;
      const fields = {
        question: fold(question.question),
        answer: fold(question.answerText),
        options: fold(optionText),
        explanation: fold(question.explanation),
        meta: fold(
          `${subject.name} ${subject.title} ${subjectAlias} ${questionAliases} câu ${question.id} đáp án ${question.answerLabel}`
        ),
      };
      entries.push({
        subject,
        question,
        fields,
        haystack: Object.values(fields).join(" "),
      });
    }
  }

  function highlight(text, tokens) {
    const source = String(text ?? "");
    const { folded, map } = foldWithMap(source);
    const ranges = [];
    for (const token of tokens) {
      if (!token) continue;
      let from = 0;
      let index;
      while ((index = folded.indexOf(token, from)) !== -1) {
        const start = map[index]?.[0];
        const end = map[index + token.length - 1]?.[1];
        if (start !== undefined && end !== undefined) {
          ranges.push([start, end]);
        }
        from = index + token.length;
      }
    }
    if (!ranges.length) {
      return escapeHtml(source);
    }
    ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const merged = [];
    for (const range of ranges) {
      const last = merged[merged.length - 1];
      if (last && range[0] <= last[1]) {
        last[1] = Math.max(last[1], range[1]);
      } else {
        merged.push([...range]);
      }
    }
    let html = "";
    let cursor = 0;
    for (const [start, end] of merged) {
      html += escapeHtml(source.slice(cursor, start));
      html += `<mark>${escapeHtml(source.slice(start, end))}</mark>`;
      cursor = end;
    }
    html += escapeHtml(source.slice(cursor));
    return html;
  }

  function snippet(text, tokens, maxLength = 220) {
    const source = String(text ?? "");
    if (source.length <= maxLength) {
      return source;
    }
    const { folded, map } = foldWithMap(source);
    let foldedIndex = -1;
    for (const token of tokens) {
      const found = folded.indexOf(token);
      if (found !== -1 && (foldedIndex === -1 || found < foldedIndex)) {
        foldedIndex = found;
      }
    }
    if (foldedIndex === -1) {
      return `${source.slice(0, maxLength).trimEnd()}…`;
    }
    const sourceIndex = map[foldedIndex]?.[0] ?? 0;
    let start = Math.max(0, sourceIndex - 70);
    let end = Math.min(source.length, start + maxLength);
    if (end === source.length) {
      start = Math.max(0, end - maxLength);
    }
    return `${start > 0 ? "…" : ""}${source.slice(start, end).trim()}${
      end < source.length ? "…" : ""
    }`;
  }

  function search(rawQuery) {
    const query = normalize(rawQuery);
    if (!query) {
      return { query, tokens: [], results: [], mode: null };
    }
    const tokens = query.split(" ").filter(Boolean);
    const pool = entries.filter((entry) => cohortMatches(entry.subject));

    const numberMatch = query.match(/^(?:cau\s*|c\s*|q\s*)?(\d{1,3})$/);
    if (numberMatch) {
      const number = Number(numberMatch[1]);
      const exact = pool.filter((entry) => entry.question.id === number);
      if (exact.length) {
        return {
          query,
          tokens,
          results: exact.map((entry) => ({ entry, score: 1000 })),
          mode: "number",
        };
      }
    }

    const answerMatch = query.match(/^(?:dap\s*an|da)\s*[:=]?\s*(.+)$/);
    if (answerMatch) {
      const target = answerMatch[1].trim();
      const answerKey =
        target === "dung" || target === "d"
          ? "true"
          : target === "sai" || target === "s"
          ? "false"
          : target;
      if (
        /^[a-d]$/.test(answerKey) ||
        answerKey === "true" ||
        answerKey === "false"
      ) {
        const matches = pool.filter(
          (entry) => entry.question.answerKey === answerKey
        );
        if (matches.length) {
          return {
            query,
            tokens,
            results: matches.map((entry) => ({ entry, score: 800 })),
            mode: "answer",
          };
        }
      }
    }

    const results = [];
    for (const entry of pool) {
      let score = 0;
      let matchesAll = true;
      for (const token of tokens) {
        const index = entry.haystack.indexOf(token);
        if (index === -1) {
          matchesAll = false;
          break;
        }
        score += 12;
        if (index === 0) score += 8;
      }
      if (!matchesAll) continue;
      if (entry.fields.question.includes(query)) score += 80;
      if (entry.fields.question.startsWith(query)) score += 50;
      if (entry.fields.answer.includes(query)) score += 36;
      if (entry.fields.options.includes(query)) score += 18;
      if (entry.fields.explanation.includes(query)) score += 12;
      results.push({ entry, score });
    }
    results.sort(
      (a, b) =>
        b.score - a.score ||
        subjectOrder.get(a.entry.subject.id) -
          subjectOrder.get(b.entry.subject.id) ||
        a.entry.question.id - b.entry.question.id
    );
    return { query, tokens, results, mode: "text" };
  }

  function setTopbar(title) {
    els.topbarTitle.textContent = title || "Ôn tập SHCD";
  }

  function setActiveNav(subjectId) {
    els.nav.querySelectorAll(".nav-link").forEach((link) => {
      const active = link.dataset.subject === subjectId;
      link.classList.toggle("is-active", active);
      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function setSearchChrome(hasValue) {
    els.searchBox.classList.toggle("has-value", hasValue);
    els.clear.hidden = !hasValue;
  }

  function cohortMatches(subject, cohort = state.cohort) {
    if (!subject) return false;
    const sc = subject.cohort || "Tất cả";
    return sc === "Tất cả" || sc === cohort;
  }

  function visibleSubjects(cohort = state.cohort) {
    return subjects.filter((subject) => cohortMatches(subject, cohort));
  }

  function displayCohort(cohort = state.cohort) {
    return cohort === "K22–K24" ? "K22–24" : cohort;
  }

  function pdfUrl(subject) {
    return `${subject.pdf}?v=${ASSET_VERSION}`;
  }

  function returnSubject() {
    const visible = visibleSubjects();
    return (
      visible.find((subject) => subject.id === state.lastSubject) ||
      visible[0] ||
      fallbackSubject
    );
  }

  function cohortLabel(subject, short = false) {
    const sc = subject?.cohort || "Tất cả";
    if (sc === "Tất cả") {
      return short ? "Tất cả" : "Tất cả các khóa";
    }
    return sc;
  }

  function renderNav() {
    const visible = visibleSubjects();
    const groups = [];
    for (const subject of visible) {
      const groupName = subject.group || "Ôn tập";
      let group = groups.find((item) => item.name === groupName);
      if (!group) {
        group = { name: groupName, subjects: [] };
        groups.push(group);
      }
      group.subjects.push(subject);
    }
    els.nav.innerHTML = groups
      .map(
        (group) => `<div class="nav-group">
          <p class="nav-label">${escapeHtml(group.name)}</p>
          ${group.subjects
            .map(
              (subject) =>
                `<a class="nav-link" data-subject="${escapeHtml(
                  subject.id
                )}" href="#/${escapeHtml(subject.id)}" title="${escapeHtml(
                  subject.title
                )}"><span class="nav-name">${escapeHtml(
                  subject.name
                )}</span><span class="nav-meta"><span class="nav-tag">${escapeHtml(
                  cohortLabel(subject, true)
                )}</span><span class="nav-count">${
                  subject.count
                }</span></span></a>`
            )
            .join("")}
        </div>`
      )
      .join("");
    els.total.textContent = visible.reduce(
      (sum, subject) => sum + subject.count,
      0
    );
    els.subjectCount.textContent = visible.length;
  }

  function renderQuestion(question) {
    const typeLabel =
      question.type === "true_false" ? "Đúng / Sai" : "Trắc nghiệm";
    const options = question.options
      .map(
        (option) =>
          `<li class="option${option.correct ? " is-correct" : ""}">` +
          `<span class="option-key">${escapeHtml(option.label)}</span>` +
          `<span class="option-text">${escapeHtml(option.text)}</span>` +
          (option.correct
            ? '<span class="option-tag">Đáp án</span>'
            : "") +
          "</li>"
      )
      .join("");
    return `<details class="question" id="q-${question.id}">
      <summary>
        <span class="q-number">Câu ${question.id}</span>
        <span class="q-text">${escapeHtml(question.question)}</span>
        <span class="q-answer" title="Đáp án: ${escapeHtml(
          question.answerLabel
        )}">${escapeHtml(question.keyLabel)}</span>
        <svg class="q-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg>
      </summary>
      <div class="question-body">
        <div class="question-body-top">
          <p class="question-kind">${typeLabel}</p>
          <button class="q-copy-btn" type="button" data-copy-id="${question.id}" aria-label="Sao chép câu hỏi và đáp án">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Sao chép</span>
          </button>
        </div>
        <ul class="options">${options}</ul>
        ${
          question.explanation
            ? `<div class="explanation"><span class="explanation-label">Giải thích</span><p>${escapeHtml(
                question.explanation
              )}</p></div>`
            : ""
        }
      </div>
    </details>`;
  }

  function openQuestion(questionId) {
    const details = document.getElementById(`q-${questionId}`);
    if (!details) return;
    details.open = true;

    // Highlight active key item
    document.querySelectorAll(".key-item").forEach((item) => {
      item.classList.remove("is-current");
    });
    const keyItem = document.querySelector(`.key-item[href*="/${questionId}"]`);
    if (keyItem) {
      keyItem.classList.add("is-current");
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    requestAnimationFrame(() => {
      details.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      details.classList.remove("is-flash");
      void details.offsetWidth;
      details.classList.add("is-flash");
      window.setTimeout(() => details.classList.remove("is-flash"), 1800);
    });
  }

  function renderSubject(subject, questionId = null) {
    state.lastSubject = subject.id;
    state.currentView = "subject";
    setActiveNav(subject.id);
    setTopbar(subject.name);
    document.title = `${subject.title} · SHCD`;

    const keyTiles = subject.questions
      .map(
        (question) =>
          `<a class="key-item" href="#/${escapeHtml(subject.id)}/${
            question.id
          }" aria-label="Câu ${question.id}, đáp án ${escapeHtml(
            question.answerLabel
          )}"><span class="key-num">${question.id}</span><span class="key-letter">${escapeHtml(
            question.keyLabel
          )}</span></a>`
      )
      .join("");

    const questions = subject.questions.map(renderQuestion).join("");

    els.view.innerHTML = `
      <section class="subject-hero">
        <p class="eyebrow">${escapeHtml(subject.eyebrow)} · ${
          subject.count
        } câu</p>
        <h1 class="hero-title">${escapeHtml(subject.title)}</h1>
        <p class="hero-lede">${escapeHtml(subject.description)}</p>
        <div class="hero-meta">
          <span>${subject.count} câu hỏi</span>
          <span class="cohort-tag">${escapeHtml(cohortLabel(subject))}</span>
          <span>Cập nhật 18.10.2026</span>
          <span>${
            subject.hasExplanations ? "Đáp án và giải thích" : "Đáp án"
          }</span>
        </div>
        <div class="hero-actions">
          <a class="button" href="${escapeHtml(pdfUrl(subject))}" download>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
            Tải PDF · ${escapeHtml(subject.pdfSize)}
          </a>
          <button class="button ghost" type="button" data-action="toggle-all" data-open="true">Mở tất cả đáp án</button>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">Bảng đáp án nhanh</h2>
          <p class="section-note">Bấm số câu để mở chi tiết · Đ/S = Đúng/Sai</p>
        </div>
        <div class="key-panel">
          <div class="key-legend"><span><strong>${subject.count}</strong> câu hỏi</span><span><strong>Đ</strong> Đúng</span><span><strong>S</strong> Sai</span></div>
          <div class="key-grid">${keyTiles}</div>
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <h2 class="section-title">Câu hỏi &amp; đáp án</h2>
          <p class="section-note">${subject.count} câu · bấm để mở</p>
        </div>
        <div class="question-list">${questions}</div>
      </section>`;

    els.status.textContent = `${subject.title}, ${subject.count} câu hỏi`;

    if (questionId) {
      openQuestion(questionId);
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function renderSearchResult(entry, tokens) {
    const { subject, question } = entry;
    const explanationMatches = tokens.some((token) =>
      entry.fields.explanation.includes(token)
    );
    const matchingOption = question.options.find(
      (option) =>
        !option.correct &&
        tokens.some((token) => fold(option.text).includes(token))
    );
    let detail = question.explanation;
    if (!explanationMatches && matchingOption) {
      detail = `Phương án ${matchingOption.label}: ${matchingOption.text}`;
    }
    if (!detail) {
      detail = question.answerText;
    }

    return `<a class="search-result" href="#/${escapeHtml(subject.id)}/${
      question.id
    }">
      <div class="result-meta">
        <span class="subject">${escapeHtml(subject.name)}</span>
        <span class="cohort">${escapeHtml(cohortLabel(subject))}</span>
        <span>Câu ${question.id}</span>
        <span>${
          question.type === "true_false" ? "Đúng / Sai" : "Trắc nghiệm"
        }</span>
      </div>
      <h2 class="result-title">${highlight(question.question, tokens)}</h2>
      <p class="result-answer">Đáp án ${escapeHtml(
        question.answerLabel
      )} — ${highlight(question.answerText, tokens)}</p>
      <p class="result-snippet">${highlight(
        snippet(detail, tokens),
        tokens
      )}</p>
    </a>`;
  }

  function renderSearch(rawQuery, keepFocus = false) {
    const query = rawQuery.trim();
    if (!query) {
      const subject = returnSubject();
      window.location.hash = `#/${subject.id}`;
      return;
    }
    if (state.currentView !== "search") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    state.currentView = "search";
    state.query = query;
    setActiveNav(state.filter === "all" ? null : state.filter);
    setTopbar("Tìm kiếm");
    document.title = `Tìm “${query}” · SHCD`;

    const result = search(query);
    const visible = visibleSubjects();
    const counts = new Map(visible.map((subject) => [subject.id, 0]));
    for (const item of result.results) {
      const id = item.entry.subject.id;
      if (counts.has(id)) {
        counts.set(id, counts.get(id) + 1);
      }
    }
    const filtered =
      state.filter === "all"
        ? result.results
        : result.results.filter(
            (item) => item.entry.subject.id === state.filter
          );

    const filters = [
      { id: "all", label: "Tất cả", count: result.results.length },
      ...visible.map((subject) => ({
        id: subject.id,
        label: subject.name,
        count: counts.get(subject.id),
      })),
    ]
      .map(
        (filter) =>
          `<button class="filter${
            state.filter === filter.id ? " is-active" : ""
          }" type="button" data-filter="${escapeHtml(filter.id)}">${escapeHtml(
            filter.label
          )} <span>${filter.count}</span></button>`
      )
      .join("");

    const items = filtered
      .map((item) => renderSearchResult(item.entry, result.tokens))
      .join("");

    const empty = `<div class="empty search-empty"><h2>Không tìm thấy kết quả</h2><p>Thử một từ khóa ngắn hơn, số câu (ví dụ <strong>27</strong>), hoặc cụm <strong>đáp án C</strong>.</p></div>`;

    els.view.innerHTML = `
      <section class="search-view">
        <p class="eyebrow">Tìm kiếm</p>
        <h1 class="hero-title">“${escapeHtml(query)}”</h1>
        <div class="hero-meta">
          <span>${filtered.length} kết quả</span>
          ${
            result.mode === "number"
              ? "<span>Tìm theo số câu</span>"
              : result.mode === "answer"
              ? "<span>Lọc theo đáp án</span>"
              : `<span>Trong toàn bộ ${visible.length} bộ đề</span>`
          }
        </div>
        <div class="filter-row" role="group" aria-label="Lọc theo bộ đề">${filters}</div>
        ${
          items
            ? `<div class="search-results">${items}</div>`
            : empty
        }
        ${
          result.mode === "text"
            ? '<div class="search-tips"><strong>Mẹo:</strong> gõ số câu để mở đúng câu hỏi, hoặc “đáp án C” để lọc theo đáp án.</div>'
            : ""
        }
      </section>`;

    els.status.textContent = `${filtered.length} kết quả cho ${query}`;
    setSearchChrome(true);
    if (keepFocus) {
      els.search.focus({ preventScroll: true });
    }
  }

  function renderDocs() {
    state.currentView = "docs";
    setActiveNav(null);
    setTopbar("Tài liệu");
    document.title = "Tài liệu gốc · SHCD";
    const visible = visibleSubjects();
    const cards = visible
      .map(
        (subject) => `<article class="doc-card">
          <p class="eyebrow">${escapeHtml(subject.eyebrow)} · ${escapeHtml(
          cohortLabel(subject)
        )}</p>
          <h2>${escapeHtml(subject.title)}</h2>
          <p>${escapeHtml(subject.description)}</p>
          <div class="doc-meta"><span>${subject.count} câu</span><span>PDF</span><span>${escapeHtml(
          subject.pdfSize
        )}</span></div>
          <a class="button" href="${escapeHtml(pdfUrl(subject))}" download>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
            Tải PDF
          </a>
        </article>`
      )
      .join("");
    els.view.innerHTML = `
      <section class="subject-hero">
        <p class="eyebrow">Tài liệu</p>
        <h1 class="hero-title">Bản PDF gốc</h1>
        <p class="hero-lede">${visible.length} bản đáp án được đồng bộ từ cùng một ngân hàng câu hỏi. Tải về để ôn offline hoặc in ra.</p>
      </section>
      <div class="doc-grid">${cards}</div>
      <div class="doc-note"><strong>Cập nhật 18.10.2026.</strong> Đã điều chỉnh đáp án Câu 27 (Quy chế đào tạo), bổ sung Tư tưởng Hồ Chí Minh và đề kiểm tra K22–K24 / K25.</div>`;
    els.status.textContent = "Tài liệu PDF";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function parseRoute() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    if (parts[0] === "tim-kiem") {
      return {
        view: "search",
        query: decodeURIComponent(parts.slice(1).join("/") || ""),
      };
    }
    if (parts[0] === "tai-lieu") {
      return { view: "docs" };
    }
    const subject = subjectById.get(parts[0]);
    const firstVisible = visibleSubjects()[0] || fallbackSubject;
    if (!subject || !cohortMatches(subject)) {
      return {
        view: "subject",
        subject: firstVisible,
        questionId: null,
        redirect: true,
      };
    }
    return {
      view: "subject",
      subject,
      questionId: parts[1] ? Number(parts[1]) : null,
    };
  }

  function handleRoute() {
    const route = parseRoute();
    if (route.redirect) {
      window.history.replaceState(null, "", `#/${route.subject.id}`);
    }
    if (route.view === "search") {
      els.search.value = route.query;
      renderSearch(route.query, false);
      return;
    }
    els.search.value = "";
    setSearchChrome(false);
    if (route.view === "docs") {
      renderDocs();
    } else {
      if (
        state.currentView === "subject" &&
        state.lastSubject === route.subject.id
      ) {
        if (route.questionId) {
          openQuestion(route.questionId);
        }
      } else {
        renderSubject(route.subject, route.questionId);
      }
    }
  }

  function updateCohortButton() {
    els.cohortCurrent.textContent = displayCohort();
    els.cohortSwitch.setAttribute(
      "aria-label",
      `Đổi khoá, hiện tại ${state.cohort}`
    );
    els.cohortSwitch.title = `Đổi khoá (${state.cohort})`;
  }

  function openCohortModal() {
    els.cohortOptions.forEach((option) => {
      const cohort = option.dataset.cohort;
      const list = visibleSubjects(cohort);
      const total = list.reduce((sum, subject) => sum + subject.count, 0);
      const subjectsLine = option.querySelector(".cohort-option-subjects");
      const meta = option.querySelector(".cohort-option-meta");
      if (subjectsLine) {
        subjectsLine.textContent = list
          .map((subject) => subject.name)
          .join(" · ");
      }
      if (meta) {
        meta.textContent = `${list.length} bộ đề · ${total} câu`;
      }
      const isCurrent = cohort === state.cohort;
      option.classList.toggle("is-current", isCurrent);
      option.setAttribute("aria-pressed", isCurrent ? "true" : "false");
    });
    els.cohortModal.hidden = false;
    document.body.classList.add("modal-open");
    const currentOption =
      els.cohortModal.querySelector(".cohort-option.is-current") ||
      els.cohortModal.querySelector(".cohort-option");
    if (currentOption) {
      currentOption.focus();
    }
  }

  function closeCohortModal() {
    if (els.cohortModal.hidden) return;
    els.cohortModal.hidden = true;
    document.body.classList.remove("modal-open");
    try {
      if (!window.localStorage.getItem(COHORT_KEY)) {
        window.localStorage.setItem(COHORT_KEY, state.cohort);
      }
    } catch (error) {
      /* ignore */
    }
    els.cohortSwitch.focus();
  }

  function selectCohort(cohort) {
    if (!COHORTS.includes(cohort)) return;
    state.cohort = cohort;
    state.filter = "all";
    try {
      window.localStorage.setItem(COHORT_KEY, cohort);
    } catch (error) {
      /* ignore */
    }
    const visible = visibleSubjects();
    if (!visible.some((subject) => subject.id === state.lastSubject)) {
      state.lastSubject = visible[0] ? visible[0].id : fallbackSubject.id;
    }
    updateCohortButton();
    closeCohortModal();
    renderNav();
    const route = parseRoute();
    if (route.redirect) {
      window.history.replaceState(null, "", `#/${route.subject.id}`);
    }
    handleRoute();
  }

  let inputTimer;

  els.search.addEventListener("input", () => {
    const value = els.search.value;
    setSearchChrome(value.trim().length > 0);
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(() => {
      const query = els.search.value.trim();
      if (!query) {
        const subject = returnSubject();
        window.history.replaceState(null, "", `#/${subject.id}`);
        renderSubject(subject);
        return;
      }
      state.filter = "all";
      window.history.replaceState(
        null,
        "",
        `#/tim-kiem/${encodeURIComponent(query)}`
      );
      renderSearch(query);
    }, 110);
  });

  els.clear.addEventListener("click", () => {
    els.search.value = "";
    setSearchChrome(false);
    const subject = returnSubject();
    window.history.replaceState(null, "", `#/${subject.id}`);
    renderSubject(subject);
    els.search.focus();
  });

  els.search.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (els.search.value) {
      event.preventDefault();
      els.clear.click();
    } else {
      els.search.blur();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (els.feedbackModal && !els.feedbackModal.hidden) {
        event.preventDefault();
        closeFeedbackModal(false);
        return;
      }
      if (!els.cohortModal.hidden) {
        event.preventDefault();
        closeCohortModal();
        return;
      }
    }
    if (!els.cohortModal.hidden || (els.feedbackModal && !els.feedbackModal.hidden)) return;
    const target = event.target;
    const editable =
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);
    const shortcut =
      (event.key === "/" && !editable) ||
      ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");
    if (!shortcut) return;
    event.preventDefault();
    els.search.focus();
    els.search.select();
  });

  els.view.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action='toggle-all']");
    if (action) {
      const shouldOpen = action.dataset.open === "true";
      els.view.querySelectorAll("details.question").forEach((details) => {
        details.open = shouldOpen;
      });
      action.dataset.open = shouldOpen ? "false" : "true";
      action.textContent = shouldOpen
        ? "Thu gọn tất cả"
        : "Mở tất cả đáp án";
      return;
    }

    const copyBtn = event.target.closest("[data-copy-id]");
    if (copyBtn) {
      const qId = Number(copyBtn.dataset.copyId);
      const subject = subjectById.get(state.lastSubject);
      const question = subject ? subject.questions.find((q) => q.id === qId) : null;
      if (question) {
        const typeStr = question.type === "true_false" ? "Đúng / Sai" : "Trắc nghiệm";
        const opts = question.options.map((o) => `${o.label}. ${o.text}`).join("\n");
        let textToCopy = `[SHCD - ${subject.name}] Câu ${question.id} (${typeStr}):\n${question.question}\n\n${opts}\n\n→ Đáp án đúng: ${question.answerLabel}. ${question.answerText}`;
        if (question.explanation) {
          textToCopy += `\n* Giải thích: ${question.explanation}`;
        }
        const span = copyBtn.querySelector("span");
        const origText = span ? span.textContent : "Sao chép";
        const doSuccess = () => {
          copyBtn.classList.add("is-copied");
          if (span) span.textContent = "Đã chép ✓";
          setTimeout(() => {
            copyBtn.classList.remove("is-copied");
            if (span) span.textContent = origText;
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToCopy).then(doSuccess).catch(() => {});
        } else {
          const ta = document.createElement("textarea");
          ta.value = textToCopy;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand("copy");
            doSuccess();
          } catch (e) {}
          document.body.removeChild(ta);
        }
      }
      return;
    }

    const filter = event.target.closest("[data-filter]");
    if (filter) {
      state.filter = filter.dataset.filter;
      renderSearch(state.query, false);
      return;
    }
  });

  if (els.backToTop) {
    window.addEventListener(
      "scroll",
      () => {
        const show = window.scrollY > 300;
        els.backToTop.hidden = !show;
      },
      { passive: true }
    );
    els.backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  els.cohortSwitch.addEventListener("click", openCohortModal);
  els.cohortBackdrop.addEventListener("click", closeCohortModal);
  els.cohortClose.addEventListener("click", closeCohortModal);
  els.cohortOptions.forEach((option) => {
    option.addEventListener("click", () => selectCohort(option.dataset.cohort));
  });
  els.cohortModal.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      els.cohortModal.querySelectorAll("button:not([disabled])")
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  const FEEDBACK_KEY = "shcd_fb_feedback_seen";
  const FEEDBACK_MIN_MS = 5 * 60 * 1000; // 5 phút
  const FEEDBACK_MAX_MS = 10 * 60 * 1000; // 10 phút

  function openFeedbackModal() {
    if (!els.feedbackModal) return;
    if (!els.cohortModal.hidden) {
      window.setTimeout(openFeedbackModal, 20000);
      return;
    }
    els.feedbackModal.hidden = false;
    document.body.classList.add("modal-open");
    const link = els.feedbackLink;
    if (link) {
      link.focus();
    }
  }

  function closeFeedbackModal(permanently = false) {
    if (!els.feedbackModal || els.feedbackModal.hidden) return;
    els.feedbackModal.hidden = true;
    if (els.cohortModal.hidden) {
      document.body.classList.remove("modal-open");
    }
    try {
      window.localStorage.setItem(
        FEEDBACK_KEY,
        permanently ? "clicked" : Date.now().toString()
      );
    } catch (e) {}
  }

  function initFeedbackTimer() {
    if (!els.feedbackModal) return;
    try {
      const status = window.localStorage.getItem(FEEDBACK_KEY);
      if (status === "clicked") return;
      if (status && !isNaN(Number(status))) {
        const lastSeen = Number(status);
        if (Date.now() - lastSeen < 24 * 60 * 60 * 1000) return;
      }
    } catch (e) {}

    const delay = Math.floor(
      FEEDBACK_MIN_MS + Math.random() * (FEEDBACK_MAX_MS - FEEDBACK_MIN_MS)
    );
    window.setTimeout(openFeedbackModal, delay);
  }

  if (els.feedbackClose) {
    els.feedbackClose.addEventListener("click", () => closeFeedbackModal(false));
  }
  if (els.feedbackBackdrop) {
    els.feedbackBackdrop.addEventListener("click", () => closeFeedbackModal(false));
  }
  if (els.feedbackLater) {
    els.feedbackLater.addEventListener("click", () => closeFeedbackModal(false));
  }
  if (els.feedbackLink) {
    els.feedbackLink.addEventListener("click", () => closeFeedbackModal(true));
  }

  window.addEventListener("hashchange", handleRoute);

  renderNav();
  if (!window.location.hash) {
    window.history.replaceState(null, "", `#/${returnSubject().id}`);
  }
  handleRoute();
  updateCohortButton();
  if (firstRun) {
    openCohortModal();
  }
  initFeedbackTimer();
})();
