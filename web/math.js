/* Tiny offline LaTeX-to-HTML renderer: fractions, roots, powers, indices, Greek, common symbols. */
(function (G) {
  const SYM = { alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',varepsilon:'ε',zeta:'ζ',eta:'η',theta:'θ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',varphi:'φ',chi:'χ',psi:'ψ',omega:'ω',
    Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Omega:'Ω',
    cdot:'·',times:'×',div:'÷',pm:'±',mp:'∓',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',ne:'≠',approx:'≈',equiv:'≡',sim:'∼',propto:'∝',
    infty:'∞',partial:'∂',nabla:'∇',to:'→',rightarrow:'→',leftarrow:'←',Rightarrow:'⇒',Leftarrow:'⇐',leftrightarrow:'↔',Leftrightarrow:'⇔',implies:'⇒',iff:'⇔',
    in:'∈',notin:'∉',subset:'⊂',subseteq:'⊆',cup:'∪',cap:'∩',emptyset:'∅',forall:'∀',exists:'∃',neg:'¬',land:'∧',lor:'∨',
    ldots:'…',cdots:'⋯',dots:'…',degree:'°',circ:'∘',angle:'∠',perp:'⊥',parallel:'∥',therefore:'∴',because:'∵',
    sin:'sin',cos:'cos',tan:'tan',cot:'cot',sec:'sec',csc:'csc',log:'log',ln:'ln',lg:'lg',exp:'exp',lim:'lim',max:'max',min:'min',det:'det',gcd:'gcd',
    sum:'∑',prod:'∏',int:'∫',oint:'∮',quad:' ',qquad:'  ',',':' ',';':' ','!':'', ' ':' ','{':'{','}':'}','%':'%','&':'&','_':'_','#':'#' };
  const FN = new Set(['sin','cos','tan','cot','sec','csc','log','ln','lg','exp','lim','max','min','det','gcd']);
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function render(src) {
    let i = 0; const s = src;
    function group() { // read {...} or a single token, return html
      skipWs();
      if (s[i] === '{') { i++; const h = seq('}'); if (s[i] === '}') i++; return h; }
      return atom();
    }
    function skipWs() { while (i < s.length && /\s/.test(s[i])) i++; }
    function readCmd() { let j = i + 1, n = ''; if (/[a-zA-Z]/.test(s[j] || '')) { while (/[a-zA-Z]/.test(s[j] || '')) n += s[j++]; } else { n = s[j] || ''; j++; } i = j; return n; }
    function raw(open) { // raw text inside {..}
      skipWs(); let out = ''; if (s[i] !== '{') return s[i++] || ''; i++; let d = 1;
      while (i < s.length && d) { if (s[i] === '{') d++; else if (s[i] === '}') { d--; if (!d) break; } out += s[i++]; } i++; return out; }
    function atom() {
      const c = s[i++]; if (c === undefined) return '';
      if (c === '\\') { i--; return command(); }
      if (c === '{') { const h = seq('}'); if (s[i] === '}') i++; return h; }
      return esc(c);
    }
    function command() {
      const n = readCmd();
      switch (n) {
        case 'frac': case 'dfrac': case 'tfrac': { const a = group(), b = group(); return `<span class="mfrac"><span class="mnum">${a}</span><span class="mden">${b}</span></span>`; }
        case 'sqrt': { let idx = ''; skipWs(); if (s[i] === '[') { i++; let t = ''; while (i < s.length && s[i] !== ']') t += s[i++]; i++; idx = `<sup class="mroot">${render(t)}</sup>`; } const b = group(); return `<span class="msqrt">${idx}<span class="mrad">√</span><span class="mbar">${b}</span></span>`; }
        case 'text': case 'mathrm': case 'textbf': case 'mathbf': case 'operatorname': { const t = raw(); return `<span class="mtext">${esc(t)}</span>`; }
        case 'left': case 'right': case 'big': case 'Big': case 'bigg': { skipWs(); if (s[i] === '.') { i++; return ''; } return ''; }
        case 'overline': case 'bar': return `<span class="mover">${group()}</span>`;
        case 'vec': return `<span class="mvec">${group()}</span>`;
        case 'hat': return `<span class="mhat">${group()}</span>`;
        case 'binom': { const a = group(), b = group(); return `(<span class="mfrac nob"><span class="mnum">${a}</span><span class="mden">${b}</span></span>)`; }
        case '\\': return '<br>';
        case 'displaystyle': case 'textstyle': case 'limits': case 'nolimits': return '';
      }
      const v = SYM[n];
      if (v === undefined) return esc(n);
      if (FN.has(n)) return `<span class="mfn">${v}</span>`;
      if (n === 'sum' || n === 'prod' || n === 'int' || n === 'oint') return `<span class="mbig">${v}</span>`;
      return v;
    }
    function seq(end) {
      let out = '';
      while (i < s.length && s[i] !== end) {
        const c = s[i];
        if (c === '^' || c === '_') { i++; const g = group(); const tag = c === '^' ? 'sup' : 'sub';
          // combine adjacent sub+sup
          const nx = s[i]; if ((c === '_' && nx === '^') || (c === '^' && nx === '_')) { i++; const g2 = group();
            const sup = c === '^' ? g : g2, sub = c === '_' ? g : g2; out += `<span class="mss"><sup>${sup}</sup><sub>${sub}</sub></span>`; }
          else out += `<${tag}>${g}</${tag}>`; continue; }
        if (c === '&') { i++; out += '<span class="mgap"></span>'; continue; }
        if (c === '~') { i++; out += ' '; continue; }
        if (/\s/.test(c)) { i++; continue; }
        const a = atom();
        out += /^[a-zA-Z]$/.test(c) ? `<i>${a}</i>` : a;
      }
      return out;
    }
    try { return seq('\u0000'); } catch (e) { return esc(src); }
  }
  G.OrionMath = { render };
})(window);
