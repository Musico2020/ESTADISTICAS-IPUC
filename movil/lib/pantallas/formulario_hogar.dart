import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../datos/reglas.dart';
import '../ui/campos.dart';
import '../ui/mapa_base.dart';
import '../ui/pasos.dart';
import '../ui/tema.dart';
import 'sesion.dart';

/// VIS: registro del hogar visitado con toda su familia.
class FormularioHogar extends StatefulWidget {
  const FormularioHogar({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<FormularioHogar> createState() => _FormularioHogarState();
}

class _FormularioHogarState extends State<FormularioHogar> {
  final _c = {for (final k in ['familia', 'direccion', 'telefono', 'atendio', 'calamidad', 'peticion', 'notas']) k: TextEditingController()};
  // Cada integrante tiene sus controles de texto; se guardan aparte para que no se pierdan al redibujar.
  final _integrantes = <Integrante>[Integrante()];
  final _textos = <Map<String, TextEditingController>>[_controles()];
  late String? _zona = widget.sesion.perfil.zonaId;
  LatLng? _ubicacion;
  int? _precision;
  bool _oracion = false;
  bool _autorizacion = false;
  String _estado = 'nuevo';
  bool _gps = false;
  bool _enviando = false;
  Map<String, String> _errores = {};

  static Map<String, TextEditingController> _controles() => {for (final k in ['nombre', 'edad', 'telefono', 'peticion']) k: TextEditingController()};

  String _t(String k) => _c[k]!.text.trim();
  void _quitar(String c) => setState(() => _errores = {..._errores}..remove(c));

  void _sincronizar() {
    for (var n = 0; n < _integrantes.length; n++) {
      final i = _integrantes[n], t = _textos[n];
      i.nombre = t['nombre']!.text;
      i.edad = t['edad']!.text;
      i.telefono = t['telefono']!.text;
      i.peticion = t['peticion']!.text;
    }
  }

  void _agregar() => setState(() {
        _integrantes.add(Integrante());
        _textos.add(_controles());
        _errores.remove('integrantes');
      });

  void _quitarIntegrante(int n) => setState(() {
        _integrantes.removeAt(n);
        _textos.removeAt(n);
        // Los errores de integrantes se numeran por posición: se recalculan al guardar.
        _errores.removeWhere((k, _) => k.startsWith('i'));
      });

  void _ubicar(LatLng p, int? precision) {
    final zona = zonaDePunto(widget.sesion.misZonas, p);
    setState(() {
      _ubicacion = p;
      _precision = precision;
      if (widget.sesion.eligeZona && zona != null) _zona = zona.id;
    });
  }

  Future<void> _usarGps() async {
    setState(() => _gps = true);
    final (punto, precision, error) = await ubicacionActual();
    if (!mounted) return;
    setState(() => _gps = false);
    if (punto != null) {
      _ubicar(punto, precision);
    } else {
      avisar(context, error!, error: true);
    }
  }

  Map<String, String> _validar([Set<String>? campos]) {
    _sincronizar();
    final e = validarHogar(zonaId: _zona, familia: _t('familia'), direccion: _t('direccion'), telefono: _t('telefono'),
        pideOracion: _oracion, peticion: _t('peticion'), autorizacion: _autorizacion, integrantes: _integrantes);
    // Solo se marcan los errores del paso que se está revisando.
    setState(() => _errores = campos == null ? e : {for (final k in e.keys) if (campos.contains(k)) k: e[k]!});
    return e;
  }

  Future<void> _guardar() async {
    if (_validar().isNotEmpty) {
      avisar(context, 'Revise los campos marcados', error: true);
      return;
    }
    String? o(String k) => _t(k).isEmpty ? null : _t(k);
    setState(() => _enviando = true);
    try {
      await widget.sesion.repo.guardarHogar({
        'zona_id': _zona, 'familia': _t('familia'), 'direccion': _t('direccion'), 'lat': _ubicacion?.latitude, 'lon': _ubicacion?.longitude,
        'precision_m': _precision, 'telefono': o('telefono'), 'atendio': o('atendio'), 'calamidad': o('calamidad'),
        'pide_oracion': _oracion, 'peticion': _oracion ? o('peticion') : null, 'autorizacion_menores': _autorizacion,
        'estado_seguimiento': _estado, 'notas': o('notas'),
      }, [for (final i in _integrantes) i.aFila()]);
      if (!mounted) return;
      avisar(context, 'Hogar guardado con ${_integrantes.length} integrantes.');
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo guardar. Revise el internet; lo escrito no se ha perdido.', error: true);
    }
    if (mounted) setState(() => _enviando = false);
  }

  Widget _integrante(int n) {
    final i = _integrantes[n], t = _textos[n];
    const color = Colores.vis;
    String? err(String c) => _errores['i$n.$c'];
    void limpiar(String c) => _quitar('i$n.$c');
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: color.withValues(alpha: 0.04),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            CircleAvatar(radius: 14, backgroundColor: color, child: Text('${n + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))),
            const SizedBox(width: 10),
            Expanded(
              child: ListenableBuilder(
                listenable: t['nombre']!,
                builder: (_, _) => Text(t['nombre']!.text.trim().isEmpty ? 'Integrante ${n + 1}' : t['nombre']!.text.trim(),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5), overflow: TextOverflow.ellipsis),
              ),
            ),
            if (_integrantes.length > 1)
              IconButton(tooltip: 'Quitar integrante ${n + 1}', icon: const Icon(Icons.delete_outline, color: Colores.peligro), onPressed: () => _quitarIntegrante(n)),
          ]),
          const SizedBox(height: 10),
          Campo('Nombre completo', t['nombre']!, error: err('nombre'), alCambiar: () => limpiar('nombre')),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 110, child: Campo('Edad', t['edad']!, numero: true, error: err('edad'), alCambiar: () { limpiar('edad'); _quitar('autorizacion'); setState(() => i.edad = t['edad']!.text); })),
            const SizedBox(width: 10),
            Expanded(
              child: Desplegable('Parentesco', i.parentesco, {for (final p in parentescos) p: p}, (v) => setState(() { i.parentesco = v; limpiar('parentesco'); }), error: err('parentesco')),
            ),
          ]),
          Campo('Teléfono (opcional)', t['telefono']!, teclado: TextInputType.phone, error: err('telefono'), alCambiar: () => limpiar('telefono')),
          SiNo('¿Está enfermo?', i.enfermo, (v) => setState(() => i.enfermo = v)),
          SiNo('¿Pide oración?', i.pideOracion, (v) => setState(() => i.pideOracion = v)),
          if (i.pideOracion) Campo('Petición de oración', t['peticion']!, error: err('peticion'), alCambiar: () => limpiar('peticion')),
          SiNo('¿Se entregó a Cristo?', i.entregoVida, (v) => setState(() => i.entregoVida = v)),
          Desplegable('Seguimiento', i.estado, estadosSeguimiento, (v) => setState(() => i.estado = v ?? 'nuevo')),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    _sincronizar();
    final menores = _integrantes.where((i) => i.esMenor).length;
    Campo campo(String k, String etiqueta, {int lineas = 1, String? ayuda, TextInputType? teclado, IconData? icono}) =>
        Campo(etiqueta, _c[k]!, lineas: lineas, ayuda: ayuda, teclado: teclado, icono: icono, error: _errores[k], alCambiar: () => _quitar(k));
    final camposIntegrantes = {'integrantes', for (var n = 0; n < _integrantes.length; n++) for (final c in ['nombre', 'edad', 'parentesco', 'telefono', 'peticion']) 'i$n.$c'};
    return ConSeccion(
      Colores.vis,
      FormularioPorPasos(
        titulo: 'VIS: hogar visitado',
        textoGuardar: 'Guardar hogar',
        enviando: _enviando,
        validar: _validar,
        guardar: _guardar,
        pasos: [
          Paso('El hogar', campos: const {'familia', 'direccion', 'telefono', 'zona'}, () => [
                Seccion('El hogar', icono: Icons.home, detalle: 'La casa que se visitó', [
                  campo('familia', 'Familia', icono: Icons.family_restroom, ayuda: 'Ej: Familia Pérez Gómez'),
                  SelectorZona(zonas: s.misZonas, valor: _zona, puedeElegir: s.eligeZona, error: _errores['zona'], alCambiar: (z) => setState(() { _zona = z; _errores.remove('zona'); })),
                  campo('direccion', 'Dirección', icono: Icons.place, ayuda: 'Ej: Calle 17 # 20-15'),
                  campo('telefono', 'Teléfono del hogar (opcional)', teclado: TextInputType.phone, icono: Icons.phone),
                  campo('atendio', 'Quién recibió la visita (opcional)', ayuda: 'Ej: la abuela, señora Carmen'),
                  BotonUbicacion(buscando: _gps, ubicacion: _ubicacion, precision: _precision, alTocar: _usarGps, opcional: true),
                  MapaBase(zonas: s.misZonas, marcador: _ubicacion, alTocar: (p) => _ubicar(p, null), alto: 240),
                ]),
              ]),
          Paso('Familia', campos: camposIntegrantes, () => [
                Seccion('Integrantes de la familia', icono: Icons.groups, detalle: 'Todos los que viven en el hogar, incluidos los niños', [
                  if (_errores['integrantes'] != null) Text(_errores['integrantes']!, style: const TextStyle(color: Colores.peligro)),
                  for (var n = 0; n < _integrantes.length; n++) _integrante(n),
                  OutlinedButton.icon(onPressed: _agregar, icon: const Icon(Icons.person_add), label: const Text('Agregar integrante')),
                ]),
              ]),
          Paso('Necesidad y oración', campos: const {'peticion', 'autorizacion'}, () => [
                Seccion('Necesidad y oración del hogar', icono: Icons.healing, [
                  campo('calamidad', 'Calamidad o necesidad (opcional)', lineas: 3, ayuda: 'Ej: perdieron la casa en la creciente'),
                  SiNo('¿El hogar pide oración?', _oracion, (v) => setState(() => _oracion = v)),
                  if (_oracion) campo('peticion', 'Petición del hogar', lineas: 2),
                  Desplegable('Seguimiento del hogar', _estado, estadosSeguimiento, (v) => setState(() => _estado = v ?? 'nuevo')),
                  campo('notas', 'Notas (opcional)', lineas: 2),
                ]),
                if (menores > 0)
                  Seccion('Autorización para los menores', icono: Icons.verified_user, detalle: '$menores ${menores == 1 ? 'menor' : 'menores'} de edad en el hogar', [
                    Casilla('El adulto responsable autorizó que la iglesia guarde los datos de los menores de este hogar para su acompañamiento espiritual y social (Ley 1581 de 2012).',
                        _autorizacion, (v) => setState(() { _autorizacion = v; _errores.remove('autorizacion'); })),
                    if (_errores['autorizacion'] != null) Text(_errores['autorizacion']!, style: const TextStyle(color: Colores.peligro)),
                  ]),
                Resumen([
                  ('Familia', _t('familia').isEmpty ? '-' : _t('familia')),
                  ('Integrantes', '${_integrantes.length}'),
                  ('Niños y jóvenes', '$menores'),
                  ('Enfermos', '${_integrantes.where((i) => i.enfermo).length}'),
                  ('Ubicación', _ubicacion == null ? 'Sin marcar' : 'Lista'),
                ]),
              ]),
        ],
      ),
    );
  }
}
