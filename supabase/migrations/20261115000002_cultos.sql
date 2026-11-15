-- Fase 2: cultos en casas (miércoles y viernes), ubicados con el GPS del celular.
create table cultos (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id),
  creado_por uuid not null default auth.uid() references auth.users(id),
  fecha date not null,
  -- 1 = lunes ... 7 = domingo
  dia_semana int generated always as (extract(isodow from fecha)::int) stored,
  direccion text not null check (length(trim(direccion)) > 0),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  precision_m int check (precision_m >= 0),
  hermanos int not null check (hermanos >= 0),
  amigos int not null check (amigos >= 0),
  ninos int not null check (ninos >= 0),
  ofrenda bigint not null default 0 check (ofrenda >= 0),
  hubo_enfermos boolean not null default false,
  se_oro_enfermos boolean not null default false,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (hubo_enfermos or not se_oro_enfermos)
);
create index on cultos (fecha);
create index on cultos (zona_id);

alter table cultos enable row level security;
create policy cultos_leer on cultos for select to authenticated using (zona_id in (select zonas_visibles()));
create policy cultos_crear on cultos for insert to authenticated
  with check (creado_por = auth.uid() and zona_id in (select zonas_visibles()));
create policy cultos_editar on cultos for update to authenticated
  using (puede_corregir(zona_id, creado_por)) with check (puede_corregir(zona_id, creado_por));
create policy cultos_eliminar on cultos for delete to authenticated using (es_admin());

-- Nadie cambia el autor ni la fecha de creación al corregir.
create function cultos_proteger() returns trigger language plpgsql set search_path = public as $$
begin
  new.creado_por := old.creado_por;
  new.creado_en := old.creado_en;
  new.actualizado_en := now();
  return new;
end $$;
create trigger cultos_proteger before update on cultos for each row execute function cultos_proteger();

-- Tiempo real: Supabase entrega los cambios respetando las políticas de arriba.
alter publication supabase_realtime add table cultos;
