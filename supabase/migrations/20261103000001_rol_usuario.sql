-- Rol "usuario": cuenta del equipo que reporta y consulta en todas las zonas, sin funciones de administración.
alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check check (rol in ('coordinador','administrador','usuario'));
alter table perfiles drop constraint perfiles_check;
alter table perfiles add constraint perfiles_check check (rol <> 'coordinador' or zona_id is not null);

create function ve_todas_zonas() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from perfiles where id = auth.uid() and activo and rol in ('administrador','usuario')) $$;
revoke execute on function ve_todas_zonas() from public, anon;
grant execute on function ve_todas_zonas() to authenticated;

drop policy reportes_leer on reportes;
create policy reportes_leer on reportes for select to authenticated using (ve_todas_zonas() or zona_id = mi_zona());

drop policy reportes_crear on reportes;
create policy reportes_crear on reportes for insert to authenticated
  with check (es_admin() or (creado_por = auth.uid() and (ve_todas_zonas() or zona_id = mi_zona())));

drop policy reportes_editar on reportes;
create policy reportes_editar on reportes for update to authenticated
  using (es_admin() or (creado_por = auth.uid() and (ve_todas_zonas() or zona_id = mi_zona())))
  with check (es_admin() or (creado_por = auth.uid() and (ve_todas_zonas() or zona_id = mi_zona())));

drop policy casos_leer on casos_especiales;
create policy casos_leer on casos_especiales for select to authenticated using (ve_todas_zonas() or zona_id = mi_zona());

drop policy casos_crear on casos_especiales;
create policy casos_crear on casos_especiales for insert to authenticated with check (
  (ve_todas_zonas() or zona_id = mi_zona())
  and exists (select 1 from reportes r where r.id = reporte_id and r.zona_id = casos_especiales.zona_id));

drop policy casos_editar on casos_especiales;
create policy casos_editar on casos_especiales for update to authenticated
  using (ve_todas_zonas() or zona_id = mi_zona()) with check (ve_todas_zonas() or zona_id = mi_zona());

drop policy casos_eliminar on casos_especiales;
create policy casos_eliminar on casos_especiales for delete to authenticated using (ve_todas_zonas() or zona_id = mi_zona());
