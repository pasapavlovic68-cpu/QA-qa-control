drop policy if exists "organization members can delete reports" on public.reports;
create policy "organization members can delete reports"
on public.reports
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = reports.organization_id
      and member.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can delete qa checks" on public.qa_checks;
create policy "organization members can delete qa checks"
on public.qa_checks
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = qa_checks.organization_id
      and member.auth_user_id = auth.uid()
  )
);

drop policy if exists "organization members can delete uploaded dialogues" on public.uploaded_dialogues;
create policy "organization members can delete uploaded dialogues"
on public.uploaded_dialogues
for delete
to authenticated
using (
  exists (
    select 1
    from public.employees member
    where member.organization_id = uploaded_dialogues.organization_id
      and member.auth_user_id = auth.uid()
  )
);
