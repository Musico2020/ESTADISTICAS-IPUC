import 'package:latlong2/latlong.dart';

/// Una zona o sector es la unión de manzanas y puede quedar en varias partes.
/// Se guarda como lista de polígonos; cada polígono, como lista de anillos (el primero es el borde).
typedef Area = List<List<List<LatLng>>>;

Area leerArea(Map<String, dynamic> geojson) {
  List<LatLng> anillo(List<dynamic> puntos) =>
      puntos.map((p) => LatLng((p[1] as num).toDouble(), (p[0] as num).toDouble())).toList();
  List<List<LatLng>> poligono(List<dynamic> anillos) => anillos.map((a) => anillo(a as List)).toList();
  final coords = geojson['coordinates'] as List;
  return geojson['type'] == 'MultiPolygon' ? coords.map((p) => poligono(p as List)).toList() : [poligono(coords)];
}

enum Rol { administrador, coordinadorSector, coordinadorZona, liderZona, usuario }

Rol rolDesde(String r) => switch (r) {
      'administrador' => Rol.administrador,
      'coordinador_sector' => Rol.coordinadorSector,
      'coordinador_zona' => Rol.coordinadorZona,
      'lider_zona' => Rol.liderZona,
      _ => Rol.usuario,
    };

const etiquetaRol = {
  Rol.administrador: 'Superusuario',
  Rol.coordinadorSector: 'Coordinador de sector',
  Rol.coordinadorZona: 'Coordinador de zona',
  Rol.liderZona: 'Líder de zona',
  Rol.usuario: 'Cuenta compartida',
};

class Perfil {
  Perfil({required this.id, required this.nombre, required this.rol, this.zonaId, this.sectorId});
  final String id;
  final String nombre;
  final Rol rol;
  final String? zonaId;
  final String? sectorId;

  factory Perfil.desde(Map<String, dynamic> m) => Perfil(
        id: m['id'] as String,
        nombre: m['nombre_completo'] as String,
        rol: rolDesde(m['rol'] as String),
        zonaId: m['zona_id'] as String?,
        sectorId: m['sector_id'] as String?,
      );
}

class Zona {
  Zona({required this.id, required this.numero, required this.nombre, required this.sectorId, required this.color, required this.area});
  final String id;
  final int numero;
  final String nombre;
  final String? sectorId;
  final String color;
  final Area area;

  factory Zona.desde(Map<String, dynamic> m) => Zona(
        id: m['id'] as String,
        numero: m['numero'] as int,
        nombre: m['nombre'] as String,
        sectorId: m['sector_id'] as String?,
        color: m['color_borde'] as String,
        area: leerArea(m['geometria'] as Map<String, dynamic>),
      );
}

class Manzana {
  Manzana({required this.id, required this.zonaId, required this.codigo, required this.area, required this.activa});
  final String id;
  final String zonaId;
  final String codigo;
  final Area area;
  final bool activa;

  factory Manzana.desde(Map<String, dynamic> m) => Manzana(
        id: m['id'] as String,
        zonaId: m['zona_id'] as String,
        codigo: m['codigo'] as String,
        area: leerArea(m['geometria'] as Map<String, dynamic>),
        activa: m['activa'] as bool? ?? true,
      );
}
