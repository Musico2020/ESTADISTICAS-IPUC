import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../datos/modelos.dart';

const verde = Color(0xFF22C55E);
const rojo = Color(0xFFEF4444);
const azul = Color(0xFF2563EB);
const morado = Color(0xFF9333EA);

Color colorHex(String hex) => Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));

class PuntoMapa {
  const PuntoMapa(this.posicion, this.color, this.titulo, this.detalle);
  final LatLng posicion;
  final Color color;
  final String titulo;
  final String detalle;
}

/// Mapa de OpenStreetMap con zonas, manzanas y puntos. Tocar un punto muestra su resumen.
class MapaBase extends StatelessWidget {
  const MapaBase({
    super.key,
    required this.zonas,
    this.manzanas = const [],
    this.alcanzadas = const {},
    this.seleccion = const {},
    this.puntos = const [],
    this.marcador,
    this.alTocar,
    this.controlador,
    this.alto = 320,
  });

  final List<Zona> zonas;
  final List<Manzana> manzanas;
  final Set<String> alcanzadas;
  final Set<String> seleccion;
  final List<PuntoMapa> puntos;
  final LatLng? marcador;
  final void Function(LatLng)? alTocar;
  final MapController? controlador;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final bordes = [for (final z in zonas) for (final p in z.area) p.first];
    final todos = bordes.expand((a) => a).toList();
    return SizedBox(
      height: alto,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: FlutterMap(
          mapController: controlador,
          options: MapOptions(
            initialCenter: const LatLng(10.4625, -73.2585),
            initialZoom: 15,
            initialCameraFit: todos.length > 2
                ? CameraFit.bounds(bounds: LatLngBounds.fromPoints(todos), padding: const EdgeInsets.all(16))
                : null,
            onTap: alTocar == null ? null : (_, punto) => alTocar!(punto),
          ),
          children: [
            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'co.ipucdangond.evangelismo_ipuc'),
            PolygonLayer(polygons: [
              for (final m in manzanas.where((m) => m.activa))
                for (final p in m.area)
                  Polygon(
                    points: p.first,
                    color: (seleccion.contains(m.id) || alcanzadas.contains(m.id) ? verde : rojo).withValues(alpha: 0.45),
                    borderColor: seleccion.contains(m.id) ? const Color(0xFF1D4ED8) : const Color(0xFF475569),
                    borderStrokeWidth: seleccion.contains(m.id) ? 3 : 1,
                  ),
              for (final z in zonas)
                for (final p in z.area) Polygon(points: p.first, borderColor: colorHex(z.color), borderStrokeWidth: 3),
            ]),
            MarkerLayer(markers: [
              for (final p in puntos)
                Marker(
                  point: p.posicion,
                  width: 26,
                  height: 26,
                  child: GestureDetector(
                    onTap: () => showModalBottomSheet<void>(
                      context: context,
                      builder: (_) => Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(p.titulo, style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 6),
                          Text(p.detalle),
                        ]),
                      ),
                    ),
                    child: _Circulo(color: p.color),
                  ),
                ),
              if (marcador != null) Marker(point: marcador!, width: 30, height: 30, child: const _Circulo(color: verde, borde: Color(0xFF1D4ED8))),
            ]),
            const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap')]),
          ],
        ),
      ),
    );
  }
}

class _Circulo extends StatelessWidget {
  const _Circulo({required this.color, this.borde = Colors.white});
  final Color color;
  final Color borde;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: borde, width: 3)),
      );
}
