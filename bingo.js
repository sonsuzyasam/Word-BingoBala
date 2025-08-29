'use strict';

(function(){
  const cm = v => v * 28.3464567; // cm → pt

  // PDF fontları
  let FONT_TEXT = 'helvetica';
  let FONT_NUM  = 'helvetica';

  const ready = fn => (document.readyState==='loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn());
  ready(init);

  function init(){

    /* ===== Helpers ===== */
    const hexToRgb = (hex, fb=[255,122,0])=>{
      const m = String(hex||'').trim().match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      return m ? [parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)] : fb;
    };
    const transliterate = s => s
      .replace(/İ/g,'I').replace(/ı/g,'i')
      .replace(/Ş/g,'S').replace(/ş/g,'s')
      .replace(/Ğ/g,'G').replace(/ğ/g,'g')
      .replace(/Ç/g,'C').replace(/ç/g,'c')
      .replace(/Ö/g,'O').replace(/ö/g,'o')
      .replace(/Ü/g,'U').replace(/ü/g,'u');

    function fitTextToWidth(doc, text, maxW, maxChars=36, minSize=8, maxSize=12){
      let t = (text||'').trim();
      let size = maxSize;
      // Önce tek satırda sığdırmayı dene
      while(size >= minSize){
        doc.setFontSize(size);
        if (doc.getTextWidth(t) <= maxW) return {lines:[t], size};
        size -= 0.5;
      }
      // Tek satırda sığmıyorsa, kelimeyi iki satıra böl
      let best = {lines:[t], size:minSize};
      if (t.indexOf(' ') > 0) {
        let words = t.split(' ');
        let found = false;
        for (let i=1; i<words.length; i++) {
          let line1 = words.slice(0,i).join(' ');
          let line2 = words.slice(i).join(' ');
          doc.setFontSize(minSize);
          let w1 = doc.getTextWidth(line1), w2 = doc.getTextWidth(line2);
          if (w1 <= maxW && w2 <= maxW) {
            best = {lines:[line1,line2], size:minSize};
            found = true;
            break;
          }
        }
        // Hiçbir bölme noktası bulunamazsa, kelimeyi ortadan ikiye böl
        if (!found && words.length > 1) {
          let mid = Math.floor(words.length/2);
          let line1 = words.slice(0,mid).join(' ');
          let line2 = words.slice(mid).join(' ');
          best = {lines:[line1,line2], size:minSize};
        }
      }
      return best;
    }

    async function tryLoadUnicodeFont(doc){
      const candidates = ['fonts/NotoSans-Regular.ttf','fonts/DejaVuSans.ttf'];
      for(const url of candidates){
        try{
          const r = await fetch(url, {cache:'no-store'});
          if(!r.ok) continue;
          const buf = await r.arrayBuffer();
          const b64 = await new Promise(res=>{
            const fr = new FileReader();
            fr.onload = () => res(fr.result.split(',')[1]);
            fr.readAsDataURL(new Blob([buf]));
          });
          doc.addFileToVFS('Uni.ttf', b64);
          doc.addFont('Uni.ttf', 'Uni', 'normal');
          FONT_TEXT = 'Uni';
          FONT_NUM  = 'Uni';
          break;
        }catch(_){}
      }
      try{
        const r = await fetch('fonts/DejaVuSans-Bold.ttf', {cache:'no-store'});
        if(r.ok){
          const buf = await r.arrayBuffer();
          const b64 = await new Promise(res=>{
            const fr = new FileReader();
            fr.onload = () => res(fr.result.split(',')[1]);
            fr.readAsDataURL(new Blob([buf]));
          });
          doc.addFileToVFS('UniBold.ttf', b64);
          doc.addFont('UniBold.ttf', 'Uni', 'bold');
        }
      }catch(_){}
    }

    // Kelime dizisi
    const WORDS = [
      "arrive at school","arrive home","attend chess club","brush teeth","chat","clean","come back home","cook","do homework","do shopping","drink","drive","eat","feed","finish all homework","get dressed","get home","get out of the bed","get up","go online","go out","go shopping","go to bed","hang around","have a bath","have a busy weekend","have a rest","have a shower","have a snack","have breakfast","have dinner","have lunch","help parents","join","learn","leave home","leave school","live","make","meet friends","play game","play soccer","rest","ride bike","run errands","sleep","start","stay","study lesson","surf on the net","take folkdance course","take a nap","take a shower","take care of the pet","tidy room","visit relatives","wait","wake up","wash","watch","wear","work","would like to","write diary","about","after","because","before","but","here","me","there","until","us","well","with","how many","how much","how","what time","when","where","which","who","whose","why","always","at night","at the weekends","class","early","everyday","free time","in the afternoon","in the evenings","in the mornings","late","leisure time","never","often","on weekdays","rarely","sometimes","traditional","usually"
    ];
    const COLS=9, ROWS=3, CARDS_PER_STRIP=6;
    const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1)|0); [a[i],a[j]]=[a[j],a[i]]; } return a; };

    // Kelimelerle kart üretimi
    function generateWordStrip(){
      // Her kartta 15 kelime olacak, bir şeritte 6 kart var: 6x15=90 kelime
      const allWords = shuffle([...WORDS]);
      if (allWords.length < 90) throw new Error('Yeterli kelime yok!');
      let idx = 0;
      const tickets = [];
      for(let t=0; t<6; t++){
        // 3x9 grid, her satırda 5 kelime olacak
        const grid = Array.from({length:ROWS},()=>Array(COLS).fill(null));
        for(let r=0; r<ROWS; r++){
          // 5 kelimeyi rastgele kolonlara yerleştir
          const cols = shuffle([...Array(COLS).keys()]).slice(0,5);
          for(const c of cols){
            grid[r][c] = allWords[idx++];
          }
        }
        tickets.push(grid);
      }
      return tickets;
    }
    function generateWordStripWithRetry(max=400){ for(let i=0;i<max;i++){ try{ const g=generateWordStrip(); if(g) return g; }catch(e){} } throw new Error('Geçerli kelime strip üretilemedi.'); }

    /* ===== Çekiliş Listesi (tek pano) & Kayıt ===== */
    const board = document.getElementById('board-90');
    const gridDrawn = document.getElementById('drawn-grid');
    const lastEl = document.getElementById('last-number');

    // Kelime çekilişi
    let calledWords = [];

    function buildBoard(){
      board.innerHTML='';
      let idx = 0;
      for(let i=0; i<WORDS.length; i++){
        const d = document.createElement('div');
        d.className='cell';
        d.dataset.n = idx;
        d.textContent = WORDS[idx] || '';
        board.appendChild(d);
        idx++;
      }
    }
    function markBoard(){
      // Her çekilen kelime işaretlensin
      document.querySelectorAll('#board-90 .cell').forEach(el=>{
        el.classList.toggle('mark', calledWords.includes(el.textContent));
      });
    }
    function renderLists(){
      // Çıkan: çekiliş SIRASIYLA (sıralama YOK)
      gridDrawn.innerHTML='';
      for(const w of calledWords){
        const s=document.createElement('span'); s.className='pill'; s.textContent=w;
        gridDrawn.appendChild(s);
      }
      markBoard();
    }

    /* ===== Caller (TTS) – kadın sesi öncelikli ===== */
    function pickLang(){
  // TTS sadece İngilizce
  return 'en-US';
    }
    function pickVoiceFor(lang){
      const voices = speechSynthesis.getVoices();
      const langBase = lang.split('-')[0].toLowerCase();
      let cand = voices.filter(v =>
        v.lang && (v.lang.toLowerCase() === lang.toLowerCase() ||
                   v.lang.toLowerCase().startsWith(langBase))
      );
      const femaleHints = ['seda','filiz','elif','banu','ayça','zeynep','yağmur','dilara','female','woman','wavenet-a','neural female'];
      let v = cand.find(v => femaleHints.some(h => v.name.toLowerCase().includes(h)));
      if (!v) v = cand[0];
      if (!v) v = voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langBase));
      return v || null;
    }
    function speakNumber(n){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance();
  u.lang = 'en-US';
  u.text = `${n}`;
  const v = pickVoiceFor('en-US');
  if(v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
    }
    function voicesReady(cb){ if(speechSynthesis.getVoices().length) cb(); else speechSynthesis.onvoiceschanged = cb; }
    // TTS butonunu sesler hazır olunca aktif et
    voicesReady(function(){
      document.getElementById('btn-call').disabled = false;
    });

  function resetCaller(){ calledWords=[]; lastEl.textContent='–'; renderLists(); }

    function callWord(){
      if(calledWords.length===WORDS.length) return;
      let w;
      do{
        w = WORDS[Math.floor(Math.random()*WORDS.length)];
      }while(calledWords.includes(w));
      calledWords.push(w);
      lastEl.textContent=w;
      renderLists();
      speakNumber(w);
    }

    /* ===== Band metni: JSON / preset / özel ===== */
    let bandTexts=['WORD BİNGOBALA'], bandIndex=0;
    const srcLocal   = document.getElementById('src-local');
    const srcPreset  = document.getElementById('src-preset');
    const srcCustom  = document.getElementById('src-custom');
    const localFile  = document.getElementById('local-file');
    const presetSelect  = document.getElementById('preset-select');
    const customText = document.getElementById('custom-text');

    function setBandsInfo(){ document.getElementById('bands-info').textContent=`${bandTexts.length} başlık yüklendi`; }
    async function loadPreset(name){
      try{
        const r=await fetch(`presets/${name}.json`,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`);
        const arr=await r.json(); if(!Array.isArray(arr)||!arr.length) throw new Error('Boş JSON');
    bandTexts=arr.map(String); bandIndex=0; setBandsInfo();
      }catch(e){ console.warn('Preset yüklenemedi:',e); bandTexts=['WORD BİNGOBALA']; bandIndex=0; setBandsInfo(); }
    }
    function loadLocalFile(file){
      const rd=new FileReader();
      rd.onload=()=>{ try{ const arr=JSON.parse(rd.result);
        if(Array.isArray(arr)&&arr.length){ bandTexts=arr.map(String); bandIndex=0; setBandsInfo(); }
        else { bandTexts=['BINGO']; bandIndex=0; setBandsInfo(); alert('JSON bir dizi olmalı.'); }
      }catch(err){ bandTexts=['BINGO']; bandIndex=0; setBandsInfo(); alert('JSON çözümlenemedi: '+err.message); } };
      rd.readAsText(file,'utf-8');
    }
    function refreshSourceUi(){
      localFile.disabled = !srcLocal.checked;
      presetSelect.disabled = !srcPreset.checked;
      customText.disabled = !srcCustom.checked;
    }
    srcLocal.addEventListener('change',refreshSourceUi);
    srcPreset.addEventListener('change',refreshSourceUi);
    srcCustom.addEventListener('change',refreshSourceUi);
    localFile.addEventListener('change', e => { if(e.target.files?.[0]) loadLocalFile(e.target.files[0]); });
    presetSelect.addEventListener('change', e => loadPreset(e.target.value));

    const nextBand = ()=>{
      if (srcCustom.checked) {
        const t = (customText.value || '').trim();
        return t || 'BINGO';
      }
      const list = bandTexts.filter(t=>t && t.trim());
      return list.length ? list[bandIndex++ % list.length] : 'BINGO';
    };

    /* ===== PDF oluşturma ===== */
    function getOpts(){
      return {
        bandColor: document.getElementById('opt-band-color').value || '#f32509ff',
        bandTextColor: document.getElementById('opt-band-text-color').value || '#f1e6e6ff',
        serialStart: parseInt(document.getElementById('opt-serial-start').value||'1',10),
        pages: Math.max(1, parseInt(document.getElementById('opt-pages').value||'1',10)),
        baseName: (document.getElementById('opt-basename').value||'bingo_').trim()
      };
    }

    // Kart çizimi: band üstte, band üstünde kesik çizgi, seri band içinde (6pt bold)
    function drawTicket(
      doc, x, y, w, h, grid, serial,
      bandColor, bandText, bandTextColor
    ){
      const [br,bg,bb]=hexToRgb(bandColor,[255,165,0]);
      const [tr,tg,tb]=hexToRgb(bandTextColor,[0,0,0]);
      const BAND_H = cm(0.8);

      const gridY = y + BAND_H, gridH = h - BAND_H;
      const cellW = w/9, cellH = gridH/3;

      // Hücreler ve kelimeler
      doc.setDrawColor(40); doc.setLineWidth(0.2); doc.setTextColor(0);
      for(let r=0;r<3;r++){
        for(let c=0;c<9;c++){
          const cx=x+c*cellW, cy=gridY+r*cellH;
          doc.rect(cx,cy,cellW,cellH);
          const v=grid[r][c]; if(v==null) continue;
          doc.setFont(FONT_TEXT,'normal');
          const fit = fitTextToWidth(doc, v, cellW*0.92, 36, 8, 12);
          doc.setFontSize(fit.size);
          if (fit.lines.length === 1) {
            doc.text(fit.lines[0], cx+cellW/2, cy+cellH/2, {align:'center', baseline:'middle'});
          } else if (fit.lines.length === 2) {
            // İki satırda ortala
            const lineH = fit.size + 2;
            const y1 = cy+cellH/2 - lineH/2;
            const y2 = cy+cellH/2 + lineH/2;
            doc.text(fit.lines[0], cx+cellW/2, y1, {align:'center', baseline:'middle'});
            doc.text(fit.lines[1], cx+cellW/2, y2, {align:'center', baseline:'middle'});
          }
        }
      }

      // Band
      const bandTop = y;
      doc.setFillColor(br,bg,bb);
      doc.rect(x, bandTop, w, BAND_H, 'F');

 
  let text = bandText; if(FONT_TEXT!=='Uni') text = transliterate(text);
  doc.setTextColor(tr,tg,tb); doc.setFont(FONT_TEXT,'bold');
  const fit = fitTextToWidth(doc, text, w*0.92, 36, 8, 12);
  doc.setFontSize(fit.size);
  const bandTextY = bandTop + BAND_H*0.42;
  doc.text(fit.lines[0], x+w/2, bandTextY, {align:'center', baseline:'middle'});

  
  const serialStr = String(serial).padStart(5,'0');
  doc.setFont(FONT_NUM,'bold'); doc.setFontSize(6); doc.setTextColor(255,255,255);
  const serialY = bandTop + BAND_H - 2; // alt kenara yakın
  doc.text(serialStr, x+w/2, serialY, {align:'center', baseline:'bottom'});

  // Kesik çizgi (bandın ÜSTÜNDE, kalın)
  const dashedY = Math.max(bandTop-1, 0);
  doc.setLineDash([4,2],0); doc.setDrawColor(0);
  doc.setLineWidth(1.4); // Kalınlık artırıldı
  doc.line(x, dashedY, x+w, dashedY);
  doc.setLineDash();
  doc.setLineWidth(0.2); // Sonra eski kalınlığa dön
    }

    async function generatePdf(){
      if(!window.jspdf || !window.jspdf.jsPDF){
        alert('PDF oluşturucu (jsPDF) yüklenemedi! İnternet bağlantınızı ve sayfa kaynağını kontrol edin.');
        return;
      }
      const { jsPDF } = window.jspdf;
      const o = getOpts();
      const doc = new jsPDF({unit:'pt', format:'a4', compress:true});
      await tryLoadUnicodeFont(doc);

  const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
  const MARGIN_T = cm(0.8), MARGIN_B = cm(0.3), MARGIN_LR = cm(0.8), MARGIN_RR = cm(0.8);
  // Şerit genişliği, A4'ün kullanılabilir alanını dolduracak şekilde ayarlanıyor
  const STRIP_W = pageW - MARGIN_LR - MARGIN_RR;
  // Şeritler tam sayfa yüksekliğini kullansın
  const availH = pageH - MARGIN_T - MARGIN_B;
  const ticketH = availH / CARDS_PER_STRIP;
      // Sayfa üstüne ve altına site adresi ekle
      function drawHeaderFooter() {
        doc.setFontSize(10);
        doc.setTextColor(80,80,80);
        doc.text('https://sonsuzyasam.github.io/WordBingo/', pageW/2, cm(0.5), {align:'center'});
        doc.text('https://sonsuzyasam.github.io/WordBingo/', pageW/2, pageH-cm(0.2), {align:'center'});
      }

      let serial = o.serialStart;
      const ts=new Date(), pad=n=>String(n).padStart(2,'0');
      const stamp = ts.getFullYear()+pad(ts.getMonth()+1)+pad(ts.getDate())+'_'+pad(ts.getHours())+pad(ts.getMinutes())+pad(ts.getSeconds());
      const pdfName = `${o.baseName||'bingo_'}${stamp}.pdf`;

      function drawStrip(tickets) {
        for (let i=0; i<CARDS_PER_STRIP; i++) {
          const y = MARGIN_T + i * ticketH;
          drawTicket(doc, MARGIN_LR, y, STRIP_W, ticketH, tickets[i], serial,
            o.bandColor, nextBand(), o.bandTextColor
          );
          serial++;
        }
      }

      for(let p=0; p<o.pages; p++){
  drawHeaderFooter();
  const left  = generateWordStripWithRetry();
  drawStrip(left);
  if(p<o.pages-1) doc.addPage();
      }

      doc.save(pdfName);
    }

    /* ===== UI bağlama & başlangıç ===== */
    document.getElementById('btn-call').addEventListener('click',callWord);
  document.getElementById('btn-reset').addEventListener('click',()=>{ calledWords=[]; lastEl.textContent='–'; renderLists(); });
  document.getElementById('btn-pdf').addEventListener('click',generatePdf);

  refreshSourceUi(); setBandsInfo(); buildBoard(); loadPreset('valentine'); resetCaller();
  }
})();
