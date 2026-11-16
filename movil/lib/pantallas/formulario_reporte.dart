import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';

import '../datos/reglas.dart';
import '../ui/campos.dart';
import '../ui/mapa_base.dart';
import '../ui/pasos.dart';
import '../ui/tema.dart';
import 'sesion.dart';

/// Reporte de una jornada de evangelismo: se tocan en el mapa las manzanas trabajadas.
class FormularioReporte extends StatefulWidget {
  const FormularioReporte({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<FormularioReporte> createState() => _FormularioReporteState();
}

class _FormularioReporteState extends State<FormularioReporte> {
  late final _c = {
    for (final k in ['responsable', 'coordinador', 'direccion', 'hogares', 'personas', 'aceptan', 'nombres', 'resultado', 'caso', 'ninos', 'dificultad_otra', 'sugerencias'])
      k: TextEditingController(text: k == 'responsable' || k == 'coordinador' ? widget.sesion.perfil.nombre : (['hogares', 'personas', 'aceptan', 'ninos'].contains(k) ? '0' : '')),
  };
  late String? _zona = widget.sesion.perfil.zonaId;
  String _fecha = hoyIso();
  final _manzanas = <String>{};
  bool _enfermo = false, _sordo = false, _consejeria = false, _evangelismoNinos = false, _enviando = false;
  String? _receptividad, _dificultad;
  Map<String, String> _errores = {};

  String _t(String k) => _c[k]!.text.trim();
  void _quitar(String c) => setState(() => _errores = {..._errores}..remove(c));

  void _tocarMapa(LatLng p) {
    final m = widget.sesion.manzanas.where((m) => m.zonaId == _zona && m.activa && contiene(m.area, p)).firstOrNull;
    if (m == null) return;
    setState(() {
      _manzanas.contains(m.id) ? _manzanas.remove(m.id) : _manzanas.add(m.id);
      _errores = {..._errores}..remove('manzanas');
    });
  }

  Map<String, String> _validar([Set<String>? campos]) {
    final hayCaso = _enfermo || _sordo || _consejeria;
    final e = validarReporte(zonaId: _zona, responsable: _t('responsable'), coordinador: _t('coordinador'), fecha: _fecha,
        hogares: _t('hogares'), personas: _t('personas'), aceptan: _t('aceptan'), resultado: _t('resultado'),
        receptividad: _receptividad, dificultad: _dificultad, dificultadOtra: _t('dificultad_otra'),
        evangelismoNinos: _evangelismoNinos, ninos: _t('ninos'), hayCaso: hayCaso, descripcionCaso: _t('caso'), manzanas: _manzanas.length);
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
      await widget.sesion.repo.guardarReporte({
        'zona_id': _zona, 'responsable_nombre': _t('responsable'), 'coordinador_nombre': _t('coordinador'), 'fecha_jornada': _fecha,
        'direccion': o('direccion'), 'hogares_visitados': int.parse(_t('hogares')), 'personas_contactadas': int.parse(_t('personas')),
        'personas_aceptan_visita': int.parse(_t('aceptan')), 'nombres_visita': o('nombres'), 'resultado_espiritual': _t('resultado'),
        'evangelismo_ninos': _evangelismoNinos, 'ninos_alcanzados': _evangelismoNinos ? int.parse(_t('ninos')) : null,
        'receptividad': int.parse(_receptividad!), 'dificultad': _dificultad,
        'dificultad_otra': _dificultad == 'otra' ? _t('dificultad_otra') : null, 'sugerencias': o('sugerencias'),
      }, _manzanas.toList(), [
        for (final (marcado, tipo) in [(_enfermo, 'enfermo'), (_sordo, 'sordo'), (_consejeria, 'consejeria')])
          if (marcado) {'tipo': tipo, 'descripcion': _t('caso')},
      ]);
      if (!mounted) return;
      avisar(context, 'Reporte guardado. Las manzanas ya están en verde.');
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) avisar(context, 'No se pudo guardar. Revise el internet; lo escrito no se ha perdido.', error: true);
    }
    if (mounted) setState(() => _enviando = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    Campo campo(String k, String etiqueta, {int lineas = 1, String? ayuda}) =>
        Campo(etiqueta, _c[k]!, lineas: lineas, ayuda: ayuda, error: _errores[k], alCambiar: () => _quitar(k));
    Contador contador(String k, String etiqueta) => Contador(etiqueta, _c[k]!, error: _errores[k], alCambiar: () => _quitar(k));
    final zona = s.misZonas.where((z) => z.id == _zona).toList();
    final codigos = s.manzanas.where((m) => _manzanas.contains(m.id)).map((m) => m.codigo).join(', ');
    return ConSeccion(
      Colores.evangelismo,
      FormularioPorPasos(
        titulo: 'Jornada de evangelismo',
        textoGuardar: 'Guardar reporte',
        enviando: _enviando,
        validar: _validar,
        guardar: _guardar,
        pasos: [
          Paso('Manzanas', campos: const {'responsable', 'coordinador', 'fecha', 'zona', 'manzanas'}, () => [
                Seccion('Datos generales', icono: Icons.badge, [
                  campo('responsable', 'Nombre del responsable'),
                  campo('coordinador', 'Nombre del coordinador de zona'),
                  SelectorFecha(etiqueta: 'Fecha de la jornada', valor: _fecha, error: _errores['fecha'], alCambiar: (f) => setState(() { _fecha = f; _errores.remove('fecha'); })),
                  SelectorZona(zonas: s.misZonas, valor: _zona, puedeElegir: s.eligeZona, error: _errores['zona'],
                      alCambiar: (z) => setState(() { _zona = z; _manzanas.clear(); _errores.remove('zona'); })),
                ]),
                Seccion('Manzanas trabajadas', icono: Icons.grid_view, detalle: 'Toque en el mapa las manzanas; quedan en verde', [
                  if (zona.isEmpty)
                    const Text('Primero elija la zona.')
                  else
                    MapaBase(zonas: zona, manzanas: s.manzanas.where((m) => m.zonaId == _zona).toList(), seleccion: _manzanas, alTocar: _tocarMapa, alto: 340),
                  codigos.isEmpty ? const Aviso('Ninguna manzana elegida todavía', bien: false) : Aviso('Elegidas (${_manzanas.length}): $codigos'),
                  if (_errores['manzanas'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_errores['manzanas']!, style: const TextStyle(color: Colores.peligro))),
                ]),
              ]),
          Paso('Cobertura', campos: const {'hogares', 'personas', 'aceptan', 'resultado'}, () => [
                Seccion('Cobertura del trabajo', icono: Icons.door_front_door, detalle: 'Toque − y + para contar', [
                  contador('hogares', 'Hogares visitados'),
                  contador('personas', 'Personas contactadas'),
                  contador('aceptan', 'Aceptaron visita posterior'),
                  campo('nombres', 'Nombres de quienes aceptaron visita (opcional)', lineas: 2),
                  campo('direccion', 'Dirección o referencia (opcional)'),
                  campo('resultado', 'Breve descripción del resultado espiritual', lineas: 3),
                ]),
              ]),
          Paso('Casos', campos: const {'caso', 'ninos'}, () => [
                Seccion('Casos especiales', icono: Icons.health_and_safety, [
                  SiNo('¿Persona enferma que requiere visita hospitalaria?', _enfermo, (v) => setState(() => _enfermo = v)),
                  SiNo('¿Persona sorda?', _sordo, (v) => setState(() => _sordo = v)),
                  SiNo('¿Caso de consejería o visitación especial?', _consejeria, (v) => setState(() => _consejeria = v)),
                  if (_enfermo || _sordo || _consejeria) campo('caso', 'Describa brevemente el caso', lineas: 2),
                ]),
                Seccion('Evangelismo infantil', icono: Icons.child_care, [
                  SiNo('¿Se realizó evangelismo a niños?', _evangelismoNinos, (v) => setState(() => _evangelismoNinos = v)),
                  if (_evangelismoNinos) contador('ninos', 'Niños alcanzados (aproximado)'),
                ]),
              ]),
          Paso('Evaluación', campos: const {'receptividad', 'dificultad', 'dificultad_otra'}, () => [
                Seccion('Evaluación', icono: Icons.star_half, [
                  const Etiqueta('Receptividad del sector (1 baja, 5 alta)'),
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    for (var n = 1; n <= 5; n++)
                      IconButton(
                        tooltip: 'Receptividad $n',
                        iconSize: 40,
                        onPressed: () => setState(() { _receptividad = '$n'; _errores.remove('receptividad'); }),
                        icon: Icon(n <= (int.tryParse(_receptividad ?? '') ?? 0) ? Icons.star_rounded : Icons.star_outline_rounded, color: Colores.oro),
                      ),
                  ]),
                  if (_errores['receptividad'] != null) Text(_errores['receptividad']!, style: const TextStyle(color: Colores.peligro)),
                  const SizedBox(height: 14),
                  Desplegable('Dificultades encontradas', _dificultad, dificultades, (v) => setState(() { _dificultad = v; _errores.remove('dificultad'); }), error: _errores['dificultad']),
                  if (_dificultad == 'otra') campo('dificultad_otra', 'Describa la dificultad'),
                  campo('sugerencias', 'Sugerencias (opcional)', lineas: 2),
                ]),
              ]),
        ],
      ),
    );
  }
}
