// Prueba la app contra el proyecto Supabase real con cuentas temporales.
// Las crea y las borra scripts/probar-movil.mjs, que pasa los datos por variables de entorno.
import 'dart:async';
import 'dart:io';

import 'package:evangelismo_ipuc/datos/repositorio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  final env = Platform.environment;
  final url = env['IPUC_URL'] ?? '';
  final clave = env['IPUC_CLAVE_PUBLICA'] ?? '';
  final sinDatos = url.isEmpty ? 'Faltan las variables IPUC_*; se ejecuta con scripts/probar-movil.mjs' : null;
  final marca = env['IPUC_MARCA'] ?? 'MOVIL';

  Repositorio nuevo() => Repositorio(SupabaseClient(url, clave, authOptions: const AuthClientOptions(authFlowType: AuthFlowType.implicit)));

  test('un líder entra con usuario, guarda culto, hogar VIS y jornada en su zona', () async {
    final lider = nuevo();
    await lider.ingresar(env['IPUC_LIDER']!, env['IPUC_LIDER_CLAVE']!);
    final perfil = (await lider.perfil())!;
    expect(perfil.zonaId, env['IPUC_ZONA']);

    final manzanas = (await lider.manzanas()).where((m) => m.zonaId == perfil.zonaId).toList();
    final centro = manzanas.first.area.first.first.first;
    final idCulto = await lider.guardarCulto({
      'zona_id': perfil.zonaId, 'fecha': DateTime.now().toIso8601String().substring(0, 10), 'direccion': '$marca casa',
      'lat': centro.latitude, 'lon': centro.longitude, 'hermanos': 9, 'amigos': 2, 'ninos': 1, 'ofrenda': 25000,
      'hubo_enfermos': false, 'se_oro_enfermos': false,
    });
    expect(idCulto, isNotEmpty);

    final idHogar = await lider.guardarHogar({
      'zona_id': perfil.zonaId, 'familia': '$marca familia', 'direccion': 'Calle 1', 'autorizacion_menores': true,
    }, [
      {'nombre': '$marca madre', 'edad': 34, 'parentesco': 'Madre'},
      {'nombre': '$marca niño', 'edad': 7, 'parentesco': 'Hijo', 'enfermo': true},
    ]);
    expect(idHogar, isNotEmpty);
    final hogares = await lider.hogares(soloConUbicacion: false);
    expect(hogares.where((h) => h['id'] == idHogar).single['personas'], hasLength(2));

    // Sin autorización la base de datos rechaza al menor y no deja el hogar a medias, aunque la app no validara.
    await expectLater(
      lider.guardarHogar({'zona_id': perfil.zonaId, 'familia': '$marca sin permiso', 'direccion': 'Calle 1'}, [
        {'nombre': '$marca niño', 'edad': 7, 'parentesco': 'Hijo'},
      ]),
      throwsA(isA<PostgrestException>()),
    );
    expect((await lider.hogares(soloConUbicacion: false)).where((h) => h['familia'] == '$marca sin permiso'), isEmpty);

    final idReporte = await lider.guardarReporte({
      'zona_id': perfil.zonaId, 'responsable_nombre': marca, 'coordinador_nombre': 'C', 'fecha_jornada': DateTime.now().toIso8601String().substring(0, 10),
      'hogares_visitados': 6, 'personas_contactadas': 10, 'personas_aceptan_visita': 1, 'resultado_espiritual': '$marca resultado',
      'evangelismo_ninos': false, 'receptividad': 4, 'dificultad': 'ninguna',
    }, [manzanas.first.id], []);
    expect(idReporte, isNotEmpty);
    final alcanzadas = await lider.manzanasAlcanzadas('2000-01-01', '2100-12-31');
    expect(alcanzadas, contains(manzanas.first.id));
    await lider.salir();
  }, skip: sinDatos, timeout: const Timeout(Duration(minutes: 2)));

  test('un líder no puede registrar en otra zona', () async {
    final lider = nuevo();
    await lider.ingresar(env['IPUC_LIDER']!, env['IPUC_LIDER_CLAVE']!);
    await expectLater(
      lider.guardarCulto({'zona_id': env['IPUC_OTRA_ZONA'], 'fecha': '2026-01-01', 'direccion': '$marca ajena', 'lat': 10.46, 'lon': -73.25, 'hermanos': 1, 'amigos': 0, 'ninos': 0}),
      throwsA(isA<PostgrestException>()),
    );
    await lider.salir();
  }, skip: sinDatos);

  test('el coordinador recibe en tiempo real el culto que guarda el líder; otra zona no lo ve', () async {
    final coordinador = nuevo();
    await coordinador.ingresar(env['IPUC_COORDINADOR']!, env['IPUC_COORDINADOR_CLAVE']!);
    final recibido = Completer<Map<String, dynamic>>();
    final canal = coordinador.escuchar('cultos', (c) {
      if (c.eventType == PostgresChangeEvent.insert && !recibido.isCompleted) recibido.complete(c.newRecord);
    });
    await Future<void>.delayed(const Duration(seconds: 3));

    final lider = nuevo();
    await lider.ingresar(env['IPUC_LIDER']!, env['IPUC_LIDER_CLAVE']!);
    final zona = (await lider.perfil())!.zonaId;
    await lider.guardarCulto({'zona_id': zona, 'fecha': DateTime.now().toIso8601String().substring(0, 10), 'direccion': '$marca en vivo',
      'lat': 10.4625, 'lon': -73.2585, 'hermanos': 4, 'amigos': 1, 'ninos': 0});
    final fila = await recibido.future.timeout(const Duration(seconds: 20));
    expect(fila['direccion'], '$marca en vivo');
    await coordinador.dejarDeEscuchar(canal);

    final ajeno = nuevo();
    await ajeno.ingresar(env['IPUC_AJENO']!, env['IPUC_AJENO_CLAVE']!);
    final suyos = await ajeno.cultos('2000-01-01', '2100-12-31');
    expect(suyos.where((c) => (c['direccion'] as String).startsWith(marca)), isEmpty);
    await Future.wait([coordinador.salir(), lider.salir(), ajeno.salir()]);
  }, skip: sinDatos, timeout: const Timeout(Duration(minutes: 2)));
}
