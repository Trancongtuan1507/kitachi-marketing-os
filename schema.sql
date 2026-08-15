-- ═══════════════════════════════════════════════════════════════
-- MARKETING OS · KITACHI — LƯỢC ĐỒ CƠ SỞ DỮ LIỆU
-- ĐÃ KIỂM TRA trên PostgreSQL 16: tạo đủ 19 bảng, không lỗi
-- Chạy toàn bộ file này ở Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

drop table if exists perms     cascade;
drop table if exists roles     cascade;
drop table if exists duty      cascade;
drop table if exists kudos     cascade;
drop table if exists approvals cascade;
drop table if exists reports   cascade;
drop table if exists ads      cascade;
drop table if exists activity cascade;
drop table if exists meetings cascade;
drop table if exists docs     cascade;
drop table if exists risks    cascade;
drop table if exists budget   cascade;
drop table if exists posts    cascade;
drop table if exists tasks    cascade;
drop table if exists sprints  cascade;
drop table if exists projects cascade;
drop table if exists channels cascade;
drop table if exists members  cascade;
drop table if exists settings cascade;

create table members (
  id serial primary key,
  name text not null unique, short_name text, role text not null,
  dept text, manager text, email text,
  pin text not null default '1234',
  kind text not null default 'writer',   -- leader | writer | design
  desk text,                             -- leader | social | tiktok | design | edit
  cap int default 100, sort_order int default 0
);

create table channels (
  id serial primary key,
  name text not null unique, platform text, followers int default 0,
  role text, style text, priority text, target_week int default 0,
  note text, stream text default 'social', active boolean default true,
  owner_content text, owner_design text,
  budget_month bigint default 0, spent_month bigint default 0,
  aud_age jsonb, aud_gender jsonb, aud_loc jsonb, aud_hour jsonb, growth jsonb,
  archived boolean default false
);

create table projects (
  id serial primary key,
  code text unique, name text not null, status text default 'Đang chạy',
  owner text, start date, due date, progress int default 0,
  budget bigint default 0, spent bigint default 0,
  color text default '#6D4AFF', note text,
  archived boolean default false
);

create table sprints (
  id serial primary key,
  name text not null, start date, "end" date,
  status text default 'Sắp tới', goal text,
  archived boolean default false
);

create table tasks (
  id bigserial primary key,
  project_id int references projects(id) on delete cascade,
  sprint_id int references sprints(id),
  code text, area text, name text not null, detail text,
  owner text, assigner text, reporter text,
  priority text default 'Trung bình', est int default 4,
  due date, status text default 'Chưa bắt đầu', note text,
  archived boolean default false,
  updated_at timestamptz default now(), updated_by text,
  created_at timestamptz default now()
);
create index tasks_owner_idx on tasks (owner);
create index tasks_proj_idx  on tasks (project_id);

create table posts (
  id bigserial primary key,
  title text not null, writer text, editor text,
  status text not null default 'Lên ý tưởng',
  ctype text, channel_id int references channels(id), channel text,
  platform text, stream text default 'social', fmt text, goal text,
  project_id int references projects(id),
  design_due date, design_started date, design_done date,
  pub_date date, pub_time text,
  brief text, brief_link text, brief_img text, script text,
  link_footage text, asset text, handoff_by text, handoff_at date,
  approved text, hashtag text, note text,
  -- trường đặc thù theo nền tảng
  hook text, caption text, cta text, sound text, duration text, props text,
  seo_title text, seo_desc text, keyword text, slug text, thumb text,
  audience text, geotag text, offer_end date,
  img_count int, send_count int, ad_budget bigint,
  views int default 0, eng int default 0, shares int default 0, saves int default 0,
  archived boolean default false,
  updated_at timestamptz default now(), updated_by text,
  created_at timestamptz default now()
);
create index posts_status_idx on posts (status);
create index posts_pub_idx    on posts (pub_date);

create table budget (
  id serial primary key,
  project_id int references projects(id) on delete cascade,
  cat text, name text not null, plan bigint default 0, spent bigint default 0,
  owner text, note text, updated_by text,
  channel_id int references channels(id) on delete set null,
  archived boolean default false
);

create table ads (
  id serial primary key,
  name text not null, platform text, channel text, goal text,
  status text default 'Nháp', owner text,
  project_id int references projects(id) on delete set null,
  budget_id int references budget(id) on delete set null,
  start date, "end" date,
  budget bigint default 0, spent bigint default 0,
  impressions bigint default 0, clicks bigint default 0,
  conversions int default 0, revenue bigint default 0,
  note text, updated_by text,
  created_at timestamptz default now(),
  archived boolean default false
);
create index ads_status_idx on ads (status);

create table reports (
  id bigserial primary key,
  date date not null, author text not null, reviewer text,
  status text default 'Chờ duyệt', items jsonb default '[]'::jsonb,
  blocker text, plan text, note text,
  updated_by text, created_at timestamptz default now(),
  unique (date, author),
  archived boolean default false
);
create index reports_date_idx on reports (date desc);

create table approvals (
  id serial primary key,
  kind text, title text not null, requester text, approver text,
  status text default 'Chờ duyệt', amount bigint default 0,
  at date, note text, updated_by text,
  archived boolean default false
);

create table kudos (
  id serial primary key,
  giver text, receiver text, text text, point int default 10,
  at date, updated_by text,
  archived boolean default false
);

create table duty (
  id serial primary key,
  date date, who text, task text, done boolean default false, updated_by text,
  archived boolean default false
);

create table roles (
  id serial primary key,
  name text not null unique, kind text, desk text
);

create table perms (
  id serial primary key,
  grp text, grp_name text, key text not null unique, name text not null,
  scoped boolean default false,
  vals jsonb not null default '{}'::jsonb,
  updated_by text, updated_at timestamptz default now()
);

create table activity (
  id bigserial primary key,
  kind text, item_id bigint, item text, actor text,
  from_status text, to_status text, at timestamptz default now()
);

create table risks (
  id serial primary key,
  project_id int references projects(id) on delete cascade,
  name text not null, detail text, prob text, impact text,
  status text default 'Mới ghi nhận', owner text, plan text, updated_by text,
  archived boolean default false
);

create table docs (
  id serial primary key,
  project_id int references projects(id) on delete cascade,
  name text not null, cat text, owner text, at date, link text, updated_by text,
  archived boolean default false
);

create table meetings (
  id serial primary key,
  name text not null, date date, time text, mins int default 60,
  kind text, host text, who text, agenda text, updated_by text,
  archived boolean default false
);


create index activity_at_idx on activity (at desc);

create table settings ( key text primary key, value text );

-- ── Tự ghi nhật ký khi đổi trạng thái ──
create or replace function log_post_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into activity (kind,item_id,item,actor,from_status,to_status)
    values ('posts',new.id,new.title,new.updated_by,old.status,new.status);
  end if;
  new.updated_at := now(); return new;
end; $$ language plpgsql;

create or replace function log_task_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    insert into activity (kind,item_id,item,actor,from_status,to_status)
    values ('tasks',new.id,new.name,new.updated_by,old.status,new.status);
  end if;
  new.updated_at := now(); return new;
end; $$ language plpgsql;

create trigger posts_log before update on posts for each row execute function log_post_change();
create trigger tasks_log before update on tasks for each row execute function log_task_change();

-- ── Quyền: công cụ nội bộ dùng chung một khoá anon ──
alter table members  disable row level security;
alter table channels disable row level security;
alter table projects disable row level security;
alter table sprints  disable row level security;
alter table tasks    disable row level security;
alter table posts    disable row level security;
alter table budget   disable row level security;
alter table risks    disable row level security;
alter table docs     disable row level security;
alter table meetings disable row level security;
alter table activity disable row level security;
alter table ads      disable row level security;
alter table reports   disable row level security;
alter table approvals disable row level security;
alter table kudos     disable row level security;
alter table duty      disable row level security;
alter table roles     disable row level security;
alter table perms     disable row level security;
alter table settings disable row level security;
