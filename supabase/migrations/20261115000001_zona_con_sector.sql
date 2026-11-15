-- Toda zona pertenece a un sector, ahora que la carga inicial los asignó.
alter table zonas alter column sector_id set not null;
