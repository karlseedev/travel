// 포트폴리오 사본 전용 — 화면은 그대로 두고, 서버가 하던 일만 여기서 막거나 대신한다.
//   1) 상태를 바꾸는 요청(POST 폼·fetch·XHR)은 보내지 않고 안내만 띄운다.
//   2) 서버가 그려 주던 화면 전환(전체 숙소의 필터·정렬, 프리셋의 상권 이동)을 화면 안에서 한다.
(function(){
  var MSG = '포트폴리오용 읽기 전용 사본입니다 — 실행되지 않습니다';

  function toast(msg){
    var t = document.getElementById('pf-toast');
    if(!t){ t = document.createElement('div'); t.id = 'pf-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(function(){ t.className = 'show'; });
    clearTimeout(t._h);
    t._h = setTimeout(function(){ t.className = ''; }, 2600);
  }

  function isPost(form, submitter){
    var m = (submitter && submitter.getAttribute('formmethod')) || form.getAttribute('method') || 'get';
    return String(m).toLowerCase() === 'post';
  }

  // 폼 제출 — 캡처 단계에서 끊는다(화면의 자체 핸들러·확인 창보다 먼저).
  document.addEventListener('submit', function(e){
    var f = e.target;
    if(!f || !f.getAttribute || !isPost(f, e.submitter)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    toast(MSG);
  }, true);

  var nativeSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function(){
    if(isPost(this, null)){ toast(MSG); return; }
    nativeSubmit.call(this);
  };

  var nativeFetch = window.fetch;
  if(nativeFetch){
    window.fetch = function(input, init){
      var m = (init && init.method) || (input && input.method) || 'GET';
      if(!/^(get|head)$/i.test(m)){ toast(MSG); return new Promise(function(){}); }
      return nativeFetch.apply(this, arguments);
    };
  }
  var xhrOpen = XMLHttpRequest.prototype.open, xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method){
    this._pfWrite = !/^(get|head)$/i.test(method || 'GET');
    return xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(){
    if(this._pfWrite){ toast(MSG); return; }
    return xhrSend.apply(this, arguments);
  };
  if(navigator.sendBeacon){ navigator.sendBeacon = function(){ return false; }; }

  // 사본에 담지 않은 화면으로 가는 링크.
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[data-pf-off]');
    if(!a) return;
    e.preventDefault();
    toast('이 화면은 사본에 담지 않았습니다');
  }, true);

  // 시즌 프리셋 — 상권을 고르면 그 상권을 떠 둔 파일로 간다.
  if(window.PF_PRESET){
    window.goMarket = function(v){
      var u = window.PF_PRESET[v];
      if(u) location.href = u; else toast('이 상권은 사본에 담지 않았습니다');
    };
  }

  // 전체 숙소 — 필터·정렬을 화면 안에서 한다(서버 규칙: 4축 AND · 고른 축 내림차순 · 모름은 맨 뒤).
  var ff = document.querySelector('form.filter');
  var tbody = ff && document.querySelector('form[action="/gate-approve"] table tbody');
  if(ff && tbody){
    var SIDO = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원',
                '충북','충남','전북','전남','경북','경남','제주'];
    var LONG = {'충청북':'충북','충청남':'충남','전라북':'전북','전라남':'전남','경상북':'경북','경상남':'경남'};
    var num = function(td){
      var s = td.textContent.replace(/[,\s]/g, '');
      return /^\d+$/.test(s) ? parseInt(s, 10) : null;
    };
    var sido = function(s){
      var k = s.trim().split(/\s+/)[0] || '';
      for(var p in LONG){ if(k.indexOf(p) === 0) return LONG[p]; }
      for(var i = 0; i < SIDO.length; i++){ if(k.indexOf(SIDO[i]) === 0) return SIDO[i]; }
      return k;
    };
    var data = [].slice.call(tbody.rows).map(function(tr){
      var c = tr.cells, sm = /^(\d)성/.exec(c[5].textContent.trim());
      return {tr: tr, region: sido(c[3].textContent), type: c[4].textContent.trim(),
              star: sm ? sm[1] : 'none', docs: num(c[6]), vol: num(c[7]), rv: num(c[8])};
    });
    var count = document.querySelector('.titlebar .count');
    var minrv = ff.querySelector('input[name="minrv"]');
    var minrvText = minrv && minrv.nextSibling;
    var minrvDefault = minrvText ? minrvText.textContent : '';
    var sort = 'rv';
    var checked = function(name){
      return [].slice.call(ff.querySelectorAll('input[name="' + name + '"]:checked'))
               .map(function(i){ return i.value; });
    };
    var cmp = function(a, b){
      var av = a[sort], bv = b[sort];
      if((av === null) !== (bv === null)) return av === null ? 1 : -1;
      return (bv || 0) - (av || 0) || (b.rv || 0) - (a.rv || 0) || (b.docs || 0) - (a.docs || 0);
    };
    var apply = function(){
      var regions = checked('region'), types = checked('type'), stars = checked('star');
      var kept = data.filter(function(d){
        return (!regions.length || regions.indexOf(d.region) >= 0)
            && types.indexOf(d.type) >= 0 && stars.indexOf(d.star) >= 0;
      }).sort(cmp);
      var frag = document.createDocumentFragment();
      kept.forEach(function(d){ frag.appendChild(d.tr); });
      tbody.textContent = '';
      tbody.appendChild(frag);
      if(count) count.textContent = count.textContent.replace(/필터\s*[\d,]+/, '필터 ' + kept.length);
      var isDefault = !regions.length && stars.length === 6 && types.length === 5
                      && types.indexOf('모텔') < 0;
      if(minrvText) minrvText.textContent = isDefault ? minrvDefault
          : ' 후기 500 이상만 보기 — ' + kept.length.toLocaleString() + '곳';
    };
    ff.addEventListener('submit', function(e){ e.preventDefault(); apply(); });
    if(minrv) minrv.addEventListener('change', function(){
      if(!minrv.checked){ minrv.checked = true; toast('사본에는 후기 500 이상인 숙소만 담았습니다'); }
    });
    [].slice.call(document.querySelectorAll('thead a[data-pf-sort]')).forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        sort = a.getAttribute('data-pf-sort');
        [].slice.call(document.querySelectorAll('thead a[data-pf-sort]')).forEach(function(o){
          o.textContent = o.textContent.replace(/\s*▼$/, '') + (o === a ? ' ▼' : '');
          o.parentNode.classList.toggle('sorted', o === a);
        });
        apply();
      });
    });
    apply();
  }
})();
