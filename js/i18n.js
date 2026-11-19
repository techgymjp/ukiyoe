'use strict';
/* 日本語・英語の切り替え。端末の言語が日本語なら日本語、それ以外は英語。
   タイトル画面の「English / 日本語」で切り替えられ、選んだ言語は保存する */
const I18N = (() => {
  const KEY = 'ukiyoe-shokunin-lang';
  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) { /* 保存できない環境 */ }
  if (lang !== 'ja' && lang !== 'en') lang = /^ja\b/i.test(navigator.language || 'ja') ? 'ja' : 'en';
  const en = lang === 'en';
  const t = (ja, eng) => (en ? eng : ja);

  // 作品名などの英語表記
  const A = { utamaro: 'Kitagawa Utamaro', hiroshige: 'Utagawa Hiroshige', hokusai: 'Katsushika Hokusai', harunobu: 'Suzuki Harunobu', sharaku: 'Tōshūsai Sharaku' };
  const S = { fuji: 'Thirty-six Views of Mount Fuji', tokaido: 'Fifty-three Stations of the Tōkaidō', edo: 'One Hundred Famous Views of Edo', ten: 'Ten Classes of Women’s Physiognomy', okubi: 'Large-head Actor Portraits', falls: 'A Tour of Waterfalls in Various Provinces' };
  const G = { bijin: 'Beauty print', land: 'Landscape', kabuki: 'Kabuki actor print' };
  const WORKS = {
    higasa: ['Woman with a Parasol', A.utamaro, S.ten, G.bijin],
    kanbara: ['Kanbara: Night Snow', A.hiroshige, S.tokaido, G.land],
    gaifu: ['Fine Wind, Clear Morning (Red Fuji)', A.hokusai, S.fuji, G.land],
    poppin: ['Young Woman Blowing a Poppin', A.utamaro, S.ten, G.bijin],
    kajikazawa: ['Kajikazawa in Kai Province', A.hokusai, S.fuji, G.land],
    shono: ['Shōno: Driving Rain', A.hiroshige, S.tokaido, G.land],
    harunobu: ['Two Young Women in the Wind', A.harunobu, '', G.bijin],
    fujimigahara: ['Fujimigahara in Owari Province', A.hokusai, S.fuji, G.land],
    yodogoro: ['Kawatsura Hōgen and Onisadobō', A.sharaku, '', G.kabuki],
    nihonbashi: ['Nihonbashi: Morning View', A.hiroshige, S.tokaido, G.land],
    amida: ['Amida Falls in the Far Reaches of the Kiso Road', A.hokusai, S.falls, G.land],
    torinomachi: ['Asakusa Ricefields and Torinomachi Festival', A.hiroshige, S.edo, G.land],
    ohashi: ['Sudden Shower over Shin-Ōhashi Bridge and Atake', A.hiroshige, S.edo, G.land],
    kanagawa: ['The Great Wave off Kanagawa', A.hokusai, S.fuji, G.land],
    oniji: ['Ōtani Oniji III as Yakko Edobei', A.sharaku, S.okubi, G.kabuki],
    sanka: ['Storm below the Summit', A.hokusai, S.fuji, G.land],
    sanbijin: ['Three Beauties of the Present Day', A.utamaro, '', G.bijin],
    susaki: ['Fukagawa Susaki and Jūmantsubo', A.hiroshige, S.edo, G.land],
    katsuragi: ['Nagoya Sanza and the Courtesan Katsuragi', A.sharaku, '', G.kabuki],
    ebizo: ['Ichikawa Ebizō as Takemura Sadanoshin', A.sharaku, S.okubi, G.kabuki],
  };
  /* 作品の表示用の文字（title / artist / series / genre / credit / yomi）。英語のときは英語表記 */
  function work(d, f) {
    const w = en && WORKS[d.id];
    if (!w) return d[f] || '';
    if (f === 'title') return w[0];
    if (f === 'artist') return w[1];
    if (f === 'series') return w[2];
    if (f === 'genre') return w[3];
    if (f === 'yomi') return d.title;   // 英語では読みの代わりに日本語の題名を添える
    if (f === 'credit') return `Original: ${w[1]}, “${w[0]}”. The Metropolitan Museum of Art (public domain / CC0)`;
    return d[f] || '';
  }

  // 画面の決まった文言（data-i18n の要素の中身を差し替える）
  const HOWTO = `
  <h1>How to Play</h1>
  <p class="lead">An ukiyo-e print is made by printing one color at a time from many carved woodblocks.<br>Study the model print, work out <b>the order of the blocks</b>, and print it yourself.</p>
  <ol class="howto-steps">
    <li><span>1</span><div><strong>Study the model</strong>The finished print is shown first. Look at how many blocks it is made of.</div></li>
    <li><span>2</span><div><strong>Choose a block</strong>The carved blocks are shown one at a time. Flip with ◀ ▶ or swipe, and tap “Print this block” to choose the next one.</div></li>
    <li><span>3</span><div><strong>Print it yourself</strong>Rub the paper evenly with the baren to transfer the block’s color.</div></li>
    <li><span>4</span><div><strong>Finished</strong>Print a block in the wrong order and it’s <b>game over</b>. Print every block correctly to move on to the next print.</div></li>
  </ol>
  <h2>Tips on the order</h2>
  <ul class="howto-tips">
    <li>First print the <b>key block (omohan)</b>. It carries the black outlines and guides where every color goes.</li>
    <li>Then print the <b>color blocks</b> <b>from light colors to dark colors</b>. Start with pale colors and large areas such as the sky or skin; dark colors and small details come later.</li>
    <li>Each block <b>prints over the colors before it</b>. Light blocks are carved wide, under the areas where darker colors will go. A light color printed over a dark one spoils the picture.</li>
    <li>Print every block to the end without a retry for a <b>PERFECT!</b> score.</li>
    <li>When you flip a block, a faint preview of its color appears on the paper. Compare it with the paper so far.</li>
    <li>Answer quickly for a <b>speed bonus</b> (up to +50). Correct streaks raise the <b>combo bonus</b>.</li>
  </ul>
  <h2>The prints</h2>
  <p>20 prints: landscapes by Katsushika Hokusai and Utagawa Hiroshige, beauties by Kitagawa Utamaro and Suzuki Harunobu, and kabuki actors by Tōshūsai Sharaku. They come in order, from few blocks to many. You can stop anytime and pick up again with “Continue”.</p>
  <p class="note">All prints are public-domain (CC0) works from The Metropolitan Museum of Art, separated into blocks by color.</p>`;
  const HTML = {
    lead: '<b>Ukiyo-e Printer</b><br>Study the model and work out <b>the order to print the blocks</b>.',
    start: 'Start', howto: 'How to Play', zukan: 'Collection', gallery: 'Gallery', sound: 'SFX', title: 'Title',
    foot: 'All prints are public-domain (CC0) works from The Metropolitan Museum of Art, separated into blocks by color.',
    privacy: 'Privacy Policy', adPrivacy: 'Ad settings', back: 'Back to Title',
    howtoBody: HOWTO, zukanNote: 'Every print you finish appears here.',
    pause: 'Paused', resume: 'Resume',
  };
  function apply() {
    document.documentElement.lang = lang;
    if (en) {
      document.querySelectorAll('[data-i18n]').forEach(e => { const h = HTML[e.dataset.i18n]; if (h != null) e.innerHTML = h; });
      document.querySelectorAll('[data-i18n-label]').forEach(e => { const h = HTML[e.dataset.i18nLabel]; if (h != null) { e.title = h; e.setAttribute('aria-label', h); } });
      document.title = document.body.classList.contains('howto-page') ? 'How to Play | Ukiyo-e Printer' : 'Ukiyo-e Printer';
    }
    document.querySelectorAll('.lang-toggle').forEach(a => {
      a.textContent = en ? '日本語' : 'English';
      a.onclick = e => { e.preventDefault(); setLang(en ? 'ja' : 'en'); };
    });
  }
  function setLang(l) {
    try { localStorage.setItem(KEY, l); } catch (e) { /* 保存できない環境 */ }
    location.reload();
  }
  apply();
  return { lang, en, t, work, setLang };
})();
