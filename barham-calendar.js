/* =====================================================================
   The Barham Lakes — weekly booking calendar
   Same pattern as the Needham Market FC site: a week grid of hourly
   slots per facility, click an empty slot to request a booking.
   Drop-in: put <div id="barham-cal" data-facility="brook-pool"></div>
   on a page, then load booking-config.js, supabase-js and this file.
   Works in "demo mode" until Supabase keys are set in booking-config.js.
   ===================================================================== */
(function () {
  var mount = document.getElementById('barham-cal');
  if (!mount) return;
  var FAC = window.BARHAM_CAL_FACILITIES || {};
  var KEYS = Object.keys(FAC);
  if (!KEYS.length) { mount.innerHTML = '<p>No bookable waters configured.</p>'; return; }

  // ---- Supabase (optional until keys are added) ----
  var CONFIGURED = window.BARHAM_SUPABASE_URL && window.BARHAM_SUPABASE_URL.indexOf('YOUR-PROJECT') === -1;
  var sb = (CONFIGURED && window.supabase)
    ? window.supabase.createClient(window.BARHAM_SUPABASE_URL, window.BARHAM_SUPABASE_ANON_KEY) : null;

  // ---- state ----
  var qFac = new URLSearchParams(location.search).get('facility');
  var currentFacility = (qFac && FAC[qFac]) ? qFac : (mount.dataset.facility && FAC[mount.dataset.facility] ? mount.dataset.facility : KEYS[0]);
  var currentWeekStart = startOfWeek(new Date());
  var bookings = [];        // confirmed slots (no personal data)
  var session = null, profile = null, pendingSlot = null;

  // ---- inject styles once ----
  if (!document.getElementById('barham-cal-css')) {
    var css = document.createElement('style'); css.id = 'barham-cal-css';
    css.textContent = [
      '.bc{--g:#1f6f54;--gd:#164f3d;--ink:#1b1d18;--mute:#6b6d63;--line:#e3e0d6;--cream:#f6f3ea;font-family:"Segoe UI",system-ui,Arial,sans-serif;color:var(--ink);}',
      '.bc-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}',
      '.bc-tab{background:#fff;border:1px solid var(--line);border-radius:30px;padding:8px 18px;cursor:pointer;font:inherit;font-size:14px;font-weight:600;color:var(--ink);}',
      '.bc-tab.active{background:var(--g);color:#fff;border-color:var(--g);}',
      '.bc-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}',
      '.bc-bar h3{font-size:18px;margin:0;}',
      '.bc-nav button{background:var(--cream);border:1px solid var(--line);border-radius:6px;padding:7px 12px;cursor:pointer;font:inherit;font-weight:600;margin-left:6px;}',
      '.bc-grid{display:grid;grid-template-columns:64px repeat(7,1fr);gap:5px;}',
      '.bc-cell{background:#fff;border:1px solid var(--line);border-radius:6px;min-height:40px;display:flex;align-items:center;justify-content:center;font-size:13px;}',
      '.bc-head{background:transparent;border:0;font-weight:700;flex-direction:column;font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.04em;}',
      '.bc-head.today{color:var(--g);}',
      '.bc-head .d{font-size:17px;color:var(--ink);}',
      '.bc-time{background:transparent;border:0;color:var(--mute);font-size:12px;justify-content:flex-end;padding-right:6px;}',
      '.bc-slot{cursor:pointer;transition:.12s;}',
      '.bc-slot:hover{border-color:var(--g);background:#eef5f1;}',
      '.bc-slot.booked{background:#e0f0e7;border-color:#bcdfcd;color:var(--gd);cursor:not-allowed;font-weight:600;}',
      '.bc-slot.cont{color:transparent;}',
      '.bc-slot.past{background:#faf9f4;color:#c7c7bd;cursor:not-allowed;}',
      '.bc-legend{display:flex;gap:16px;margin-top:14px;font-size:12px;color:var(--mute);flex-wrap:wrap;}',
      '.bc-legend i{width:12px;height:12px;border-radius:3px;display:inline-block;border:1px solid var(--line);vertical-align:middle;margin-right:5px;}',
      '.bc-back{position:fixed;inset:0;background:rgba(20,22,16,.55);display:none;align-items:center;justify-content:center;padding:18px;z-index:80;}',
      '.bc-back.open{display:flex;}',
      '.bc-modal{background:#fff;border-radius:12px;max-width:460px;width:100%;padding:24px;max-height:92vh;overflow:auto;}',
      '.bc-modal h3{margin:0 0 2px;font-size:20px;}.bc-when{color:var(--mute);font-size:14px;margin-bottom:14px;}',
      '.bc-sum{display:flex;justify-content:space-between;background:var(--cream);border-radius:8px;padding:12px 14px;margin-bottom:14px;}',
      '.bc-sum .l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--mute);}.bc-sum .v{font-weight:700;font-size:16px;}',
      '.bc label{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--mute);margin:10px 0 4px;}',
      '.bc input,.bc select,.bc textarea{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:6px;font:inherit;}',
      '.bc-submit{display:block;width:100%;text-align:center;background:var(--g);color:#fff;border:0;border-radius:6px;padding:12px;font-size:15px;font-weight:700;cursor:pointer;margin-top:16px;text-decoration:none;}',
      '.bc-submit:hover{background:var(--gd);}',
      '.bc-close{float:right;background:none;border:0;font-size:20px;cursor:pointer;color:var(--mute);}',
      '.bc-note{font-size:12px;color:var(--mute);margin-top:10px;line-height:1.5;}',
      '.bc-auth{background:var(--cream);border:1px dashed var(--line);border-radius:8px;padding:16px;text-align:center;font-size:13.5px;color:var(--mute);}',
      '.bc-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:12px 20px;border-radius:8px;opacity:0;pointer-events:none;transition:.25s;z-index:90;font-size:14px;}',
      '.bc-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}.bc-toast.success{background:var(--g);}.bc-toast.error{background:#b3392b;}',
      '@media(max-width:640px){.bc-grid{grid-template-columns:44px repeat(7,1fr);}.bc-cell{min-height:34px;font-size:11px;}}'
    ].join('');
    document.head.appendChild(css);
  }

  // ---- build UI ----
  mount.classList.add('bc');
  mount.innerHTML =
    '<div class="bc-tabs" id="bc-tabs"></div>' +
    '<div class="bc-bar"><h3 id="bc-week">—</h3><div class="bc-nav">' +
      '<button id="bc-today">Today</button><button id="bc-prev">‹</button><button id="bc-next">›</button></div></div>' +
    '<div class="bc-grid" id="bc-grid"></div>' +
    '<div class="bc-legend"><span><i style="background:#fff"></i>Available</span>' +
      '<span><i style="background:#e0f0e7;border-color:#bcdfcd"></i>Booked</span>' +
      '<span><i style="background:#faf9f4"></i>Past</span></div>' +
    '<div class="bc-back" id="bc-back"><div class="bc-modal">' +
      '<button class="bc-close" id="bc-x">✕</button>' +
      '<h3 id="bc-fac">—</h3><div class="bc-when" id="bc-whn">—</div>' +
      '<div class="bc-sum"><div><div class="l">Estimated cost</div><div class="v" id="bc-cost">£0</div></div>' +
        '<div style="text-align:right"><div class="l">Duration</div><div class="v" id="bc-dur">1 hour</div></div></div>' +
      '<div id="bc-authbox" class="bc-auth" style="display:none">You’ll need a free account to request a booking.<br><br>' +
        '<a class="bc-submit" style="display:inline-block" href="account.html">Sign in / Create account →</a></div>' +
      '<form id="bc-form">' +
        '<label>Duration</label><select id="bc-fdur"><option value="1">1 hour</option><option value="2">2 hours</option><option value="3">3 hours</option><option value="4">4 hours</option><option value="12">Day (12h)</option><option value="24">24 hours</option></select>' +
        '<label>Your name</label><input id="bc-name" required placeholder="e.g. James Palmer">' +
        '<label>Email</label><input id="bc-email" type="email" required placeholder="you@example.com">' +
        '<label>Phone</label><input id="bc-phone" placeholder="07xxx xxxxxx">' +
        '<label>Notes</label><textarea id="bc-notes" rows="2" placeholder="e.g. two anglers, night session"></textarea>' +
        '<button type="submit" class="bc-submit" id="bc-go">Send booking request →</button>' +
        '<p class="bc-note">A booking request — the club confirms availability by email. Prices are indicative and confirmed on booking.</p>' +
      '</form></div></div>' +
    '<div class="bc-toast" id="bc-toast">—</div>';

  var $ = function (id) { return document.getElementById(id); };

  // ---- helpers (ported from the FC site) ----
  function startOfWeek(d){var x=new Date(d);var day=x.getDay();var diff=x.getDate()-day+(day===0?-6:1);x.setHours(0,0,0,0);x.setDate(diff);return x;}
  function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function fmtDate(d){return d.toISOString().slice(0,10);}
  function fmtRange(a,b){var f=function(x){return x.toLocaleDateString('en-GB',{day:'numeric',month:'short'});};return f(a)+' – '+f(b);}
  function isSameDay(a,b){return fmtDate(a)===fmtDate(b);}
  function isPast(date,hour){var d=new Date(date);d.setHours(hour,0,0,0);return d<new Date();}
  function money(n){return '£'+Number(n).toLocaleString('en-GB');}

  // ---- data ----
  function fetchConfirmed(){
    if(!sb){bookings=[];renderCalendar();return;}
    var from=fmtDate(currentWeekStart),to=fmtDate(addDays(currentWeekStart,7));
    sb.from('public_bookings').select('*').eq('water',currentFacility).gte('date',from).lt('date',to)
      .then(function(r){bookings=r.error?[]:(r.data||[]).map(function(b){return {facility:b.water,date:b.date,hour:b.start_hour,duration:b.duration};});renderCalendar();})
      .catch(function(){bookings=[];renderCalendar();});
  }
  function initAuth(){
    if(!sb){renderCalendar();return;}
    sb.auth.getSession().then(function(r){session=r.data.session;
      if(session){return sb.from('profiles').select('*').eq('id',session.user.id).single().then(function(p){profile=p.data;});}
    }).then(fetchConfirmed).catch(fetchConfirmed);
  }

  // ---- render ----
  function renderTabs(){
    var t=$('bc-tabs');t.innerHTML='';
    KEYS.forEach(function(k){var b=document.createElement('button');b.className='bc-tab'+(k===currentFacility?' active':'');b.textContent=FAC[k].name;
      b.onclick=function(){currentFacility=k;[].forEach.call(t.children,function(x){x.classList.remove('active');});b.classList.add('active');fetchConfirmed();};t.appendChild(b);});
  }
  function renderWeek(){$('bc-week').textContent=fmtRange(currentWeekStart,addDays(currentWeekStart,6))+' · '+currentWeekStart.getFullYear();}
  function renderCalendar(){
    renderWeek();
    var fac=FAC[currentFacility],grid=$('bc-grid');grid.innerHTML='';
    var th=document.createElement('div');th.className='bc-cell bc-time bc-head';th.textContent='Time';grid.appendChild(th);
    var today=new Date();today.setHours(0,0,0,0);
    for(var i=0;i<7;i++){var d=addDays(currentWeekStart,i);var h=document.createElement('div');h.className='bc-cell bc-head'+(isSameDay(d,today)?' today':'');
      h.innerHTML='<span>'+d.toLocaleDateString('en-GB',{weekday:'short'})+'</span><span class="d">'+d.getDate()+'</span>';grid.appendChild(h);}
    for(var hr=fac.open;hr<fac.close;hr++){
      var tc=document.createElement('div');tc.className='bc-cell bc-time';tc.textContent=(hr<10?'0':'')+hr+':00';grid.appendChild(tc);
      for(var j=0;j<7;j++){(function(hr,j){
        var d=addDays(currentWeekStart,j),dateStr=fmtDate(d);
        var cell=document.createElement('div');cell.className='bc-cell';
        var cover=bookings.find(function(b){return b.facility===currentFacility&&b.date===dateStr&&hr>=b.hour&&hr<b.hour+b.duration;});
        if(cover){cell.className+=' bc-slot booked'+(hr!==cover.hour?' cont':'');cell.textContent=hr===cover.hour?'Booked':'·';}
        else if(isPast(d,hr)){cell.className+=' past';}
        else{cell.className+=' bc-slot';cell.addEventListener('click',function(){openModal(dateStr,hr);});}
        grid.appendChild(cell);
      })(hr,j);}
    }
  }

  // ---- modal ----
  function openModal(date,hour){
    pendingSlot={date:date,hour:hour};var fac=FAC[currentFacility];
    $('bc-fac').textContent=fac.name;
    var d=new Date(date);$('bc-whn').textContent=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})+' · '+(hour<10?'0':'')+hour+':00';
    var authNeeded = sb && !session;
    $('bc-authbox').style.display=authNeeded?'block':'none';
    $('bc-form').style.display=authNeeded?'none':'block';
    if(!authNeeded){
      $('bc-form').reset();$('bc-fdur').value='1';
      if(session){$('bc-email').value=session.user.email;}
      if(profile){$('bc-name').value=profile.full_name||'';$('bc-phone').value=profile.phone||'';}
      updateCost();
    }
    $('bc-back').classList.add('open');
  }
  function updateCost(){
    var fac=FAC[currentFacility],dur=parseInt($('bc-fdur').value,10);
    $('bc-dur').textContent=dur+' hour'+(dur>1?'s':'');
    $('bc-cost').textContent=fac.unit==='hour'?money(fac.rate*dur):money(fac.rate);
  }
  $('bc-fdur').addEventListener('change',updateCost);
  function closeModal(){$('bc-back').classList.remove('open');pendingSlot=null;}
  $('bc-x').onclick=closeModal;
  $('bc-back').addEventListener('click',function(e){if(e.target===$('bc-back'))closeModal();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});

  $('bc-form').addEventListener('submit',function(e){
    e.preventDefault();if(!pendingSlot)return;
    var fac=FAC[currentFacility],dur=parseInt($('bc-fdur').value,10);
    for(var h=pendingSlot.hour;h<pendingSlot.hour+dur;h++){
      var clash=bookings.find(function(b){return b.facility===currentFacility&&b.date===pendingSlot.date&&h>=b.hour&&h<b.hour+b.duration;});
      if(clash||h>=fac.close){toast('That duration overlaps a booked slot — try shorter.','error');return;}
    }
    var btn=$('bc-go');btn.disabled=true;btn.textContent='Sending…';
    var req={water:currentFacility,date:pendingSlot.date,start_hour:pendingSlot.hour,duration:dur,status:'pending',
      name:$('bc-name').value.trim(),email:$('bc-email').value.trim(),phone:$('bc-phone').value.trim(),notes:$('bc-notes').value.trim()};
    // notify owner via Netlify Forms (best-effort)
    try{fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({'form-name':'booking-request',water:fac.name,check_in:req.date,check_out:req.date,
        nights:'session',anglers:'',price:$('bc-cost').textContent,deposit:'',name:req.name,email:req.email,phone:req.phone,notes:req.notes}).toString()});}catch(_){}
    if(sb && session){
      sb.from('bookings').insert({water:currentFacility,date:req.date,start_hour:req.start_hour,duration:dur,status:'pending',
        user_id:session.user.id,name:req.name,email:session.user.email,phone:req.phone,notes:req.notes}).then(function(r){
        btn.disabled=false;btn.textContent='Send booking request →';
        if(r.error){toast('Could not send: '+r.error.message,'error');return;}
        closeModal();toast('Request sent — we’ll confirm by email.','success');fetchConfirmed();
      });
    } else {
      // demo mode (Supabase not connected yet)
      setTimeout(function(){btn.disabled=false;btn.textContent='Send booking request →';closeModal();
        toast('Request captured — connect Supabase to store it live.','success');},500);
    }
  });

  function toast(m,k){var t=$('bc-toast');t.textContent=m;t.className='bc-toast show '+(k||'');setTimeout(function(){t.classList.remove('show');},3400);}

  $('bc-prev').onclick=function(){currentWeekStart=addDays(currentWeekStart,-7);fetchConfirmed();};
  $('bc-next').onclick=function(){currentWeekStart=addDays(currentWeekStart,7);fetchConfirmed();};
  $('bc-today').onclick=function(){currentWeekStart=startOfWeek(new Date());fetchConfirmed();};

  renderTabs();
  initAuth();
})();
