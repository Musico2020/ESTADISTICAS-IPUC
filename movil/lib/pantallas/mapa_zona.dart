import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../datos/reglas.dart';
import '../ui/mapa_base.dart';
import 'sesion.dart';

const _avisoTabla = {'cultos': 'Nuevo culto', 'personas': 'Nueva ficha', 'reportes': 'Nueva jornada de evangelismo'};

class PantallaMapa extends StatefulWidget {
  const PantallaMapa({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<PantallaMapa> createState() => _PantallaMapaState();
}

class _PantallaMapaState extends State<PantallaMapa> {
  final _canales = <RealtimeChannel>[];
  Set<String> _alcanzadas = {};
  List<PuntoMapa> _puntos = [];
  bool _cargando = true;
  String? _error;

  String get _desde => '${DateTime.now().year}-01-01';
  String get _hasta => '${DateTime.now().year}-12-31';

  @override
  void initState() {
    super.initState();
    _cargar();
    for (final t in _avisoTabla.keys) {
      _canales.add(widget.sesion.repo.escuchar(t, (cambio) {
        if (!mounted) return;
        if (cambio.eventType == PostgresChangeEvent.insert) {
          final zona = widget.sesion.nombreZona(cambio.newRecord['zona_id'] as String?);
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${_avisoTabla[t]}${zona.isEmpty ? '' : ' en $zona'}')));
        }
        _cargar();
      }));
    }
  }

  @override
  void dispose() {
    for (final c in _canales) {
      widget.sesion.repo.dejarDeEscuchar(c);
    }
    super.dispose();
  }

  Future<void> _cargar() async {
    final repo = widget.sesion.repo;
    try {
      final r = await Future.wait([repo.manzanasAlcanzadas(_desde, _hasta), repo.cultos(_desde, _hasta), repo.personas()]);
      final cultos = r[1] as List<Map<String, dynamic>>;
      final personas = r[2] as List<Map<String, dynamic>>;
      if (!mounted) return;
      setState(() {
        _alcanzadas = r[0] as Set<String>;
        _puntos = [
          for (final c in cultos)
            PuntoMapa(LatLng((c['lat'] as num).toDouble(), (c['lon'] as num).toDouble()), verde, 'Culto · ${c['direccion']}',
                '${dias[c['dia_semana'] as int]} ${c['fecha']} · ${widget.sesion.nombreZona(c['zona_id'] as String)}\nHermanos ${c['hermanos']} · Amigos ${c['amigos']} · Niños ${c['ninos']}'),
          for (final p in personas)
            PuntoMapa(LatLng((p['lat'] as num).toDouble(), (p['lon'] as num).toDouble()), p['tipo'] == 'nino_vis' ? azul : morado,
                '${p['tipo'] == 'nino_vis' ? 'VIS' : 'Amigo'} · ${p['nombre']}',
                [widget.sesion.nombreZona(p['zona_id'] as String), if (p['enfermo'] == true) 'Enfermo', if (p['pide_oracion'] == true) 'Pide oración'].join(' · ')),
        ];
        _cargando = false;
        _error = null;
      });
    } catch (_) {
      if (mounted) setState(() { _cargando = false; _error = 'No se pudo cargar el mapa. Revise el internet.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final zonas = widget.sesion.misZonas;
    final ids = zonas.map((z) => z.id).toSet();
    final manzanas = widget.sesion.manzanas.where((m) => ids.contains(m.zonaId)).toList();
    final alcanzadas = manzanas.where((m) => m.activa && _alcanzadas.contains(m.id)).length;
    final activas = manzanas.where((m) => m.activa).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Mapa de mi zona'), actions: [
        const Padding(padding: EdgeInsets.only(right: 12), child: Chip(avatar: Icon(Icons.sensors, size: 16), label: Text('En vivo'))),
      ]),
      body: Column(children: [
        if (_error != null) MaterialBanner(content: Text(_error!), actions: [TextButton(onPressed: _cargar, child: const Text('Reintentar'))]),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text('Manzanas alcanzadas este año: $alcanzadas de $activas · Puntos: ${_puntos.length}',
              style: Theme.of(context).textTheme.titleSmall),
        ),
        Expanded(
          child: _cargando
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                  child: LayoutBuilder(builder: (_, c) => MapaBase(zonas: zonas, manzanas: manzanas, alcanzadas: _alcanzadas, puntos: _puntos, alto: c.maxHeight)),
                ),
        ),
      ]),
    );
  }
}
