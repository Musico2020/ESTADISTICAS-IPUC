import '../datos/modelos.dart';
import '../datos/reglas.dart';
import '../datos/repositorio.dart';

/// Lo que se carga una vez al entrar: el perfil y el territorio.
class Sesion {
  Sesion(this.repo, this.perfil, this.zonas, this.sectores, this.manzanas);
  final Repositorio repo;
  final Perfil perfil;
  final List<Zona> zonas;
  final List<Zona> sectores;
  final List<Manzana> manzanas;

  List<Zona> get misZonas => zonasPermitidas(perfil, zonas);
  bool get eligeZona => perfil.rol == Rol.administrador || perfil.rol == Rol.usuario || perfil.rol == Rol.coordinadorSector;
  String nombreZona(String? id) => zonas.where((z) => z.id == id).map((z) => z.nombre).firstOrNull ?? '';

  static Future<Sesion?> cargar(Repositorio repo) async {
    try {
      final perfil = await repo.perfil();
      if (perfil == null) return null;
      final r = await Future.wait([repo.zonas(), repo.sectores(), repo.manzanas()]);
      return Sesion(repo, perfil, r[0] as List<Zona>, r[1] as List<Zona>, r[2] as List<Manzana>);
    } catch (_) {
      return null;
    }
  }
}
