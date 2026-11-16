-- VIS pasa de fichas de niños a la visitación del hogar con toda su familia.
-- Los integrantes son filas de personas (tipo 'integrante') para reutilizar mapa, filtros y totales.

create table hogares (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  familia text not null check (length(trim(familia)) > 0),
  direccion text not null check (length(trim(direccion)) > 0),
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  precision_m double precision,
  telefono text,
  calamidad text,
  pide_oracion boolean not null default false,
  peticion text,
  atendio text,
  -- Ley 1581 de 2012: los datos de menores requieren autorización de su representante.
  autorizacion_menores boolean not null default false,
  estado_seguimiento text not null default 'nuevo'
    check (estado_seguimiento in ('nuevo','en_seguimiento','congregado','sin_contacto')),
  notas text,
  culto_id uuid references cultos(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check ((lat is null) = (lon is null))
);
create index on hogares (zona_id);

-- personas: deja de existir nino_vis; aparecen los integrantes de un hogar.
alter table personas drop constraint personas_tipo_check;
alter table personas drop column acudiente, drop column autorizacion_acudiente;
alter table personas add column hogar_id uuid references hogares(id) on delete cascade, add column parentesco text;
alter table personas add constraint personas_tipo_check check (tipo in ('amigo','integrante'));
alter table personas add constraint personas_integrante_hogar check ((tipo = 'integrante') = (hogar_id is not null));
create index on personas (hogar_id);

-- El integrante toma la zona del hogar, y un menor exige la autorización del hogar.
create function integrantes_reglas() returns trigger language plpgsql security definer set search_path = public as $$
declare h hogares%rowtype;
begin
  if new.tipo <> 'integrante' then return new; end if;
  select * into h from hogares where id = new.hogar_id;
  new.zona_id := h.zona_id;
  if new.edad is not null and new.edad < 18 and not h.autorizacion_menores then
    raise exception 'Falta la autorización del adulto responsable para registrar menores' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger integrantes_reglas before insert or update on personas for each row execute function integrantes_reglas();

create function hogares_proteger() returns trigger language plpgsql set search_path = public as $$
begin
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  new.actualizado_en := now();
  if not new.autorizacion_menores and exists (select 1 from personas where hogar_id = new.id and edad < 18) then
    raise exception 'El hogar tiene menores registrados; la autorización no se puede quitar' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger hogares_proteger before update on hogares for each row execute function hogares_proteger();

-- Si el hogar cambia de zona, sus integrantes y visitas lo siguen.
create function hogares_zona() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.zona_id <> old.zona_id then
    update personas set zona_id = new.zona_id where hogar_id = new.id;
    update visitas set zona_id = new.zona_id where hogar_id = new.id;
  end if;
  return new;
end $$;

-- Visitas: a un hogar o a un amigo, exactamente uno.
alter table visitas alter column persona_id drop not null;
alter table visitas add column hogar_id uuid references hogares(id) on delete cascade;
alter table visitas add constraint visitas_destino check (num_nonnulls(persona_id, hogar_id) = 1);
create index on visitas (hogar_id);

create trigger hogares_zona after update of zona_id on hogares for each row execute function hogares_zona();

create or replace function visitas_zona() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.hogar_id is not null then
    select zona_id into new.zona_id from hogares where id = new.hogar_id;
  else
    select zona_id into new.zona_id from personas where id = new.persona_id;
  end if;
  return new;
end $$;

alter table hogares enable row level security;
create policy hogares_leer on hogares for select to authenticated using (zona_id in (select zonas_visibles()));
create policy hogares_crear on hogares for insert to authenticated
  with check (creado_por = auth.uid() and zona_id in (select zonas_visibles()));
create policy hogares_editar on hogares for update to authenticated
  using (puede_corregir(zona_id, creado_por)) with check (puede_corregir(zona_id, creado_por));
create policy hogares_eliminar on hogares for delete to authenticated using (es_admin());

-- Quien puede corregir el hogar puede quitarle integrantes.
create policy personas_quitar_integrante on personas for delete to authenticated
  using (tipo = 'integrante' and exists (select 1 from hogares h where h.id = hogar_id and puede_corregir(h.zona_id, h.creado_por)));

-- Guarda el hogar y sus integrantes en una sola transacción. Con id, corrige; sin id, crea.
-- security invoker: las reglas de acceso se aplican igual que en un insert o update directo.
create function guardar_hogar(p_hogar jsonb, p_integrantes jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid := nullif(p_hogar->>'id', '')::uuid; v_conservar uuid[]; i jsonb;
begin
  if v_id is null then
    insert into hogares (zona_id, familia, direccion, lat, lon, precision_m, telefono, calamidad, pide_oracion, peticion,
                         atendio, autorizacion_menores, estado_seguimiento, notas, culto_id)
    values ((p_hogar->>'zona_id')::uuid, p_hogar->>'familia', p_hogar->>'direccion', (p_hogar->>'lat')::float8, (p_hogar->>'lon')::float8,
            (p_hogar->>'precision_m')::float8, p_hogar->>'telefono', p_hogar->>'calamidad', coalesce((p_hogar->>'pide_oracion')::bool, false),
            p_hogar->>'peticion', p_hogar->>'atendio', coalesce((p_hogar->>'autorizacion_menores')::bool, false),
            coalesce(p_hogar->>'estado_seguimiento', 'nuevo'), p_hogar->>'notas', nullif(p_hogar->>'culto_id', '')::uuid)
    returning id into v_id;
  else
    update hogares set zona_id = (p_hogar->>'zona_id')::uuid, familia = p_hogar->>'familia', direccion = p_hogar->>'direccion',
      lat = (p_hogar->>'lat')::float8, lon = (p_hogar->>'lon')::float8, precision_m = (p_hogar->>'precision_m')::float8,
      telefono = p_hogar->>'telefono', calamidad = p_hogar->>'calamidad', pide_oracion = coalesce((p_hogar->>'pide_oracion')::bool, false),
      peticion = p_hogar->>'peticion', atendio = p_hogar->>'atendio', autorizacion_menores = coalesce((p_hogar->>'autorizacion_menores')::bool, false),
      estado_seguimiento = coalesce(p_hogar->>'estado_seguimiento', 'nuevo'), notas = p_hogar->>'notas'
    where id = v_id;
    if not found then raise exception 'No puede corregir este hogar' using errcode = '42501'; end if;
  end if;

  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_conservar
  from jsonb_array_elements(p_integrantes) x where nullif(x->>'id', '') is not null;
  delete from personas where hogar_id = v_id and id <> all (v_conservar);

  for i in select * from jsonb_array_elements(p_integrantes) loop
    if nullif(i->>'id', '') is null then
      insert into personas (tipo, hogar_id, zona_id, nombre, edad, parentesco, telefono, enfermo, pide_oracion, peticion, entrego_vida, estado_seguimiento)
      values ('integrante', v_id, (p_hogar->>'zona_id')::uuid, i->>'nombre', (i->>'edad')::int, i->>'parentesco', i->>'telefono',
              coalesce((i->>'enfermo')::bool, false), coalesce((i->>'pide_oracion')::bool, false), i->>'peticion',
              coalesce((i->>'entrego_vida')::bool, false), coalesce(i->>'estado_seguimiento', 'nuevo'));
    else
      update personas set nombre = i->>'nombre', edad = (i->>'edad')::int, parentesco = i->>'parentesco', telefono = i->>'telefono',
        enfermo = coalesce((i->>'enfermo')::bool, false), pide_oracion = coalesce((i->>'pide_oracion')::bool, false), peticion = i->>'peticion',
        entrego_vida = coalesce((i->>'entrego_vida')::bool, false), estado_seguimiento = coalesce(i->>'estado_seguimiento', 'nuevo')
      where id = (i->>'id')::uuid and hogar_id = v_id;
    end if;
  end loop;
  return v_id;
end $$;
revoke execute on function guardar_hogar(jsonb, jsonb) from public, anon;
grant execute on function guardar_hogar(jsonb, jsonb) to authenticated;

alter publication supabase_realtime add table hogares;

-- Totales: VIS cuenta hogares; se agregan integrantes y niños (menores de 18) de esos hogares.
create or replace function resumen_actividad(p_desde date, p_hasta date, p_zona uuid default null, p_sector uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with zs as (
    select id, numero, nombre, sector_id from zonas
    where id in (select zonas_visibles()) and (p_zona is null or id = p_zona) and (p_sector is null or sector_id = p_sector)
  ),
  c as (select * from cultos where fecha between p_desde and p_hasta and zona_id in (select id from zs)),
  h as (select * from hogares where (creado_en at time zone 'America/Bogota')::date between p_desde and p_hasta and zona_id in (select id from zs)),
  p as (select * from personas where (creado_en at time zone 'America/Bogota')::date between p_desde and p_hasta and zona_id in (select id from zs)),
  v as (select * from visitas where fecha between p_desde and p_hasta and zona_id in (select id from zs)),
  meses as (
    select to_char(fecha, 'YYYY-MM') mes from c
    union select to_char(creado_en at time zone 'America/Bogota', 'YYYY-MM') from h
    union select to_char(creado_en at time zone 'America/Bogota', 'YYYY-MM') from p
    union select to_char(fecha, 'YYYY-MM') from v
  )
  select jsonb_build_object(
    'cultos', (select jsonb_build_object(
      'total', count(*), 'hermanos', coalesce(sum(hermanos), 0), 'amigos', coalesce(sum(amigos), 0),
      'ninos', coalesce(sum(ninos), 0), 'ofrenda', coalesce(sum(ofrenda), 0),
      'con_enfermos', count(*) filter (where hubo_enfermos), 'se_oro', count(*) filter (where se_oro_enfermos),
      'miercoles', count(*) filter (where dia_semana = 3), 'viernes', count(*) filter (where dia_semana = 5)) from c),
    'personas', (select jsonb_build_object(
      'vis', (select count(*) from h), 'hogares_oracion', (select count(*) from h where pide_oracion),
      'integrantes', count(*) filter (where tipo = 'integrante'), 'ninos', count(*) filter (where tipo = 'integrante' and edad < 18),
      'amigos', count(*) filter (where tipo = 'amigo'),
      'enfermos', count(*) filter (where enfermo), 'piden_oracion', count(*) filter (where pide_oracion),
      'entregaron', count(*) filter (where entrego_vida), 'congregados', count(*) filter (where estado_seguimiento = 'congregado')) from p),
    'visitas', (select count(*) from v),
    'por_zona', (select coalesce(jsonb_agg(x order by x.numero), '[]') from (
      select zs.numero, zs.nombre,
        (select count(*) from c where c.zona_id = zs.id) cultos,
        (select coalesce(sum(hermanos), 0) from c where c.zona_id = zs.id) hermanos,
        (select coalesce(sum(amigos), 0) from c where c.zona_id = zs.id) amigos,
        (select coalesce(sum(ofrenda), 0) from c where c.zona_id = zs.id) ofrenda,
        (select count(*) from h where h.zona_id = zs.id) vis,
        (select count(*) from p where p.zona_id = zs.id and p.tipo = 'integrante') integrantes,
        (select count(*) from p where p.zona_id = zs.id and p.tipo = 'amigo') fichas_amigos,
        (select count(*) from p where p.zona_id = zs.id and p.entrego_vida) entregaron,
        (select count(*) from p where p.zona_id = zs.id and p.pide_oracion) oracion,
        (select count(*) from v where v.zona_id = zs.id) visitas
      from zs) x),
    'por_mes', (select coalesce(jsonb_agg(x order by x.mes), '[]') from (
      select m.mes,
        (select count(*) from c where to_char(c.fecha, 'YYYY-MM') = m.mes) cultos,
        (select count(*) from h where to_char(h.creado_en at time zone 'America/Bogota', 'YYYY-MM') = m.mes) hogares,
        (select count(*) from p where p.tipo = 'amigo' and to_char(p.creado_en at time zone 'America/Bogota', 'YYYY-MM') = m.mes) personas,
        (select count(*) from v where to_char(v.fecha, 'YYYY-MM') = m.mes) visitas
      from meses m) x)
  )
$$;
