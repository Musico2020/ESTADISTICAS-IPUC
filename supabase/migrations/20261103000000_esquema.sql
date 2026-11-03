create table zonas (
  id uuid primary key default gen_random_uuid(),
  numero int not null unique check (numero between 1 and 4),
  nombre text not null,
  color_borde text not null,
  geometria jsonb not null
);

create table manzanas (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id),
  codigo text not null unique,
  geometria jsonb not null,
  activa boolean not null default true
);

create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol text not null check (rol in ('coordinador','administrador')),
  zona_id uuid references zonas(id),
  activo boolean not null default true,
  check (rol = 'administrador' or zona_id is not null)
);

create table reportes (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  responsable_nombre text not null,
  coordinador_nombre text not null,
  fecha_jornada date not null,
  direccion text,
  hogares_visitados int check (hogares_visitados >= 0),
  personas_contactadas int check (personas_contactadas >= 0),
  personas_aceptan_visita int check (personas_aceptan_visita >= 0),
  nombres_visita text,
  resultado_espiritual text,
  evangelismo_ninos boolean not null default false,
  ninos_alcanzados int check (ninos_alcanzados >= 0),
  receptividad int check (receptividad between 1 and 5),
  dificultad text check (dificultad in ('poco_tiempo','falta_acompanamiento','rechazo','clima','ninguna','otra')),
  dificultad_otra text,
  sugerencias text,
  origen text not null default 'app' check (origen in ('app','google_forms')),
  huella_importacion text unique,
  manzanas_pendientes boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (origen = 'google_forms' or (
    hogares_visitados is not null and personas_contactadas is not null and personas_aceptan_visita is not null
    and resultado_espiritual is not null and receptividad is not null and dificultad is not null
    and (not evangelismo_ninos or ninos_alcanzados is not null)
    and (dificultad <> 'otra' or dificultad_otra is not null)))
);
create index on reportes (fecha_jornada);
create index on reportes (zona_id);

create table reporte_manzanas (
  reporte_id uuid not null references reportes(id) on delete cascade,
  manzana_id uuid not null references manzanas(id),
  primary key (reporte_id, manzana_id)
);
create index on reporte_manzanas (manzana_id);

create table casos_especiales (
  id uuid primary key default gen_random_uuid(),
  reporte_id uuid not null references reportes(id) on delete cascade,
  zona_id uuid not null references zonas(id),
  tipo text not null check (tipo in ('enfermo','sordo','consejeria')),
  descripcion text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','atendido')),
  atendido_en timestamptz,
  unique (reporte_id, tipo)
);

-- Ayudantes de permisos. security definer para que no dependan de las políticas de perfiles.
create function usuario_activo() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from perfiles where id = auth.uid() and activo) $$;
create function es_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select exists (select 1 from perfiles where id = auth.uid() and activo and rol = 'administrador') $$;
create function mi_zona() returns uuid language sql stable security definer set search_path = public as
  $$ select zona_id from perfiles where id = auth.uid() and activo $$;

alter table zonas enable row level security;
alter table manzanas enable row level security;
alter table perfiles enable row level security;
alter table reportes enable row level security;
alter table reporte_manzanas enable row level security;
alter table casos_especiales enable row level security;

create policy zonas_leer on zonas for select to authenticated using (usuario_activo());
create policy zonas_admin on zonas for all to authenticated using (es_admin()) with check (es_admin());
create policy manzanas_leer on manzanas for select to authenticated using (usuario_activo());
create policy manzanas_admin on manzanas for all to authenticated using (es_admin()) with check (es_admin());

create policy perfiles_leer on perfiles for select to authenticated using (id = auth.uid() or es_admin());
create policy perfiles_admin on perfiles for all to authenticated using (es_admin()) with check (es_admin());

create policy reportes_leer on reportes for select to authenticated using (es_admin() or zona_id = mi_zona());
create policy reportes_crear on reportes for insert to authenticated
  with check (es_admin() or (zona_id = mi_zona() and creado_por = auth.uid()));
create policy reportes_editar on reportes for update to authenticated
  using (es_admin() or (zona_id = mi_zona() and creado_por = auth.uid()))
  with check (es_admin() or (zona_id = mi_zona() and creado_por = auth.uid()));
create policy reportes_eliminar on reportes for delete to authenticated using (es_admin());

create policy rm_leer on reporte_manzanas for select to authenticated using (
  exists (select 1 from reportes r where r.id = reporte_id));
create policy rm_escribir on reporte_manzanas for all to authenticated
  using (exists (select 1 from reportes r where r.id = reporte_id and (es_admin() or r.creado_por = auth.uid())))
  with check (exists (select 1 from reportes r join manzanas m on m.id = manzana_id
    where r.id = reporte_id and m.zona_id = r.zona_id and (es_admin() or r.creado_por = auth.uid())));

create policy casos_leer on casos_especiales for select to authenticated using (es_admin() or zona_id = mi_zona());
create policy casos_crear on casos_especiales for insert to authenticated with check (
  (es_admin() or zona_id = mi_zona())
  and exists (select 1 from reportes r where r.id = reporte_id and r.zona_id = casos_especiales.zona_id));
create policy casos_editar on casos_especiales for update to authenticated
  using (es_admin() or zona_id = mi_zona()) with check (es_admin() or zona_id = mi_zona());
create policy casos_eliminar on casos_especiales for delete to authenticated using (es_admin() or zona_id = mi_zona());

-- Guarda un reporte con sus manzanas y casos en una sola transacción. Corre con los permisos del usuario.
create function guardar_reporte(p_id uuid, p_reporte jsonb, p_manzanas uuid[], p_casos jsonb)
returns uuid language plpgsql set search_path = public as $$
declare v_id uuid; v_origen text;
begin
  if p_id is null and coalesce(array_length(p_manzanas, 1), 0) = 0 then
    raise exception 'Marque al menos una manzana' using errcode = 'P0001';
  end if;
  if p_id is null then
    insert into reportes (zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias)
    select zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias
    from jsonb_populate_record(null::reportes, p_reporte)
    returning id into v_id;
  else
    update reportes r set
      responsable_nombre = n.responsable_nombre, coordinador_nombre = n.coordinador_nombre,
      fecha_jornada = n.fecha_jornada, direccion = n.direccion, hogares_visitados = n.hogares_visitados,
      personas_contactadas = n.personas_contactadas, personas_aceptan_visita = n.personas_aceptan_visita,
      nombres_visita = n.nombres_visita, resultado_espiritual = n.resultado_espiritual,
      evangelismo_ninos = n.evangelismo_ninos, ninos_alcanzados = n.ninos_alcanzados,
      receptividad = n.receptividad, dificultad = n.dificultad, dificultad_otra = n.dificultad_otra,
      sugerencias = n.sugerencias, actualizado_en = now(),
      manzanas_pendientes = coalesce(array_length(p_manzanas, 1), 0) = 0 and r.origen = 'google_forms'
    from jsonb_populate_record(null::reportes, p_reporte) n
    where r.id = p_id
    returning r.id, r.origen into v_id, v_origen;
    if v_id is null then raise exception 'No tiene permiso para editar este reporte' using errcode = '42501'; end if;
    if v_origen = 'app' and coalesce(array_length(p_manzanas, 1), 0) = 0 then
      raise exception 'Marque al menos una manzana' using errcode = 'P0001';
    end if;
    delete from reporte_manzanas where reporte_id = v_id;
  end if;

  insert into reporte_manzanas (reporte_id, manzana_id) select v_id, unnest(p_manzanas);

  delete from casos_especiales c where c.reporte_id = v_id
    and c.tipo not in (select jsonb_array_elements(p_casos) ->> 'tipo');
  insert into casos_especiales (reporte_id, zona_id, tipo, descripcion)
    select v_id, r.zona_id, e ->> 'tipo', e ->> 'descripcion'
    from jsonb_array_elements(p_casos) e, reportes r where r.id = v_id
    on conflict (reporte_id, tipo) do update set descripcion = excluded.descripcion;
  return v_id;
end $$;

-- Lo que todos pueden ver: nada de texto libre ni datos personales.
create function estado_manzanas(p_desde date, p_hasta date)
returns table (manzana_id uuid, ultima_fecha date, jornadas bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not usuario_activo() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  return query
    select rm.manzana_id, max(r.fecha_jornada), count(*)
    from reporte_manzanas rm join reportes r on r.id = rm.reporte_id
    where r.fecha_jornada between p_desde and p_hasta
    group by rm.manzana_id;
end $$;

create function estadisticas(p_desde date, p_hasta date, p_zona uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not usuario_activo() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  with f as (
    select * from reportes
    where fecha_jornada between p_desde and p_hasta and (p_zona is null or zona_id = p_zona)
  ), alcanzadas as (
    select distinct rm.manzana_id from reporte_manzanas rm join f on f.id = rm.reporte_id
  )
  select jsonb_build_object(
    'totales', (select jsonb_build_object(
        'jornadas', count(*),
        'hogares', coalesce(sum(hogares_visitados), 0),
        'personas', coalesce(sum(personas_contactadas), 0),
        'visitas', coalesce(sum(personas_aceptan_visita), 0),
        'ninos', coalesce(sum(ninos_alcanzados), 0),
        'receptividad', round(avg(receptividad), 2),
        'pendientes_marcar', count(*) filter (where manzanas_pendientes)) from f),
    'por_zona', (select coalesce(jsonb_agg(x order by x.numero), '[]') from (
        select z.numero, z.nombre,
          (select count(*) from manzanas m where m.zona_id = z.id and m.activa) as manzanas_total,
          (select count(*) from manzanas m join alcanzadas a on a.manzana_id = m.id where m.zona_id = z.id and m.activa) as manzanas_alcanzadas,
          (select count(*) from f where f.zona_id = z.id) as jornadas,
          (select coalesce(sum(personas_contactadas), 0) from f where f.zona_id = z.id) as personas
        from zonas z where p_zona is null or z.id = p_zona) x),
    'por_mes', (select coalesce(jsonb_agg(x order by x.mes), '[]') from (
        select to_char(fecha_jornada, 'YYYY-MM') as mes, count(*) as jornadas,
          coalesce(sum(personas_contactadas), 0) as personas, coalesce(sum(hogares_visitados), 0) as hogares
        from f group by 1) x),
    'dificultades', (select coalesce(jsonb_agg(x order by x.cantidad desc), '[]') from (
        select dificultad, count(*) as cantidad from f where dificultad is not null group by 1) x),
    'casos', (select coalesce(jsonb_agg(x), '[]') from (
        select c.tipo, count(*) as cantidad, count(*) filter (where c.estado = 'pendiente') as pendientes
        from casos_especiales c join f on f.id = c.reporte_id group by 1) x)
  ) into v;
  return v;
end $$;

-- Importa filas ya validadas. Devuelve cuántas son nuevas.
create function importar_reportes(p_filas jsonb) returns int
language plpgsql set search_path = public as $$
declare e jsonb; v_id uuid; v_n int := 0;
begin
  if not es_admin() then raise exception 'Sin acceso' using errcode = '42501'; end if;
  for e in select * from jsonb_array_elements(p_filas) loop
    insert into reportes (zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias,
      origen, huella_importacion, manzanas_pendientes)
    select zona_id, responsable_nombre, coordinador_nombre, fecha_jornada, direccion,
      hogares_visitados, personas_contactadas, personas_aceptan_visita, nombres_visita, resultado_espiritual,
      evangelismo_ninos, ninos_alcanzados, receptividad, dificultad, dificultad_otra, sugerencias,
      'google_forms', huella_importacion, true
    from jsonb_populate_record(null::reportes, e -> 'reporte')
    on conflict (huella_importacion) do nothing
    returning id into v_id;
    if v_id is not null then
      v_n := v_n + 1;
      insert into casos_especiales (reporte_id, zona_id, tipo, descripcion)
        select v_id, (e -> 'reporte' ->> 'zona_id')::uuid, c ->> 'tipo', c ->> 'descripcion'
        from jsonb_array_elements(e -> 'casos') c;
      v_id := null;
    end if;
  end loop;
  return v_n;
end $$;

revoke execute on function guardar_reporte(uuid, jsonb, uuid[], jsonb), estado_manzanas(date, date),
  estadisticas(date, date, uuid), importar_reportes(jsonb), usuario_activo(), es_admin(), mi_zona() from public, anon;
grant execute on function guardar_reporte(uuid, jsonb, uuid[], jsonb), estado_manzanas(date, date),
  estadisticas(date, date, uuid), importar_reportes(jsonb), usuario_activo(), es_admin(), mi_zona() to authenticated;
