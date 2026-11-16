import 'package:supabase_flutter/supabase_flutter.dart';

import 'modelos.dart';
import 'reglas.dart';

/// Todo el acceso a Supabase. Las reglas de acceso (RLS) las aplica la base de datos:
/// cada consulta solo devuelve lo que el usuario puede ver.
class Repositorio {
  Repositorio(this.db);
  final SupabaseClient db;

  Future<void> ingresar(String usuario, String clave) =>
      db.auth.signInWithPassword(email: aCorreo(usuario), password: clave);

  Future<void> salir() => db.auth.signOut();

  Future<Perfil?> perfil() async {
    final uid = db.auth.currentUser?.id;
    if (uid == null) return null;
    final m = await db.from('perfiles').select().eq('id', uid).maybeSingle();
    if (m == null || m['activo'] != true) return null;
    return Perfil.desde(m);
  }

  Future<List<Zona>> zonas() async =>
      (await db.from('zonas').select().order('numero')).map(Zona.desde).toList();

  Future<List<Zona>> sectores() async =>
      (await db.from('sectores').select().order('numero')).map(Zona.desde).toList();

  Future<List<Manzana>> manzanas() async =>
      (await db.from('manzanas').select('id,zona_id,codigo,geometria,activa').order('codigo')).map(Manzana.desde).toList();

  Future<Set<String>> manzanasAlcanzadas(String desde, String hasta) async {
    final filas = await db.rpc('estado_manzanas', params: {'p_desde': desde, 'p_hasta': hasta}) as List;
    return filas.map((f) => f['manzana_id'] as String).toSet();
  }

  Future<List<Map<String, dynamic>>> cultos(String desde, String hasta) => db
      .from('cultos')
      .select('id,zona_id,fecha,dia_semana,direccion,lat,lon,hermanos,amigos,ninos')
      .gte('fecha', desde)
      .lte('fecha', hasta);

  Future<List<Map<String, dynamic>>> personas() =>
      db.from('personas').select('id,tipo,zona_id,nombre,edad,lat,lon,pide_oracion,enfermo').eq('tipo', 'amigo').not('lat', 'is', null);

  /// Hogares de VIS con la edad y la situación de sus integrantes.
  Future<List<Map<String, dynamic>>> hogares({bool soloConUbicacion = true}) {
    final q = db.from('hogares').select('id,zona_id,familia,direccion,lat,lon,pide_oracion,creado_en,personas(edad,enfermo,pide_oracion)');
    return soloConUbicacion ? q.not('lat', 'is', null) : q;
  }

  Future<String> guardarCulto(Map<String, dynamic> fila) async =>
      (await db.from('cultos').insert(fila).select('id').single())['id'] as String;

  Future<String> guardarPersona(Map<String, dynamic> fila) async =>
      (await db.from('personas').insert(fila).select('id').single())['id'] as String;

  /// Guarda el hogar y sus integrantes en una sola transacción; la base de datos exige la autorización si hay menores.
  Future<String> guardarHogar(Map<String, dynamic> hogar, List<Map<String, dynamic>> integrantes) async =>
      await db.rpc('guardar_hogar', params: {'p_hogar': hogar, 'p_integrantes': integrantes}) as String;

  /// Guarda el reporte con sus manzanas y casos en una sola transacción (función de la base de datos).
  Future<String> guardarReporte(Map<String, dynamic> reporte, List<String> manzanas, List<Map<String, String>> casos) async =>
      await db.rpc('guardar_reporte', params: {'p_id': null, 'p_reporte': reporte, 'p_manzanas': manzanas, 'p_casos': casos})
          as String;

  /// Avisa cada vez que cambia la tabla; solo llegan los cambios que el usuario puede ver.
  RealtimeChannel escuchar(String tabla, void Function(PostgresChangePayload) alCambiar) => db
      .channel('movil-$tabla-${DateTime.now().microsecondsSinceEpoch}')
      .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: tabla, callback: alCambiar)
      .subscribe();

  Future<void> dejarDeEscuchar(RealtimeChannel canal) => db.removeChannel(canal);
}
