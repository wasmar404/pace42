-- 1:1 chat tables (mutual follow enforced in backend)

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  last_message_at timestamptz,
  last_message_text text,
  last_sender_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_last_message_at_idx on public.conversations(last_message_at desc nulls last);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unread_count int not null default 0,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversation_participants_user_id_idx on public.conversation_participants(user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_sender_id_idx on public.messages(sender_id);

-- updated_at trigger for conversations (requires public.set_updated_at from 001_init.sql)
drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row execute function public.set_updated_at();
