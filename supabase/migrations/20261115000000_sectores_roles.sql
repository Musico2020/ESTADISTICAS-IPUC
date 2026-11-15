-- Fase 1: 4 sectores con 3 zonas cada uno y jerarquía de roles.
create table sectores (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero between 1 and 4),
  nombre text not null,
  color_borde text not null,
  geometria jsonb not null
);
alter table sectores enable row level security;
create policy sectores_leer on sectores for select to authenticated using (usuario_activo());
create policy sectores_admin on sectores for all to authenticated using (es_admin()) with check (es_admin());

alter table zonas add column sector_id uuid references sectores(id);
alter table zonas drop constraint zonas_numero_check;
alter table zonas add constraint zonas_numero_check check (numero between 1 and 12);

alter table perfiles add column sector_id uuid references sectores(id);
alter table perfiles drop constraint perfiles_rol_check;
update perfiles set rol = 'coordinador_zona' where rol = 'coordinador';
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('administrador','coordinador_sector','coordinador_zona','lider_zona','usuario'));
alter table perfiles drop constraint perfiles_check;
alter table perfiles add constraint perfiles_alcance_check check (
  (rol in ('coordinador_zona','lider_zona') and zona_id is not null)
  or (rol = 'coordinador_sector' and sector_id is not null)
  or rol in ('administrador','usuario'));

-- Zonas que el usuario puede ver y en las que puede registrar.
create function zonas_visibles() returns setof uuid language sql stable security definer set search_path = public as $$
  select z.id from zonas z join perfiles p on p.id = auth.uid() and p.activo
  where p.rol in ('administrador','usuario')
     or (p.rol = 'coordinador_sector' and z.sector_id = p.sector_id)
     or (p.rol in ('coordinador_zona','lider_zona') and z.id = p.zona_id)
$$;

-- Quién corrige un registro: el administrador, el coordinador de su sector o de su zona, o su autor
-- si es líder o cuenta compartida y la zona está a su alcance.
create function puede_corregir(p_zona uuid, p_autor uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles p left join zonas z on z.id = p_zona
    where p.id = auth.uid() and p.activo and (
      p.rol = 'administrador'
      or (p.rol = 'coordinador_sector' and z.sector_id = p.sector_id)
      or (p.rol = 'coordinador_zona' and p_zona = p.zona_id)
      or (p.rol in ('lider_zona','usuario') and p_autor = auth.uid() and p_zona in (select zonas_visibles()))))
$$;

revoke execute on function zonas_visibles(), puede_corregir(uuid, uuid) from public, anon;
grant execute on function zonas_visibles(), puede_corregir(uuid, uuid) to authenticated;

drop policy reportes_leer on reportes;
create policy reportes_leer on reportes for select to authenticated using (zona_id in (select zonas_visibles()));
drop policy reportes_crear on reportes;
create policy reportes_crear on reportes for insert to authenticated
  with check (es_admin() or (creado_por = auth.uid() and zona_id in (select zonas_visibles())));
drop policy reportes_editar on reportes;
create policy reportes_editar on reportes for update to authenticated
  using (puede_corregir(zona_id, creado_por)) with check (puede_corregir(zona_id, creado_por));

drop policy rm_escribir on reporte_manzanas;
create policy rm_escribir on reporte_manzanas for all to authenticated
  using (exists (select 1 from reportes r where r.id = reporte_id and puede_corregir(r.zona_id, r.creado_por)))
  with check (exists (select 1 from reportes r join manzanas m on m.id = manzana_id
    where r.id = reporte_id and m.zona_id = r.zona_id and puede_corregir(r.zona_id, r.creado_por)));

drop policy casos_leer on casos_especiales;
create policy casos_leer on casos_especiales for select to authenticated using (zona_id in (select zonas_visibles()));
drop policy casos_crear on casos_especiales;
create policy casos_crear on casos_especiales for insert to authenticated with check (
  zona_id in (select zonas_visibles())
  and exists (select 1 from reportes r where r.id = reporte_id and r.zona_id = casos_especiales.zona_id));
drop policy casos_editar on casos_especiales;
create policy casos_editar on casos_especiales for update to authenticated
  using (zona_id in (select zonas_visibles())) with check (zona_id in (select zonas_visibles()));
drop policy casos_eliminar on casos_especiales;
create policy casos_eliminar on casos_especiales for delete to authenticated using (zona_id in (select zonas_visibles()));
