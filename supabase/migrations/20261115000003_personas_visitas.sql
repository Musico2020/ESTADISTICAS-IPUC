-- Fase 3: fichas de niños visitados (VIS) y de amigos, con su historial de visitas.
create table personas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('nino_vis','amigo')),
  zona_id uuid not null references zonas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  nombre text not null check (length(trim(nombre)) > 0),
  edad int check (edad between 0 and 120),
  telefono text,
  direccion text,
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  acudiente text,
  familia text,
  calamidad text,
  enfermo boolean not null default false,
  pide_oracion boolean not null default false,
  peticion text,
  entrego_vida boolean not null default false,
  estado_seguimiento text not null default 'nuevo'
    check (estado_seguimiento in ('nuevo','en_seguimiento','congregado','sin_contacto')),
  notas text,
  culto_id uuid references cultos(id) on delete set null,
  reporte_id uuid references reportes(id) on delete set null,
  -- Ley 1581 de 2012: los datos de un menor requieren autorización de su representante.
  autorizacion_acudiente boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (tipo <> 'nino_vis' or (autorizacion_acudiente and edad between 0 and 17 and length(trim(coalesce(acudiente, ''))) > 0)),
  check ((lat is null) = (lon is null))
);
create index on personas (zona_id, tipo);

create table visitas (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  zona_id uuid not null references zonas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  fecha date not null,
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  notas text,
  creado_en timestamptz not null default now(),
  check ((lat is null) = (lon is null))
);
create index on visitas (persona_id);

-- La visita toma la zona de la persona, para que las reglas de acceso sean las mismas.
create function visitas_zona() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select zona_id into new.zona_id from personas where id = new.persona_id;
  return new;
end $$;
create trigger visitas_zona before insert or update on visitas for each row execute function visitas_zona();

create function personas_proteger() returns trigger language plpgsql set search_path = public as $$
begin
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  new.actualizado_en := now();
  return new;
end $$;
create trigger personas_proteger before update on personas for each row execute function personas_proteger();

create function visitas_proteger() returns trigger language plpgsql set search_path = public as $$
begin
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  return new;
end $$;
create trigger visitas_proteger before update on visitas for each row execute function visitas_proteger();

alter table personas enable row level security;
create policy personas_leer on personas for select to authenticated using (zona_id in (select zonas_visibles()));
create policy personas_crear on personas for insert to authenticated
  with check (creado_por = auth.uid() and zona_id in (select zonas_visibles()));
create policy personas_editar on personas for update to authenticated
  using (puede_corregir(zona_id, creado_por)) with check (puede_corregir(zona_id, creado_por));
create policy personas_eliminar on personas for delete to authenticated using (es_admin());

alter table visitas enable row level security;
create policy visitas_leer on visitas for select to authenticated using (zona_id in (select zonas_visibles()));
-- Cualquiera que vea la ficha puede registrar una visita; corregirla sigue la jerarquía.
create policy visitas_crear on visitas for insert to authenticated
  with check (creado_por = auth.uid() and zona_id in (select zonas_visibles()));
create policy visitas_editar on visitas for update to authenticated
  using (puede_corregir(zona_id, creado_por)) with check (puede_corregir(zona_id, creado_por));
create policy visitas_eliminar on visitas for delete to authenticated using (es_admin());

alter publication supabase_realtime add table personas, visitas;
