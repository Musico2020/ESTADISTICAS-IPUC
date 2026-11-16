import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../datos/reglas.dart';
import '../ui/mapa_base.dart';
import '../ui/tema.dart';
import 'sesion.dart';

const _avisoTabla = {'cultos': 'Nuevo culto', 'hogares': 'Nuevo hogar visitado', 'personas': 'Nueva ficha', 'reportes': 'Nueva jornada de evangelismo'};

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
      final r = await Future.wait([repo.manzanasAlcanzadas(_desde, _hasta), repo.cultos(_desde, _hasta), repo.personas(), repo.hogares()]);
      final cultos = r[1] as List<Map<String, dynamic>>;
      final personas = r[2] as List<Map<String, dynamic>>;
      final hogares = r[3] as List<Map<String, dynamic>>;
      if (!mounted) return;
      setState(() {
        _alcanzadas = r[0] as Set<String>;
        _puntos = [
          for (final c in cultos)
            PuntoMapa(LatLng((c['lat'] as num).toDouble(), (c['lon'] as num).toDouble()), Colores.cultos, 'Culto · ${c['direccion']}',
                '${dias[c['dia_semana'] as int]} ${c['fecha']} · ${widget.sesion.nombreZona(c['zona_id'] as String)}\nHermanos ${c['hermanos']} · Amigos ${c['amigos']} · Niños ${c['ninos']}'),
          for (final p in personas)
            PuntoMapa(LatLng((p['lat'] as num).toDouble(), (p['lon'] as num).toDouble()), Colores.amigos,
                'Amigo · ${p['nombre']}',
                [widget.sesion.nombreZona(p['zona_id'] as String), if (p['enfermo'] == true) 'Enfermo', if (p['pide_oracion'] == true) 'Pide oración'].join(' · ')),
          for (final h in hogares)
            PuntoMapa(LatLng((h['lat'] as num).toDouble(), (h['lon'] as num).toDouble()), Colores.vis, 'Hogar VIS · ${h['familia']}',
                [
                  '${(h['personas'] as List).length} integrantes',
                  widget.sesion.nombreZona(h['zona_id'] as String),
                  if ((h['personas'] as List).any((m) => m['enfermo'] == true)) 'Hay enfermos',
                  if (h['pide_oracion'] == true || (h['personas'] as List).any((m) => m['pide_oracion'] == true)) 'Pide oración',
                ].join(' · ')),
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
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Manzanas alcanzadas este año: $alcanzadas de $activas · Puntos: ${_puntos.length}',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Wrap(spacing: 14, runSpacing: 6, children: [
              _Leyenda(verde, 'Alcanzada', cuadro: true),
              _Leyenda(rojo, 'Sin predicar', cuadro: true),
              _Leyenda(Colores.cultos, 'Culto'),
              _Leyenda(Colores.vis, 'Hogar VIS'),
              _Leyenda(Colores.amigos, 'Amigo'),
            ]),
          ]),
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

class _Leyenda extends StatelessWidget {
  const _Leyenda(this.color, this.texto, {this.cuadro = false});
  final Color color;
  final String texto;
  final bool cuadro;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 12, height: 12, decoration: BoxDecoration(color: color, shape: cuadro ? BoxShape.rectangle : BoxShape.circle, borderRadius: cuadro ? BorderRadius.circular(3) : null)),
        const SizedBox(width: 6),
        Text(texto, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
      ]);
}
