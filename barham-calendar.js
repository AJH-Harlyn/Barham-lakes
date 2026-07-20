/* =====================================================================
   The Barham Lakes — NIGHTLY booking calendar
   Pick a check-in and a check-out night on a month view, per facility.
   Aligns with the Supabase schema (bookings.check_in / check_out).
   Drop-in: <div id="barham-cal" data-facility="brook-pool"></div>
   then load booking-config.js, supabase-js and this file.
   Works in "demo mode" until Supabase keys are set in booking-config.js.
   ===================================================================== */
(function () {
  var mount = document.getElementById('barham-cal');
  if (!mount) return;
  var FAC = window.BARHAM_CAL_FACILITIES || {};
  var KEYS = Object.keys(FAC);
  if (!KEYS.length) { mount.innerHTML = '<p>No bookable waters configured.</p>'; return; }

  var CONFIGURED = window.BARHAM_SUPABASE_URL && window.BARHAM_SUPABASE_URL.indexOf('YOUR-PROJECT') === -1;
  var sb = (CONFIGURED && window.supabase)
    ? window.supabase.createClient(window.BARHAM_SUPABASE_URL, window.BARHAM_SUPABASE_ANON_KEY) : null;

  var qFac = new URLSearchParams(location.search).get('facility');
  var currentFacility = (qFac && FAC[qFac]) ? qFac
    : (mount.dataset.facility && FAC[mount.dataset.facility] ? mount.dataset.facility : KEYS[0]);
  var view = new Date(); view.setDate(1); view.setHours(0,0,0,0);
  var taken = [];                 // [{check_in, check_out}]
  var selIn = null, selOut = null;
  var session = null, profile = null;

  // ---- helpers ----
  function iso(d){var x=new Date(d);return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2);} // local date (no UTC shift)
  function addDays(s,n){var x=new Date(s+'T00:00:00');x.setDate(x.getDate()+n);return iso(x);}
  function nightsBetween(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);}
  function money(n){return '£'+Number(n).toLocaleString('en-GB');}
  var TODAY = iso(new Date());
  function nightTaken(dateStr){return taken.some(function(b){return dateStr>=b.check_in && dateStr<b.check_out;});}
  function rangeClear(a,b){for(var d=a;d<b;d=addDays(d,1)){if(nightTaken(d))return false;}return true;}
  function fmt(s){return new Date(s+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}

  function quote(key, ci, co){
    var nights = nightsBetween(ci, co);
    if (window.BARHAM && window.BARHAM_WATERS && window.BARHAM_WATERS[key]) {
      var w = window.BARHAM_WATERS[key];
      var q = window.BARHAM.quote(key, ci, co, w.includedAnglers);
      return { nights: q.nights, price: q.price, deposit: q.deposit, season: q.seasonLabel };
    }
    var price = FAC[key].nightly * nights;
    var pct = window.BARHAM_DEPOSIT_PCT || 0.30;
    return { nights: nights, price: price, deposit: Math.round(price*pct), season: null };
  }

  // ---- styles ----
  if (!document.getElementById('barham-cal-css')) {
    var css=document.createElement('style');css.id='barham-cal-css';
    css.textContent=[
      '.bc{--g:#1f6f54;--gd:#164f3d;--ink:#1b1d18;--mute:#6b6d63;--line:#e3e0d6;--cream:#f6f3ea;font-family:"Segoe UI",system-ui,Arial,sans-serif;color:var(--ink);}',
      '.bc-wrap{display:grid;grid-template-columns:1fr 320px;gap:24px;align-items:start;}',
      '.bc-cal{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px 20px 22px;}',
      '.bc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}',
      '.bc-tab{background:#fff;border:1px solid var(--line);border-radius:30px;padding:8px 16px;cursor:pointer;font:inherit;font-size:13.5px;font-weight:600;color:var(--ink);}',
      '.bc-tab.active{background:var(--g);color:#fff;border-color:var(--g);}',
      '.bc-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}',
      '.bc-bar h3{font-size:18px;margin:0;}',
      '.bc-bar button{background:var(--cream);border:1px solid var(--line);border-radius:6px;width:34px;height:34px;font-size:16px;cursor:pointer;}',
      '.bc-dow,.bc-days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;}',
      '.bc-dow div{text-align:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mute);font-weight:700;padding:4px 0;}',
      '.bc-day{aspect-ratio:1/1;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:600;background:#fff;cursor:pointer;transition:.12s;}',
      '.bc-day.empty{border:0;cursor:default;}',
      '.bc-day.past{color:#c7c7bd;background:#faf9f4;cursor:not-allowed;}',
      '.bc-day.un{background:#f3ded9;color:#b06a5e;cursor:not-allowed;text-decoration:line-through;}',
      '.bc-day.av:hover{border-color:var(--g);background:#eef5f1;}',
      '.bc-day.in,.bc-day.out{background:var(--g);color:#fff;border-color:var(--g);}',
      '.bc-day.mid{background:#dbeee4;border-color:#bcdfcd;}',
      '.bc-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:14px;font-size:12px;color:var(--mute);}',
      '.bc-legend i{width:12px;height:12px;border-radius:3px;display:inline-block;border:1px solid var(--line);vertical-align:middle;margin-right:5px;}',
      '.bc-side{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px;position:sticky;top:16px;}',
      '.bc-side h4{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--g);margin:0 0 12px;}',
      '.bc-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--line);font-size:14px;}.bc-row .v{font-weight:700;}',
      '.bc-big{display:flex;justify-content:space-between;align-items:baseline;margin:12px 0 4px;}.bc-big .amt{font-size:26px;font-weight:800;color:var(--g);}',
      '.bc-dep{font-size:12.5px;color:var(--mute);margin-bottom:8px;}',
      '.bc label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mute);margin:10px 0 4px;}',
      '.bc input,.bc textarea{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit;}',
      '.bc-go{display:block;width:100%;text-align:center;background:var(--g);color:#fff;border:0;border-radius:6px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:14px;text-decoration:none;}',
      '.bc-go:hover{background:var(--gd);}.bc-go[disabled]{background:#c3c9c1;cursor:not-allowed;}',
      '.bc-auth{background:var(--cream);border:1px dashed var(--line);border-radius:8px;padding:14px;text-align:center;font-size:13px;color:var(--mute);}',
      '.bc-note{font-size:11.5px;color:var(--mute);margin-top:10px;line-height:1.5;}',
      '.bc-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:12px 20px;border-radius:8px;opacity:0;pointer-events:none;transition:.25s;z-index:90;font-size:14px;}',
      '.bc-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}.bc-toast.success{background:var(--g);}.bc-toast.error{background:#b3392b;}',
      '@media(max-width:820px){.bc-wrap{grid-template-columns:1fr;}.bc-side{position:static;}}'
    ].join('');
    document.head.appendChild(css);
  }

  mount.classList.add('bc');
  mount.innerHTML =
    '<div class="bc-tabs" id="bc-tabs"></div>' +
    '<div class="bc-wrap">' +
      '<div class="bc-cal">' +
        '<div class="bc-bar"><h3 id="bc-month">—</h3><div><button id="bc-prev">‹</button> <button id="bc-next">›</button></div></div>' +
        '<div class="bc-dow" id="bc-dow"></div>' +
        '<div class="bc-days" id="bc-days" style="margin-top:6px;"></div>' +
        '<div class="bc-legend"><span><i style="background:#fff"></i>Available</span><span><i style="background:#1f6f54;border-color:#1f6f54"></i>Your dates</span><span><i style="background:#f3ded9;border-color:#e6c4bc"></i>Taken</span><span><i style="background:#faf9f4"></i>Past</span></div>' +
      '</div>' +
      '<div class="bc-side">' +
        '<h4>Your stay</h4>' +
        '<div class="bc-row"><span>Water</span><span class="v" id="bc-water">—</span></div>' +
        '<div class="bc-row"><span>Arrive</span><span class="v" id="bc-in">—</span></div>' +
        '<div class="bc-row"><span>Depart</span><span class="v" id="bc-out">—</span></div>' +
        '<div class="bc-row"><span>Nights</span><span class="v" id="bc-nights">—</span></div>' +
        '<div class="bc-row" id="bc-seasonrow" style="display:none;"><span>Season</span><span class="v" id="bc-season">—</span></div>' +
        '<div class="bc-big"><span>Total</span><span class="amt" id="bc-price">—</span></div>' +
        '<div class="bc-dep" id="bc-dep">Select arrival &amp; departure to see pricing.</div>' +
        '<div id="bc-auth" class="bc-auth" style="display:none;">Sign in to book — it keeps all your stays in one place.<br><br><a class="bc-go" style="display:inline-block" href="account.html">Sign in / Create account →</a></div>' +
        '<form id="bc-form" style="display:none;">' +
          '<label>Name</label><input id="bc-name" required placeholder="Your name">' +
          '<label>Email</label><input id="bc-email" type="email" required placeholder="you@example.com">' +
          '<label>Phone</label><input id="bc-phone" placeholder="07xxx xxxxxx">' +
          '<label>Notes</label><textarea id="bc-notes" rows="2" placeholder="e.g. number of anglers"></textarea>' +
          '<button class="bc-go" id="bc-submit" type="submit" disabled>Request these dates →</button>' +
          '<p class="bc-note">A booking request — confirmed by email. A 30% deposit secures your dates once payment is enabled.</p>' +
        '</form>' +
      '</div>' +
    '</div>' +
    '<div class="bc-toast" id="bc-toast">—</div>';

  var $=function(id){return document.getElementById(id);};
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(function(d){var e=document.createElement('div');e.textContent=d;$('bc-dow').appendChild(e);});

  // ---- data ----
  function loadAvailability(){
    if(!sb){taken=[];render();updateSummary();return;}
    var from=iso(new Date(view.getFullYear(),view.getMonth()-1,1));
    var to=iso(new Date(view.getFullYear(),view.getMonth()+2,1));
    sb.from('public_bookings').select('*').eq('water',currentFacility).lt('check_in',to).gt('check_out',from)
      .then(function(r){taken=r.error?[]:(r.data||[]);render();updateSummary();})
      .catch(function(){taken=[];render();updateSummary();});
  }
  function initAuth(){
    if(!sb){$('bc-auth').style.display='none';$('bc-form').style.display='block';loadAvailability();return;}
    sb.auth.getSession().then(function(r){session=r.data.session;
      if(session){$('bc-auth').style.display='none';$('bc-form').style.display='block';
        return sb.from('profiles').select('*').eq('id',session.user.id).single().then(function(p){profile=p.data;
          if(profile){$('bc-name').value=profile.full_name||'';$('bc-phone').value=profile.phone||'';}
          $('bc-email').value=session.user.email;});
      } else {$('bc-auth').style.display='block';$('bc-form').style.display='none';}
    }).then(loadAvailability).catch(loadAvailability);
  }

  // ---- render ----
  function renderTabs(){
    var t=$('bc-tabs');t.innerHTML='';
    KEYS.forEach(function(k){var b=document.createElement('button');b.className='bc-tab'+(k===currentFacility?' active':'');b.textContent=FAC[k].name;
      b.onclick=function(){currentFacility=k;selIn=selOut=null;[].forEach.call(t.children,function(x){x.classList.remove('active');});b.classList.add('active');loadAvailability();};t.appendChild(b);});
  }
  function render(){
    $('bc-month').textContent=view.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    var days=$('bc-days');days.innerHTML='';
    var start=(new Date(view).getDay()+6)%7;
    for(var i=0;i<start;i++){var e=document.createElement('div');e.className='bc-day empty';days.appendChild(e);}
    var dim=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
    for(var d=1;d<=dim;d++){(function(d){
      var dateStr=iso(new Date(view.getFullYear(),view.getMonth(),d));
      var cell=document.createElement('div');cell.className='bc-day';cell.textContent=d;
      if(dateStr<TODAY){cell.className+=' past';}
      else if(nightTaken(dateStr)&&dateStr!==selOut){cell.className+=' un';}
      else{cell.className+=' av';cell.addEventListener('click',function(){pick(dateStr);});}
      if(selIn&&dateStr===selIn)cell.className+=' in';
      if(selOut&&dateStr===selOut)cell.className+=' out';
      if(selIn&&selOut&&dateStr>selIn&&dateStr<selOut)cell.className+=' mid';
      days.appendChild(cell);
    })(d);}
  }
  function pick(dateStr){
    if(!selIn||selOut){selIn=dateStr;selOut=null;}
    else if(dateStr>selIn){
      if(!rangeClear(selIn,dateStr)){selIn=dateStr;selOut=null;toast('There’s a taken night in between — arrival moved here. Now pick your departure.','');}
      else {selOut=dateStr;}
    } else {selIn=dateStr;selOut=null;}
    render();updateSummary();
  }
  function updateSummary(){
    $('bc-water').textContent=FAC[currentFacility].name;
    $('bc-in').textContent=selIn?fmt(selIn):'—';
    $('bc-out').textContent=selOut?fmt(selOut):'—';
    var min=FAC[currentFacility].minNights||1;
    if(selIn&&selOut){
      var q=quote(currentFacility,selIn,selOut);
      $('bc-nights').textContent=q.nights;
      if(q.season){$('bc-seasonrow').style.display='flex';$('bc-season').textContent=q.season;}else{$('bc-seasonrow').style.display='none';}
      $('bc-price').textContent=money(q.price);
      if(q.nights<min){$('bc-dep').textContent='Minimum stay is '+min+' night'+(min>1?'s':'')+'.';setOk(false);}
      else{$('bc-dep').textContent='Deposit '+money(q.deposit)+' · balance '+money(q.price-q.deposit)+' before arrival.';setOk(true);}
      window._q=q;
    } else {
      $('bc-nights').textContent='—';$('bc-seasonrow').style.display='none';$('bc-price').textContent='—';
      $('bc-dep').textContent='Select arrival & departure to see pricing.';setOk(false);
    }
  }
  function setOk(ok){var b=$('bc-submit');if(b)b.disabled=!ok;}

  $('bc-form').addEventListener('submit',function(e){
    e.preventDefault();if(!selIn||!selOut||!window._q)return;
    if(!rangeClear(selIn,selOut)){toast('Those dates were just taken — please pick again.','error');loadAvailability();return;}
    var fac=FAC[currentFacility],q=window._q,btn=$('bc-submit');btn.disabled=true;btn.textContent='Sending…';
    var name=$('bc-name').value.trim(),email=$('bc-email').value.trim(),phone=$('bc-phone').value.trim(),notes=$('bc-notes').value.trim();
    try{fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({'form-name':'booking-request',water:fac.name,check_in:selIn,check_out:selOut,
        nights:q.nights,anglers:'',price:'£'+q.price,deposit:'£'+q.deposit,name:name,email:email,phone:phone,notes:notes}).toString()});}catch(_){}
    if(sb&&session){
      sb.from('bookings').insert({water:currentFacility,check_in:selIn,check_out:selOut,nights:q.nights,
        season:(q.season||'').toLowerCase(),price:q.price,deposit:q.deposit,status:'pending',payment_status:'unpaid',
        user_id:session.user.id,name:name,email:session.user.email,phone:phone,notes:notes}).then(function(r){
        btn.disabled=false;btn.textContent='Request these dates →';
        if(r.error){toast('Could not send: '+r.error.message,'error');return;}
        selIn=selOut=null;render();updateSummary();toast('Request sent — we’ll confirm by email.','success');loadAvailability();
      });
    } else {
      setTimeout(function(){btn.disabled=false;btn.textContent='Request these dates →';
        selIn=selOut=null;render();updateSummary();toast('Request captured — connect Supabase to store it live.','success');},500);
    }
  });

  function toast(m,k){var t=$('bc-toast');t.textContent=m;t.className='bc-toast show '+(k||'');setTimeout(function(){t.classList.remove('show');},3400);}
  $('bc-prev').onclick=function(){view.setMonth(view.getMonth()-1);loadAvailability();};
  $('bc-next').onclick=function(){view.setMonth(view.getMonth()+1);loadAvailability();};

  renderTabs();
  render();
  initAuth();
})();
