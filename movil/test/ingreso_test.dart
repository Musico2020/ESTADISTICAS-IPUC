import 'package:evangelismo_ipuc/pantallas/ingreso.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  Future<void> abrir(WidgetTester t, Future<void> Function(String, String) alIngresar) async {
    await t.pumpWidget(MaterialApp(home: PantallaIngreso(alIngresar: alIngresar)));
  }

  testWidgets('pide usuario y contraseña antes de intentar', (t) async {
    var llamadas = 0;
    await abrir(t, (_, __) async => llamadas++);
    await t.tap(find.text('Iniciar sesión'));
    await t.pump();
    expect(find.text('Escriba su usuario y su contraseña'), findsOneWidget);
    expect(llamadas, 0);
  });

  testWidgets('envía usuario y clave tal como se escriben', (t) async {
    String? recibido;
    await abrir(t, (u, c) async => recibido = '$u|$c');
    await t.enterText(find.byKey(const Key('usuario')), 'lider1');
    await t.enterText(find.byKey(const Key('clave')), 'clave-123');
    await t.tap(find.text('Iniciar sesión'));
    await t.pump();
    expect(recibido, 'lider1|clave-123');
  });

  testWidgets('muestra el error de credenciales', (t) async {
    await abrir(t, (_, __) async => throw const AuthException('Invalid login credentials'));
    await t.enterText(find.byKey(const Key('usuario')), 'x');
    await t.enterText(find.byKey(const Key('clave')), 'y');
    await t.tap(find.text('Iniciar sesión'));
    await t.pump();
    expect(find.text('Usuario o contraseña incorrectos'), findsOneWidget);
  });

  testWidgets('distingue la falta de conexión', (t) async {
    await abrir(t, (_, __) async => throw Exception('sin red'));
    await t.enterText(find.byKey(const Key('usuario')), 'x');
    await t.enterText(find.byKey(const Key('clave')), 'y');
    await t.tap(find.text('Iniciar sesión'));
    await t.pump();
    expect(find.textContaining('Sin conexión'), findsOneWidget);
  });
}
