import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../datos/reglas.dart';
import '../ui/campos.dart';
import '../ui/mapa_base.dart';
import '../ui/pasos.dart';
import '../ui/tema.dart';
import 'sesion.dart';

/// Ficha de un amigo alcanzado en un culto o en evangelismo.
class FormularioPersona extends StatefulWidget {
  const FormularioPersona({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<FormularioPersona> createState() => _FormularioPersonaState();
}

class _FormularioPersonaState extends State<FormularioPersona> {
  final _c = {for (final k in ['nombre', 'edad', 'telefono', 'familia', 'direccion', 'calamidad', 'peticion', 'notas']) k: TextEditingController()};
  late String? _zona = widget.sesion.perfil.zonaId;
  LatLng? _ubicacion;
  bool _enfermo = false;
  bool _oracion = false;
  bool _entrego = false;
  String _estado = 'nuevo';
  bool _gps = false;
  bool _enviando = false;
  Map<String, String> _errores = {};

  String _t(String k) => _c[k]!.text.trim();
  void _quitar(String c) => setState(() => _errores = {..._errores}..remove(c));

  void _ubicar(LatLng p) {
    final zona = zonaDePunto(widget.sesion.misZonas, p);
    setState(() {
      _ubicacion = p;
      if (widget.sesion.eligeZona && zona != null) _zona = zona.id;
    });
  }

  Future<void> _usarGps() async {
    setState(() => _gps = true);
    final (punto, _, error) = await ubicacionActual();
    if (!mounted) return;
    setState(() => _gps = false);
    if (punto != null) {
      _ubicar(punto);
    } else {
      avisar(context, error!, error: true);
    }
  }

  Map<String, String> _validar([Set<String>? campos]) {
    final e = validarPersona(zonaId: _zona, nombre: _t('nombre'), edad: _t('edad'), telefono: _t('telefono'), pideOracion: _oracion, peticion: _t('peticion'));
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
      await widget.sesion.repo.guardarPersona({
        'tipo': 'amigo', 'zona_id': _zona, 'nombre': _t('nombre'),
        'edad': _t('edad').isEmpty ? null : int.parse(_t('edad')), 'telefono': o('telefono'), 'direccion': o('direccion'),
        'lat': _ubicacion?.latitude, 'lon': _ubicacion?.longitude, 'familia': o('familia'),
        'calamidad': o('calamidad'), 'enfermo': _enfermo, 'pide_oracion': _oracion, 'peticion': _oracion ? o('peticion') : null,
        'entrego_vida': _entrego, 'estado_seguimiento': _estado, 'notas': o('notas'),
      });
      if (!mounted) return;
      avisar(context, 'Ficha del amigo guardada.');
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo guardar. Revise el internet; lo escrito no se ha perdido.', error: true);
    }
    if (mounted) setState(() => _enviando = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    Campo campo(String k, String etiqueta, {bool numero = false, int lineas = 1, String? ayuda, TextInputType? teclado, IconData? icono}) =>
        Campo(etiqueta, _c[k]!, numero: numero, lineas: lineas, ayuda: ayuda, teclado: teclado, icono: icono, error: _errores[k], alCambiar: () => _quitar(k));
    return ConSeccion(
      Colores.amigos,
      FormularioPorPasos(
        titulo: 'Amigo',
        textoGuardar: 'Guardar amigo',
        enviando: _enviando,
        validar: _validar,
        guardar: _guardar,
        pasos: [
          Paso('Datos', campos: const {'nombre', 'edad', 'telefono', 'zona'}, () => [
                Seccion('Datos del amigo', icono: Icons.person, [
                  campo('nombre', 'Nombre completo', icono: Icons.person),
                  campo('edad', 'Edad (opcional)', numero: true),
                  campo('telefono', 'Teléfono (opcional)', teclado: TextInputType.phone, icono: Icons.phone, ayuda: 'Ej: 300 123 4567'),
                  SelectorZona(zonas: s.misZonas, valor: _zona, puedeElegir: s.eligeZona, error: _errores['zona'], alCambiar: (z) => setState(() { _zona = z; _errores.remove('zona'); })),
                  campo('familia', 'Familia (opcional)', lineas: 2),
                ]),
                Seccion('Ubicación', icono: Icons.place, detalle: 'Opcional', [
                  campo('direccion', 'Dirección', ayuda: 'Ej: Calle 17 # 20-15'),
                  BotonUbicacion(buscando: _gps, ubicacion: _ubicacion, alTocar: _usarGps, opcional: true),
                  MapaBase(zonas: s.misZonas, marcador: _ubicacion, alTocar: _ubicar, alto: 240),
                ]),
              ]),
          Paso('Oración y seguimiento', campos: const {'peticion'}, () => [
                Seccion('Necesidades y oración', icono: Icons.healing, [
                  campo('calamidad', 'Necesidad (opcional)', lineas: 2),
                  SiNo('¿Está enfermo?', _enfermo, (v) => setState(() => _enfermo = v)),
                  SiNo('¿Pide oración?', _oracion, (v) => setState(() => _oracion = v)),
                  if (_oracion) campo('peticion', 'Petición de oración', lineas: 2),
                ]),
                Seccion('Seguimiento', icono: Icons.volunteer_activism, [
                  SiNo('¿Se entregó a Cristo?', _entrego, (v) => setState(() => _entrego = v)),
                  Desplegable('Estado del seguimiento', _estado, estadosSeguimiento, (v) => setState(() => _estado = v ?? 'nuevo')),
                  campo('notas', 'Notas (opcional)', lineas: 2),
                ]),
              ]),
        ],
      ),
    );
  }
}
