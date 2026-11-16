import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../ui/tema.dart';

class PantallaIngreso extends StatefulWidget {
  const PantallaIngreso({super.key, required this.alIngresar});
  final Future<void> Function(String usuario, String clave) alIngresar;

  @override
  State<PantallaIngreso> createState() => _PantallaIngresoState();
}

class _PantallaIngresoState extends State<PantallaIngreso> {
  final _usuario = TextEditingController();
  final _clave = TextEditingController();
  String? _error;
  bool _enviando = false;
  bool _ver = false;

  Future<void> _entrar() async {
    if (_usuario.text.trim().isEmpty || _clave.text.isEmpty) {
      setState(() => _error = 'Escriba su usuario y su contraseña');
      return;
    }
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await widget.alIngresar(_usuario.text, _clave.text);
    } on AuthException {
      if (mounted) setState(() => _error = 'Usuario o contraseña incorrectos');
    } catch (_) {
      if (mounted)
        setState(
          () => _error = 'Sin conexión. Revise el internet e intente de nuevo.',
        );
    }
    if (mounted) setState(() => _enviando = false);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Colores.navy, Colores.navy2, Color(0xFF1D4ED8)],
        ),
      ),
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Image.asset(
                          'assets/logo-ipuc.png',
                          height: 140,
                          semanticLabel: 'Logo de la Iglesia Pentecostal Unida de Colombia',
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Evangelismo IPUC',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const Text(
                        'Barrio Dangond · Valledupar',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        key: const Key('usuario'),
                        controller: _usuario,
                        autocorrect: false,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                          labelText: 'Usuario',
                          prefixIcon: Icon(Icons.person),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        key: const Key('clave'),
                        controller: _clave,
                        obscureText: !_ver,
                        onSubmitted: (_) => _entrar(),
                        decoration: InputDecoration(
                          labelText: 'Contraseña',
                          prefixIcon: const Icon(Icons.lock),
                          suffixIcon: IconButton(
                            tooltip: _ver ? 'Ocultar' : 'Mostrar',
                            icon: Icon(
                              _ver ? Icons.visibility_off : Icons.visibility,
                            ),
                            onPressed: () => setState(() => _ver = !_ver),
                          ),
                        ),
                      ),
                      if (_error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            _error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ),
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: _enviando ? null : _entrar,
                        icon: const Icon(Icons.login),
                        label: Text(
                          _enviando ? 'Entrando...' : 'Iniciar sesión',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
