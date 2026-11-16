import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'datos/repositorio.dart';
import 'pantallas/ingreso.dart';
import 'pantallas/inicio.dart';
import 'pantallas/sesion.dart';

// Se pasan al compilar (--dart-define); la clave pública de Supabase no da acceso a nada sin iniciar sesión.
const _url = String.fromEnvironment('SUPABASE_URL');
const _clavePublica = String.fromEnvironment('SUPABASE_ANON_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (_url.isEmpty || _clavePublica.isEmpty) {
    runApp(const MaterialApp(home: Scaffold(body: Center(child: Text('La app se compiló sin la conexión a Supabase.')))));
    return;
  }
  await Supabase.initialize(url: _url, publishableKey: _clavePublica);
  runApp(AppEvangelismo(repo: Repositorio(Supabase.instance.client)));
}

class AppEvangelismo extends StatelessWidget {
  const AppEvangelismo({super.key, required this.repo});
  final Repositorio repo;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Evangelismo IPUC',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xFF1D4ED8), useMaterial3: true),
        darkTheme: ThemeData(colorSchemeSeed: const Color(0xFF1D4ED8), useMaterial3: true, brightness: Brightness.dark),
        locale: const Locale('es', 'CO'),
        supportedLocales: const [Locale('es', 'CO'), Locale('es')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        home: _Puerta(repo: repo),
      );
}

/// Muestra el ingreso o el inicio según haya sesión.
class _Puerta extends StatelessWidget {
  const _Puerta({required this.repo});
  final Repositorio repo;

  @override
  Widget build(BuildContext context) => StreamBuilder<AuthState>(
        stream: repo.db.auth.onAuthStateChange,
        builder: (context, _) {
          if (repo.db.auth.currentSession == null) return PantallaIngreso(alIngresar: repo.ingresar);
          return FutureBuilder<Sesion?>(
            key: ValueKey(repo.db.auth.currentUser?.id),
            future: Sesion.cargar(repo),
            builder: (context, s) {
              if (s.connectionState != ConnectionState.done) return const Scaffold(body: Center(child: CircularProgressIndicator()));
              final sesion = s.data;
              if (sesion == null) {
                return Scaffold(
                  body: Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('Su cuenta no está activa o no hay conexión.'),
                      TextButton(onPressed: repo.salir, child: const Text('Volver al ingreso')),
                    ]),
                  ),
                );
              }
              return PantallaInicio(sesion: sesion);
            },
          );
        },
      );
}
