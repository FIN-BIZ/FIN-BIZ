insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capital-documents',
  'capital-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.capital_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_type text not null check (char_length(business_type) <= 100),
  funding_need text not null check (char_length(funding_need) <= 200),
  amount text not null check (char_length(amount) <= 100),
  company text not null check (char_length(company) between 1 and 200),
  representative text not null check (char_length(representative) between 1 and 200),
  phone text not null check (char_length(phone) between 1 and 40),
  note text not null default '' check (char_length(note) <= 3000),
  status text not null default 'received' check (status in ('received', 'reviewing', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.capital_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.capital_applications(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null,
  file_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) <= 120),
  file_size bigint not null check (file_size between 1 and 20971520),
  created_at timestamptz not null default now()
);

alter table public.capital_documents
  add column if not exists document_type text not null default 'other';
alter table public.capital_documents alter column document_type drop default;
alter table public.capital_documents
  drop constraint if exists capital_documents_document_type_check;
alter table public.capital_documents
  add constraint capital_documents_document_type_check
  check (document_type in ('legal', 'financial', 'operational', 'collateral', 'other'));

create index if not exists capital_applications_owner_created_idx
  on public.capital_applications (owner_id, created_at desc);
create index if not exists capital_documents_application_idx
  on public.capital_documents (application_id);

revoke all on public.capital_applications, public.capital_documents from anon, authenticated;
grant select, insert on public.capital_applications to authenticated;
grant select, insert on public.capital_documents to authenticated;

alter table public.capital_applications enable row level security;
alter table public.capital_documents enable row level security;

drop policy if exists "Businesses create their own applications" on public.capital_applications;
create policy "Businesses create their own applications"
  on public.capital_applications for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Businesses read their own applications" on public.capital_applications;
create policy "Businesses read their own applications"
  on public.capital_applications for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Businesses create documents for their applications" on public.capital_documents;
create policy "Businesses create documents for their applications"
  on public.capital_documents for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and document_type in ('legal', 'financial', 'operational', 'collateral')
    and file_path like (select auth.uid())::text || '/' || application_id::text || '/' || document_type || '/%'
    and exists (
      select 1
      from public.capital_applications application
      where application.id::text = capital_documents.application_id::text
        and application.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses read their own document records" on public.capital_documents;
create policy "Businesses read their own document records"
  on public.capital_documents for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Businesses upload documents to their private folder" on storage.objects;
create policy "Businesses upload documents to their private folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'capital-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] in ('legal', 'financial', 'operational', 'collateral')
    and exists (
      select 1
      from public.capital_applications application
      where application.id::text = (storage.foldername(name))[2]
        and application.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Businesses read documents from their private folder" on storage.objects;
create policy "Businesses read documents from their private folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'capital-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] in ('legal', 'financial', 'operational', 'collateral')
    and exists (
      select 1
      from public.capital_applications application
      where application.id::text = (storage.foldername(name))[2]
        and application.owner_id = (select auth.uid())
    )
  );
