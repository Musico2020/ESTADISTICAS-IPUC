import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../datos/reglas.dart';
import '../ui/campos.dart';
import '../ui/mapa_base.dart';
import '../ui/pasos.dart';
import '../ui/tema.dart';
import 'sesion.dart';

class FormularioCulto extends StatefulWidget {
  const FormularioCulto({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<FormularioCulto> createState() => _FormularioCultoState();
}

class _FormularioCultoState extends State<FormularioCulto> {
  final _direccion = TextEditingController();
  final _hermanos = TextEditingController(text: '0');
  final _amigos = TextEditingController(text: '0');
  final _ninos = TextEditingController(text: '0');
  final _ofrenda = TextEditingController();
  final _observaciones = TextEditingController();
  late String? _zona = widget.sesion.perfil.zonaId;
  String _fecha = hoyIso();
  LatLng? _ubicacion;
  int? _precision;
  bool _enfermos = false;
  bool _seOro = false;
  bool _gps = false;
  bool _enviando = false;
  String? _aviso;
  Map<String, String> _errores = {};

  void _quitar(String c) => setState(() => _errores = {..._errores}..remove(c));

  void _ubicar(LatLng p, int? precision) {
    final s = widget.sesion;
    final zona = zonaDePunto(s.misZonas, p);
    setState(() {
      _ubicacion = p;
      _precision = precision;
      if (s.eligeZona && zona != null) _zona = zona.id;
      _aviso = zona?.id == _zona ? null : 'La ubicación queda fuera de ${s.nombreZona(_zona).isEmpty ? 'sus zonas' : s.nombreZona(_zona)}. Verifique el punto antes de guardar.';
      _errores = {..._errores}..remove('ubicacion');
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
    final e = validarCulto(zonaId: _zona, fecha: _fecha, direccion: _direccion.text, ubicacion: _ubicacion,
        hermanos: _hermanos.text, amigos: _amigos.text, ninos: _ninos.text, ofrenda: _ofrenda.text);
    // Solo se marcan los errores del paso que se está revisando.
    setState(() => _errores = campos == null ? e : {for (final k in e.keys) if (campos.contains(k)) k: e[k]!});
    return e;
  }

  Future<void> _guardar() async {
    if (_validar().isNotEmpty) {
      avisar(context, 'Revise los campos marcados', error: true);
      return;
    }
    setState(() => _enviando = true);
    try {
      await widget.sesion.repo.guardarCulto({
        'zona_id': _zona, 'fecha': _fecha, 'direccion': _direccion.text.trim(),
        'lat': _ubicacion!.latitude, 'lon': _ubicacion!.longitude, 'precision_m': _precision,
        'hermanos': int.parse(_hermanos.text.trim()), 'amigos': int.parse(_amigos.text.trim()), 'ninos': int.parse(_ninos.text.trim()),
        'ofrenda': pesos(_ofrenda.text) ?? 0, 'hubo_enfermos': _enfermos, 'se_oro_enfermos': _enfermos && _seOro,
        'observaciones': _observaciones.text.trim().isEmpty ? null : _observaciones.text.trim(),
      });
      if (!mounted) return;
      avisar(context, 'Culto guardado. Ya aparece en el mapa.');
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo guardar. Revise el internet; lo escrito no se ha perdido.', error: true);
    }
    if (mounted) setState(() => _enviando = false);
  }

  int get _total => [_hermanos, _amigos, _ninos].fold(0, (s, c) => s + (int.tryParse(c.text.trim()) ?? 0));

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    return ConSeccion(
      Colores.cultos,
      FormularioPorPasos(
        titulo: 'Culto en casa',
        textoGuardar: 'Guardar culto',
        enviando: _enviando,
        validar: _validar,
        guardar: _guardar,
        pasos: [
          Paso('La casa', campos: const {'fecha', 'zona', 'direccion', 'ubicacion'}, () => [
                Seccion('¿Dónde fue el culto?', icono: Icons.home, [
                  SelectorFecha(etiqueta: 'Fecha del culto', valor: _fecha, error: _errores['fecha'], alCambiar: (f) => setState(() { _fecha = f; _errores.remove('fecha'); })),
                  SelectorZona(zonas: s.misZonas, valor: _zona, puedeElegir: s.eligeZona, error: _errores['zona'], alCambiar: (z) => setState(() { _zona = z; _errores.remove('zona'); })),
                  Campo('Dirección de la casa', _direccion, icono: Icons.place, error: _errores['direccion'], ayuda: 'Ej: Calle 18B # 19-30', alCambiar: () => _quitar('direccion')),
                  BotonUbicacion(buscando: _gps, ubicacion: _ubicacion, precision: _precision, alTocar: _usarGps, error: _errores['ubicacion']),
                  MapaBase(zonas: s.misZonas, marcador: _ubicacion, alTocar: (p) => _ubicar(p, null), alto: 260),
                  if (_aviso != null) Aviso(_aviso!, bien: false),
                ]),
              ]),
          Paso('Asistencia', campos: const {'hermanos', 'amigos', 'ninos', 'ofrenda'}, () => [
                if (_ubicacion != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Aviso('Casa ubicada · ${_direccion.text.trim()}')),
                Seccion('Asistencia y ofrenda', icono: Icons.groups, detalle: 'Toque − y + para contar · Total: $_total', [
                  Contador('Hermanos', _hermanos, error: _errores['hermanos'], alCambiar: () { _quitar('hermanos'); setState(() {}); }),
                  Contador('Amigos', _amigos, error: _errores['amigos'], alCambiar: () { _quitar('amigos'); setState(() {}); }),
                  Contador('Niños', _ninos, error: _errores['ninos'], alCambiar: () { _quitar('ninos'); setState(() {}); }),
                  Campo('Ofrenda (pesos)', _ofrenda, numero: true, icono: Icons.payments, ayuda: 'Ej: 50000', error: _errores['ofrenda'], alCambiar: () => _quitar('ofrenda')),
                ]),
              ]),
          Paso('Enfermos', () => [
                Seccion('Enfermos y observaciones', icono: Icons.healing, [
                  SiNo('¿Hubo personas enfermas?', _enfermos, (v) => setState(() { _enfermos = v; if (!v) _seOro = false; })),
                  if (_enfermos) SiNo('¿Se oró por ellas?', _seOro, (v) => setState(() => _seOro = v)),
                  Campo('Observaciones (opcional)', _observaciones, lineas: 3),
                ]),
                Resumen([('Personas', '$_total'), ('Ofrenda', formatoPesos(pesos(_ofrenda.text) ?? 0)), ('Zona', s.nombreZona(_zona))]),
              ]),
        ],
      ),
    );
  }
}
