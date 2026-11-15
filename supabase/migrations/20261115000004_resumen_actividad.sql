-- Fase 5: totales de cultos, VIS, amigos y visitas para estadísticas e informes.
-- security invoker: RLS se aplica, así que cada persona solo suma lo que puede ver.
create function resumen_actividad(p_desde date, p_hasta date, p_zona uuid default null, p_sector uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with zs as (
    select id, numero, nombre, sector_id from zonas
    where id in (select zonas_visibles()) and (p_zona is null or id = p_zona) and (p_sector is null or sector_id = p_sector)
  ),
  c as (select * from cultos where fecha between p_desde and p_hasta and zona_id in (select id from zs)),
  p as (select * from personas where (creado_en at time zone 'America/Bogota')::date between p_desde and p_hasta and zona_id in (select id from zs)),
  v as (select * from visitas where fecha between p_desde and p_hasta and zona_id in (select id from zs)),
  meses as (
    select to_char(fecha, 'YYYY-MM') mes from c
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
      'vis', count(*) filter (where tipo = 'nino_vis'), 'amigos', count(*) filter (where tipo = 'amigo'),
      'enfermos', count(*) filter (where enfermo), 'piden_oracion', count(*) filter (where pide_oracion),
      'entregaron', count(*) filter (where entrego_vida), 'congregados', count(*) filter (where estado_seguimiento = 'congregado')) from p),
    'visitas', (select count(*) from v),
    'por_zona', (select coalesce(jsonb_agg(x order by x.numero), '[]') from (
      select zs.numero, zs.nombre,
        (select count(*) from c where c.zona_id = zs.id) cultos,
        (select coalesce(sum(hermanos), 0) from c where c.zona_id = zs.id) hermanos,
        (select coalesce(sum(amigos), 0) from c where c.zona_id = zs.id) amigos,
        (select coalesce(sum(ofrenda), 0) from c where c.zona_id = zs.id) ofrenda,
        (select count(*) from p where p.zona_id = zs.id and p.tipo = 'nino_vis') vis,
        (select count(*) from p where p.zona_id = zs.id and p.tipo = 'amigo') fichas_amigos,
        (select count(*) from p where p.zona_id = zs.id and p.entrego_vida) entregaron,
        (select count(*) from p where p.zona_id = zs.id and p.pide_oracion) oracion,
        (select count(*) from v where v.zona_id = zs.id) visitas
      from zs) x),
    'por_mes', (select coalesce(jsonb_agg(x order by x.mes), '[]') from (
      select m.mes,
        (select count(*) from c where to_char(c.fecha, 'YYYY-MM') = m.mes) cultos,
        (select count(*) from p where to_char(p.creado_en at time zone 'America/Bogota', 'YYYY-MM') = m.mes) personas,
        (select count(*) from v where to_char(v.fecha, 'YYYY-MM') = m.mes) visitas
      from meses m) x)
  )
$$;

revoke execute on function resumen_actividad(date, date, uuid, uuid) from public, anon;
grant execute on function resumen_actividad(date, date, uuid, uuid) to authenticated;
