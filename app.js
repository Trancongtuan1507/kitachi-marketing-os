/* ═══════════════════════════════════════════════════════════════
   MARKETING OS · KITACHI
   Bảng vận hành phòng marketing — 5 vị trí, nhiều dự án, nhiều kênh
   ═══════════════════════════════════════════════════════════════ */

const CONFIGURED = CONFIG.SUPABASE_URL && !CONFIG.SUPABASE_URL.includes('xxxx')
  && CONFIG.SUPABASE_ANON_KEY && !CONFIG.SUPABASE_ANON_KEY.includes('dán');
let DEMO_MODE = !CONFIGURED, DEMO_WHY='';


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

const LIB_OK = (typeof supabase!=='undefined' && supabase && supabase.createClient);
if (CONFIGURED && !LIB_OK) DEMO_MODE = true;
let sb = (CONFIGURED && LIB_OK)
  ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : demoClient();

/* ─── Quy trình sản xuất nội dung: mỗi chặng gắn với một vai ─── */
const FLOW = [
  {s:'Đang viết',           ic:'✏️', hold:'writer', cls:'s-gray',
   hint:'Content lên nội dung'},
  {s:'Chờ duyệt nội dung',  ic:'📌', hold:'leader', cls:'s-amber',
   hint:'Leader xem nội dung trước khi cho làm thiết kế'},
  {s:'Cần sửa nội dung',    ic:'✂️', hold:'writer', cls:'s-red',
   hint:'Leader trả lại, Content sửa nội dung'},
  {s:'Đang thiết kế',       ic:'🎨', hold:'design', cls:'s-pink',
   hint:'Vỹ và Thảo tự chia nhau làm ấn phẩm'},
  {s:'Chờ duyệt ấn phẩm',   ic:'👀', hold:'leader', cls:'s-blue',
   hint:'Leader duyệt thiết kế hoặc video'},
  {s:'Cần sửa ấn phẩm',     ic:'🔧', hold:'design', cls:'s-red',
   hint:'Leader trả lại, bên thiết kế sửa'},
  {s:'Chờ đăng',            ic:'🗓', hold:'writer', cls:'s-teal',
   hint:'Đã duyệt xong — Content đăng lên nền tảng'},
  {s:'Đã đăng',             ic:'✅', hold:null,     cls:'s-green', hint:'Xong'},
  {s:'Huỷ bỏ',              ic:'❌', hold:null,     cls:'s-gray',  hint:'Không làm nữa'},
];
const FLOW_ALIAS={'Lên ý tưởng':'Đang viết','Đang soạn thảo':'Đang viết',
  'Chờ phê duyệt':'Chờ duyệt nội dung','Đã phê duyệt':'Đang thiết kế',
  'Chờ duyệt thiết kế':'Chờ duyệt ấn phẩm','Chờ Leader duyệt':'Chờ duyệt ấn phẩm',
  'Cần chỉnh sửa':'Cần sửa ấn phẩm','Đã lên lịch':'Chờ đăng'};
const norm = st => FLOW_ALIAS[st] || st;
const LEADER = () => (MEMBERS.find(m=>m.kind==='leader')||{}).name || 'Leader';
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
function avat(n){
  const m=MEMBERS.find(x=>x.name===n);
  if(m&&m.avatar) return `<span class="av img" style="background-image:url('${esc(m.avatar)}')"
    title="${esc(n)}"><i>${esc(ini(n))}</i></span>`;
  return `<span class="av">${esc(ini(n))}</span>`;
}
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
function showDemoBanner(why){
  if(document.getElementById('demoBar')) return;
  const b=document.createElement('div'); b.id='demoBar'; b.className='demo-bar';
  b.innerHTML = why || 'Chế độ xem thử — dữ liệu mẫu, thay đổi không được lưu. Điền khoá Supabase vào <b>config.js</b> để cả phòng dùng chung.';
  document.body.appendChild(b);
}
function whyDemo(){
  if(DEMO_WHY) return DEMO_WHY;
  if(!CONFIGURED) return 'Chế độ xem thử — chưa điền khoá vào <b>config.js</b>.';
  if(!LIB_OK) return 'Chế độ xem thử — <b>không tải được thư viện Supabase</b>. '
    +'Mạng đang chặn CDN. Thử mạng khác hoặc mở bằng 4G điện thoại.';
  return 'Chế độ xem thử — <b>không kết nối được cơ sở dữ liệu</b>. Kiểm tra khoá trong config.js.';
}


/* ─── Chế độ sáng / tối ─── */
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('mktos_theme',t);
  document.querySelectorAll('#themeTog button').forEach(b=>
    b.classList.toggle('on',b.dataset.theme===t));
}
(function initTheme(){
  const t=localStorage.getItem('mktos_theme')
    ||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  setTheme(t);
  document.querySelectorAll('#themeTog button').forEach(b=>
    b.onclick=()=>setTheme(b.dataset.theme));
  /* phím tắt: Ctrl/Cmd + J */
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='j'){ e.preventDefault();
      setTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark'); }
  });
})();

/* ─── Đăng nhập ─── */
async function boot(){
  let why='';
  let {data,error}=await sb.from('members').select('*').order('sort_order');
  if(error){
    console.error('LỖI KẾT NỐI SUPABASE:', error);
    why = /JWT|apikey|Invalid/i.test(error.message||'')
      ? 'Chế độ xem thử — <b>khoá Supabase không hợp lệ</b>. Kiểm tra lại config.js.'
      : 'Chế độ xem thử — lỗi kết nối: '+esc(error.message||'không rõ');
  } else if(!data||!data.length){
    console.error('Kết nối được nhưng bảng members trả về RỖNG. '
      +'Nguyên nhân thường gặp: Row Level Security đang bật. '
      +'Chạy file supabase/fix-quyen.sql trong Supabase SQL Editor.');
    why = 'Chế độ xem thử — <b>đọc được máy chủ nhưng không thấy dữ liệu</b>. '
      +'Chạy file <b>supabase/fix-quyen.sql</b> trong Supabase → SQL Editor.';
  }
  if(error||!data||!data.length){ DEMO_MODE=true; sb=demoClient(); DEMO_WHY=why;
    ({data}=await sb.from('members').select('*').order('sort_order')); }
  MEMBERS=data;
  if(DEMO_MODE) showDemoBanner(whyDemo());
  document.getElementById('memberList').innerHTML=MEMBERS.map(m=>`
    <button class="member-btn" data-n="${esc(m.name)}">${
      m.avatar?`<span class="av img" style="background-image:url('${esc(m.avatar)}')"><i>${esc(ini(m.name))}</i></span>`
        :`<span class="av">${esc(ini(m.name))}</span>`}
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
  const sav=document.getElementById('sideAv');
  if(ME.avatar){ sav.style.backgroundImage=`url('${ME.avatar}')`;
    sav.classList.add('img'); sav.textContent=''; }
  else { sav.style.backgroundImage=''; sav.classList.remove('img');
    sav.textContent=ini(ME.name); }
  await loadAll();
  setTimeout(showNhac, 450);
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

  /* Chỉ báo kết nối trên thanh trên */
  const chip=document.getElementById('connChip'), ctx=document.getElementById('connTxt');
  if(chip){
    chip.className='connchip '+(DEMO_MODE?'off':'on');
    ctx.textContent=DEMO_MODE?'Chưa dùng chung':'Dùng chung';
    chip.onclick=()=>connInfo();
  }
  applyMenuPerm();
  const badge=(id,n)=>{const e=document.getElementById(id); if(e) e.textContent=n||'';};
  const myNewTasks=TASKS.filter(t=>(t.owner||'').includes(ME.name)&&tgrp(t)==='Chưa bắt đầu').length;
  badge('nTasks', myTasks().length);
  badge('bwork', POSTS.filter(x=>!DONE.includes(x.status)&&holds(x,ME.name)).length
    + (((MEMBERS.find(m=>m.name===ME.name)||{}).kind!=='design') ? myNewTasks : 0));
  badge('nPosts', POSTS.filter(x=>!DONE.includes(x.status)&&holds(x,ME.name)).length);
  badge('nRisks', RISKS.filter(r=>r.status!=='Đã đóng'&&r.impact==='Cao').length);
  badge('nProjects', PROJECTS.filter(x=>x.status==='Đang chạy').length);
  badge('nArch', ALL_TASKS.filter(x=>x.archived).length+ALL_POSTS.filter(x=>x.archived).length);
  badge('bwork', POSTS.filter(x=>!DONE.includes(x.status)&&holds(x,ME.name)).length);
  badge('nAds', ADS.filter(a=>a.status==='Đang chạy').length);
  badge('nRep', REPORTS.filter(r=>r.reviewer===ME.name&&r.status==='Chờ duyệt').length);
  badge('nApr', APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt').length);
  if(isAdmin()) badge('nAdmin', healthCheck().filter(x=>x.lv==='red').length);
  if(ME.kind==='leader'||can('post.approve'))
    badge('nLeader', POSTS.filter(x=>['Chờ duyệt nội dung','Chờ duyệt ấn phẩm'].includes(norm(x.status))).length
      + APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt').length);
  badge('nAssign', POSTS.filter(x=>['Chờ duyệt nội dung','Chờ duyệt ấn phẩm'].includes(norm(x.status))).length
    + APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt').length);
  Object.keys(DESKS).forEach(k=>badge('b'+k,
    deskPosts(k).filter(x=>!DONE.includes(x.status)&&holds(x,deskOwner(k))).length));
  const alerts = POSTS.filter(latePost).length + TASKS.filter(lateTask).length;
  document.getElementById('bellDot').textContent = alerts ? ' ' : '';
  render();
}

/* ─── Điều hướng ─── */
function go(v){
  if(!seeMenu(v)){ toast('Bạn không có quyền xem mục này'); return; }
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
document.getElementById('bellBtn').onclick=()=>{
  const k='mktos_nhac_'+ME.name+'_'+iso(D0());
  localStorage.removeItem(k);
  if(nhacViec()) showNhac(); else openAlerts();
};
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
    work:viewWork,ads:viewAds,assign:viewAssign,admin:viewAdmin,leader:viewLeader}[VIEW];
  m.innerHTML = V?V():'';
  if(VIEW==='activity') loadLog();
  if(VIEW==='roles') bindRoles();
  bindAll();
}


/* ─── Thanh chọn ngày ─── */
/* ═════════ TỔNG HỢP — bố cục portal ═════════ */
const CHCOL = ['#6D4AFF','#12855A','#1F63C7','#D9772B','#0E7490','#B83280','#7A3EC7','#C0392B','#2E7D32','#5B6ABF'];

/* ═══════════ BỘ VẼ BIỂU ĐỒ ═══════════ */

/* Đường có nền mờ — dùng cho xu hướng theo ngày */
function areaChart(data,opt){
  const o=Object.assign({w:700,h:190,pad:34,col:'#6D4AFF',fill:true,labels:[]},opt||{});
  const mx=Math.max(1,...data);
  const step=(o.w-o.pad-12)/Math.max(1,data.length-1);
  const y=v=>o.h-28-(v/mx)*(o.h-46);
  const pts=data.map((v,i)=>[o.pad+i*step, y(v)]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L${pts[pts.length-1][0].toFixed(1)} ${o.h-28} L${o.pad} ${o.h-28} Z`;
  const gid='g'+Math.random().toString(36).slice(2,7);
  return `<svg viewBox="0 0 ${o.w} ${o.h}" class="chart" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${o.col}" stop-opacity=".22"/>
      <stop offset="100%" stop-color="${o.col}" stop-opacity="0"/></linearGradient></defs>
    ${[0,.25,.5,.75,1].map(f=>`<line x1="${o.pad}" x2="${o.w-8}" y1="${18+f*(o.h-46)}"
      y2="${18+f*(o.h-46)}" stroke="#EDEDF3" stroke-width="1"/>`).join('')}
    ${[0,.5,1].map(f=>`<text x="3" y="${22+f*(o.h-46)}" font-size="9.5" fill="#9797AC">${
      Math.round(mx*(1-f))}</text>`).join('')}
    ${o.fill?`<path d="${area}" fill="url(#${gid})"/>`:''}
    <path d="${line}" fill="none" stroke="${o.col}" stroke-width="2.4"
      stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${
      i===pts.length-1?4:2.8}" fill="${o.col}"${i===pts.length-1?' stroke="#fff" stroke-width="2"':''}/>`).join('')}
    ${o.labels.length?o.labels.map((l,i)=>`<text x="${(o.pad+i*step).toFixed(0)}" y="${o.h-8}"
      font-size="9.5" fill="#9797AC" text-anchor="middle">${esc(l)}</text>`).join(''):''}
  </svg>`;
}

/* Cột chồng — so sánh nhiều nhóm theo ngày */
function stackChart(rows,keys,cols,labels){
  const W=700,H=190,PL=34,PB=26;
  const tot=rows.map(r=>keys.reduce((s,k)=>s+(r[k]||0),0));
  const mx=Math.max(1,...tot);
  const bw=(W-PL-12)/rows.length;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" preserveAspectRatio="none">
    ${[0,.5,1].map(f=>`<line x1="${PL}" x2="${W-8}" y1="${14+f*(H-PB-14)}" y2="${14+f*(H-PB-14)}"
      stroke="#EDEDF3"/>`).join('')}
    ${[0,.5,1].map(f=>`<text x="3" y="${18+f*(H-PB-14)}" font-size="9.5" fill="#9797AC">${
      Math.round(mx*(1-f))}</text>`).join('')}
    ${rows.map((r,i)=>{let acc=0;
      return keys.map((k,j)=>{const v=r[k]||0; if(!v) return '';
        const h=(v/mx)*(H-PB-18); const yy=H-PB-acc-h; acc+=h;
        return `<rect x="${(PL+i*bw+bw*0.2).toFixed(1)}" y="${yy.toFixed(1)}"
          width="${(bw*0.6).toFixed(1)}" height="${Math.max(1,h).toFixed(1)}"
          fill="${cols[j]}" ${j===keys.length-1?'rx="3"':''}/>`;}).join('');}).join('')}
    ${labels.map((l,i)=>`<text x="${(PL+i*bw+bw*0.5).toFixed(0)}" y="${H-8}" font-size="9.5"
      fill="#9797AC" text-anchor="middle">${esc(l)}</text>`).join('')}
  </svg>`;
}

/* Đường mini trong ô KPI */
function spark(data,col){
  const W=90,H=28;
  const mx=Math.max(1,...data), mn=Math.min(...data);
  const rg=mx-mn||1;
  const step=W/Math.max(1,data.length-1);
  const d=data.map((v,i)=>(i?'L':'M')+(i*step).toFixed(1)+' '+(H-3-((v-mn)/rg)*(H-8)).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="spark2" preserveAspectRatio="none">
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

/* Vòng tròn tỉ lệ */
function gauge(pct,label,col){
  const R=40,C=2*Math.PI*R;
  return `<div class="gauge"><svg width="104" height="104" viewBox="0 0 104 104">
    <circle cx="52" cy="52" r="${R}" fill="none" stroke="#EFEFF5" stroke-width="11"/>
    <circle cx="52" cy="52" r="${R}" fill="none" stroke="${col||'#6D4AFF'}" stroke-width="11"
      stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct/100)}"
      transform="rotate(-90 52 52)"/></svg>
    <div class="gauge-c"><b>${pct}%</b><span>${esc(label)}</span></div></div>`;
}

/* Lưới nhiệt — mức hoạt động theo ngày */
function heat(cells){
  const mx=Math.max(1,...cells.map(c=>c.v));
  return `<div class="heat">${cells.map(c=>{
    const lv=c.v===0?0:Math.min(4,Math.ceil(c.v/mx*4));
    return `<span class="hc l${lv}" title="${esc(c.t)}: ${c.v}"></span>`;}).join('')}</div>`;
}

const delta=(now,prev,inv)=>{
  if(prev===null||prev===undefined) return '';
  const d=now-prev;
  if(!d) return `<span class="dl flat">không đổi</span>`;
  if(!prev) return `<span class="dl ${(inv?d<0:d>0)?'up':'down'}">${d>0?'▲':'▼'} ${Math.abs(d)}</span>`;
  const p=Math.round(d/prev*100);
  return `<span class="dl ${(inv?d<0:d>0)?'up':'down'}">${d>0?'▲':'▼'} ${Math.abs(p)}%</span>`;
};


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
     l:open.filter(p=>norm(p.status)==='Đang thiết kế'&&p.editor===who&&!p.design_started
        &&p.writer!==who)},
    {t:'Đang làm',ic:'i-brush',c:'pink',
     l:open.filter(p=>norm(p.status)==='Đang thiết kế'&&p.editor===who
        &&(p.design_started||p.writer===who))},
    {t:'Đã gửi Leader duyệt',ic:'i-clock',c:'amber',
     l:open.filter(p=>norm(p.status)==='Chờ duyệt ấn phẩm'&&p.editor===who)},
  ];

  /* nút hành động ngay trên dòng, không phải mở drawer mới làm được */
  const qrow=p=>{
    const isD=d.kind==='design', st=norm(p.status);
    let act=null;
    if(isD&&st==='Đang thiết kế'&&!p.design_started) act=['Nhận việc','qk-take'];
    else if(isD&&st==='Đang thiết kế'&&p.design_started) act=['Gửi Leader duyệt','qk-send'];
    else if(isD&&st==='Cần sửa ấn phẩm') act=['Đã sửa xong','qk-send'];
    else if(!isD&&['Đang viết','Cần sửa nội dung'].includes(st)) act=['Gửi duyệt','qk-tosub'];
    return browRow(p,{design:isD,needBrief:isD,act:act});};

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

  /* ── Tab Của tôi: bài và việc do chính người này tạo ── */
  const myPosts=POSTS.filter(p=>p.writer===who);
  const myTasksSelf=TASKS.filter(t=>(t.owner||'').includes(who)
    && (t.assigner===who || ['Phát sinh','Tự đề xuất','BGĐ chỉ đạo','Khách yêu cầu'].includes(t.source)));
  const myOpen=myPosts.filter(p=>!DONE.includes(p.status));
  const mineHtml=`
    <div class="selfhead">
      <div class="sh-t"><b>Việc cá nhân của ${esc(who)}</b>
        <small>Nội dung bạn tự tạo và việc phát sinh bạn tự thêm — không qua ai giao</small></div>
      <div class="sh-a">
        <button class="btn btn-gh btn-sm" id="mkSelf">${icon('i-plus')}Thêm việc</button>
        <button class="btn btn-pri btn-sm" id="mkPost">${icon('i-pen')}Tạo nội dung</button></div>
    </div>
    <div class="statbar" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${[['i-pen','pri','Nội dung tự tạo',myPosts.length],
         ['i-loop','blue','Đang làm',myOpen.length],
         ['i-check','green','Đã xong',myPosts.filter(p=>p.status==='Đã đăng').length],
         ['i-bolt','amber','Việc phát sinh',myTasksSelf.length]]
        .map(([ic,c,t,n])=>`<div class="stat s-${c} ${n?'':'zero'}">
          <span class="stat-i">${icon(ic)}</span><span class="stat-v">${n}</span>
          <span class="stat-t">${t}</span></div>`).join('')}
    </div>
    <div class="panel"><div class="panel-h"><b>${icon('i-pen')} Nội dung tôi tự tạo</b>
      <small>${myPosts.length} bài</small></div>
      <div>${myPosts.length?myPosts.map(p=>{
        const st=norm(p.status);
        let act='',aid='';
        if(st==='Đang thiết kế'&&p.editor===who){act='Gửi Leader duyệt';aid='qk-send';}
        else if(st==='Đang viết'){act='Gửi duyệt';aid='qk-tosub';}
        return `<div class="qrow is-mine" style="--wc:var(--pri)">
          <span class="pill ${F(p.status).cls}">${F(p.status).ic} ${esc(st)}</span>
          <span class="qt" data-post="${p.id}"><b>${esc(p.title)}</b>
            <small>${esc(p.channel||'')} · ${esc(p.fmt||'')}</small></span>
          <span class="qr">${dueChip(p.pub_date,p.pub_time,p.status==='Đã đăng')}
            ${act?`<button class="todo-b" data-q2="${aid}:${p.id}">${act}</button>`:''}</span></div>`;}).join('')
        :`<div class="empty">${icon('i-pen')}<br><br>Bạn chưa tự tạo nội dung nào.<br>
          <span style="font-size:11.5px">Ví dụ: bộ ảnh muốn làm thêm, video ý tưởng riêng,
          ấn phẩm cần chuẩn bị trước.</span></div>`}</div></div>
    <div class="panel"><div class="panel-h"><b>${icon('i-bolt')} Việc phát sinh tôi tự thêm</b>
      <small>${myTasksSelf.length} việc</small></div>
      <div>${myTasksSelf.length?myTasksSelf.map(t=>`<div class="qrow">
        <span class="pill ${tcls(t)}">${esc(t.status)}</span>
        <span class="qt" data-task="${t.id}"><b>${esc(t.name)}</b>
          <small>${t.source?`<span class="srctag ${t.source==='BGĐ chỉ đạo'?'bgd':''}">${esc(t.source)}</span>`:''}
            ${esc(t.area||'')}</small></span>
        <span class="qr">${dueChip(t.due,null,tgrp(t)==='Hoàn thành')}</span></div>`).join('')
        :'<div class="empty">Chưa có việc phát sinh nào</div>'}</div></div>`;

  const body={queue:giaoChoToiBlock(who)+queueHtml,cat:catHtml,task:taskHtml,
    done:doneHtml,mine:mineHtml}[DTAB]||queueHtml;

  return ph(d.name+(who?' — '+who:''), d.desc,
    who===ME.name?`<span style="display:flex;gap:8px">
      <button class="btn btn-gh btn-sm" id="dkNewPost">${icon('i-pen')}Tạo nội dung</button>
      <button class="btn btn-pri btn-sm" id="dkSelf">${icon('i-plus')}Thêm việc của tôi</button></span>`:'') + `
  <div class="statbar">
    ${[['i-hand','pri','Đang ở tay',mine.length],['i-alert','red','Trễ hạn',lateN],
       ['i-loop','blue','Đang chạy',open.length],['i-check','green','Đã đăng',posted.length],
       ['i-list','gray','Việc dự án',tk.length]]
      .map(([ic,c,t,n])=>`<div class="stat s-${c} ${n?'':'zero'}">
        <span class="stat-i">${icon(ic)}</span><span class="stat-v">${n}</span>
        <span class="stat-t">${t}</span></div>`).join('')}
  </div>
  <div class="tabs">
    <button data-dtab="queue" class="${DTAB==='queue'?'on':''}">${icon('i-inbox')}Hàng đợi (${
      queues.reduce((s,q)=>s+q.l.length,0)})</button>
    <button data-dtab="cat" class="${DTAB==='cat'?'on':''}">${icon(d.kind==='content'?'i-signal':'i-brush')}${
      d.kind==='content'?'Theo kênh':'Theo định dạng'}</button>
    <button data-dtab="task" class="${DTAB==='task'?'on':''}">${icon('i-check')}Việc dự án (${tk.length})</button>
    <button data-dtab="mine" class="${DTAB==='mine'?'on':''}">${icon('i-user')}Của tôi (${
      POSTS.filter(p=>p.writer===who).length})</button>
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
    </div>`;
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



/* ─── Tự thêm việc cho mình ─── */
const NGUON=[
  {k:'Phát sinh',   ic:'i-bolt',  d:'Việc nảy ra trong lúc làm, chưa có trong kế hoạch'},
  {k:'BGĐ chỉ đạo', ic:'i-flag',  d:'Ban giám đốc hoặc cấp trên giao trực tiếp'},
  {k:'Khách yêu cầu',ic:'i-users',d:'Khách hàng hoặc đối tác đề nghị'},
  {k:'Tự đề xuất',  ic:'i-heart', d:'Mình thấy cần làm nên chủ động thêm'},
];
function themViecCuaToi(preArea){
  const t=new Date(D0()); t.setDate(t.getDate()+2);
  const mb=MEMBERS.find(m=>m.name===ME.name)||{};
  const areaMac = preArea || (mb.kind==='design'?'Thiết kế':mb.kind==='leader'?'Kế hoạch chung':'Content');
  openDrawer(`<div class="dr-code">Việc của tôi</div>
    <div class="dr-title">Thêm việc cho chính mình</div>
    <div class="dr-meta">Việc phát sinh ngoài kế hoạch — ghi lại để không quên
      và để cả phòng thấy bạn đang bận gì.</div>
    <div class="dr-lab">Việc này từ đâu ra</div>
    <div class="srcpick">${NGUON.map((n,i)=>`<button class="srcp ${i===0?'on':''}" data-src="${esc(n.k)}">
      ${icon(n.ic)}<span><b>${esc(n.k)}</b><small>${esc(n.d)}</small></span></button>`).join('')}</div>
    <input type="hidden" id="sSrc" value="Phát sinh">
    <div class="dr-lab">Tên việc</div>
    <input type="text" id="sName" class="fld" placeholder="Ví dụ: Sửa gấp banner theo yêu cầu anh Giám đốc">
    <div class="dr-lab">Mô tả</div>
    <textarea id="sDetail" placeholder="Ai yêu cầu, cần làm gì, có gì cần lưu ý"></textarea>
    <div class="two"><div><div class="dr-lab">Hạn xong</div>
      <input type="date" id="sDue" class="fld" value="${iso(t)}"></div>
      <div><div class="dr-lab">Ưu tiên</div><select id="sPri" class="fld">
        <option>Cao</option><option selected>Trung bình</option><option>Thấp</option></select></div></div>
    <div class="two"><div><div class="dr-lab">Mảng việc</div><select id="sArea" class="fld">
        ${['Content','Thiết kế','Kế hoạch chung','Booking KOC/KOL','Chiến dịch','App bán hàng','Khác']
          .map(a=>`<option ${a===areaMac?'selected':''}>${a}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Ước tính (giờ)</div><input type="number" id="sEst" class="fld" value="2"></div></div>
    <div class="dr-lab">Thuộc dự án</div>
    <select id="sProj" class="fld"><option value="">Không thuộc dự án nào</option>${projOpts(PROJ)}</select>
    <button class="btn btn-pri btn-full" id="sSave">${icon('i-plus')}Thêm vào việc của tôi</button>
    <div class="permhint" style="margin-top:12px">${icon('i-alert')}
      <span>Leader sẽ thấy việc này trong mục Đội ngũ để nắm bạn đang bận gì.
      Nếu là chỉ đạo từ BGĐ, nên báo Leader biết luôn.</span></div>`);
  document.querySelectorAll('[data-src]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-src]').forEach(x=>x.classList.toggle('on',x===b));
    document.getElementById('sSrc').value=b.dataset.src;
    if(b.dataset.src==='BGĐ chỉ đạo') document.getElementById('sPri').value='Cao';});
  document.getElementById('sSave').onclick=async()=>{
    if(!V('sName')){toast('Nhập tên việc đã nhé');return;}
    const src=document.getElementById('sSrc').value;
    const sp=(SPRINTS.find(x=>x.status==='Đang chạy')||SPRINTS[0]||{}).id;
    await add('tasks',{name:V('sName'),detail:V('sDetail')||null,owner:ME.name,
      assigner:src==='BGĐ chỉ đạo'?'Ban giám đốc':ME.name,reporter:ME.name,
      source:src,priority:V('sPri'),area:V('sArea'),est:+V('sEst')||2,
      due:V('sDue')||null,project_id:+V('sProj')||null,sprint_id:sp,
      status:'Chưa bắt đầu',archived:false},'Đã thêm vào việc của bạn');
  };
}


/* ─── Dòng bài đăng dùng chung: nhìn là biết của ai ─── */
function browRow(p,opt){
  const o=opt||{};
  const st=norm(p.status), f=F(p.status);
  const h=holder(p);
  const isMine=h===ME.name;
  const col=(typeof CONTENT_COL!=='undefined'&&CONTENT_COL[p.writer])||'#6D4AFF';
  const late=latePost(p), d=dd(p.pub_date);
  const dsLate=p.design_due&&!p.design_done&&dd(p.design_due)<0
    &&['Đang thiết kế','Cần sửa ấn phẩm'].includes(st);
  return `<div class="brow ${isMine?'mine':''}" style="--wc:${col}">
    <span class="brow-av" title="${esc(h||'chưa ai giữ')}">
      ${h?avat(h):'<span class="av none">?</span>'}
      <i class="brow-tag ${f.hold==='leader'?'ld':f.hold==='design'?'dg':f.hold==='writer'?'wr':'dn'}">${
        f.hold==='leader'?'Leader':f.hold==='design'?'Thiết kế':f.hold==='writer'?'Content':'Xong'}</i>
    </span>
    <span class="brow-m" data-post="${p.id}">
      <b class="brow-t">${esc(p.title)}</b>
      <span class="brow-s">
        <span class="pill ${f.cls}">${f.ic} ${esc(st)}</span>
        <span class="brow-ch">${esc(p.channel||'')}</span>
        ${p.fmt?`<span class="brow-fm">${esc(p.fmt)}</span>`:''}
        ${o.needBrief&&!(p.brief||p.brief_link)?'<span class="pill pill-s s-red">thiếu brief</span>':''}
      </span>
      <span class="brow-w">
        <span class="wperson">${avat(p.writer||'?')}${esc(p.writer||'chưa rõ')}</span>
        ${p.editor&&p.editor!=='Không cần'
          ?`<span class="warrow">→</span><span class="wperson">${avat(p.editor)}${esc(p.editor)}</span>`
          :'<span class="wnone">không cần thiết kế</span>'}
      </span>
    </span>
    <span class="brow-r">
      ${o.design
        ? `<span class="brow-due ${dsLate?'late':''}">${p.design_due
            ? (dsLate?`Trễ TK ${Math.abs(dd(p.design_due))} ngày`:`Hạn TK ${fdate(p.design_due)}`)
            : 'chưa đặt hạn TK'}</span>
           <span class="brow-dt">đăng ${fdate2(p.pub_date)}</span>`
        : `<span class="brow-due ${late?'late':d===0?'soon':''}">${
            d===null?'chưa đặt lịch':late?`Quá hạn ${Math.abs(d)} ngày`
            :d===0?'Đăng hôm nay':d===1?'Đăng ngày mai':`Còn ${d} ngày`}</span>
           <span class="brow-dt">${fdate2(p.pub_date)}${p.pub_time?' · '+esc(p.pub_time):''}</span>`}
      ${o.act?`<button class="brow-btn" data-q2="${o.act[1]}:${p.id}">${esc(o.act[0])}</button>`:''}
      ${o.btns||''}
    </span></div>`;
}

/* ─── Khối đầu việc được giao — hiện ở mọi bàn làm việc ─── */
function giaoChoToiBlock(who){
  const tk=TASKS.filter(t=>(t.owner||'').includes(who)
    &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  const moi=tk.filter(t=>tgrp(t)==='Chưa bắt đầu');
  const tre=tk.filter(lateTask);
  if(!tk.length) return '';
  const row=t=>{
    const pr=PROJECTS.find(x=>x.id===t.project_id)||{};
    const isNew=tgrp(t)==='Chưa bắt đầu';
    return `<div class="qrow ${isNew?'is-new':''}">
      <span class="pill ${tcls(t)}">${esc(t.status)}</span>
      <span class="qt" data-task="${t.id}"><b>${esc(t.name)}</b>
        <small>${t.source&&t.source!=='Kế hoạch'
            ?`<span class="srctag ${t.source==='BGĐ chỉ đạo'?'bgd':''}">${esc(t.source)}</span>`
            :(t.assigner&&t.assigner!==who?`<span class="giaobi">${avat(t.assigner)}${esc(t.assigner)} giao</span>`:'')}
          ${esc(pr.code||'')} · ${esc(t.area||'')}</small></span>
      <span class="qr">${dueChip(t.due,null,false)}
        <span class="pill pill-s ${PRI[t.priority]||'s-gray'}">${esc(t.priority||'')}</span>
        ${isNew&&who===ME.name?`<button class="todo-b" data-tstart="${t.id}">Bắt đầu làm</button>`:''}
      </span></div>`;};
  return `<div class="panel giao-panel">
    <div class="panel-h"><b>${icon('i-inbox')} Đầu việc được giao cho ${esc(who.split(' ').slice(-1)[0])}</b>
      <small>${tk.length} việc${moi.length?` · ${moi.length} chưa bắt đầu`:''}${tre.length?` · ${tre.length} trễ`:''}</small></div>
    <div>${tk.slice(0,8).map(row).join('')}
      ${tk.length>8?`<div class="qrow"><span class="qt" data-goto="tasks"
        style="color:var(--pri);cursor:pointer">Xem đủ ${tk.length} việc trong mục Đầu việc →</span></div>`:''}</div>
  </div>`;
}

/* ═════════ CONTENT MARKETING — tách theo từng người ═════════ */
let WCH=0, WTAB='mine', WWHO='me';
const CONTENT_COL={};

function viewWork(){
  /* ai đang được xem */
  const writers=MEMBERS.filter(m=>m.kind!=='design');
  writers.forEach((m,i)=>CONTENT_COL[m.name]=['#6D4AFF','#0E7490','#C2410C','#7C3AED'][i%4]);
  const target = WWHO==='all' ? null : (WWHO==='me' ? ME.name : WWHO);
  const mb = target ? MEMBERS.find(m=>m.name===target) : null;
  const myColor = target ? (CONTENT_COL[target]||'#6D4AFF') : '#66667E';

  const cur=WCH?CHANNELS.find(c=>c.id===WCH):null;
  let scope=POSTS;
  if(cur) scope=scope.filter(p=>p.channel===cur.name);
  if(target) scope=scope.filter(p=>p.writer===target||holds(p,target));
  const open=scope.filter(p=>!DONE.includes(p.status));
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));

  /* thanh chọn người */
  const cnt=n=>POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,n)).length;
  const lateN=n=>POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,n)&&latePost(p)).length;
  const whoBar=`<div class="whoseg">
    <button class="wseg ${WWHO==='me'?'on':''}" data-wwho="me"
      style="--wc:${CONTENT_COL[ME.name]||'#6D4AFF'}">
      ${avat(ME.name)}<span>Việc của tôi</span>
      ${cnt(ME.name)?`<i class="wn ${lateN(ME.name)?'late':''}">${cnt(ME.name)}</i>`:''}</button>
    ${writers.filter(m=>m.name!==ME.name).map(m=>
      `<button class="wseg ${WWHO===m.name?'on':''}" data-wwho="${esc(m.name)}"
        style="--wc:${CONTENT_COL[m.name]}">
        ${avat(m.name)}<span>${esc(m.short_name||m.name.split(' ').slice(-1)[0])}</span>
        ${cnt(m.name)?`<i class="wn ${lateN(m.name)?'late':''}">${cnt(m.name)}</i>`:''}</button>`).join('')}
    <button class="wseg ${WWHO==='all'?'on':''}" data-wwho="all" style="--wc:#5A5A72">
      ${icon('i-users')}<span>Cả phòng</span></button>
  </div>`;

  /* thẻ kênh */
  const grid=CHANNELS.map((c,i)=>{
    const P=PLAT[c.platform]||{};
    let all=POSTS.filter(p=>p.channel===c.name);
    if(target) all=all.filter(p=>p.writer===target||holds(p,target));
    const op=all.filter(p=>!DONE.includes(p.status));
    const n=all.filter(p=>p.pub_date&&new Date(p.pub_date)>=wk).length;
    const t=c.target_week||0, pc=t?Math.min(100,Math.round(n/t*100)):0;
    const mine2=op.filter(p=>holds(p,target||ME.name)).length;
    const lt=op.filter(latePost).length;
    if(target&&!all.length) return '';
    return `<button class="wch ${WCH===c.id?'on':''}" data-wch="${c.id}">
      <span class="wch-t"><span class="wch-d" style="background:${P.color||'#999'}"></span>
        <span class="wch-n"><b>${esc(c.name)}</b><small>${esc(c.platform)}</small></span>
        ${mine2?`<span class="wch-me">${mine2}</span>`:lt?`<span class="wch-me late">${lt}</span>`:''}</span>
      <span class="wch-b"><i class="${pc>=100?'ok':pc>=50?'':'warn'}" style="width:${pc}%"></i></span>
      <span class="wch-f"><span>${op.length} đang chạy</span><span>${n}/${t} tuần</span></span></button>`;
  }).filter(Boolean).join('');

  const buckets=[
    {k:'mine',t:target?'Đang ở tay '+(target.split(' ').slice(-1)[0]):'Đang có người giữ',ic:'i-hand',
     l:open.filter(p=>holds(p,target||ME.name))},
    {k:'todo',t:'Đang viết',ic:'i-pen',l:open.filter(p=>['Đang viết','Cần sửa nội dung'].includes(norm(p.status)))},
    {k:'wait',t:'Chờ Leader duyệt',ic:'i-clock',l:open.filter(p=>F(p.status).hold==='leader')},
    {k:'design',t:'Ở bên thiết kế',ic:'i-brush',l:open.filter(p=>F(p.status).hold==='design')},
    {k:'pub',t:'Chờ đăng',ic:'i-cal',l:open.filter(p=>norm(p.status)==='Chờ đăng')},
    {k:'done',t:'Đã đăng',ic:'i-check',l:scope.filter(p=>p.status==='Đã đăng')},
  ];
  const cur_b=buckets.find(b=>b.k===WTAB)||buckets[0];

  const row=p=>{
    const st=norm(p.status), f=F(p.status);
    const h=holder(p);
    const isMine=h===ME.name;
    const col=CONTENT_COL[p.writer]||'#9797AC';
    let act='',aid='';
    if(isMine){
      if(['Đang viết','Cần sửa nội dung'].includes(st)){act='Gửi duyệt';aid='wk-sub';}
      else if(st==='Chờ đăng'){act='Đăng bài';aid='wk-pub';}
      else if(st==='Đang thiết kế'&&!p.editor&&p.writer===ME.name){act='Chọn thiết kế';aid='wk-give';}
      else if(f.hold==='leader'&&can('post.approve')
        &&(scopeOf('post.approve')==='Toàn hệ thống'
           ||MEMBERS.some(m=>m.manager===ME.name&&m.name===p.writer))){act='Duyệt';aid='wk-appr';}
    }
    const late=latePost(p);
    const d=dd(p.pub_date);
    return `<div class="brow ${isMine?'mine':''}" style="--wc:${col}">
      <span class="brow-av" title="${esc(h||'chưa ai giữ')}">
        ${h?avat(h):'<span class="av none">?</span>'}
        <i class="brow-tag ${f.hold==='leader'?'ld':f.hold==='design'?'dg':'wr'}">${
          f.hold==='leader'?'Leader':f.hold==='design'?'Thiết kế':f.hold==='writer'?'Content':'Xong'}</i>
      </span>
      <span class="brow-m" data-post="${p.id}">
        <b class="brow-t">${esc(p.title)}</b>
        <span class="brow-s">
          <span class="pill ${f.cls}">${f.ic} ${esc(st)}</span>
          <span class="brow-ch">${esc(p.channel||'')}</span>
          ${p.fmt?`<span class="brow-fm">${esc(p.fmt)}</span>`:''}
        </span>
        <span class="brow-w">
          <span class="wperson">${avat(p.writer||'?')}${esc(p.writer||'chưa rõ')}</span>
          ${p.editor&&p.editor!=='Không cần'
            ?`<span class="warrow">→</span><span class="wperson">${avat(p.editor)}${esc(p.editor)}</span>`
            :'<span class="wnone">không cần thiết kế</span>'}
        </span>
      </span>
      <span class="brow-r">
        <span class="brow-due ${late?'late':d===0?'soon':''}">${
          d===null?'chưa đặt lịch':late?`Quá hạn ${Math.abs(d)} ngày`
          :d===0?'Đăng hôm nay':d===1?'Đăng ngày mai':`Còn ${d} ngày`}</span>
        <span class="brow-dt">${fdate2(p.pub_date)}${p.pub_time?' · '+esc(p.pub_time):''}</span>
        ${act?`<button class="brow-btn" data-q2="${aid}:${p.id}">${act}</button>`:''}
      </span></div>`;
  };

  const title = WWHO==='all' ? 'Content Marketing — cả phòng'
    : WWHO==='me' ? 'Content của tôi — '+ME.name
    : 'Content của '+target;
  const sub = target
    ? `${esc((mb||{}).role||'')} · ${open.filter(p=>holds(p,target)).length} bài đang ở tay · `
      +`${scope.filter(p=>p.status==='Đã đăng').length} bài đã đăng`
    : `${CHANNELS.length} kênh · ${open.length} bài đang chạy`;

  return `<div class="whead" style="--wc:${myColor}">
    ${ph(title,sub,`<span style="display:flex;gap:8px">
      ${WCH?`<button class="btn btn-gh btn-sm" id="wAll">${icon('i-list')}Tất cả kênh</button>`:''}
      <button class="btn btn-gh btn-sm" id="wSelf">${icon('i-plus')}Thêm việc của tôi</button>
      <button class="btn btn-pri btn-sm" id="wNew">${icon('i-plus')}Tạo nội dung</button></span>`)}
    </div>
  ${whoBar}
  <div class="statbar">
    ${[['i-hand','pri','Đang ở tay',open.filter(p=>holds(p,target||ME.name)).length,'mine'],
       ['i-alert','red','Quá hạn',open.filter(latePost).length,''],
       ['i-clock','amber','Chờ Leader',open.filter(p=>F(p.status).hold==='leader').length,'wait'],
       ['i-brush','pink','Ở bên thiết kế',open.filter(p=>F(p.status).hold==='design').length,'design'],
       ['i-check','green','Đã đăng',scope.filter(p=>p.status==='Đã đăng').length,'done']]
      .map(([ic,c,t,n,tab])=>`<button class="stat s-${c} ${n?'':'zero'}"
        ${tab?`data-wtab="${tab}"`:''}>
        <span class="stat-i">${icon(ic)}</span>
        <span class="stat-v">${n}</span><span class="stat-t">${t}</span></button>`).join('')}
  </div>
  ${target?giaoChoToiBlock(target):''}
  ${grid?`<div class="wgrid">${grid}</div>`:''}
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
  <div class="statbar">
    ${[['i-check','green','Đã nộp hôm nay',sub+'/'+MEMBERS.length],
       ['i-alert','gray','Chưa nộp',MEMBERS.length-sub],
       ['i-clock','amber','Chờ duyệt',st('Chờ duyệt')],
       ['i-list','blue','Việc được báo cáo',totTask],
       ['i-loop',blockers.length?'red':'gray','Vướng mắc',blockers.length]]
      .map(([ic,c,t,n])=>`<div class="stat s-${c} ${n&&n!=='0'?'':'zero'}">
        <span class="stat-i">${icon(ic)}</span><span class="stat-v">${n}</span>
        <span class="stat-t">${t}</span></div>`).join('')}
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
        <div class="setrow"><span class="setl">Giao diện</span>
          <span class="setu">
            <button class="btn btn-gh btn-sm" onclick="setTheme('light')">Nền sáng</button>
            <button class="btn btn-gh btn-sm" onclick="setTheme('dark')">Nền tối</button>
          </span></div>
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


/* ═════════ DUYỆT & GIAO VIỆC — bàn điều khiển của Leader ═════════ */
let ASTAB='duyet';
function viewAssign(){
  const dNoiDung=POSTS.filter(p=>norm(p.status)==='Chờ duyệt nội dung');
  const dAnPham =POSTS.filter(p=>norm(p.status)==='Chờ duyệt ấn phẩm');
  const choDuyet=[...dNoiDung,...dAnPham];
  const giao=TASKS.filter(t=>t.assigner===ME.name&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  const nhan=TASKS.filter(t=>(t.owner||'').includes(ME.name)&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  const yeuCau=APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt');
  const cap=+(SET.load_max||14);

  /* dòng bài chờ duyệt — có nút xử lý ngay */
  const prow=(p,loai)=>browRow(p,{btns:loai==='nd'
    ? `<span class="brow-acts"><button class="brow-btn" data-ok-nd="${p.id}">Duyệt</button>
       <button class="brow-btn gh" data-assign-nd="${p.id}">Duyệt &amp; giao TK</button>
       <button class="brow-btn gh" data-fix-nd="${p.id}">Trả lại</button></span>`
    : `<span class="brow-acts"><button class="brow-btn" data-ok-ap="${p.id}">Duyệt &amp; cho đăng</button>
       <button class="brow-btn gh" data-fix-ap="${p.id}">Trả lại</button></span>`});

  /* thẻ người để giao việc */
  const cards=MEMBERS.filter(m=>m.name!==ME.name).map(m=>{
    const tk=TASKS.filter(t=>(t.owner||'').includes(m.name)
      &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
    const ps=POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name));
    const lt=tk.filter(lateTask).length+ps.filter(latePost).length;
    const tot=tk.length+ps.length;
    const pc=Math.min(100,Math.round(tot/cap*100));
    return `<div class="acard ${lt?'risk':tot>cap?'load':tot?'busy':'free'}">
      <div class="acard-h">${avat(m.name)}
        <span class="acard-n"><b>${esc(m.name)}</b><small>${esc(m.role)}</small></span>
        <span class="acard-num"><b>${tot}</b><small>việc</small></span></div>
      <div class="acard-b">
        <div class="prow" style="border:0;padding:4px 0">
          <span class="bar" style="flex:1"><i class="${pc>=100?'bad':pc>=70?'warn':'ok'}" style="width:${pc}%"></i></span>
          <span class="pct">${pc}%</span></div>
        <div class="acard-t">
          ${lt?`<span class="pill pill-s s-red">${lt} trễ</span>`:''}
          ${tk.length?`<span class="pill pill-s s-gray">${tk.length} đầu việc</span>`:''}
          ${ps.length?`<span class="pill pill-s s-teal">${ps.length} bài</span>`:''}
          ${!tot?'<span class="pill pill-s s-green">đang rảnh</span>':''}</div></div>
      <div class="acard-f">
        <button class="btn btn-pri btn-sm" data-giao="${esc(m.name)}">${icon('i-send')}Giao việc</button>
        <span data-who="${esc(m.name)}" style="cursor:pointer;color:var(--pri);font-size:11.5px">Xem tất cả →</span>
      </div></div>`;}).join('');

  const trow=t=>{const pr=PROJECTS.find(x=>x.id===t.project_id)||{};
    return `<div class="qrow">
      <span class="pill ${tcls(t)}">${esc(t.status)}</span>
      <span class="qt" data-task="${t.id}"><b>${esc(t.name)}</b>
        <small>${esc(t.owner||'chưa giao')} · ${esc(pr.code||'')} · ${esc(t.area||'')}</small></span>
      <span class="qr">${dueChip(t.due,null,tgrp(t)==='Hoàn thành')}
        <span class="pill pill-s ${PRI[t.priority]||'s-gray'}">${esc(t.priority||'')}</span></span></div>`;};

  const body={
    duyet:`
      ${dNoiDung.length?`<div class="panel"><div class="panel-h">
        <b>${icon('i-pen')} Chờ duyệt nội dung</b><small>${dNoiDung.length} bài · Content vừa gửi lên</small></div>
        <div>${dNoiDung.map(p=>prow(p,'nd')).join('')}</div></div>`:''}
      ${dAnPham.length?`<div class="panel"><div class="panel-h">
        <b>${icon('i-brush')} Chờ duyệt ấn phẩm</b><small>${dAnPham.length} bài · thiết kế đã làm xong</small></div>
        <div>${dAnPham.map(p=>prow(p,'ap')).join('')}</div></div>`:''}
      ${yeuCau.length?`<div class="panel"><div class="panel-h">
        <b>${icon('i-bell')} Yêu cầu khác chờ bạn</b><small>${yeuCau.length}</small></div>
        <div>${yeuCau.map(a=>`<div class="qrow">
          <span class="pill pill-s s-gray">${esc(a.kind)}</span>
          <span class="qt" data-apr="${a.id}"><b>${esc(a.title)}</b>
            <small>${esc(a.requester)}${a.amount?' · '+mshort(a.amount):''}</small></span>
          <span class="qr"><button class="todo-b" data-aok="${a.id}">Duyệt</button></span></div>`).join('')}</div></div>`:''}
      ${!choDuyet.length&&!yeuCau.length?'<div class="panel"><div class="empty">'
        +icon('i-check')+'<br><br>Không có gì chờ bạn duyệt. Cả phòng đang chạy trơn.</div></div>':''}`,
    giao:`<div class="acards">${cards}</div>`,
    sent:`<div class="panel"><div class="panel-h"><b>Việc tôi đã giao</b><small>${giao.length}</small></div>
      <div>${giao.length?giao.map(trow).join(''):'<div class="empty">Bạn chưa giao việc nào đang mở</div>'}</div></div>`,
    got:`<div class="panel"><div class="panel-h"><b>Việc giao cho tôi</b><small>${nhan.length}</small></div>
      <div>${nhan.length?nhan.map(trow).join(''):'<div class="empty">Không có việc nào</div>'}</div></div>`
  }[ASTAB];

  return ph('Duyệt & Giao việc',
    'Một chỗ để Leader duyệt nội dung, duyệt ấn phẩm và giao việc xuống từng người',
    `<button class="btn btn-pri btn-sm" id="asNew">${icon('i-plus')}Giao việc mới</button>`) + `
  <div class="statbar">
    ${[['i-pen','amber','Chờ duyệt nội dung',dNoiDung.length,'duyet'],
       ['i-brush','blue','Chờ duyệt ấn phẩm',dAnPham.length,'duyet'],
       ['i-send','pri','Tôi đã giao',giao.length,'sent'],
       ['i-alert','red','Trễ trong số đã giao',giao.filter(lateTask).length,'sent'],
       ['i-users','green','Người đang rảnh',
        MEMBERS.filter(m=>!TASKS.some(t=>(t.owner||'').includes(m.name)
          &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)))).length,'giao']]
      .map(([ic,c,t,n,tab])=>`<button class="stat s-${c} ${n?'':'zero'}" data-astab="${tab}">
        <span class="stat-i">${icon(ic)}</span><span class="stat-v">${n}</span>
        <span class="stat-t">${t}</span></button>`).join('')}
  </div>
  <div class="tabs">
    <button data-astab="duyet" class="${ASTAB==='duyet'?'on':''}">${icon('i-check')}Chờ tôi duyệt (${choDuyet.length+yeuCau.length})</button>
    <button data-astab="giao" class="${ASTAB==='giao'?'on':''}">${icon('i-users')}Giao việc</button>
    <button data-astab="sent" class="${ASTAB==='sent'?'on':''}">${icon('i-send')}Tôi đã giao (${giao.length})</button>
    <button data-astab="got" class="${ASTAB==='got'?'on':''}">${icon('i-inbox')}Giao cho tôi (${nhan.length})</button>
  </div>
  ${body}`;
}

/* Form giao việc — điền sẵn người nhận nếu bấm từ thẻ */
function giaoViec(who){
  const t=new Date(D0()); t.setDate(t.getDate()+3);
  const mb=MEMBERS.find(m=>m.name===who);
  const goiY = mb ? (mb.kind==='design'
    ? ['Dựng lại video theo brief mới','Thiết kế bộ ảnh cho chiến dịch','Sửa ấn phẩm theo góp ý']
    : mb.kind==='leader' ? ['Rà soát ngân sách tuần','Chốt kế hoạch tháng']
    : ['Lên nội dung cho tuần tới','Seeding nhóm cộng đồng','Nghiên cứu nội dung đối thủ']) : [];
  openDrawer(`<div class="dr-code">Giao việc</div>
    <div class="dr-title">${who?'Giao cho '+esc(who):'Giao việc mới'}</div>
    ${who&&mb?`<div class="dr-meta">${esc(mb.role)}${mb.manager?' · báo cáo cho '+esc(mb.manager):''}<br>
      Đang giữ <b>${TASKS.filter(x=>(x.owner||'').includes(who)
        &&!['Hoàn thành','Không áp dụng'].includes(tgrp(x))).length} đầu việc</b></div>`:''}
    <div class="dr-lab" style="margin-top:14px">Tên việc</div>
    <input type="text" id="gName" class="fld" placeholder="Nói rõ cần làm gì">
    ${goiY.length?`<div class="sugs" style="margin-top:7px">${goiY.map(x=>
      `<button class="sug" data-gsug="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>`:''}
    <div class="dr-lab">Mô tả chi tiết</div>
    <textarea id="gDetail" placeholder="Yêu cầu cụ thể, tiêu chí hoàn thành, cần phối hợp với ai…"></textarea>
    <div class="two"><div><div class="dr-lab">Giao cho</div>
      <select id="gOwn" class="fld">${MEMBERS.map(m=>
        `<option ${m.name===who?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Dự án</div><select id="gProj" class="fld">${projOpts(PROJ||PROJECTS[0]?.id)}</select></div></div>
    <div class="two"><div><div class="dr-lab">Hạn hoàn thành</div>
      <input type="date" id="gDue" class="fld" value="${iso(t)}"></div>
      <div><div class="dr-lab">Mức ưu tiên</div><select id="gPri" class="fld">
        <option>Cao</option><option selected>Trung bình</option><option>Thấp</option></select></div></div>
    <div class="two"><div><div class="dr-lab">Mảng việc</div><select id="gArea" class="fld">
        ${['Content','Thiết kế','Kế hoạch chung','Booking KOC/KOL','Chiến dịch','App bán hàng','Khác']
          .map(a=>`<option>${a}</option>`).join('')}</select></div>
      <div><div class="dr-lab">Ước tính (giờ)</div><input type="number" id="gEst" class="fld" value="4"></div></div>
    <div class="dr-lab">Link tài liệu / brief</div>
    <input type="text" id="gLink" class="fld" placeholder="drive.google.com/… (không bắt buộc)">
    <button class="btn btn-pri btn-full" id="gSave">${icon('i-send')}Giao việc</button>`);
  document.querySelectorAll('[data-gsug]').forEach(b=>b.onclick=()=>{
    document.getElementById('gName').value=b.dataset.gsug;});
  document.getElementById('gSave').onclick=async()=>{
    if(!V('gName')){toast('Nhập tên việc đã nhé');return;}
    const sp=(SPRINTS.find(x=>x.status==='Đang chạy')||SPRINTS[0]||{}).id;
    await add('tasks',{name:V('gName'),detail:(V('gDetail')||'')+(V('gLink')?'\nTài liệu: '+V('gLink'):'')||null,
      owner:V('gOwn'),project_id:+V('gProj'),due:V('gDue')||null,priority:V('gPri'),
      area:V('gArea'),est:+V('gEst')||4,sprint_id:sp,
      assigner:ME.name,reporter:ME.name,status:'Chưa bắt đầu',archived:false},
      'Đã giao việc cho '+V('gOwn'));
  };
}

/* ═════════ LEADER TEAM — bàn điều hành tổng ═════════ */
let LTAB='now';

function viewLeader(){
  if(!(ME&&(ME.kind==='leader'||can('post.approve'))))
    return ph('Leader Team','')+`<div class="panel"><div class="empty">${icon('i-alert')}<br><br>
      Mục này dành cho Leader.<br>Vai trò <b>${esc(myRole())}</b> không xem được.</div></div>`;

  const openP=POSTS.filter(p=>!DONE.includes(p.status));
  const dND=POSTS.filter(p=>norm(p.status)==='Chờ duyệt nội dung');
  const dAP=POSTS.filter(p=>norm(p.status)==='Chờ duyệt ấn phẩm');
  const yc=APPROVALS.filter(a=>a.approver===ME.name&&a.status==='Chờ duyệt');
  const lateP=openP.filter(latePost), lateT=TASKS.filter(lateTask);
  const cap=+(SET.load_max||14);
  const td=iso(D0());
  const rToday=REPORTS.filter(r=>r.date===td);
  const rSub=rToday.filter(r=>r.status!=='Chưa nộp');
  const chuaNop=MEMBERS.filter(m=>!rSub.some(r=>r.author===m.name));

  /* ── Từng người: một dòng gọn, thấy hết ── */
  const nguoi=MEMBERS.map(m=>{
    const tk=TASKS.filter(t=>(t.owner||'').includes(m.name)
      &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
    const ps=openP.filter(p=>holds(p,m.name));
    const lt=tk.filter(lateTask).length+ps.filter(latePost).length;
    const tot=tk.length+ps.length;
    const rep=rToday.find(r=>r.author===m.name);
    const done7=TASKS.filter(t=>(t.owner||'').includes(m.name)&&tgrp(t)==='Hoàn thành').length;
    return {m,tk:tk.length,ps:ps.length,lt,tot,rep,done7,
      load:Math.min(100,Math.round(tot/cap*100))};
  });

  /* ── Kênh hụt nhịp ── */
  const wk=new Date(D0()); wk.setDate(wk.getDate()-((wk.getDay()+6)%7));
  const kenh=CHANNELS.map(c=>{
    const n=POSTS.filter(p=>p.channel===c.name&&p.pub_date&&new Date(p.pub_date)>=wk).length;
    return {c,n,t:c.target_week||0,thieu:Math.max(0,(c.target_week||0)-n)};
  }).filter(x=>x.t>0).sort((a,b)=>b.thieu-a.thieu);
  const hut=kenh.filter(x=>x.thieu>0);

  /* ── Tiền ── */
  const plan=BUDGET.reduce((s,b)=>s+(b.plan||0),0);
  const spent=BUDGET.reduce((s,b)=>s+(b.spent||0),0);
  const adRun=ADS.filter(a=>a.status==='Đang chạy');
  const adSpent=ADS.reduce((s,a)=>s+(a.spent||0),0);
  const adRev=ADS.reduce((s,a)=>s+(a.revenue||0),0);
  const roasAll=adSpent?adRev/adSpent:0;

  /* ══ TAB 1 · CẦN XỬ LÝ NGAY ══ */
  const prow=(p,loai)=>browRow(p,{btns:loai==='nd'
    ? `<button class="brow-btn" data-ok-nd="${p.id}">Duyệt</button>`
    : `<button class="brow-btn" data-ok-ap="${p.id}">Duyệt &amp; cho đăng</button>`});

  const canXuLy=`
    ${dND.length||dAP.length||yc.length?'':`<div class="panel"><div class="empty">
      ${icon('i-check')}<br><br>Không có gì chờ bạn duyệt.</div></div>`}
    ${dND.length?`<div class="panel"><div class="panel-h">
      <b>${icon('i-pen')} Content chờ bạn duyệt nội dung</b><small>${dND.length}</small></div>
      <div>${dND.map(p=>prow(p,'nd')).join('')}</div></div>`:''}
    ${dAP.length?`<div class="panel"><div class="panel-h">
      <b>${icon('i-brush')} Thiết kế chờ bạn duyệt ấn phẩm</b><small>${dAP.length}</small></div>
      <div>${dAP.map(p=>prow(p,'ap')).join('')}</div></div>`:''}
    ${yc.length?`<div class="panel"><div class="panel-h">
      <b>${icon('i-bell')} Yêu cầu khác</b><small>${yc.length}</small></div>
      <div>${yc.map(a=>`<div class="qrow">
        <span class="pill pill-s s-gray">${esc(a.kind)}</span>
        <span class="qt" data-apr="${a.id}"><b>${esc(a.title)}</b>
          <small>${esc(a.requester)}${a.amount?' · '+mshort(a.amount):''}</small></span>
        <span class="qr"><button class="todo-b" data-aok="${a.id}">Duyệt</button></span></div>`).join('')}</div></div>`:''}
    ${lateP.length||lateT.length?`<div class="panel"><div class="panel-h">
      <b style="color:var(--red)">${icon('i-alert')} Đang quá hạn</b>
      <small>${lateP.length} bài · ${lateT.length} đầu việc</small></div>
      <div>${[...lateP.slice(0,5).map(p=>`<div class="qrow">
        <span class="pill ${F(p.status).cls}">${esc(norm(p.status))}</span>
        <span class="qt" data-post="${p.id}"><b>${esc(p.title)}</b>
          <small>${esc(holder(p)||'')} đang giữ · ${esc(p.channel||'')}</small></span>
        <span class="qr">${dueChip(p.pub_date,p.pub_time,false)}</span></div>`),
        ...lateT.slice(0,5).map(t=>`<div class="qrow">
        <span class="pill ${tcls(t)}">${esc(t.status)}</span>
        <span class="qt" data-task="${t.id}"><b>${esc(t.name)}</b>
          <small>${esc(t.owner||'')} · ${esc(t.area||'')}</small></span>
        <span class="qr">${dueChip(t.due,null,false)}</span></div>`)].join('')}</div></div>`:''}
    ${chuaNop.length?`<div class="panel"><div class="panel-h">
      <b>${icon('i-doc')} Chưa nộp báo cáo hôm nay</b><small>${chuaNop.length}/${MEMBERS.length}</small></div>
      <div class="panel-b"><div class="whochips">${chuaNop.map(m=>
        `<span class="whochip" data-who="${esc(m.name)}">${avat(m.name)}${esc(m.name)}</span>`).join('')}</div>
        <div style="font-size:11.5px;color:var(--ink3);margin-top:9px">
          Nhắc nhẹ cuối ngày — nếp báo cáo là thứ giữ cho mọi số liệu trong hệ thống đáng tin.</div>
      </div></div>`:''}`;

  /* ══ TAB 2 · ĐỘI NGŨ ══ */
  const doiNgu=`
    <div class="panel"><div class="panel-h"><b>Ai đang làm gì</b>
      <small>${MEMBERS.length} người · bấm để xem chi tiết</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:180px">Thành viên</th><th>Bài đang giữ</th><th>Đầu việc</th>
        <th>Trễ hạn</th><th>Báo cáo hôm nay</th><th style="min-width:130px">Tải trọng</th></tr></thead><tbody>
        ${nguoi.map(x=>`<tr data-who="${esc(x.m.name)}">
          <td><div class="whorow">${avat(x.m.name)}<span><b>${esc(x.m.name)}</b>
            <small>${esc(x.m.role)}</small></span></div></td>
          <td>${x.ps||'<span style="color:var(--ink3)">—</span>'}</td>
          <td>${x.tk||'<span style="color:var(--ink3)">—</span>'}</td>
          <td>${x.lt?`<span class="pill pill-s s-red">${x.lt}</span>`:'<span style="color:var(--ink3)">0</span>'}</td>
          <td>${x.rep&&x.rep.status!=='Chưa nộp'
            ?`<span class="pill pill-s ${RST[x.rep.status]}">${esc(x.rep.status)}</span>`
            :'<span class="pill pill-s s-gray">chưa nộp</span>'}</td>
          <td><div class="prow" style="border:0;padding:0">
            <span class="bar" style="flex:1"><i class="${x.load>=100?'bad':x.load>=70?'warn':'ok'}"
              style="width:${x.load}%"></i></span><span class="pct">${x.tot}</span></div></td></tr>`).join('')}
      </tbody></table></div></div>

    <div class="grid2">
      <div class="panel"><div class="panel-h"><b>Cần chú ý</b></div><div class="panel-b">
        ${(()=>{const w=[];
          nguoi.filter(x=>x.lt>0).sort((a,b)=>b.lt-a.lt).forEach(x=>
            w.push([`${x.m.name} có ${x.lt} việc quá hạn`,'red',x.m.name]));
          nguoi.filter(x=>x.tot>cap).forEach(x=>
            w.push([`${x.m.name} đang giữ ${x.tot} việc — cân nhắc chia bớt`,'amber',x.m.name]));
          nguoi.filter(x=>x.tot===0).forEach(x=>
            w.push([`${x.m.name} không có việc nào đang mở`,'gray',x.m.name]));
          return w.length?w.map(([t,c,n])=>`<div class="warn-i" data-who="${esc(n)}">
            <span class="warn-t">${esc(t)}</span>
            <span class="pill pill-s ${c==='red'?'s-red':c==='amber'?'s-amber':'s-gray'}">${
              c==='red'?'trễ':c==='amber'?'quá tải':'rảnh'}</span></div>`).join('')
            :'<div class="empty">Cả đội đang cân bằng</div>';})()}
      </div></div>
      <div class="panel"><div class="panel-h"><b>Giao việc nhanh</b>
        <small>bấm tên để giao</small></div><div class="panel-b">
        ${MEMBERS.filter(m=>m.name!==ME.name).map(m=>{
          const x=nguoi.find(y=>y.m.name===m.name);
          return `<div class="prow" data-giao="${esc(m.name)}" style="cursor:pointer">
            <span class="nm">${avat(m.name)}${esc(m.name)}</span>
            <span class="ct">${x.tot} việc</span>
            <span class="pill pill-s ${x.tot>cap?'s-amber':x.tot?'s-gray':'s-green'}">${
              x.tot>cap?'quá tải':x.tot?'đang bận':'rảnh'}</span></div>`;}).join('')}
      </div></div>
    </div>`;

  /* ══ TAB 3 · SẢN XUẤT ══ */
  const stages=[['Đang viết','writer'],['Chờ duyệt nội dung','leader'],['Đang thiết kế','design'],
    ['Chờ duyệt ấn phẩm','leader'],['Chờ đăng','writer']];
  const sanXuat=`
    <div class="panel"><div class="panel-h"><b>Guồng sản xuất</b>
      <small>${openP.length} bài đang chạy</small></div>
      <div class="panel-b">
        <div class="pipebar">${stages.map(([st])=>{
          const n=openP.filter(p=>norm(p.status)===st).length;
          const f=FLOW.find(x=>x.s===st)||{};
          return `<div class="pipe ${n?'':'zero'}">
            <span class="pipe-n">${n}</span><span class="pipe-t">${f.ic||''} ${esc(st)}</span></div>`;}).join('')}
        </div>
        <div style="font-size:11.5px;color:var(--ink3);margin-top:12px;line-height:1.6">
          ${(()=>{const mx=stages.map(([st])=>({st,n:openP.filter(p=>norm(p.status)===st).length}))
            .sort((a,b)=>b.n-a.n)[0];
          return mx&&mx.n>2?`Đang dồn nhiều nhất ở <b style="color:var(--pri)">${esc(mx.st)}</b> — ${mx.n} bài.`
            :'Guồng đang chảy đều, không chỗ nào tắc.';})()}
        </div></div></div>

    <div class="grid2">
      <div class="panel"><div class="panel-h"><b>Kênh hụt nhịp tuần này</b>
        <small>${hut.length}/${kenh.length} kênh</small></div>
        <div class="panel-b">${kenh.slice(0,8).map(x=>{
          const pc=x.t?Math.min(100,Math.round(x.n/x.t*100)):0;
          return `<div class="prow" data-mch="${x.c.id}" style="cursor:pointer">
            <span class="nm">${esc(x.c.name)}</span>
            <span class="ct">${x.n}/${x.t}</span>
            <span class="bar" style="flex:0 0 70px"><i class="${pc>=100?'ok':pc>=50?'':'warn'}"
              style="width:${pc}%"></i></span>
            ${x.thieu?`<span class="pill pill-s s-amber">thiếu ${x.thieu}</span>`
              :'<span class="pill pill-s s-green">đạt</span>'}</div>`;}).join('')}
        </div></div>
      <div class="panel"><div class="panel-h"><b>Tiến độ dự án</b><small>${PROJECTS.length}</small></div>
        <div class="panel-b">${PROJECTS.map(pr=>{
          const ts=TASKS.filter(t=>t.project_id===pr.id&&tgrp(t)!=='Không áp dụng');
          const dn=ts.filter(t=>tgrp(t)==='Hoàn thành').length;
          const p=ts.length?Math.round(dn/ts.length*100):0;
          const lt=ts.filter(lateTask).length;
          const d=dd(pr.due);
          return `<div class="prow" data-popen="${pr.id}" style="cursor:pointer">
            <span class="nm"><span class="dd" style="width:8px;height:8px;border-radius:50%;background:${pr.color}"></span>${esc(pr.code)}</span>
            <span class="ct">${dn}/${ts.length}${lt?` · ${lt} trễ`:''}</span>
            <span class="bar" style="flex:0 0 70px"><i style="width:${p}%"></i></span>
            <span class="pct">${d===null?'—':d<0?'quá hạn':d+'n'}</span></div>`;}).join('')}
        </div></div>
    </div>`;

  /* ══ TAB 4 · TIỀN ══ */
  const tien=`
    <div class="grid2">
      <div class="panel"><div class="panel-h"><b>Ngân sách</b>
        <small>${BUDGET.length} khoản</small></div><div class="panel-b">
        <div class="mtr"><div><span>Kế hoạch</span><b>${mshort(plan)}</b></div>
          <div><span>Đã chi</span><b>${mshort(spent)}</b></div>
          <div><span>Còn lại</span><b style="color:var(--green)">${mshort(plan-spent)}</b></div>
          <div><span>Tỉ lệ dùng</span><b>${plan?Math.round(spent/plan*100):0}%</b></div></div>
        <div style="margin-top:12px">${(()=>{
          const cats={}; BUDGET.forEach(b=>{cats[b.cat]=cats[b.cat]||{p:0,s:0};
            cats[b.cat].p+=b.plan||0; cats[b.cat].s+=b.spent||0;});
          return Object.entries(cats).sort((a,b)=>b[1].p-a[1].p).slice(0,6).map(([k,v])=>{
            const pc=v.p?Math.round(v.s/v.p*100):0;
            return `<div class="prow"><span class="nm">${esc(k)}</span>
              <span class="ct">${mshort(v.s)}/${mshort(v.p)}</span>
              <span class="bar" style="flex:0 0 60px"><i class="${pc>100?'bad':pc>85?'warn':'ok'}"
                style="width:${Math.min(100,pc)}%"></i></span></div>`;}).join('');})()}</div>
        <button class="btn btn-gh btn-full" data-goto="budget">Mở ngân sách đầy đủ</button></div></div>

      <div class="panel"><div class="panel-h"><b>Quảng cáo</b>
        <small>${adRun.length} chiến dịch đang chạy</small></div><div class="panel-b">
        <div class="mtr"><div><span>Đã chi</span><b>${mshort(adSpent)}</b></div>
          <div><span>Doanh thu</span><b>${mshort(adRev)}</b></div>
          <div><span>ROAS</span><b style="color:${roasAll>=1?'var(--green)':'var(--red)'}">${roasAll.toFixed(2)}x</b></div>
          <div><span>Chuyển đổi</span><b>${nf(ADS.reduce((s,a)=>s+(a.conversions||0),0))}</b></div></div>
        <div style="margin-top:12px">${ADS.filter(a=>a.status==='Đang chạy').slice(0,5).map(a=>{
          const pc=a.budget?Math.round(a.spent/a.budget*100):0;
          return `<div class="prow" data-ad="${a.id}" style="cursor:pointer">
            <span class="nm">${esc(a.name)}</span>
            <span class="ct">${mshort(a.spent)}/${mshort(a.budget)}</span>
            <span class="bar" style="flex:0 0 60px"><i class="${pc>85?'warn':'ok'}" style="width:${Math.min(100,pc)}%"></i></span>
            </div>`;}).join('')||'<div class="empty">Không có chiến dịch nào đang chạy</div>'}</div>
        <button class="btn btn-gh btn-full" data-goto="ads">Mở quảng cáo đầy đủ</button></div></div>
    </div>

    <div class="panel"><div class="panel-h"><b>Rủi ro cần theo dõi</b>
      <small>${RISKS.filter(r=>r.status!=='Đã đóng').length} đang mở</small></div>
      <div>${RISKS.filter(r=>r.status!=='Đã đóng').slice(0,6).map(r=>`<div class="qrow">
        <span class="pill pill-s ${r.impact==='Cao'?'s-red':'s-amber'}">${esc(r.impact)}</span>
        <span class="qt" data-risk="${r.id}"><b>${esc(r.name)}</b>
          <small>${esc(r.owner||'')} · ${esc(r.status)}</small></span></div>`).join('')
        ||'<div class="empty">Chưa ghi nhận rủi ro nào</div>'}</div></div>`;

  const body={now:canXuLy,team:doiNgu,sx:sanXuat,tien:tien}[LTAB]||canXuLy;
  const canN=dND.length+dAP.length+yc.length;

  return ph('Leader Team',
    'Mọi thứ Leader cần theo dõi trong một chỗ — duyệt, đội ngũ, guồng sản xuất và tiền',
    `<span style="display:flex;gap:8px">
      <button class="btn btn-gh btn-sm" id="ltGiao">${icon('i-send')}Giao việc</button>
      <button class="btn btn-pri btn-sm" id="ltAdmin">${icon('i-shield')}Quản trị</button></span>`) + `
  <div class="statbar">
    ${[['i-check',canN?'amber':'green','Chờ tôi duyệt',canN],
       ['i-alert',lateP.length+lateT.length?'red':'green','Quá hạn',lateP.length+lateT.length],
       ['i-users','pri','Người quá tải',nguoi.filter(x=>x.tot>cap).length],
       ['i-doc',chuaNop.length?'amber':'green','Chưa nộp báo cáo',chuaNop.length],
       ['i-signal',hut.length?'amber':'green','Kênh hụt nhịp',hut.length]]
      .map(([ic,c,t,n])=>`<div class="stat s-${c} ${n?'':'zero'}">
        <span class="stat-i">${icon(ic)}</span><span class="stat-v">${n}</span>
        <span class="stat-t">${t}</span></div>`).join('')}
  </div>
  <div class="tabs">
    <button data-ltab="now" class="${LTAB==='now'?'on':''}">${icon('i-bell')}Cần xử lý${canN?' ('+canN+')':''}</button>
    <button data-ltab="team" class="${LTAB==='team'?'on':''}">${icon('i-users')}Đội ngũ</button>
    <button data-ltab="sx" class="${LTAB==='sx'?'on':''}">${icon('i-loop')}Guồng sản xuất</button>
    <button data-ltab="tien" class="${LTAB==='tien'?'on':''}">${icon('i-money')}Tiền &amp; rủi ro</button>
  </div>
  ${body}`;
}


/* ═══════════ PHÂN QUYỀN XEM MỤC MENU ═══════════ */
const MENU_LIST=[
  {g:'Hằng ngày',items:[
    ['dash','Trang chủ','i-grid',1],
    ['leader','Leader Team','i-target',0],
    ['reports','Báo cáo ngày','i-doc',1],
    ['assign','Duyệt & Giao việc','i-send',0],
    ['duty','Lịch trực nhật','i-cal',1]]},
  {g:'Vị trí công việc',items:[
    ['work','Content Marketing','i-pen',1],
    ['d-edit','Editor Video','i-film',1],
    ['d-design','Designer','i-brush',1]]},
  {g:'Nội dung & kênh',items:[
    ['cal','Lịch đăng','i-cal',1],
    ['channels','Kênh & chỉ số','i-signal',1]]},
  {g:'Dự án',items:[
    ['projects','Dự án','i-folder',1],
    ['tasks','Đầu việc','i-check',1],
    ['timeline','Tiến độ & đợt việc','i-time',1],
    ['risks','Rủi ro','i-alert',0]]},
  {g:'Ngân sách & quảng cáo',items:[
    ['ads','Quảng cáo','i-chart',0],
    ['budget','Ngân sách','i-money',0]]},
  {g:'Đội ngũ',items:[
    ['perf','Hiệu suất','i-target',0],
    ['team','Thành viên','i-users',1],
    ['org','Cơ cấu tổ chức','i-share',1],
    ['roles','Vai trò & quyền','i-cog',0],
    ['kudos','Ghi nhận đồng đội','i-heart',1],
    ['meets','Cuộc họp','i-meet',1]]},
  {g:'Hệ thống',items:[
    ['docs','Tài liệu','i-doc',1],
    ['activity','Nhật ký','i-loop',0],
    ['archive','Lưu trữ','i-box',0],
    ['setup','Cài đặt','i-cog',0],
    ['admin','Quản trị','i-shield',0]]},
];
const ALL_MENU=MENU_LIST.flatMap(g=>g.items.map(i=>i[0]));
/* Mặc định theo vai nếu chưa cấu hình riêng */
function defaultMenus(m){
  if(m.kind==='leader') return ALL_MENU.slice();
  const base=MENU_LIST.flatMap(g=>g.items.filter(i=>i[3]).map(i=>i[0]));
  if(m.kind==='design') return base.filter(v=>v!=='work');
  return base.filter(v=>!['d-edit','d-design'].includes(v));
}
function myMenus(m){
  m=m||ME; if(!m) return [];
  if(Array.isArray(m.menus)&&m.menus.length) return m.menus;
  if(typeof m.menus==='string'&&m.menus.startsWith('[')){
    try{const a=JSON.parse(m.menus); if(a.length) return a;}catch(e){}}
  return defaultMenus(m);
}
const seeMenu=v=>{
  if(!ME) return true;
  if(ME.kind==='leader') return true;
  const base=v.replace(/^p-\d+$/,'projects');
  return myMenus().includes(base)||['desk'].includes(base);
};
/* Ẩn mục trong thanh bên theo quyền */
function applyMenuPerm(){
  const ok=myMenus();
  document.querySelectorAll('.nav-i[data-view]').forEach(b=>{
    const v=b.dataset.view;
    b.style.display=(ME&&ME.kind==='leader')||ok.includes(v)?'':'none';
  });
  /* nhãn nhóm rỗng thì ẩn luôn */
  document.querySelectorAll('.side-lab').forEach(lab=>{
    let n=lab.nextElementSibling, has=false;
    while(n&&n.classList.contains('nav-i')){ if(n.style.display!=='none') has=true; n=n.nextElementSibling; }
    lab.style.display=has?'':'none';
  });
  document.querySelectorAll('.bn[data-view]').forEach(b=>{
    const v=b.dataset.view;
    b.style.display=(ME&&ME.kind==='leader')||ok.includes(v)||v==='desk'?'':'none';
  });
}

/* ═════════ QUẢN TRỊ — chỉ Leader ═════════ */
let ADTAB='tong';

function isAdmin(){ return can('role.manage') || (ME&&ME.kind==='leader'); }

/* Rà soát dữ liệu — tìm chỗ hổng trước khi thành vấn đề */
function healthCheck(){
  const H=[];
  const noOwner=TASKS.filter(t=>!t.owner&&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));
  if(noOwner.length) H.push({lv:'red',t:'Đầu việc chưa có người xử lý',n:noOwner.length,
    d:'Không ai biết mình phải làm — việc sẽ nằm im',go:'tasks'});
  const noBrief=POSTS.filter(p=>p.editor&&p.editor!=='Không cần'
    &&!(p.brief||p.brief_link)&&norm(p.status)==='Đang thiết kế');
  if(noBrief.length) H.push({lv:'red',t:'Bài đang ở thiết kế nhưng thiếu brief',n:noBrief.length,
    d:'Bên thiết kế không biết làm gì, phải hỏi lại',go:'work'});
  const stuck=POSTS.filter(p=>F(p.status).hold==='leader'&&!DONE.includes(p.status));
  if(stuck.length>3) H.push({lv:'amber',t:'Bài đang chờ Leader duyệt',n:stuck.length,
    d:'Khâu duyệt đang là nút thắt của cả phòng',go:'assign'});
  const lateT=TASKS.filter(lateTask), lateP=POSTS.filter(latePost);
  if(lateT.length+lateP.length) H.push({lv:'amber',t:'Việc và bài quá hạn',n:lateT.length+lateP.length,
    d:'Cần rà lại hạn hoặc chia bớt việc',go:'tasks'});
  const cap=+(SET.load_max||14);
  const over=MEMBERS.filter(m=>{
    const n=TASKS.filter(t=>(t.owner||'').includes(m.name)
      &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t))).length
      +POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name)).length;
    return n>cap;});
  if(over.length) H.push({lv:'amber',t:'Người đang quá tải',n:over.length,
    d:over.map(m=>m.name).join(', '),go:'team'});
  const noRole=MEMBERS.filter(m=>!ROLES.some(r=>r.name===m.role));
  if(noRole.length) H.push({lv:'red',t:'Nhân sự có vai trò ngoài ma trận quyền',n:noRole.length,
    d:noRole.map(m=>m.name+' ('+m.role+')').join(', ')+' — hiện không có quyền nào',go:'roles'});
  const noCh=CHANNELS.filter(c=>!c.owner_content);
  if(noCh.length) H.push({lv:'amber',t:'Kênh chưa có người phụ trách',n:noCh.length,
    d:noCh.map(c=>c.name).join(', '),go:'channels'});
  const badBud=BUDGET.filter(b=>(b.spent||0)>(b.plan||0));
  if(badBud.length) H.push({lv:'red',t:'Khoản ngân sách đã vượt kế hoạch',n:badBud.length,
    d:badBud.map(b=>b.name).join(', '),go:'budget'});
  const days=[]; for(let i=6;i>=0;i--){const d=new Date(D0());d.setDate(d.getDate()-i);days.push(iso(d));}
  const rate=Math.round(REPORTS.filter(r=>days.includes(r.date)&&r.status!=='Chưa nộp').length
    /Math.max(1,days.length*MEMBERS.length)*100);
  if(rate<70) H.push({lv:'amber',t:'Tỉ lệ nộp báo cáo ngày thấp',n:rate+'%',
    d:'Nếp báo cáo chưa thành hình, số liệu hệ thống sẽ không đáng tin',go:'reports'});
  return H;
}

function viewAdmin(){
  if(!isAdmin()) return ph('Quản trị','')+
    `<div class="panel"><div class="empty">${icon('i-alert')}<br><br>
      Chỉ Leader mới vào được mục này.<br>
      Vai trò <b>${esc(myRole())}</b> không có quyền quản trị.</div></div>`;

  const H=healthCheck();
  const doTable=[['Dự án',PROJECTS.length,'projects','i-folder'],['Đầu việc',TASKS.length,'tasks','i-check'],
    ['Bài đăng',POSTS.length,'work','i-pen'],['Kênh',CHANNELS.length,'channels','i-signal'],
    ['Chiến dịch QC',ADS.length,'ads','i-chart'],['Khoản ngân sách',BUDGET.length,'budget','i-money'],
    ['Rủi ro',RISKS.length,'risks','i-alert'],['Tài liệu',DOCS.length,'docs','i-doc'],
    ['Cuộc họp',MEETS.length,'meets','i-meet'],['Báo cáo ngày',REPORTS.length,'reports','i-doc'],
    ['Đợt công việc',SPRINTS.length,'timeline','i-bolt'],
    ['Đã lưu trữ',ALL_TASKS.filter(x=>x.archived).length+ALL_POSTS.filter(x=>x.archived).length,'archive','i-box']];

  /* ── Tab Tổng quan: dashboard phân tích ── */
  const D14=[]; for(let i=13;i>=0;i--){const d=new Date(D0());d.setDate(d.getDate()-i);D14.push(iso(d));}
  const D7=D14.slice(7), P7=D14.slice(0,7);
  const lb=D14.map((k,i)=>i%2?'':new Date(k).getDate()+'/'+(new Date(k).getMonth()+1));

  /* Sản lượng theo ngày: việc xong + bài đăng */
  const outDay=D14.map(k=>
    ALL_TASKS.filter(t=>t.due===k&&tgrp(t)==='Hoàn thành').length
    +ALL_POSTS.filter(p=>p.pub_date===k&&p.status==='Đã đăng').length);
  const out7=outDay.slice(7).reduce((a,b)=>a+b,0), outP7=outDay.slice(0,7).reduce((a,b)=>a+b,0);

  /* Báo cáo theo ngày */
  const repDay=D14.map(k=>REPORTS.filter(r=>r.date===k&&r.status!=='Chưa nộp').length);
  const rep7=repDay.slice(7).reduce((a,b)=>a+b,0), repP7=repDay.slice(0,7).reduce((a,b)=>a+b,0);
  const repRate=Math.round(rep7/Math.max(1,7*MEMBERS.length)*100);

  /* Bài đăng theo ngày, tách theo mảng */
  const stack=D14.map(k=>({
    tiktok:ALL_POSTS.filter(p=>p.pub_date===k&&p.stream==='tiktok').length,
    social:ALL_POSTS.filter(p=>p.pub_date===k&&p.stream!=='tiktok').length}));

  /* Tỉ lệ hoàn thành và đúng hạn */
  const actT=TASKS.filter(t=>tgrp(t)!=='Không áp dụng');
  const doneT=actT.filter(t=>tgrp(t)==='Hoàn thành').length;
  const pcDone=actT.length?Math.round(doneT/actT.length*100):0;
  const pcOn=actT.length?Math.round((actT.length-TASKS.filter(lateTask).length)/actT.length*100):0;
  const postedN=POSTS.filter(p=>p.status==='Đã đăng').length;
  const pcPost=POSTS.length?Math.round(postedN/POSTS.length*100):0;

  /* Khối lượng theo người */
  const perMem=MEMBERS.map(m=>{
    const tk=TASKS.filter(t=>(t.owner||'').includes(m.name)&&tgrp(t)!=='Không áp dụng');
    const dn=tk.filter(t=>tgrp(t)==='Hoàn thành').length;
    const op=POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name)).length;
    const lt=tk.filter(lateTask).length+POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name)&&latePost(p)).length;
    return {m,tk:tk.length,dn,op,lt,pc:tk.length?Math.round(dn/tk.length*100):0,
      spark:D7.map(k=>ALL_TASKS.filter(t=>(t.owner||'').includes(m.name)&&t.due===k&&tgrp(t)==='Hoàn thành').length)};
  }).sort((a,b)=>b.dn-a.dn);
  const mxTk=Math.max(1,...perMem.map(x=>x.tk));

  /* Guồng sản xuất */
  const openP2=POSTS.filter(p=>!DONE.includes(p.status));
  const stages=['Đang viết','Chờ duyệt nội dung','Đang thiết kế','Chờ duyệt ấn phẩm','Chờ đăng'];
  const stageN=stages.map(st=>openP2.filter(p=>norm(p.status)===st).length);
  const nghen=stages[stageN.indexOf(Math.max(...stageN))];

  /* Lưới nhiệt 8 tuần */
  const HD=[]; for(let i=55;i>=0;i--){const d=new Date(D0());d.setDate(d.getDate()-i);
    const k=iso(d);
    HD.push({t:fdate2(k),v:ALL_TASKS.filter(t=>t.due===k&&tgrp(t)==='Hoàn thành').length
      +ALL_POSTS.filter(p=>p.pub_date===k&&p.status==='Đã đăng').length});}

  const tongQuan=`
    <div class="anly">
      ${[['Sản lượng 7 ngày',out7,outP7,'#6D4AFF',outDay.slice(7),'việc xong + bài đăng'],
         ['Báo cáo đã nộp',rep7,repP7,'#12855A',repDay.slice(7),repRate+'% tỉ lệ nộp'],
         ['Bài đăng lên sóng',ALL_POSTS.filter(p=>D7.includes(p.pub_date)&&p.status==='Đã đăng').length,
          ALL_POSTS.filter(p=>P7.includes(p.pub_date)&&p.status==='Đã đăng').length,'#0E7490',
          D7.map(k=>ALL_POSTS.filter(p=>p.pub_date===k&&p.status==='Đã đăng').length),'trong 7 ngày'],
         ['Việc quá hạn',TASKS.filter(lateTask).length+POSTS.filter(latePost).length,null,'#D03535',
          D7.map(k=>ALL_TASKS.filter(t=>t.due===k&&lateTask(t)).length),'cần xử lý ngay',1]]
        .map(([t,n,p,c,sp,f,inv])=>`<div class="anly-c">
          <div class="anly-t">${esc(t)}${delta(n,p,inv)}</div>
          <div class="anly-v" style="color:${c}">${n}</div>
          <div class="anly-f">${esc(f)}</div>
          <div class="anly-s">${spark(sp,c)}</div></div>`).join('')}
    </div>

    <div class="g21">
      <div class="panel"><div class="panel-h"><b>Sản lượng 14 ngày</b>
        <small>việc hoàn thành và bài đăng mỗi ngày</small></div>
        <div class="panel-b">${areaChart(outDay,{labels:lb})}
          <div style="font-size:11.5px;color:var(--ink3);margin-top:6px;line-height:1.6">
            Tuần này <b style="color:var(--ink)">${out7}</b> so với tuần trước
            <b style="color:var(--ink)">${outP7}</b>${out7>=outP7
              ?' — đang giữ hoặc tăng nhịp.':' — nhịp đang chậm lại.'}</div></div></div>
      <div class="panel"><div class="panel-h"><b>Tỉ lệ hoàn tất</b></div>
        <div class="panel-b"><div class="gauges">
          ${gauge(pcDone,'đầu việc','#6D4AFF')}
          ${gauge(pcOn,'đúng hạn',pcOn>=80?'#12855A':'#B26A00')}
          ${gauge(pcPost,'bài đã đăng','#0E7490')}
        </div></div></div>
    </div>

    <div class="g21">
      <div class="panel"><div class="panel-h"><b>Nhịp đăng bài theo mảng</b>
        <small><span class="lg" style="--c:#111827"></span>TikTok
          <span class="lg" style="--c:#1F63C7;margin-left:12px"></span>Kênh khác</small></div>
        <div class="panel-b">${stackChart(stack,['tiktok','social'],['#111827','#1F63C7'],lb)}</div></div>
      <div class="panel"><div class="panel-h"><b>Guồng sản xuất</b>
        <small>${openP2.length} bài đang chạy</small></div>
        <div class="panel-b">
          ${stages.map((st,i)=>{const n=stageN[i];
            const mx=Math.max(1,...stageN);
            return `<div class="prow"><span class="nm">${(FLOW.find(x=>x.s===st)||{}).ic||''} ${esc(st)}</span>
              <span class="ct">${n}</span>
              <span class="bar" style="flex:0 0 80px"><i class="${st===nghen&&n>2?'warn':''}"
                style="width:${Math.round(n/mx*100)}%"></i></span></div>`;}).join('')}
          <div style="font-size:11.5px;color:var(--ink3);margin-top:10px;line-height:1.6">
            ${Math.max(...stageN)>2?`Đang dồn ở <b style="color:var(--amber)">${esc(nghen)}</b>.`
              :'Không chặng nào bị dồn.'}</div></div></div>
    </div>

    <div class="panel"><div class="panel-h"><b>Năng suất từng người</b>
      <small>7 ngày gần nhất</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:170px">Thành viên</th><th style="min-width:130px">Khối lượng</th>
        <th>Đã xong</th><th>Bài đang giữ</th><th>Trễ</th>
        <th style="min-width:110px">Nhịp 7 ngày</th><th style="min-width:100px">Hoàn thành</th></tr></thead><tbody>
        ${perMem.map(x=>`<tr data-who="${esc(x.m.name)}">
          <td><div class="whorow">${avat(x.m.name)}<span><b>${esc(x.m.name)}</b>
            <small>${esc(x.m.role)}</small></span></div></td>
          <td><div class="prow" style="border:0;padding:0">
            <span class="bar" style="flex:1"><i style="width:${Math.round(x.tk/mxTk*100)}%"></i></span>
            <span class="pct">${x.tk}</span></div></td>
          <td><b>${x.dn}</b></td><td>${x.op}</td>
          <td>${x.lt?`<span class="pill pill-s s-red">${x.lt}</span>`:'<span style="color:var(--ink3)">0</span>'}</td>
          <td>${spark(x.spark,'#6D4AFF')}</td>
          <td><span class="pill pill-s ${x.pc>=80?'s-green':x.pc>=50?'s-amber':'s-red'}">${x.pc}%</span></td>
        </tr>`).join('')}
      </tbody></table></div></div>

    <div class="g21">
      <div class="panel"><div class="panel-h"><b>Mức hoạt động 8 tuần</b>
        <small>ô càng đậm càng nhiều việc hoàn tất</small></div>
        <div class="panel-b">${heat(HD)}
          <div class="heatlg"><span>Ít</span>
            ${[0,1,2,3,4].map(l=>`<span class="hc l${l}"></span>`).join('')}<span>Nhiều</span></div></div></div>
      <div class="panel"><div class="panel-h">
        <b>${icon(H.length?'i-alert':'i-check')} Rà soát hệ thống</b>
        <small>${H.length?H.length+' điểm':'không có vấn đề'}</small></div>
        <div>${H.length?H.map(x=>`<div class="hrow ${x.lv}" data-goto="${x.go}">
          <span class="h-i">${icon(x.lv==='red'?'i-alert':'i-clock')}</span>
          <span class="h-t"><b>${esc(x.t)}</b><small>${esc(x.d)}</small></span>
          <span class="h-n">${x.n}</span></div>`).join('')
          :`<div class="empty">${icon('i-check')}<br><br>Mọi thứ đang ổn.</div>`}</div></div>
    </div>

    <div class="panel"><div class="panel-h"><b>${icon('i-box')} Dữ liệu hệ thống</b>
      <small>bấm để mở mục tương ứng</small></div>
      <div class="panel-b"><div class="dgrid">
        ${doTable.map(([t,n,v])=>`<div class="dcell2" data-goto="${v}">
          <span>${t}</span><b>${n}</b></div>`).join('')}
      </div></div></div>`;

  /* ── Tab Nhân sự ── */
  const nhanSu=`
    <div class="panel"><div class="panel-h"><b>Tài khoản &amp; quyền</b>
      <small>${MEMBERS.length} người</small></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:180px">Thành viên</th><th>Vai trò</th><th>Quản lý</th>
        <th>Mã PIN</th><th>Số quyền</th><th>Đang giữ</th><th>Thao tác</th></tr></thead><tbody>
        ${MEMBERS.map(m=>{
          const nperm=PERMS.filter(p=>(p.vals||{})[m.role]&&p.vals[m.role]!=='Không').length;
          const busy=TASKS.filter(t=>(t.owner||'').includes(m.name)
            &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t))).length
            +POSTS.filter(p=>!DONE.includes(p.status)&&holds(p,m.name)).length;
          const bad=!ROLES.some(r=>r.name===m.role);
          return `<tr><td><div class="whorow">${avat(m.name)}<span><b>${esc(m.name)}</b>
            <small>${esc(m.dept||'')}</small></span></div></td>
            <td>${bad?`<span class="pill s-red">${esc(m.role)}</span>`:esc(m.role)}</td>
            <td>${m.manager?esc(m.manager):'<span style="color:var(--ink3)">—</span>'}</td>
            <td><code class="pincode">${esc(m.pin||'')}</code></td>
            <td>${nperm}/${PERMS.length}</td>
            <td>${busy}</td>
            <td><span style="display:flex;gap:5px">
              <button class="btn btn-gh btn-sm" data-medit="${m.id}">Sửa</button>
              <button class="btn btn-gh btn-sm" data-ava="${m.id}">Ảnh</button>
              <button class="btn btn-gh btn-sm" data-pin="${m.id}">Đổi PIN</button></span></td></tr>`;}).join('')}
      </tbody></table></div>
      <div class="panel-b" style="border-top:1px solid var(--line)">
        <button class="btn btn-pri btn-full" id="adNewMem" style="margin:0">${icon('i-plus')}Thêm nhân sự</button></div></div>

    <div class="panel"><div class="panel-h"><b>Phân quyền nhanh</b>
      <small>bật tắt quyền quan trọng</small></div>
      <div class="panel-b">
        ${['task.delete','project.manage','budget.edit','member.manage','role.manage','post.approve']
          .map(k=>{const p=PERMS.find(x=>x.key===k); if(!p) return '';
          const on=ROLES.filter(r=>(p.vals||{})[r.name]&&p.vals[r.name]!=='Không').map(r=>r.name);
          return `<div class="prow"><span class="nm">${esc(p.name)}</span>
            <span class="ct">${on.length?on.map(x=>esc(x.replace('Content Marketing','CM'))).join(', '):'không ai'}</span>
            </div>`;}).join('')}
        <button class="btn btn-gh btn-full" id="adRoles">${icon('i-cog')}Mở ma trận phân quyền đầy đủ</button>
      </div></div>`;

  /* ── Tab Dọn dẹp ── */
  const arT=ALL_TASKS.filter(x=>x.archived).length, arP=ALL_POSTS.filter(x=>x.archived).length;
  const xongT=TASKS.filter(t=>tgrp(t)==='Hoàn thành').length;
  const donePold=POSTS.filter(p=>p.status==='Đã đăng'&&dd(p.pub_date)<-30).length;
  const donDep=`
    <div class="panel"><div class="panel-h"><b>${icon('i-box')} Dọn bớt cho gọn</b>
      <small>lưu trữ vẫn khôi phục được, xoá thì mất hẳn</small></div>
      <div class="panel-b">
        <div class="cleanrow"><span class="cl-t"><b>Đầu việc đã hoàn thành</b>
          <small>${xongT} việc — lưu trữ để danh sách gọn lại</small></span>
          <button class="btn btn-gh btn-sm" id="clDoneTask" ${xongT?'':'disabled'}>Lưu trữ hết</button></div>
        <div class="cleanrow"><span class="cl-t"><b>Bài đã đăng quá 30 ngày</b>
          <small>${donePold} bài — số liệu vẫn giữ trong báo cáo</small></span>
          <button class="btn btn-gh btn-sm" id="clOldPost" ${donePold?'':'disabled'}>Lưu trữ hết</button></div>
        <div class="cleanrow"><span class="cl-t"><b>Đang trong lưu trữ</b>
          <small>${arT} đầu việc, ${arP} bài đăng</small></span>
          <button class="btn btn-gh btn-sm" data-goto="archive">Mở lưu trữ</button></div>
      </div></div>

    <div class="panel"><div class="panel-h"><b>${icon('i-doc')} Xuất dữ liệu</b>
      <small>tải về máy dạng CSV, mở được bằng Excel</small></div>
      <div class="panel-b"><div class="dgrid">
        ${[['Đầu việc','tasks'],['Bài đăng','posts'],['Nhân sự','members'],['Kênh','channels'],
           ['Ngân sách','budget'],['Báo cáo ngày','reports']].map(([t,k])=>
          `<div class="dcell2" data-export="${k}"><span>${t}</span>
            <b style="font-size:13px">${icon('i-doc')}</b></div>`).join('')}
      </div>
      <div style="font-size:11.5px;color:var(--ink3);margin-top:10px;line-height:1.6">
        Nên xuất định kỳ mỗi tháng để có bản sao lưu ngoài hệ thống.</div></div></div>

    <div class="panel" style="border:1px solid #F3C9C9"><div class="panel-h">
      <b style="color:var(--red)">${icon('i-alert')} Vùng nguy hiểm</b>
      <small>không khôi phục lại được</small></div>
      <div class="panel-b">
        <div class="cleanrow"><span class="cl-t"><b>Xoá sạch nhật ký hoạt động</b>
          <small>Lịch sử ai đổi gì sẽ mất hết</small></span>
          <button class="btn btn-gh btn-sm danger" id="clLog">Xoá nhật ký</button></div>
        <div class="cleanrow"><span class="cl-t"><b>Xoá vĩnh viễn mục đã lưu trữ</b>
          <small>${arT+arP} mục trong lưu trữ sẽ bị xoá hẳn</small></span>
          <button class="btn btn-gh btn-sm danger" id="clPurge" ${arT+arP?'':'disabled'}>Xoá hẳn</button></div>
      </div></div>`;

  /* ── Tab Phân quyền menu ── */
  const menuTab=`
    <div class="panel"><div class="panel-h"><b>${icon('i-grid')} Ai xem được mục nào</b>
      <small>tích để cho phép · Leader luôn xem được tất cả</small></div>
      <div class="tbl-wrap"><table class="tbl mtbl"><thead><tr>
        <th style="min-width:220px">Mục trong thanh bên</th>
        ${MEMBERS.map(m=>`<th style="min-width:96px;text-align:center">
          <div class="mth">${avat(m.name)}<span>${esc(m.short_name||m.name.split(' ').slice(-1)[0])}</span></div>
        </th>`).join('')}</tr></thead><tbody>
        ${MENU_LIST.map(g=>`<tr class="pgroup"><td colspan="${MEMBERS.length+1}">${esc(g.g)}</td></tr>
          ${g.items.map(([v,t,ic])=>`<tr>
            <td class="tt"><span style="display:flex;align-items:center;gap:9px">
              ${icon(ic)}${esc(t)}</span></td>
            ${MEMBERS.map(m=>{
              const on=m.kind==='leader'||myMenus(m).includes(v);
              const lock=m.kind==='leader';
              return `<td style="text-align:center">
                <label class="pchk ${lock?'lock':''}"><input type="checkbox"
                  data-mv="${esc(v)}" data-mm="${m.id}" ${on?'checked':''} ${lock?'disabled':''}>
                  <span></span></label></td>`;}).join('')}
          </tr>`).join('')}`).join('')}
      </tbody></table></div>
      <div class="panel-b" style="border-top:1px solid var(--line);display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn btn-gh btn-sm" id="mnReset">${icon('i-loop')}Về mặc định theo vai</button>
        <button class="btn btn-pri btn-sm" id="mnSave" style="margin-left:auto">${icon('i-check')}Lưu phân quyền</button>
      </div></div>

    <div class="panel"><div class="panel-h"><b>Xem trước thanh bên của từng người</b></div>
      <div class="panel-b"><div class="prevgrid">
        ${MEMBERS.map(m=>{const l=m.kind==='leader'?ALL_MENU:myMenus(m);
          return `<div class="prevcard">
            <div class="prev-h">${avat(m.name)}<span><b>${esc(m.name)}</b>
              <small>${l.length}/${ALL_MENU.length} mục</small></span></div>
            <div class="prev-l">${MENU_LIST.flatMap(g=>g.items).filter(i=>l.includes(i[0]))
              .slice(0,10).map(i=>`<span class="prev-i">${icon(i[2])}${esc(i[1])}</span>`).join('')}
              ${l.length>10?`<span class="prev-i more">còn ${l.length-10} mục nữa</span>`:''}</div>
          </div>`;}).join('')}
      </div></div></div>`;

  const body={tong:tongQuan,nhansu:nhanSu,menu:menuTab,dondep:donDep}[ADTAB]||tongQuan;
  const red=H.filter(x=>x.lv==='red').length;

  return ph('Quản trị','Bàn điều khiển của Leader — rà soát, phân quyền, dọn dẹp và sao lưu') + `
  <div class="statbar">
    ${[['i-alert',red?'red':'green','Điểm cần chú ý',H.length],
       ['i-users','pri','Thành viên',MEMBERS.length],
       ['i-check','blue','Đầu việc',TASKS.length],
       ['i-pen','teal','Bài đăng',POSTS.length],
       ['i-box','gray','Đã lưu trữ',arT+arP]]
      .map(([ic,c,t,n])=>`<div class="stat s-${c} ${n?'':'zero'}">
        <span class="stat-i">${icon(ic)}</span><span class="stat-v">${n}</span>
        <span class="stat-t">${t}</span></div>`).join('')}
  </div>
  <div class="tabs">
    <button data-adtab="tong" class="${ADTAB==='tong'?'on':''}">${icon('i-grid')}Tổng quan${H.length?' ('+H.length+')':''}</button>
    <button data-adtab="nhansu" class="${ADTAB==='nhansu'?'on':''}">${icon('i-users')}Nhân sự &amp; quyền</button>
    <button data-adtab="menu" class="${ADTAB==='menu'?'on':''}">${icon('i-grid')}Phân quyền menu</button>
    <button data-adtab="dondep" class="${ADTAB==='dondep'?'on':''}">${icon('i-box')}Dọn dẹp &amp; sao lưu</button>
  </div>
  ${body}`;
}

/* Đổi PIN nhanh */
function pinForm(id){
  const m=MEMBERS.find(x=>x.id===id); if(!m) return;
  openDrawer(`<div class="dr-code">Đổi mã PIN</div>
    <div class="dr-title">${esc(m.name)}</div>
    <div class="dr-meta">${esc(m.role)} · PIN hiện tại <code class="pincode">${esc(m.pin||'')}</code></div>
    <div class="dr-lab">Mã PIN mới</div>
    <input type="text" id="pinNew" class="fld" maxlength="6" inputmode="numeric"
      placeholder="4 chữ số" value="">
    <div style="font-size:11.5px;color:var(--ink3);margin-top:8px;line-height:1.6">
      Nhớ báo lại cho ${esc(m.name.split(' ').slice(-1)[0])} sau khi đổi.
      PIN chỉ là lớp chặn nhẹ, đừng dùng số dễ đoán như 1234.</div>
    <button class="btn btn-pri btn-full" id="pinSave">Đổi PIN</button>`);
  document.getElementById('pinSave').onclick=()=>{
    const v=V('pinNew');
    if(!/^\d{4,6}$/.test(v)){toast('PIN phải là 4 tới 6 chữ số');return;}
    save('members',id,{pin:v},'Đã đổi PIN cho '+m.name);
  };
}

/* Xuất CSV */
function xuatCSV(kind){
  const src={tasks:TASKS,posts:POSTS,members:MEMBERS,channels:CHANNELS,
    budget:BUDGET,reports:REPORTS}[kind]||[];
  if(!src.length){toast('Không có dữ liệu để xuất');return;}
  const cols=[...new Set(src.flatMap(r=>Object.keys(r)))].filter(c=>c!=='id');
  const esc2=v=>{ if(v==null) return '';
    if(typeof v==='object') v=JSON.stringify(v);
    v=String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  const csv='\ufeff'+[cols.join(','),...src.map(r=>cols.map(c=>esc2(r[c])).join(','))].join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='kitachi-'+kind+'-'+iso(new Date())+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Đã tải xuống '+src.length+' dòng');
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
  /* ─── Nút hành động nhanh trên từng dòng ─── */
  const quickAct=async(code,id)=>{
    const TD=iso(new Date());
    const p=POSTS.find(x=>x.id===id);
    if(!p){toast('Không tìm thấy bài này');return;}
    const key=code.replace(/^(qk|wk)-/,'');
    if(key==='give'){ handoffForm(p); return; }
    const M={
      take:  [{design_started:TD,editor:p.editor||ME.name},'Đã nhận việc — bắt đầu làm'],
      send:  [{status:'Chờ duyệt ấn phẩm',design_done:TD},'Đã gửi '+LEADER()+' duyệt'],
      tosub: [{status:'Chờ duyệt nội dung'},'Đã gửi '+LEADER()+' duyệt nội dung'],
      sub:   [{status:'Chờ duyệt nội dung'},'Đã gửi '+LEADER()+' duyệt nội dung'],
      appr:  [{status:'Đang thiết kế',editor:null,approved:ME.name},'Đã duyệt nội dung'],
      pub:   [{status:'Đã đăng'},'Đã đánh dấu đăng lên nền tảng'],
    }[key];
    if(!M){ console.warn('Không rõ hành động:',code); toast('Chưa xử lý được hành động này'); return; }
    await save('posts',id,M[0],M[1]);
  };
  on('[data-q]', e=>{const [a,i]=e.dataset.q.split(':'); quickAct(a,+i);});
  on('[data-q2]',e=>{const [a,i]=e.dataset.q2.split(':'); quickAct(a,+i);});
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
  on('[data-wwho]',e=>{WWHO=e.dataset.wwho; render();});
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
  on('[data-fstage]',()=>go('work'));
  on('[data-giao]',e=>giaoViec(e.dataset.giao));
  on('[data-tstart]',e=>save('tasks',+e.dataset.tstart,{status:'Đang làm'},'Đã bắt đầu làm'));
  on('[data-ok-nd]',e=>save('posts',+e.dataset.okNd,
    {status:'Đang thiết kế',editor:null,design_started:null,approved:ME.name},
    'Đã duyệt nội dung — Content chọn người thiết kế'));
  on('[data-assign-nd]',e=>{const p=POSTS.find(x=>x.id===+e.dataset.assignNd); if(p) handoffForm(p);});
  on('[data-fix-nd]',e=>save('posts',+e.dataset.fixNd,{status:'Cần sửa nội dung'},'Đã trả lại Content sửa'));
  on('[data-ok-ap]',e=>save('posts',+e.dataset.okAp,{status:'Chờ đăng',approved:ME.name},
    'Đã duyệt — chuyển Content đăng bài'));
  on('[data-fix-ap]',e=>save('posts',+e.dataset.fixAp,{status:'Cần sửa ấn phẩm'},'Đã trả lại thiết kế sửa'));
  document.querySelectorAll('[data-astab]').forEach(b=>b.onclick=()=>{ASTAB=b.dataset.astab;render();});
  document.querySelectorAll('[data-adtab]').forEach(b=>b.onclick=()=>{ADTAB=b.dataset.adtab;render();});
  document.querySelectorAll('[data-ltab]').forEach(b=>b.onclick=()=>{LTAB=b.dataset.ltab;render();});
  if(b('ltGiao')) b('ltGiao').onclick=()=>go('assign');
  if(b('ltAdmin')) b('ltAdmin').onclick=()=>go('admin');
  on('[data-pin]',e=>pinForm(+e.dataset.pin));
  on('[data-ava]',e=>avatarForm(+e.dataset.ava));
  on('[data-export]',e=>xuatCSV(e.dataset.export));
  if(b('adNewMem')) b('adNewMem').onclick=()=>editMember(null);
  if(b('adRoles')) b('adRoles').onclick=()=>go('roles');
  if(b('mnSave')) b('mnSave').onclick=async()=>{
    const map={};
    document.querySelectorAll('[data-mv]').forEach(c=>{
      const id=+c.dataset.mm; map[id]=map[id]||[];
      if(c.checked) map[id].push(c.dataset.mv);});
    let n=0;
    for(const m of MEMBERS){
      if(m.kind==='leader') continue;
      const cur=map[m.id]||[];
      if(JSON.stringify(cur)!==JSON.stringify(myMenus(m))){
        await sb.from('members').update({menus:cur,updated_by:ME.name}).eq('id',m.id); n++;}}
    toast(n?`Đã cập nhật quyền xem cho ${n} người`:'Không có thay đổi nào'); await loadAll();};
  if(b('mnReset')) b('mnReset').onclick=async()=>{
    if(!confirm('Đưa quyền xem của mọi người về mặc định theo vai trò?'))return;
    for(const m of MEMBERS){ if(m.kind==='leader') continue;
      await sb.from('members').update({menus:null,updated_by:ME.name}).eq('id',m.id);}
    toast('Đã về mặc định'); await loadAll();};
  if(b('clDoneTask')) b('clDoneTask').onclick=async()=>{
    const l=TASKS.filter(t=>tgrp(t)==='Hoàn thành');
    if(!confirm('Đưa '+l.length+' đầu việc đã hoàn thành vào lưu trữ?'))return;
    for(const t of l) await sb.from('tasks').update({archived:true,updated_by:ME.name}).eq('id',t.id);
    toast('Đã lưu trữ '+l.length+' đầu việc'); await loadAll();};
  if(b('clOldPost')) b('clOldPost').onclick=async()=>{
    const l=POSTS.filter(p=>p.status==='Đã đăng'&&dd(p.pub_date)<-30);
    if(!confirm('Đưa '+l.length+' bài đã đăng quá 30 ngày vào lưu trữ?'))return;
    for(const p of l) await sb.from('posts').update({archived:true,updated_by:ME.name}).eq('id',p.id);
    toast('Đã lưu trữ '+l.length+' bài'); await loadAll();};
  if(b('clLog')) b('clLog').onclick=async()=>{
    if(!confirm('Xoá sạch nhật ký hoạt động? Không khôi phục lại được.'))return;
    const {data}=await sb.from('activity').select('*').limit(500);
    for(const a of (data||[])) await sb.from('activity').delete().eq('id',a.id);
    toast('Đã xoá nhật ký'); await loadAll();};
  if(b('clPurge')) b('clPurge').onclick=async()=>{
    const lt=ALL_TASKS.filter(x=>x.archived), lp=ALL_POSTS.filter(x=>x.archived);
    if(!confirm('Xoá vĩnh viễn '+(lt.length+lp.length)+' mục trong lưu trữ?\nKhông khôi phục lại được.'))return;
    for(const t of lt) await sb.from('tasks').delete().eq('id',t.id);
    for(const p of lp) await sb.from('posts').delete().eq('id',p.id);
    toast('Đã xoá vĩnh viễn'); await loadAll();};
  if(b('asNew')) b('asNew').onclick=()=>giaoViec(null);
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
  if(b('wAll')) b('wAll').onclick=()=>{WCH=0;render();};
  if(b('wNew')) b('wNew').onclick=()=>openNewPost(WCH?(CHANNELS.find(c=>c.id===WCH)||{}).name:null);
  if(b('wSelf')) b('wSelf').onclick=()=>themViecCuaToi();
  if(b('dkSelf')) b('dkSelf').onclick=()=>themViecCuaToi(
    (MEMBERS.find(m=>m.name===ME.name)||{}).kind==='design'?'Thiết kế':'Content');
  if(b('dkNewPost')) b('dkNewPost').onclick=()=>openNewPost(null);
  if(b('mkSelf')) b('mkSelf').onclick=()=>themViecCuaToi('Thiết kế');
  if(b('mkPost')) b('mkPost').onclick=()=>openNewPost(null);
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
function openPost(id){
  const p=POSTS.find(x=>x.id===id); if(!p) return;
  const st=norm(p.status), f=F(p.status);
  const h=holder(p), late=latePost(p);
  const hrs=hoursLeft(p.pub_date,p.pub_time);
  const meD=(MEMBERS.find(m=>m.name===ME.name)||{}).kind==='design';

  /* Một hành động chính duy nhất, đúng bước tiếp theo của người đang xem */
  let main=null;
  const isW=p.writer===ME.name, isE=p.editor===ME.name;
  /* Duyệt được không — xét cả phạm vi: Toàn hệ thống, hay chỉ người mình quản lý */
  const inTeam=n=>MEMBERS.some(m=>m.manager===ME.name&&m.name===n);
  const scOK=(key,n)=>{const sc=scopeOf(key);
    return sc==='Toàn hệ thống'||sc==='Cho phép'||(sc==='Trong nhóm'&&inTeam(n));};
  const canND=can('post.approve')&&scOK('post.approve',p.writer);
  const canAP=can('design.approve')&&scOK('design.approve',p.editor);
  if(isW&&['Đang viết','Cần sửa nội dung'].includes(st)) main=['pkToLeader','Gửi Leader duyệt nội dung','i-send'];
  else if(canND&&st==='Chờ duyệt nội dung') main=['pkOkND','Duyệt nội dung','i-check'];
  else if(isW&&st==='Đang thiết kế'&&!p.editor) main=['pkGive','Chọn người thiết kế','i-send'];
  else if(meD&&st==='Đang thiết kế'&&!p.editor) main=['pkClaim','Tôi nhận việc này','i-hand'];
  else if(isE&&st==='Đang thiết kế'&&!p.design_started) main=['pkTake','Bắt đầu làm','i-hand'];
  else if(isE&&['Đang thiết kế','Cần sửa ấn phẩm'].includes(st)) main=['pkSend','Làm xong — gửi Leader duyệt','i-check'];
  else if(canAP&&st==='Chờ duyệt ấn phẩm') main=['pkOkAP','Duyệt — cho đăng bài','i-check'];
  else if(isW&&st==='Chờ đăng') main=['pkPub','Đã đăng lên nền tảng','i-check'];

  /* Nút phụ */
  let sub='';
  const sb2=(i,t,ic)=>`<button class="subact" id="${i}">${icon(ic)}${t}</button>`;
  if(canND&&st==='Chờ duyệt nội dung'){ sub+=sb2('pkAssign','Duyệt & giao thẳng thiết kế','i-send');
    sub+=sb2('pkFixND','Trả lại Content sửa','i-loop'); }
  if(canAP&&st==='Chờ duyệt ấn phẩm') sub+=sb2('pkFixAP','Trả lại thiết kế sửa','i-loop');
  if(meD&&['Đang thiết kế','Cần sửa ấn phẩm'].includes(st)) sub+=sb2('pkSwap','Chuyển cho người khác','i-share');

  const steps=['Đang viết','Chờ duyệt nội dung','Đang thiết kế','Chờ duyệt ấn phẩm','Chờ đăng','Đã đăng'];
  const cur=steps.indexOf(st);

  openDrawer(`
    <div class="dr-code">${esc(p.channel||'')}${p.fmt?' · '+esc(p.fmt):''}</div>
    <div class="dr-title">${esc(p.title)}</div>

    <div class="flowbar">${steps.map((x,i)=>`
      <span class="fstep ${i<cur?'done':i===cur?'now':''}">${esc(x)}</span>`).join('<i>›</i>')}</div>

    <div class="tmeta">
      <div class="tm"><span>Đang ở tay</span><b>${h?whoCell(h):'<span style="color:var(--ink3)">chưa ai</span>'}</b></div>
      <div class="tm"><span>Lịch đăng</span><b class="${late?'due late':''}">${
        hrs===null?'—':late?`Trễ ${Math.abs(Math.round(hrs/24))||1} ngày`
        :hrs<24?`Còn ${Math.round(hrs)} giờ`:`Còn ${Math.round(hrs/24)} ngày`}
        <small style="display:block;font-weight:400;color:var(--ink3)">${fdate2(p.pub_date)} ${esc(p.pub_time||'')}</small></b></div>
      <div class="tm"><span>Người viết</span><b>${whoCell(p.writer)}</b></div>
      <div class="tm"><span>Thiết kế</span><b>${p.editor&&p.editor!=='Không cần'
        ?whoCell(p.editor):'<span style="color:var(--ink3)">chưa giao</span>'}</b></div>
    </div>

    ${main?`<button class="bigact" id="${main[0]}">${icon(main[2])}<span>${main[1]}</span></button>`:''}
    ${sub?`<div class="subacts">${sub}</div>`:''}

    ${p.status==='Đã đăng'?`<div class="mtr" style="margin-top:16px">
      <div><span>Lượt xem</span><b>${kf(p.views)}</b></div><div><span>Tương tác</span><b>${kf(p.eng)}</b></div>
      <div><span>Chia sẻ</span><b>${nf(p.shares)}</b></div><div><span>Lưu</span><b>${nf(p.saves)}</b></div></div>`:''}

    ${briefBlock(p)}
    ${p.script?`<div class="dr-lab">Nội dung / kịch bản</div><div class="dr-txt">${esc(p.script)}</div>`:''}

    <details class="tmore">
      <summary>${icon('i-cog')}Đổi chặng thủ công, ghi chú</summary>
      <div class="tmore-b">
        <div class="stchips">${FLOW.map(x=>
          `<button class="stchip ${st===x.s?'on '+x.cls:''}" data-st="${esc(x.s)}">${x.ic} ${esc(x.s)}</button>`).join('')}</div>
        <div class="dr-lab">Ghi chú</div><textarea id="dNote">${esc(p.note||'')}</textarea>
        <button class="btn btn-gh btn-full" id="dSave">Lưu ghi chú</button>
      </div>
    </details>

    ${rowActions('posts',id)}`);

  const TD=iso(new Date());
  const on=(i,fn)=>{const e=document.getElementById(i);if(e)e.onclick=fn;};
  on('pkToLeader',()=>save('posts',id,{status:'Chờ duyệt nội dung'},'Đã gửi '+LEADER()+' duyệt nội dung'));
  on('pkOkND',()=>save('posts',id,{status:'Đang thiết kế',editor:null,design_started:null,approved:ME.name},
    'Đã duyệt nội dung — '+(p.writer||'Content')+' chọn người thiết kế'));
  on('pkAssign',()=>{closeDrawer();handoffForm(p);});
  on('pkFixND',()=>save('posts',id,{status:'Cần sửa nội dung'},'Đã trả lại '+(p.writer||'Content')));
  on('pkGive',()=>handoffForm(p));
  on('pkClaim',()=>save('posts',id,{editor:ME.name,design_started:TD},'Bạn đã nhận việc này'));
  on('pkTake',()=>save('posts',id,{design_started:TD},'Đã bắt đầu làm'));
  on('pkSend',()=>save('posts',id,{status:'Chờ duyệt ấn phẩm',design_done:TD},'Đã gửi '+LEADER()+' duyệt'));
  on('pkSwap',()=>swapForm(p));
  on('pkOkAP',()=>save('posts',id,{status:'Chờ đăng',approved:ME.name},
    'Đã duyệt — chuyển '+(p.writer||'Content')+' đăng bài'));
  on('pkFixAP',()=>save('posts',id,{status:'Cần sửa ấn phẩm'},'Đã trả lại '+(p.editor||'thiết kế')));
  on('pkPub',()=>save('posts',id,{status:'Đã đăng'},'Đã đánh dấu đăng lên nền tảng'));
  document.querySelectorAll('.stchip[data-st]').forEach(b=>b.onclick=async()=>{
    const nst=b.dataset.st, patch={status:nst};
    if(nst==='Đang thiết kế'&&p.editor&&p.editor!=='Không cần'&&!(p.brief||p.brief_link)){
      toast('Cần có brief trước khi chuyển sang thiết kế'); handoffForm(p); return;}
    if(nst==='Chờ duyệt ấn phẩm') patch.design_done=TD;
    const nh=holder({...p,status:nst});
    await save('posts',id,patch,nh&&nh!==ME.name?`Đã chuyển sang “${nst}” — tới lượt ${nh}`:`Đã chuyển sang “${nst}”`);
  });
  on('dSave',()=>save('posts',id,{note:document.getElementById('dNote').value},'Đã lưu ghi chú'));
  bindActions('posts',id,p);
}

function swapForm(p){
  const ds=MEMBERS.filter(m=>m.kind==='design');
  openDrawer(`<div class="dr-code">Chuyển việc trong nhóm thiết kế</div>
    <div class="dr-title">${esc(p.title)}</div>
    <div class="dr-meta">Đang là <b>${esc(p.editor||'chưa ai nhận')}</b>.
      Hai bạn thiết kế tự chia việc với nhau, không cần qua Leader.</div>
    <div class="dr-lab">Chuyển cho</div>
    <div class="chpick">${ds.map(m=>{
      const n=POSTS.filter(x=>x.editor===m.name&&!DONE.includes(x.status)).length;
      return `<button class="chp ${m.name===p.editor?'on':''}" data-swap="${esc(m.name)}">
        <span class="chp-d" style="background:${m.desk==='design'?'#B83280':'#0E7490'}"></span>
        <span><b>${esc(m.name)}</b><small>${esc(m.role)} · đang giữ ${n} bài</small></span></button>`;}).join('')}</div>
    <div class="dr-lab">Lý do chuyển (không bắt buộc)</div>
    <textarea id="swNote" placeholder="Ví dụ: mình đang bận bộ POSM, nhờ bạn dựng giúp"></textarea>
    <button class="btn btn-pri btn-full" id="swSave">${icon('i-share')}Chuyển việc</button>`);
  let pick=p.editor;
  document.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('[data-swap]').forEach(x=>x.classList.toggle('on',x===b));
    pick=b.dataset.swap;});
  document.getElementById('swSave').onclick=()=>{
    if(!pick||pick===p.editor){toast('Chọn người khác để chuyển');return;}
    save('posts',p.id,{editor:pick,design_started:null,
      note:((p.note||'')+(V('swNote')?'\n'+ME.name+' chuyển cho '+pick+': '+V('swNote'):'')).trim()||null},
      'Đã chuyển cho '+pick);};
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
  const g=tgrp(t), isMine=(t.owner||'').includes(ME.name);
  const late=lateTask(t);
  const h=hoursLeft(t.due,null);

  /* Hành động chính — chỉ một nút lớn, đúng bước tiếp theo */
  let main='';
  if(isMine){
    if(g==='Chưa bắt đầu') main=['tkStart','Bắt đầu làm','i-hand','Đang làm'];
    else if(g==='Đang làm') main=['tkDone','Đánh dấu hoàn thành','i-check','Hoàn thành'];
    else if(g==='Tạm hoãn') main=['tkResume','Làm tiếp','i-loop','Đang làm'];
  }
  const mainBtn = main
    ? `<button class="bigact" id="${main[0]}">${icon(main[2])}<span>${main[1]}</span></button>` : '';

  /* Trạng thái dạng hàng ngang gọn */
  const chips=TST.filter(x=>x.s!=='Không áp dụng').map(x=>
    `<button class="stchip ${g===x.s?'on '+x.cls:''}" data-ts="${esc(x.s)}">${esc(x.s)}</button>`).join('');

  openDrawer(`
    <div class="dr-code">${esc(t.code||'')}${t.area?' · '+esc(t.area):''}</div>
    <div class="dr-title">${esc(t.name)}</div>

    <div class="tmeta">
      <div class="tm"><span>Trạng thái</span><b><span class="pill ${tcls(t)}">${esc(t.status)}</span></b></div>
      <div class="tm"><span>Hạn</span><b class="${late?'due late':''}">${
        h===null?'—':late?`Quá ${Math.abs(Math.round(h/24))||1} ngày`:h<24?`Còn ${Math.round(h)} giờ`:`Còn ${Math.round(h/24)} ngày`}
        <small style="display:block;font-weight:400;color:var(--ink3)">${fdate2(t.due)}</small></b></div>
      <div class="tm"><span>Người xử lý</span><b>${whoCell(t.owner)}</b></div>
      <div class="tm"><span>Ưu tiên</span><b><span class="pill ${PRI[t.priority]||'s-gray'}">${esc(t.priority||'—')}</span></b></div>
    </div>

    ${mainBtn}

    ${t.detail?`<div class="dr-lab">Mô tả</div><div class="dr-txt">${esc(t.detail)}</div>`:''}

    <div class="tinfo">
      ${t.source&&t.source!=='Kế hoạch'
        ?`<div class="ti">${icon('i-bolt')}<span>Nguồn: <b>${esc(t.source)}</b></span></div>`:''}
      ${t.assigner&&t.assigner!==t.owner?`<div class="ti">${icon('i-send')}<span>${esc(t.assigner)} giao việc này</span></div>`
        :(t.source==='Phát sinh'||t.source==='Tự đề xuất'?`<div class="ti">${icon('i-user')}<span>Bạn tự thêm việc này</span></div>`:'')}
      ${pr.name?`<div class="ti" data-popen="${pr.id}" style="cursor:pointer">${icon('i-folder')}<span>${esc(pr.name)}</span></div>`:''}
      ${sp.name?`<div class="ti">${icon('i-bolt')}<span>${esc(sp.name)}</span></div>`:''}
      ${t.est?`<div class="ti">${icon('i-clock')}<span>Ước tính ${t.est} giờ</span></div>`:''}
    </div>

    <details class="tmore"${g!=='Hoàn thành'&&!main?' open':''}>
      <summary>${icon('i-cog')}Đổi trạng thái, người xử lý, hạn</summary>
      <div class="tmore-b">
        <div class="dr-lab" style="margin-top:0">Trạng thái</div>
        <div class="stchips">${chips}</div>
        <div class="two" style="margin-top:14px">
          <div><div class="dr-lab" style="margin-top:0">Giao lại cho</div>
            <select id="tOwn" class="fld">${MEMBERS.map(m=>
              `<option ${(t.owner||'').includes(m.name)?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div>
          <div><div class="dr-lab" style="margin-top:0">Ưu tiên</div>
            <select id="tPri" class="fld">${['Cao','Trung bình','Thấp'].map(x=>
              `<option ${x===t.priority?'selected':''}>${x}</option>`).join('')}</select></div>
        </div>
        <div class="dr-lab">Hạn hoàn thành</div>
        <input type="date" id="tDue" class="fld" value="${t.due||''}">
        <div class="dr-lab">Ghi chú</div>
        <textarea id="tNote" placeholder="Ghi chú thêm cho việc này">${esc(t.note||'')}</textarea>
        <button class="btn btn-pri btn-full" id="tSave">Lưu thay đổi</button>
      </div>
    </details>

    ${rowActions('tasks',id)}`);

  const on=(i,f)=>{const e=document.getElementById(i);if(e)e.onclick=f;};
  if(main) on(main[0],()=>save('tasks',id,{status:main[3]},
    main[3]==='Hoàn thành'?'Đã xong việc này':'Đã chuyển sang “'+main[3]+'”'));
  document.querySelectorAll('[data-ts]').forEach(b=>b.onclick=()=>
    save('tasks',id,{status:b.dataset.ts},`Đã chuyển sang “${b.dataset.ts}”`));
  on('tSave',()=>save('tasks',id,{owner:V('tOwn'),due:V('tDue')||null,priority:V('tPri'),
    note:document.getElementById('tNote').value},'Đã lưu thay đổi'));
  bindActions('tasks',id,t);
  document.querySelectorAll('[data-popen]').forEach(e=>e.onclick=()=>{closeDrawer();go('p-'+e.dataset.popen);});
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
      ${[['cSelf','i-plus','Việc của tôi','Việc phát sinh, tự thêm cho mình',null],
         ['cTask','i-check','Giao việc','Giao cho thành viên khác','task.create'],
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
  on('cSelf',()=>themViecCuaToi());
  on('cTask',()=>giaoViec(null)); on('cPost',openNewPost); on('cProj',openNewProj);
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
  const meIsDesign=(MEMBERS.find(m=>m.name===ME.name)||{}).kind==='design';
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
      <select id="pf_writer" class="fld">${MEMBERS.map(m=>
        `<option ${m.name===(meIsDesign?ME.name:own)?'selected':''}>${esc(m.name)}${
          m.kind==='design'?' (thiết kế)':''}</option>`).join('')}</select></div>
      <div><div class="dr-lab">${esc(P.editorLabel)}</div>
      <select id="pf_editor" class="fld"><option ${!P.needEditor&&!meIsDesign?'selected':''}>Không cần</option>
        ${MEMBERS.filter(m=>m.kind==='design').map(m=>
          `<option ${meIsDesign?(m.name===ME.name?'selected':''):(P.needEditor&&m.name===dsn?'selected':'')}>${esc(m.name)}</option>`).join('')}</select></div></div>
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
      status:(meIsDesign&&g('editor')===ME.name)?'Đang thiết kế':'Đang viết',
      design_started:(meIsDesign&&g('editor')===ME.name)?iso(new Date()):null,
      views:0,eng:0,shares:0,saves:0},
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



/* Đổi riêng ảnh đại diện */
function avatarForm(id){
  const m=MEMBERS.find(x=>x.id===id); if(!m) return;
  openDrawer(`<div class="dr-code">Ảnh đại diện</div>
    <div class="dr-title">${esc(m.name)}</div>
    <div class="dr-meta">${esc(m.role)}</div>
    ${avatarPicker(m.avatar,m.name)}
    <button class="btn btn-pri btn-full" id="avaSave">Lưu ảnh</button>`);
  bindAvatar(m.name);
  document.getElementById('avaSave').onclick=()=>
    save('members',id,{avatar:document.getElementById('avaVal').value||null},'Đã cập nhật ảnh');
}

/* ─── Chọn ảnh đại diện ─── */
function avatarPicker(cur,name){
  return `<div class="dr-lab">Ảnh đại diện</div>
    <div class="avapick">
      <div class="avaprev" id="avaPrev">${cur
        ? `<img src="${esc(cur)}" alt="">`
        : `<span class="avaini">${esc(ini(name||'?'))}</span>`}</div>
      <div class="avaact">
        <input type="file" id="avaFile" accept="image/*" hidden>
        <button class="btn btn-gh btn-sm" id="avaPick">${icon('i-plus')}Chọn ảnh từ máy</button>
        <button class="btn btn-gh btn-sm" id="avaLink">${icon('i-link')}Dán link ảnh</button>
        ${cur?`<button class="btn btn-gh btn-sm danger" id="avaDel">${icon('i-trash')}Bỏ ảnh</button>`:''}
        <div class="avahint">Ảnh vuông là đẹp nhất. Hệ thống tự thu nhỏ còn 160px
          nên dung lượng rất nhẹ.</div>
      </div>
    </div>
    <input type="hidden" id="avaVal" value="${esc(cur||'')}">`;
}
function bindAvatar(name){
  const prev=document.getElementById('avaPrev');
  const val=document.getElementById('avaVal');
  const file=document.getElementById('avaFile');
  const show=src=>{ val.value=src||'';
    prev.innerHTML = src?`<img src="${src}" alt="">`
      :`<span class="avaini">${esc(ini(name||'?'))}</span>`;
    const del=document.getElementById('avaDel'); if(del) del.style.display=src?'':'none';};
  const pick=document.getElementById('avaPick');
  if(pick) pick.onclick=()=>file.click();
  if(file) file.onchange=()=>{
    const f=file.files&&file.files[0]; if(!f) return;
    if(f.size>8*1024*1024){toast('Ảnh quá lớn, chọn ảnh dưới 8MB');return;}
    const rd=new FileReader();
    rd.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        /* cắt vuông giữa rồi thu về 160px cho nhẹ */
        const S=160, c=document.createElement('canvas');
        c.width=S; c.height=S;
        const ctx=c.getContext('2d');
        const side=Math.min(img.width,img.height);
        ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,S,S);
        show(c.toDataURL('image/jpeg',0.82));
        toast('Đã chọn ảnh — nhớ bấm Lưu');
      };
      img.onerror=()=>toast('Không đọc được ảnh này');
      img.src=e.target.result;
    };
    rd.readAsDataURL(f);
  };
  const lk=document.getElementById('avaLink');
  if(lk) lk.onclick=()=>{
    const u=prompt('Dán đường dẫn ảnh (bắt đầu bằng https://)', val.value||'');
    if(u===null) return;
    if(u&&!/^https?:\/\//.test(u)){toast('Đường dẫn phải bắt đầu bằng https://');return;}
    show(u.trim());
  };
  const del=document.getElementById('avaDel');
  if(del) del.onclick=()=>{ show(''); toast('Đã bỏ ảnh — nhớ bấm Lưu'); };
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
    ${avatarPicker(d.avatar,d.name)}
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
  bindAvatar(d.name);
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
      manager:mgr==='— Không —'?null:mgr,email:V('mbEmail')||null,pin:V('mbPin')||'0000',
      avatar:document.getElementById('avaVal').value||null};
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


/* ─── Cửa sổ thông tin kết nối ─── */
function connInfo(){
  const ok=!DEMO_MODE;
  openDrawer(`
    <div class="dr-code">Trạng thái hệ thống</div>
    <div class="dr-title">${ok?'Cả phòng đang dùng chung dữ liệu':'Đang ở chế độ xem thử'}</div>
    <div class="connbox ${ok?'ok':'off'}">
      <span class="cb-i">${icon(ok?'i-check':'i-alert')}</span>
      <span>${ok
        ? 'Mọi thay đổi được lưu lên máy chủ. Bạn giao việc thì người kia mở lên là thấy ngay.'
        : '<b>Dữ liệu chỉ nằm trong trình duyệt máy này.</b> Bạn giao việc thì người khác đăng nhập '
          +'sẽ không thấy. Tải lại trang là mất hết.'}</span></div>

    <div class="dr-lab">Chi tiết</div>
    <div class="tinfo">
      <div class="ti">${icon('i-cog')}<span>Khoá trong config.js:
        <b>${CONFIGURED?'đã điền':'CHƯA điền'}</b></span></div>
      <div class="ti">${icon('i-signal')}<span>Thư viện Supabase:
        <b>${(typeof supabase!=='undefined'&&supabase&&supabase.createClient)?'đã tải':'KHÔNG tải được'}</b></span></div>
      <div class="ti">${icon('i-users')}<span>Đọc được dữ liệu:
        <b>${ok?'có — '+MEMBERS.length+' thành viên':'không'}</b></span></div>
      ${CONFIG.SUPABASE_URL?`<div class="ti">${icon('i-link')}<span style="word-break:break-all">
        ${esc(CONFIG.SUPABASE_URL)}</span></div>`:''}
    </div>

    ${!ok?`<div class="dr-lab">Cách khắc phục</div>
      <div class="fixlist">
        ${!CONFIGURED?`<div class="fix"><b>1. Điền khoá</b>
          <span>Mở file <code>config.js</code>, dán Project URL và khoá anon từ Supabase.</span></div>`:''}
        ${CONFIGURED&&(typeof supabase==='undefined')?`<div class="fix"><b>1. Mạng chặn thư viện</b>
          <span>Thử mạng khác hoặc mở bằng 4G điện thoại.</span></div>`:''}
        ${CONFIGURED&&(typeof supabase!=='undefined')?`<div class="fix"><b>1. Cấp quyền cho bảng</b>
          <span>Vào Supabase → SQL Editor, chạy file <code>supabase/fix-quyen.sql</code>.
          Đây là nguyên nhân phổ biến nhất.</span></div>`:''}
        <div class="fix"><b>2. Tải lại trang</b>
          <span>Nhấn Ctrl+Shift+R để bỏ bộ nhớ đệm trình duyệt.</span></div>
        <div class="fix"><b>3. Kiểm tra lại</b>
          <span>Nếu ô này chuyển sang <b>Dùng chung</b> màu xanh là đã xong.</span></div>
      </div>`
    :`<div class="dr-lab">Kiểm tra nhanh</div>
      <div class="dr-txt">Muốn chắc chắn: giao một việc thử cho ai đó, rồi nhờ họ đăng nhập xem có thấy không.
      Hoặc mở Supabase → Table Editor → bảng <b>tasks</b>, việc bạn vừa tạo phải nằm ở đó.</div>`}`);
}


/* ═══════════ POPUP NHẮC VIỆC KHI MỞ APP ═══════════ */
function nhacViec(){
  const td=iso(D0());
  const openP=POSTS.filter(p=>!DONE.includes(p.status));
  const myP=openP.filter(p=>holds(p,ME.name));
  const myT=TASKS.filter(t=>(t.owner||'').includes(ME.name)
    &&!['Hoàn thành','Không áp dụng'].includes(tgrp(t)));

  const G=[];
  /* 1. Quá hạn — gấp nhất */
  const qh=[...myP.filter(latePost).map(p=>({k:'post',id:p.id,t:p.title,
      s:esc(p.channel||'')+' · quá hạn '+Math.abs(dd(p.pub_date))+' ngày'})),
    ...myT.filter(lateTask).map(t=>({k:'task',id:t.id,t:t.name,
      s:esc(t.area||'')+' · quá hạn '+Math.abs(dd(t.due))+' ngày'}))];
  if(qh.length) G.push({lv:'red',ic:'i-alert',t:'Đang quá hạn',
    d:'Xử lý trước tiên, hoặc báo Leader dời hạn',l:qh});

  /* 2. Đến hạn hôm nay */
  const hn=[...myP.filter(p=>p.pub_date===td).map(p=>({k:'post',id:p.id,t:p.title,
      s:esc(p.channel||'')+(p.pub_time?' · '+esc(p.pub_time):'')})),
    ...myT.filter(t=>t.due===td).map(t=>({k:'task',id:t.id,t:t.name,s:esc(t.area||'')}))];
  if(hn.length) G.push({lv:'amber',ic:'i-clock',t:'Đến hạn hôm nay',
    d:'Cần xong trong hôm nay',l:hn});

  /* 3. Việc mới được giao chưa bắt đầu */
  const moi=myT.filter(t=>tgrp(t)==='Chưa bắt đầu'&&t.assigner&&t.assigner!==ME.name);
  if(moi.length) G.push({lv:'pri',ic:'i-inbox',t:'Việc mới được giao',
    d:'Bấm vào để xem chi tiết và bắt đầu',
    l:moi.map(t=>({k:'task',id:t.id,t:t.name,s:esc(t.assigner)+' giao · hạn '+fdate(t.due)}))});

  /* 4. Bài đang chờ chính mình xử lý */
  const cho=myP.filter(p=>!latePost(p)&&p.pub_date!==td);
  if(cho.length) G.push({lv:'blue',ic:'i-hand',t:'Đang nằm ở tay bạn',
    d:'Chưa gấp nhưng đừng để trôi',
    l:cho.slice(0,5).map(p=>({k:'post',id:p.id,t:p.title,
      s:esc(norm(p.status))+' · '+esc(p.channel||'')}))});

  /* 5. Báo cáo ngày */
  const rp=REPORTS.find(r=>r.author===ME.name&&r.date===td);
  const chuaNop=!rp||rp.status==='Chưa nộp'||rp.status==='Yêu cầu sửa';
  const gioMuon=new Date().getHours()>=16;
  if(chuaNop&&gioMuon) G.push({lv:'teal',ic:'i-doc',
    t:rp&&rp.status==='Yêu cầu sửa'?'Báo cáo bị trả lại, cần sửa':'Chưa nộp báo cáo hôm nay',
    d:'Cuối ngày nhớ ghi lại việc đã làm',l:[],go:'reports',btn:'Nộp báo cáo'});

  /* 6. Trực nhật */
  const duty=DUTY.find(d=>d.date===td&&d.who===ME.name);
  if(duty&&!duty.done) G.push({lv:'gray',ic:'i-cal',t:'Hôm nay bạn trực',
    d:esc(duty.task||'Trực inbox và bình luận toàn kênh'),l:[],go:'duty',btn:'Xem lịch trực'});

  /* 7. Leader: hàng chờ duyệt */
  if(ME.kind==='leader'||can('post.approve')){
    const dch=openP.filter(p=>F(p.status).hold==='leader');
    if(dch.length) G.push({lv:'amber',ic:'i-check',t:'Đang chờ bạn duyệt',
      d:'Cả phòng đứng chờ khâu này',
      l:dch.slice(0,5).map(p=>({k:'post',id:p.id,t:p.title,
        s:esc(norm(p.status))+' · '+esc(p.writer||'')})),go:'assign',btn:'Mở trang duyệt'});
  }

  if(!G.length) return null;
  const tong=G.reduce((a,g)=>a+(g.l.length||1),0);
  const gio=new Date().getHours();
  const chao=gio<11?'Chào buổi sáng':gio<14?'Chào buổi trưa':gio<18?'Chào buổi chiều':'Chào buổi tối';

  return `<div class="nhac">
    <div class="nhac-h">
      <div class="nhac-av">${avat(ME.name)}</div>
      <div class="nhac-t"><b>${chao}, ${esc(ME.name.split(' ').slice(-1)[0])}</b>
        <small>${qh.length?`Có <b style="color:var(--red)">${qh.length} việc quá hạn</b> cần xử lý trước`
          :hn.length?`Hôm nay có <b>${hn.length} việc</b> tới hạn`
          :`Bạn có <b>${tong} mục</b> cần chú ý`}</small></div>
      <button class="nhac-x" id="nhacClose">${icon('i-x')}</button>
    </div>
    <div class="nhac-b">
      ${G.map(g=>`<div class="nhac-g ${g.lv}">
        <div class="ng-h"><span class="ng-i">${icon(g.ic)}</span>
          <span class="ng-t"><b>${esc(g.t)}</b><small>${g.d}</small></span>
          ${g.l.length?`<span class="ng-n">${g.l.length}</span>`:''}</div>
        ${g.l.length?`<div class="ng-l">${g.l.map(x=>`
          <button class="ng-i2" data-nhac="${x.k}:${x.id}">
            <span class="ng-dot"></span>
            <span class="ng-x"><b>${esc(x.t)}</b><small>${x.s}</small></span>
            ${icon('i-send')}</button>`).join('')}</div>`:''}
        ${g.go?`<button class="ng-go" data-nhacgo="${g.go}">${esc(g.btn||'Mở')} →</button>`:''}
      </div>`).join('')}
    </div>
    <div class="nhac-f">
      <label class="nhac-chk"><input type="checkbox" id="nhacHide"><span></span>
        Không nhắc lại hôm nay</label>
      <button class="btn btn-pri" id="nhacOk">Bắt đầu làm việc</button>
    </div>
  </div>`;
}

function showNhac(){
  if(!ME) return;
  const key='mktos_nhac_'+ME.name+'_'+iso(D0());
  if(localStorage.getItem(key)) return;
  const html=nhacViec();
  if(!html) return;
  const wrap=document.createElement('div');
  wrap.className='nhac-bg'; wrap.id='nhacBg';
  wrap.innerHTML=html;
  document.body.appendChild(wrap);
  const close=()=>{
    const cb=document.getElementById('nhacHide');
    if(cb&&cb.checked) localStorage.setItem(key,'1');
    wrap.remove();
  };
  document.getElementById('nhacClose').onclick=close;
  document.getElementById('nhacOk').onclick=close;
  wrap.onclick=e=>{ if(e.target===wrap) close(); };
  wrap.querySelectorAll('[data-nhac]').forEach(b=>b.onclick=()=>{
    const [k,i]=b.dataset.nhac.split(':');
    close(); k==='post'?openPost(+i):openTask(+i);
  });
  wrap.querySelectorAll('[data-nhacgo]').forEach(b=>b.onclick=()=>{
    close(); go(b.dataset.nhacgo);
  });
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
