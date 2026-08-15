/* ═══════════════════════════════════════════════════════════════
   MARKETING OS · KITACHI
   Bảng vận hành phòng marketing — 5 vị trí, nhiều dự án, nhiều kênh
   ═══════════════════════════════════════════════════════════════ */

const CONFIGURED = CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('xxxx')
  && CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_ANON_KEY.includes('dán');
let DEMO_MODE = !CONFIGURED;


/* ─── Chế độ xem thử: dịch mọi mốc thời gian theo ngày mở app ───
   Dữ liệu mẫu neo vào 14/08/2026. Nếu hôm nay khác, dịch toàn bộ để
   người xem luôn thấy lịch quanh ngày hiện tại thay vì một mốc đã cũ. */
function shiftDemoDates(D){
  const ANCHOR=new Date('2026-08-14T00:00:00');
  const today=new Date(new Date().toDateString());
  const off=Math.round((today-ANCHOR)/864e5);
  if(!off) return D;
  const mv=v=>{ if(!v||typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d=new Date(v+'T00:00:00'); d.setDate(d.getDate()+off);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const F=['due','date','start','end','at','pub_date','design_due','design_done','design_started',
    'handoff_at','offer_end'];
  Object.values(D).forEach(list=>{ if(!Array.isArray(list)) return;
    list.forEach(x=>{ if(x&&typeof x==='object') F.forEach(f=>{ if(f in x) x[f]=mv(x[f]); }); });});
  if(D.settings) D.settings.forEach(s=>{ if(s.key==='opening_date') s.value=mv(s.value); });
  return D;
}

function demoClient(){
  const S = shiftDemoDates(JSON.parse(JSON.stringify(DEMO)));
  S.activity = [];
  const wrap = v => Promise.resolve({ data: v, error: null });
  const sortBy = (a, col) => {
    const x = [...a];
    if (col === 'sort_order') x.sort((p,q)=>(p.sort_order||0)-(q.sort_order||0));
    if (['pub_date','due','date','at','start'].includes(col))
      x.sort((p,q)=>((p[col]||'9999')<(q[col]||'9999')?-1:1));
    if (col === 'at') x.reverse();
    return x;
  };
  const query = rows => { const p = wrap(rows);
    p.order = c => query(sortBy(rows,c)); p.limit = n => wrap(rows.slice(0,n));
    p.eq = () => wrap(rows); return p; };
  return { from(tbl){ return {
    select(){ return query([...(S[tbl]||[])]); },
    update(v){ return { eq(col, id){
      const list = S[tbl]||[];
      const r = (col==='key')? list.find(x=>x.key===id) : list.find(x=>x.id===id);
      if (r){
        if (v.status && v.status!==r.status)
          S.activity.unshift({id:S.activity.length+1,kind:tbl,item:r.title||r.name,
            actor:v.updated_by,from_status:r.status,to_status:v.status,at:new Date().toISOString()});
        Object.assign(r,v);
      }
      return wrap(null); }};},
    insert(v){ const list=S[tbl]||(S[tbl]=[]); v.id=Math.max(0,...list.map(x=>x.id||0))+1;
      list.push(v); return wrap(null); },
    delete(){ return { eq(_, id){ const l=S[tbl]||[]; const i=l.findIndex(x=>x.id===id);
      if(i>=0) l.splice(i,1); return wrap(null); }};}
  };}};
}

let sb = CONFIGURED ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : demoClient();

/* ─── Quy trình sản xuất nội dung: mỗi chặng gắn với một vai ─── */
const FLOW = [
  {s:'Đang viết',          ic:'✏️', hold:'writer', cls:'s-gray',  hint:'Người viết lên ý tưởng và soạn nội dung'},
  {s:'Chờ duyệt nội dung', ic:'📌', hold:'leader', cls:'s-amber', hint:'Leader duyệt nội dung'},
  {s:'Cần chỉnh sửa',      ic:'✂️', hold:'writer', cls:'s-red',   hint:'Leader trả lại, người viết sửa'},
  {s:'Đang thiết kế',      ic:'🎨', hold:'design', cls:'s-pink',  hint:'Designer hoặc Editor đang làm ấn phẩm'},
  {s:'Chờ duyệt ấn phẩm',  ic:'👀', hold:'leader', cls:'s-blue',  hint:'Leader duyệt ấn phẩm, xong là đăng được'},
  {s:'Đã đăng',            ic:'✅', hold:null,     cls:'s-green', hint:'Xong'},
  {s:'Huỷ bỏ',             ic:'❌', hold:null,     cls:'s-gray',  hint:'Không làm nữa'},
];
/* Tên chặng cũ vẫn đọc được, tự quy về chặng mới */
const FLOW_ALIAS={'Lên ý tưởng':'Đang viết','Đang soạn thảo':'Đang viết',
  'Chờ phê duyệt':'Chờ duyệt nội dung','Đã phê duyệt':'Đang thiết kế',
  'Chờ duyệt thiết kế':'Chờ duyệt ấn phẩm','Đã lên lịch':'Chờ duyệt ấn phẩm'};
const norm = st => FLOW_ALIAS[st] || st;
const F = s => FLOW.find(f=>f.s===norm(s)) || FLOW[0];
const DONE = ['Đã đăng','Huỷ bỏ'];

/* ─── Trạng thái đầu việc ─── */
const TST = [
  {s:'Chưa bắt đầu', cls:'s-gray'},  {s:'Đang làm',   cls:'s-blue'},
  {s:'Chờ duyệt',    cls:'s-amber'}, {s:'Hoàn thành', cls:'s-green'},
  {s:'Tạm hoãn',     cls:'s-red'},   {s:'Không áp dụng', cls:'s-gray'},
];
const TMAP = {'Chưa bắt đầu':'Chưa bắt đầu','Đang làm':'Đang làm','Chờ duyệt':'Chờ duyệt',
  'Chờ phê duyệt':'Chờ duyệt','Hoàn thành':'Hoàn thành','Đã xong':'Hoàn thành','Đã đăng':'Hoàn thành',
  'Đã bàn giao':'Hoàn thành','Đã thanh toán':'Hoàn thành','Đã đăng bài':'Hoàn thành',
  'Đã kết thúc':'Hoàn thành','Không áp dụng':'Không áp dụng','Từ chối':'Không áp dụng',
  'Tạm hoãn':'Tạm hoãn'};
const tgrp = t => TMAP[t.status] || 'Đang làm';
const tcls = t => (TST.find(x=>x.s===tgrp(t))||TST[0]).cls;
const PRI = {'Cao':'s-red','Trung bình':'s-blue','Thấp':'s-amber'};

/* ═══════════════════════════════════════════════════════════════
   CẤU HÌNH NỀN TẢNG — mỗi nền tảng có bộ trường riêng
   ═══════════════════════════════════════════════════════════════ */
const PLAT = {
  'TikTok': {
    ic:'i-video', color:'#111827', stream:'tiktok',
    fmts:['Video ngắn 15-30s','Video 30-60s','Video dài 1-3 phút','Livestream','Ảnh ghép'],
    goals:['Nhận biết','Tăng follow','Kéo về quán','Bán hàng','Giữ chân'],
    fields:[
      {k:'hook',      l:'Hook — 3 giây đầu',      t:'text', ph:'Câu mở đầu giữ chân người xem', req:true},
      {k:'script',    l:'Kịch bản quay',          t:'area', ph:'Cảnh 1… Cảnh 2… Cảnh cuối kêu gọi'},
      {k:'duration',  l:'Thời lượng',             t:'sel',  o:['15s','30s','45s','60s','1-3 phút']},
      {k:'sound',     l:'Nhạc / trend đang dùng', t:'text', ph:'Tên bài hoặc link sound'},
      {k:'props',     l:'Đạo cụ & bối cảnh',      t:'text', ph:'Quay ở đâu, cần chuẩn bị gì'},
      {k:'hashtag',   l:'Hashtag',                t:'text', ph:'#micayquangngai #kitachi'},
    ],
    needEditor:true, editorLabel:'Người quay dựng',
  },
  'Facebook': {
    ic:'i-share', color:'#1877F2', stream:'social',
    fmts:['Ảnh đơn','Album ảnh','Video','Bài viết dài','Story','Reels'],
    goals:['Nhận biết','Tương tác','Kéo về quán','Bán hàng','Chăm sóc khách'],
    fields:[
      {k:'caption',   l:'Caption đăng bài',       t:'area', ph:'Nội dung bài đăng hoàn chỉnh', req:true},
      {k:'cta',       l:'Kêu gọi hành động',      t:'sel',  o:['Inbox đặt bàn','Gọi hotline','Xem menu','Ghé quán','Chia sẻ bài','Không có']},
      {k:'img_count', l:'Số ảnh cần thiết kế',    t:'num',  ph:'1'},
      {k:'hashtag',   l:'Hashtag',                t:'text', ph:'#micaykitachi #quangngai'},
      {k:'boost',     l:'Có chạy quảng cáo?',     t:'sel',  o:['Không','Có — đẩy tương tác','Có — đẩy tin nhắn','Có — đẩy tiếp cận']},
      {k:'budget',    l:'Ngân sách quảng cáo (đ)',t:'num',  ph:'0'},
    ],
    needEditor:true, editorLabel:'Người thiết kế',
  },
  'Instagram': {
    ic:'i-share', color:'#E1306C', stream:'social',
    fmts:['Ảnh đơn','Carousel','Reels','Story'],
    goals:['Nhận biết','Tăng follow','Tương tác','Kéo về quán'],
    fields:[
      {k:'caption',   l:'Caption',                t:'area', ph:'Ngắn gọn, có emoji', req:true},
      {k:'img_count', l:'Số ảnh',                 t:'num',  ph:'1'},
      {k:'hashtag',   l:'Hashtag (tối đa 30)',    t:'text', ph:'#micay #quangngai #food'},
      {k:'geotag',    l:'Gắn địa điểm',           t:'text', ph:'Mì cay Kitachi — 443 Phan Đình Phùng'},
    ],
    needEditor:true, editorLabel:'Người thiết kế',
  },
  'Google Maps': {
    ic:'i-target', color:'#34A853', stream:'social',
    fmts:['Bài đăng cập nhật','Bài ưu đãi','Bài sự kiện','Ảnh mới','Trả lời đánh giá'],
    goals:['Nhận biết','Kéo về quán','Chăm sóc khách'],
    fields:[
      {k:'caption',   l:'Nội dung bài đăng',      t:'area', ph:'Tối đa 1500 ký tự, nêu rõ ưu đãi và thời hạn', req:true},
      {k:'cta',       l:'Nút hành động',          t:'sel',  o:['Gọi ngay','Chỉ đường','Đặt bàn','Xem menu','Tìm hiểu thêm','Không có']},
      {k:'offer_end', l:'Ưu đãi hết hạn ngày',    t:'date'},
      {k:'img_count', l:'Số ảnh đính kèm',        t:'num',  ph:'1'},
      {k:'keyword',   l:'Từ khoá địa phương',     t:'text', ph:'mì cay Quảng Ngãi, Phan Đình Phùng'},
    ],
    needEditor:true, editorLabel:'Người thiết kế',
  },
  'Website': {
    ic:'i-doc', color:'#6D4AFF', stream:'social',
    fmts:['Bài blog','Trang landing','Cập nhật menu','Tin tức'],
    goals:['Nhận biết','SEO','Kéo về quán'],
    fields:[
      {k:'seo_title', l:'Tiêu đề SEO (60 ký tự)', t:'text', ph:'Mì cay Kitachi cơ sở 2 — 443 Phan Đình Phùng', req:true},
      {k:'seo_desc',  l:'Mô tả SEO (160 ký tự)',  t:'area', ph:'Đoạn mô tả hiện trên Google'},
      {k:'keyword',   l:'Từ khoá chính',          t:'text', ph:'mì cay quảng ngãi'},
      {k:'slug',      l:'Đường dẫn',              t:'text', ph:'/mi-cay-co-so-2'},
      {k:'script',    l:'Dàn ý bài viết',         t:'area', ph:'H2… H2… kết bài'},
    ],
    needEditor:true, editorLabel:'Người thiết kế ảnh bìa',
  },
  'YouTube': {
    ic:'i-video', color:'#FF0000', stream:'social',
    fmts:['Video dài','Shorts','Livestream'],
    goals:['Nhận biết','Tăng subscriber','Kéo về quán'],
    fields:[
      {k:'hook',      l:'Tiêu đề video',          t:'text', ph:'Tiêu đề hấp dẫn, có từ khoá', req:true},
      {k:'script',    l:'Kịch bản',               t:'area', ph:'Mở đầu… nội dung… kết'},
      {k:'duration',  l:'Thời lượng dự kiến',     t:'sel',  o:['Dưới 60s (Shorts)','3-5 phút','5-10 phút','Trên 10 phút']},
      {k:'seo_desc',  l:'Mô tả video',            t:'area', ph:'Mô tả kèm địa chỉ và link'},
      {k:'thumb',     l:'Yêu cầu ảnh thumbnail',  t:'text', ph:'Mô tả ảnh bìa cần thiết kế'},
    ],
    needEditor:true, editorLabel:'Người dựng video',
  },
  'Zalo': {
    ic:'i-send', color:'#0068FF', stream:'social',
    fmts:['Tin nhắn ZNS','Bài đăng OA','Broadcast'],
    goals:['Chăm sóc khách','Kéo về quán','Bán hàng'],
    fields:[
      {k:'caption',   l:'Nội dung tin nhắn',      t:'area', ph:'Tối đa 300 ký tự cho ZNS', req:true},
      {k:'audience',  l:'Gửi cho nhóm nào',       t:'sel',  o:['Toàn bộ khách','Khách cơ sở 1','Khách phía Nam','Khách chưa quay lại','Thành viên mới']},
      {k:'send_count',l:'Số lượng gửi dự kiến',   t:'num',  ph:'1000'},
      {k:'budget',    l:'Chi phí ZNS (đ)',        t:'num',  ph:'0'},
      {k:'cta',       l:'Nút hành động',          t:'sel',  o:['Đặt bàn','Xem menu','Gọi hotline','Nhận ưu đãi','Không có']},
    ],
    needEditor:false, editorLabel:'Người thiết kế',
  },
};
const platOf = ch => (PLAT[(CHANNELS.find(c=>c.name===ch)||{}).platform]) || PLAT['Facebook'];
const PLAT_NAMES = Object.keys(PLAT);

/* ─── Bốn bàn làm việc ─── */
const DESKS = {
  social:{key:'social',name:'Content Social',ic:'i-share',
    desc:'Facebook · Instagram · Website · Google Maps · YouTube · Zalo',kind:'content'},
  tiktok:{key:'tiktok',name:'Content TikTok',ic:'i-video',
    desc:'Toàn bộ kênh TikTok của hệ thống',kind:'content'},
  design:{key:'design',name:'Designer',ic:'i-brush',
    desc:'Ảnh, poster, infographic, ấn phẩm in',kind:'design'},
  edit:{key:'edit',name:'Editor Video',ic:'i-film',
    desc:'Dựng video, cắt clip, hậu kỳ',kind:'design'},
};
const deskOwner = k => (MEMBERS.find(m=>m.desk===k)||{}).name;
function deskPosts(k){
  const d=DESKS[k]; if(!d) return [];
  if(d.kind==='content') return POSTS.filter(p=>(p.stream||'social')===k);
  return POSTS.filter(p=>p.editor===deskOwner(k));
}

let ME=null, MEMBERS=[], POSTS=[], CHANNELS=[], TASKS=[], ALL_POSTS=[], ALL_TASKS=[], PROJECTS=[], SPRINTS=[],
    BUDGET=[], RISKS=[], DOCS=[], MEETS=[], ADS=[], REPORTS=[], APPROVALS=[], KUDOS=[], DUTY=[],
    PERMS=[], ROLES=[], SET={},
    VIEW='dash', PICKED=null, QUERY='', PROJ=0, CAL=new Date(), DAY=null,
    TMODE='list', PTAB='all', PJTAB='run';

/* ─── Tiện ích ─── */

/* ─── Đếm ngược theo giờ — trực quan hơn theo ngày ─── */
function hoursLeft(d,t){
  if(!d) return null;
  const due=new Date(d+'T'+(t||'23:59'));
  return (due-new Date())/36e5;
}
function dueChip(d,t,done){
  const h=hoursLeft(d,t);
  if(h===null) return '<span class="dchip none">—</span>';
  if(done) return `<span class="dchip ok">${fdate(d)}</span>`;
  if(h<0){ const a=Math.abs(h);
    return `<span class="dchip late">Quá hạn ${a<24?Math.round(a)+' giờ':Math.round(a/24)+' ngày'}</span>`;}
  if(h<24) return `<span class="dchip soon">Còn ${Math.round(h)} giờ</span>`;
  if(h<48) return `<span class="dchip warn">Hạn ngày mai</span>`;
  return `<span class="dchip">Còn ${Math.round(h/24)} ngày</span>`;
}
const isToday=d=>d===iso(D0());

const D0 = () => new Date(new Date().toDateString());
const dd = d => d ? Math.round((new Date(d)-D0())/864e5) : null;
const fdate = d => d ? new Date(d).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'}) : '—';
const fdate2 = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
const esc = s => (s??'').toString().replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const icon = id => `<svg class="ic"><use href="#${id}"/></svg>`;
const ini = n => (n||'?').trim().split(/\s+/).slice(-1)[0][0];
const nf = n => Number(n||0).toLocaleString('vi-VN');
const money = n => nf(n)+' đ';
const mshort = n => { n=Number(n||0);
  return n>=1e9 ? (n/1e9).toFixed(1).replace('.0','')+' tỷ'
       : n>=1e6 ? Math.round(n/1e6)+' tr' : nf(n); };
const kf = n => n>=1000 ? (n/1000).toFixed(n>=10000?0:1).replace('.0','')+'K' : nf(n);
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const avat = n => `<span class="av">${esc(ini(n))}</span>`;
const whoCell = n => n ? `<span class="who">${avat(n)}<span>${esc(n)}</span></span>`
  : '<span style="color:var(--ink3)">—</span>';

function holder(p){
  const h=F(p.status).hold;
  if(h==='writer') return p.writer;
  if(h==='design') return (p.editor && p.editor!=='Không cần') ? p.editor : p.writer;
  if(h==='leader') return (MEMBERS.find(m=>m.kind==='leader')||{}).name;
  return null;
}
const holds = (p,n) => holder(p)===n;
const latePost = p => !DONE.includes(p.status) && p.pub_date && dd(p.pub_date)<0;
const lateDesign = p => !DONE.includes(p.status) && p.design_due && !p.design_done
  && dd(p.design_due)<0 && ['Đã phê duyệt','Đang thiết kế'].includes(p.status);
const lateTask = t => t.due && dd(t.due)<0 && !['Hoàn thành','Không áp dụng'].includes(tgrp(t));
const inProj = x => !PROJ || x.project_id===PROJ;
const myTasks = () => TASKS.filter(t=>(t.owner||'').includes(ME.name)
  && !['Hoàn thành','Không áp dụng'].includes(tgrp(t)));

function toast(m){ const e=document.getElementById('toast'); e.textContent=m;
  e.classList.add('show'); setTimeout(()=>e.classList.remove('show'),2400); }
function showDemoBanner(){
  if(document.getElementById('demoBar')) return;
  const b=document.createElement('div'); b.id='demoBar'; b.className='demo-bar';
  b.innerHTML='Chế độ xem thử — dữ liệu mẫu, thay đổi không được lưu. Điền khoá Supabase vào <b>config.js</b> để cả phòng dùng chung.';
  document.body.appendChild(b);
}

/* ─── Đăng nhập ─── */
async function boot(){
  let {data,error}=await sb.from('members').select('*').order('sort_order');
  if(error||!data||!data.length){ DEMO_MODE=true; sb=demoClient();
    ({data}=await sb.from('members').select('*').order('sort_order')); }
  MEMBERS=data;
  if(DEMO_MODE) showDemoBanner();
  document.getElementById('memberList').innerHTML=MEMBERS.map(m=>`
    <button class="member-btn" data-n="${esc(m.name)}">${avat(m.name)}
      <span><b>${esc(m.name)}</b><small>${esc(m.role)}</small></span></button>`).join('');
  document.querySelectorAll('.member-btn').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.member-btn').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); PICKED=b.dataset.n; document.getElementById('pin').focus(); });
  const saved=localStorage.getItem('mktos_me');
  if(saved&&MEMBERS.find(m=>m.name===saved)) enter(saved);
}
document.getElementById('loginBtn').onclick=doLogin;
document.getElementById('pin').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
function doLogin(){
  const err=document.getElementById('loginErr');
  if(!PICKED){err.textContent='Chọn tên của bạn trước nhé';return;}
  const m=MEMBERS.find(x=>x.name===PICKED);
  if(document.getElementById('pin').value!==m.pin){err.textContent='Mã PIN chưa đúng';return;}
  localStorage.setItem('mktos_me',PICKED); enter(PICKED);
}
async function enter(name){
  ME=MEMBERS.find(m=>m.name===name);
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('whoName').textContent=ME.name;
  document.getElementById('whoRole').textContent=ME.role;
  document.getElementById('sideAv').textContent=ini(ME.name);
  await loadAll();
}
document.getElementById('logout').onclick=()=>{localStorage.removeItem('mktos_me');location.reload();};

/* ─── Nạp dữ liệu ─── */
async function loadAll(){
  const t = n => sb.from(n).select('*');
  const [p,c,tk,pr,sp,bg,rk,dc,mt,st,ad,rp,ap,ku,dt,pm,rl] = await Promise.all([
    sb.from('posts').select('*').order('pub_date'), t('channels'),
    sb.from('tasks').select('*').order('due'), t('projects'), t('sprints'),
    t('budget'), t('risks'), t('docs'), sb.from('meetings').select('*').order('date'), t('settings'),
    t('ads'), sb.from('reports').select('*').order('date'), t('approvals'), t('kudos'),
    sb.from('duty').select('*').order('date'), t('perms'), t('roles')
  ]);
  ALL_POSTS=p.data||[]; ALL_TASKS=tk.data||[];
  POSTS=ALL_POSTS.filter(x=>!x.archived); TASKS=ALL_TASKS.filter(x=>!x.archived);
  CHANNELS=c.data||[]; PROJECTS=pr.data||[];
  SPRINTS=sp.data||[]; BUDGET=bg.data||[]; RISKS=rk.data||[]; DOCS=dc.data||[];
  MEETS=mt.data||[]; ADS=ad.data||[]; REPORTS=rp.data||[]; APPROVALS=ap.data||[];
  KUDOS=ku.data||[]; DUTY=dt.data||[]; PERMS=pm.data||[]; ROLES=rl.data||[];
  SET=Object.fromEntries((st.data||[]).map(x=>[x.key,x.value]));

  const sel=document.getElementById('projSel');
  sel.innerHTML='<option value="0">Tất cả dự án</option>'+
    PROJECTS.map(x=>`<option value="${x.id}" ${x.id===PROJ?'selected':''}>${esc(x.name)}</option>`).join('');
  sel.onchange=()=>{PROJ=+sel.value; render();};

  const badge=(id,n)=>{const e=document.getElementById(id); if(e) e.textContent=n||'';};
  badge('nTasks', myTasks().length);
  badge('nPosts', POSTS.filter(x=>!DONE.includes(x.status)&&holds(x,ME.name)).length);
  badge('nRisks', RISKS.filter(r=>r.status!=='Đã đóng'&&r.impact==='Cao').length);
  badge('nProjects', PROJECTS.filter(x=>x.status==='Đang chạy').length);
  badge('nArch', ALL_TASKS.filter(x=>x.archived).length+ALL_POSTS.filter(x=>x.archived).length);
  badge('bwork', POSTS.filter(x=>!DONE.includes(x.status)&&holds(x,ME.name)).length);
  badge('nAds', ADS.filter(a=>a.status==='Đang chạy').length);
  badge('nRep', REPORTS.filter(r=>r.reviewer===ME.name&&r.status==='Chờ duyệt').length);
  badge('nApr', APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt').length);
  Object.keys(DESKS).forEach(k=>badge('b'+k,
    deskPosts(k).filter(x=>!DONE.includes(x.status)&&holds(x,deskOwner(k))).length));
  const alerts = POSTS.filter(latePost).length + TASKS.filter(lateTask).length;
  document.getElementById('bellDot').textContent = alerts ? ' ' : '';
  render();
}

/* ─── Điều hướng ─── */
function go(v){
  if(v==='desk'){ const k=(MEMBERS.find(x=>x.name===ME.name)||{}).desk;
    v = (k==='design'||k==='edit') ? 'd-'+k : 'work'; }
  VIEW=v;
  document.querySelectorAll('.nav-i,.bn').forEach(b=>b.classList.toggle('active',b.dataset.view===v));
  closeSide(); window.scrollTo(0,0); render();
}
document.querySelectorAll('.nav-i,.bn').forEach(b=>b.onclick=()=>go(b.dataset.view));
document.getElementById('q').oninput=e=>{QUERY=e.target.value.toLowerCase();
  if(!['tasks','posts'].includes(VIEW)) go('tasks'); else render();};
document.getElementById('quickAdd').onclick=()=>openCreate();
document.getElementById('bellBtn').onclick=()=>openAlerts();
const openSide=()=>{document.getElementById('side').classList.add('open');
  document.getElementById('sideBg').classList.add('on');};
const closeSide=()=>{document.getElementById('side').classList.remove('open');
  document.getElementById('sideBg').classList.remove('on');};
document.getElementById('burger').onclick=openSide;
document.getElementById('sideBg').onclick=closeSide;

/* ─── Mảnh dựng dùng chung ─── */
const ph=(t,s,right)=>`<div class="ph"><div><h2>${esc(t)}</h2><p>${esc(s)}</p></div>
  ${right||''}</div>`;
const bigKpi=(cls,lbl,val,foot)=>`<div class="bkpi b-${cls}">
  <div class="bk-l">${esc(lbl)}</div><div class="bk-v">${val}</div>
  <div class="bk-f">${esc(foot||'')}</div></div>`;
const kpi=(cls,ic,lbl,val,foot,pct)=>`<div class="kpi">
  <div class="kpi-t"><div class="kpi-ic t-${cls}">${icon(ic)}</div>
    <div><div class="lbl">${lbl}</div><div class="val v-${cls}">${val}</div></div></div>
  ${pct!==undefined?`<div class="kpi-u"><i class="u-${cls}" style="width:${pct}%"></i></div>`:''}
  ${foot?`<div class="kpi-f">${foot}</div>`:''}</div>`;

function distBlock(items,total){
  const seg=items.filter(i=>i.n>0).map(i=>
    `<i style="background:${i.c};width:${total?i.n/total*100:0}%"></i>`).join('');
  const rows=items.map(i=>`<div class="dist">
    <span class="dt"><span class="dd" style="background:${i.c}"></span>${esc(i.t)}</span>
    <span class="db"><i style="background:${i.c};width:${total?i.n/total*100:0}%"></i></span>
    <span class="dn">${i.n}</span>
    <span class="dp">${total?Math.round(i.n/total*100):0}%</span></div>`).join('');
  return `<div class="seg">${seg}</div>${rows}`;
}

function ringBlock(pct,label,items){
  const R=54,C=2*Math.PI*R;
  return `<div class="ring-wrap"><div class="ring">
    <svg width="132" height="132" viewBox="0 0 132 132">
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="#EFEFF5" stroke-width="13"/>
      <circle cx="66" cy="66" r="${R}" fill="none" stroke="#6D4AFF" stroke-width="13"
        stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}"/>
    </svg><div class="ring-c"><b>${pct}%</b><span>${esc(label)}</span></div></div>
    <div class="leg">${items.map(i=>`<div class="leg-i">
      <span class="dd" style="background:${i.c}"></span>${esc(i.t)}
      <b>${i.n}</b><small>${i.p}</small></div>`).join('')}</div></div>`;
}

const postRow = (p,showHold) => {
  const d=dd(p.pub_date);
  const when = d===null?'—' : d<0?`trễ ${-d} ngày` : d===0?'hôm nay' : d===1?'ngày mai' : fdate(p.pub_date);
  return `<div class="titem" data-post="${p.id}">
    <span class="pill ${F(p.status).cls}">${F(p.status).ic} ${esc(p.status)}</span>
    <div class="tn"><b>${esc(p.title)}</b><small>${esc(p.channel||'')}
      ${p.writer?`· ${esc(p.writer)}`:''}${p.editor&&p.editor!=='Không cần'?` → ${esc(p.editor)}`:''}
      ${showHold&&holder(p)?`<span class="pill pill-s s-pri">${esc(holder(p))} đang giữ</span>`:''}</small></div>
    <span class="due ${latePost(p)?'late':(d===0||d===1?'soon':'')}">${when}</span></div>`;
};
const taskRow = t => `<div class="titem" data-task="${t.id}">
  <span class="pill ${tcls(t)}">${esc(t.status)}</span>
  <div class="tn"><b>${esc(t.name)}</b><small>${esc(t.area||'')} · ${esc(t.owner||'chưa giao')}</small></div>
  <span class="due ${lateTask(t)?'late':''}">${fdate(t.due)}</span></div>`;
/* ═══════════════════════════ MÀN HÌNH ═══════════════════════════ */
function render(){
  const m=document.getElementById('mainBody');
  if(VIEW.startsWith('d-')){ m.innerHTML=viewDesk(VIEW.slice(2)); bindAll(); return; }
  if(VIEW.startsWith('p-')){ m.innerHTML=viewProject(+VIEW.slice(2)); bindAll();
    const o=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
    const pr=PROJECTS.find(x=>x.id===+VIEW.slice(2));
    o('pjBack',()=>go('projects')); o('pjEdit',()=>editProject(pr));
    o('pjTask',()=>{PROJ=pr.id;openNewTask();});
    o('pjDel',async()=>{
      const n=TASKS.filter(t=>t.project_id===pr.id).length;
      if(!confirm('Xoá dự án "'+pr.name+'"?'+(n?'\n'+n+' đầu việc thuộc dự án cũng sẽ bị xoá.':'')))return;
      await sb.from('projects').delete().eq('id',pr.id);
      toast('Đã xoá dự án'); go('projects');});
    return; }
  const V={dash:viewDash,projects:viewProjects,timeline:viewTimeline,tasks:viewTasks,
    sprints:viewSprints,posts:viewPosts,cal:viewCal,channels:viewChannels,
    team:viewTeam,budget:viewBudget,risks:viewRisks,docs:viewDocs,meets:viewMeets,
    reports:viewReports,activity:viewActivity,archive:viewArchive,setup:viewSetup,
    approvals:viewApprovals,perf:viewPerf,kudos:viewKudos,duty:viewDuty,
    org:viewOrg,roles:viewRoles,
    work:viewWork,ads:viewAds}[VIEW];
  m.innerHTML = V?V():'';
  if(VIEW==='activity') loadLog();
  if(VIEW==='roles') bindRoles();
  bindAll();
}


/* ─── Thanh chọn ngày ─── */
function dayBar(){
  const base=DAY?new Date(DAY):D0();
  const days=[]; for(let i=-3;i<=3;i++){const d=new Date(D0());d.setDate(d.getDate()+i);days.push(d);}
  const cur=DAY||iso(D0());
  return `<div class="daybar">
    <button class="dnav" id="dPrev">${icon('i-list')}</button>
    <div class="dstrip">${days.map(d=>{
      const k=iso(d), isTd=k===iso(D0());
      const n=POSTS.filter(p=>p.pub_date===k).length
        +TASKS.filter(t=>t.due===k&&tgrp(t)!=='Hoàn thành').length
        +MEETS.filter(m=>m.date===k).length;
      return `<button class="dcell ${k===cur?'on':''} ${isTd?'td':''}" data-day="${k}">
        <span class="dw">${isTd?'Hôm nay':d.toLocaleDateString('vi-VN',{weekday:'short'})}</span>
        <span class="dd2">${d.getDate()}/${d.getMonth()+1}</span>
        ${n?`<span class="dn2">${n}</span>`:'<span class="dn2 z">·</span>'}</button>`;}).join('')}</div>
    <input type="date" id="dPick" class="dinput" value="${cur}">
    ${DAY&&DAY!==iso(D0())?`<button class="btn btn-gh btn-sm" id="dToday">Về hôm nay</button>`:''}
  </div>`;
}

function dayPanel(){
  const k=DAY||iso(D0());
  const d=new Date(k);
  const ps=POSTS.filter(p=>p.pub_date===k);
  const ts=TASKS.filter(t=>t.due===k);
  const ms=MEETS.filter(m=>m.date===k);
  const done=ps.filter(p=>p.status==='Đã đăng').length+ts.filter(t=>tgrp(t)==='Hoàn thành').length;
  const tot=ps.length+ts.length;
  const isTd=k===iso(D0()), diff=dd(k);
  const byWho={};
  [...ps.map(p=>({w:holder(p)||p.writer,k:'post',id:p.id,t:p.title,s:p.channel,
      st:p.status,cls:F(p.status).cls,tm:p.pub_time})),
   ...ts.map(t=>({w:t.owner,k:'task',id:t.id,t:t.name,s:t.area,st:t.status,cls:tcls(t),tm:''}))]
   .forEach(x=>{(byWho[x.w||'Chưa giao']=byWho[x.w||'Chưa giao']||[]).push(x);});

  return `<div class="panel"><div class="panel-h">
    <b>${icon('i-cal')} ${isTd?'Hôm nay':diff===1?'Ngày mai':diff===-1?'Hôm qua':
      d.toLocaleDateString('vi-VN',{weekday:'long'})} · ${d.toLocaleDateString('vi-VN')}</b>
    <small>${tot?`${done}/${tot} đã xong`:'không có lịch'}${ms.length?` · ${ms.length} cuộc họp`:''}</small></div>
    <div class="panel-b" style="padding-bottom:6px">
      <div class="daykpi">
        <div><span>Bài đăng</span><b>${ps.length}</b></div>
        <div><span>Đầu việc đến hạn</span><b>${ts.length}</b></div>
        <div><span>Cuộc họp</span><b>${ms.length}</b></div>
        <div><span>Đã hoàn tất</span><b style="color:var(--green)">${done}</b></div>
      </div></div>
    ${ms.length?`<div class="day-sep">Cuộc họp</div>
      ${ms.map(m=>`<div class="slot"><span class="slot-t">${esc(m.time)}</span>
        <span class="slot-l a" data-meet="${m.id}" style="cursor:pointer"><b>${esc(m.name)}</b>
          <small>${m.mins} phút · ${esc(m.host)} · ${esc(m.who)}</small></span></div>`).join('')}`:''}
    ${Object.keys(byWho).length?Object.entries(byWho).map(([w,l])=>`
      <div class="day-sep">${esc(w)} · ${l.length} việc</div>
      ${l.map(x=>`<div class="titem" data-${x.k}="${x.id}">
        <span class="pill ${x.cls}">${esc(x.st)}</span>
        <div class="tn"><b>${esc(x.t)}</b><small>${esc(x.s||'')}</small></div>
        <span class="due">${esc(x.tm||'')}</span></div>`).join('')}`).join('')
      :'<div class="empty">Ngày này không có bài đăng hay đầu việc nào đến hạn</div>'}</div>`;
}

/* ═════════ TỔNG HỢP — bố cục portal ═════════ */
const CHCOL = ['#6D4AFF','#12855A','#1F63C7','#D9772B','#0E7490','#B83280','#7A3EC7','#C0392B','#2E7D32','#5B6ABF'];

function viewDash(){
  const tasks=TASKS.filter(inProj);
  const act=tasks.filter(t=>tgrp(t)!=='Không áp dụng');
  const done=act.filter(t=>tgrp(t)==='Hoàn thành').length;
  const lateT=act.filter(lateTask);
  const openP=POSTS.filter(p=>!DONE.includes(p.status));
  const myP=openP.filter(p=>holds(p,ME.name));
  const myT=TASKS.filter(t=>(t.owner||'').includes(ME.name)&&inProj(t)
    &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  const mine=[...myP,...myT];
  const posted=POSTS.filter(p=>p.status==='Đã đăng');
  const views=posted.reduce((s,p)=>s+(p.views||0),0);
  const pct=act.length?Math.round(done/act.length*100):0;
  const wait=openP.filter(p=>F(p.status).hold==='leader');
  const latePs=openP.filter(latePost);
  const first=ME.name.split(' ').slice(-1)[0];
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));

  /* ── Việc cần làm hôm nay: gom bài + đầu việc đang ở tay tôi ── */
  const todos=[
    ...myP.map(p=>{const d=dd(p.pub_date);
      const f=F(p.status);
      let act='Mở', ic='i-pen', col='pri';
      if(f.hold==='leader'){act='Duyệt';ic='i-check';col='amber';}
      else if(norm(p.status)==='Đang thiết kế'&&p.editor===ME.name&&!p.design_started){act='Nhận việc';ic='i-hand';col='teal';}
      else if(norm(p.status)==='Đang thiết kế'){act='Gửi duyệt';ic='i-brush';col='pink';}
      return {k:'post',id:p.id,t:p.title,s:p.channel||'',d,ic,col,act,
        st:latePost(p)?'Quá hạn':d===0?'Hạn hôm nay':d===1?'Ngày mai':d===null?'':`Còn ${d} ngày`,
        cls:latePost(p)?'s-red':d<=1?'s-amber':'s-blue',date:p.pub_date,pri:latePost(p)?0:(d??99)};})
    ,...myT.map(t=>{const d=dd(t.due);
      return {k:'task',id:t.id,t:t.name,s:t.area||'',d,ic:'i-check',col:'blue',act:'Cập nhật',
        st:lateTask(t)?'Quá hạn':d===0?'Hạn hôm nay':d===1?'Ngày mai':d===null?'':`Còn ${d} ngày`,
        cls:lateTask(t)?'s-red':d<=1?'s-amber':'s-blue',date:t.due,pri:lateTask(t)?0:(d??99)};})
  ].sort((a,b)=>a.pri-b.pri).slice(0,7);

  /* ── Lịch hôm nay: bài đăng + họp ── */
  const td=iso(new Date());
  const slots=[
    ...POSTS.filter(p=>p.pub_date===td).map(p=>({t:p.pub_time||'—',n:p.title,
      s:(p.channel||'')+' · '+(p.writer||''),k:'post',id:p.id,
      c:p.status==='Đã đăng'?'g':'',r:p.status==='Đã đăng'?'Đã đăng':''})),
    ...MEETS.filter(m=>m.date===td).map(m=>({t:m.time,n:m.name,
      s:m.mins+' phút · '+m.host,k:'meet',id:m.id,c:'a',r:''}))
  ].sort((a,b)=>(a.t<b.t?-1:1));
  const tmr=iso(new Date(D0().getTime()+864e5));
  const slotsT=[...POSTS.filter(p=>p.pub_date===tmr).map(p=>({t:p.pub_time||'—',n:p.title,
      s:(p.channel||'')+' · '+(p.writer||''),k:'post',id:p.id,c:'x',r:'Sắp tới'})),
    ...MEETS.filter(m=>m.date===tmr).map(m=>({t:m.time,n:m.name,s:m.mins+' phút',k:'meet',id:m.id,c:'x',r:'Sắp tới'}))
  ].sort((a,b)=>(a.t<b.t?-1:1)).slice(0,3);

  /* ── Thẻ kênh ── */
  const chcards=CHANNELS.map((c,i)=>{
    const all=POSTS.filter(p=>p.channel===c.name);
    const n=all.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
    const t=c.target_week||0, p=t?Math.min(100,Math.round(n/t*100)):0;
    const v=all.filter(x=>x.status==='Đã đăng').reduce((s,x)=>s+(x.views||0),0);
    const own=(c.stream==='tiktok')?deskOwner('tiktok'):deskOwner('social');
    return `<div class="chcard" data-chan="${c.id}" style="background:${CHCOL[i%CHCOL.length]}">
      <div class="chcard-h"><span><b>${esc(c.name)}</b>
        <small>${esc(c.platform)} · ${esc(own||'')}</small></span>
        ${icon(c.stream==='tiktok'?'i-video':'i-share')}</div>
      <div class="chcard-p"><div class="pl"><span>Nhịp tuần này</span><span>${n}/${t} bài</span></div>
        <div class="chcard-bar"><i style="width:${p}%"></i></div></div>
      <div class="chcard-f">
        <div>Đang chạy<b>${all.filter(x=>!DONE.includes(x.status)).length}</b></div>
        <div>Đã đăng<b>${all.filter(x=>x.status==='Đã đăng').length}</b></div>
        <div>Lượt xem<b>${kf(v)}</b></div></div></div>`;
  }).join('');

  /* ── Thông báo bên phải ── */
  const notes=[
    ...latePs.slice(0,2).map(p=>({i:'i-alert',c:'red',t:'Bài quá hạn đăng',
      s:p.title+' · '+(holder(p)||''),n:1,k:'post',id:p.id})),
    ...wait.slice(0,2).map(p=>({i:'i-clock',c:'amber',t:'Chờ Leader duyệt',
      s:p.title,n:0,k:'post',id:p.id})),
    ...lateT.slice(0,2).map(t=>({i:'i-check',c:'blue',t:'Đầu việc quá hạn',
      s:t.name+' · '+(t.owner||''),n:0,k:'task',id:t.id})),
    ...MEETS.filter(m=>dd(m.date)>=0).slice(0,1).map(m=>({i:'i-meet',c:'teal',
      t:'Cuộc họp sắp tới',s:m.name+' · '+fdate(m.date)+' '+m.time,n:0,k:'meet',id:m.id})),
  ].slice(0,5);

  /* ── Cơ cấu quy trình ── */
  const stages=[
    {t:'Người viết',c:'#1F63C7',n:openP.filter(p=>F(p.status).hold==='writer').length},
    {t:'Leader duyệt',c:'#B26A00',n:wait.length},
    {t:'Thiết kế',c:'#B83280',n:openP.filter(p=>F(p.status).hold==='design').length},
    {t:'Đã đăng',c:'#12855A',n:posted.length},
  ];
  const totS=stages.reduce((s,x)=>s+x.n,0);

  /* ── Hoạt động gần đây ── */
  const recent=[...POSTS].filter(p=>p.status==='Đã đăng').slice(-2).map(p=>
    ({i:'i-check',c:'green',t:'Đã đăng '+p.title,s:(p.channel||'')+' · '+(p.writer||'')}))
    .concat([...TASKS].filter(t=>tgrp(t)==='Hoàn thành').slice(-2).map(t=>
    ({i:'i-check',c:'pri',t:'Hoàn thành '+t.name,s:(t.area||'')+' · '+(t.owner||'')})))
    .slice(0,4);

  const hh=new Date().getHours();
  const greet=hh<11?'Chào buổi sáng':hh<14?'Chào buổi trưa':hh<18?'Chào buổi chiều':'Chào buổi tối';
  const urgent=lateT.length+latePs.length;
  const lead=urgent
    ? `Có ${urgent} việc đang quá hạn. Bắt đầu từ việc ảnh hưởng lớn nhất để nhanh chóng lấy lại nhịp.`
    : wait.length ? `Có ${wait.length} nội dung đang chờ duyệt. Giải phóng sớm để bên thiết kế có việc làm.`
    : 'Mọi thứ đang đúng tiến độ. Giữ nhịp như hôm nay.';
  /* sức khoẻ team */
  const health=MEMBERS.map(m=>{
    const lt2=TASKS.filter(t=>(t.owner||'').includes(m.name)&&lateTask(t)).length
      +POSTS.filter(p=>holds(p,m.name)&&latePost(p)).length;
    const open2=TASKS.filter(t=>(t.owner||'').includes(m.name)&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t))).length
      +POSTS.filter(p=>holds(p,m.name)&&!DONE.includes(p.status)).length;
    return {m,lt:lt2,open:open2};});
  const needCare=health.filter(h=>h.lt>0||h.open===0);
  const rToday=REPORTS.filter(r=>r.date===iso(D0()));
  const rSub=rToday.filter(r=>r.status!=='Chưa nộp').length;
  const rWait=rToday.filter(r=>r.status==='Chờ duyệt').length;
  const rRate=MEMBERS.length?Math.round(rSub/MEMBERS.length*100):0;
  const myApr=APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt').length;

  return `
  <div class="hero2">
    <div class="hero2-tag">${icon('i-bolt')} MARKETING COMMAND CENTER</div>
    <h2>${greet}, ${esc(ME.name)}</h2>
    <div class="hero2-sub">${new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}
      · Quảng Ngãi · còn ${dd(SET.opening_date)} ngày tới khai trương cơ sở 2</div>
    <div class="hero2-lead">${esc(lead)}</div>
  </div>

  ${dayBar()}
  <div class="kpis4">
    ${bigKpi('green','Dự án đang triển khai',PROJECTS.filter(p=>p.status==='Đang chạy').length,'Toàn hệ thống')}
    ${bigKpi('amber','Công việc cần xử lý',mine.length,'Đang nằm ở tay bạn')}
    ${bigKpi('blue','Đến hạn hôm nay',act.filter(t=>isToday(t.due)).length+openP.filter(p=>isToday(p.pub_date)).length,'Toàn hệ thống')}
    ${bigKpi('red','Công việc quá hạn',urgent,'Toàn hệ thống')}
  </div>

  ${(latePs.length||lateT.length)?`<div class="notice">
    <span class="ni">${icon('i-alert')}</span>
    <span><b>Có ${latePs.length+lateT.length} mục đang quá hạn</b>
      <p>${latePs.length?`${latePs.length} bài trễ lịch đăng`:''}${latePs.length&&lateT.length?' · ':''}${
        lateT.length?`${lateT.length} đầu việc quá hạn`:''}. Mở chuông nhắc việc ở thanh trên để xem đầy đủ.</p></span>
  </div>`:''}

  <div class="panel-h" style="background:none;border:0;padding:2px 2px 9px">
    <b style="font-size:14.5px">${icon('i-signal')} Hệ thống kênh</b>
    <small>${CHANNELS.length} kênh · bấm để xem hồ sơ và toàn bộ bài</small></div>
  <div class="chstrip" style="margin-bottom:16px">${chcards}</div>

  <div class="g3col">
    <div>
      <div class="panel"><div class="panel-h"><b>${icon('i-hand')} Việc cần làm hôm nay</b>
        <small>${myP.length+myT.length} mục đang ở tay bạn</small></div>
        <div>${todos.length?todos.map(x=>`<div class="todo">
          <span class="todo-i t-${x.col}">${icon(x.ic)}</span>
          <span class="todo-t" data-${x.k}="${x.id}"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>
          <span class="todo-r"><span class="tag"><span class="pill ${x.cls}">${esc(x.st)}</span>
            <small>${fdate(x.date)}</small></span>
            <button class="todo-b" data-${x.k}="${x.id}">${esc(x.act)}</button></span>
        </div>`).join(''):'<div class="empty">Bạn không còn việc nào đang giữ. Nhẹ nhõm!</div>'}</div></div>

      ${DAY&&DAY!==iso(new Date())?dayPanel():`<div class="panel"><div class="panel-h"><b>${icon('i-cal')} Lịch hôm nay</b>
        <small>${new Date().toLocaleDateString('vi-VN')}</small></div>
        <div>${slots.length?slots.map(s=>`<div class="slot">
          <span class="slot-t">${esc(s.t)}</span>
          <span class="slot-l ${s.c}" data-${s.k}="${s.id}" style="cursor:pointer">
            <b>${esc(s.n)}</b><small>${esc(s.s)}</small></span>
          ${s.r?`<span class="slot-r">${esc(s.r)}</span>`:''}</div>`).join('')
          :'<div class="empty">Hôm nay không có lịch đăng hay cuộc họp</div>'}
          ${slotsT.length?`<div class="day-sep">Ngày mai · ${new Date(D0().getTime()+864e5).toLocaleDateString('vi-VN')}</div>
            ${slotsT.map(s=>`<div class="slot"><span class="slot-t">${esc(s.t)}</span>
              <span class="slot-l ${s.c}" data-${s.k}="${s.id}" style="cursor:pointer">
                <b>${esc(s.n)}</b><small>${esc(s.s)}</small></span>
              <span class="slot-r" style="color:var(--ink3)">${esc(s.r)}</span></div>`).join('')}`:''}
        </div></div>`}

      <div class="panel-h" style="background:none;border:0;padding:6px 2px 9px">
        <b style="font-size:14.5px">${icon('i-users')} Ai đang làm gì</b>
        <small>${MEMBERS.length} thành viên · bấm để xem chi tiết</small></div>
      <div class="pcards">${peopleCards()}</div>
    </div>

    <div class="rail">
      <div class="panel" style="margin:0"><div class="panel-h"><b>${icon('i-alert')} Cảnh báo cần chú ý</b>
        <small style="cursor:pointer;color:var(--pri)" id="seeAll">Xem tất cả</small></div>
        <div class="panel-b" style="padding-top:4px;padding-bottom:8px">
          ${(()=>{
            const w=[];
            health.filter(h=>h.lt>0).sort((a,b)=>b.lt-a.lt).forEach(h=>
              w.push([`${h.m.name} có ${h.lt} công việc quá hạn.`,'red',h.lt,h.m.name]));
            health.filter(h=>h.open>14).sort((a,b)=>b.open-a.open).forEach(h=>
              w.push([`${h.m.name} đang giữ ${h.open} việc — cân nhắc chia bớt.`,'amber',h.open,h.m.name]));
            health.filter(h=>h.open===0).forEach(h=>
              w.push([`${h.m.name} hiện không có công việc đang mở.`,'gray','Hiện tại',h.m.name]));
            if(rToday.length<MEMBERS.length){
              const miss=MEMBERS.filter(m=>!rToday.find(r=>r.author===m.name&&r.status!=='Chưa nộp'));
              if(miss.length) w.push([`${miss.length} người chưa nộp báo cáo hôm nay.`,'amber',miss.length,null]);}
            return w.length?w.slice(0,5).map(([t,c,n,who])=>`<div class="warn-i" ${who?`data-who="${esc(who)}"`:''}>
              <span class="warn-t">${esc(t)}</span>
              <span class="pill pill-s ${c==='red'?'s-red':c==='amber'?'s-amber':'s-gray'}">${esc(String(n))}</span></div>`).join('')
              +(w.length>5?`<div class="warn-more">Còn ${w.length-5} cảnh báo khác</div>`:'')
              :'<div class="empty" style="padding:18px">Không có gì cần chú ý</div>';})()}</div></div>

      <div class="panel" style="margin:0"><div class="panel-h"><b>${icon('i-users')} Sức khỏe Team</b>
        <small style="cursor:pointer;color:var(--pri)" id="goPerf">Mở Hiệu suất →</small></div>
        <div class="panel-b">
          <div class="hgrid">
            <div><span>Tổng thành viên</span><b>${MEMBERS.length}</b></div>
            <div><span>Cần chú ý</span><b style="color:${needCare.length?'var(--red)':'var(--green)'}">${needCare.length}</b></div>
            <div><span>Việc quá hạn</span><b style="color:${urgent?'var(--red)':'var(--ink)'}">${urgent}</b></div>
            <div><span>Tỉ lệ báo cáo</span><b style="color:${rRate>=80?'var(--green)':'var(--amber)'}">${rRate}%</b></div>
          </div>
          ${needCare.length?`<div class="hnote">Cần chú ý: ${needCare.map(h=>esc(h.m.short_name||h.m.name)).join(', ')}</div>`:''}
        </div></div>

      <div class="panel" style="margin:0"><div class="panel-h"><b>${icon('i-doc')} Tình trạng báo cáo</b>
        <small style="cursor:pointer;color:var(--pri)" id="goRep">Mở →</small></div>
        <div class="panel-b">
          <div class="hgrid">
            <div><span>Đã nộp hôm nay</span><b style="color:var(--green)">${rSub}</b></div>
            <div><span>Chưa nộp</span><b style="color:${MEMBERS.length-rSub?'var(--red)':'var(--ink)'}">${MEMBERS.length-rSub}</b></div>
            <div><span>Chờ tôi duyệt</span><b style="color:var(--amber)">${rWait}</b></div>
            <div><span>Yêu cầu phê duyệt</span><b style="color:${myApr?'var(--amber)':'var(--ink)'}">${myApr}</b></div>
          </div></div></div>

      <div class="panel" style="margin:0"><div class="panel-h"><b>Cơ cấu quy trình</b>
        <small>${openP.length} bài đang chạy</small></div>
        <div class="panel-b">${ringBlock(pct,'hoàn thành',
          stages.map(s=>({t:s.t,c:s.c,n:s.n,p:totS?Math.round(s.n/totS*100)+'%':'0%'})))}</div></div>

      <div class="panel" style="margin:0"><div class="panel-h"><b>Thao tác nhanh</b></div>
        <div class="panel-b"><div class="qa">
          ${[['qTask','i-check','pri','Giao việc'],['qPost','i-pen','blue','Bài mới'],
             ['qProj','i-folder','teal','Dự án mới'],['qMeet','i-meet','amber','Đặt họp'],
             ['qRisk','i-alert','red','Ghi rủi ro'],['qDoc','i-doc','gray','Tài liệu'],
             ['qCal','i-cal','green','Lịch đăng'],['qRep','i-chart','pink','Báo cáo']]
            .map(([id,ic,c,t])=>`<button id="${id}"><span class="qi t-${c}">${icon(ic)}</span>${t}</button>`).join('')}
        </div></div></div>

      <div class="panel" style="margin:0"><div class="panel-h"><b>Dự án</b>
        <small>${PROJECTS.filter(p=>p.status==='Đang chạy').length} đang chạy</small></div>
        <div class="panel-b">${PROJECTS.map(pr=>{
          const ts=TASKS.filter(x=>x.project_id===pr.id&&tgrp(x)!=='Không áp dụng');
          const dn=ts.filter(x=>tgrp(x)==='Hoàn thành').length;
          const p=ts.length?Math.round(dn/ts.length*100):0;
          return `<div class="prow" data-proj="${pr.id}" style="cursor:pointer">
            <span class="nm"><span class="dd" style="width:8px;height:8px;border-radius:50%;background:${pr.color}"></span>${esc(pr.code)}</span>
            <span class="ct">${dn}/${ts.length}</span>
            <span class="bar" style="flex:0 0 56px"><i style="width:${p}%"></i></span>
            <span class="pct">${p}%</span></div>`;}).join('')}</div></div>
    </div>
  </div>

  <div class="panel"><div class="panel-h"><b>${icon('i-loop')} Hoạt động gần đây</b></div>
    <div class="panel-b"><div class="acts">${recent.length?recent.map(a=>`<div class="act">
      <span class="act-i t-${a.c}">${icon(a.i)}</span>
      <span class="act-t"><b>${esc(a.t)}</b><small>${esc(a.s)}</small></span></div>`).join('')
      :'<div class="empty">Chưa có hoạt động nào</div>'}</div></div></div>`;
}

function peopleCards(){
  const openP=POSTS.filter(p=>!DONE.includes(p.status));
  return MEMBERS.map(mb=>{
    const hp=openP.filter(p=>holds(p,mb.name));
    const ht=TASKS.filter(t=>(t.owner||'').includes(mb.name)&&inProj(t)
      &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
    const lt=hp.filter(latePost).length+ht.filter(lateTask).length;
    const tot=hp.length+ht.length;
    const cls=lt?'risk':(tot>14?'load':(tot?'busy':'free'));
    const items=[...hp.slice(0,2).map(p=>({id:p.id,k:'post',t:p.title,d:dd(p.pub_date),l:latePost(p)})),
      ...ht.slice(0,2).map(t=>({id:t.id,k:'task',t:t.name,d:dd(t.due),l:lateTask(t)}))].slice(0,4);
    const desk=Object.values(DESKS).find(d=>deskOwner(d.key)===mb.name);
    return `<div class="pcard ${cls}">
      <div class="pcard-h">${avat(mb.name)}
        <span class="pcard-n"><b>${esc(mb.name)}</b><small>${esc(mb.role)}</small></span>
        <span class="pcard-num"><b style="color:${lt?'var(--red)':'var(--pri)'}">${tot}</b>
          <small>đang giữ</small></span></div>
      <div class="pcard-tags">
        ${lt?`<span class="pill pill-s s-red">${lt} trễ hạn</span>`
           :tot>14?'<span class="pill pill-s s-amber">đang quá tải</span>'
           :tot?'<span class="pill pill-s s-pri">đang bận</span>'
           :'<span class="pill pill-s s-green">rảnh việc</span>'}
        ${hp.length?`<span class="pill pill-s s-teal">${hp.length} bài</span>`:''}
        ${ht.length?`<span class="pill pill-s s-gray">${ht.length} việc</span>`:''}</div>
      <div class="pcard-l">${items.length?items.map(i=>`
        <div class="pcard-i" data-${i.k}="${i.id}">
          <span class="dot ${i.l?'d-red':'d-pri'}"></span><span class="t">${esc(i.t)}</span>
          <span class="d ${i.l?'late':''}">${i.d===null?'—':i.d<0?`trễ ${-i.d}n`:i.d===0?'hôm nay':`${i.d}n`}</span>
        </div>`).join(''):'<div class="empty" style="padding:16px">Không giữ việc nào</div>'}</div>
      <div class="pcard-f"><span data-who="${esc(mb.name)}" style="cursor:pointer;color:var(--pri)">Xem tất cả →</span>
        ${desk?`<span data-desk="${desk.key}" style="cursor:pointer">Mở bàn ${esc(desk.name)}</span>`:'<span>Quản lý phòng</span>'}</div></div>`;
  }).join('');
}

/* ═════════ DỰ ÁN ═════════ */
function viewProjects(){
  const tabs=[['run','Đang hoạt động',p=>p.status==='Đang chạy'],
    ['soon','Sắp bắt đầu',p=>p.status==='Sắp bắt đầu'],
    ['pause','Tạm dừng',p=>p.status==='Tạm dừng'],
    ['end','Đã kết thúc',p=>p.status==='Đã kết thúc'],
    ['all','Tất cả',()=>true]];
  const cur=tabs.find(t=>t[0]===PJTAB)||tabs[0];
  const list=PROJECTS.filter(cur[2]);
  return ph('Dự án','Quản lý dự án theo trạng thái và thao tác công việc ngay bên trong từng dự án',
    `<button class="btn btn-pri btn-sm" id="newProj">${icon('i-plus')}Dự án mới</button>`) + `
  <div class="bar-row">
    <input type="text" id="pjq" class="fld" style="max-width:280px" placeholder="Tìm theo tên dự án">
    <select id="pjOwn"><option value="">Tất cả phụ trách</option>${MEMBERS.map(m=>`<option>${esc(m.name)}</option>`).join('')}</select>
  </div>
  <div class="ptabs">${tabs.map(t=>`<button data-pjtab="${t[0]}" class="${PJTAB===t[0]?'on':''}">
    ${esc(t[1])} <span class="ptab-n">${PROJECTS.filter(t[2]).length}</span></button>`).join('')}
    <span class="ptab-tot">${list.length} dự án</span></div>
  <div id="pjBody"></div>`;
}
function drawProjects(){
  const box=document.getElementById('pjBody'); if(!box) return;
  const q=(document.getElementById('pjq')||{}).value||'';
  const ow=(document.getElementById('pjOwn')||{}).value||'';
  const tabs={run:p=>p.status==='Đang chạy',soon:p=>p.status==='Sắp bắt đầu',
    pause:p=>p.status==='Tạm dừng',end:p=>p.status==='Đã kết thúc',all:()=>true};
  let list=PROJECTS.filter(tabs[PJTAB]||tabs.run)
    .filter(p=>(!q||p.name.toLowerCase().includes(q.toLowerCase()))&&(!ow||p.owner===ow));
  box.innerHTML=list.length?list.map(pr=>{
    const ts=TASKS.filter(t=>t.project_id===pr.id&&tgrp(t)!=='Không áp dụng');
    const dn=ts.filter(t=>tgrp(t)==='Hoàn thành').length;
    const doing=ts.filter(t=>tgrp(t)==='Đang làm').length;
    const lt=ts.filter(lateTask).length;
    const pc=ts.length?Math.round(dn/ts.length*100):0;
    const bud=BUDGET.filter(b=>b.project_id===pr.id);
    const plan=bud.reduce((s,b)=>s+(b.plan||0),0), spent=bud.reduce((s,b)=>s+(b.spent||0),0);
    return `<div class="prj" style="border-left-color:${pr.color}">
      <div class="prj-h">
        <span class="prj-n" data-popen="${pr.id}"><b>${esc(pr.name)}</b>
          <span class="pill pill-s ${pr.status==='Đang chạy'?'s-blue':pr.status==='Đã kết thúc'?'s-green':'s-gray'}">${esc(pr.status)}</span></span>
        <span class="prj-act">
          <button class="icobtn" data-popen="${pr.id}" title="Mở">${icon('i-eye')}</button>
          <button class="icobtn" data-pedit="${pr.id}" title="Sửa">${icon('i-pen')}</button>
          <button class="icobtn" data-pdel="${pr.id}" title="Xoá">${icon('i-trash')}</button></span></div>
      <div class="prj-m">Mã: <b>${esc(pr.code)}</b> · Phụ trách: <b>${esc(pr.owner)}</b>
        · Hạn: <b>${fdate2(pr.due)}</b>${plan?` · Ngân sách: <b>${mshort(spent)}/${mshort(plan)}</b>`:''}</div>
      <div class="prj-c">
        <span class="chipn">Đầu việc <b>${ts.length}</b></span>
        <span class="chipn blue">Đang xử lý <b>${doing}</b></span>
        ${lt?`<span class="chipn red">Quá hạn <b>${lt}</b></span>`:''}
        <span class="chipn green">Hoàn thành <b>${dn}/${ts.length}</b></span>
        <span class="prj-bar"><i class="${pc===100?'ok':''}" style="width:${pc}%"></i></span>
        <span class="prj-p">${pc}%</span></div></div>`;}).join('')
    :'<div class="panel"><div class="empty">Không có dự án nào</div></div>';
  bindAll();
}

/* ═════════ TIẾN ĐỘ ═════════ */
let TLTAB='time';
const tlTabs=()=>`<div class="tabs">
  <button data-tltab="time" class="${TLTAB==='time'?'on':''}">${icon('i-time')}Dòng thời gian</button>
  <button data-tltab="sprint" class="${TLTAB==='sprint'?'on':''}">${icon('i-bolt')}Đợt công việc</button></div>`;
function viewTimeline(){
  const list=PROJ?PROJECTS.filter(p=>p.id===PROJ):PROJECTS;
  if(!list.length) return ph('Tiến độ','')+'<div class="panel"><div class="empty">Chưa có dự án</div></div>';
  const all=[...list.map(p=>new Date(p.start)),...list.map(p=>new Date(p.due))];
  let min=new Date(Math.min(...all)), max=new Date(Math.max(...all));
  min=new Date(min.getFullYear(),min.getMonth(),1);
  max=new Date(max.getFullYear(),max.getMonth()+1,0);
  const span=(max-min)/864e5;
  const months=[]; let c=new Date(min);
  while(c<=max){ months.push(new Date(c)); c.setMonth(c.getMonth()+1); }
  const pos=d=>Math.max(0,Math.min(100,(new Date(d)-min)/864e5/span*100));
  const now=pos(new Date());

  const rows=list.map(pr=>{
    const ts=TASKS.filter(x=>x.project_id===pr.id&&tgrp(x)!=='Không áp dụng');
    const dn=ts.filter(x=>tgrp(x)==='Hoàn thành').length;
    const p=ts.length?Math.round(dn/ts.length*100):0;
    const l=pos(pr.start), w=Math.max(3,pos(pr.due)-l);
    return `<div class="tl-row" data-proj="${pr.id}" style="cursor:pointer">
      <span class="tl-nm">${esc(pr.name)}</span>
      <span class="tl-tr"><span class="tl-bar" style="left:${l}%;width:${w}%;background:${pr.color}">${p}%</span>
        <span class="tl-now" style="left:${now}%"></span></span>
      <span class="ct" style="flex:0 0 78px;text-align:right">${fdate(pr.start)}–${fdate(pr.due)}</span></div>`;
  }).join('');

  const spRows=SPRINTS.map(s=>{
    const ts=TASKS.filter(x=>x.sprint_id===s.id&&inProj(x)&&tgrp(x)!=='Không áp dụng');
    const dn=ts.filter(x=>tgrp(x)==='Hoàn thành').length;
    const p=ts.length?Math.round(dn/ts.length*100):0;
    const l=pos(s.start), w=Math.max(2,pos(s.end)-l);
    const col=s.status==='Đang chạy'?'#6D4AFF':s.status==='Đã kết thúc'?'#12855A':'#9797AC';
    return `<div class="tl-row"><span class="tl-nm">${esc(s.name)}
      <span class="pill pill-s ${s.status==='Đang chạy'?'s-pri':s.status==='Đã kết thúc'?'s-green':'s-gray'}">${esc(s.status)}</span></span>
      <span class="tl-tr"><span class="tl-bar" style="left:${l}%;width:${w}%;background:${col}">${ts.length?p+'%':''}</span>
        <span class="tl-now" style="left:${now}%"></span></span>
      <span class="ct" style="flex:0 0 78px;text-align:right">${ts.length} việc</span></div>`;
  }).join('');

  const hd=`<div class="tl-hd"><span class="tl-nm"></span>
    <span style="flex:1;display:flex">${months.map(m=>
      `<span style="flex:1;text-align:center">T${m.getMonth()+1}/${String(m.getFullYear()).slice(2)}</span>`).join('')}</span>
    <span style="flex:0 0 78px"></span></div>`;

  if(TLTAB==='sprint'){
    const v=viewSprints();
    return ph('Tiến độ & đợt việc','Chia guồng việc thành từng đợt hai tuần',
      `<button class="btn btn-pri btn-sm" id="newSprint">${icon('i-plus')}Tạo đợt</button>`)
      + tlTabs() + v.slice(v.indexOf('<div class="grid2"'));
  }
  return ph('Tiến độ & đợt việc','Dòng thời gian dự án và các đợt công việc · vạch đỏ là hôm nay')
    + tlTabs() + `
  <div class="panel"><div class="panel-h"><b>Dự án</b><small>${list.length}</small></div>
    <div class="panel-b tl"><div class="tl-in">${hd}${rows}</div></div></div>
  <div class="panel"><div class="panel-h"><b>Đợt công việc</b><small>${SPRINTS.length} đợt</small></div>
    <div class="panel-b tl"><div class="tl-in">${hd}${spRows}</div></div></div>`;
}

/* ═════════ CÔNG VIỆC ═════════ */
function viewTasks(){
  const mine=PTAB==='mine', watch=PTAB==='high';
  let list=TASKS.filter(inProj);
  if(mine) list=list.filter(t=>(t.owner||'').includes(ME.name));
  if(watch) list=list.filter(t=>t.priority==='Cao'&&tgrp(t)!=='Hoàn thành');
  if(QUERY) list=list.filter(t=>(t.name||'').toLowerCase().includes(QUERY));
  const all=TASKS.filter(inProj);
  const done=list.filter(t=>tgrp(t)==='Hoàn thành').length;

  const head = ph('Quản lý công việc',
    `${list.length} việc · ${done} hoàn thành`,
    `<div class="segbtn">
      <button data-mode="list" class="${TMODE==='list'?'on':''}">${icon('i-list')}Danh sách</button>
      <button data-mode="kanban" class="${TMODE==='kanban'?'on':''}">${icon('i-board')}Kanban</button>
      <button data-mode="cal" class="${TMODE==='cal'?'on':''}">${icon('i-cal')}Lịch</button>
    </div>`) +
    `<div class="tabs">
      <button data-tab="all" class="${PTAB==='all'?'on':''}">${icon('i-list')}Tất cả (${all.length})</button>
      <button data-tab="mine" class="${PTAB==='mine'?'on':''}">${icon('i-hand')}Của tôi (${
        all.filter(t=>(t.owner||'').includes(ME.name)).length})</button>
      <button data-tab="high" class="${PTAB==='high'?'on':''}">${icon('i-fire')}Ưu tiên cao (${
        all.filter(t=>t.priority==='Cao'&&tgrp(t)!=='Hoàn thành').length})</button>
    </div>
    <div class="bar-row">
      <select id="fSt"><option value="">Mọi trạng thái</option>${TST.map(x=>`<option>${x.s}</option>`).join('')}</select>
      <select id="fPri"><option value="">Mọi ưu tiên</option><option>Cao</option><option>Trung bình</option><option>Thấp</option></select>
      <select id="fOwn"><option value="">Mọi người</option>${MEMBERS.map(m=>`<option>${esc(m.name)}</option>`).join('')}</select>
      <select id="fArea"><option value="">Mọi mảng</option>${[...new Set(all.map(t=>t.area).filter(Boolean))]
        .map(a=>`<option>${esc(a)}</option>`).join('')}</select>
      <button class="btn btn-pri btn-sm" id="newTask">${icon('i-plus')}Tạo việc</button>
    </div>`;
  const pend=TASKS.filter(t=>inProj(t)&&tgrp(t)==='Chờ duyệt');
  const pendBox=pend.length?`
    <div class="pend"><div class="pend-h">${icon('i-clock')} Công việc chờ duyệt
      <span class="pend-n">${pend.length} yêu cầu chưa vào danh sách chính thức</span></div>
      ${pend.slice(0,3).map(t=>{const pr=PROJECTS.find(x=>x.id===t.project_id)||{};
        return `<div class="pend-i"><div class="pend-t">
          <b>${esc(t.name)}</b>
          <small>Dự án: ${esc(pr.name||'—')} · Người xử lý: ${esc(t.owner||'—')}
            · Người giao: ${esc(t.assigner||t.reporter||'—')} · Hạn: ${fdate2(t.due)}</small></div>
          <div class="pend-a">
            <button class="btn btn-pri btn-sm" data-tok="${t.id}">${icon('i-check')}Duyệt</button>
            <button class="btn btn-gh btn-sm" data-tfix="${t.id}">${icon('i-loop')}Yêu cầu chỉnh sửa</button>
            <button class="btn btn-gh btn-sm danger" data-tno="${t.id}">${icon('i-x')}Huỷ</button>
          </div></div>`;}).join('')}</div>`:'';
  return head + pendBox + `<div id="taskBody"></div>`;
}

function drawTasks(){
  const box=document.getElementById('taskBody'); if(!box) return;
  const g=id=>{const e=document.getElementById(id);return e?e.value:'';};
  let list=byScope(TASKS.filter(inProj),'task.view','owner');
  if(PTAB==='mine') list=list.filter(t=>(t.owner||'').includes(ME.name));
  if(PTAB==='high') list=list.filter(t=>t.priority==='Cao'&&tgrp(t)!=='Hoàn thành');
  list=list.filter(t=>(!g('fSt')||tgrp(t)===g('fSt'))&&(!g('fPri')||t.priority===g('fPri'))
    &&(!g('fOwn')||(t.owner||'').includes(g('fOwn')))&&(!g('fArea')||t.area===g('fArea'))
    &&(!QUERY||(t.name||'').toLowerCase().includes(QUERY)));

  if(TMODE==='kanban'){
    const cols=['Chưa bắt đầu','Đang làm','Chờ duyệt','Hoàn thành'];
    box.innerHTML=`<div class="board" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${cols.map((c,i)=>{const l=list.filter(t=>tgrp(t)===c);
        const cls=['s-gray','s-blue','s-amber','s-green'][i];
        return `<div class="col"><div class="col-h ${cls}"><span>${c}</span>
          <span class="col-n">${l.length}</span></div><div class="col-b">
          ${l.length?l.map(t=>`<div class="card" data-task="${t.id}"><b>${esc(t.name)}</b>
            <small>${esc(t.owner||'—')} · ${fdate(t.due)}
            ${t.priority==='Cao'?'<span class="pill pill-s s-red">Cao</span>':''}</small></div>`).join('')
          :'<div class="empty">Trống</div>'}</div></div>`;}).join('')}</div>`;
  } else if(TMODE==='cal'){
    box.innerHTML=calGrid(list.map(t=>({id:t.id,k:'task',d:t.due,t:t.name,cls:tcls(t)})));
  } else {
    box.innerHTML=`<div class="panel"><div class="panel-h"><b>Danh sách</b>
      <small>${list.length} việc</small></div><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th class="num">#</th><th>Tiêu đề</th><th>Trạng thái</th><th>Ưu tiên</th>
        <th>Người xử lý</th><th>Người giao</th><th>Mảng</th><th>Hạn</th></tr></thead><tbody>
      ${list.length?list.map((t,i)=>`<tr data-task="${t.id}">
        <td class="num">${i+1}</td><td class="tt">${esc(t.name)}</td>
        <td><span class="pill ${tcls(t)}">${esc(t.status)}</span></td>
        <td><span class="pill ${PRI[t.priority]||'s-gray'}">${esc(t.priority||'—')}</span></td>
        <td>${whoCell(t.owner)}</td><td>${whoCell(t.assigner||t.reporter)}</td>
        <td><span class="pill pill-s s-gray">${esc(t.area||'—')}</span></td>
        <td>${dueChip(t.due,null,tgrp(t)==='Hoàn thành')}</td></tr>`).join('')
      :'<tr><td colspan="8" class="empty">Không có việc nào khớp bộ lọc</td></tr>'}
      </tbody></table></div></div>`;
  }
  bindAll();
}

function calGrid(items){
  const y=CAL.getFullYear(), m=CAL.getMonth();
  const first=new Date(y,m,1), start=new Date(first);
  start.setDate(1-((first.getDay()+6)%7));
  const cells=[]; for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells.push(d);}
  const tstr=iso(new Date());
  const body=cells.map(d=>{
    const key=iso(d), out=d.getMonth()!==m;
    const ev=items.filter(x=>x.d===key);
    return `<div class="cal-d ${out?'out':''} ${key===tstr?'today':''}">
      <div class="cal-n">${d.getDate()}
        <button class="cal-add" data-newday="${key}" title="Thêm vào ngày này">+</button></div>
      ${ev.map(x=>`<span class="cal-e ${x.cls}" data-${x.k}="${x.id}">${esc(x.t)}</span>`).join('')}</div>`;
  }).join('');
  return `<div class="panel"><div class="panel-h"><b>Tháng ${m+1} / ${y}</b>
    <span style="display:flex;gap:7px"><button class="btn btn-gh btn-sm" id="calPrev">←</button>
    <button class="btn btn-gh btn-sm" id="calNext">→</button></span></div>
    <div class="panel-b">
      <div class="cal">${['Hai','Ba','Tư','Năm','Sáu','Bảy','CN'].map(x=>`<div class="cal-hd">${x}</div>`).join('')}</div>
      <div class="cal" style="margin-top:4px">${body}</div></div></div>`;
}

/* ═════════ ĐỢT CÔNG VIỆC ═════════ */
function viewSprints(){
  return ph('Đợt công việc','Chia guồng việc thành từng đợt hai tuần để dễ theo dõi',
    `<button class="btn btn-pri btn-sm" id="newSprint">${icon('i-plus')}Tạo đợt</button>`) +
  `<div class="grid2">${SPRINTS.map(s=>{
    const ts=TASKS.filter(t=>t.sprint_id===s.id&&inProj(t)&&tgrp(t)!=='Không áp dụng');
    const dn=ts.filter(t=>tgrp(t)==='Hoàn thành').length;
    const p=ts.length?Math.round(dn/ts.length*100):0;
    const lt=ts.filter(lateTask).length;
    const est=ts.reduce((a,t)=>a+(t.est||0),0);
    return `<div class="panel" data-sprint="${s.id}" style="cursor:pointer"><div class="panel-h">
      <b>${icon('i-bolt')}${esc(s.name)}</b>
      <span class="pill ${s.status==='Đang chạy'?'s-pri':s.status==='Đã kết thúc'?'s-green':'s-gray'}">${esc(s.status)}</span></div>
      <div class="panel-b">
        <div class="ct" style="margin-bottom:8px">${fdate2(s.start)} → ${fdate2(s.end)}${s.goal?' · '+esc(s.goal):''}</div>
        <div class="prow" style="border:0" data-sprint="${s.id}"><span class="nm" style="flex:0 0 auto">Hoàn thành</span>
          <span class="bar" style="flex:1"><i class="${p===100?'ok':''}" style="width:${p}%"></i></span>
          <span class="pct">${p}%</span></div>
        <div class="mtr"><div><span>Đầu việc</span><b>${ts.length}</b></div>
          <div><span>Đã xong</span><b style="color:var(--green)">${dn}</b></div>
          <div><span>Quá hạn</span><b style="color:var(--red)">${lt}</b></div>
          <div><span>Ước tính</span><b>${est}h</b></div></div>
        ${ts.length?`<div class="tlist" style="margin:10px -16px -14px">
          ${ts.slice(0,5).map(taskRow).join('')}</div>`:''}
      </div></div>`;
  }).join('')}</div>`;
}


/* ─── Thanh kênh ngang: dùng chung cho các màn hình nội dung ─── */
let CHFIL = 0;
function chBar(){
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
  const tot=POSTS.filter(p=>!DONE.includes(p.status)).length;
  const pills=CHANNELS.map((c,i)=>{
    const all=POSTS.filter(p=>p.channel===c.name);
    const open=all.filter(p=>!DONE.includes(p.status)).length;
    const n=all.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
    const t=c.target_week||0;
    const cls=t===0?'':(n>=t?'ok':'warn');
    const own=(c.stream==='tiktok')?deskOwner('tiktok'):deskOwner('social');
    return `<button class="chpill ${cls} ${CHFIL===c.id?'on':''}" data-chfil="${c.id}">
      <span class="cd" style="background:${CHCOL[i%CHCOL.length]}"></span>
      <span><b>${esc(c.name)}</b><small style="display:block">${esc(own||'')} · ${n}/${t} tuần</small></span>
      <span class="cn">${open}</span></button>`;}).join('');
  return `<div class="chbar">
    <button class="chpill ${!CHFIL?'on':''}" data-chfil="0">
      <span class="cd" style="background:var(--ink3)"></span>
      <span><b>Tất cả kênh</b><small style="display:block">${CHANNELS.length} kênh</small></span>
      <span class="cn">${tot}</span></button>${pills}</div>`;
}

/* ═════════ BÀI ĐĂNG ═════════ */
function viewPosts(){
  return ph('Bài đăng','Toàn bộ nội dung của phòng trên '+CHANNELS.length+' kênh',
    `<button class="btn btn-pri btn-sm" id="newPost">${icon('i-plus')}Bài mới</button>`) + chBar() + `
  <div class="bar-row">
    <select id="pWho"><option value="">Mọi người</option>${MEMBERS.map(m=>`<option>${esc(m.name)}</option>`).join('')}</select>
    <select id="pSt"><option value="">Mọi chặng</option>${FLOW.map(f=>`<option>${esc(f.s)}</option>`).join('')}</select>
  </div>
  <div class="panel"><div class="panel-h"><b>Danh sách</b><small id="pCnt"></small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="num">#</th><th>Tiêu đề</th><th>Chặng</th><th>Kênh</th>
      <th>Người viết</th><th>Thiết kế</th><th>Đang giữ</th><th>Ngày đăng</th></tr></thead>
      <tbody id="pRows"></tbody></table></div></div>`;
}
function drawPosts(){
  const box=document.getElementById('pRows'); if(!box) return;
  const g=id=>{const e=document.getElementById(id);return e?e.value:'';};
  const chn=CHFIL?(CHANNELS.find(c=>c.id===CHFIL)||{}).name:'';
  const list=POSTS.filter(p=>(!chn||p.channel===chn)
    &&(!g('pWho')||p.writer===g('pWho')||p.editor===g('pWho')||holder(p)===g('pWho'))
    &&(!g('pSt')||p.status===g('pSt'))
    &&(!QUERY||(p.title||'').toLowerCase().includes(QUERY)));
  document.getElementById('pCnt').textContent=list.length+' bài';
  box.innerHTML=list.length?list.map((p,i)=>`<tr data-post="${p.id}">
    <td class="num">${i+1}</td><td class="tt">${esc(p.title)}</td>
    <td><span class="pill ${F(p.status).cls}">${F(p.status).ic} ${esc(p.status)}</span></td>
    <td><span class="pill pill-s s-gray">${esc(p.channel||'—')}</span></td>
    <td>${whoCell(p.writer)}</td>
    <td>${p.editor&&p.editor!=='Không cần'?whoCell(p.editor):'<span style="color:var(--ink3)">—</span>'}</td>
    <td>${holder(p)?`<span class="pill pill-s s-pri">${esc(holder(p))}</span>`:'<span style="color:var(--ink3)">—</span>'}</td>
    <td>${dueChip(p.pub_date,p.pub_time,p.status==='Đã đăng')}</td></tr>`).join('')
    :'<tr><td colspan="8" class="empty">Không có bài nào khớp bộ lọc</td></tr>';
  bindAll();
}

/* ═════════ LỊCH ĐĂNG ═════════ */
function viewCal(){
  const chn=CHFIL?(CHANNELS.find(c=>c.id===CHFIL)||{}).name:'';
  const src=POSTS.filter(p=>!chn||p.channel===chn);
  const y=CAL.getFullYear(),mo=CAL.getMonth();
  const inMonth=src.filter(p=>p.pub_date&&new Date(p.pub_date).getMonth()===mo
    &&new Date(p.pub_date).getFullYear()===y);
  return ph('Lịch đăng','Cả tháng trên '+CHANNELS.length+' kênh · bấm ngày trống để thêm bài',
    `<button class="btn btn-pri btn-sm" id="calNew">${icon('i-plus')}Tạo nội dung</button>`)
    + `<div class="chips">
        <span class="chipx blue">Bài trong tháng: <b>${inMonth.length}</b></span>
        <span class="chipx green">Đã đăng: <b>${inMonth.filter(p=>p.status==='Đã đăng').length}</b></span>
        <span class="chipx amber">Đang sản xuất: <b>${inMonth.filter(p=>!DONE.includes(p.status)).length}</b></span>
        <span class="chipx red">Quá hạn: <b>${inMonth.filter(latePost).length}</b></span>
        <span class="chipx tot">Ngày có bài: <b>${new Set(inMonth.map(p=>p.pub_date)).size}</b></span>
      </div>`
    + chBar() + calGrid(src.map(p=>({id:p.id,k:'post',d:p.pub_date,
      t:(p.pub_time?p.pub_time+' ':'')+p.title,cls:F(p.status).cls})));
}

/* ═════════ KÊNH — trung tâm điều phối ═════════ */
let CHTAB='list';
const chTabs=()=>`<div class="tabs">
  <button data-chtab="list" class="${CHTAB==='list'?'on':''}">${icon('i-signal')}Danh sách kênh</button>
  <button data-chtab="metric" class="${CHTAB==='metric'?'on':''}">${icon('i-chart')}Chỉ số hiệu quả</button></div>`;
function viewChannels(){
  if(CHTAB==='metric') return viewMetrics();
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
  const groups={};
  CHANNELS.forEach(c=>{(groups[c.platform]=groups[c.platform]||[]).push(c);});
  const totBud=CHANNELS.reduce((s,c)=>s+(c.budget_month||0),0);
  const totSpent=CHANNELS.reduce((s,c)=>s+(c.spent_month||0),0);
  const behind=CHANNELS.filter(c=>{
    const n=POSTS.filter(p=>p.channel===c.name&&p.pub_date&&new Date(p.pub_date)>=wk).length;
    return (c.target_week||0)>n;});

  const card=(c,i)=>{
    const P=PLAT[c.platform]||{};
    const all=POSTS.filter(p=>p.channel===c.name);
    const n=all.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
    const t=c.target_week||0, pc=t?Math.min(100,Math.round(n/t*100)):0;
    const posted=all.filter(p=>p.status==='Đã đăng');
    const v=posted.reduce((s,x)=>s+(x.views||0),0);
    const own=c.owner_content||((c.stream==='tiktok')?deskOwner('tiktok'):deskOwner('social'));
    const dsn=c.owner_design||deskOwner('design');
    const bud=c.budget_month||0, sp=c.spent_month||0;
    return `<div class="panel" style="margin:0">
      <div class="panel-h" style="border-left:3px solid ${P.color||'#999'}">
        <b>${esc(c.name)}</b>
        <span class="pill pill-s ${pc>=100?'s-green':pc>=50?'s-amber':'s-red'}">${n}/${t} bài tuần</span></div>
      <div class="panel-b" style="padding-bottom:10px">
        <div class="prow" style="border:0;padding:0 0 9px">
          <span class="bar" style="flex:1"><i class="${pc>=100?'ok':pc>=50?'':'warn'}" style="width:${pc}%"></i></span>
          <span class="pct">${pc}%</span></div>
        <div class="chrole">
          <div class="chrole-i"><span class="lb">Phụ trách nội dung</span>
            <span class="vl">${avat(own)}${esc(own||'—')}</span></div>
          <div class="chrole-i"><span class="lb">Phụ trách thiết kế</span>
            <span class="vl">${avat(dsn)}${esc(dsn||'—')}</span></div>
        </div>
        <div class="mtr" style="margin-top:10px">
          <div><span>Đang chạy</span><b>${all.filter(p=>!DONE.includes(p.status)).length}</b></div>
          <div><span>Đã đăng</span><b>${posted.length}</b></div>
          <div><span>Lượt xem</span><b>${kf(v)}</b></div>
          <div><span>Follow</span><b>${kf(c.followers)}</b></div></div>
        ${bud?`<div class="prow" style="margin-top:9px"><span class="nm">${icon('i-money')}Ngân sách tháng</span>
          <span class="ct">${mshort(sp)} / ${mshort(bud)}</span>
          <span class="bar" style="flex:0 0 64px"><i class="${sp>bud?'bad':'ok'}" style="width:${bud?Math.min(100,sp/bud*100):0}%"></i></span></div>`:''}
      </div>
      <div class="pcard-f">
        <span style="display:flex;gap:12px">
          <span data-newpost="${esc(c.name)}" style="cursor:pointer;color:var(--pri)">+ Tạo nội dung</span>
          <span data-chedit="${c.id}" style="cursor:pointer;color:var(--pri)">Cấu hình</span></span>
        <span data-chan="${c.id}" style="cursor:pointer">Xem bài →</span></div></div>`;
  };

  return ph('Kênh & chỉ số',
    CHANNELS.length+' kênh trên '+Object.keys(groups).length+' nền tảng · mỗi kênh có người phụ trách, mục tiêu và ngân sách riêng',
    `<button class="btn btn-pri btn-sm" id="newChan">${icon('i-plus')}Thêm kênh</button>`) + chTabs() + `
  <div class="kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))">
    ${kpi('pri','i-signal','Số kênh',CHANNELS.length,Object.keys(groups).length+' nền tảng')}
    ${kpi('teal','i-users','Tổng follow',kf(CHANNELS.reduce((s,c)=>s+(c.followers||0),0)))}
    ${kpi('blue','i-target','Mục tiêu bài/tuần',CHANNELS.reduce((s,c)=>s+(c.target_week||0),0))}
    ${kpi('amber','i-alert','Kênh hụt nhịp',behind.length,behind.length?'cần dồn nội dung':'đều đạt')}
    ${kpi('green','i-money','Ngân sách tháng',mshort(totBud),mshort(totSpent)+' đã chi',
      totBud?Math.round(totSpent/totBud*100):0)}
  </div>
  ${Object.entries(groups).map(([pl,list])=>{
    const P=PLAT[pl]||{};
    return `<div class="plat-head">
      <span class="plat-ic" style="background:${P.color||'#999'}15;color:${P.color||'#666'}">${icon(P.ic||'i-signal')}</span>
      <span><b>${esc(pl)}</b><small>${list.length} kênh · phụ trách ${
        esc(list[0].stream==='tiktok'?deskOwner('tiktok'):deskOwner('social'))}</small></span>
      <button class="btn btn-gh btn-sm" data-newch-plat="${esc(pl)}">${icon('i-plus')}Thêm kênh ${esc(pl)}</button>
    </div>
    <div class="chgrid">${list.map(card).join('')}</div>`;}).join('')}`;
}

function openChanEdit(id){
  const c=id?CHANNELS.find(x=>x.id===id):null;
  const isNew=!c;
  const d=c||{platform:'TikTok',target_week:3,followers:0,priority:'CAO'};
  openDrawer(`<div class="dr-code">${isNew?'Thêm kênh mới':'Cấu hình kênh'}</div>
    <div class="dr-title">${isNew?'Kênh mới':esc(c.name)}</div>
    <div class="dr-lab" style="margin-top:14px">Nền tảng</div>
    <div class="chpick">${PLAT_NAMES.map(p=>{const P=PLAT[p];
      return `<button class="chp ${p===d.platform?'on':''}" data-plat="${esc(p)}">
        <span class="chp-d" style="background:${P.color}"></span>
        <span><b>${esc(p)}</b><small>${P.fmts.length} định dạng</small></span></button>`;}).join('')}</div>
    <input type="hidden" id="cPlat" value="${esc(d.platform)}">
    <div class="dr-lab">Tên kênh</div>
    <input type="text" id="cName" class="fld" value="${esc(d.name||'')}" placeholder="@tenkenh hoặc Fanpage ABC">
    <div class="dr-lab">Vai trò của kênh</div>
    <input type="text" id="cRole" class="fld" value="${esc(d.role||'')}" placeholder="Kênh chính bán hàng / kênh phụ nuôi tệp…">
    <div class="two"><div><div class="dr-lab">Phụ trách nội dung</div>
      <select id="cOwnC" class="fld">${MEMBERS.filter(m=>m.kind!=='design').map(m=>
        `<option ${m.name===(d.owner_content||'')?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Phụ trách thiết kế</div>
      <select id="cOwnD" class="fld">${MEMBERS.filter(m=>m.kind==='design').map(m=>
        `<option ${m.name===(d.owner_design||'')?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div></div>
    <div class="two"><div><div class="dr-lab">Mục tiêu bài / tuần</div>
      <input type="number" id="cTgt" class="fld" value="${d.target_week||0}"></div>
      <div><div class="dr-lab">Số follow hiện tại</div>
      <input type="number" id="cFol" class="fld" value="${d.followers||0}"></div></div>
    <div class="two"><div><div class="dr-lab">Mức ưu tiên</div>
      <select id="cPri" class="fld">${['RẤT CAO','CAO','TRUNG BÌNH','THẤP'].map(x=>
        `<option ${x===d.priority?'selected':''}>${x}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Ngân sách quảng cáo / tháng</div>
      <input type="number" id="cBud" class="fld" value="${d.budget_month||0}"></div></div>
    <div class="dr-lab">Style / tông nội dung</div>
    <textarea id="cStyle" placeholder="Giọng điệu, khung hình, điều nên và không nên…">${esc(d.style||'')}</textarea>
    <button class="btn btn-pri btn-full" id="cSave">${isNew?'Tạo kênh':'Lưu cấu hình'}</button>
    ${!isNew?`<div class="act-row" style="margin-top:10px">
      <button class="btn btn-gh" id="cPost">${icon('i-plus')}Tạo nội dung</button>
      <button class="btn btn-gh" id="cView">${icon('i-eye')}Xem bài</button>
      <button class="btn btn-gh danger" id="cDel">${icon('i-trash')}Xoá kênh</button></div>`:''}`);
  document.querySelectorAll('[data-plat]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-plat]').forEach(x=>x.classList.toggle('on',x===b));
    document.getElementById('cPlat').value=b.dataset.plat;});
  document.getElementById('cSave').onclick=async()=>{
    if(!V('cName')){toast('Nhập tên kênh đã nhé');return;}
    const pl=document.getElementById('cPlat').value;
    const row={name:V('cName'),platform:pl,stream:(PLAT[pl]||{}).stream||'social',
      role:V('cRole')||null,owner_content:V('cOwnC'),owner_design:V('cOwnD'),
      target_week:+V('cTgt')||0,followers:+V('cFol')||0,priority:V('cPri'),
      budget_month:+V('cBud')||0,style:V('cStyle')||null};
    if(isNew) await add('channels',{...row,spent_month:0},'Đã thêm kênh '+row.name);
    else await save('channels',id,row,'Đã lưu cấu hình kênh');
  };
  if(!isNew){
    const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
    on('cPost',()=>openNewPost(c.name));
    on('cView',()=>openChan(id));
    on('cDel',async()=>{
      const n=POSTS.filter(p=>p.channel===c.name).length;
      if(!confirm('Xoá kênh "'+c.name+'"?'+(n?'\n'+n+' bài đăng của kênh này sẽ không còn kênh.':'')))return;
      await sb.from('channels').delete().eq('id',id);
      toast('Đã xoá kênh'); closeDrawer(); await loadAll();});
  }
}

/* ═════════ BÀN LÀM VIỆC ═════════ */
let DTAB='queue';
function viewDesk(k){
  const d=DESKS[k]; if(!d) return '';
  const who=deskOwner(k), all=deskPosts(k);
  const open=all.filter(p=>!DONE.includes(p.status));
  const mine=open.filter(p=>holds(p,who));
  const posted=all.filter(p=>p.status==='Đã đăng');
  const tk=TASKS.filter(t=>(t.owner||'').includes(who)&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  const lateN=mine.filter(latePost).length+open.filter(p=>lateDesign(p)&&p.editor===who).length;

  const queues = d.kind==='content' ? [
    {t:'Cần bắt tay vào viết',ic:'i-pen',c:'pri',
     l:open.filter(p=>['Đang viết','Cần chỉnh sửa'].includes(norm(p.status))&&holds(p,who))},
    {t:'Đã gửi Leader, chờ duyệt',ic:'i-clock',c:'amber',
     l:open.filter(p=>['Chờ duyệt nội dung','Chờ duyệt ấn phẩm'].includes(norm(p.status)))},
    {t:'Đang nằm ở bên thiết kế',ic:'i-brush',c:'pink',
     l:open.filter(p=>norm(p.status)==='Đang thiết kế')},
  ] : [
    {t:'Việc mới được giao — chờ nhận',ic:'i-inbox',c:'teal',
     l:open.filter(p=>norm(p.status)==='Đang thiết kế'&&p.editor===who&&!p.design_started)},
    {t:'Đang làm',ic:'i-brush',c:'pink',
     l:open.filter(p=>norm(p.status)==='Đang thiết kế'&&p.editor===who&&p.design_started)},
    {t:'Đã gửi Leader duyệt',ic:'i-clock',c:'amber',
     l:open.filter(p=>norm(p.status)==='Chờ duyệt ấn phẩm'&&p.editor===who)},
  ];

  /* nút hành động ngay trên dòng, không phải mở drawer mới làm được */
  const qrow=p=>{
    const f=F(p.status), dn=dd(p.pub_date), dsn=p.design_due?dd(p.design_due):null;
    const isD=d.kind==='design';
    let act='',aid='';
    if(isD&&norm(p.status)==='Đang thiết kế'&&!p.design_started){act='Nhận việc';aid='qk-take';}
    else if(isD&&norm(p.status)==='Đang thiết kế'&&p.design_started){act='Gửi duyệt';aid='qk-send';}
    else if(!isD&&['Đang viết','Cần chỉnh sửa'].includes(norm(p.status))){act='Gửi duyệt';aid='qk-tosub';}
    const late=isD?(dsn!==null&&dsn<0&&!p.design_done):latePost(p);
    const stamp=isD?(dsn===null?'—':dsn<0?`trễ ${-dsn} ngày`:dsn===0?'hạn hôm nay':`còn ${dsn} ngày`)
      :(dn===null?'—':dn<0?`trễ ${-dn} ngày`:dn===0?'đăng hôm nay':`còn ${dn} ngày`);
    return `<div class="qrow">
      <span class="pill ${f.cls}">${f.ic} ${esc(p.status)}</span>
      <span class="qt" data-post="${p.id}"><b>${esc(p.title)}</b>
        <small>${esc(p.channel||'')} · ${esc(p.writer||'')}${
          p.editor&&p.editor!=='Không cần'?' → '+esc(p.editor):''}
          ${isD&&!(p.brief||p.brief_link)?'<span class="pill pill-s s-red">thiếu brief</span>':''}</small></span>
      <span class="qr"><span class="due ${late?'late':''}">${stamp}</span>
        ${act?`<button class="todo-b" data-q="${aid}:${p.id}">${act}</button>`:''}</span></div>`;};

  const queueHtml=`<div class="grid2">${queues.map(q=>`<div class="panel">
    <div class="panel-h"><b><span class="qi t-${q.c}" style="width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center">${icon(q.ic)}</span>${esc(q.t)}</b>
      <small>${q.l.length}</small></div>
    <div>${q.l.length?q.l.map(qrow).join(''):'<div class="empty" style="padding:22px">Trống</div>'}</div>
    </div>`).join('')}</div>`;

  /* tab kênh / định dạng */
  let catHtml;
  if(d.kind==='content'){
    const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
    catHtml=`<div class="grid2">${CHANNELS.filter(c=>(c.stream||'social')===k).map((c,i)=>{
      const l=POSTS.filter(p=>p.channel===c.name);
      const n=l.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
      const t=c.target_week||0, pc=t?Math.min(100,Math.round(n/t*100)):0;
      const op=l.filter(p=>!DONE.includes(p.status));
      const v=l.filter(p=>p.status==='Đã đăng').reduce((s,x)=>s+(x.views||0),0);
      return `<div class="panel"><div class="panel-h">
        <b><span class="cd" style="width:9px;height:9px;border-radius:50%;background:${CHCOL[i%CHCOL.length]}"></span>${esc(c.name)}</b>
        <span class="pill pill-s ${pc>=100?'s-green':pc>=50?'s-amber':'s-red'}">${n}/${t} bài tuần này</span></div>
        <div class="panel-b" style="padding-bottom:8px">
          <div class="prow" style="border:0;padding:0 0 8px">
            <span class="bar" style="flex:1"><i class="${pc>=100?'ok':pc>=50?'':'warn'}" style="width:${pc}%"></i></span>
            <span class="pct">${pc}%</span></div>
          <div class="mtr" style="margin-top:0">
            <div><span>Đang chạy</span><b>${op.length}</b></div>
            <div><span>Đã đăng</span><b>${l.filter(p=>p.status==='Đã đăng').length}</b></div>
            <div><span>Lượt xem</span><b>${kf(v)}</b></div>
            <div><span>Follow</span><b>${kf(c.followers)}</b></div></div></div>
        ${op.length?`<div class="tlist">${op.slice(0,3).map(p=>postRow(p,false)).join('')}</div>`:''}
        <div class="pcard-f"><span data-chan="${c.id}" style="cursor:pointer;color:var(--pri)">Xem hồ sơ kênh →</span>
          <span>${esc(c.priority||'')}</span></div></div>`;}).join('')}</div>`;
  } else {
    const fmts=[...new Set(all.map(p=>p.fmt).filter(Boolean))];
    catHtml=`<div class="panel"><div class="panel-h"><b>Theo định dạng ấn phẩm</b>
      <small>tỉ lệ đã bàn giao</small></div><div class="panel-b">
      ${fmts.map(f=>{const l=all.filter(p=>p.fmt===f);
        const dn=l.filter(p=>['Chờ duyệt thiết kế','Đã lên lịch','Đã đăng'].includes(p.status)).length;
        const pc=l.length?Math.round(dn/l.length*100):0;
        return `<div class="prow"><span class="nm">${icon('i-brush')}${esc(f)}</span>
          <span class="ct">${dn}/${l.length} đã xong</span>
          <span class="bar"><i class="${pc===100?'ok':''}" style="width:${pc}%"></i></span>
          <span class="pct">${pc}%</span></div>`;}).join('')||'<div class="empty">Chưa có dữ liệu</div>'}
      </div></div>`;
  }

  const taskHtml=`<div class="panel"><div class="panel-h"><b>Đầu việc dự án của ${esc(who)}</b>
    <small>${tk.length} việc</small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="num">#</th><th>Tiêu đề</th><th>Trạng thái</th><th>Ưu tiên</th><th>Dự án</th><th>Hạn</th>
      </tr></thead><tbody>${tk.length?tk.map((t,i)=>{
        const pr=PROJECTS.find(x=>x.id===t.project_id)||{};
        return `<tr data-task="${t.id}"><td class="num">${i+1}</td><td class="tt">${esc(t.name)}</td>
        <td><span class="pill ${tcls(t)}">${esc(t.status)}</span></td>
        <td><span class="pill ${PRI[t.priority]||'s-gray'}">${esc(t.priority||'—')}</span></td>
        <td><span class="ct">${esc(pr.code||'—')}</span></td>
        <td class="due ${lateTask(t)?'late':''}">${fdate(t.due)}</td></tr>`;}).join('')
      :'<tr><td colspan="6" class="empty">Không có đầu việc nào</td></tr>'}</tbody></table></div></div>`;

  const doneHtml=`<div class="panel"><div class="panel-h"><b>Đã đăng</b><small>${posted.length} bài</small></div>
    <div class="tlist">${posted.length?posted.map(p=>`<div class="titem" data-post="${p.id}">
      <span class="pill s-green">✅</span>
      <div class="tn"><b>${esc(p.title)}</b><small>${esc(p.channel||'')} · ${fdate(p.pub_date)}</small></div>
      <span class="ct">${kf(p.views)} view</span></div>`).join(''):'<div class="empty">Chưa có bài nào đăng</div>'}</div></div>`;

  const body={queue:queueHtml,cat:catHtml,task:taskHtml,done:doneHtml}[DTAB]||queueHtml;

  return ph(d.name+(who?' — '+who:''), d.desc) + `
  <div class="kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))">
    ${kpi('pri','i-hand','Đang ở tay '+(who||'').split(' ').slice(-1)[0],mine.length,'cần bạn xử lý')}
    ${kpi('red','i-alert','Trễ hạn',lateN,lateN?'xử lý trước tiên':'đang đúng tiến độ')}
    ${kpi('blue','i-loop','Đang chạy',open.length,'toàn bộ bàn')}
    ${kpi('green','i-check','Đã đăng',posted.length)}
    ${kpi('gray','i-list','Việc dự án',tk.length)}
  </div>
  <div class="tabs">
    <button data-dtab="queue" class="${DTAB==='queue'?'on':''}">${icon('i-inbox')}Hàng đợi (${
      queues.reduce((s,q)=>s+q.l.length,0)})</button>
    <button data-dtab="cat" class="${DTAB==='cat'?'on':''}">${icon(d.kind==='content'?'i-signal':'i-brush')}${
      d.kind==='content'?'Theo kênh':'Theo định dạng'}</button>
    <button data-dtab="task" class="${DTAB==='task'?'on':''}">${icon('i-check')}Việc dự án (${tk.length})</button>
    <button data-dtab="done" class="${DTAB==='done'?'on':''}">${icon('i-check')}Đã đăng (${posted.length})</button>
  </div>
  ${body}`;
}

/* ─── Sửa · Lưu trữ · Xoá ─── */
function rowActions(kind,id){
  const canDel=can(kind==='tasks'?'task.delete':'post.create');
  return `<div class="dr-lab">Thao tác</div>
    <div class="act-row${canDel?'':' two-col'}">
      <button class="btn btn-gh" id="axEdit">${icon('i-pen')}Sửa</button>
      <button class="btn btn-gh" id="axArch">${icon('i-box')}Lưu trữ</button>
      ${canDel?`<button class="btn btn-gh danger" id="axDel">${icon('i-trash')}Xoá</button>`:''}
    </div>${canDel?'':`<div class="permhint">${icon('i-alert')}Vai trò ${esc(myRole())} không có quyền xoá — liên hệ Leader nếu cần.</div>`}`;
}
function bindActions(kind,id,item){
  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  on('axEdit',()=>kind==='tasks'?editTask(item):editPost(item));
  on('axArch',async()=>{
    if(!confirm('Đưa "'+(item.name||item.title)+'" vào lưu trữ?\nCó thể khôi phục ở mục Lưu trữ.'))return;
    await save(kind,id,{archived:true},'Đã đưa vào lưu trữ');});
  on('axDel',async()=>{
    if(!confirm('Xoá hẳn "'+(item.name||item.title)+'"?\nKhông khôi phục lại được.'))return;
    const {error}=await sb.from(kind).delete().eq('id',id);
    if(error){toast('Lỗi: '+error.message);return;}
    toast('Đã xoá'); closeDrawer(); await loadAll();});
}

function editTask(t){
  openDrawer(`<div class="dr-code">${esc(t.code||'')}</div>
    <div class="dr-title">Sửa đầu việc</div>
    <div class="dr-lab" style="margin-top:14px">Tên việc</div>
    <input type="text" id="eName" class="fld" value="${esc(t.name)}">
    <div class="dr-lab">Mô tả</div><textarea id="eDetail">${esc(t.detail||'')}</textarea>
    <div class="two"><div><div class="dr-lab">Người xử lý</div>
      <select id="eOwn" class="fld">${MEMBERS.map(m=>
        `<option ${(t.owner||'').includes(m.name)?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Dự án</div><select id="eProj" class="fld">${projOpts(t.project_id)}</select></div></div>
    <div class="two"><div><div class="dr-lab">Hạn</div>
      <input type="date" id="eDue" class="fld" value="${t.due||''}"></div>
      <div><div class="dr-lab">Ưu tiên</div><select id="ePri" class="fld">
        ${['Cao','Trung bình','Thấp'].map(x=>`<option ${x===t.priority?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="two"><div><div class="dr-lab">Mảng</div><select id="eArea" class="fld">
        ${['Kế hoạch chung','Content','Thiết kế','Booking KOC/KOL','Chiến dịch','App bán hàng','Giao việc nội bộ']
          .map(a=>`<option ${a===t.area?'selected':''}>${a}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Ước tính (giờ)</div>
        <input type="number" id="eEst" class="fld" value="${t.est||4}"></div></div>
    <button class="btn btn-pri btn-full" id="eSave">Lưu thay đổi</button>
    <button class="btn btn-gh btn-full" style="margin-top:8px" id="eBack">Quay lại</button>`);
  document.getElementById('eSave').onclick=()=>{
    if(!V('eName')){toast('Tên việc không được để trống');return;}
    save('tasks',t.id,{name:V('eName'),detail:V('eDetail')||null,owner:V('eOwn'),
      project_id:+V('eProj'),due:V('eDue')||null,priority:V('ePri'),area:V('eArea'),
      est:+V('eEst')||4},'Đã lưu thay đổi');};
  document.getElementById('eBack').onclick=()=>openTask(t.id);
}

function editPost(p){
  openDrawer(`<div class="dr-code">${esc(p.channel||'')}</div>
    <div class="dr-title">Sửa bài đăng</div>
    <div class="dr-lab" style="margin-top:14px">Tiêu đề</div>
    <input type="text" id="eTitle" class="fld" value="${esc(p.title)}">
    <div class="two"><div><div class="dr-lab">Kênh</div>
      <select id="eCh" class="fld">${CHANNELS.map(c=>
        `<option ${c.name===p.channel?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Người viết</div><select id="eW" class="fld">${MEMBERS.filter(m=>m.kind!=='design')
        .map(m=>`<option ${m.name===p.writer?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div></div>
    <div class="two"><div><div class="dr-lab">Thiết kế</div>
      <select id="eE" class="fld"><option>Không cần</option>${MEMBERS.filter(m=>m.kind==='design')
        .map(m=>`<option ${m.name===p.editor?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Định dạng</div><select id="eF" class="fld">
        ${['Video ngắn','Video dài','Ảnh đơn','Album ảnh','Bài viết','Infographic','Livestream','Story']
          .map(x=>`<option ${x===p.fmt?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="two"><div><div class="dr-lab">Ngày đăng</div>
      <input type="date" id="eD" class="fld" value="${p.pub_date||''}"></div>
      <div><div class="dr-lab">Giờ đăng</div>
      <input type="time" id="eT" class="fld" value="${esc(p.pub_time||'')}"></div></div>
    <div><div class="dr-lab">Hạn thiết kế</div>
      <input type="date" id="eDD" class="fld" value="${p.design_due||''}"></div>
    <div class="dr-lab">Brief</div><textarea id="eB">${esc(p.brief||'')}</textarea>
    <div class="dr-lab">Link brief</div>
    <input type="text" id="eBL" class="fld" value="${esc(p.brief_link||'')}">
    <button class="btn btn-pri btn-full" id="ePSave">Lưu thay đổi</button>
    <button class="btn btn-gh btn-full" style="margin-top:8px" id="ePBack">Quay lại</button>`);
  document.getElementById('ePSave').onclick=()=>{
    if(!V('eTitle')){toast('Tiêu đề không được để trống');return;}
    const ch=CHANNELS.find(c=>c.name===V('eCh'))||{};
    save('posts',p.id,{title:V('eTitle'),channel:V('eCh'),channel_id:ch.id||null,
      platform:ch.platform||null,stream:ch.stream||'social',writer:V('eW'),editor:V('eE'),
      fmt:V('eF'),pub_date:V('eD')||null,pub_time:V('eT')||null,design_due:V('eDD')||null,
      brief:V('eB')||null,brief_link:V('eBL')||null},'Đã lưu thay đổi');};
  document.getElementById('ePBack').onclick=()=>openPost(p.id);
}

/* ─── Màn hình Lưu trữ ─── */
function viewArchive(){
  const at=ALL_TASKS.filter(x=>x.archived), ap=ALL_POSTS.filter(x=>x.archived);
  const row=(x,k)=>`<div class="titem">
    <span class="pill s-gray">${esc(x.status)}</span>
    <div class="tn" data-${k==='tasks'?'task':'post'}-arch="${x.id}"><b>${esc(x.name||x.title)}</b>
      <small>${esc(x.area||x.channel||'')} · ${esc(x.owner||x.writer||'')}</small></div>
    <span style="display:flex;gap:6px">
      <button class="btn btn-gh btn-sm" data-restore="${k}:${x.id}">Khôi phục</button>
      <button class="btn btn-gh btn-sm danger" data-purge="${k}:${x.id}">Xoá hẳn</button></span></div>`;
  return ph('Lưu trữ','Việc và bài đã hoàn tất được cất đi — vẫn khôi phục lại được bất cứ lúc nào') + `
  <div class="kpis">
    ${kpi('gray','i-box','Đầu việc đã lưu',at.length)}
    ${kpi('gray','i-pen','Bài đăng đã lưu',ap.length)}
    ${kpi('green','i-check','Đang hoạt động',TASKS.length+POSTS.length)}
  </div>
  <div class="panel"><div class="panel-h"><b>${icon('i-check')} Đầu việc</b><small>${at.length}</small></div>
    <div class="tlist">${at.length?at.map(x=>row(x,'tasks')).join(''):'<div class="empty">Chưa có gì trong lưu trữ</div>'}</div></div>
  <div class="panel"><div class="panel-h"><b>${icon('i-pen')} Bài đăng</b><small>${ap.length}</small></div>
    <div class="tlist">${ap.length?ap.map(x=>row(x,'posts')).join(''):'<div class="empty">Chưa có gì trong lưu trữ</div>'}</div></div>`;
}


/* ─── Sửa · Xoá cho mọi hạng mục ─── */
const TBL_LABEL={projects:'dự án',risks:'rủi ro',docs:'tài liệu',meetings:'cuộc họp',
  budget:'khoản ngân sách',sprints:'đợt công việc',members:'nhân sự',channels:'kênh'};
const TBL_PERM={projects:'project.manage',channels:'channel.manage',budget:'budget.edit',
  ads:'ads.create',members:'member.manage',reports:'report.config'};
function genActions(tbl,id,canArchive){
  const key=TBL_PERM[tbl];
  const ok=!key||can(key);
  if(!ok) return `<div class="permhint">${icon('i-alert')}Vai trò ${esc(myRole())} chỉ được xem mục này.</div>`;
  return `<div class="dr-lab">Thao tác</div><div class="act-row${canArchive?'':' two-col'}">
    <button class="btn btn-gh" id="gxEdit">${icon('i-pen')}Sửa</button>
    ${canArchive?`<button class="btn btn-gh" id="gxArch">${icon('i-box')}Lưu trữ</button>`:''}
    <button class="btn btn-gh danger" id="gxDel">${icon('i-trash')}Xoá</button></div>`;
}
function bindGen(tbl,id,item,editFn){
  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  on('gxEdit',()=>editFn(item));
  on('gxArch',()=>save(tbl,id,{archived:true},'Đã đưa vào lưu trữ'));
  on('gxDel',async()=>{
    if(!confirm('Xoá '+(TBL_LABEL[tbl]||'mục')+' "'+(item.name||item.title)+'"?\nKhông khôi phục lại được.'))return;
    const {error}=await sb.from(tbl).delete().eq('id',id);
    if(error){toast('Lỗi: '+error.message);return;}
    toast('Đã xoá'); closeDrawer(); await loadAll();});
}
const F_={txt:(id,l,v,ph)=>`<div class="dr-lab">${l}</div><input type="text" id="${id}" class="fld" value="${esc(v||'')}" placeholder="${esc(ph||'')}">`,
  area:(id,l,v,ph)=>`<div class="dr-lab">${l}</div><textarea id="${id}" placeholder="${esc(ph||'')}">${esc(v||'')}</textarea>`,
  date:(id,l,v)=>`<div class="dr-lab">${l}</div><input type="date" id="${id}" class="fld" value="${v||''}">`,
  num:(id,l,v)=>`<div class="dr-lab">${l}</div><input type="number" id="${id}" class="fld" value="${v||0}">`,
  sel:(id,l,v,o)=>`<div class="dr-lab">${l}</div><select id="${id}" class="fld">${o.map(x=>
    `<option ${x===v?'selected':''}>${esc(x)}</option>`).join('')}</select>`};

/* ─── Trang chi tiết dự án ─── */
function viewProject(id){
  const pr=PROJECTS.find(x=>x.id===id); if(!pr) return viewProjects();
  const ts=TASKS.filter(t=>t.project_id===id&&tgrp(t)!=='Không áp dụng');
  const dn=ts.filter(t=>tgrp(t)==='Hoàn thành').length;
  const pc=ts.length?Math.round(dn/ts.length*100):0;
  const lt=ts.filter(lateTask);
  const bud=BUDGET.filter(b=>b.project_id===id);
  const plan=bud.reduce((s,b)=>s+(b.plan||0),0), spent=bud.reduce((s,b)=>s+(b.spent||0),0);
  const rk=RISKS.filter(r=>r.project_id===id);
  const dc=DOCS.filter(d=>d.project_id===id);
  const ps=POSTS.filter(p=>p.project_id===id);
  const areas=[...new Set(ts.map(t=>t.area).filter(Boolean))];
  const byWho=MEMBERS.map(m=>{const l=ts.filter(t=>(t.owner||'').includes(m.name));
    return {m,n:l.length,d:l.filter(t=>tgrp(t)==='Hoàn thành').length,
      lt:l.filter(lateTask).length};}).filter(x=>x.n);
  const d=dd(pr.due);

  return ph(pr.name, `${esc(pr.code)} · phụ trách ${esc(pr.owner)} · ${fdate2(pr.start)} → ${fdate2(pr.due)}`,
    `<span style="display:flex;gap:8px">
      <button class="btn btn-gh btn-sm" id="pjBack">${icon('i-list')}Danh sách dự án</button>
      <button class="btn btn-gh btn-sm" id="pjEdit">${icon('i-pen')}Sửa</button>
      <button class="btn btn-gh btn-sm danger" id="pjDel">${icon('i-trash')}Xoá</button>
      <button class="btn btn-pri btn-sm" id="pjTask">${icon('i-plus')}Giao việc</button></span>`) + `
  <div class="kpis" style="grid-template-columns:repeat(6,minmax(0,1fr))">
    ${kpi('pri','i-list','Đầu việc',ts.length,`${dn} đã xong`,pc)}
    ${kpi('green','i-check','Tiến độ',pc+'%',`${dn}/${ts.length}`,pc)}
    ${kpi('red','i-alert','Quá hạn',lt.length,lt.length?'xử lý trước':'đúng tiến độ')}
    ${kpi('amber','i-clock','Còn lại',d===null?'—':(d<0?'quá '+(-d)+'n':d+' ngày'),fdate2(pr.due))}
    ${kpi('teal','i-money','Ngân sách',mshort(spent)+'/'+mshort(plan),
      plan?Math.round(spent/plan*100)+'% đã chi':'',plan?Math.min(100,spent/plan*100):0)}
    ${kpi('gray','i-alert','Rủi ro',rk.length,rk.filter(r=>r.impact==='Cao').length+' mức cao')}
  </div>
  ${pr.note?`<div class="notice"><span class="ni">${icon('i-flag')}</span>
    <span><b>Ghi chú dự án</b><p>${esc(pr.note)}</p></span></div>`:''}
  <div class="g3col"><div>
    <div class="panel"><div class="panel-h"><b>Tiến độ theo mảng</b><small>${areas.length} mảng</small></div>
      <div class="panel-b">${areas.map(a=>{const l=ts.filter(t=>t.area===a);
        const x=l.filter(t=>tgrp(t)==='Hoàn thành').length;
        const p=l.length?Math.round(x/l.length*100):0;
        return `<div class="prow"><span class="nm">${esc(a)}</span><span class="ct">${x}/${l.length}</span>
          <span class="bar"><i class="${p===100?'ok':''}" style="width:${p}%"></i></span>
          <span class="pct">${p}%</span></div>`;}).join('')||'<div class="empty">Chưa có đầu việc</div>'}</div></div>
    ${lt.length?`<div class="panel"><div class="panel-h"><b style="color:var(--red)">Đầu việc quá hạn</b>
      <small>${lt.length}</small></div><div class="tlist">${lt.slice(0,10).map(taskRow).join('')}</div></div>`:''}
    <div class="panel"><div class="panel-h"><b>Toàn bộ đầu việc</b><small>${ts.length}</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th class="num">#</th><th>Tiêu đề</th>
        <th>Trạng thái</th><th>Ưu tiên</th><th>Người xử lý</th><th>Mảng</th><th>Hạn</th></tr></thead>
        <tbody>${ts.slice(0,40).map((t,i)=>`<tr data-task="${t.id}"><td class="num">${i+1}</td>
          <td class="tt">${esc(t.name)}</td><td><span class="pill ${tcls(t)}">${esc(t.status)}</span></td>
          <td><span class="pill ${PRI[t.priority]||'s-gray'}">${esc(t.priority||'—')}</span></td>
          <td>${whoCell(t.owner)}</td><td><span class="ct">${esc(t.area||'')}</span></td>
          <td class="due ${lateTask(t)?'late':''}">${fdate(t.due)}</td></tr>`).join('')}</tbody></table></div></div>
  </div><div class="rail">
    <div class="panel" style="margin:0"><div class="panel-h"><b>Khối lượng theo người</b></div>
      <div class="panel-b">${byWho.map(x=>{const p=x.n?Math.round(x.d/x.n*100):0;
        return `<div class="prow" data-who="${esc(x.m.name)}" style="cursor:pointer">
          <span class="nm">${avat(x.m.name)}${esc(x.m.short||x.m.name)}
            ${x.lt?`<span class="pill pill-s s-red">${x.lt}</span>`:''}</span>
          <span class="ct">${x.d}/${x.n}</span>
          <span class="bar" style="flex:0 0 54px"><i style="width:${p}%"></i></span></div>`;}).join('')
        ||'<div class="empty">Chưa phân công</div>'}</div></div>
    <div class="panel" style="margin:0"><div class="panel-h"><b>Ngân sách</b>
      <small>${bud.length} khoản</small></div>
      <div class="panel-b">${bud.map(b=>{const p=b.plan?Math.round((b.spent||0)/b.plan*100):0;
        return `<div class="prow" data-bud="${b.id}" style="cursor:pointer">
          <span class="nm">${esc(b.cat)}</span><span class="ct">${mshort(b.spent)}/${mshort(b.plan)}</span>
          <span class="bar" style="flex:0 0 46px"><i class="${p>100?'bad':'ok'}" style="width:${Math.min(100,p)}%"></i></span>
          </div>`;}).join('')||'<div class="empty">Chưa có ngân sách</div>'}</div></div>
    <div class="panel" style="margin:0"><div class="panel-h"><b>Rủi ro</b><small>${rk.length}</small></div>
      <div class="panel-b">${rk.map(r=>`<div class="prow" data-risk="${r.id}" style="cursor:pointer">
        <span class="nm">${esc(r.name)}</span>
        <span class="pill pill-s ${r.impact==='Cao'?'s-red':'s-amber'}">${esc(r.impact)}</span></div>`).join('')
        ||'<div class="empty">Chưa ghi nhận</div>'}</div></div>
    <div class="panel" style="margin:0"><div class="panel-h"><b>Tài liệu</b><small>${dc.length}</small></div>
      <div class="panel-b">${dc.map(x=>`<div class="prow" data-doc="${x.id}" style="cursor:pointer">
        <span class="nm">${icon('i-doc')}${esc(x.name)}</span></div>`).join('')
        ||'<div class="empty">Chưa có tài liệu</div>'}</div></div>
    ${ps.length?`<div class="panel" style="margin:0"><div class="panel-h"><b>Nội dung</b>
      <small>${ps.length} bài</small></div><div class="tlist">${ps.slice(0,6).map(p=>postRow(p,false)).join('')}</div></div>`:''}
  </div></div>`;
}

function editProject(pr){
  const isNew=!pr; const d=pr||{status:'Sắp bắt đầu',color:'#6D4AFF'};
  openDrawer(`<div class="dr-code">${isNew?'Dự án mới':'Sửa dự án'}</div>
    <div class="dr-title">${isNew?'Tạo dự án':esc(pr.name)}</div>
    ${F_.txt('jName','Tên dự án',d.name,'Ví dụ: Khai trương cơ sở 3')}
    <div class="two"><div>${F_.txt('jCode','Mã ngắn',d.code,'CS3')}</div>
      <div>${F_.sel('jOwn','Phụ trách',d.owner||ME.name,MEMBERS.map(m=>m.name))}</div></div>
    <div class="two"><div>${F_.date('jS','Bắt đầu',d.start||iso(new Date()))}</div>
      <div>${F_.date('jE','Kết thúc',d.due)}</div></div>
    <div class="two"><div>${F_.sel('jSt','Trạng thái',d.status,['Sắp bắt đầu','Đang chạy','Tạm dừng','Đã kết thúc'])}</div>
      <div>${F_.num('jB','Ngân sách dự kiến',d.budget)}</div></div>
    ${F_.area('jN','Ghi chú',d.note)}
    <button class="btn btn-pri btn-full" id="jSave">${isNew?'Tạo dự án':'Lưu thay đổi'}</button>`);
  document.getElementById('jSave').onclick=async()=>{
    if(!V('jName')){toast('Nhập tên dự án đã nhé');return;}
    const cols=['#6D4AFF','#0E7490','#D03535','#B26A00','#12855A','#B83280'];
    const row={name:V('jName'),code:V('jCode')||'DA'+(PROJECTS.length+1),owner:V('jOwn'),
      start:V('jS'),due:V('jE'),status:V('jSt'),budget:+V('jB')||0,note:V('jN')||null};
    if(isNew) await add('projects',{...row,progress:0,spent:0,
      color:cols[PROJECTS.length%cols.length]},'Đã tạo dự án');
    else await save('projects',pr.id,row,'Đã lưu thay đổi');
  };
}
const openNewProj=()=>editProject(null);

/* ═════════ CÔNG VIỆC CONTENT — gom theo kênh ═════════ */
let WCH=0, WTAB='mine';
function viewWork(){
  const chs=CHANNELS;
  const cur=WCH?chs.find(c=>c.id===WCH):null;
  const scope=cur?POSTS.filter(p=>p.channel===cur.name):POSTS;
  const open=scope.filter(p=>!DONE.includes(p.status));
  const mine=open.filter(p=>holds(p,ME.name));
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));

  /* Thẻ kênh dạng lưới — bấm để lọc */
  const grid=chs.map((c,i)=>{
    const P=PLAT[c.platform]||{};
    const all=POSTS.filter(p=>p.channel===c.name);
    const op=all.filter(p=>!DONE.includes(p.status));
    const n=all.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
    const t=c.target_week||0, pc=t?Math.min(100,Math.round(n/t*100)):0;
    const myn=op.filter(p=>holds(p,ME.name)).length;
    const lt=op.filter(latePost).length;
    const own=c.owner_content||((c.stream==='tiktok')?deskOwner('tiktok'):deskOwner('social'));
    return `<button class="wch ${WCH===c.id?'on':''}" data-wch="${c.id}">
      <span class="wch-t"><span class="wch-d" style="background:${P.color||'#999'}"></span>
        <span class="wch-n"><b>${esc(c.name)}</b><small>${esc(c.platform)} · ${esc(own||'')}</small></span>
        ${myn?`<span class="wch-me">${myn}</span>`:lt?`<span class="wch-me late">${lt}</span>`:''}</span>
      <span class="wch-b"><i class="${pc>=100?'ok':pc>=50?'':'warn'}" style="width:${pc}%"></i></span>
      <span class="wch-f"><span>${op.length} đang chạy</span><span>${n}/${t} tuần</span></span></button>`;
  }).join('');

  /* Nhóm việc theo trạng thái xử lý */
  const buckets=[
    {k:'mine',t:'Việc của tôi',ic:'i-hand',
     l:open.filter(p=>holds(p,ME.name))},
    {k:'todo',t:'Đang viết',ic:'i-pen',
     l:open.filter(p=>norm(p.status)==='Đang viết')},
    {k:'wait',t:'Chờ duyệt',ic:'i-clock',
     l:open.filter(p=>F(p.status).hold==='leader')},
    {k:'design',t:'Ở bên thiết kế',ic:'i-brush',
     l:open.filter(p=>F(p.status).hold==='design')},
    {k:'done',t:'Đã đăng',ic:'i-check',
     l:scope.filter(p=>p.status==='Đã đăng')},
  ];
  const cur_b=buckets.find(b=>b.k===WTAB)||buckets[0];

  const row=p=>{
    const d=dd(p.pub_date), f=F(p.status);
    const isMine=holds(p,ME.name);
    let act='',aid='';
    if(isMine){
      if(f.hold==='leader'&&ME.kind==='leader'){act='Duyệt';aid='wk-appr';}
      else if(norm(p.status)==='Đang thiết kế'&&p.editor===ME.name&&!p.design_started){act='Nhận việc';aid='wk-take';}
      else if(norm(p.status)==='Đang thiết kế'&&p.design_started){act='Gửi duyệt';aid='wk-send';}
      else if(['Đang viết','Cần chỉnh sửa'].includes(norm(p.status))){act='Gửi duyệt';aid='wk-sub';}
    }
    return `<div class="qrow">
      <span class="pill ${f.cls}">${f.ic} ${esc(p.status)}</span>
      <span class="qt" data-post="${p.id}"><b>${esc(p.title)}</b>
        <small>${esc(p.channel||'')} · ${esc(p.fmt||'')}
          ${holder(p)?`<span class="pill pill-s ${isMine?'s-pri':'s-gray'}">${esc(holder(p))}</span>`:''}</small></span>
      <span class="qr"><span class="due ${latePost(p)?'late':d===0?'soon':''}">${
        d===null?'—':d<0?`trễ ${-d} ngày`:d===0?'đăng hôm nay':d===1?'ngày mai':fdate(p.pub_date)}</span>
        ${act?`<button class="todo-b" data-q2="${aid}:${p.id}">${act}</button>`:''}</span></div>`;
  };

  return ph('Content Marketing',
    cur?`${cur.name} · ${esc(cur.platform)} · mục tiêu ${cur.target_week||0} bài/tuần`
       :`${chs.length} kênh · bấm vào kênh để xem riêng nhiệm vụ của kênh đó`,
    `<span style="display:flex;gap:8px">
      ${WCH?`<button class="btn btn-gh btn-sm" id="wAll">${icon('i-list')}Tất cả kênh</button>`:''}
      <button class="btn btn-pri btn-sm" id="wNew">${icon('i-plus')}Tạo nội dung</button></span>`) + `
  <div class="kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))">
    ${kpi('pri','i-hand','Việc của tôi',mine.length,'cần bạn xử lý')}
    ${kpi('red','i-alert','Quá hạn',open.filter(latePost).length)}
    ${kpi('amber','i-clock','Chờ duyệt',open.filter(p=>F(p.status).hold==='leader').length)}
    ${kpi('blue','i-loop','Đang chạy',open.length)}
    ${kpi('green','i-check','Đã đăng',scope.filter(p=>p.status==='Đã đăng').length)}
  </div>
  <div class="wgrid">${grid}</div>
  <div class="tabs">${buckets.map(b=>`<button data-wtab="${b.k}" class="${WTAB===b.k?'on':''}">
    ${icon(b.ic)}${esc(b.t)} (${b.l.length})</button>`).join('')}</div>
  <div class="panel"><div class="panel-h"><b>${icon(cur_b.ic)} ${esc(cur_b.t)}</b>
    <small>${cur_b.l.length} bài${cur?' · '+esc(cur.name):''}</small></div>
    <div>${cur_b.l.length?cur_b.l.map(row).join(''):'<div class="empty">Không có bài nào trong nhóm này</div>'}</div></div>`;
}

/* ═════════ DIGITAL MARKETING — quảng cáo ═════════ */
const ADS_ST={'Đang chạy':'s-blue','Đã kết thúc':'s-green','Tạm dừng':'s-amber','Nháp':'s-gray'};
const ctr=a=>a.impressions?(a.clicks/a.impressions*100):0;
const cpc=a=>a.clicks?(a.spent/a.clicks):0;
const cpm=a=>a.impressions?(a.spent/a.impressions*1000):0;
const cpa=a=>a.conversions?(a.spent/a.conversions):0;
const roas=a=>a.spent?(a.revenue/a.spent):0;

function viewAds(){
  const list=ADS.filter(inProj);
  const run=list.filter(a=>a.status==='Đang chạy');
  const bud=list.reduce((s,a)=>s+(a.budget||0),0);
  const sp=list.reduce((s,a)=>s+(a.spent||0),0);
  const imp=list.reduce((s,a)=>s+(a.impressions||0),0);
  const clk=list.reduce((s,a)=>s+(a.clicks||0),0);
  const cv=list.reduce((s,a)=>s+(a.conversions||0),0);
  const rev=list.reduce((s,a)=>s+(a.revenue||0),0);
  const all={spent:sp,impressions:imp,clicks:clk,conversions:cv,revenue:rev};

  const byPlat={};
  list.forEach(a=>{const k=a.platform;
    byPlat[k]=byPlat[k]||{spent:0,clicks:0,conversions:0,impressions:0,revenue:0,n:0};
    ['spent','clicks','conversions','impressions','revenue'].forEach(f=>byPlat[k][f]+=a[f]||0);
    byPlat[k].n++;});
  const mx=Math.max(1,...Object.values(byPlat).map(x=>x.spent));
  const COL={'Meta Ads':'#1877F2','TikTok Ads':'#111827','Google Ads':'#34A853',
    'Nội sàn':'#EE4D2D','Zalo ZNS':'#0068FF'};

  return ph('Quảng cáo','Theo dõi ngân sách và hiệu quả từng chiến dịch',
    `<button class="btn btn-pri btn-sm" id="newAd">${icon('i-plus')}Chiến dịch mới</button>`) + `
  <div class="kpis" style="grid-template-columns:repeat(6,minmax(0,1fr))">
    ${kpi('pri','i-money','Đã chi',mshort(sp),`trên ${mshort(bud)} ngân sách`,bud?Math.round(sp/bud*100):0)}
    ${kpi('teal','i-eye','Hiển thị',kf(imp),`CPM ${nf(Math.round(cpm(all)))} đ`)}
    ${kpi('blue','i-target','Lượt nhấp',kf(clk),`CTR ${ctr(all).toFixed(2)}% · CPC ${nf(Math.round(cpc(all)))} đ`)}
    ${kpi('amber','i-check','Chuyển đổi',nf(cv),`CPA ${nf(Math.round(cpa(all)))} đ`)}
    ${kpi(roas(all)>=1?'green':'red','i-chart','ROAS',roas(all).toFixed(2)+'x',
      rev?`doanh thu ${mshort(rev)}`:'chưa ghi doanh thu')}
    ${kpi('gray','i-bolt','Đang chạy',run.length,`trên ${list.length} chiến dịch`)}
  </div>
  <div class="g3col"><div>
    <div class="panel"><div class="panel-h"><b>Chiến dịch</b><small>${list.length}</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th class="num">#</th><th>Chiến dịch</th><th>Nền tảng</th><th>Trạng thái</th>
        <th>Chi / Ngân sách</th><th>Hiển thị</th><th>Nhấp</th><th>CTR</th><th>CPC</th>
        <th>Chuyển đổi</th><th>CPA</th><th>ROAS</th></tr></thead><tbody>
        ${list.length?list.map((a,i)=>{
          const p=a.budget?Math.round(a.spent/a.budget*100):0;
          const r=roas(a);
          return `<tr data-ad="${a.id}"><td class="num">${i+1}</td>
            <td class="tt">${esc(a.name)}<div style="font-size:10.5px;color:var(--ink3)">${esc(a.goal)} · ${esc(a.owner)}</div></td>
            <td><span class="pill pill-s s-gray">${esc(a.platform)}</span></td>
            <td><span class="pill ${ADS_ST[a.status]||'s-gray'}">${esc(a.status)}</span></td>
            <td><b>${mshort(a.spent)}</b><span style="color:var(--ink3)"> / ${mshort(a.budget)}</span>
              <div class="bar" style="margin-top:4px"><i class="${p>100?'bad':p>85?'warn':'ok'}" style="width:${Math.min(100,p)}%"></i></div></td>
            <td>${kf(a.impressions)}</td><td>${kf(a.clicks)}</td>
            <td>${ctr(a).toFixed(2)}%</td><td>${nf(Math.round(cpc(a)))}</td>
            <td>${nf(a.conversions)}</td>
            <td>${a.conversions?nf(Math.round(cpa(a))):'—'}</td>
            <td>${a.revenue?`<b style="color:${r>=1?'var(--green)':'var(--red)'}">${r.toFixed(2)}x</b>`:'—'}</td></tr>`;}).join('')
        :'<tr><td colspan="12" class="empty">Chưa có chiến dịch nào</td></tr>'}
      </tbody></table></div></div>
  </div><div class="rail">
    <div class="panel" style="margin:0"><div class="panel-h"><b>Chi theo nền tảng</b></div>
      <div class="panel-b">${Object.entries(byPlat).sort((a,b)=>b[1].spent-a[1].spent).map(([k,v])=>`
        <div class="prow"><span class="nm"><span class="dd" style="width:8px;height:8px;border-radius:50%;background:${COL[k]||'#999'}"></span>${esc(k)}</span>
          <span class="ct">${mshort(v.spent)} · ${v.n} CD</span>
          <span class="bar" style="flex:0 0 52px"><i style="width:${Math.round(v.spent/mx*100)}%"></i></span></div>`).join('')}
      </div></div>
    <div class="panel" style="margin:0"><div class="panel-h"><b>Hiệu quả theo nền tảng</b>
      <small>chi phí mỗi chuyển đổi</small></div>
      <div class="panel-b">${Object.entries(byPlat).filter(([,v])=>v.conversions)
        .sort((a,b)=>(a[1].spent/a[1].conversions)-(b[1].spent/b[1].conversions)).map(([k,v])=>`
        <div class="prow"><span class="nm">${esc(k)}</span>
          <span class="ct">${nf(v.conversions)} lượt</span>
          <span class="ct" style="font-weight:600;color:var(--ink)">${nf(Math.round(v.spent/v.conversions))} đ</span></div>`).join('')
        ||'<div class="empty">Chưa có chuyển đổi</div>'}</div></div>
    <div class="panel" style="margin:0"><div class="panel-h"><b>Cảnh báo</b></div>
      <div class="panel-b">${(()=>{
        const w=[];
        list.filter(a=>a.budget&&a.spent/a.budget>0.85&&a.status==='Đang chạy')
          .forEach(a=>w.push(['red','i-alert','Sắp hết ngân sách',a.name,a.id]));
        list.filter(a=>a.conversions&&cpa(a)>50000).forEach(a=>w.push(['amber','i-clock','CPA cao',a.name,a.id]));
        list.filter(a=>a.revenue&&roas(a)<1).forEach(a=>w.push(['red','i-chart','ROAS dưới 1',a.name,a.id]));
        list.filter(a=>a.status==='Đang chạy'&&dd(a.end)<0).forEach(a=>w.push(['amber','i-cal','Quá ngày kết thúc',a.name,a.id]));
        return w.length?w.slice(0,6).map(([c,ic,t,n,id])=>`<div class="nf" data-ad="${id}">
          <span class="nf-i t-${c}">${icon(ic)}</span>
          <span class="nf-t"><b>${t}</b><small>${esc(n)}</small></span></div>`).join('')
          :'<div class="empty" style="padding:16px">Không có cảnh báo</div>';})()}</div></div>
  </div></div>`;
}

function openAd(id){
  const a=ADS.find(x=>x.id===id); if(!a) return;
  const pr=PROJECTS.find(x=>x.id===a.project_id)||{};
  const p=a.budget?Math.round(a.spent/a.budget*100):0;
  const r=roas(a);
  openDrawer(`<div class="dr-code">${esc(a.platform)} · ${esc(a.channel)}</div>
    <div class="dr-title">${esc(a.name)}</div>
    <div class="dr-meta">Mục tiêu <b>${esc(a.goal)}</b> · phụ trách <b>${esc(a.owner)}</b><br>
      ${fdate2(a.start)} → ${fdate2(a.end)}${pr.code?` · dự án ${esc(pr.code)}`:''}<br>
      <span class="pill ${ADS_ST[a.status]}">${esc(a.status)}</span></div>
    ${(()=>{const bu=BUDGET.find(x=>x.id===a.budget_id);
      return bu?`<div class="dr-lab">Lấy từ khoản ngân sách</div>
        <div class="titem" data-bud="${bu.id}" style="border:1px solid var(--line);border-radius:10px">
          <span class="pill pill-s s-gray">${esc(bu.cat)}</span>
          <div class="tn"><b>${esc(bu.name)}</b><small>còn ${mshort((bu.plan||0)-(bu.spent||0))}</small></div>
        </div>`:'';})()}
    <div class="dr-lab">Ngân sách</div>
    <div class="prow" style="border:0"><span class="nm">${mshort(a.spent)} / ${mshort(a.budget)}</span>
      <span class="bar" style="flex:1"><i class="${p>100?'bad':p>85?'warn':'ok'}" style="width:${Math.min(100,p)}%"></i></span>
      <span class="pct">${p}%</span></div>
    <div class="mtr"><div><span>Hiển thị</span><b>${kf(a.impressions)}</b></div>
      <div><span>Lượt nhấp</span><b>${kf(a.clicks)}</b></div>
      <div><span>CTR</span><b>${ctr(a).toFixed(2)}%</b></div>
      <div><span>CPC</span><b>${nf(Math.round(cpc(a)))}</b></div></div>
    <div class="mtr" style="margin-top:8px"><div><span>CPM</span><b>${nf(Math.round(cpm(a)))}</b></div>
      <div><span>Chuyển đổi</span><b>${nf(a.conversions)}</b></div>
      <div><span>CPA</span><b>${a.conversions?nf(Math.round(cpa(a))):'—'}</b></div>
      <div><span>ROAS</span><b style="color:${r>=1?'var(--green)':'var(--red)'}">${a.revenue?r.toFixed(2)+'x':'—'}</b></div></div>
    <div class="dr-lab">Cập nhật số liệu</div>
    <div class="two"><div>${F_.num('adSpent','Đã chi (đ)',a.spent)}</div>
      <div>${F_.num('adImp','Hiển thị',a.impressions)}</div></div>
    <div class="two"><div>${F_.num('adClk','Lượt nhấp',a.clicks)}</div>
      <div>${F_.num('adCv','Chuyển đổi',a.conversions)}</div></div>
    ${F_.num('adRev','Doanh thu quy đổi (đ)',a.revenue)}
    <button class="btn btn-pri btn-full" id="adSave">Lưu số liệu</button>
    <div class="dr-lab">Trạng thái</div>
    <div class="st-opts">${['Nháp','Đang chạy','Tạm dừng','Đã kết thúc'].map(s=>
      `<button class="st-opt ${s===a.status?'on':''}" data-as="${esc(s)}"><span>${s}</span></button>`).join('')}</div>
    ${genActions('ads',id)}`);
  document.getElementById('adSave').onclick=()=>save('ads',id,{spent:+V('adSpent')||0,
    impressions:+V('adImp')||0,clicks:+V('adClk')||0,conversions:+V('adCv')||0,
    revenue:+V('adRev')||0},'Đã cập nhật số liệu');
  document.querySelectorAll('[data-as]').forEach(b=>b.onclick=()=>
    save('ads',id,{status:b.dataset.as},`Đã chuyển sang “${b.dataset.as}”`));
  bindGen('ads',id,a,editAd);
}

function editAd(a){
  const isNew=!a; const d=a||{platform:'Meta Ads',status:'Nháp',goal:'Nhận biết'};
  const t=new Date(D0()); t.setDate(t.getDate()+14);
  openDrawer(`<div class="dr-code">${isNew?'Chiến dịch mới':'Sửa chiến dịch'}</div>
    <div class="dr-title">${isNew?'Tạo chiến dịch quảng cáo':esc(a.name)}</div>
    ${F_.txt('adName','Tên chiến dịch',d.name,'Ví dụ: Khai trương CS2 — Tin nhắn')}
    <div class="two"><div>${F_.sel('adPlat','Nền tảng chạy',d.platform,
      ['Meta Ads','TikTok Ads','Google Ads','Nội sàn','Zalo ZNS','Khác'])}</div>
      <div>${F_.sel('adCh','Kênh đích',d.channel,
        ['Facebook','Instagram','TikTok','Google Maps','Website','Shopee','GrabFood','Zalo'])}</div></div>
    <div class="two"><div>${F_.sel('adGoal','Mục tiêu',d.goal,
      ['Nhận biết','Tương tác','Tin nhắn','Kéo về quán','Tăng follow','Bán hàng','Giữ chân'])}</div>
      <div>${F_.sel('adOwn','Phụ trách',d.owner||ME.name,MEMBERS.map(m=>m.name))}</div></div>
    <div class="two"><div>${F_.date('adS','Bắt đầu',d.start||iso(new Date()))}</div>
      <div>${F_.date('adE','Kết thúc',d.end||iso(t))}</div></div>
    <div class="two"><div>${F_.num('adBud','Ngân sách (đ)',d.budget)}</div>
      <div><div class="dr-lab">Dự án</div><select id="adProj" class="fld">
        <option value="">Không thuộc dự án</option>${projOpts(d.project_id)}</select></div></div>
    ${F_.area('adNote','Ghi chú',d.note,'Tệp đối tượng, thông điệp, điều cần lưu ý…')}
    <button class="btn btn-pri btn-full" id="adSv">${isNew?'Tạo chiến dịch':'Lưu thay đổi'}</button>`);
  document.getElementById('adSv').onclick=async()=>{
    if(!V('adName')){toast('Nhập tên chiến dịch đã nhé');return;}
    const row={name:V('adName'),platform:V('adPlat'),channel:V('adCh'),goal:V('adGoal'),
      owner:V('adOwn'),start:V('adS'),end:V('adE'),budget:+V('adBud')||0,
      project_id:+V('adProj')||null,note:V('adNote')||null};
    if(isNew) await add('ads',{...row,status:'Nháp',spent:0,impressions:0,clicks:0,
      conversions:0,revenue:0},'Đã tạo chiến dịch');
    else await save('ads',a.id,row,'Đã lưu thay đổi');
  };
}

/* ═════════ CHỈ SỐ KÊNH ═════════ */
let MCH=0;
function barChart(items,opt){
  const W=560,H=170,PL=36,PB=26;
  const mx=Math.max(1,...items.map(i=>i.v));
  const bw=(W-PL-12)/items.length;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none">
    ${[0,.25,.5,.75,1].map(f=>`<line x1="${PL}" x2="${W-8}" y1="${10+f*(H-PB-10)}" y2="${10+f*(H-PB-10)}"
      stroke="#EDEDF3" stroke-width="1"/>`).join('')}
    ${[0,.5,1].map(f=>`<text x="2" y="${14+f*(H-PB-10)}" font-size="9" fill="#9797AC">${
      Math.round(mx*(1-f))}${(opt&&opt.suffix)||''}</text>`).join('')}
    ${items.map((it,k)=>{const h=(it.v/mx)*(H-PB-14);
      return `<rect x="${PL+k*bw+bw*0.18}" y="${H-PB-h}" width="${bw*0.64}" height="${h}"
        rx="4" fill="${it.c||'#6D4AFF'}"/>
        <text x="${PL+k*bw+bw*0.5}" y="${H-PB-h-5}" font-size="9.5" fill="#54546B"
          text-anchor="middle" font-weight="600">${it.l||it.v}</text>`;}).join('')}
    ${items.map((it,k)=>`<text x="${PL+k*bw+bw*0.5}" y="${H-8}" font-size="9.5" fill="#9797AC"
      text-anchor="middle">${esc(it.t)}</text>`).join('')}
  </svg>`;
}
function donut(parts,center){
  const R=46,C=2*Math.PI*R; let off=0;
  return `<div class="dnt"><svg width="118" height="118" viewBox="0 0 118 118">
    ${parts.map(p=>{const len=C*(p.v/100);
      const el=`<circle cx="59" cy="59" r="${R}" fill="none" stroke="${p.c}" stroke-width="16"
        stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}"
        transform="rotate(-90 59 59)"/>`; off+=len; return el;}).join('')}
    </svg><div class="dnt-c">${center||''}</div></div>
    <div class="dnt-l">${parts.map(p=>`<div class="leg-i">
      <span class="dd" style="background:${p.c}"></span>${esc(p.t)}<b>${p.v}%</b></div>`).join('')}</div>`;
}
function chSelector(){
  return `<div class="chbar">
    <button class="chpill ${!MCH?'on':''}" data-mch="0">
      <span class="cd" style="background:var(--ink3)"></span>
      <span><b>Tất cả kênh</b><small style="display:block">${CHANNELS.length} kênh</small></span></button>
    ${CHANNELS.map((c,i)=>{
      const v=POSTS.filter(p=>p.channel===c.name&&p.status==='Đã đăng').reduce((s,p)=>s+(p.views||0),0);
      const P=PLAT[c.platform]||{};
      return `<button class="chpill ${MCH===c.id?'on':''}" data-mch="${c.id}">
        <span class="cd" style="background:${P.color||CHCOL[i%CHCOL.length]}"></span>
        <span><b>${esc(c.name)}</b><small style="display:block">${esc(c.platform)} · ${kf(v)} view</small></span>
      </button>`;}).join('')}</div>`;
}
function viewMetrics(){
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
  const calc=c=>{
    const all=POSTS.filter(p=>p.channel===c.name);
    const posted=all.filter(p=>p.status==='Đã đăng');
    const v=posted.reduce((s,p)=>s+(p.views||0),0);
    const e=posted.reduce((s,p)=>s+(p.eng||0),0);
    const sh=posted.reduce((s,p)=>s+(p.shares||0),0);
    const sv=posted.reduce((s,p)=>s+(p.saves||0),0);
    const ad=ADS.filter(a=>a.channel===c.name);
    const spent=ad.reduce((s,a)=>s+(a.spent||0),0);
    const n=all.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
    return {c,all,posted,v,e,sh,sv,ad,spent,n,er:v?e/v*100:0,cpv:v&&spent?spent/v:0,
      tgt:c.target_week||0,fol:c.followers||0};};
  const rows=CHANNELS.map(calc);

  if(MCH){
    const r=rows.find(x=>x.c.id===MCH);
    if(!r){ MCH=0; return viewMetrics(); }
    const c=r.c, P=PLAT[c.platform]||{};
    const ages=Object.entries(c.aud_age||{}).map(([t,v])=>({t,v,l:v+'%',c:P.color||'#6D4AFF'}));
    const hours=(c.aud_hour||[]).map(h=>({t:h.h,v:h.v,l:h.v+'%',c:'#8B6BFF'}));
    const g=c.aud_gender||{'Nam':50,'Nữ':50};
    const gp=[{t:'Nam',v:g['Nam'],c:'#1F63C7'},{t:'Nữ',v:g['Nữ'],c:'#B83280'}];
    const gr=c.growth||[];
    const mxg=Math.max(1,...gr);
    const top=[...r.posted].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,5);
    const avg=r.posted.length?Math.round(r.v/r.posted.length):0;
    const rank=[...rows].sort((a,b)=>b.v-a.v).findIndex(x=>x.c.id===MCH)+1;
    const bestH=(c.aud_hour||[]).slice().sort((a,b)=>b.v-a.v)[0];
    return ph(c.name+' — hiệu suất chi tiết',
      esc(c.platform)+' · phụ trách '+esc(c.owner_content||'—')+' · mục tiêu '+r.tgt+' bài/tuần',
      `<span style="display:flex;gap:8px">
        <button class="btn btn-gh btn-sm" id="mBack">${icon('i-list')}Tất cả kênh</button>
        <button class="btn btn-gh btn-sm" data-chedit="${c.id}">${icon('i-cog')}Cấu hình</button>
        <button class="btn btn-pri btn-sm" data-newpost="${esc(c.name)}">${icon('i-plus')}Tạo nội dung</button></span>`)
      + chTabs() + chSelector() + `
    <div class="kpis" style="grid-template-columns:repeat(6,minmax(0,1fr))">
      ${kpi('teal','i-eye','Lượt xem',kf(r.v),'hạng '+rank+'/'+rows.length+' toàn hệ thống')}
      ${kpi('pink','i-heart','Tương tác',kf(r.e),r.er.toFixed(1)+'% trên lượt xem')}
      ${kpi('pri','i-users','Follow',kf(r.fol))}
      ${kpi('blue','i-pen','Bài đã đăng',r.posted.length,'TB '+kf(avg)+' view/bài')}
      ${kpi(r.n>=r.tgt?'green':'amber','i-target','Nhịp tuần này',r.n+'/'+r.tgt,
        r.n>=r.tgt?'đạt mục tiêu':'còn thiếu '+(r.tgt-r.n)+' bài',r.tgt?Math.min(100,r.n/r.tgt*100):0)}
      ${kpi('amber','i-money','Chi quảng cáo',mshort(r.spent),r.cpv?Math.round(r.cpv)+' đ mỗi lượt xem':'chưa chạy QC')}
    </div>
    <div class="grid2">
      <div class="panel"><div class="panel-h"><b>Độ tuổi khán giả</b><small>tỉ lệ phần trăm</small></div>
        <div class="panel-b">${barChart(ages,{suffix:'%'})}</div></div>
      <div class="panel"><div class="panel-h"><b>Giới tính</b>
        <small>${g['Nam']>g['Nữ']?'nghiêng về nam':'nghiêng về nữ'}</small></div>
        <div class="panel-b"><div class="ring-wrap">${donut(gp,
          '<b>'+Math.max(g['Nam'],g['Nữ'])+'%</b><span>'+(g['Nam']>g['Nữ']?'Nam':'Nữ')+'</span>')}</div></div></div>
    </div>
    <div class="grid2">
      <div class="panel"><div class="panel-h"><b>Khung giờ hoạt động</b>
        <small>tỉ lệ người xem theo giờ</small></div>
        <div class="panel-b">${barChart(hours,{suffix:'%'})}
          <div style="font-size:11.5px;color:var(--ink3);margin-top:8px">
            Khung mạnh nhất: <b style="color:var(--pri)">${bestH?esc(bestH.h):'—'} giờ</b>
            — nên hẹn giờ đăng vào khung này.</div></div></div>
      <div class="panel"><div class="panel-h"><b>Khu vực khán giả</b><small>top 5</small></div>
        <div class="panel-b">${(c.aud_loc||[]).map((l,i)=>`<div class="prow">
          <span class="nm"><span class="rankn">${i+1}</span>${esc(l.n)}</span>
          <span class="ct">${l.v}%</span>
          <span class="bar" style="flex:0 0 120px"><i style="width:${l.v}%"></i></span></div>`).join('')}
        </div></div>
    </div>
    <div class="grid2">
      <div class="panel"><div class="panel-h"><b>Tăng trưởng follow</b><small>6 tuần gần nhất</small></div>
        <div class="panel-b">
          <svg viewBox="0 0 560 150" class="chart" preserveAspectRatio="none">
            ${[0,.5,1].map(f=>`<line x1="34" x2="552" y1="${12+f*110}" y2="${12+f*110}" stroke="#EDEDF3"/>`).join('')}
            ${[0,.5,1].map(f=>`<text x="2" y="${16+f*110}" font-size="9" fill="#9797AC">${kf(Math.round(mxg*(1-f)))}</text>`).join('')}
            <path d="${gr.map((v,k)=>(k?'L':'M')+(34+k*(518/Math.max(1,gr.length-1))).toFixed(0)+' '+(122-(v/mxg)*110).toFixed(0)).join(' ')}"
              fill="none" stroke="${P.color||'#6D4AFF'}" stroke-width="2.6" stroke-linejoin="round"/>
            ${gr.map((v,k)=>`<circle cx="${(34+k*(518/Math.max(1,gr.length-1))).toFixed(0)}"
              cy="${(122-(v/mxg)*110).toFixed(0)}" r="3.6" fill="${P.color||'#6D4AFF'}"/>`).join('')}
          </svg>
          <div class="sparkx" style="padding-left:34px">${gr.map((_,k)=>'<span>T'+(k+1)+'</span>').join('')}</div>
          <div style="font-size:11.5px;color:var(--ink3);margin-top:6px">
            ${gr.length>1?(gr[gr.length-1]>=gr[0]
              ?'Tăng <b style="color:var(--green)">'+nf(gr[gr.length-1]-gr[0])+'</b> follow trong 6 tuần'
              :'Giảm <b style="color:var(--red)">'+nf(gr[0]-gr[gr.length-1])+'</b> follow'):''}</div>
        </div></div>
      <div class="panel"><div class="panel-h"><b>Bài hiệu quả nhất</b><small>top 5</small></div>
        <div class="tlist">${top.length?top.map((p,i)=>`<div class="titem" data-post="${p.id}">
          <span class="rankn">${i+1}</span>
          <div class="tn"><b>${esc(p.title)}</b><small>${esc(p.fmt||'')} · ${fdate(p.pub_date)}</small></div>
          <span class="ct"><b>${kf(p.views)}</b> view</span>
          </div>`).join(''):'<div class="empty">Chưa có bài nào đăng</div>'}</div></div>
    </div>
    ${r.ad.length?`<div class="panel"><div class="panel-h"><b>Chiến dịch quảng cáo trên kênh này</b>
      <small>${r.ad.length}</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Chiến dịch</th><th>Trạng thái</th><th>Chi</th><th>Hiển thị</th><th>Nhấp</th>
        <th>CTR</th><th>Chuyển đổi</th><th>ROAS</th></tr></thead><tbody>
        ${r.ad.map(a=>`<tr data-ad="${a.id}"><td class="tt">${esc(a.name)}</td>
          <td><span class="pill ${ADS_ST[a.status]||'s-gray'}">${esc(a.status)}</span></td>
          <td>${mshort(a.spent)}</td><td>${kf(a.impressions)}</td><td>${kf(a.clicks)}</td>
          <td>${ctr(a).toFixed(2)}%</td><td>${nf(a.conversions)}</td>
          <td>${a.revenue?roas(a).toFixed(2)+'x':'—'}</td></tr>`).join('')}
      </tbody></table></div></div>`:''}
    <div class="panel"><div class="panel-h"><b>Toàn bộ bài trên kênh</b><small>${r.all.length}</small></div>
      <div class="tlist">${r.all.length?r.all.map(p=>postRow(p,false)).join('')
        :'<div class="empty">Chưa có bài nào</div>'}</div></div>`;
  }

  const tv=rows.reduce((s,r)=>s+r.v,0), te=rows.reduce((s,r)=>s+r.e,0);
  const tsp=rows.reduce((s,r)=>s+r.spent,0);
  const best=[...rows].filter(r=>r.posted.length).sort((a,b)=>b.er-a.er)[0];
  const mxv=Math.max(1,...rows.map(r=>r.v));
  return ph('Kênh & chỉ số','Hiệu quả nội dung tự nhiên và chi phí quảng cáo trên từng kênh')
    + chTabs() + chSelector() + `
  <div class="kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))">
    ${kpi('teal','i-eye','Tổng lượt xem',kf(tv))}
    ${kpi('pink','i-heart','Tổng tương tác',kf(te),tv?(te/tv*100).toFixed(1)+'% trên lượt xem':'')}
    ${kpi('pri','i-users','Tổng follow',kf(rows.reduce((s,r)=>s+r.fol,0)))}
    ${kpi('amber','i-money','Chi quảng cáo',mshort(tsp),tv?nf(Math.round(tsp/tv))+' đ mỗi lượt xem':'')}
    ${kpi('green','i-target','Kênh hiệu quả nhất',best?best.c.name.slice(0,15):'—',
      best?best.er.toFixed(1)+'% tương tác':'')}
  </div>
  <div class="panel"><div class="panel-h"><b>Bảng chỉ số</b>
    <small>bấm vào kênh để xem hiệu suất chi tiết</small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th style="min-width:170px">Kênh</th><th>Nền tảng</th><th>Follow</th><th>Bài đã đăng</th>
      <th>Nhịp tuần</th><th>Lượt xem</th><th>Tương tác</th><th>Tỉ lệ TT</th>
      <th>Chia sẻ</th><th>Lưu</th><th>Chi QC</th><th>Chi/lượt xem</th></tr></thead><tbody>
      ${rows.map(r=>`<tr data-mch="${r.c.id}">
        <td class="tt">${esc(r.c.name)}</td>
        <td><span class="pill pill-s s-gray">${esc(r.c.platform)}</span></td>
        <td>${kf(r.fol)}</td><td>${r.posted.length}</td>
        <td><span class="pill pill-s ${r.n>=r.tgt?'s-green':r.n>=r.tgt/2?'s-amber':'s-red'}">${r.n}/${r.tgt}</span></td>
        <td><b>${kf(r.v)}</b></td><td>${kf(r.e)}</td>
        <td>${r.er?r.er.toFixed(1)+'%':'—'}</td>
        <td>${nf(r.sh)}</td><td>${nf(r.sv)}</td>
        <td>${r.spent?mshort(r.spent):'—'}</td>
        <td>${r.cpv?nf(Math.round(r.cpv))+' đ':'—'}</td></tr>`).join('')}
    </tbody></table></div></div>
  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>Lượt xem theo kênh</b></div>
      <div class="panel-b">${[...rows].sort((a,b)=>b.v-a.v).map(r=>`
        <div class="prow" data-mch="${r.c.id}" style="cursor:pointer">
          <span class="nm">${esc(r.c.name)}</span><span class="ct">${kf(r.v)}</span>
          <span class="bar" style="flex:0 0 90px"><i style="width:${Math.round(r.v/mxv*100)}%"></i></span></div>`).join('')}
      </div></div>
    <div class="panel"><div class="panel-h"><b>Tỉ lệ tương tác</b><small>tương tác trên lượt xem</small></div>
      <div class="panel-b">${[...rows].filter(r=>r.er).sort((a,b)=>b.er-a.er).map(r=>`
        <div class="prow" data-mch="${r.c.id}" style="cursor:pointer"><span class="nm">${esc(r.c.name)}</span>
          <span class="ct">${r.er.toFixed(1)}%</span>
          <span class="bar" style="flex:0 0 90px"><i class="${r.er>=8?'ok':r.er>=4?'':'warn'}" style="width:${Math.min(100,r.er*6)}%"></i></span></div>`).join('')
        ||'<div class="empty">Chưa có dữ liệu</div>'}</div></div>
  </div>`;
}

/* ═════════ BÁO CÁO NGÀY ═════════ */
const RST={'Đã duyệt':'s-green','Chờ duyệt':'s-amber','Yêu cầu sửa':'s-red','Chưa nộp':'s-gray'};
let RDAY=null, RTAB='day', RVIEW='table';

function viewReports(){
  const day=RDAY||iso(D0());
  const today=REPORTS.filter(r=>r.date===day);
  const mine=today.find(r=>r.author===ME.name);
  const st=k=>today.filter(r=>r.status===k).length;
  const sub=today.filter(r=>r.status!=='Chưa nộp').length;
  const toReview=can('report.approve')
    ? byScope(REPORTS.filter(r=>r.status==='Chờ duyệt'),'report.approve','reviewer')
        .filter(r=>r.reviewer===ME.name) : [];
  const rate=MEMBERS.length?Math.round(sub/MEMBERS.length*100):0;
  const totTask=today.reduce((a,r)=>a+(r.items?r.items.length:0),0);
  const blockers=today.filter(r=>r.blocker);

  const days=[]; for(let i=6;i>=0;i--){const d=new Date(D0());d.setDate(d.getDate()-i);days.push(iso(d));}

  /* mỗi thành viên một dòng, kể cả chưa nộp */
  const rowsToday=MEMBERS.map(m=>{
    const r=today.find(x=>x.author===m.name);
    return r||{id:0,author:m.name,reviewer:m.manager||'Công Tuân',date:day,
      status:'Chưa nộp',items:[],blocker:null,plan:null};});

  const tableView=`
    <div class="panel"><div class="panel-h"><b>${icon('i-doc')} Báo cáo ngày ${fdate2(day)}</b>
      <small>${sub}/${MEMBERS.length} người đã nộp · ${totTask} việc được báo cáo</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:180px">Người gửi</th><th style="min-width:120px">Người duyệt</th>
        <th style="min-width:60px">Số việc</th><th style="min-width:340px">Kết quả</th>
        <th style="min-width:120px">Trạng thái</th></tr></thead><tbody>
        ${rowsToday.map(r=>{
          const mb=MEMBERS.find(m=>m.name===r.author)||{};
          return `<tr ${r.id?`data-rep="${r.id}"`:''} class="${r.status==='Chưa nộp'?'row-mute':''}">
            <td><div class="whorow">${avat(r.author)}<span><b>${esc(r.author)}</b>
              <small>${esc(mb.role||'')}</small></span></div></td>
            <td>${whoCell(r.reviewer)}</td>
            <td>${r.items&&r.items.length?`<b class="rnum">${r.items.length}</b>`:'<span style="color:var(--ink3)">—</span>'}</td>
            <td>${r.items&&r.items.length?`<div class="rres">
                <b>${r.items.length} việc hoàn thành</b>
                ${r.items.slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')}
                ${r.items.length>3?`<span class="mute">còn ${r.items.length-3} việc nữa</span>`:''}
                ${r.blocker?`<span class="rbl">${icon('i-alert')}Vướng: ${esc(r.blocker)}</span>`:''}
              </div>`:'<span style="color:var(--ink3)">Chưa nộp báo cáo</span>'}</td>
            <td><span class="pill ${RST[r.status]}">${esc(r.status)}</span>
              ${r.status==='Chờ duyệt'&&r.reviewer===ME.name
                ?`<button class="todo-b" style="margin-top:6px" data-rok="${r.id}">Duyệt</button>`:''}</td>
          </tr>`;}).join('')}
      </tbody></table></div></div>`;

  const cardView=`<div class="rgrid">${rowsToday.map(r=>{
    const mb=MEMBERS.find(m=>m.name===r.author)||{};
    return `<div class="rcard" ${r.id?`data-rep="${r.id}"`:''}>
      <div class="rcard-h">${avat(r.author)}
        <span class="rcard-n"><b>${esc(r.author)}</b>
          <small>${esc(mb.role||'')} · ${fdate2(r.date)}</small></span>
        <span class="pill ${RST[r.status]}">${esc(r.status)}</span></div>
      ${r.items&&r.items.length?`<div class="rcard-b">
        <div class="rcount">${icon('i-check')}${r.items.length} việc hoàn thành</div>
        ${r.items.slice(0,3).map(x=>`<div class="ritem">${esc(x)}</div>`).join('')}
        ${r.items.length>3?`<div class="ritem more">còn ${r.items.length-3} việc nữa…</div>`:''}
        ${r.blocker?`<div class="rblock">${icon('i-alert')}Vướng: ${esc(r.blocker)}</div>`:''}</div>`
        :`<div class="rcard-b"><div class="empty" style="padding:14px">Chưa nộp báo cáo</div></div>`}
      <div class="rcard-f"><span>Người duyệt: <b>${esc(r.reviewer)}</b></span>
        ${r.status==='Chờ duyệt'&&r.reviewer===ME.name?'<span style="color:var(--pri)">Cần bạn duyệt →</span>':''}</div>
    </div>`;}).join('')}</div>`;

  /* thống kê tuần dạng số liệu */
  const weekRows=MEMBERS.map(m=>{
    const l=days.map(k=>REPORTS.find(r=>r.author===m.name&&r.date===k));
    const s2=l.filter(r=>r&&r.status!=='Chưa nộp').length;
    const tasks=l.reduce((a,r)=>a+(r&&r.items?r.items.length:0),0);
    return {m,l,s2,tasks,ok:l.filter(r=>r&&r.status==='Đã duyệt').length,
      fix:l.filter(r=>r&&r.status==='Yêu cầu sửa').length,
      p:Math.round(s2/days.length*100)};});
  const weekView=`
    <div class="panel"><div class="panel-h"><b>Bảng nộp báo cáo 7 ngày</b>
      <small>ô xanh là đã nộp · ô trống là chưa</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:160px">Thành viên</th>
        ${days.map(k=>{const d=new Date(k);
          return `<th style="text-align:center;min-width:52px">${d.toLocaleDateString('vi-VN',{weekday:'short'})}
            <div style="font-weight:400;color:var(--ink3)">${d.getDate()}/${d.getMonth()+1}</div></th>`;}).join('')}
        <th style="min-width:70px">Đã nộp</th><th style="min-width:70px">Tổng việc</th>
        <th style="min-width:110px">Tỉ lệ</th></tr></thead><tbody>
        ${weekRows.map(w=>`<tr data-who="${esc(w.m.name)}">
          <td><div class="whorow">${avat(w.m.name)}<span><b>${esc(w.m.name)}</b>
            <small>${esc(w.m.role)}</small></span></div></td>
          ${w.l.map(r=>`<td style="text-align:center">${
            !r||r.status==='Chưa nộp'?'<span class="cellx">—</span>'
            :`<span class="cellv ${r.status==='Đã duyệt'?'g':r.status==='Yêu cầu sửa'?'r':'a'}"
               title="${esc(r.status)}">${r.items?r.items.length:0}</span>`}</td>`).join('')}
          <td><b>${w.s2}/${days.length}</b></td><td><b>${w.tasks}</b></td>
          <td><div class="prow" style="border:0;padding:0">
            <span class="bar" style="flex:1"><i class="${w.p>=90?'ok':w.p>=60?'':'warn'}" style="width:${w.p}%"></i></span>
            <span class="pct">${w.p}%</span></div></td></tr>`).join('')}
        <tr class="row-sum"><td><b>Toàn phòng</b></td>
          ${days.map(k=>{const n=REPORTS.filter(r=>r.date===k&&r.status!=='Chưa nộp').length;
            return `<td style="text-align:center"><b class="${n>=MEMBERS.length?'okn':'warnn'}">${n}</b></td>`;}).join('')}
          <td><b>${weekRows.reduce((a,w)=>a+w.s2,0)}/${days.length*MEMBERS.length}</b></td>
          <td><b>${weekRows.reduce((a,w)=>a+w.tasks,0)}</b></td>
          <td><b>${Math.round(weekRows.reduce((a,w)=>a+w.p,0)/(weekRows.length||1))}%</b></td></tr>
      </tbody></table></div></div>`;

  const reviewView=`
    <div class="panel"><div class="panel-h"><b>Chờ tôi duyệt</b><small>${toReview.length}</small></div>
      <div>${toReview.length?toReview.map(r=>`<div class="qrow">
        <span class="pill ${RST[r.status]}">${esc(r.status)}</span>
        <span class="qt" data-rep="${r.id}"><b>${esc(r.author)} · ${fdate2(r.date)}</b>
          <small>${r.items.length} việc hoàn thành${r.blocker?' · có vướng mắc':''}</small></span>
        <span class="qr"><button class="todo-b" data-rok="${r.id}">Duyệt</button>
          <button class="todo-b gh" data-rfix="${r.id}">Yêu cầu sửa</button></span></div>`).join('')
        :'<div class="empty">Không có báo cáo nào chờ bạn duyệt</div>'}</div></div>`;

  const allView=`
    <div class="panel"><div class="panel-h"><b>Toàn bộ báo cáo</b><small>${REPORTS.length}</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Người gửi</th>
        <th>Người duyệt</th><th>Số việc</th><th>Kết quả</th><th>Trạng thái</th></tr></thead><tbody>
        ${[...REPORTS].reverse().map(r=>`<tr data-rep="${r.id}">
          <td>${fdate2(r.date)}</td><td>${whoCell(r.author)}</td><td>${esc(r.reviewer)}</td>
          <td><b class="rnum">${r.items?r.items.length:0}</b></td>
          <td class="tt">${r.items&&r.items.length?`<div class="rres">
            ${r.items.slice(0,2).map(x=>`<span>${esc(x)}</span>`).join('')}
            ${r.items.length>2?`<span class="mute">còn ${r.items.length-2} việc</span>`:''}</div>`
            :'<span style="color:var(--ink3)">—</span>'}</td>
          <td><span class="pill ${RST[r.status]}">${esc(r.status)}</span></td></tr>`).join('')}
      </tbody></table></div></div>`;

  const body={day:(RVIEW==='table'?tableView:cardView),review:reviewView,week:weekView,all:allView}[RTAB]||tableView;

  return ph('Báo cáo ngày',
    'Cuối ngày mỗi người nộp việc đã làm — người quản lý trực tiếp duyệt',
    `<span style="display:flex;gap:8px;align-items:center">
      ${RTAB==='day'?`<div class="segbtn">
        <button data-rv="table" class="${RVIEW==='table'?'on':''}">${icon('i-list')}Bảng</button>
        <button data-rv="card" class="${RVIEW==='card'?'on':''}">${icon('i-grid')}Thẻ</button></div>`:''}
      <input type="date" id="rDate" class="fld" style="width:auto" value="${day}">
      ${!mine||mine.status==='Chưa nộp'||mine.status==='Yêu cầu sửa'
        ?`<button class="btn btn-pri btn-sm" id="rNew">${icon('i-plus')}Nộp báo cáo</button>`
        :`<button class="btn btn-gh btn-sm" id="rEdit">${icon('i-pen')}Sửa báo cáo</button>`}</span>`) + `
  <div class="kpis4">
    ${bigKpi('green','Đã nộp hôm nay',sub+'/'+MEMBERS.length,rate+'% tỉ lệ nộp')}
    ${bigKpi('blue','Việc được báo cáo',totTask,'trong ngày '+fdate(day))}
    ${bigKpi('amber','Chờ duyệt',st('Chờ duyệt'),toReview.length?toReview.length+' chờ chính bạn':'—')}
    ${bigKpi(blockers.length?'red':'pri','Vướng mắc nêu ra',blockers.length,
      blockers.length?blockers.map(b=>esc(b.author)).join(', '):'Không ai báo vướng')}
  </div>
  <div class="chips">
    <span class="chipx green">Đã nộp: <b>${sub}</b></span>
    <span class="chipx">Chưa nộp: <b>${MEMBERS.length-sub}</b></span>
    <span class="chipx amber">Chờ duyệt: <b>${st('Chờ duyệt')}</b></span>
    <span class="chipx blue">Đã duyệt: <b>${st('Đã duyệt')}</b></span>
    <span class="chipx red">Yêu cầu sửa: <b>${st('Yêu cầu sửa')}</b></span>
    <span class="chipx tot">Tỉ lệ nộp: <b>${rate}%</b></span>
  </div>
  <div class="tabs">
    <button data-rtab="day" class="${RTAB==='day'?'on':''}">${icon('i-cal')}Báo cáo ngày</button>
    <button data-rtab="review" class="${RTAB==='review'?'on':''}">${icon('i-check')}Chờ tôi duyệt (${toReview.length})</button>
    <button data-rtab="week" class="${RTAB==='week'?'on':''}">${icon('i-chart')}Thống kê tuần</button>
    <button data-rtab="all" class="${RTAB==='all'?'on':''}">${icon('i-list')}Tất cả (${REPORTS.length})</button>
  </div>
  ${body}`;
}

function openReport(id){
  const r=REPORTS.find(x=>x.id===id); if(!r) return;
  const mb=MEMBERS.find(m=>m.name===r.author)||{};
  const canReview=r.reviewer===ME.name&&r.status==='Chờ duyệt';
  openDrawer(`<div class="dr-code">Báo cáo ngày ${fdate2(r.date)}</div>
    <div class="dr-title">${esc(r.author)}</div>
    <div class="dr-meta">${esc(mb.role||'')} · người duyệt <b>${esc(r.reviewer)}</b><br>
      <span class="pill ${RST[r.status]}">${esc(r.status)}</span></div>
    ${r.items&&r.items.length?`<div class="dr-lab">${r.items.length} việc hoàn thành</div>
      <div class="rlist">${r.items.map(x=>`<div class="ritem2">${icon('i-check')}<span>${esc(x)}</span></div>`).join('')}</div>`
      :'<div class="dr-lab">Nội dung</div><div class="dr-txt">Chưa nộp báo cáo</div>'}
    ${r.blocker?`<div class="dr-lab">Vướng mắc</div><div class="dr-txt" style="color:var(--red)">${esc(r.blocker)}</div>`:''}
    ${r.plan?`<div class="dr-lab">Kế hoạch ngày mai</div><div class="dr-txt">${esc(r.plan)}</div>`:''}
    ${r.note?`<div class="dr-lab">Nhận xét của người duyệt</div><div class="dr-txt">${esc(r.note)}</div>`:''}
    ${canReview?`<div class="dr-lab">Duyệt báo cáo</div>
      <textarea id="rvNote" placeholder="Nhận xét cho ${esc(r.author)} (không bắt buộc)"></textarea>
      <div class="act-row two-col" style="margin-top:10px">
        <button class="btn btn-pri" id="rvOk">${icon('i-check')}Duyệt</button>
        <button class="btn btn-gh" id="rvFix">${icon('i-loop')}Yêu cầu sửa</button></div>`:''}
    ${r.author===ME.name&&r.status!=='Đã duyệt'?`<button class="btn btn-gh btn-full" id="rvEdit">${icon('i-pen')}Sửa báo cáo</button>`:''}
    ${(r.author===ME.name||ME.kind==='leader')&&r.id?genActions('reports',r.id):''}`);
  if((r.author===ME.name||ME.kind==='leader')&&r.id)
    bindGen('reports',r.id,{...r,name:'báo cáo ngày '+fdate2(r.date)},()=>openReportForm(r));
  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  on('rvOk',()=>save('reports',id,{status:'Đã duyệt',note:V('rvNote')||null},'Đã duyệt báo cáo'));
  on('rvFix',()=>{if(!V('rvNote')){toast('Ghi rõ cần sửa gì để người kia biết');return;}
    save('reports',id,{status:'Yêu cầu sửa',note:V('rvNote')},'Đã gửi yêu cầu sửa');});
  on('rvEdit',()=>openReportForm(r));
}

function openReportForm(r){
  const day=r?r.date:(RDAY||iso(D0()));
  const mine=r||REPORTS.find(x=>x.author===ME.name&&x.date===day);
  /* gợi ý từ việc đã hoàn thành hôm nay */
  const sug=[...TASKS.filter(t=>(t.owner||'').includes(ME.name)&&tgrp(t)==='Hoàn thành').slice(-4).map(t=>t.name),
    ...POSTS.filter(p=>holds(p,ME.name)||p.writer===ME.name).slice(-3)
      .map(p=>p.title+' — '+p.status)];
  const items=(mine&&mine.items&&mine.items.length)?mine.items:[''];
  openDrawer(`<div class="dr-code">Báo cáo ngày ${fdate2(day)}</div>
    <div class="dr-title">${mine&&mine.items&&mine.items.length?'Sửa báo cáo':'Nộp báo cáo hôm nay'}</div>
    <div class="dr-meta">Liệt kê việc đã hoàn thành. Người duyệt: <b>${esc((MEMBERS.find(m=>m.name===ME.name)||{}).manager||'Công Tuân')}</b></div>
    <div class="dr-lab">Việc đã hoàn thành</div>
    <div id="rfList">${items.map((x,i)=>`<div class="rfrow">
      <input type="text" class="fld rfi" value="${esc(x)}" placeholder="Ví dụ: Dựng video teaser — đã gửi duyệt">
      <button class="icobtn rfdel">${icon('i-x')}</button></div>`).join('')}</div>
    <button class="btn btn-gh btn-sm" id="rfAdd" style="margin-top:8px">${icon('i-plus')}Thêm dòng</button>
    ${sug.length?`<div class="dr-lab">Gợi ý từ hệ thống</div>
      <div class="sugs">${sug.map(x=>`<button class="sug" data-sug="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>`:''}
    <div class="dr-lab">Vướng mắc (nếu có)</div>
    <textarea id="rfBlock" placeholder="Đang chờ ai, thiếu gì, cần hỗ trợ gì…">${esc(mine?mine.blocker||'':'')}</textarea>
    <div class="dr-lab">Kế hoạch ngày mai</div>
    <textarea id="rfPlan" placeholder="Dự định làm gì tiếp">${esc(mine?mine.plan||'':'')}</textarea>
    <button class="btn btn-pri btn-full" id="rfSave">${icon('i-send')}Gửi cho người duyệt</button>`);
  const relist=()=>{document.querySelectorAll('.rfdel').forEach(b=>b.onclick=()=>{
    const rows=document.querySelectorAll('.rfrow');
    if(rows.length>1) b.closest('.rfrow').remove();});};
  relist();
  document.getElementById('rfAdd').onclick=()=>{
    document.getElementById('rfList').insertAdjacentHTML('beforeend',
      `<div class="rfrow"><input type="text" class="fld rfi" placeholder="Việc đã làm…">
       <button class="icobtn rfdel">${icon('i-x')}</button></div>`);
    relist();};
  document.querySelectorAll('[data-sug]').forEach(b=>b.onclick=()=>{
    const empty=[...document.querySelectorAll('.rfi')].find(i=>!i.value.trim());
    if(empty) empty.value=b.dataset.sug;
    else{document.getElementById('rfList').insertAdjacentHTML('beforeend',
      `<div class="rfrow"><input type="text" class="fld rfi" value="${esc(b.dataset.sug)}">
       <button class="icobtn rfdel">${icon('i-x')}</button></div>`); relist();}
    b.classList.add('used');});
  document.getElementById('rfSave').onclick=async()=>{
    const its=[...document.querySelectorAll('.rfi')].map(i=>i.value.trim()).filter(Boolean);
    if(!its.length){toast('Ghi ít nhất một việc đã làm');return;}
    const row={date:day,author:ME.name,reviewer:(MEMBERS.find(m=>m.name===ME.name)||{}).manager||'Công Tuân',
      status:'Chờ duyệt',items:its,blocker:V('rfBlock')||null,plan:V('rfPlan')||null,note:null};
    const dup=REPORTS.find(x=>x.author===ME.name&&x.date===day&&(!mine||x.id!==mine.id));
    if(dup){toast('Bạn đã nộp báo cáo ngày này rồi — mở ra để sửa');return;}
    if(mine&&mine.id) await save('reports',mine.id,row,'Đã gửi báo cáo');
    else await add('reports',row,'Đã gửi báo cáo');
  };
}

/* ═════════ THÔNG BÁO & PHÊ DUYỆT ═════════ */
const APS={'Chờ duyệt':'s-amber','Đã duyệt':'s-green','Từ chối':'s-red'};
function viewApprovals(){
  const mine=APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt');
  const sent=APPROVALS.filter(a=>a.requester===ME.name);
  const all=APPROVALS;
  const row=a=>`<div class="qrow">
    <span class="pill pill-s s-gray">${esc(a.kind)}</span>
    <span class="qt" data-apr="${a.id}"><b>${esc(a.title)}</b>
      <small>${esc(a.requester)} → ${esc(a.approver)} · ${fdate2(a.at)}
        ${a.amount?`<span class="pill pill-s s-teal">${mshort(a.amount)}</span>`:''}</small></span>
    <span class="qr"><span class="pill ${APS[a.status]}">${esc(a.status)}</span>
      ${a.approver===ME.name&&a.status==='Chờ duyệt'?
        `<button class="todo-b" data-aok="${a.id}">Duyệt</button>`:''}</span></div>`;
  return ph('Thông báo & Phê duyệt','Mọi yêu cầu cần Leader chốt đều đi qua đây',
    `<button class="btn btn-pri btn-sm" id="newApr">${icon('i-plus')}Tạo yêu cầu</button>`) + `
  <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${kpi('amber','i-clock','Chờ tôi duyệt',mine.length)}
    ${kpi('pri','i-send','Tôi đã gửi',sent.length)}
    ${kpi('green','i-check','Đã duyệt',all.filter(a=>a.status==='Đã duyệt').length)}
    ${kpi('red','i-x','Từ chối',all.filter(a=>a.status==='Từ chối').length)}
  </div>
  ${mine.length?`<div class="panel"><div class="panel-h"><b style="color:var(--amber)">${icon('i-clock')} Chờ bạn duyệt</b>
    <small>${mine.length}</small></div><div>${mine.map(row).join('')}</div></div>`:''}
  <div class="panel"><div class="panel-h"><b>Toàn bộ yêu cầu</b><small>${all.length}</small></div>
    <div>${all.length?all.map(row).join(''):'<div class="empty">Chưa có yêu cầu nào</div>'}</div></div>`;
}
function openApr(id){
  const a=APPROVALS.find(x=>x.id===id); if(!a) return;
  const can=a.approver===ME.name&&a.status==='Chờ duyệt';
  openDrawer(`<div class="dr-code">${esc(a.kind)}</div><div class="dr-title">${esc(a.title)}</div>
    <div class="dr-meta">Người gửi <b>${esc(a.requester)}</b> → duyệt bởi <b>${esc(a.approver)}</b><br>
      ${fdate2(a.at)}${a.amount?` · giá trị <b>${money(a.amount)}</b>`:''}<br>
      <span class="pill ${APS[a.status]}">${esc(a.status)}</span></div>
    ${a.note?`<div class="dr-lab">Ghi chú</div><div class="dr-txt">${esc(a.note)}</div>`:''}
    ${can?`<div class="dr-lab">Quyết định</div>
      <textarea id="apNote" placeholder="Lý do (không bắt buộc)"></textarea>
      <div class="act-row two-col" style="margin-top:10px">
        <button class="btn btn-pri" id="apOk">${icon('i-check')}Duyệt</button>
        <button class="btn btn-gh danger" id="apNo">${icon('i-x')}Từ chối</button></div>`:''}
    ${genActions('approvals',id)}`);
  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  on('apOk',()=>save('approvals',id,{status:'Đã duyệt',note:V('apNote')||null},'Đã duyệt'));
  on('apNo',()=>save('approvals',id,{status:'Từ chối',note:V('apNote')||null},'Đã từ chối'));
  bindGen('approvals',id,a,editApr);
}
function editApr(a){
  const isNew=!a; const d=a||{kind:'Nội dung',status:'Chờ duyệt'};
  openDrawer(`<div class="dr-code">${isNew?'Yêu cầu mới':'Sửa yêu cầu'}</div>
    <div class="dr-title">${isNew?'Tạo yêu cầu phê duyệt':esc(a.title)}</div>
    ${F_.sel('apKind','Loại yêu cầu',d.kind,['Nội dung','Thiết kế','Ngân sách','Chi phí','Booking','Nghỉ phép','Khác'])}
    ${F_.txt('apTitle','Nội dung yêu cầu',d.title,'Ví dụ: Tăng ngân sách Meta Ads thêm 5 triệu')}
    <div class="two"><div>${F_.sel('apApr','Gửi cho',d.approver||'Công Tuân',MEMBERS.map(m=>m.name))}</div>
      <div>${F_.num('apAmt','Giá trị (đ) — nếu có',d.amount)}</div></div>
    ${F_.area('apN','Ghi chú',d.note)}
    <button class="btn btn-pri btn-full" id="apSv">${isNew?'Gửi yêu cầu':'Lưu'}</button>`);
  document.getElementById('apSv').onclick=async()=>{
    if(!V('apTitle')){toast('Nhập nội dung yêu cầu');return;}
    const row={kind:V('apKind'),title:V('apTitle'),approver:V('apApr'),
      amount:+V('apAmt')||0,note:V('apN')||null};
    if(isNew) await add('approvals',{...row,requester:ME.name,status:'Chờ duyệt',
      at:iso(new Date())},'Đã gửi yêu cầu tới '+row.approver);
    else await save('approvals',a.id,row,'Đã lưu');
  };
}

/* ═════════ HIỆU SUẤT ═════════ */
function viewPerf(){
  const days=[]; for(let i=6;i>=0;i--){const d=new Date(D0());d.setDate(d.getDate()-i);days.push(iso(d));}
  const allT=TASKS.filter(t=>tgrp(t)!=='Không áp dụng');
  const doneT=allT.filter(t=>tgrp(t)==='Hoàn thành');
  const lateAll=allT.filter(lateTask);
  const rateDone=allT.length?Math.round(doneT.length/allT.length*100):0;
  const rateOn=allT.length?Math.round((allT.length-lateAll.length)/allT.length*100):0;

  const rows=MEMBERS.map(m=>{
    const rp=REPORTS.filter(r=>r.author===m.name&&days.includes(r.date));
    const subm=rp.filter(r=>r.status!=='Chưa nộp').length;
    const fix=rp.filter(r=>r.status==='Yêu cầu sửa').length;
    const tk=TASKS.filter(t=>(t.owner||'').includes(m.name)&&tgrp(t)!=='Không áp dụng');
    const tdone=tk.filter(t=>tgrp(t)==='Hoàn thành').length;
    const topen=tk.filter(t=>!['Hoàn thành'].includes(tgrp(t))).length;
    const lt=tk.filter(lateTask).length;
    const ps=POSTS.filter(p=>p.writer===m.name);
    const pdone=ps.filter(p=>p.status==='Đã đăng').length;
    const v=ps.filter(p=>p.status==='Đã đăng').reduce((s,p)=>s+(p.views||0),0);
    const ku=KUDOS.filter(k=>k.receiver===m.name).reduce((s,k)=>s+(k.point||0),0);
    const rrate=Math.round(subm/days.length*100);
    const dn=tk.length?Math.round(tdone/tk.length*100):0;
    const on=tk.length?Math.round((tk.length-lt)/tk.length*100):100;
    const score=Math.round(rrate*0.25+dn*0.3+on*0.3+Math.min(100,ku*2)*0.15);
    return {m,subm,fix,tk:tk.length,tdone,topen,lt,pdone,v,ku,rrate,dn,on,score};
  }).sort((a,b)=>b.score-a.score);
  const care=rows.filter(r=>r.lt>0||r.on<70||r.rrate<60);

  /* xu hướng 7 ngày: việc hoàn thành mỗi ngày */
  const trend=days.map(k=>({k,
    n:TASKS.filter(t=>t.due===k&&tgrp(t)==='Hoàn thành').length
      +POSTS.filter(p=>p.pub_date===k&&p.status==='Đã đăng').length}));
  const mxT=Math.max(1,...trend.map(t=>t.n));
  const W=560,H=140,PADL=34;
  const pts=trend.map((t,i)=>[PADL+i*((W-PADL-14)/(trend.length-1)),H-18-(t.n/mxT)*(H-40)]);
  const path=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(0)+' '+p[1].toFixed(0)).join(' ');

  return ph('Dashboard hiệu suất','Theo dõi tiến độ, đúng hạn, chất lượng và khối lượng của từng vai trò') + `
  <div class="kpis4">
    ${bigKpi('green','Tỉ lệ việc hoàn thành',rateDone+'%',`${doneT.length}/${allT.length} đầu việc`)}
    ${bigKpi('blue','Tỉ lệ đúng hạn',rateOn+'%',`${allT.length-lateAll.length} việc không trễ`)}
    ${bigKpi('red','Việc trễ hạn',lateAll.length,'Cần xử lý ngay')}
    ${bigKpi('amber','Thành viên cần chú ý',care.length,care.length?care.map(c=>esc(c.m.short_name||c.m.name)).join(', '):'Không có')}
  </div>
  <div class="panel"><div class="panel-h"><b>Xu hướng hoàn thành</b><small>7 ngày gần nhất</small></div>
    <div class="panel-b">
      <svg viewBox="0 0 ${W} ${H}" class="spark" preserveAspectRatio="none">
        ${[0,.25,.5,.75,1].map(f=>`<line x1="${PADL}" x2="${W-14}" y1="${18+f*(H-40)}" y2="${18+f*(H-40)}"
          stroke="#EDEDF3" stroke-width="1"/>`).join('')}
        ${[0,.5,1].map(f=>`<text x="4" y="${22+f*(H-40)}" font-size="9" fill="#9797AC">${Math.round(mxT*(1-f))}</text>`).join('')}
        <path d="${path}" fill="none" stroke="#6D4AFF" stroke-width="2.4" stroke-linejoin="round"/>
        ${pts.map((p,i)=>`<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="3.4" fill="#6D4AFF"/>`).join('')}
      </svg>
      <div class="sparkx">${trend.map(t=>{const d=new Date(t.k);
        return `<span class="${t.k===iso(D0())?'td':''}">${d.toLocaleDateString('vi-VN',{weekday:'short'})}</span>`;}).join('')}</div>
    </div></div>
  <div class="panel"><div class="panel-h"><b>Xếp hạng thành viên</b><small>xếp theo điểm tổng hợp</small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="num">#</th><th>Thành viên</th><th>Hoàn thành</th><th>Đúng hạn</th>
      <th>Đầu việc</th><th>Đang mở</th><th>Yêu cầu sửa</th><th>Quá hạn</th><th>Báo cáo</th><th>Điểm</th>
      </tr></thead><tbody>${rows.map((r,i)=>`<tr data-who="${esc(r.m.name)}">
        <td class="num">${i+1}</td>
        <td><div class="whorow">${avat(r.m.name)}<span><b>${esc(r.m.name)}</b>
          <small>${esc(r.m.role)}</small></span></div></td>
        <td><span class="pill pill-s ${r.dn>=80?'s-green':r.dn>=50?'s-amber':'s-red'}">${r.dn}%</span></td>
        <td><span class="pill pill-s ${r.on>=90?'s-green':r.on>=70?'s-amber':'s-red'}">${r.on}%</span></td>
        <td>${r.tk}</td><td>${r.topen}</td>
        <td>${r.fix?`<span class="pill pill-s s-amber">${r.fix}</span>`:'0'}</td>
        <td>${r.lt?`<span class="pill pill-s s-red">${r.lt}</span>`:'0'}</td>
        <td><span class="pill pill-s ${r.rrate>=90?'s-green':r.rrate>=60?'s-amber':'s-red'}">${r.rrate}%</span></td>
        <td style="min-width:104px"><div class="prow" style="border:0;padding:0">
          <span class="bar" style="flex:1"><i class="${r.score>=80?'ok':r.score>=55?'':'warn'}" style="width:${r.score}%"></i></span>
          <span class="pct">${r.score}</span></div></td></tr>`).join('')}
    </tbody></table></div></div>
  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>Phân bổ khối lượng</b></div><div class="panel-b">
      ${rows.map(r=>{const tot=Math.max(1,...rows.map(x=>x.tk));
        return `<div class="prow" data-who="${esc(r.m.name)}" style="cursor:pointer">
        <span class="nm">${avat(r.m.name)}${esc(r.m.short_name||r.m.name)}</span>
        <span class="ct">${r.tk} việc · ${r.pdone} bài</span>
        <span class="bar"><i style="width:${Math.round(r.tk/tot*100)}%"></i></span></div>`;}).join('')}
    </div></div>
    <div class="panel"><div class="panel-h"><b>Cách tính điểm</b></div><div class="panel-b">
      <div class="prow"><span class="nm">Tỉ lệ nộp báo cáo ngày</span><span class="ct">25%</span></div>
      <div class="prow"><span class="nm">Tỉ lệ hoàn thành đầu việc</span><span class="ct">30%</span></div>
      <div class="prow"><span class="nm">Tỉ lệ đúng hạn</span><span class="ct">30%</span></div>
      <div class="prow"><span class="nm">Ghi nhận từ đồng đội</span><span class="ct">15%</span></div>
      <div style="font-size:11.5px;color:var(--ink3);margin-top:10px;line-height:1.6">
        Điểm để nhìn xu hướng, không dùng so bì giữa các vai — Designer và Content
        có khối lượng rất khác nhau.</div></div></div>
  </div>`;
}

/* ═════════ GHI NHẬN ĐỒNG ĐỘI ═════════ */
function viewKudos(){
  const byWho={};
  KUDOS.forEach(k=>{byWho[k.receiver]=(byWho[k.receiver]||0)+(k.point||0);});
  const rank=MEMBERS.map(m=>({m,p:byWho[m.name]||0,
    n:KUDOS.filter(k=>k.receiver===m.name).length})).sort((a,b)=>b.p-a.p);
  return ph('Ghi nhận đồng đội','Ghi lại lúc ai đó giúp mình — nhỏ nhưng giữ được tinh thần đội',
    `<button class="btn btn-pri btn-sm" id="newKudo">${icon('i-plus')}Gửi ghi nhận</button>`) + `
  <div class="g3col"><div>
    <div class="panel"><div class="panel-h"><b>Ghi nhận gần đây</b><small>${KUDOS.length}</small></div>
      <div>${KUDOS.length?[...KUDOS].reverse().map(k=>`<div class="kudo" data-kudo="${k.id}" style="cursor:pointer">
        <span class="kudo-a">${avat(k.giver)}${icon('i-heart')}${avat(k.receiver)}</span>
        <span class="kudo-t"><b>${esc(k.giver)} ghi nhận ${esc(k.receiver)}</b>
          <span>${esc(k.text)}</span>
          <small>${fdate2(k.at)}</small></span>
        <span class="pill pill-s s-pink">+${k.point}</span></div>`).join('')
        :'<div class="empty">Chưa có ghi nhận nào</div>'}</div></div>
  </div><div class="rail">
    <div class="panel" style="margin:0"><div class="panel-h"><b>Bảng ghi nhận</b></div>
      <div class="panel-b">${rank.map((r,i)=>`<div class="prow">
        <span class="nm">${i===0?'🏆 ':''}${avat(r.m.name)}${esc(r.m.short_name||r.m.name)}</span>
        <span class="ct">${r.n} lần</span>
        <span class="pill pill-s ${r.p?'s-pink':'s-gray'}">+${r.p}</span></div>`).join('')}</div></div>
  </div></div>`;
}
function openNewKudo(){
  openDrawer(`<div class="dr-title">Gửi ghi nhận</div>
    <div class="dr-meta">Ai đó vừa giúp bạn hoặc làm tốt hơn mong đợi?</div>
    ${F_.sel('kTo','Ghi nhận ai',MEMBERS.filter(m=>m.name!==ME.name)[0]?.name,
      MEMBERS.filter(m=>m.name!==ME.name).map(m=>m.name))}
    ${F_.area('kText','Vì điều gì','','Cụ thể càng tốt — "sửa poster giữa đêm để kịp lịch đăng sáng"')}
    ${F_.sel('kPt','Mức ghi nhận','10 điểm — giúp đỡ đáng kể',
      ['5 điểm — hỗ trợ nhỏ','10 điểm — giúp đỡ đáng kể','15 điểm — cứu cả việc lớn'])}
    <button class="btn btn-pri btn-full" id="kSv">${icon('i-heart')}Gửi ghi nhận</button>`);
  document.getElementById('kSv').onclick=async()=>{
    if(!V('kText')){toast('Ghi rõ vì điều gì nhé');return;}
    await add('kudos',{giver:ME.name,receiver:V('kTo'),text:V('kText'),
      point:parseInt(V('kPt'))||10,at:iso(new Date())},'Đã gửi ghi nhận tới '+V('kTo'));
  };
}

/* ═════════ LỊCH TRỰC NHẬT ═════════ */
function viewDuty(){
  const up=DUTY.filter(d=>dd(d.date)>=0);
  const today=DUTY.find(d=>d.date===iso(D0()));
  return ph('Lịch trực nhật','Ai trực inbox và bình luận toàn kênh hôm nay',
    `<button class="btn btn-pri btn-sm" id="newDuty">${icon('i-plus')}Xếp lịch</button>`) + `
  <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">
    ${kpi('pri','i-user','Trực hôm nay',today?(today.who||'—'):'chưa xếp',today?today.task:'')}
    ${kpi('blue','i-cal','Đã xếp lịch',up.length,'ngày tới')}
    ${kpi('green','i-check','Đã hoàn tất',DUTY.filter(d=>d.done).length)}
  </div>
  <div class="panel"><div class="panel-h"><b>Lịch sắp tới</b><small>${up.length} ngày</small></div>
    <div class="tlist">${up.map(d=>{const n=dd(d.date);
      return `<div class="titem" data-duty="${d.id}">
        <span class="pill ${n===0?'s-red':n<=2?'s-amber':'s-gray'}">${
          n===0?'Hôm nay':n===1?'Ngày mai':`còn ${n} ngày`}</span>
        <div class="tn"><b>${esc(d.who)}</b><small>${esc(d.task)} · ${fdate2(d.date)}</small></div>
        ${d.done?'<span class="pill pill-s s-green">Đã xong</span>':''}</div>`;}).join('')
      ||'<div class="empty">Chưa xếp lịch</div>'}</div></div>`;
}
function openDuty(id){
  const d=DUTY.find(x=>x.id===id); if(!d) return;
  openDrawer(`<div class="dr-code">Trực nhật ${fdate2(d.date)}</div>
    <div class="dr-title">${esc(d.who)}</div>
    <div class="dr-meta">${esc(d.task)}</div>
    ${F_.sel('duWho','Đổi người trực',d.who,MEMBERS.map(m=>m.name))}
    ${F_.txt('duTask','Nhiệm vụ',d.task)}
    <button class="btn btn-pri btn-full" id="duSv">Lưu</button>
    <button class="btn btn-gh btn-full" style="margin-top:8px" id="duDone">${
      d.done?'Bỏ đánh dấu hoàn tất':'Đánh dấu đã trực xong'}</button>
    ${genActions('duty',id)}`);
  document.getElementById('duSv').onclick=()=>save('duty',id,{who:V('duWho'),task:V('duTask')},'Đã lưu');
  document.getElementById('duDone').onclick=()=>save('duty',id,{done:!d.done},
    d.done?'Đã bỏ đánh dấu':'Đã đánh dấu hoàn tất');
  bindGen('duty',id,{...d,name:d.who},()=>openDuty(id));
}
function openNewDuty(){
  const t=new Date(D0()); t.setDate(t.getDate()+1);
  openDrawer(`<div class="dr-title">Xếp lịch trực</div>
    ${F_.date('duD','Ngày',iso(t))}
    ${F_.sel('duW','Người trực',ME.name,MEMBERS.map(m=>m.name))}
    ${F_.txt('duT','Nhiệm vụ','Trực inbox & bình luận toàn kênh')}
    <button class="btn btn-pri btn-full" id="duAdd">${icon('i-plus')}Xếp lịch</button>`);
  document.getElementById('duAdd').onclick=()=>add('duty',{date:V('duD'),who:V('duW'),
    task:V('duT')||'Trực inbox & bình luận',done:false},'Đã xếp lịch trực');
}


function openSprint(id){
  const sp=SPRINTS.find(x=>x.id===id); if(!sp) return;
  const ts=TASKS.filter(t=>t.sprint_id===id&&tgrp(t)!=='Không áp dụng');
  const dn=ts.filter(t=>tgrp(t)==='Hoàn thành').length;
  openDrawer(`<div class="dr-code">${esc(sp.status)}</div><div class="dr-title">${esc(sp.name)}</div>
    <div class="dr-meta">${fdate2(sp.start)} → ${fdate2(sp.end)}${sp.goal?'<br>'+esc(sp.goal):''}</div>
    <div class="mtr"><div><span>Đầu việc</span><b>${ts.length}</b></div>
      <div><span>Đã xong</span><b style="color:var(--green)">${dn}</b></div>
      <div><span>Quá hạn</span><b style="color:var(--red)">${ts.filter(lateTask).length}</b></div>
      <div><span>Ước tính</span><b>${ts.reduce((a,t)=>a+(t.est||0),0)}h</b></div></div>
    <div class="dr-lab">Trạng thái</div>
    <div class="st-opts">${['Sắp tới','Đang chạy','Đã kết thúc'].map(x=>
      `<button class="st-opt ${x===sp.status?'on':''}" data-sps="${esc(x)}"><span>${x}</span></button>`).join('')}</div>
    ${ts.length?`<div class="dr-lab">Đầu việc trong đợt</div>
      <div class="tlist">${ts.slice(0,12).map(taskRow).join('')}</div>`:''}
    ${genActions('sprints',id)}`);
  document.querySelectorAll('[data-sps]').forEach(b=>b.onclick=()=>
    save('sprints',id,{status:b.dataset.sps},`Đã chuyển sang “${b.dataset.sps}”`));
  bindGen('sprints',id,sp,editSprint);
}
function editSprint(sp){
  const isNew=!sp; const d=sp||{status:'Sắp tới'};
  openDrawer(`<div class="dr-code">${isNew?'Đợt mới':'Sửa đợt'}</div>
    <div class="dr-title">${isNew?'Tạo đợt công việc':esc(sp.name)}</div>
    ${F_.txt('spName','Tên đợt',d.name,'Đợt 7')}
    <div class="two"><div>${F_.date('spS','Bắt đầu',d.start)}</div>
      <div>${F_.date('spE','Kết thúc',d.end)}</div></div>
    ${F_.sel('spSt','Trạng thái',d.status,['Sắp tới','Đang chạy','Đã kết thúc'])}
    ${F_.area('spG','Mục tiêu đợt',d.goal)}
    <button class="btn btn-pri btn-full" id="spSv">${isNew?'Tạo đợt':'Lưu'}</button>`);
  document.getElementById('spSv').onclick=async()=>{
    if(!V('spName')){toast('Nhập tên đợt');return;}
    const row={name:V('spName'),start:V('spS'),end:V('spE'),status:V('spSt'),goal:V('spG')||null};
    if(isNew) await add('sprints',row,'Đã tạo đợt'); else await save('sprints',sp.id,row,'Đã lưu');};
}
function openKudo(id){
  const k=KUDOS.find(x=>x.id===id); if(!k) return;
  openDrawer(`<div class="dr-code">Ghi nhận · +${k.point} điểm</div>
    <div class="dr-title">${esc(k.giver)} ghi nhận ${esc(k.receiver)}</div>
    <div class="dr-meta">${fdate2(k.at)}</div>
    <div class="dr-lab">Nội dung</div><div class="dr-txt">${esc(k.text)}</div>
    ${k.giver===ME.name?genActions('kudos',id):''}`);
  if(k.giver===ME.name) bindGen('kudos',id,{...k,name:k.text},editKudo);
}
function editKudo(k){
  openDrawer(`<div class="dr-title">Sửa ghi nhận</div>
    ${F_.sel('kTo','Ghi nhận ai',k.receiver,MEMBERS.filter(m=>m.name!==ME.name).map(m=>m.name))}
    ${F_.area('kText','Vì điều gì',k.text)}
    ${F_.sel('kPt','Mức ghi nhận',k.point+' điểm',['5 điểm','10 điểm','15 điểm'])}
    <button class="btn btn-pri btn-full" id="kSv2">Lưu</button>`);
  document.getElementById('kSv2').onclick=()=>save('kudos',k.id,{receiver:V('kTo'),
    text:V('kText'),point:parseInt(V('kPt'))||10},'Đã lưu');
}

/* ═════════ CƠ CẤU TỔ CHỨC ═════════ */
function viewOrg(){
  const kids=n=>MEMBERS.filter(m=>m.manager===n);
  const node=(m,lv)=>{
    const hp=POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name)).length;
    const ht=TASKS.filter(t=>(t.owner||'').includes(m.name)&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t))).length;
    const ch=CHANNELS.filter(c=>c.owner_content===m.name||c.owner_design===m.name);
    const sub=kids(m.name);
    return `<div class="orgn" style="margin-left:${lv*26}px">
      <div class="orgc" data-medit="${m.id}">
        ${avat(m.name)}
        <div class="orgt"><b>${esc(m.name)}</b><small>${esc(m.role)}</small></div>
        <div class="orgm">
          <span class="pill pill-s ${m.kind==='leader'?'s-pri':m.kind==='writer'?'s-blue':'s-pink'}">${
            m.kind==='leader'?'Duyệt':m.kind==='writer'?'Viết':'Thiết kế'}</span>
          ${hp+ht?`<span class="pill pill-s s-gray">${hp+ht} việc</span>`:''}
          ${sub.length?`<span class="pill pill-s s-teal">quản lý ${sub.length}</span>`:''}</div>
      </div>
      ${ch.length?`<div class="orgch">${ch.map(c=>`<span class="orgchip" data-chan="${c.id}">${esc(c.name)}</span>`).join('')}</div>`:''}
      ${sub.map(s=>node(s,lv+1)).join('')}</div>`;};
  const roots=MEMBERS.filter(m=>!m.manager);
  return ph('Cơ cấu tổ chức','Ai báo cáo cho ai, ai phụ trách kênh nào',
    `<button class="btn btn-pri btn-sm" id="newMem2">${icon('i-plus')}Thêm nhân sự</button>`) + `
  <div class="panel"><div class="panel-h"><b>Sơ đồ phòng</b>
    <small>${MEMBERS.length} người · ${CHANNELS.length} kênh</small></div>
    <div class="panel-b">${roots.map(m=>node(m,0)).join('')}</div></div>
  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>Phân bổ kênh</b></div><div class="panel-b">
      ${MEMBERS.map(m=>{const ch=CHANNELS.filter(c=>c.owner_content===m.name);
        const dz=CHANNELS.filter(c=>c.owner_design===m.name);
        if(!ch.length&&!dz.length) return '';
        return `<div class="prow" data-who="${esc(m.name)}" style="cursor:pointer">
          <span class="nm">${avat(m.name)}${esc(m.short_name||m.name)}</span>
          <span class="ct">${ch.length?ch.length+' kênh nội dung':''}${ch.length&&dz.length?' · ':''}${
            dz.length?dz.length+' kênh thiết kế':''}</span></div>`;}).join('')}
    </div></div>
    <div class="panel"><div class="panel-h"><b>Bộ phận</b></div><div class="panel-b">
      ${[...new Set(MEMBERS.map(m=>m.dept).filter(Boolean))].map(d=>{
        const l=MEMBERS.filter(m=>m.dept===d);
        return `<div class="prow"><span class="nm">${icon('i-users')}${esc(d)}</span>
          <span class="ct">${l.map(m=>esc(m.short_name||m.name)).join(', ')}</span></div>`;}).join('')}
    </div></div>
  </div>`;
}

/* ═════════ VAI TRÒ VÀ QUYỀN ═════════ */

/* ═════════ NGÂN SÁCH ═════════ */
function viewBudget(){
  if(!can('budget.view')) return ph('Ngân sách','')+
    `<div class="panel"><div class="empty">${icon('i-alert')}<br><br>
      Vai trò <b>${esc(myRole())}</b> không có quyền xem ngân sách.<br>
      Liên hệ Leader nếu bạn cần quyền này.</div></div>`;
  const list=BUDGET.filter(inProj);
  const plan=list.reduce((s,b)=>s+(b.plan||0),0);
  const spent=list.reduce((s,b)=>s+(b.spent||0),0);
  const pc=plan?Math.round(spent/plan*100):0;
  const chBud=list.filter(b=>b.channel_id), prBud=list.filter(b=>!b.channel_id);
  const cats={}; list.forEach(b=>{cats[b.cat]=cats[b.cat]||{plan:0,spent:0};
    cats[b.cat].plan+=b.plan||0; cats[b.cat].spent+=b.spent||0;});
  const COL=['#6D4AFF','#12855A','#B26A00','#1F63C7','#B83280','#0E7490','#D03535'];
  const dist=Object.entries(cats).map(([k,v],i)=>({t:k,c:COL[i%COL.length],n:v.plan}));
  return ph('Ngân sách',(PROJ?'Dự án đang chọn':'Toàn bộ dự án')+' · kế hoạch và thực chi',
    can('budget.edit')?`<button class="btn btn-pri btn-sm" id="newBud">${icon('i-plus')}Thêm khoản</button>`:'') + `
  <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${kpi('pri','i-money','Tổng kế hoạch',mshort(plan),money(plan))}
    ${kpi('blue','i-chart','Đã chi',mshort(spent),pc+'% ngân sách',pc)}
    ${kpi('green','i-check','Còn lại',mshort(plan-spent),money(plan-spent))}
    ${kpi(spent>plan?'red':'teal','i-target','Tỉ lệ dùng',pc+'%',spent>plan?'Đã vượt ngân sách':'Trong hạn mức',pc)}
  </div>
  <div class="chips">
    <span class="chipx blue">Ngân sách dự án: <b>${mshort(prBud.reduce((s,b)=>s+b.plan,0))}</b></span>
    <span class="chipx green">Ngân sách kênh: <b>${mshort(chBud.reduce((s,b)=>s+b.plan,0))}</b></span>
    <span class="chipx">Số khoản: <b>${list.length}</b></span>
    <span class="chipx tot">Còn lại: <b>${mshort(plan-spent)}</b></span>
  </div>
  <div class="g21">
    <div class="panel"><div class="panel-h"><b>Chi tiết hạng mục</b><small>${list.length} khoản</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:200px">Hạng mục</th><th>Nhóm</th><th>Dự án</th><th>Kế hoạch</th><th>Đã chi</th>
        <th>Còn lại</th><th>Phụ trách</th><th>Tỉ lệ</th></tr></thead><tbody>
        ${list.map(b=>{const p=b.plan?Math.round((b.spent||0)/b.plan*100):0;
          const pr=PROJECTS.find(x=>x.id===b.project_id)||{};
          const ad=ADS.filter(a=>a.budget_id===b.id);
          const adPlan=ad.reduce((s,a)=>s+(a.budget||0),0);
          return `<tr data-bud="${b.id}"><td class="tt">${esc(b.name)}</td>
            <td><span class="pill pill-s s-gray">${esc(b.cat)}</span></td>
            <td><span class="ct">${esc(pr.code||'—')}</span></td>
            <td>${money(b.plan)}${adPlan?`<div style="font-size:10px;color:var(--ink3)">${ad.length} chiến dịch · ${mshort(adPlan)}</div>`:''}</td>
            <td>${money(b.spent)}</td>
            <td>${money((b.plan||0)-(b.spent||0))}</td><td>${esc(b.owner||'—')}</td>
            <td style="min-width:120px"><div class="prow" style="border:0;padding:0">
              <span class="bar" style="flex:1"><i class="${p>100?'bad':p>80?'warn':'ok'}" style="width:${Math.min(100,p)}%"></i></span>
              <span class="pct">${p}%</span></div></td></tr>`;}).join('')}
      </tbody></table></div></div>
    <div class="panel"><div class="panel-h"><b>Cơ cấu theo nhóm</b>
      <small>${Object.keys(cats).length} nhóm</small></div>
      <div class="panel-b">${distBlock(dist,plan)}
        <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px">
        ${Object.entries(cats).sort((a,b)=>b[1].plan-a[1].plan).map(([k,v])=>{
          const p=v.plan?Math.round(v.spent/v.plan*100):0;
          return `<div class="prow"><span class="nm">${esc(k)}</span>
            <span class="ct">${mshort(v.spent)}/${mshort(v.plan)}</span>
            <span class="bar" style="flex:0 0 52px"><i class="${p>100?'bad':p>80?'warn':'ok'}" style="width:${Math.min(100,p)}%"></i></span>
            <span class="pct">${p}%</span></div>`;}).join('')}</div></div></div>
  </div>`;
}

/* ═════════ RỦI RO ═════════ */
function viewRisks(){
  const list=RISKS.filter(inProj);
  const lv=(p,i)=>{const m={'Cao':3,'Trung bình':2,'Thấp':1};return (m[p]||1)*(m[i]||1);};
  const sorted=[...list].sort((a,b)=>lv(b.prob,b.impact)-lv(a.prob,a.impact));
  const hi=list.filter(r=>lv(r.prob,r.impact)>=6).length;
  return ph('Rủi ro','Ghi lại sớm để xử lý trước khi thành sự cố',
    `<button class="btn btn-pri btn-sm" id="newRisk">${icon('i-plus')}Thêm rủi ro</button>`) + `
  <div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${kpi('red','i-alert','Rủi ro cao',hi)}
    ${kpi('amber','i-clock','Đang xử lý',list.filter(r=>r.status==='Đang xử lý').length)}
    ${kpi('blue','i-eye','Đang theo dõi',list.filter(r=>r.status==='Đang theo dõi').length)}
    ${kpi('gray','i-list','Tổng số',list.length)}
  </div>
  <div class="panel"><div class="panel-h"><b>Danh sách rủi ro</b><small>xếp theo mức nghiêm trọng</small></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="num">#</th><th style="min-width:240px">Rủi ro</th><th>Khả năng</th><th>Ảnh hưởng</th>
      <th>Trạng thái</th><th>Phụ trách</th><th>Dự án</th></tr></thead><tbody>
      ${sorted.length?sorted.map((r,i)=>{
        const pr=PROJECTS.find(x=>x.id===r.project_id)||{};
        const c=v=>v==='Cao'?'s-red':v==='Trung bình'?'s-amber':'s-gray';
        return `<tr data-risk="${r.id}"><td class="num">${i+1}</td>
          <td class="tt">${esc(r.name)}</td>
          <td><span class="pill ${c(r.prob)}">${esc(r.prob)}</span></td>
          <td><span class="pill ${c(r.impact)}">${esc(r.impact)}</span></td>
          <td><span class="pill ${r.status==='Đang xử lý'?'s-blue':r.status==='Đã đóng'?'s-green':'s-amber'}">${esc(r.status)}</span></td>
          <td>${whoCell(r.owner)}</td><td><span class="ct">${esc(pr.code||'—')}</span></td></tr>`;}).join('')
      :'<tr><td colspan="7" class="empty">Chưa ghi nhận rủi ro nào</td></tr>'}
    </tbody></table></div></div>`;
}

/* ═════════ TÀI LIỆU ═════════ */
function viewDocs(){
  const list=DOCS.filter(inProj);
  const cats=[...new Set(list.map(d=>d.cat))];
  return ph('Tài liệu','Brief, hướng dẫn, quy trình, tư liệu dùng chung',
    `<button class="btn btn-pri btn-sm" id="newDoc">${icon('i-plus')}Thêm tài liệu</button>`) +
  (cats.length?cats.map(c=>`<div class="panel"><div class="panel-h"><b>${icon('i-doc')}${esc(c)}</b>
    <small>${list.filter(d=>d.cat===c).length}</small></div>
    <div class="tlist">${list.filter(d=>d.cat===c).map(d=>{
      const pr=PROJECTS.find(x=>x.id===d.project_id)||{};
      return `<div class="titem" data-doc="${d.id}">
        <span class="pill pill-s s-teal">${esc(pr.code||'—')}</span>
        <div class="tn"><b>${esc(d.name)}</b><small>${esc(d.owner)} · ${fdate2(d.at)}</small></div>
        ${d.link?`<span class="ct">${icon('i-doc')}</span>`:'<span class="ct" style="color:var(--amber)">chưa có link</span>'}
        </div>`;}).join('')}</div></div>`).join('')
  : '<div class="panel"><div class="empty">Chưa có tài liệu</div></div>');
}

/* ═════════ CUỘC HỌP ═════════ */
function viewMeets(){
  const up=MEETS.filter(m=>dd(m.date)>=0), past=MEETS.filter(m=>dd(m.date)<0);
  const row=m=>{const d=dd(m.date);
    return `<div class="titem" data-meet="${m.id}">
      <span class="pill ${d===0?'s-red':d>0?'s-blue':'s-gray'}">${
        d===0?'Hôm nay':d>0?`còn ${d} ngày`:`${-d} ngày trước`}</span>
      <div class="tn"><b>${esc(m.name)}</b><small>${fdate2(m.date)} · ${esc(m.time)} · ${m.mins} phút
        · chủ trì ${esc(m.host)}</small></div>
      <span class="pill pill-s s-gray">${esc(m.kind)}</span></div>`;};
  return ph('Cuộc họp','Lịch họp định kỳ và họp dự án',
    `<button class="btn btn-pri btn-sm" id="newMeet">${icon('i-plus')}Đặt lịch họp</button>`) + `
  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>Sắp diễn ra</b><small>${up.length}</small></div>
      <div class="tlist">${up.length?up.map(row).join(''):'<div class="empty">Chưa có lịch họp</div>'}</div></div>
    <div class="panel"><div class="panel-h"><b>Đã diễn ra</b><small>${past.length}</small></div>
      <div class="tlist">${past.length?past.map(row).join(''):'<div class="empty">Chưa có</div>'}</div></div>
  </div>`;
}

/* ═════════ NHẬT KÝ ═════════ */
let LOGF='';
function viewActivity(){
  return ph('Nhật ký hoạt động','Ai đổi gì, lúc nào — dùng khi cần truy lại một quyết định') + `
  <div class="bar-row">
    <select id="logWho"><option value="">Tất cả người</option>${MEMBERS.map(m=>`<option ${
      m.name===LOGF?'selected':''}>${esc(m.name)}</option>`).join('')}</select>
    <button class="btn btn-gh btn-sm" id="logReload">${icon('i-loop')}Tải lại</button>
  </div>
  <div id="logStat"></div>
  <div class="panel"><div class="panel-h"><b>Lịch sử thay đổi</b><small id="logCnt"></small></div>
    <div class="panel-b" id="logBox">Đang tải…</div></div>`;
}
async function loadLog(){
  const {data}=await sb.from('activity').select('*').order('at').limit(200);
  const all=data||[];
  const list=LOGF?all.filter(a=>a.actor===LOGF):all;
  const box=document.getElementById('logBox'); if(!box) return;
  const cnt=document.getElementById('logCnt'); if(cnt) cnt.textContent=list.length+' thay đổi';
  const stat=document.getElementById('logStat');
  if(stat){
    const byWho={}; all.forEach(a=>{if(a.actor) byWho[a.actor]=(byWho[a.actor]||0)+1;});
    const td=all.filter(a=>a.at&&a.at.slice(0,10)===iso(D0())).length;
    stat.innerHTML=`<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${kpi('pri','i-loop','Tổng thay đổi',all.length)}
      ${kpi('blue','i-cal','Hôm nay',td)}
      ${kpi('green','i-check','Chuyển sang hoàn tất',
        all.filter(a=>/Đã đăng|Hoàn thành|Đã bàn giao/.test(a.to_status||'')).length)}
      ${kpi('amber','i-users','Người thao tác nhiều nhất',
        Object.keys(byWho).sort((a,b)=>byWho[b]-byWho[a])[0]||'—',
        Object.keys(byWho).length?Object.values(byWho).sort((a,b)=>b-a)[0]+' lần':'')}
    </div>`;}
  box.innerHTML=list.length?list.map(a=>`<div class="log">
    <b>${esc(a.actor||'ai đó')}</b> đổi <b>${esc(a.item)}</b>
    từ <span class="pill pill-s s-gray">${esc(a.from_status)}</span>
    sang <span class="pill pill-s s-blue">${esc(a.to_status)}</span><br>
    <time>${new Date(a.at).toLocaleString('vi-VN')}</time></div>`).join('')
    :'<div class="empty">Chưa có thay đổi nào được ghi lại</div>';
  const w=document.getElementById('logWho'); if(w) w.onchange=()=>{LOGF=w.value;loadLog();};
  const r=document.getElementById('logReload'); if(r) r.onclick=()=>loadLog();
}

/* ═════════ CÀI ĐẶT ═════════ */
function viewSetup(){
  const ed=can('role.manage');
  return ph('Cài đặt','Mốc thời gian, ngưỡng nhắc việc và quy trình chung của phòng') + `
  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>${icon('i-cal')} Mốc & ngưỡng nhắc việc</b>
      <small>${ed?'sửa trực tiếp rồi bấm Lưu':'chỉ Leader sửa được'}</small></div>
      <div class="panel-b">
        <div class="setrow"><span class="setl">Ngày khai trương cơ sở 2</span>
          <input type="date" id="setOpen" class="fld" value="${SET.opening_date||''}" ${ed?'':'disabled'}></div>
        <div class="setrow"><span class="setl">Nhắc khi bài chờ duyệt quá</span>
          <span class="setu"><input type="number" id="setSla1" class="fld" value="${SET.sla_duyet||2}" ${ed?'':'disabled'}> ngày</span></div>
        <div class="setrow"><span class="setl">Nhắc khi thiết kế trễ quá</span>
          <span class="setu"><input type="number" id="setSla2" class="fld" value="${SET.sla_thietke||3}" ${ed?'':'disabled'}> ngày</span></div>
        <div class="setrow"><span class="setl">Ngưỡng báo quá tải</span>
          <span class="setu"><input type="number" id="setLoad" class="fld" value="${SET.load_max||14}" ${ed?'':'disabled'}> việc/người</span></div>
        <div class="setrow"><span class="setl">Giờ đăng mặc định</span>
          <input type="time" id="setTime" class="fld" value="${SET.default_time||'19:30'}" ${ed?'':'disabled'}></div>
        <div class="setrow"><span class="setl">Tên phòng ban</span>
          <input type="text" id="setDept" class="fld" value="${esc(SET.dept_name||'Phòng Marketing — Kitachi')}" ${ed?'':'disabled'}></div>
        ${ed?`<button class="btn btn-pri btn-full" id="setSave">${icon('i-check')}Lưu cài đặt</button>`:''}
      </div></div>

    <div class="panel"><div class="panel-h"><b>${icon('i-loop')} Quy trình một bài đăng</b>
      <small>${FLOW.length-1} chặng · ai giữ chặng nào</small></div>
      <div class="tlist">${FLOW.filter(f=>f.s!=='Huỷ bỏ').map((f,i)=>`<div class="titem">
        <span class="stepn">${i+1}</span>
        <span class="pill ${f.cls}">${f.ic} ${esc(f.s)}</span>
        <div class="tn"><b>${esc(f.hint)}</b></div>
        <span class="due">${f.hold==='leader'?'Leader':f.hold==='writer'?'Người viết':f.hold==='design'?'Thiết kế':'Kết thúc'}</span>
        </div>`).join('')}</div>
      <div class="panel-b" style="border-top:1px solid var(--line);font-size:11.5px;color:var(--ink3);line-height:1.6">
        Quy trình cố định để mọi người cùng một cách làm. Muốn đổi ai giữ chặng nào,
        sang mục <b style="color:var(--pri);cursor:pointer" id="goRoles">Vai trò và quyền</b>.</div></div>
  </div>

  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>${icon('i-users')} Nhân sự</b>
      <small>${MEMBERS.length} người · bấm để sửa</small></div>
      <div class="tlist">${MEMBERS.map(m=>{
        const n=PERMS.filter(p=>(p.vals||{})[m.role]&&p.vals[m.role]!=='Không').length;
        return `<div class="titem" data-medit="${m.id}">
        ${avat(m.name)}<div class="tn"><b>${esc(m.name)}</b><small>${esc(m.role)}
        ${m.manager?`· báo cáo cho ${esc(m.manager)}`:'· quản lý phòng'} · ${n} quyền</small></div>
        <span class="pill pill-s ${m.kind==='leader'?'s-pri':m.kind==='writer'?'s-blue':'s-pink'}">${
          m.kind==='leader'?'Duyệt':m.kind==='writer'?'Viết':'Thiết kế'}</span></div>`;}).join('')}</div>
      ${can('member.manage')?`<div class="panel-b" style="border-top:1px solid var(--line)">
        <button class="btn btn-gh btn-full" id="setNewMem" style="margin:0">${icon('i-plus')}Thêm nhân sự</button></div>`:''}</div>

    <div class="panel"><div class="panel-h"><b>${icon('i-signal')} Kênh đang vận hành</b>
      <small>${CHANNELS.length} kênh · bấm để cấu hình</small></div>
      <div class="tlist">${CHANNELS.map(c=>{const P=PLAT[c.platform]||{};
        return `<div class="titem" data-chedit="${c.id}">
        <span class="cd" style="width:9px;height:9px;border-radius:50%;background:${P.color||'#999'}"></span>
        <div class="tn"><b>${esc(c.name)}</b><small>${esc(c.platform)} · ${esc(c.owner_content||'')}
          · ${c.target_week||0} bài/tuần</small></div>
        <span class="ct">${mshort(c.budget_month||0)}/tháng</span></div>`;}).join('')}</div>
      ${can('channel.manage')?`<div class="panel-b" style="border-top:1px solid var(--line)">
        <button class="btn btn-gh btn-full" id="setNewCh" style="margin:0">${icon('i-plus')}Thêm kênh</button></div>`:''}</div>
  </div>

  <div class="panel"><div class="panel-h"><b>${icon('i-box')} Dữ liệu hệ thống</b>
    <small>số lượng bản ghi hiện có</small></div>
    <div class="panel-b"><div class="dgrid">
      ${[['Dự án',PROJECTS.length,'projects'],['Đầu việc',TASKS.length,'tasks'],
         ['Bài đăng',POSTS.length,'posts'],['Kênh',CHANNELS.length,'channels'],
         ['Chiến dịch QC',ADS.length,'ads'],['Khoản ngân sách',BUDGET.length,'budget'],
         ['Rủi ro',RISKS.length,'risks'],['Tài liệu',DOCS.length,'docs'],
         ['Cuộc họp',MEETS.length,'meets'],['Báo cáo ngày',REPORTS.length,'reports'],
         ['Đã lưu trữ',ALL_TASKS.filter(x=>x.archived).length+ALL_POSTS.filter(x=>x.archived).length,'archive']]
        .map(([t,n,v])=>`<div class="dcell2" data-goto="${v}"><span>${t}</span><b>${n}</b></div>`).join('')}
    </div></div></div>`;
}

/* ═════════ NHÂN SỰ ═════════ */
function viewTeam(){
  const rows=MEMBERS.map(m=>{
    const hp=POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name));
    const ht=TASKS.filter(t=>(t.owner||'').includes(m.name)&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
    const lt=hp.filter(latePost).length+ht.filter(lateTask).length;
    const load=Math.min(100,Math.round((hp.length+ht.length)/16*100));
    const done=POSTS.filter(p=>p.writer===m.name&&p.status==='Đã đăng').length;
    const nperm=PERMS.filter(p=>(p.vals||{})[m.role]&&p.vals[m.role]!=='Không').length;
    return `<tr data-medit="${m.id}">
      <td><div class="whorow">${avat(m.name)}<span><b>${esc(m.name)}</b>
        <small>${esc(m.role)}</small></span></div></td>
      <td>${esc(m.dept||'—')}</td>
      <td>${m.manager?esc(m.manager):'<span style="color:var(--ink3)">—</span>'}</td>
      <td><span class="pill pill-s ${m.kind==='leader'?'s-pri':m.kind==='writer'?'s-blue':'s-pink'}">${
        m.kind==='leader'?'Duyệt':m.kind==='writer'?'Viết':'Thiết kế'}</span></td>
      <td><span class="ct">${nperm} quyền</span></td>
      <td>${hp.length}</td><td>${ht.length}</td>
      <td>${lt?`<span class="pill pill-s s-red">${lt}</span>`:'<span style="color:var(--ink3)">0</span>'}</td>
      <td>${done}</td>
      <td style="min-width:130px"><div class="prow" style="border:0;padding:0">
        <span class="bar" style="flex:1"><i class="${load>85?'bad':load>60?'warn':'ok'}" style="width:${load}%"></i></span>
        <span class="pct">${load}%</span></div></td></tr>`;}).join('');
  const tree=MEMBERS.filter(m=>!m.manager).map(root=>{
    const kids=MEMBERS.filter(m=>m.manager===root.name);
    return [{n:root.name,lv:0},...kids.flatMap(k=>[{n:k.name,lv:1},
      ...MEMBERS.filter(g=>g.manager===k.name).map(g=>({n:g.name,lv:2}))])];
  }).flat().map(x=>{const m=MEMBERS.find(y=>y.name===x.n)||{};
    return `<div class="prow" data-medit="${m.id}" style="cursor:pointer">
      <span class="nm" style="padding-left:${x.lv*24}px">${x.lv?'<span style="color:var(--ink3)">└─</span>':''}
        ${avat(x.n)}<b>${esc(x.n)}</b></span>
      <span class="ct">${esc(m.role||'')}</span></div>`;}).join('');
  return ph('Thành viên',MEMBERS.length+' vị trí · khối lượng việc, quyền hạn và phân cấp báo cáo',
    can('member.manage')?`<button class="btn btn-pri btn-sm" id="newMem">${icon('i-plus')}Thêm nhân sự</button>`:'') + `
  <div class="g21">
    <div class="panel"><div class="panel-h"><b>Khối lượng công việc</b><small>${MEMBERS.length} người</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:170px">Thành viên</th><th>Bộ phận</th><th>Quản lý</th><th>Nhóm quyền</th>
        <th>Quyền</th><th>Bài</th><th>Việc</th><th>Trễ</th><th>Đã đăng</th><th>Tải</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>
    <div class="panel"><div class="panel-h"><b>Sơ đồ báo cáo</b></div>
      <div class="panel-b">${tree}</div></div>
  </div>`;
}

const SCOPES=['Toàn hệ thống','Trong nhóm','Của mình','Không'];
const YESNO=['Cho phép','Không'];
let PEDIT=false, PDRAFT=null;

/* Quyền của người đang đăng nhập */
function myRole(){ return (ME&&ME.role)||''; }
function can(key){
  const p=PERMS.find(x=>x.key===key); if(!p) return true;
  const v=(p.vals||{})[myRole()];
  return v&&v!=='Không';
}
function scopeOf(key){
  const p=PERMS.find(x=>x.key===key); if(!p) return 'Toàn hệ thống';
  return (p.vals||{})[myRole()]||'Không';
}
/* Lọc danh sách theo phạm vi quyền */
function byScope(list,key,ownerField){
  const sc=scopeOf(key);
  if(sc==='Toàn hệ thống'||sc==='Cho phép') return list;
  if(sc==='Không') return [];
  const team=MEMBERS.filter(m=>m.manager===ME.name).map(m=>m.name).concat([ME.name]);
  if(sc==='Trong nhóm') return list.filter(x=>team.some(n=>(x[ownerField]||'').includes(n)));
  return list.filter(x=>(x[ownerField]||'').includes(ME.name));
}

function viewRoles(){
  const roles=ROLES.map(r=>r.name);
  const orphan=MEMBERS.filter(m=>!roles.includes(m.role));
  const groups=[...new Set(PERMS.map(p=>p.grp))];
  const D=PDRAFT||PERMS;
  const editable=can('role.manage');

  const cell=(p,role)=>{
    const v=(p.vals||{})[role]||'Không';
    const on=v!=='Không';
    if(!PEDIT) return `<td class="pcell">
      <span class="pmark ${on?'on':'off'}">${on?icon('i-check'):''}</span>
      <span class="ptxt ${on?'':'off'}">${on?esc(v):'Không cho phép'}</span></td>`;
    return `<td class="pcell edit">
      <label class="pchk"><input type="checkbox" data-pk="${p.key}" data-pr="${esc(role)}"
        ${on?'checked':''}><span></span></label>
      ${p.scoped?`<select class="psel" data-pk="${p.key}" data-pr="${esc(role)}" ${on?'':'disabled'}>
        ${SCOPES.filter(x=>x!=='Không').map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('')}
        </select>`:`<span class="ptxt ${on?'':'off'}">${on?'Cho phép':'Không'}</span>`}</td>`;};

  const count=r=>PERMS.filter(p=>(p.vals||{})[r]&&p.vals[r]!=='Không').length;

  return ph('Vai trò và quyền',
    `${roles.length} vai trò · ${PERMS.length} chức năng · quyền áp dụng ngay khi lưu`,
    editable?(PEDIT
      ? `<span style="display:flex;gap:8px">
          <button class="btn btn-gh btn-sm" id="pReset">${icon('i-loop')}Khôi phục mặc định</button>
          <button class="btn btn-gh btn-sm" id="pCancel">Huỷ</button>
          <button class="btn btn-pri btn-sm" id="pSave">${icon('i-check')}Lưu thay đổi</button></span>`
      : `<button class="btn btn-pri btn-sm" id="pEdit">${icon('i-pen')}Chỉnh sửa quyền</button>`)
      : `<span class="pill s-gray">Chỉ Leader mới sửa được</span>`) + `
  ${orphan.length?`<div class="notice" style="background:#FEEDED;border-color:#F3C9C9">
    <span class="ni" style="background:#D03535;color:#fff">${icon('i-alert')}</span>
    <span><b>${orphan.length} người có vai trò chưa nằm trong ma trận quyền</b>
    <p>${orphan.map(m=>esc(m.name)+' ('+esc(m.role)+')').join(', ')} — hiện không có quyền nào.
    Sửa vai trò của họ trong mục Thành viên cho khớp với một trong ${roles.length} vai bên dưới.</p></span></div>`:''}
  ${PEDIT?`<div class="notice"><span class="ni">${icon('i-alert')}</span>
    <span><b>Đang ở chế độ chỉnh sửa</b>
    <p>Bỏ tích là chặn hẳn chức năng đó. Ô phạm vi quyết định người đó thấy được dữ liệu của ai.
    Thay đổi chỉ có hiệu lực sau khi bấm Lưu.</p></span></div>`:''}
  <div class="kpis" style="grid-template-columns:repeat(${roles.length},minmax(0,1fr))">
    ${roles.map((r,i)=>{const n=count(r);
      const who=MEMBERS.filter(m=>m.role===r).map(m=>m.short_name||m.name).join(', ');
      return kpi(i===0?'pri':i<3?'blue':'pink',i===0?'i-cog':i<3?'i-pen':'i-brush',r,
        n+'/'+PERMS.length,who||'chưa có ai',Math.round(n/PERMS.length*100));}).join('')}
  </div>
  <div class="panel"><div class="panel-h"><b>Ma trận phân quyền</b>
    <small>${PEDIT?'bấm ô để bật tắt · chọn phạm vi ở ô bên dưới':'chế độ xem'}</small></div>
    <div class="tbl-wrap"><table class="tbl ptbl"><thead><tr>
      <th style="min-width:240px">Chức năng</th>
      ${roles.map(r=>`<th style="min-width:${PEDIT?150:130}px">${esc(r)}</th>`).join('')}</tr></thead><tbody>
      ${groups.map(g=>{const l=D.filter(p=>p.grp===g);
        return `<tr class="pgroup"><td colspan="${roles.length+1}">${esc(l[0].grp_name)}</td></tr>`
          +l.map(p=>`<tr><td class="tt">${esc(p.name)}
            <div style="font-size:10px;color:var(--ink3);font-family:monospace">${esc(p.key)}</div></td>
            ${roles.map(r=>cell(p,r)).join('')}</tr>`).join('');}).join('')}
    </tbody></table></div></div>
  <div class="grid2">
    <div class="panel"><div class="panel-h"><b>Ai đang giữ vai nào</b></div><div class="panel-b">
      ${MEMBERS.map(m=>`<div class="prow" data-medit="${m.id}" style="cursor:pointer">
        <span class="nm">${avat(m.name)}${esc(m.name)}</span>
        <span class="ct">${esc(m.role)}</span>
        <span class="pill pill-s s-gray">${count(m.role)} quyền</span></div>`).join('')}
    </div></div>
    <div class="panel"><div class="panel-h"><b>Ý nghĩa phạm vi</b></div><div class="panel-b">
      <div class="prow"><span class="nm"><b>Toàn hệ thống</b></span>
        <span class="ct">mọi dữ liệu của phòng</span></div>
      <div class="prow"><span class="nm"><b>Trong nhóm</b></span>
        <span class="ct">người mình quản lý trực tiếp</span></div>
      <div class="prow"><span class="nm"><b>Của mình</b></span>
        <span class="ct">chỉ dữ liệu mình tạo hoặc được giao</span></div>
      <div style="font-size:11.5px;color:var(--ink3);margin-top:10px;line-height:1.65">
        Trang Linh quản lý Hồng Hạnh nên duyệt được báo cáo của Hạnh.
        Phạm Vỹ quản lý Diệu Thảo nên duyệt được ấn phẩm của Thảo.
        Công Tuân duyệt cuối cùng mọi thứ.</div></div></div>
  </div>`;
}

function bindRoles(){
  const b=id=>document.getElementById(id);
  if(b('pEdit')) b('pEdit').onclick=()=>{PDRAFT=JSON.parse(JSON.stringify(PERMS));PEDIT=true;render();};
  if(b('pCancel')) b('pCancel').onclick=()=>{PDRAFT=null;PEDIT=false;render();};
  if(b('pSave')) b('pSave').onclick=async()=>{
    let n=0;
    for(const p of PDRAFT){
      const old=PERMS.find(x=>x.id===p.id);
      if(JSON.stringify(old.vals)!==JSON.stringify(p.vals)){
        await sb.from('perms').update({vals:p.vals,updated_by:ME.name}).eq('id',p.id); n++;}}
    PEDIT=false; PDRAFT=null;
    toast(n?`Đã lưu ${n} thay đổi quyền`:'Không có thay đổi nào'); await loadAll();};
  if(b('pReset')) b('pReset').onclick=()=>{
    if(!confirm('Khôi phục toàn bộ quyền về mặc định?')) return;
    PDRAFT=JSON.parse(JSON.stringify(DEMO.perms||PERMS)); render();};
  document.querySelectorAll('.pchk input').forEach(c=>c.onchange=()=>{
    const p=PDRAFT.find(x=>x.key===c.dataset.pk); if(!p) return;
    p.vals[c.dataset.pr]=c.checked?(p.scoped?'Toàn hệ thống':'Cho phép'):'Không';
    render();});
  document.querySelectorAll('.psel').forEach(sl=>sl.onchange=()=>{
    const p=PDRAFT.find(x=>x.key===sl.dataset.pk); if(!p) return;
    p.vals[sl.dataset.pr]=sl.value;});
}

/* ═══════════════════ TƯƠNG TÁC ═══════════════════ */
function bindAll(){
  const on=(sel,fn)=>document.querySelectorAll(sel).forEach(e=>e.onclick=ev=>{ev.stopPropagation();fn(e);});
  on('[data-post]',e=>openPost(+e.dataset.post));
  on('[data-task]',e=>openTask(+e.dataset.task));
  on('[data-chan]',e=>openChan(+e.dataset.chan));
  on('[data-who]',e=>openWho(e.dataset.who));
  on('[data-proj]',e=>go('p-'+e.dataset.proj));
  on('[data-risk]',e=>openRisk(+e.dataset.risk));
  on('[data-meet]',e=>openMeet(+e.dataset.meet));
  on('[data-doc]',e=>openDoc(+e.dataset.doc));
  on('[data-bud]',e=>openBud(+e.dataset.bud));
  document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{TMODE=b.dataset.mode;render();});
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{PTAB=b.dataset.tab;render();});
  document.querySelectorAll('[data-dtab]').forEach(b=>b.onclick=()=>{DTAB=b.dataset.dtab;render();});
  on('[data-q]',async e=>{
    const [a,i]=e.dataset.q.split(':'); const id=+i, TD=iso(new Date());
    const M={'qk-take':[{design_started:TD},'Đã nhận việc'],
      'qk-send':[{status:'Chờ duyệt ấn phẩm',design_done:TD},'Đã gửi Leader duyệt'],
      'qk-tosub':[{status:'Chờ duyệt nội dung'},'Đã gửi Leader duyệt'],
      'qk-pub':[{status:'Đã đăng'},'Đã đánh dấu đăng xong']}[a];
    if(M) await save('posts',id,M[0],M[1]);});
  ['fSt','fPri','fOwn','fArea'].forEach(i=>{const e=document.getElementById(i);if(e)e.onchange=drawTasks;});
  ['pCh','pWho','pSt'].forEach(i=>{const e=document.getElementById(i);if(e)e.onchange=drawPosts;});
  const pv=document.getElementById('calPrev'),nx=document.getElementById('calNext');
  if(pv)pv.onclick=()=>{CAL.setMonth(CAL.getMonth()-1);render();};
  if(nx)nx.onclick=()=>{CAL.setMonth(CAL.getMonth()+1);render();};
  const b=id=>document.getElementById(id);
  if(b('newTask'))b('newTask').onclick=()=>openNewTask();
  if(b('newPost'))b('newPost').onclick=()=>openNewPost();
  if(b('newProj'))b('newProj').onclick=()=>openNewProj();
  if(b('newRisk'))b('newRisk').onclick=()=>openNewRisk();
  if(b('newDoc'))b('newDoc').onclick=()=>openNewDoc();
  if(b('newChan'))b('newChan').onclick=()=>openChanEdit(null);
  if(b('newMem'))b('newMem').onclick=()=>editMember(null);
  if(b('newBud'))b('newBud').onclick=()=>openNewBud();
  if(b('newMeet'))b('newMeet').onclick=()=>openNewMeet();
  on('[data-desk]',e=>go('d-'+e.dataset.desk));
  on('[data-chfil]',e=>{CHFIL=+e.dataset.chfil; render();});
  on('[data-chedit]',e=>openChanEdit(+e.dataset.chedit));
  on('[data-popen]',e=>go('p-'+e.dataset.popen));
  on('[data-medit]',e=>editMember(MEMBERS.find(x=>x.id===+e.dataset.medit)));
  on('[data-day]',e=>{DAY=e.dataset.day; render();});
  on('[data-wch]',e=>{const v=+e.dataset.wch; WCH=(WCH===v?0:v); render();});
  on('[data-ad]',e=>openAd(+e.dataset.ad));
  on('[data-rep]',e=>{const i=+e.dataset.rep; i?openReport(i):openReportForm(null);});
  on('[data-apr]',e=>openApr(+e.dataset.apr));
  on('[data-duty]',e=>openDuty(+e.dataset.duty));
  on('[data-sprint]',e=>openSprint(+e.dataset.sprint));
  on('[data-kudo]',e=>openKudo(+e.dataset.kudo));
  on('[data-rok]',e=>save('reports',+e.dataset.rok,{status:'Đã duyệt'},'Đã duyệt báo cáo'));
  on('[data-rfix]',e=>openReport(+e.dataset.rfix));
  on('[data-aok]',e=>save('approvals',+e.dataset.aok,{status:'Đã duyệt'},'Đã duyệt'));
  document.querySelectorAll('[data-rtab]').forEach(b=>b.onclick=()=>{RTAB=b.dataset.rtab;render();});
  document.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{RVIEW=b.dataset.rv;render();});
  document.querySelectorAll('[data-chtab]').forEach(b=>b.onclick=()=>{CHTAB=b.dataset.chtab;MCH=0;render();});
  on('[data-mch]',e=>{MCH=+e.dataset.mch;CHTAB='metric';render();});
  if(b('mBack')) b('mBack').onclick=()=>{MCH=0;render();};
  document.querySelectorAll('[data-tltab]').forEach(b=>b.onclick=()=>{TLTAB=b.dataset.tltab;render();});
  const pc=document.getElementById('pipeCh');
  if(pc) pc.onchange=()=>{CHFIL=+pc.value;render();};
  if(b('pipeNew')) b('pipeNew').onclick=()=>openNewPost(CHFIL?(CHANNELS.find(c=>c.id===CHFIL)||{}).name:null);
  const rd=document.getElementById('rDate'); if(rd) rd.onchange=()=>{RDAY=rd.value;render();};
  if(b('rNew')) b('rNew').onclick=()=>openReportForm(null);
  if(b('rEdit')) b('rEdit').onclick=()=>openReportForm(
    REPORTS.find(x=>x.author===ME.name&&x.date===(RDAY||iso(D0()))));
  if(b('newApr')) b('newApr').onclick=()=>editApr(null);
  if(b('newKudo')) b('newKudo').onclick=()=>openNewKudo();
  if(b('newDuty')) b('newDuty').onclick=()=>openNewDuty();
  if(b('newMem2')) b('newMem2').onclick=()=>editMember(null);
  if(b('goPerf')) b('goPerf').onclick=()=>go('perf');
  if(b('goRep')) b('goRep').onclick=()=>go('reports');
  if(b('goRoles')) b('goRoles').onclick=()=>go('roles');
  if(b('setNewMem')) b('setNewMem').onclick=()=>editMember(null);
  if(b('setNewCh')) b('setNewCh').onclick=()=>openChanEdit(null);
  if(b('calNew')) b('calNew').onclick=()=>openNewPost(CHFIL?(CHANNELS.find(c=>c.id===CHFIL)||{}).name:null);
  if(b('setSave')) b('setSave').onclick=async()=>{
    const up=[['opening_date',V('setOpen')],['sla_duyet',V('setSla1')],['sla_thietke',V('setSla2')],
      ['load_max',V('setLoad')],['default_time',V('setTime')],['dept_name',V('setDept')]];
    for(const [k,v] of up) await sb.from('settings').update({value:v}).eq('key',k);
    toast('Đã lưu cài đặt'); await loadAll();};
  on('[data-goto]',e=>go(e.dataset.goto));
  on('[data-newday]',e=>{const d=e.dataset.newday;
    openNewPost(CHFIL?(CHANNELS.find(c=>c.id===CHFIL)||{}).name:null);
    setTimeout(()=>{const f=document.getElementById('pf_date'); if(f) f.value=d;},80);});
  if(b('newSprint')) b('newSprint').onclick=()=>editSprint(null);
  document.querySelectorAll('[data-wtab]').forEach(b=>b.onclick=()=>{WTAB=b.dataset.wtab;render();});
  on('[data-q2]',async e=>{const [a,i]=e.dataset.q2.split(':'); const id=+i, TD=iso(new Date());
    const M={'wk-take':[{design_started:TD},'Đã nhận việc'],
      'wk-send':[{status:'Chờ duyệt ấn phẩm',design_done:TD},'Đã gửi Leader duyệt'],
      'wk-sub':[{status:'Chờ duyệt nội dung'},'Đã gửi Leader duyệt'],
      'wk-appr':[{status:'Đang thiết kế'},'Đã duyệt — chuyển sang thiết kế'],
      'wk-pub':[{status:'Đã đăng'},'Đã đánh dấu đăng xong']}[a];
    if(M) await save('posts',id,M[0],M[1]);});
  if(b('wAll')) b('wAll').onclick=()=>{WCH=0;render();};
  if(b('wNew')) b('wNew').onclick=()=>openNewPost(WCH?(CHANNELS.find(c=>c.id===WCH)||{}).name:null);
  if(b('newAd')) b('newAd').onclick=()=>editAd(null);
  const dp=document.getElementById('dPick');
  if(dp) dp.onchange=()=>{DAY=dp.value; render();};
  const dt=document.getElementById('dToday'); if(dt) dt.onclick=()=>{DAY=null; render();};
  const dpv=document.getElementById('dPrev'); if(dpv) dpv.onclick=()=>{DAY=null; go('cal');};
  on('[data-pedit]',e=>editProject(PROJECTS.find(x=>x.id===+e.dataset.pedit)));
  on('[data-pdel]',async e=>{const pr=PROJECTS.find(x=>x.id===+e.dataset.pdel);
    const n=TASKS.filter(t=>t.project_id===pr.id).length;
    if(!confirm('Xoá dự án "'+pr.name+'"?'+(n?'\n'+n+' đầu việc thuộc dự án cũng sẽ bị xoá.':'')))return;
    await sb.from('projects').delete().eq('id',pr.id); toast('Đã xoá dự án'); await loadAll();});
  on('[data-newpost]',e=>openNewPost(e.dataset.newpost));
  on('[data-newch-plat]',e=>{openChanEdit(null);
    setTimeout(()=>{const b=document.querySelector('[data-plat="'+e.dataset.newchPlat+'"]');
      if(b) b.click();},60);});
  on('[data-task-arch]',e=>openTask(+e.dataset.taskArch));
  on('[data-post-arch]',e=>openPost(+e.dataset.postArch));
  on('[data-restore]',async e=>{const [k,i]=e.dataset.restore.split(':');
    await sb.from(k).update({archived:false,updated_by:ME.name}).eq('id',+i);
    toast('Đã khôi phục'); await loadAll();});
  on('[data-purge]',async e=>{const [k,i]=e.dataset.purge.split(':');
    if(!confirm('Xoá hẳn mục này? Không khôi phục lại được.'))return;
    await sb.from(k).delete().eq('id',+i); toast('Đã xoá hẳn'); await loadAll();});
  const q=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  q('qTask',openNewTask); q('qPost',openNewPost); q('qProj',openNewProj);
  q('qMeet',openNewMeet); q('qRisk',openNewRisk); q('qDoc',openNewDoc);
  q('qCal',()=>go('cal')); q('qRep',()=>go('reports')); q('seeAll',()=>openAlerts());
  document.querySelectorAll('[data-pjtab]').forEach(b=>b.onclick=()=>{PJTAB=b.dataset.pjtab;render();});
  ['pjq','pjOwn'].forEach(i=>{const e=document.getElementById(i);if(e)e.oninput=e.onchange=drawProjects;});
  on('[data-tok]',e=>save('tasks',+e.dataset.tok,{status:'Đang làm'},'Đã duyệt — việc vào danh sách chính thức'));
  on('[data-tfix]',e=>openTask(+e.dataset.tfix));
  on('[data-tno]',async e=>{if(!confirm('Huỷ yêu cầu này?'))return;
    await save('tasks',+e.dataset.tno,{status:'Không áp dụng'},'Đã huỷ yêu cầu');});
  if(document.getElementById('pjBody')) drawProjects();
  if(document.getElementById('taskBody')) drawTasks();
  if(document.getElementById('pRows')) drawPosts();
}

const openDrawer=h=>{document.getElementById('drawerBody').innerHTML=h;
  document.getElementById('drawer').classList.remove('hidden');};
const closeDrawer=()=>document.getElementById('drawer').classList.add('hidden');
document.querySelector('.drawer-close').onclick=closeDrawer;
document.querySelector('.drawer-bg').onclick=closeDrawer;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});

async function save(tbl,id,patch,msg){
  const {error}=await sb.from(tbl).update({...patch,updated_by:ME.name}).eq('id',id);
  if(error){toast('Lỗi: '+error.message);return false;}
  toast(msg); closeDrawer(); await loadAll(); return true;
}
async function add(tbl,row,msg){
  const {error}=await sb.from(tbl).insert({...row,updated_by:ME.name});
  if(error){toast('Không lưu được: '+error.message);return false;}
  toast(msg); closeDrawer(); await loadAll(); return true;
}
const V=id=>{const e=document.getElementById(id);return e?e.value.trim():'';};

/* ─── Chi tiết bài đăng ─── */
function briefBlock(p){
  const L=(u,t)=>u?`<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`:'';
  if(!(p.brief||p.brief_link||p.brief_img||p.link_footage))
    return `<div class="dr-lab">Brief cho thiết kế</div>
      <div class="dr-txt" style="color:var(--red)">Chưa có brief. Người viết cần điền yêu cầu hoặc dán link trước khi giao.</div>`;
  return `<div class="dr-lab">Brief cho thiết kế</div>
    ${p.brief?`<div class="dr-txt">${esc(p.brief)}</div>`:''}
    ${(p.brief_link||p.brief_img||p.link_footage)?`<div style="font-size:12.5px;line-height:2.1;margin-top:8px">
      ${[L(p.brief_link,'📄 Mở brief'),L(p.brief_img,'🖼 Ảnh mẫu'),L(p.link_footage,'🎬 Tư liệu')]
        .filter(Boolean).join(' · ')}</div>`:''}
    ${p.handoff_by?`<div style="font-size:11.5px;color:var(--ink3);margin-top:8px">
      ${esc(p.handoff_by)} giao cho ${esc(p.editor||'—')}${p.handoff_at?` ngày ${fdate(p.handoff_at)}`:''}
      ${p.design_due?` · hạn ${fdate(p.design_due)}`:''}</div>`:''}`;
}
function actionBlock(p){
  const mk=(id,t,c)=>`<button class="btn ${c||'btn-pri'} btn-full" id="${id}" style="margin-top:9px">${t}</button>`;
  const k=(MEMBERS.find(m=>m.name===ME.name)||{}).kind;
  const isD=p.editor===ME.name;
  let h='';
  if(k!=='design'&&['Đang thiết kế','Chờ duyệt nội dung','Cần chỉnh sửa','Đang viết'].includes(norm(p.status)))
    h+=mk('actHandoff',icon('i-send')+(p.editor&&p.editor!=='Không cần'&&(p.brief||p.brief_link)
      ?'Giao lại cho thiết kế':'Giao cho thiết kế'));
  if(isD&&norm(p.status)==='Đang thiết kế'&&!p.design_started)
    h+=mk('actTake',icon('i-hand')+'Nhận việc — bắt đầu làm');
  if(isD&&norm(p.status)==='Đang thiết kế'&&p.design_started)
    h+=mk('actSend',icon('i-check')+'Làm xong — gửi Leader duyệt');
  const canA=can('post.approve')&&(scopeOf('post.approve')==='Toàn hệ thống'
    ||MEMBERS.some(m=>m.manager===ME.name&&m.name===p.writer));
  const canD=can('design.approve')&&(scopeOf('design.approve')==='Toàn hệ thống'
    ||MEMBERS.some(m=>m.manager===ME.name&&m.name===p.editor));
  if(canA&&norm(p.status)==='Chờ duyệt nội dung') h+=mk('actApprove',icon('i-check')+'Duyệt nội dung');
  if(canD&&norm(p.status)==='Chờ duyệt ấn phẩm') h+=mk('actApprove2',icon('i-check')+'Duyệt & cho đăng');
  if((canA||canD)&&['Chờ duyệt nội dung','Chờ duyệt ấn phẩm'].includes(norm(p.status)))
    h+=mk('actReject',icon('i-loop')+'Yêu cầu chỉnh sửa','btn-gh');
  return h?`<div class="dr-lab">Việc bạn có thể làm ngay</div>${h}`:'';
}
function openPost(id){
  const p=POSTS.find(x=>x.id===id); if(!p) return;
  const d=dd(p.pub_date);
  openDrawer(`
    <div class="dr-code">${esc(p.channel||'')} · ${esc(p.ctype||'')}</div>
    <div class="dr-title">${esc(p.title)}</div>
    <div class="dr-meta">Người viết <b>${esc(p.writer||'—')}</b>${
      p.editor&&p.editor!=='Không cần'?` · thiết kế <b>${esc(p.editor)}</b>`:''}<br>
      Đang ở tay <b style="color:var(--pri)">${esc(holder(p)||'không ai')}</b><br>
      Đăng <b class="${latePost(p)?'due late':''}">${fdate2(p.pub_date)} ${esc(p.pub_time||'')}</b>${
      d!==null?` · ${d<0?`trễ ${-d} ngày`:d===0?'hôm nay':`còn ${d} ngày`}`:''}<br>
      ${p.fmt?`${esc(p.fmt)}`:''}${p.goal?` · mục tiêu ${esc(p.goal)}`:''}</div>
    ${p.status==='Đã đăng'?`<div class="mtr">
      <div><span>Lượt xem</span><b>${kf(p.views)}</b></div><div><span>Tương tác</span><b>${kf(p.eng)}</b></div>
      <div><span>Chia sẻ</span><b>${nf(p.shares)}</b></div><div><span>Lưu</span><b>${nf(p.saves)}</b></div></div>`:''}
    ${briefBlock(p)}
    ${actionBlock(p)}
    ${p.script?`<div class="dr-lab">Nội dung / kịch bản</div><div class="dr-txt">${esc(p.script)}</div>`:''}
    <div class="dr-lab">Chuyển chặng</div>
    <div class="st-opts">${FLOW.map(f=>`<button class="st-opt ${f.s===p.status?'on':''}" data-st="${esc(f.s)}">
      <span>${f.ic} ${esc(f.s)}</span><em>${f.hold==='leader'?'Leader':f.hold==='writer'?'Người viết':f.hold==='design'?'Thiết kế':'xong'}</em>
      </button>`).join('')}</div>
    <div class="dr-lab">Ghi chú</div><textarea id="dNote">${esc(p.note||'')}</textarea>
    <button class="btn btn-gh btn-full" id="dSave">Lưu ghi chú</button>
    ${rowActions('posts',id)}`);
  bindActions('posts',id,p);
  const TD=iso(new Date());
  document.querySelectorAll('.st-opt').forEach(b=>b.onclick=async()=>{
    const st=b.dataset.st, patch={status:st};
    if(st==='Đang thiết kế'&&p.editor&&p.editor!=='Không cần'&&!(p.brief||p.brief_link)){
      toast('Cần có brief trước khi chuyển sang thiết kế'); handoffForm(p); return;}
    if(st==='Đang thiết kế'&&!p.design_started) patch.design_started=TD;
    if(st==='Chờ duyệt ấn phẩm') patch.design_done=TD;
    const nh=holder({...p,status:st});
    await save('posts',id,patch,nh&&nh!==ME.name?`Đã chuyển sang “${st}” — tới lượt ${nh}`:`Đã chuyển sang “${st}”`);
  });
  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  on('dSave',()=>save('posts',id,{note:document.getElementById('dNote').value},'Đã lưu ghi chú'));
  on('actHandoff',()=>handoffForm(p));
  on('actTake',()=>save('posts',id,{status:'Đang thiết kế',design_started:TD},'Đã nhận việc'));
  on('actSend',()=>save('posts',id,{status:'Chờ duyệt thiết kế',design_done:TD},
    'Đã gửi Leader duyệt — tới lượt '+((MEMBERS.find(m=>m.kind==='leader')||{}).name||'Leader')));
  on('actApprove',()=>{closeDrawer();handoffForm(p);});
  on('actApprove2',()=>save('posts',id,{status:'Đã đăng'},'Đã duyệt và đánh dấu đăng'));
  on('actReject',()=>save('posts',id,{status:'Cần chỉnh sửa'},'Đã trả lại cho '+(p.writer||'người viết')));
}

function handoffForm(p){
  const ds=MEMBERS.filter(m=>m.kind==='design');
  const t=new Date(D0()); t.setDate(t.getDate()+3);
  openDrawer(`<div class="dr-code">Giao việc thiết kế</div>
    <div class="dr-title">${esc(p.title)}</div>
    <div class="dr-meta">Chọn người làm, đặt hạn và để lại brief rõ ràng.</div>
    <div class="two"><div><div class="dr-lab">Giao cho</div>
      <select id="hWho" class="fld">${ds.map(m=>`<option ${m.name===p.editor?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Hạn thiết kế</div>
      <input type="date" id="hDue" class="fld" value="${p.design_due||iso(t)}"></div></div>
    <div class="dr-lab">Yêu cầu / brief</div>
    <textarea id="hBrief" placeholder="Cần dựng gì, tông màu, độ dài…">${esc(p.brief||'')}</textarea>
    <div class="dr-lab">Link brief</div><input type="text" id="hLink" class="fld" value="${esc(p.brief_link||'')}" placeholder="docs.google.com/…">
    <div class="dr-lab">Link ảnh mẫu</div><input type="text" id="hImg" class="fld" value="${esc(p.brief_img||'')}" placeholder="drive.google.com/…">
    <div class="dr-lab">Link tư liệu / footage</div><input type="text" id="hFoot" class="fld" value="${esc(p.link_footage||'')}">
    <button class="btn btn-pri btn-full" id="hSave">${icon('i-send')}Giao việc</button>`);
  document.getElementById('hSave').onclick=async()=>{
    if(!V('hBrief')&&!V('hLink')){toast('Cần ít nhất một dòng brief hoặc một link');return;}
    await save('posts',p.id,{editor:V('hWho'),design_due:V('hDue')||null,brief:V('hBrief')||null,
      brief_link:V('hLink')||null,brief_img:V('hImg')||null,link_footage:V('hFoot')||null,
      handoff_by:ME.name,handoff_at:iso(new Date()),status:'Đang thiết kế',design_started:null},
      'Đã giao cho '+V('hWho'));
  };
}

/* ─── Chi tiết đầu việc ─── */
function openTask(id){
  const t=TASKS.find(x=>x.id===id); if(!t) return;
  const pr=PROJECTS.find(x=>x.id===t.project_id)||{};
  const sp=SPRINTS.find(x=>x.id===t.sprint_id)||{};
  openDrawer(`<div class="dr-code">${esc(t.code||'')} · ${esc(t.area||'')}</div>
    <div class="dr-title">${esc(t.name)}</div>
    <div class="dr-meta">Dự án <b>${esc(pr.name||'—')}</b>${sp.name?` · ${esc(sp.name)}`:''}<br>
      Người xử lý <b>${esc(t.owner||'chưa giao')}</b>${t.assigner?` · giao bởi <b>${esc(t.assigner)}</b>`:''}<br>
      Hạn <b class="${lateTask(t)?'due late':''}">${fdate2(t.due)}</b>
      ${t.priority?` · ưu tiên <b>${esc(t.priority)}</b>`:''}${t.est?` · ước tính ${t.est}h`:''}</div>
    ${t.detail?`<div class="dr-lab">Mô tả</div><div class="dr-txt">${esc(t.detail)}</div>`:''}
    <div class="dr-lab">Đổi trạng thái</div>
    <div class="st-opts">${TST.map(s=>`<button class="st-opt ${s.s===t.status?'on':''}" data-ts="${esc(s.s)}">
      <span>${esc(s.s)}</span></button>`).join('')}</div>
    <div class="dr-lab">Giao lại cho</div>
    <select id="tOwn" class="fld">${MEMBERS.map(m=>
      `<option ${(t.owner||'').includes(m.name)?'selected':''}>${esc(m.name)}</option>`).join('')}</select>
    <div class="two" style="margin-top:10px">
      <div><div class="dr-lab" style="margin-top:0">Hạn</div><input type="date" id="tDue" class="fld" value="${t.due||''}"></div>
      <div><div class="dr-lab" style="margin-top:0">Ưu tiên</div><select id="tPri" class="fld">
        ${['Cao','Trung bình','Thấp'].map(x=>`<option ${x===t.priority?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="dr-lab">Ghi chú</div><textarea id="tNote">${esc(t.note||'')}</textarea>
    <button class="btn btn-pri btn-full" id="tSave">Lưu thay đổi</button>
    ${rowActions('tasks',id)}`);
  bindActions('tasks',id,t);
  document.querySelectorAll('[data-ts]').forEach(b=>b.onclick=()=>
    save('tasks',id,{status:b.dataset.ts},`Đã chuyển sang “${b.dataset.ts}”`));
  document.getElementById('tSave').onclick=()=>save('tasks',id,
    {owner:V('tOwn'),due:V('tDue')||null,priority:V('tPri'),
     note:document.getElementById('tNote').value},'Đã lưu thay đổi');
}

function openWho(name){
  const m=MEMBERS.find(x=>x.name===name)||{};
  const hp=POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,name));
  const tk=TASKS.filter(t=>(t.owner||'').includes(name)&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  const done=POSTS.filter(p=>p.writer===name&&p.status==='Đã đăng');
  const v=done.reduce((s,p)=>s+(p.views||0),0);
  openDrawer(`<div class="dr-code">${esc(m.role||'')}</div><div class="dr-title">${esc(name)}</div>
    <div class="dr-meta">${m.manager?`Báo cáo cho <b>${esc(m.manager)}</b>`:'Quản lý phòng'}
      ${m.email?`<br>${esc(m.email)}`:''}</div>
    <div class="mtr"><div><span>Bài đang giữ</span><b>${hp.length}</b></div>
      <div><span>Việc dự án</span><b>${tk.length}</b></div>
      <div><span>Đã đăng</span><b style="color:var(--green)">${done.length}</b></div>
      <div><span>Lượt xem</span><b>${kf(v)}</b></div></div>
    <div class="dr-lab">Bài đang giữ</div>
    <div class="tlist">${hp.length?hp.map(p=>postRow(p,false)).join(''):'<div class="empty">Không giữ bài nào</div>'}</div>
    <div class="dr-lab">Đầu việc dự án</div>
    <div class="tlist">${tk.length?tk.slice(0,14).map(taskRow).join(''):'<div class="empty">Không có việc nào</div>'}</div>`);
  bindAll();
}

function openChan(id){
  const c=CHANNELS.find(x=>x.id===id); if(!c) return;
  const all=POSTS.filter(p=>p.channel===c.name), posted=all.filter(p=>p.status==='Đã đăng');
  const v=posted.reduce((s,p)=>s+(p.views||0),0);
  openDrawer(`<div class="dr-code">${esc(c.platform)}</div><div class="dr-title">${esc(c.name)}</div>
    <div class="dr-meta">${esc(c.role||'')}<br>Ưu tiên <b>${esc(c.priority||'')}</b>
      · mục tiêu <b>${c.target_week||0} bài/tuần</b></div>
    <div class="mtr"><div><span>Follow</span><b>${kf(c.followers)}</b></div>
      <div><span>Đã đăng</span><b>${posted.length}</b></div>
      <div><span>Lượt xem</span><b>${kf(v)}</b></div>
      <div><span>TB/bài</span><b>${kf(posted.length?Math.round(v/posted.length):0)}</b></div></div>
    ${c.style?`<div class="dr-lab">Style / tông nội dung</div><div class="dr-txt">${esc(c.style)}</div>`:''}
    ${c.note?`<div class="dr-lab">Ghi chú</div><div class="dr-txt">${esc(c.note)}</div>`:''}
    <div class="dr-lab">Bài trên kênh này</div>
    <div class="tlist">${all.length?all.map(p=>postRow(p,false)).join(''):'<div class="empty">Chưa có bài</div>'}</div>`);
  bindAll();
}

function openRisk(id){
  const r=RISKS.find(x=>x.id===id); if(!r) return;
  const pr=PROJECTS.find(x=>x.id===r.project_id)||{};
  openDrawer(`<div class="dr-code">${esc(pr.code||'')}</div><div class="dr-title">${esc(r.name)}</div>
    <div class="dr-meta">Khả năng <b>${esc(r.prob)}</b> · ảnh hưởng <b>${esc(r.impact)}</b><br>
      Phụ trách <b>${esc(r.owner)}</b></div>
    <div class="dr-lab">Mô tả</div><div class="dr-txt">${esc(r.detail||'')}</div>
    ${r.plan?`<div class="dr-lab">Phương án xử lý</div><div class="dr-txt">${esc(r.plan)}</div>`:''}
    <div class="dr-lab">Trạng thái</div>
    <div class="st-opts">${['Mới ghi nhận','Đang theo dõi','Cảnh báo','Đang xử lý','Đã đóng'].map(s=>
      `<button class="st-opt ${s===r.status?'on':''}" data-rs="${esc(s)}"><span>${s}</span></button>`).join('')}</div>
    ${genActions('risks',id)}`);
  bindGen('risks',id,r,editRisk);
  document.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>
    save('risks',id,{status:b.dataset.rs},`Đã chuyển sang “${b.dataset.rs}”`));
}
function openMeet(id){
  const m=MEETS.find(x=>x.id===id); if(!m) return;
  openDrawer(`<div class="dr-code">${esc(m.kind)}</div><div class="dr-title">${esc(m.name)}</div>
    <div class="dr-meta">${fdate2(m.date)} · ${esc(m.time)} · ${m.mins} phút<br>
      Chủ trì <b>${esc(m.host)}</b> · thành phần ${esc(m.who)}</div>
    <div class="dr-lab">Nội dung</div><div class="dr-txt">${esc(m.agenda||'')}</div>
    ${genActions('meetings',id)}`);
  bindGen('meetings',id,m,editMeet);
}
function openDoc(id){
  const d=DOCS.find(x=>x.id===id); if(!d) return;
  const pr=PROJECTS.find(x=>x.id===d.project_id)||{};
  openDrawer(`<div class="dr-code">${esc(d.cat)} · ${esc(pr.code||'')}</div>
    <div class="dr-title">${esc(d.name)}</div>
    <div class="dr-meta">Người tạo <b>${esc(d.owner)}</b> · ${fdate2(d.at)}</div>
    <div class="dr-lab">Đường dẫn</div>
    <input type="text" id="docLink" class="fld" value="${esc(d.link||'')}" placeholder="Dán link Google Drive / Docs…">
    <button class="btn btn-pri btn-full" id="docSave">Lưu link</button>
    ${d.link?`<div style="margin-top:12px;font-size:12.5px"><a href="${esc(d.link)}" target="_blank" rel="noopener">Mở tài liệu →</a></div>`:''}
    ${genActions('docs',id)}`);
  document.getElementById('docSave').onclick=()=>save('docs',id,{link:V('docLink')},'Đã lưu link');
  bindGen('docs',id,d,editDoc);
}
function openBud(id){
  const b=BUDGET.find(x=>x.id===id); if(!b) return;
  const pr=PROJECTS.find(x=>x.id===b.project_id)||{};
  openDrawer(`<div class="dr-code">${esc(b.cat)} · ${esc(pr.code||'')}</div>
    <div class="dr-title">${esc(b.name)}</div>
    <div class="dr-meta">Phụ trách <b>${esc(b.owner||'—')}</b></div>
    <div class="mtr"><div><span>Kế hoạch</span><b>${mshort(b.plan)}</b></div>
      <div><span>Đã chi</span><b>${mshort(b.spent)}</b></div>
      <div><span>Còn lại</span><b>${mshort((b.plan||0)-(b.spent||0))}</b></div>
      <div><span>Tỉ lệ</span><b>${b.plan?Math.round((b.spent||0)/b.plan*100):0}%</b></div></div>
    ${(()=>{const ad=ADS.filter(a=>a.budget_id===b.id);
      return ad.length?`<div class="dr-lab">Chiến dịch dùng khoản này</div>
        <div class="tlist">${ad.map(a=>`<div class="titem" data-ad="${a.id}">
          <span class="pill ${ADS_ST[a.status]||'s-gray'}">${esc(a.status)}</span>
          <div class="tn"><b>${esc(a.name)}</b><small>${esc(a.platform)} · ${esc(a.owner)}</small></div>
          <span class="ct">${mshort(a.spent)}/${mshort(a.budget)}</span></div>`).join('')}</div>`:'';})()}
    <div class="dr-lab">Cập nhật số đã chi</div>
    <input type="number" id="budSpent" class="fld" value="${b.spent||0}">
    <button class="btn btn-pri btn-full" id="budSave">Lưu</button>
    ${genActions('budget',id)}`);
  document.getElementById('budSave').onclick=()=>save('budget',id,
    {spent:+V('budSpent')||0},'Đã cập nhật chi phí');
  bindGen('budget',id,b,editBud);
}

/* ─── Tạo mới ─── */
function openCreate(){
  openDrawer(`<div class="dr-title">Tạo mới</div>
    <div class="dr-meta">Chọn thứ bạn muốn thêm vào hệ thống</div>
    <div class="st-opts" style="margin-top:16px">
      ${[['cTask','i-check','Đầu việc','Giao việc cho thành viên','task.create'],
         ['cPost','i-pen','Bài đăng','Thêm nội dung mới vào guồng','post.create'],
         ['cProj','i-folder','Dự án','Chiến dịch hoặc chi nhánh mới','project.manage'],
         ['cRisk','i-alert','Rủi ro','Ghi nhận sớm để xử lý',null],
         ['cDoc','i-doc','Tài liệu','Brief, hướng dẫn, tư liệu',null],
         ['cMeet','i-meet','Cuộc họp','Đặt lịch họp cho phòng',null]]
        .filter(x=>!x[4]||can(x[4])).map(([id,ic,t,s])=>
        `<button class="st-opt" id="${id}"><span style="display:flex;align-items:center;gap:10px">
          ${icon(ic)}<span><b style="display:block">${t}</b><em>${s}</em></span></span></button>`).join('')}
    </div>`);
  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  on('cTask',openNewTask); on('cPost',openNewPost); on('cProj',openNewProj);
  on('cRisk',openNewRisk); on('cDoc',openNewDoc); on('cMeet',openNewMeet);
}

const projOpts = sel => PROJECTS.map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${esc(p.name)}</option>`).join('');
const memOpts = sel => MEMBERS.map(m=>`<option ${m.name===sel?'selected':''}>${esc(m.name)}</option>`).join('');

function openNewTask(){
  const t=new Date(D0()); t.setDate(t.getDate()+3);
  openDrawer(`<div class="dr-title">Giao việc mới</div>
    <div class="dr-lab" style="margin-top:14px">Tên việc</div>
    <input type="text" id="kName" class="fld" placeholder="Ví dụ: Dựng lại poster ưu đãi cuối tuần">
    <div class="dr-lab">Mô tả / yêu cầu</div><textarea id="kDetail" placeholder="Nói rõ cần làm gì…"></textarea>
    <div class="two"><div><div class="dr-lab">Giao cho</div>
      <select id="kOwn" class="fld">${memOpts()}</select></div>
      <div><div class="dr-lab">Dự án</div><select id="kProj" class="fld">${projOpts(PROJ||PROJECTS[0]?.id)}</select></div></div>
    <div class="two"><div><div class="dr-lab">Hạn</div><input type="date" id="kDue" class="fld" value="${iso(t)}"></div>
      <div><div class="dr-lab">Ưu tiên</div><select id="kPri" class="fld">
        <option>Cao</option><option selected>Trung bình</option><option>Thấp</option></select></div></div>
    <div class="two"><div><div class="dr-lab">Mảng</div><select id="kArea" class="fld">
        ${['Kế hoạch chung','Content','Thiết kế','Booking KOC/KOL','Chiến dịch','App bán hàng','Giao việc nội bộ']
          .map(a=>`<option>${a}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Đợt</div><select id="kSp" class="fld">
        ${SPRINTS.map(s=>`<option value="${s.id}" ${s.status==='Đang chạy'?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div></div>
    <button class="btn btn-pri btn-full" id="kSave">${icon('i-send')}Giao việc</button>`);
  document.getElementById('kSave').onclick=async()=>{
    if(!V('kName')){toast('Nhập tên việc đã nhé');return;}
    await add('tasks',{name:V('kName'),detail:V('kDetail')||null,owner:V('kOwn'),
      project_id:+V('kProj'),due:V('kDue')||null,priority:V('kPri'),area:V('kArea'),
      sprint_id:+V('kSp'),assigner:ME.name,reporter:ME.name,status:'Chưa bắt đầu',est:4},
      'Đã giao việc cho '+V('kOwn'));
  };
}
function openNewPost(preCh){
  const ch0=preCh||(CHANNELS[0]||{}).name;
  openDrawer(`<div class="dr-title">Thêm nội dung mới</div>
    <div class="dr-meta">Chọn kênh trước — biểu mẫu sẽ đổi theo đặc thù nền tảng đó</div>
    <div class="dr-lab">Kênh đăng</div>
    <div class="chpick" id="chPick">${CHANNELS.map((c,i)=>{
      const p=PLAT[c.platform]||{};
      return `<button class="chp ${c.name===ch0?'on':''}" data-pk="${esc(c.name)}">
        <span class="chp-d" style="background:${p.color||'#999'}"></span>
        <span><b>${esc(c.name)}</b><small>${esc(c.platform)}</small></span></button>`;}).join('')}</div>
    <div id="pForm"></div>`);
  const pick=n=>{document.querySelectorAll('.chp').forEach(b=>b.classList.toggle('on',b.dataset.pk===n));
    renderPostForm(n);};
  document.querySelectorAll('.chp').forEach(b=>b.onclick=()=>pick(b.dataset.pk));
  renderPostForm(ch0);
}

function renderPostForm(chName){
  const c=CHANNELS.find(x=>x.name===chName)||{};
  const P=PLAT[c.platform]||PLAT['Facebook'];
  const t=new Date(D0()); t.setDate(t.getDate()+3);
  const dsg=new Date(D0()); dsg.setDate(dsg.getDate()+1);
  const own=c.owner_content||((c.stream==='tiktok')?deskOwner('tiktok'):deskOwner('social'));
  const dsn=c.owner_design||deskOwner('design');
  const fld=f=>{
    if(f.t==='area') return `<textarea id="pf_${f.k}" placeholder="${esc(f.ph||'')}"></textarea>`;
    if(f.t==='sel')  return `<select id="pf_${f.k}" class="fld">${f.o.map(o=>`<option>${esc(o)}</option>`).join('')}</select>`;
    if(f.t==='num')  return `<input type="number" id="pf_${f.k}" class="fld" placeholder="${esc(f.ph||'')}">`;
    if(f.t==='date') return `<input type="date" id="pf_${f.k}" class="fld">`;
    return `<input type="text" id="pf_${f.k}" class="fld" placeholder="${esc(f.ph||'')}">`;
  };
  document.getElementById('pForm').innerHTML=`
    <div class="plat-tag" style="background:${P.color}15;color:${P.color};border-color:${P.color}35">
      ${icon(P.ic)} Biểu mẫu dành riêng cho ${esc(c.platform)}
      · mục tiêu kênh ${c.target_week||0} bài/tuần</div>
    <div class="dr-lab">Tiêu đề nội bộ</div>
    <input type="text" id="pf_title" class="fld" placeholder="Tên ngắn để cả team nhận ra bài này">
    <div class="two"><div><div class="dr-lab">Định dạng</div>
      <select id="pf_fmt" class="fld">${P.fmts.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Mục tiêu</div>
      <select id="pf_goal" class="fld">${P.goals.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div>
    ${P.fields.map(f=>`<div class="dr-lab">${esc(f.l)}${f.req?' <span style="color:var(--red)">*</span>':''}</div>${fld(f)}`).join('')}
    <div class="two"><div><div class="dr-lab">Người viết</div>
      <select id="pf_writer" class="fld">${MEMBERS.filter(m=>m.kind!=='design').map(m=>
        `<option ${m.name===own?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">${esc(P.editorLabel)}</div>
      <select id="pf_editor" class="fld"><option ${!P.needEditor?'selected':''}>Không cần</option>
        ${MEMBERS.filter(m=>m.kind==='design').map(m=>
          `<option ${P.needEditor&&m.name===dsn?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div></div>
    <div class="two"><div><div class="dr-lab">Ngày đăng</div>
      <input type="date" id="pf_date" class="fld" value="${iso(t)}"></div>
      <div><div class="dr-lab">Giờ đăng</div>
      <input type="time" id="pf_time" class="fld" value="19:30"></div></div>
    <div class="two"><div><div class="dr-lab">Hạn giao thiết kế</div>
      <input type="date" id="pf_ddue" class="fld" value="${iso(dsg)}"></div>
      <div><div class="dr-lab">Dự án</div>
      <select id="pf_proj" class="fld"><option value="">Không thuộc dự án</option>${projOpts(PROJ)}</select></div></div>
    <div class="dr-lab">Link brief / tư liệu</div>
    <input type="text" id="pf_link" class="fld" placeholder="drive.google.com/… hoặc docs.google.com/…">
    <button class="btn btn-pri btn-full" id="pfSave">${icon('i-plus')}Tạo nội dung</button>`;

  document.getElementById('pfSave').onclick=async()=>{
    const g=k=>{const e=document.getElementById('pf_'+k);return e?e.value.trim():'';};
    if(!g('title')){toast('Nhập tiêu đề nội bộ đã nhé');return;}
    const miss=P.fields.filter(f=>f.req&&!g(f.k));
    if(miss.length){toast('Còn thiếu: '+miss.map(f=>f.l).join(', '));return;}
    const extra={}; P.fields.forEach(f=>{const v=g(f.k); if(v) extra[f.k]=v;});
    const budget=+(extra.budget||0);
    await add('posts',{title:g('title'),channel:c.name,channel_id:c.id||null,
      platform:c.platform,stream:c.stream||'social',ctype:g('goal'),
      writer:g('writer'),editor:g('editor'),fmt:g('fmt'),goal:g('goal'),
      pub_date:g('date')||null,pub_time:g('time')||null,design_due:g('ddue')||null,
      project_id:+g('proj')||null,brief_link:g('link')||null,
      hook:extra.hook||null,script:extra.script||null,caption:extra.caption||null,
      hashtag:extra.hashtag||null,cta:extra.cta||null,sound:extra.sound||null,
      duration:extra.duration||null,props:extra.props||null,seo_title:extra.seo_title||null,
      seo_desc:extra.seo_desc||null,keyword:extra.keyword||null,slug:extra.slug||null,
      thumb:extra.thumb||null,audience:extra.audience||null,geotag:extra.geotag||null,
      offer_end:extra.offer_end||null,img_count:+(extra.img_count||0)||null,
      send_count:+(extra.send_count||0)||null,ad_budget:budget||null,
      brief:P.fields.filter(f=>extra[f.k]&&['area','text'].includes(f.t))
        .map(f=>f.l+': '+extra[f.k]).join('\n')||null,
      status:'Đang viết',views:0,eng:0,shares:0,saves:0},
      'Đã tạo nội dung cho '+c.name);
  };
}

function openNewRisk(){
  openDrawer(`<div class="dr-title">Ghi nhận rủi ro</div>
    <div class="dr-lab" style="margin-top:14px">Tên rủi ro</div>
    <input type="text" id="rName" class="fld" placeholder="Ví dụ: Nhà in trễ hạn giao POSM">
    <div class="dr-lab">Mô tả</div><textarea id="rDetail"></textarea>
    <div class="two"><div><div class="dr-lab">Khả năng xảy ra</div><select id="rP" class="fld">
      <option>Cao</option><option selected>Trung bình</option><option>Thấp</option></select></div>
      <div><div class="dr-lab">Mức ảnh hưởng</div><select id="rI" class="fld">
      <option>Cao</option><option selected>Trung bình</option><option>Thấp</option></select></div></div>
    <div class="two"><div><div class="dr-lab">Dự án</div><select id="rProj" class="fld">${projOpts(PROJ||PROJECTS[0]?.id)}</select></div>
      <div><div class="dr-lab">Phụ trách</div><select id="rOwn" class="fld">${memOpts(ME.name)}</select></div></div>
    <div class="dr-lab">Phương án xử lý</div><textarea id="rPlan"></textarea>
    <button class="btn btn-pri btn-full" id="rSave">${icon('i-plus')}Ghi nhận</button>`);
  document.getElementById('rSave').onclick=async()=>{
    if(!V('rName')){toast('Nhập tên rủi ro đã nhé');return;}
    await add('risks',{name:V('rName'),detail:V('rDetail')||null,prob:V('rP'),impact:V('rI'),
      project_id:+V('rProj'),owner:V('rOwn'),plan:V('rPlan')||null,status:'Mới ghi nhận'},
      'Đã ghi nhận rủi ro');
  };
}
function openNewDoc(){
  openDrawer(`<div class="dr-title">Thêm tài liệu</div>
    <div class="dr-lab" style="margin-top:14px">Tên tài liệu</div>
    <input type="text" id="oName" class="fld" placeholder="Ví dụ: Brief chiến dịch Tết">
    <div class="two"><div><div class="dr-lab">Nhóm</div><select id="oCat" class="fld">
      ${['Kế hoạch','Brief','Thiết kế','Hướng dẫn','Quy trình','Tư liệu','Nghiên cứu','Báo cáo']
        .map(x=>`<option>${x}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Dự án</div><select id="oProj" class="fld">${projOpts(PROJ||PROJECTS[0]?.id)}</select></div></div>
    <div class="dr-lab">Đường dẫn</div><input type="text" id="oLink" class="fld" placeholder="drive.google.com/…">
    <button class="btn btn-pri btn-full" id="oSave">${icon('i-plus')}Thêm</button>`);
  document.getElementById('oSave').onclick=async()=>{
    if(!V('oName')){toast('Nhập tên tài liệu đã nhé');return;}
    await add('docs',{name:V('oName'),cat:V('oCat'),project_id:+V('oProj'),
      link:V('oLink')||null,owner:ME.name,at:iso(new Date())},'Đã thêm tài liệu');
  };
}
function openNewMeet(){
  const t=new Date(D0()); t.setDate(t.getDate()+1);
  openDrawer(`<div class="dr-title">Đặt lịch họp</div>
    <div class="dr-lab" style="margin-top:14px">Tên cuộc họp</div>
    <input type="text" id="mName" class="fld" placeholder="Ví dụ: Duyệt nội dung tuần">
    <div class="two"><div><div class="dr-lab">Ngày</div><input type="date" id="mD" class="fld" value="${iso(t)}"></div>
      <div><div class="dr-lab">Giờ</div><input type="time" id="mT" class="fld" value="09:00"></div></div>
    <div class="two"><div><div class="dr-lab">Thời lượng (phút)</div><input type="number" id="mM" class="fld" value="60"></div>
      <div><div class="dr-lab">Loại</div><select id="mK" class="fld">
        ${['Định kỳ','Duyệt','Dự án','Ý tưởng','Báo cáo'].map(x=>`<option>${x}</option>`).join('')}</select></div></div>
    <div class="dr-lab">Thành phần</div><input type="text" id="mW" class="fld" value="Cả phòng">
    <div class="dr-lab">Nội dung</div><textarea id="mA"></textarea>
    <button class="btn btn-pri btn-full" id="mSave">${icon('i-plus')}Đặt lịch</button>`);
  document.getElementById('mSave').onclick=async()=>{
    if(!V('mName')){toast('Nhập tên cuộc họp đã nhé');return;}
    await add('meetings',{name:V('mName'),date:V('mD'),time:V('mT'),mins:+V('mM')||60,
      kind:V('mK'),host:ME.name,who:V('mW'),agenda:V('mA')||null},'Đã đặt lịch họp');
  };
}


function editRisk(r){
  openDrawer(`<div class="dr-code">Sửa rủi ro</div><div class="dr-title">${esc(r.name)}</div>
    ${F_.txt('rName','Tên rủi ro',r.name)}${F_.area('rDetail','Mô tả',r.detail)}
    <div class="two"><div>${F_.sel('rP','Khả năng',r.prob,['Cao','Trung bình','Thấp'])}</div>
      <div>${F_.sel('rI','Ảnh hưởng',r.impact,['Cao','Trung bình','Thấp'])}</div></div>
    <div class="two"><div><div class="dr-lab">Dự án</div>
      <select id="rProj" class="fld">${projOpts(r.project_id)}</select></div>
      <div>${F_.sel('rOwn','Phụ trách',r.owner,MEMBERS.map(m=>m.name))}</div></div>
    ${F_.area('rPlan','Phương án xử lý',r.plan)}
    <button class="btn btn-pri btn-full" id="rSv">Lưu thay đổi</button>`);
  document.getElementById('rSv').onclick=()=>save('risks',r.id,{name:V('rName'),detail:V('rDetail')||null,
    prob:V('rP'),impact:V('rI'),project_id:+V('rProj'),owner:V('rOwn'),plan:V('rPlan')||null},'Đã lưu');
}
function editDoc(d){
  openDrawer(`<div class="dr-code">Sửa tài liệu</div><div class="dr-title">${esc(d.name)}</div>
    ${F_.txt('oName','Tên tài liệu',d.name)}
    <div class="two"><div>${F_.sel('oCat','Nhóm',d.cat,
      ['Kế hoạch','Brief','Thiết kế','Hướng dẫn','Quy trình','Tư liệu','Nghiên cứu','Báo cáo'])}</div>
      <div><div class="dr-lab">Dự án</div><select id="oProj" class="fld">${projOpts(d.project_id)}</select></div></div>
    ${F_.txt('oLink','Đường dẫn',d.link,'drive.google.com/…')}
    <button class="btn btn-pri btn-full" id="oSv">Lưu thay đổi</button>`);
  document.getElementById('oSv').onclick=()=>save('docs',d.id,{name:V('oName'),cat:V('oCat'),
    project_id:+V('oProj'),link:V('oLink')||null},'Đã lưu');
}
function editMeet(m){
  openDrawer(`<div class="dr-code">Sửa cuộc họp</div><div class="dr-title">${esc(m.name)}</div>
    ${F_.txt('mName','Tên cuộc họp',m.name)}
    <div class="two"><div>${F_.date('mD','Ngày',m.date)}</div>
      <div><div class="dr-lab">Giờ</div><input type="time" id="mT" class="fld" value="${esc(m.time||'')}"></div></div>
    <div class="two"><div>${F_.num('mM','Thời lượng (phút)',m.mins)}</div>
      <div>${F_.sel('mK','Loại',m.kind,['Định kỳ','Duyệt','Dự án','Ý tưởng','Báo cáo'])}</div></div>
    <div class="two"><div>${F_.sel('mH','Chủ trì',m.host,MEMBERS.map(x=>x.name))}</div>
      <div>${F_.txt('mW','Thành phần',m.who)}</div></div>
    ${F_.area('mA','Nội dung',m.agenda)}
    <button class="btn btn-pri btn-full" id="mSv">Lưu thay đổi</button>`);
  document.getElementById('mSv').onclick=()=>save('meetings',m.id,{name:V('mName'),date:V('mD'),
    time:V('mT'),mins:+V('mM')||60,kind:V('mK'),host:V('mH'),who:V('mW'),agenda:V('mA')||null},'Đã lưu');
}
function editBud(b){
  openDrawer(`<div class="dr-code">Sửa khoản ngân sách</div><div class="dr-title">${esc(b.name)}</div>
    ${F_.txt('bName','Tên khoản',b.name)}
    <div class="two"><div>${F_.txt('bCat','Nhóm',b.cat,'Quảng cáo / In ấn / Sự kiện…')}</div>
      <div><div class="dr-lab">Dự án</div><select id="bProj" class="fld">${projOpts(b.project_id)}</select></div></div>
    <div class="two"><div>${F_.num('bPlan','Kế hoạch (đ)',b.plan)}</div>
      <div>${F_.num('bSpent','Đã chi (đ)',b.spent)}</div></div>
    ${F_.sel('bOwn','Phụ trách',b.owner,MEMBERS.map(m=>m.name))}
    <button class="btn btn-pri btn-full" id="bSv">Lưu thay đổi</button>`);
  document.getElementById('bSv').onclick=()=>save('budget',b.id,{name:V('bName'),cat:V('bCat'),
    project_id:+V('bProj'),plan:+V('bPlan')||0,spent:+V('bSpent')||0,owner:V('bOwn')},'Đã lưu');
}
function openNewBud(){
  openDrawer(`<div class="dr-title">Thêm khoản ngân sách</div>
    ${F_.txt('bName','Tên khoản','','Ví dụ: Quảng cáo Meta tháng 9')}
    <div class="two"><div>${F_.txt('bCat','Nhóm','','Quảng cáo')}</div>
      <div><div class="dr-lab">Dự án</div><select id="bProj" class="fld">${projOpts(PROJ||PROJECTS[0]?.id)}</select></div></div>
    <div class="two"><div>${F_.num('bPlan','Kế hoạch (đ)',0)}</div>
      <div>${F_.num('bSpent','Đã chi (đ)',0)}</div></div>
    ${F_.sel('bOwn','Phụ trách',ME.name,MEMBERS.map(m=>m.name))}
    <button class="btn btn-pri btn-full" id="bAdd">${icon('i-plus')}Thêm khoản</button>`);
  document.getElementById('bAdd').onclick=async()=>{
    if(!V('bName')){toast('Nhập tên khoản đã nhé');return;}
    await add('budget',{name:V('bName'),cat:V('bCat')||'Khác',project_id:+V('bProj'),
      plan:+V('bPlan')||0,spent:+V('bSpent')||0,owner:V('bOwn')},'Đã thêm khoản ngân sách');};
}

/* ─── Cấu hình nhân sự ─── */
const ROLE_PRESET=[
  {r:'Leader Team',        k:'leader', d:'leader', dept:'Quản lý'},
  {r:'Content Marketing (chung)', k:'writer', d:'social', dept:'Nội dung'},
  {r:'Content Marketing TikTok',  k:'writer', d:'tiktok', dept:'Nội dung'},
  {r:'Designer',           k:'design', d:'design', dept:'Thiết kế'},
  {r:'Editor',             k:'design', d:'edit',   dept:'Thiết kế'},
  {r:'Chạy quảng cáo',     k:'writer', d:'',       dept:'Digital'},
  {r:'Cộng tác viên',      k:'writer', d:'',       dept:'Nội dung'},
];
function editMember(m){
  const isNew=!m; const d=m||{kind:'writer',desk:'',cap:100};
  openDrawer(`<div class="dr-code">${isNew?'Thêm nhân sự':'Sửa nhân sự'}</div>
    <div class="dr-title">${isNew?'Nhân sự mới':esc(m.name)}</div>
    ${F_.txt('mbName','Họ tên',d.name,'Nguyễn Văn A')}
    <div class="two"><div>${F_.txt('mbShort','Tên gọi ngắn',d.short_name||d.short,'A')}</div>
      <div>${F_.txt('mbEmail','Email',d.email)}</div></div>
    <div class="dr-lab">Vị trí</div>
    <div class="chpick">${ROLE_PRESET.map(p=>`<button class="chp ${p.r===d.role?'on':''}" data-role="${esc(p.r)}"
      data-kind="${p.k}" data-desk="${p.d}" data-dept="${esc(p.dept)}">
      <span class="chp-d" style="background:${p.k==='leader'?'#6D4AFF':p.k==='design'?'#B83280':'#1F63C7'}"></span>
      <span><b>${esc(p.r)}</b><small>${esc(p.dept)}</small></span></button>`).join('')}</div>
    <input type="hidden" id="mbRole" value="${esc(d.role||'')}">
    <input type="hidden" id="mbKind" value="${esc(d.kind||'writer')}">
    <input type="hidden" id="mbDesk" value="${esc(d.desk||'')}">
    <input type="hidden" id="mbDept" value="${esc(d.dept||'')}">
    <div class="two"><div>${F_.sel('mbMgr','Báo cáo cho',d.manager||'— Không —',
      ['— Không —',...MEMBERS.filter(x=>!m||x.name!==m.name).map(x=>x.name)])}</div>
      <div>${F_.txt('mbPin','Mã PIN',d.pin||'0000','4 chữ số')}</div></div>
    <div class="dr-lab">Quyền hạn</div>
    <div class="perm">${[['leader','Duyệt nội dung và ấn phẩm của cả phòng'],
      ['writer','Viết nội dung, giao việc cho thiết kế'],
      ['design','Nhận việc thiết kế, gửi Leader duyệt']].map(([k,t])=>
      `<div class="perm-i ${d.kind===k?'on':''}" data-kind-pick="${k}">
        ${icon(d.kind===k?'i-check':'i-user')}<span>${t}</span></div>`).join('')}</div>
    <button class="btn btn-pri btn-full" id="mbSave">${isNew?'Thêm nhân sự':'Lưu thay đổi'}</button>
    ${!isNew?`<div class="act-row two-col" style="margin-top:10px">
      <button class="btn btn-gh" id="mbView">${icon('i-eye')}Xem việc</button>
      <button class="btn btn-gh danger" id="mbDel">${icon('i-trash')}Xoá nhân sự</button></div>`:''}`);
  document.querySelectorAll('[data-role]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-role]').forEach(x=>x.classList.toggle('on',x===b));
    document.getElementById('mbRole').value=b.dataset.role;
    document.getElementById('mbKind').value=b.dataset.kind;
    document.getElementById('mbDesk').value=b.dataset.desk;
    document.getElementById('mbDept').value=b.dataset.dept;
    document.querySelectorAll('[data-kind-pick]').forEach(x=>
      x.classList.toggle('on',x.dataset.kindPick===b.dataset.kind));});
  document.querySelectorAll('[data-kind-pick]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-kind-pick]').forEach(x=>x.classList.toggle('on',x===b));
    document.getElementById('mbKind').value=b.dataset.kindPick;});
  document.getElementById('mbSave').onclick=async()=>{
    if(!V('mbName')){toast('Nhập họ tên đã nhé');return;}
    if(!V('mbRole')){toast('Chọn vị trí đã nhé');return;}
    const mgr=V('mbMgr'); const g=id=>document.getElementById(id).value;
    const row={name:V('mbName'),short_name:V('mbShort')||V('mbName').split(' ').slice(-1)[0],
      role:g('mbRole'),kind:g('mbKind'),desk:g('mbDesk')||null,dept:g('mbDept')||null,
      manager:mgr==='— Không —'?null:mgr,email:V('mbEmail')||null,pin:V('mbPin')||'0000'};
    if(isNew) await add('members',{...row,sort_order:MEMBERS.length+1,cap:100},'Đã thêm '+row.name);
    else await save('members',m.id,row,'Đã lưu thay đổi');
  };
  if(!isNew){
    const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
    on('mbView',()=>openWho(m.name));
    on('mbDel',async()=>{
      if(m.name===ME.name){toast('Không thể xoá chính mình');return;}
      const n=TASKS.filter(t=>(t.owner||'').includes(m.name)).length
        +POSTS.filter(p=>p.writer===m.name||p.editor===m.name).length;
      if(!confirm('Xoá "'+m.name+'" khỏi phòng?'+(n?'\n'+n+' việc và bài đang gán cho người này sẽ không còn người phụ trách.':'')))return;
      await sb.from('members').delete().eq('id',m.id);
      toast('Đã xoá nhân sự'); closeDrawer(); await loadAll();});
  }
}

/* ─── Nhắc việc ─── */
function openAlerts(){
  const lp=POSTS.filter(latePost), ld=POSTS.filter(lateDesign);
  const lt=TASKS.filter(lateTask);
  const wait=POSTS.filter(p=>F(p.status).hold==='leader');
  const soon=POSTS.filter(p=>{const d=dd(p.pub_date);return d!==null&&d>=0&&d<=2&&!DONE.includes(p.status);});
  const sec=(t,l,r)=>l.length?`<div class="dr-lab">${t} (${l.length})</div>
    <div class="tlist" style="margin:0 -25px">${l.slice(0,8).map(r).join('')}</div>`:'';
  const total=lp.length+ld.length+lt.length+wait.length;
  openDrawer(`<div class="dr-title">${icon('i-bell')} Nhắc việc</div>
    <div class="dr-meta">${total?`Có ${total} mục cần chú ý`:'Mọi thứ đang đúng tiến độ'}</div>
    ${sec('Bài quá hạn đăng',lp,p=>postRow(p,true))}
    ${sec('Trễ hạn thiết kế',ld,p=>postRow(p,true))}
    ${sec('Chờ Leader duyệt',wait,p=>postRow(p,true))}
    ${sec('Sắp đến hạn đăng',soon,p=>postRow(p,true))}
    ${sec('Đầu việc quá hạn',lt,taskRow)}`);
  bindAll();
}

boot();
