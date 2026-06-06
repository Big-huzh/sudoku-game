// ===== 数独游戏逻辑 =====
(function(){
    // ----- 状态 -----
    let solution=[], board=[], preset=[], notes=[];
    let selectedIdx=null;
    let difficulty='medium';
    let errorCount=0, moveCount=0, remaining=81;
    let timerSeconds=0, timerInterval=null;
    let history=[];
    const MAX_HISTORY=200;
    let isCompleted=false, noteMode=false, isPaused=false;
    let pendingDiff=null;
    let challengeMode=false, challengeMax=0;
    let highestSelectedNum=null; // for note highlighting

    // 静态关卡库（每个难度 3 个不同谜题）
    const LEVELS={
        e1:{name:'简单·星',diff:'easy',sol:'971856342456723891238419576629548713713692458584137269345271987162984135897365124'},
        e2:{name:'简单·月',diff:'easy',sol:'812753649943682175675491283154237896369845721287169534521974368438526917796318452'},
        e3:{name:'简单·日',diff:'easy',sol:'534678912672195348198342567859761423426853791713924856961537284287419635345286179'},
        m1:{name:'中等·风',diff:'medium',sol:'371856942456723891238419576629548713713692458584137269345271987162984135897365124'},
        m2:{name:'中等·云',diff:'medium',sol:'592487136681935274347216859215643798869751423734892561153874942476129385928563417'},
        m3:{name:'中等·雷',diff:'medium',sol:'648359712359712648712684359176235984534198276298476135983561427461927853825843961'},
        h1:{name:'困难·山',diff:'hard',sol:'261389475359271468784659321172543986935168742846792153618425837493817256527936814'},
        h2:{name:'困难·火',diff:'hard',sol:'418236597937581426562974138351827964826419375749365281283793645675142893194658712'},
        h3:{name:'困难·水',diff:'hard',sol:'745839126936521784128476593682357419571948362394162857213684975469715238857293641'}
    };

    // DOM refs
    const boardEl=document.getElementById('board');
    const messageEl=document.getElementById('message');
    const numPadEl=document.getElementById('numPad');
    const timerEl=document.getElementById('timer');
    const timerProgEl=document.getElementById('timerProgress');
    const STORAGE_KEY='sudoku_v2';
    const STATS_KEY='sudoku_stats_v2';

    // ===== 音效 =====
    let audioCtx=null;
    function ac(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx}
    function playSound(t){
        try{const cx=ac();
        if(t==='fill'){const o=cx.createOscillator(),g=cx.createGain();o.connect(g);g.connect(cx.destination);o.frequency.value=600;o.type='sine';g.gain.setValueAtTime(.07,cx.currentTime);g.gain.exponentialRampToValueAtTime(.001,cx.currentTime+.1);o.start();o.stop(cx.currentTime+.1)}
        else if(t==='error'){const o=cx.createOscillator(),g=cx.createGain();o.connect(g);g.connect(cx.destination);o.frequency.value=220;o.type='square';g.gain.setValueAtTime(.04,cx.currentTime);g.gain.exponentialRampToValueAtTime(.001,cx.currentTime+.2);o.start();o.stop(cx.currentTime+.2)}
        else if(t==='win'){[523,659,784,1047].forEach((f,i)=>{const o=cx.createOscillator(),g=cx.createGain();o.connect(g);g.connect(cx.destination);o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.05,cx.currentTime+i*.12);g.gain.exponentialRampToValueAtTime(.001,cx.currentTime+i*.12+.35);o.start(cx.currentTime+i*.12);o.stop(cx.currentTime+i*.12+.35)})}
        else if(t==='click'){const o=cx.createOscillator(),g=cx.createGain();o.connect(g);g.connect(cx.destination);o.frequency.value=800;o.type='sine';g.gain.setValueAtTime(.04,cx.currentTime);g.gain.exponentialRampToValueAtTime(.001,cx.currentTime+.05);o.start();o.stop(cx.currentTime+.05)}
        }catch(e){}
    }

    // ===== 统计 =====
    function getStats(){try{const r=localStorage.getItem(STATS_KEY);return r?JSON.parse(r):{bestTimes:{},completed:{},stars:{}}}catch(e){return{bestTimes:{},completed:{},stars:{}}}}
    function saveStats(s){try{localStorage.setItem(STATS_KEY,JSON.stringify(s))}catch(e){}}
    function updateBestTime(diff,time){const s=getStats();if(!s.bestTimes[diff]||time<s.bestTimes[diff]){s.bestTimes[diff]=time;saveStats(s);return true}return false}
    function incrementCompleted(diff,stars){const s=getStats();if(!s.completed[diff])s.completed[diff]=0;s.completed[diff]++;if(!s.stars[diff])s.stars[diff]=[0,0,0,0];s.stars[diff][stars]++;saveStats(s)}
    function calcStars(errs,time,diff){
        // 星级 = 基于错误数和用时的综合评定
        const tLimits={easy:{gold:120,silver:300},medium:{gold:240,silver:600},hard:{gold:480,silver:1200}};
        const lim=tLimits[diff]||tLimits.medium;
        let stars=0;
        if(errs===0)stars++;
        if(time<=lim.gold)stars++;
        if(time<=lim.silver)stars++;
        return Math.max(1,stars);
    }

    function showStats(){
        const s=getStats(),dn={easy:'简单',medium:'中等',hard:'困难'};
        const total=(s.completed.easy||0)+(s.completed.medium||0)+(s.completed.hard||0);
        let h=`<div style="text-align:center;margin-bottom:8px;font-size:13px;color:var(--text-secondary)">总完成 <b style="color:var(--text)">${total}</b> 局</div>`;
        for(const d of['easy','medium','hard']){
            const bt=s.bestTimes[d],comp=s.completed[d]||0;
            const st=s.stars[d]||[0,0,0,0];
            h+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.05)"><span>${dn[d]}</span><span style="color:var(--text);font-weight:700">完成${comp}次 | 最佳${bt?formatTime(bt):'--:--'} | ⭐${st[3]||0}/${st[2]||0}/${st[1]||0}</span></div>`;
        }
        document.getElementById('statsContent').innerHTML=h;
        document.getElementById('statsModal').classList.add('open');
    }
    function resetStats(){localStorage.removeItem(STATS_KEY);showStats()}

    // ===== 主题 =====
    function toggleTheme(){
        const isDark=document.body.classList.toggle('dark');
        document.getElementById('btnTheme').textContent=isDark?'☀️':'🌙';
        try{localStorage.setItem('sudoku_theme_v2',isDark?'dark':'light')}catch(e){}
    }
    function initTheme(){
        try{const t=localStorage.getItem('sudoku_theme_v2');if(t==='dark'){document.body.classList.add('dark');document.getElementById('btnTheme').textContent='☀️'}}catch(e){}
    }

    // ===== 自动暂停 =====
    document.addEventListener('visibilitychange',()=>{
        if(isCompleted)return;
        if(document.hidden){if(timerInterval){isPaused=true;document.getElementById('pausedOverlay').classList.add('show');stopTimer()}}
        else{if(isPaused){isPaused=false;document.getElementById('pausedOverlay').classList.remove('show');startTimerResume()}}
    });

    // ===== 候选数计算 =====
    function getCandidates(idx){
        const row=Math.floor(idx/9),col=idx%9;
        const used=Array(10).fill(false);
        for(let i=0;i<9;i++){used[board[row*9+i]]=true;used[board[i*9+col]]=true}
        const sr=Math.floor(row/3)*3,sc=Math.floor(col/3)*3;
        for(let r=0;r<3;r++)for(let c=0;c<3;c++)used[board[(sr+r)*9+sc+c]]=true;
        const cands=[];
        for(let n=1;n<=9;n++)if(!used[n])cands.push(n);
        return cands;
    }
    function smartHint(){
        if(isCompleted)return;
        const cands=[];
        for(let i=0;i<81;i++){if(!preset[i]&&board[i]!==solution[i]){const c=getCandidates(i);cands.push({idx:i,count:c.length})}}
        if(cands.length===0)return;
        cands.sort((a,b)=>a.count-b.count);
        const top=cands.slice(0,Math.min(3,cands.length));
        return top[Math.floor(Math.random()*top.length)].idx;
    }

    // ===== Canvas 粒子庆祝 =====
    function celebrate(stars){
        playSound('win');
        const canvas=document.getElementById('celebrateCanvas');
        canvas.style.display='block';
        canvas.width=window.innerWidth;canvas.height=window.innerHeight;
        const ctx=canvas.getContext('2d');
        const particles=[];
        const colors=['#ff6b6b','#feca57','#48dbfb','#ff9ff3','#54a0ff','#5f27cd','#01a3a4','#f368e0','#f6c23e','#a0e7e5'];
        for(let i=0;i<180;i++){
            particles.push({
                x:Math.random()*canvas.width,y:Math.random()*canvas.height*-1-20,
                vx:(Math.random()-.5)*4,vy:Math.random()*3+1.5,
                size:Math.random()*6+3,color:colors[Math.floor(Math.random()*colors.length)],
                life:1,decay:.003+Math.random()*.01,
                rotation:Math.random()*360,rotSpeed:(Math.random()-.5)*6
            });
        }
        let frame=0;
        function animate(){
            ctx.clearRect(0,0,canvas.width,canvas.height);
            let alive=false;
            for(const p of particles){
                if(p.life<=0)continue;alive=true;
                p.x+=p.vx;p.y+=p.vy;p.vy+=.03;p.life-=p.decay;p.rotation+=p.rotSpeed;
                ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation*Math.PI/180);
                ctx.globalAlpha=p.life;
                ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);
                ctx.restore();
            }
            frame++;
            if(frame<200&&alive)requestAnimationFrame(animate);
            else{canvas.style.display='none';ctx.clearRect(0,0,canvas.width,canvas.height)}
        }
        requestAnimationFrame(animate);
        // 星级弹出
        showStarRating(stars);
    }

    function showStarRating(stars){
        const msg=document.getElementById('message');
        const starHTML='<div class="star-rating">'+[1,2,3].map(i=>`<span class="star${i<=stars?' earned':''}">⭐</span>`).join('')+'</div>';
        msg.innerHTML='🎉 恭喜完成！'+starHTML;
        msg.className='message show success';
    }

    // ===== 数独逻辑 =====
    function isValid(brd,row,col,num){
        for(let i=0;i<9;i++){if(brd[row*9+i]===num||brd[i*9+col]===num)return false}
        const sr=Math.floor(row/3)*3,sc=Math.floor(col/3)*3;
        for(let r=0;r<3;r++)for(let c=0;c<3;c++)if(brd[(sr+r)*9+sc+c]===num)return false;
        return true;
    }
    function generate(){
        const b=Array(81).fill(0);
        function solve(arr){
            const idx=arr.indexOf(0);if(idx===-1)return true;
            const row=Math.floor(idx/9),col=idx%9;
            const nums=[1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-.5);
            for(const n of nums){if(isValid(arr,row,col,n)){arr[idx]=n;if(solve(arr))return true;arr[idx]=0}}
            return false;
        }
        solve(b);return b;
    }

    // 回溯计数唯一解（限制计数为 2 以快速判断非唯一）
    function countSolutions(brd,limit){
        let count=0;
        function solve(arr){
            if(count>=limit)return;
            const idx=arr.indexOf(0);
            if(idx===-1){count++;return}
            const row=Math.floor(idx/9),col=idx%9;
            for(let n=1;n<=9;n++){
                if(isValid(arr,row,col,n)){arr[idx]=n;solve(arr);arr[idx]=0;if(count>=limit)return}
            }
        }
        const copy=[...brd];
        solve(copy);
        return count;
    }

    function createPuzzle(sol,diff){
        const holes={easy:30,medium:44,hard:54}[diff]||44;
        const p=[...sol];
        const positions=[...Array(81).keys()].sort(()=>Math.random()-.5);
        let removed=0;
        for(const i of positions){
            if(removed>=holes)break;
            const backup=p[i];p[i]=0;
            if(countSolutions(p,2)===1){removed++}
            else{p[i]=backup}
        }
        return p;
    }

    function getBoxClass(idx){
        const row=Math.floor(idx/9),col=idx%9;
        return(Math.floor(row/3)+Math.floor(col/3))%2===0?'box-even':'box-odd';
    }
    function getBoxBorderClasses(idx){
        const r=Math.floor(idx/9),c=idx%9,cls=[];
        if(c%3===0)cls.push('box-left');
        if(c%3===2||c===8)cls.push('box-right');
        if(r%3===0)cls.push('box-top');
        if(r%3===2||r===8)cls.push('box-bottom');
        return cls;
    }

    // ===== 渲染 =====
    function render(){
        boardEl.innerHTML='';
        for(let i=0;i<81;i++){
            const c=document.createElement('div');
            c.className='cell '+getBoxClass(i)+' '+getBoxBorderClasses(i).join(' ');
            c.dataset.idx=i;
            if(board[i]!==0){
                const span=document.createElement('span');
                span.className='main-num';span.textContent=board[i];
                c.appendChild(span);
                c.classList.add(preset[i]?'preset':'user-input');
            }
            if(notes[i]&&notes[i].length>0&&board[i]===0){
                const ne=document.createElement('div');ne.className='notes';
                for(let n=1;n<=9;n++){
                    const s=document.createElement('span');
                    s.textContent=notes[i].includes(n)?n:'';
                    // 笔记高亮：当选中格有数字时高亮相同笔记数字，或笔记模式下高亮当前最高选中数字
                    if(notes[i].includes(n)&&(
                        (selectedIdx!==null&&board[selectedIdx]!==0&&board[selectedIdx]===n)||
                        (noteMode&&highestSelectedNum===n)
                    )){s.classList.add('note-highlight')}
                    ne.appendChild(s);
                }
                c.appendChild(ne);c.classList.add('has-notes');
            }
            c.addEventListener('click',(e)=>{selectCell(parseInt(e.currentTarget.dataset.idx))});
            boardEl.appendChild(c);
        }
        updateHighlights();recount();
    }

    function getCell(i){return boardEl.children[i]}
    function selectCell(idx){
        if(isCompleted||isPaused)return;
        selectedIdx=idx;
        if(noteMode){getCell(idx).classList.add('note-mode')}
        updateHighlights();render();
    }

    function updateHighlights(){
        const cells=boardEl.children;
        for(let i=0;i<81;i++)cells[i].classList.remove('selected','highlight-related','highlight-same-number');
        if(selectedIdx===null)return;
        const sel=selectedIdx,sRow=Math.floor(sel/9),sCol=sel%9;
        const sBoxR=Math.floor(sRow/3),sBoxC=Math.floor(sCol/3),sNum=board[sel];
        for(let i=0;i<81;i++){
            const r=Math.floor(i/9),c=i%9;
            const boxR=Math.floor(r/3),boxC=Math.floor(c/3);
            const related=(r===sRow||c===sCol||(boxR===sBoxR&&boxC===sBoxC));
            if(i===sel)cells[i].classList.add('selected');
            else if(related)cells[i].classList.add('highlight-related');
            if(sNum!==0&&board[i]===sNum&&i!==sel)cells[i].classList.add('highlight-same-number');
        }
    }

    function clearRelatedNotes(idx,num){
        const row=Math.floor(idx/9),col=idx%9;
        const sr=Math.floor(row/3)*3,sc=Math.floor(col/3)*3;
        for(let i=0;i<81;i++){
            if(i===idx)continue;
            const r=Math.floor(i/9),c=i%9;
            const boxR=Math.floor(r/3),boxC=Math.floor(c/3);
            if((r===row||c===col||(boxR===sr&&boxC===sc))&&notes[i]&&notes[i].length>0){
                const pos=notes[i].indexOf(num);if(pos>=0)notes[i].splice(pos,1);
            }
        }
    }

    function pushHistory(op){
        history.push(op);
        if(history.length>MAX_HISTORY)history.splice(0,history.length-MAX_HISTORY);
        document.getElementById('btnUndo').disabled=false;
    }

    // ===== 操作 =====
    function fillNumber(num){
        if(selectedIdx===null||isCompleted||isPaused)return;
        const idx=selectedIdx;
        if(preset[idx])return;
        // 笔记模式
        if(noteMode&&board[idx]===0){
            if(!notes[idx])notes[idx]=[];
            const oldNotes=[...notes[idx]];
            const pos=notes[idx].indexOf(num);
            if(pos>=0)notes[idx].splice(pos,1);else{notes[idx].push(num);notes[idx].sort((a,b)=>a-b)}
            // 用于笔记高亮
            highestSelectedNum=num;
            pushHistory({idx,oldVal:0,oldNotes});
            render();updateStats();autoSave();hideMessage();playSound('click');
            return;
        }
        if(board[idx]!==0)return;
        const oldNotes=notes[idx]?[...notes[idx]]:[];
        notes[idx]=[];highestSelectedNum=num;
        board[idx]=num;
        const cell=getCell(idx);
        cell.innerHTML='<span class="main-num">'+num+'</span>';
        cell.classList.remove('user-input','error-mark','has-notes','note-mode');
        cell.classList.add('user-input');
        pushHistory({idx,oldVal:0,oldNotes});
        if(num===solution[idx]){
            moveCount++;clearRelatedNotes(idx,num);render();
        }else{
            errorCount++;cell.classList.add('error-mark');moveCount++;
            playSound('error');
            showMessage('数字 '+num+' 不正确','error');setTimeout(hideMessage,1500);
        }
        playSound('fill');selectedIdx=null;
        recalcRemaining();updateStats();updateHighlights();updateNumPad();
        hideMessage();autoSave();
        if(remaining===0&&!hasErrors()){const stars=calcStars(errorCount,timerSeconds,difficulty);win(stars)}
    }

    function toggleNote(e){
        noteMode=!noteMode;
        document.getElementById('btnNote').classList.toggle('active',noteMode);
        highestSelectedNum=null;
        if(selectedIdx!==null){
            getCell(selectedIdx).classList.toggle('note-mode',noteMode);
        }
        render();playSound('click');
    }

    function deleteNumber(){
        if(selectedIdx===null||isCompleted||isPaused)return;
        const idx=selectedIdx;
        if(preset[idx]||(board[idx]===0&&(!notes[idx]||notes[idx].length===0)))return;
        pushHistory({idx,oldVal:board[idx],oldNotes:notes[idx]?[...notes[idx]]:[]});
        board[idx]=0;notes[idx]=[];
        const cell=getCell(idx);
        cell.innerHTML='';cell.classList.remove('user-input','error-mark','has-notes','note-mode');
        selectedIdx=null;highestSelectedNum=null;
        recalcRemaining();updateStats();updateHighlights();updateNumPad();
        hideMessage();autoSave();playSound('click');
    }

    function undo(){
        if(history.length===0)return;
        const op=history.pop();
        const idx=op.idx;
        board[idx]=op.oldVal;notes[idx]=op.oldNotes?[...op.oldNotes]:[];
        if(history.length===0)document.getElementById('btnUndo').disabled=true;
        selectedIdx=null;highestSelectedNum=null;
        errorCount=0;for(let i=0;i<81;i++){if(board[i]!==0&&board[i]!==solution[i])errorCount++;}
        moveCount=Math.max(0,moveCount-1);
        render();updateStats();updateNumPad();hideMessage();autoSave();playSound('click');
    }

    function hint(){
        if(isCompleted||isPaused)return;
        const idx=smartHint();
        if(idx===undefined){showMessage('没有可提示的空格了','info');return}
        selectCell(idx);
        // 短暂高亮该格并填入正确答案
        const cell=getCell(idx);
        cell.style.transition='none';
        cell.style.boxShadow='0 0 0 4px var(--accent-green)';
        setTimeout(()=>{cell.style.boxShadow='';cell.style.transition=''},800);
        pushHistory({idx,oldVal:board[idx],oldNotes:notes[idx]?[...notes[idx]]:[]});
        notes[idx]=[];board[idx]=solution[idx];
        moveCount++;clearRelatedNotes(idx,solution[idx]);
        render();recalcRemaining();updateStats();updateNumPad();
        hideMessage();autoSave();playSound('click');
        if(remaining===0&&!hasErrors()){const stars=calcStars(errorCount,timerSeconds,difficulty);win(stars)}
    }

    function hasErrors(){for(let i=0;i<81;i++){if(board[i]!==0&&board[i]!==solution[i])return true}return false}
    function checkSolution(){
        let found=false;
        for(let i=0;i<81;i++){if(board[i]!==0&&board[i]!==solution[i]){getCell(i).classList.add('error-mark');found=true}}
        if(found){showMessage('有错误数字，红色标记处需修正','error');playSound('error')}
        else if(remaining===0){showMessage('完美！全部正确！','success');playSound('fill')}
        else{showMessage('已填数字都正确，继续加油！','success')}
    }

    function recalcRemaining(){remaining=0;for(let i=0;i<81;i++){if(board[i]===0)remaining++}}
    function recount(){recalcRemaining();updateStats();updateNumPad()}
    function updateStats(){
        document.getElementById('remaining').textContent=remaining;
        document.getElementById('errors').textContent=errorCount;
        document.getElementById('moves').textContent=moveCount;
    }
    function updateNumPad(){
        const counts=Array(10).fill(0);
        for(let i=0;i<81;i++){if(board[i]!==0)counts[board[i]]++}
        const btns=numPadEl.children;
        for(let n=1;n<=9;n++){const done=(counts[n]>=9);btns[n-1].classList.toggle('done',done);btns[n-1].querySelector('.count').textContent=(9-counts[n])+''}
    }
    function buildNumPad(){
        numPadEl.innerHTML='';
        for(let n=1;n<=9;n++){
            const b=document.createElement('button');b.className='nbtn';
            b.innerHTML=n+'<span class="count">9</span>';
            b.addEventListener('click',()=>fillNumber(n));
            numPadEl.appendChild(b);
        }
        const del=document.createElement('button');del.className='nbtn del';del.textContent='⌫';
        del.addEventListener('click',deleteNumber);numPadEl.appendChild(del);
    }
    function formatTime(sec){const m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');return m+':'+s}

    // ===== 计时器 =====
    function updateTimerDisplay(){
        timerEl.textContent=formatTime(timerSeconds);
        timerEl.classList.toggle('challenge',challengeMode);
        if(challengeMode&&challengeMax>0){
            const pct=(timerSeconds/challengeMax)*100;
            timerProgEl.style.width=pct+'%';timerProgEl.classList.add('show');
            if(timerSeconds<=30)timerProgEl.style.background='var(--danger)';
            else timerProgEl.style.background='var(--primary)';
        }else{timerProgEl.classList.remove('show')}
    }
    function startTimer(){
        stopTimer();
        if(challengeMode){challengeMax={easy:300,medium:600,hard:900}[difficulty]||600;timerSeconds=challengeMax}
        else{timerSeconds=0;challengeMax=0}
        updateTimerDisplay();
        timerInterval=setInterval(()=>{
            if(challengeMode){timerSeconds--;if(timerSeconds<=0){timerSeconds=0;gameOver();return}}
            else{timerSeconds++}
            updateTimerDisplay();
        },1000);
    }
    function startTimerResume(){
        if(timerInterval)return;
        timerInterval=setInterval(()=>{timerSeconds++;updateTimerDisplay()},1000);
    }
    function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null}}

    function showMessage(text,type){messageEl.innerHTML=text;messageEl.className='message show '+type}
    function hideMessage(){messageEl.className='message'}

    function win(stars){
        isCompleted=true;stopTimer();
        const isNewBest=updateBestTime(difficulty,timerSeconds);
        incrementCompleted(difficulty,stars);
        localStorage.removeItem(STORAGE_KEY);
        celebrate(stars);
    }
    function gameOver(){
        isCompleted=true;stopTimer();
        showMessage('⏰ 时间到！挑战失败','error');
        document.getElementById('pausedOverlay').classList.add('show');
    }

    // ===== 关卡加载 =====
    function loadLevel(id){
        const level=LEVELS[id];
        solution=level.sol.split('').map(Number);
        board=createPuzzle(solution,level.diff);
        preset=board.map(v=>v!==0);
        notes=Array.from({length:81},()=>[]);
        difficulty=level.diff;errorCount=0;moveCount=0;selectedIdx=null;highestSelectedNum=null;
        document.querySelectorAll('.difficulty-btn').forEach(b=>{b.classList.toggle('active',b.dataset.d===difficulty)});
        render();hideMessage();startTimer();
        document.getElementById('levelModal').classList.remove('open');
    }

    // ===== 自动保存 =====
    function autoSave(){
        try{localStorage.setItem(STORAGE_KEY,JSON.stringify({solution,board,preset,notes,difficulty,errorCount,moveCount,timerSeconds,history,isCompleted,challengeMode,challengeMax}))}catch(e){}
    }
    function tryRestore(){
        try{
            const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return false;
            const data=JSON.parse(raw);if(!data.solution||!data.board)return false;
            solution=data.solution;board=data.board;preset=data.preset;
            notes=data.notes||Array.from({length:81},()=>[]);
            while(notes.length<81)notes.push([]);
            difficulty=data.difficulty||'medium';errorCount=data.errorCount||0;
            moveCount=data.moveCount||0;timerSeconds=data.timerSeconds||0;
            history=data.history||[];isCompleted=data.isCompleted||false;
            challengeMode=data.challengeMode||false;challengeMax=data.challengeMax||0;
            if(isCompleted){showMessage('🎉 恭喜你已完成此局！','success')}
            if(history.length>0)document.getElementById('btnUndo').disabled=false;
            return true;
        }catch(e){return false}
    }
    function newGame(){
        isCompleted=false;history=[];document.getElementById('btnUndo').disabled=true;
        stopTimer();noteMode=false;highestSelectedNum=null;
        document.getElementById('btnNote').classList.remove('active');
        document.getElementById('pausedOverlay').classList.remove('show');
        isPaused=false;
        solution=generate();const puz=createPuzzle(solution,difficulty);
        board=puz.slice();preset=puz.map(v=>v!==0);
        notes=Array.from({length:81},()=>[]);errorCount=0;moveCount=0;selectedIdx=null;
        document.querySelectorAll('.difficulty-btn').forEach(b=>{b.classList.toggle('active',b.dataset.d===difficulty)});
        render();hideMessage();startTimer();localStorage.removeItem(STORAGE_KEY);
    }
    function confirmNewGame(){
        if(moveCount===0||isCompleted){newGame();return}
        document.getElementById('modalTitle').textContent='新游戏';
        document.getElementById('modalBody').textContent='当前游戏进度将丢失，确定要开始新一局吗？';
        document.getElementById('modalOverlay').classList.add('open');
    }

    // ===== 键盘 =====
    function handleKey(e){
        if(isCompleted||isPaused)return;
        const key=e.key;
        if(key>='1'&&key<='9'){e.preventDefault();fillNumber(parseInt(key));return}
        if(key==='Backspace'||key==='Delete'||key==='0'){e.preventDefault();deleteNumber();return}
        if(key==='z'&&(e.ctrlKey||e.metaKey)){e.preventDefault();undo();return}
        if(key==='n'&&(e.ctrlKey||e.metaKey)){e.preventDefault();toggleNote();return}
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)){
            e.preventDefault();
            if(selectedIdx===null){selectCell(0);return}
            let r=Math.floor(selectedIdx/9),c=selectedIdx%9;
            if(key==='ArrowUp')r=Math.max(0,r-1);if(key==='ArrowDown')r=Math.min(8,r+1);
            if(key==='ArrowLeft')c=Math.max(0,c-1);if(key==='ArrowRight')c=Math.min(8,c+1);
            selectCell(r*9+c);
        }
    }

    // ===== 初始化 =====
    buildNumPad();initTheme();
    document.getElementById('btnNote').addEventListener('click',toggleNote);
    document.getElementById('btnTheme').addEventListener('click',toggleTheme);
    document.getElementById('btnStats').addEventListener('click',showStats);
    document.getElementById('statsClose').addEventListener('click',()=>document.getElementById('statsModal').classList.remove('open'));
    document.getElementById('statsReset').addEventListener('click',resetStats);
    document.getElementById('statsModal').addEventListener('click',function(e){if(e.target===this)this.classList.remove('open')});

    if(!tryRestore()){newGame()}else{
        document.querySelectorAll('.difficulty-btn').forEach(b=>{b.classList.toggle('active',b.dataset.d===difficulty)});
        render();
        if(!isCompleted&&timerSeconds>=0){updateTimerDisplay();startTimerResume()}
        if(!isCompleted&&hasErrors())checkSolution();
        if(!isCompleted){showMessage('已恢复上次游戏进度','info');setTimeout(hideMessage,2500)}
    }
    updateTimerDisplay();
    document.getElementById('btnChallenge').classList.toggle('on',challengeMode);
    document.getElementById('challengeStatus').textContent=challengeMode?'开':'关';

    document.getElementById('btnNew').addEventListener('click',confirmNewGame);
    document.getElementById('btnHint').addEventListener('click',hint);
    document.getElementById('btnCheck').addEventListener('click',checkSolution);
    document.getElementById('btnUndo').addEventListener('click',undo);
    document.querySelectorAll('.difficulty-btn').forEach(b=>{
        b.addEventListener('click',function(){
            const nd=this.dataset.d;if(nd===difficulty)return;
            if(moveCount===0||isCompleted){difficulty=nd;newGame();return}
            pendingDiff=nd;
            document.getElementById('diffModalBody').textContent='切换为'+this.textContent+'难度将重新开始，确定吗？';
            document.getElementById('diffModal').classList.add('open');
        });
    });
    document.getElementById('diffConfirm').addEventListener('click',function(){document.getElementById('diffModal').classList.remove('open');if(pendingDiff){difficulty=pendingDiff;pendingDiff=null;newGame()}});
    document.getElementById('diffCancel').addEventListener('click',function(){document.getElementById('diffModal').classList.remove('open');pendingDiff=null});
    document.getElementById('diffModal').addEventListener('click',function(e){if(e.target===this){this.classList.remove('open');pendingDiff=null}});
    document.getElementById('modalConfirm').addEventListener('click',function(){document.getElementById('modalOverlay').classList.remove('open');newGame()});
    document.getElementById('modalCancel').addEventListener('click',function(){document.getElementById('modalOverlay').classList.remove('open')});
    document.getElementById('modalOverlay').addEventListener('click',function(e){if(e.target===this)this.classList.remove('open')});
    document.getElementById('btnLevels').onclick=()=>{
        const list=document.getElementById('levelList');list.innerHTML='';
        Object.entries(LEVELS).forEach(([id,l])=>{
            const item=document.createElement('div');item.className='level-item';
            item.innerHTML=`<span class="level-item-name">${l.name}</span><span class="level-item-diff">${l.diff==='easy'?'简单':l.diff==='medium'?'中等':'困难'}</span>`;
            item.onclick=()=>loadLevel(id);list.appendChild(item);
        });
        document.getElementById('levelModal').classList.add('open');
    };
    document.getElementById('btnCloseLevels').onclick=()=>document.getElementById('levelModal').classList.remove('open');
    document.getElementById('btnChallenge').onclick=()=>{
        challengeMode=!challengeMode;
        document.getElementById('btnChallenge').classList.toggle('on',challengeMode);
        document.getElementById('challengeStatus').textContent=challengeMode?'开':'关';
        if(!isCompleted)newGame();
    };
    document.addEventListener('keydown',handleKey);
})();
