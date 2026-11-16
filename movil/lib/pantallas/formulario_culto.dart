import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../datos/reglas.dart';
import '../ui/campos.dart';
import '../ui/mapa_base.dart';
import 'sesion.dart';

class FormularioCulto extends StatefulWidget {
  const FormularioCulto({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<FormularioCulto> createState() => _FormularioCultoState();
}

class _FormularioCultoState extends State<FormularioCulto> {
  final _direccion = TextEditingController();
  final _hermanos = TextEditingController();
  final _amigos = TextEditingController();
  final _ninos = TextEditingController();
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

  Future<void> _guardar() async {
    final e = validarCulto(zonaId: _zona, fecha: _fecha, direccion: _direccion.text, ubicacion: _ubicacion,
        hermanos: _hermanos.text, amigos: _amigos.text, ninos: _ninos.text, ofrenda: _ofrenda.text);
    setState(() => _errores = e);
    if (e.isNotEmpty) {
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

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    return Scaffold(
      appBar: AppBar(title: const Text('Culto en casa')),
      body: ListView(padding: const EdgeInsets.all(12), children: [
        Seccion('Casa del culto', icono: Icons.home, [
          SelectorFecha(etiqueta: 'Fecha del culto', valor: _fecha, error: _errores['fecha'], alCambiar: (f) => setState(() { _fecha = f; _errores.remove('fecha'); })),
          SelectorZona(zonas: s.misZonas, valor: _zona, puedeElegir: s.eligeZona, error: _errores['zona'], alCambiar: (z) => setState(() { _zona = z; _errores.remove('zona'); })),
          Campo('Dirección de la casa', _direccion, error: _errores['direccion'], ayuda: 'Ej: Calle 18B # 19-30', alCambiar: () => _quitar('direccion')),
          FilledButton.icon(
            onPressed: _gps ? null : _usarGps,
            icon: const Icon(Icons.my_location),
            label: Text(_gps ? 'Buscando ubicación...' : 'Usar mi ubicación'),
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(50)),
          ),
          const SizedBox(height: 8),
          const Text('Estando en la casa, toque el botón. También puede tocar el mapa para mover el punto.'),
          const SizedBox(height: 8),
          MapaBase(zonas: s.misZonas, marcador: _ubicacion, alTocar: (p) => _ubicar(p, null)),
          const SizedBox(height: 6),
          Text(_ubicacion == null
              ? 'Sin ubicación todavía'
              : 'Ubicación: ${_ubicacion!.latitude.toStringAsFixed(6)}, ${_ubicacion!.longitude.toStringAsFixed(6)}${_precision == null ? '' : ' (±$_precision m)'}'),
          if (_errores['ubicacion'] != null) Text(_errores['ubicacion']!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          if (_aviso != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_aviso!, style: const TextStyle(color: Colors.orange))),
        ]),
        Seccion('Asistencia y ofrenda', icono: Icons.groups, [
          Campo('Hermanos asistentes', _hermanos, numero: true, error: _errores['hermanos'], alCambiar: () => _quitar('hermanos')),
          Campo('Amigos asistentes', _amigos, numero: true, error: _errores['amigos'], alCambiar: () => _quitar('amigos')),
          Campo('Niños', _ninos, numero: true, error: _errores['ninos'], alCambiar: () => _quitar('ninos')),
          Campo('Ofrenda (pesos)', _ofrenda, numero: true, ayuda: 'Ej: 50000', error: _errores['ofrenda'], alCambiar: () => _quitar('ofrenda')),
        ]),
        Seccion('Enfermos y observaciones', icono: Icons.healing, [
          Casilla('Hubo personas enfermas', _enfermos, (v) => setState(() => _enfermos = v)),
          if (_enfermos) Casilla('Se oró por los enfermos', _seOro, (v) => setState(() => _seOro = v)),
          Campo('Observaciones (opcional)', _observaciones, lineas: 3),
        ]),
        FilledButton.icon(
          onPressed: _enviando ? null : _guardar,
          icon: const Icon(Icons.save),
          label: Text(_enviando ? 'Guardando...' : 'Guardar culto'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54)),
        ),
        const SizedBox(height: 24),
      ]),
    );
  }
}
