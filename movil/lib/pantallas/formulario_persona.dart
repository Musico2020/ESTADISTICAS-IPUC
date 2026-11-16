import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../datos/reglas.dart';
import '../ui/campos.dart';
import '../ui/mapa_base.dart';
import 'sesion.dart';

/// Ficha de un niño de VIS (nino = true) o de un amigo.
class FormularioPersona extends StatefulWidget {
  const FormularioPersona({super.key, required this.sesion, required this.nino});
  final Sesion sesion;
  final bool nino;
  @override
  State<FormularioPersona> createState() => _FormularioPersonaState();
}

class _FormularioPersonaState extends State<FormularioPersona> {
  final _c = {for (final k in ['nombre', 'edad', 'telefono', 'acudiente', 'familia', 'direccion', 'calamidad', 'peticion', 'notas']) k: TextEditingController()};
  late String? _zona = widget.sesion.perfil.zonaId;
  LatLng? _ubicacion;
  bool _enfermo = false;
  bool _oracion = false;
  bool _entrego = false;
  bool _autorizacion = false;
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

  Future<void> _guardar() async {
    final e = validarPersona(nino: widget.nino, zonaId: _zona, nombre: _t('nombre'), edad: _t('edad'), telefono: _t('telefono'),
        acudiente: _t('acudiente'), autorizacion: _autorizacion, pideOracion: _oracion, peticion: _t('peticion'));
    setState(() => _errores = e);
    if (e.isNotEmpty) {
      avisar(context, 'Revise los campos marcados', error: true);
      return;
    }
    String? o(String k) => _t(k).isEmpty ? null : _t(k);
    setState(() => _enviando = true);
    try {
      await widget.sesion.repo.guardarPersona({
        'tipo': widget.nino ? 'nino_vis' : 'amigo', 'zona_id': _zona, 'nombre': _t('nombre'),
        'edad': _t('edad').isEmpty ? null : int.parse(_t('edad')), 'telefono': o('telefono'), 'direccion': o('direccion'),
        'lat': _ubicacion?.latitude, 'lon': _ubicacion?.longitude, 'acudiente': o('acudiente'), 'familia': o('familia'),
        'calamidad': o('calamidad'), 'enfermo': _enfermo, 'pide_oracion': _oracion, 'peticion': _oracion ? o('peticion') : null,
        'entrego_vida': _entrego, 'estado_seguimiento': _estado, 'notas': o('notas'),
        'autorizacion_acudiente': widget.nino && _autorizacion,
      });
      if (!mounted) return;
      avisar(context, 'Ficha guardada.');
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo guardar. Revise el internet; lo escrito no se ha perdido.', error: true);
    }
    if (mounted) setState(() => _enviando = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    final nino = widget.nino;
    Campo campo(String k, String etiqueta, {bool numero = false, int lineas = 1, String? ayuda, TextInputType? teclado}) =>
        Campo(etiqueta, _c[k]!, numero: numero, lineas: lineas, ayuda: ayuda, teclado: teclado, error: _errores[k], alCambiar: () => _quitar(k));
    return Scaffold(
      appBar: AppBar(title: Text(nino ? 'VIS: niño visitado' : 'Amigo')),
      body: ListView(padding: const EdgeInsets.all(12), children: [
        Seccion(nino ? 'Datos del niño' : 'Datos del amigo', icono: Icons.person, [
          campo('nombre', nino ? 'Nombre completo del niño' : 'Nombre completo'),
          campo('edad', nino ? 'Edad (años)' : 'Edad (opcional)', numero: true),
          campo('telefono', nino ? 'Teléfono del acudiente' : 'Teléfono (opcional)', teclado: TextInputType.phone, ayuda: 'Ej: 300 123 4567'),
          SelectorZona(zonas: s.misZonas, valor: _zona, puedeElegir: s.eligeZona, error: _errores['zona'], alCambiar: (z) => setState(() { _zona = z; _errores.remove('zona'); })),
          if (nino) campo('acudiente', 'Acudiente (nombre y parentesco)', ayuda: 'Ej: Marta Gómez, madre'),
          campo('familia', nino ? 'Familia (con quién vive, hermanos)' : 'Familia (opcional)', lineas: 2),
        ]),
        Seccion('Ubicación', icono: Icons.place, [
          campo('direccion', 'Dirección', ayuda: 'Ej: Calle 17 # 20-15'),
          OutlinedButton.icon(onPressed: _gps ? null : _usarGps, icon: const Icon(Icons.my_location), label: Text(_gps ? 'Buscando...' : 'Usar mi ubicación (opcional)')),
          const SizedBox(height: 8),
          MapaBase(zonas: s.misZonas, marcador: _ubicacion, alTocar: _ubicar, alto: 260),
        ]),
        Seccion('Necesidades y oración', icono: Icons.healing, [
          campo('calamidad', nino ? 'Calamidad o necesidad' : 'Necesidad (opcional)', lineas: 2),
          Casilla(nino ? 'El niño está enfermo' : 'Está enfermo', _enfermo, (v) => setState(() => _enfermo = v)),
          Casilla('Pide oración', _oracion, (v) => setState(() => _oracion = v)),
          if (_oracion) campo('peticion', 'Petición de oración', lineas: 2),
        ]),
        Seccion('Seguimiento', icono: Icons.volunteer_activism, [
          Casilla('Se entregó a Cristo', _entrego, (v) => setState(() => _entrego = v)),
          DropdownButtonFormField<String>(
            initialValue: _estado,
            items: [for (final e in estadosSeguimiento.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
            onChanged: (v) => setState(() => _estado = v ?? 'nuevo'),
            decoration: const InputDecoration(labelText: 'Estado del seguimiento', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 14),
          campo('notas', 'Notas (opcional)', lineas: 2),
        ]),
        if (nino)
          Seccion('Autorización del acudiente', icono: Icons.verified_user, [
            Casilla('El acudiente autorizó que la iglesia guarde estos datos del niño para su acompañamiento espiritual y social (Ley 1581 de 2012).',
                _autorizacion, (v) => setState(() { _autorizacion = v; _errores.remove('autorizacion'); })),
            if (_errores['autorizacion'] != null) Text(_errores['autorizacion']!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ]),
        FilledButton.icon(
          onPressed: _enviando ? null : _guardar,
          icon: const Icon(Icons.save),
          label: Text(_enviando ? 'Guardando...' : 'Guardar ficha'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54)),
        ),
        const SizedBox(height: 24),
      ]),
    );
  }
}
