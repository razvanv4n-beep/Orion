/* Orion Brain: language detection, personality, style learning, task routing, web access, logo. No libraries. */
(function (G) {
  'use strict';
  const B = {};
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v) } catch (e) { return d } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } }
  };

  /* ---------------- language detection ---------------- */
  const NAMES = { en: 'English', ro: 'Romanian', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', ru: 'Russian', uk: 'Ukrainian', el: 'Greek', ar: 'Arabic', he: 'Hebrew', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', th: 'Thai' };
  const LOC = { en: 'en-US', ro: 'ro-RO', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', uk: 'uk-UA', el: 'el-GR', ar: 'ar-SA', he: 'he-IL', hi: 'hi-IN', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', th: 'th-TH' };
  B.NAMES = NAMES; B.LOC = LOC;
  const W = s => new Set(s.split(' '));
  const SW = {
    en: W('the and is are you what how can with this that for have please not was but from they your about which would there their will just does do it of to in me my'),
    ro: W('și este sunt ce cum pot cu acest această acesta pentru nu mai care vreau fă imi îmi poti poți rog despre cât cat unde când cand dar foarte bine bună buna salut mulțumesc multumesc spune să în din sau mă ești esti are avea trebuie cred vrei fii'),
    fr: W('le la les des est une un et que pour dans avec pas je tu vous nous mais comment ce qui sur plus suis être bonjour merci'),
    de: W('der die das und ist nicht ich du wir mit für ein eine wie was auch von zu den dem sie es aber bitte'),
    es: W('el la los las es una que por para con no yo tú cómo qué pero muy esto hola gracias favor como quiero puedes'),
    it: W('il lo gli è una che per con non io tu come cosa anche molto ciao grazie voglio puoi sono questo della'),
    pt: W('o os as é uma que para com não eu você como mas muito olá obrigado quero pode isso está'),
    nl: W('de het een en is niet ik je wij met voor hoe wat ook van dat zijn maar'),
    pl: W('jest nie to co jak się na że do czy ale proszę dzięki'),
    tr: W('bir ve bu için ne nasıl ben sen değil ama çok lütfen merhaba')
  };
  B.lang = t => {
    if (!t) return null;
    if (/[\u3040-\u30ff]/.test(t)) return 'ja'; if (/[\uac00-\ud7af]/.test(t)) return 'ko'; if (/[\u4e00-\u9fff]/.test(t)) return 'zh';
    if (/[\u0e00-\u0e7f]/.test(t)) return 'th'; if (/[\u0370-\u03ff]/.test(t)) return 'el'; if (/[\u0590-\u05ff]/.test(t)) return 'he';
    if (/[\u0600-\u06ff]/.test(t)) return 'ar'; if (/[\u0900-\u097f]/.test(t)) return 'hi';
    if (/[\u0400-\u04ff]/.test(t)) return /[іїєґ]/i.test(t) ? 'uk' : 'ru';
    const w = t.toLowerCase().match(/\p{L}+/gu); if (!w || !w.length) return null;
    const sc = {}; for (const k in SW) { let s = 0; for (const x of w) if (SW[k].has(x)) s++; sc[k] = s }
    if (/[ăâîșțşţ]/i.test(t)) sc.ro += 2; if (/[äöüß]/i.test(t)) sc.de += 2; if (/[ñ¿¡]/.test(t)) sc.es += 2; if (/[ãõ]/i.test(t)) sc.pt += 2;
    if (/[ğı]/i.test(t)) sc.tr += 2; if (/[ąęłńśźż]/i.test(t)) sc.pl += 2; if (/[çœêèùà]/i.test(t)) sc.fr += 1;
    const e = Object.entries(sc).sort((a, b) => b[1] - a[1]);
    if (e[0][1] >= 2 || (e[0][1] >= 1 && w.length <= 3)) { if (e[0][1] > e[1][1]) return e[0][0] }
    return null;
  };

  /* ---------------- personality ---------------- */
  const STYLE = {
    balanced: 'Natural, helpful and clear.',
    friendly: 'Warm, upbeat and encouraging, like a kind friend; still accurate.',
    professional: 'Polished, precise and professional; no slang.',
    witty: 'Clever with light, dry humour; never at the cost of accuracy.',
    direct: 'Blunt and efficient: answer first, no filler, no pleasantries.',
    teacher: 'A patient teacher: explain step by step, use simple examples, check understanding.',
    coach: 'A motivating coach: practical, action-oriented, encouraging.',
    nerd: 'An enthusiastic expert who enjoys depth, nuance and interesting facts.'
  };
  const FORMAL = { casual: 'Tone: casual and relaxed.', neutral: '', formal: 'Tone: formal and respectful.' };
  const EMO = { none: 'Never use emojis.', rare: 'Use emojis very rarely (at most one, only when it truly fits).', some: 'Use a few emojis where they add warmth.', lots: 'Use plenty of expressive emojis.' };
  const FMT = { minimal: 'Formatting: plain flowing paragraphs. No headers or bullet lists unless asked, no bold except where essential.', normal: 'Formatting: light; short paragraphs, lists only when they genuinely help, bold sparingly.', rich: 'Formatting: well structured markdown with headers, bullet lists, bold key terms and tables when useful.' };
  const LEN = { short: 'Length: very short (1-3 sentences) unless the user asks for more.', balanced: 'Length: concise but complete.', detailed: 'Length: thorough, detailed and well explained.' };
  B.head = (S, MEM, extra, o) => {
    o = o || {}; const P = S.p || {};
    let s = 'You are ' + S.name + ', a personal AI assistant. Today is ' + new Date().toDateString() + '.\n';
    s += 'PERSONALITY: ' + (STYLE[P.style] || STYLE.balanced) + ' ' + (FORMAL[P.formal] || '') + '\n';
    s += (EMO[P.emoji] || '') + ' ' + (FMT[P.format] || '') + ' ' + (LEN[P.length] || '') + '\n';
    if (P.challenge === 'on') s += 'If the user is wrong or a plan has a flaw, say so politely instead of just agreeing.\n';
    if (P.proactive === 'on') s += 'When useful, end with one short suggestion for a next step.\n';
    if (P.callme) s += 'Address the user as "' + P.callme + '".\n';
    if (P.custom) s += 'EXTRA PERSONALITY NOTES FROM THE USER: ' + P.custom + '\n';
    if (S.instr) s += 'USER INSTRUCTIONS (follow them): ' + S.instr + '\n';
    if (MEM && MEM.length) s += 'FACTS ABOUT THE USER (use only when relevant):\n- ' + MEM.map(f => f.text).join('\n- ') + '\n';
    if (S.learn === 'on') s += B.hint();
    const lg = P.lang && P.lang !== 'auto' ? P.lang : o.lang;
    if (lg && NAMES[lg]) s += (P.lang && P.lang !== 'auto' ? 'Always reply in ' : 'The user writes in ') + NAMES[lg] + (P.lang && P.lang !== 'auto' ? '.' : '; reply in ' + NAMES[lg] + ' unless they ask for another language. If they switch language, switch with them.') + '\n';
    if (o.task === 'code') s += 'CODING: be correct first. Give complete, runnable code in fenced blocks with a language tag, then a brief explanation, and mention edge cases or how to test. If the request is ambiguous, state your assumption.\n';
    if (o.img) s += 'PICTURE ANALYSIS: the user attached picture(s). ' + (S.vd === 'fast' ? 'Be quick: give the key points only. ' : 'Examine carefully before answering: ') +
      '(1) what kind of image it is (photo, screenshot, document, chart, diagram, handwriting, product, food, plant, art...); (2) every visible object, person (count, position, clothing, action) and setting; (3) transcribe ALL readable text exactly (OCR) in its original language; (4) read numbers, tables and chart values; code or error messages; (5) colours, style, condition and notable details; (6) then answer the user\'s actual question directly. Be specific and concrete. If something is unclear or not visible, say so instead of guessing. Never identify real people from their face. For a bare picture with no question, give a thorough, well-structured description.\n';
    if (o.canSearch) s += 'WEB TOOL: you can search the web. If a good answer needs up-to-date or specific real-world facts you are not sure about (news, prices, current events, recent versions, someone\'s current role, local info), reply with ONLY [[SEARCH: concise query]] and nothing else, and you will receive results. Otherwise answer directly.\n';
    return s + (extra || '');
  };

  /* ---------------- learning from the user ---------------- */
  const LKEY = 'orion_learn';
  const fresh = () => ({ n: 0, len: 0, emo: 0, low: 0, langs: {}, tasks: {}, words: {}, fb: { ls: 0, ll: 0, ds: 0, dl: 0 } });
  B.L = Object.assign(fresh(), LS.get(LKEY, {}));
  B.setL = l => { B.L = Object.assign(fresh(), l || {}); LS.set(LKEY, B.L) };
  B.resetL = () => { B.L = fresh(); LS.set(LKEY, B.L) };
  const STOP = new Set('about which would there their these those where while should could other after before because really please something anything everything thing things think maybe still again being doing going using write explain tell make give need want know like also just than then them they what when with from this that have will your pentru acesta aceasta foarte despre trebuie poate vreau făcut face'.split(' '));
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;
  B.learn = (t, task, lang) => {
    const L = B.L; L.n++;
    const w = t.match(/\p{L}[\p{L}'-]*/gu) || []; L.len += w.length;
    if (EMOJI.test(t)) L.emo++;
    if (/\p{L}/u.test(t) && t === t.toLowerCase()) L.low++;
    if (lang) L.langs[lang] = (L.langs[lang] || 0) + 1;
    L.tasks[task] = (L.tasks[task] || 0) + 1;
    for (const x of w) { const y = x.toLowerCase(); if (y.length >= 5 && !STOP.has(y)) L.words[y] = (L.words[y] || 0) + 1 }
    const k = Object.keys(L.words); if (k.length > 400) k.sort((a, b) => L.words[a] - L.words[b]).slice(0, 150).forEach(x => delete L.words[x]);
    LS.set(LKEY, L);
  };
  B.feedback = (len, v, old) => {
    const f = B.L.fb, k = len > 1100 ? 'l' : 's';
    const adj = (x, d) => { if (x === 1) f['l' + k] = Math.max(0, (f['l' + k] || 0) + d); if (x === -1) f['d' + k] = Math.max(0, (f['d' + k] || 0) + d) };
    adj(old, -1); adj(v, 1); LS.set(LKEY, B.L);
  };
  const top = (o, n, min) => Object.entries(o).filter(e => e[1] >= (min || 1)).sort((a, b) => b[1] - a[1]).slice(0, n);
  B.summary = () => {
    const L = B.L; if (L.n < 1) return ['Nothing learned yet. Chat a bit and I will adapt to you.'];
    const a = [], avg = L.len / L.n;
    a.push('Learned from ' + L.n + ' of your messages.');
    a.push('You write ' + (avg < 8 ? 'very short' : avg < 25 ? 'medium-length' : 'long, detailed') + ' messages (about ' + Math.round(avg) + ' words).');
    const lg = top(L.langs, 3); if (lg.length) a.push('Languages: ' + lg.map(e => (NAMES[e[0]] || e[0]) + ' ' + e[1]).join(', ') + '.');
    const tk = top(L.tasks, 3); if (tk.length) a.push('Most common requests: ' + tk.map(e => e[0]).join(', ') + '.');
    const tw = top(L.words, 6, 3); if (tw.length) a.push('Recurring interests: ' + tw.map(e => e[0]).join(', ') + '.');
    return a;
  };
  B.hint = () => {
    const L = B.L; if (L.n < 4) return '';
    const p = [], avg = L.len / L.n;
    p.push(avg < 8 ? 'writes very short messages' : avg < 25 ? 'writes medium-length messages' : 'writes long, detailed messages');
    if (L.emo / L.n > .3) p.push('often uses emojis'); if (L.low / L.n > .6) p.push('writes casually in lowercase');
    const lg = top(L.langs, 2, 2); if (lg.length > 1) p.push('switches between ' + lg.map(e => NAMES[e[0]] || e[0]).join(' and '));
    const tw = top(L.words, 5, 3); if (tw.length) p.push('is often interested in: ' + tw.map(e => e[0]).join(', '));
    const f = L.fb;
    if (f.dl >= 2 && f.dl > f.ll) p.push('dislikes very long answers'); if (f.ds >= 2 && f.ds > f.ls) p.push('dislikes overly short answers');
    if (f.ll >= 3 && f.ll > f.ls) p.push('likes detailed answers'); if (f.ls >= 3 && f.ls > f.ll) p.push('likes concise answers');
    return 'LEARNED ABOUT THE USER (adapt quietly, never mention this): ' + p.join('; ') + '.\n';
  };
  /* "make it shorter", "no emojis"... change the personality settings automatically */
  B.prefCmd = (t, P) => {
    t = (t || '').trim(); if (t.length > 60) return [];
    const x = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), out = [];
    const set = (k, v, l) => { if (P[k] !== v) { P[k] = v; out.push(l) } };
    if (/\b(no|stop|without|don'?t use|fara|nu mai folosi|nu folosi)\b.{0,14}\bemoji/.test(x)) set('emoji', 'none', 'no emojis');
    else if (/\b(more|use|add|mai multe|foloseste)\b.{0,14}\bemoji/.test(x)) set('emoji', 'lots', 'more emojis');
    if (/\b(shorter|more concise|too long|be brief|keep it short|short answers|mai scurt|prea lung|pe scurt)\b/.test(x)) set('length', 'short', 'shorter replies');
    else if (/\b(more detail|more detailed|elaborate|go deeper|in depth|mai detaliat|mai multe detalii)\b/.test(x)) set('length', 'detailed', 'detailed replies');
    if (/\b(no|stop|without|don'?t use|fara)\b.{0,14}\b(headers?|headings?|bullets?|bullet points)\b/.test(x)) set('format', 'minimal', 'plain formatting');
    return out;
  };
  /* tiny automatic memory: "I live in ...", "I work as ..." (English + Romanian) */
  const FP = [
    [/\bI(?:'m| am) from ([A-Z][\w\u00C0-\u024F' -]{2,28}?)(?:[.,!?]|$| and )/, 'The user is from $1.'],
    [/\bI live in ([A-Z][\w\u00C0-\u024F' -]{2,28}?)(?:[.,!?]|$| and )/, 'The user lives in $1.'],
    [/\bI work (?:as an? |as the )([\w\u00C0-\u024F' -]{3,36}?)(?:[.,!?]|$| and )/i, 'The user works as $1.'],
    [/\bI(?:'m| am) (?:a |an )?(student|teacher|developer|engineer|designer|nurse|doctor|gamer|programmer)\b/i, 'The user is a $1.'],
    [/\bI study ([\w\u00C0-\u024F' -]{3,36}?)(?:[.,!?]|$| and )/i, 'The user studies $1.'],
    [/\blocuiesc (?:în|in) ([A-ZĂÂÎȘȚ][\w\u00C0-\u024F' -]{2,28}?)(?:[.,!?]|$| și | si )/, 'The user lives in $1.'],
    [/\bsunt din ([A-ZĂÂÎȘȚ][\w\u00C0-\u024F' -]{2,28}?)(?:[.,!?]|$| și | si )/, 'The user is from $1.'],
    [/\blucrez ca ([\w\u00C0-\u024F' -]{3,36}?)(?:[.,!?]|$| și | si )/i, 'The user works as $1.']
  ];
  B.facts = (t, MEM) => {
    if (!t || t.length > 240 || /\?/.test(t) || MEM.length >= 40) return [];
    const out = [];
    for (const [re, tpl] of FP) { const m = t.match(re); if (m) { const f = tpl.replace('$1', m[1].trim()); if (!MEM.some(x => x.text.toLowerCase() === f.toLowerCase())) out.push(f) } }
    return out.slice(0, 2);
  };

  /* ---------------- task routing (free, no extra API call) ---------------- */
  const CODE = /```|\b(python|javascript|typescript|java|c\+\+|c#|golang|rust|php|sql|html|css|bash|powershell|regex|react|node\.?js|django|flask|git|docker|json|yaml|bug|debug|compile|compiler|algorithm|stack ?trace|traceback|exception|syntax|script|code|coding|cod|eroare|functia|scrie un program)\b|=>|\bdef \w+\(|\bconsole\.log\b|\bimport \w+/i;
  const TEXT = /\b(write|rewrite|draft|essay|email|e-mail|letter|translate|summari[sz]e|paraphrase|proofread|story|poem|article|blog|caption|scrie|traduce|rezuma|redacteaza|eseu|poveste)\b/i;
  B.task = (t, hasImg) => {
    if (hasImg) return 'vision';
    const x = (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (CODE.test(x)) return 'code';
    if (TEXT.test(x)) return 'text';
    return 'core';
  };

  /* ---------------- web access ---------------- */
  const tmo = ms => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
  B.relay = S => /integrate\.api\.nvidia\.com/.test(S.base) ? null : S.base.replace(/\/+$/, '').replace(/\/v1$/, '');
  B.search = async (q, S, lang) => {
    q = q.replace(/^(please\s+)?(search|google|look up|find|cauta|caută)( the web| online| for| pe net)?\s*(for|despre)?\s*[:,-]?\s*/i, '').slice(0, 200) || q;
    const rl = B.relay(S);
    if (S.tav) {
      try {
        const r = await fetch(rl ? rl + '/tavily/search' : 'https://api.tavily.com/search', { method: 'POST', signal: tmo(12000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: S.tav, query: q, max_results: 5, search_depth: 'basic' }) });
        if (r.ok) { const j = await r.json(); const a = (j.results || []).map(x => ({ title: x.title, url: x.url, text: (x.content || '').slice(0, 500) })); if (a.length) return { results: a, via: 'Tavily' } }
      } catch (e) { }
    }
    if (rl) {
      try {
        const r = await fetch(rl + '/ddg?q=' + encodeURIComponent(q), { signal: tmo(12000) });
        if (r.ok) { const j = await r.json(); if (j.results && j.results.length) return { results: j.results.map(x => ({ title: x.title, url: x.url, text: (x.text || '').slice(0, 500) })), via: 'DuckDuckGo' } }
      } catch (e) { }
    }
    try {
      const lg = /^[a-z]{2}$/.test(lang || '') ? lang : 'en';
      const u = 'https://' + lg + '.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrlimit=4&prop=extracts&exintro=1&explaintext=1&exlimit=4&exchars=600&format=json&origin=*';
      const j = await (await fetch(u, { signal: tmo(10000) })).json();
      const p = Object.values((j.query || {}).pages || {}).sort((a, b) => a.index - b.index);
      if (p.length) return { results: p.map(x => ({ title: x.title, url: 'https://' + lg + '.wikipedia.org/wiki/' + encodeURIComponent(x.title.replace(/ /g, '_')), text: (x.extract || '').slice(0, 500) })), via: 'Wikipedia' };
    } catch (e) { }
    return { results: [], via: '' };
  };
  B.read = async (url, S) => {
    const rl = B.relay(S);
    if (rl) { try { const r = await fetch(rl + '/read?url=' + encodeURIComponent(url), { signal: tmo(15000) }); if (r.ok) { const j = await r.json(); if (j.text) return { title: j.title || url, text: j.text.slice(0, 9000) } } } catch (e) { } }
    const r = await fetch('https://r.jina.ai/' + url, { signal: tmo(15000), headers: { Accept: 'text/plain' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return { title: url, text: (await r.text()).slice(0, 9000) };
  };

  /* ---------------- usage tally (so you can watch the free limits) ---------------- */
  B.use = (i, o) => {
    const d = new Date().toISOString().slice(0, 10); let u = LS.get('orion_usage', {});
    if (u.d !== d) u = { d, req: 0, i: 0, o: 0 };
    if (i) u.req++; u.i += i; u.o += o; LS.set('orion_usage', u);
  };
  B.usage = () => { const u = LS.get('orion_usage', {}); const d = new Date().toISOString().slice(0, 10); return u.d === d ? { req: u.req, tok: Math.round((u.i + u.o) / 4) } : { req: 0, tok: 0 } };

  /* ---------------- logo ---------------- */
  B.logoURL = (o, size) => new Promise(ok => {
    if (!o || o.kind === 'default') return ok(null);
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const r = o.shape === 'circle' ? size / 2 : o.shape === 'square' ? 0 : size * .225;
    x.beginPath(); x.moveTo(r, 0); x.arcTo(size, 0, size, size, r); x.arcTo(size, size, 0, size, r); x.arcTo(0, size, 0, 0, r); x.arcTo(0, 0, size, 0, r); x.closePath(); x.clip();
    const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, o.c1 || '#66A5FF'); g.addColorStop(1, o.c2 || '#2B4C9B'); x.fillStyle = g; x.fillRect(0, 0, size, size);
    if (o.kind === 'image') {
      if (!o.img) return ok(null);
      const im = new Image(); im.onload = () => { const s = Math.max(size / im.width, size / im.height); x.drawImage(im, (size - im.width * s) / 2, (size - im.height * s) / 2, im.width * s, im.height * s); ok(c.toDataURL('image/png')) }; im.onerror = () => ok(null); im.src = o.img; return;
    }
    const t = (o.text || 'O').slice(0, 2); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 ' + Math.round(size * (t.length > 1 ? .42 : .56)) + 'px -apple-system,Segoe UI,sans-serif'; x.fillText(t, size / 2, size / 2 + size * .03); ok(c.toDataURL('image/png'));
  });

  G.Brain = B;
})(window);
