import 'package:evangelismo_ipuc/datos/modelos.dart';
import 'package:evangelismo_ipuc/datos/reglas.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';

List<List<LatLng>> cuadro(double lat, double lon, [double t = 1]) => [
      [LatLng(lat, lon), LatLng(lat, lon + t), LatLng(lat + t, lon + t), LatLng(lat + t, lon), LatLng(lat, lon)],
    ];

Zona zona(String id, String sector, Area area) => Zona(id: id, numero: 1, nombre: id, sectorId: sector, color: '#000000', area: area);

void main() {
  final z1 = zona('z1', 's1', [
    [...cuadro(0, 0, 4), ...cuadro(1, 1, 1)], // con un hueco
  ]);
  final z2 = zona('z2', 's1', [cuadro(10, 10)]);
  final z4 = zona('z4', 's2', [cuadro(20, 0), cuadro(30, 0)]);
  final zonas = [z1, z2, z4];
  Perfil perfil(Rol rol, {String? zona, String? sector}) => Perfil(id: 'yo', nombre: 'X', rol: rol, zonaId: zona, sectorId: sector);

  group('aCorreo', () {
    test('convierte el usuario en correo interno, igual que la web', () {
      expect(aCorreo('  Admin '), 'admin@usuarios-ipuc.example.com');
      expect(aCorreo('Ana@ejemplo.org'), 'ana@ejemplo.org');
    });
  });

  group('zonas y roles', () {
    test('cada rol ve las zonas de su alcance', () {
      expect(zonasPermitidas(perfil(Rol.administrador), zonas).length, 3);
      expect(zonasPermitidas(perfil(Rol.coordinadorSector, sector: 's1'), zonas).map((z) => z.id), ['z1', 'z2']);
      expect(zonasPermitidas(perfil(Rol.liderZona, zona: 'z4'), zonas).map((z) => z.id), ['z4']);
      expect(eligeZona(perfil(Rol.liderZona, zona: 'z4')), isFalse);
      expect(eligeZona(perfil(Rol.coordinadorSector, sector: 's1')), isTrue);
    });
    test('ubica un punto en su zona, respeta huecos y zonas en varias partes', () {
      expect(zonaDePunto(zonas, const LatLng(3, 3))?.id, 'z1');
      expect(zonaDePunto(zonas, const LatLng(1.5, 1.5)), isNull);
      expect(zonaDePunto(zonas, const LatLng(30.5, 0.5))?.id, 'z4');
      expect(zonaDePunto(zonas, const LatLng(50, 50)), isNull);
    });
  });

  group('números y textos', () {
    test('pesos acepta puntos de miles y rechaza decimales', () {
      expect(pesos('50.000'), 50000);
      expect(pesos('\$ 1.250.000'), 1250000);
      expect(pesos(''), 0);
      expect(pesos('50,5'), isNull);
      expect(pesos('5.00'), isNull);
      expect(formatoPesos(1250000), '\$ 1.250.000');
    });
    test('teléfonos colombianos', () {
      for (final t in ['3001234567', '+57 300 123 4567', '605-5712345']) {
        expect(telefonoValido(t), isTrue, reason: t);
      }
      expect(telefonoValido('12'), isFalse);
    });
  });

  group('validarCulto', () {
    Map<String, String> culto({LatLng? u = const LatLng(1, 1), String hermanos = '12', String fecha = '2026-01-10'}) => validarCulto(
          zonaId: 'z1', fecha: fecha, direccion: 'Calle 1', ubicacion: u, hermanos: hermanos, amigos: '3', ninos: '0', ofrenda: '50.000');
    test('acepta un culto completo', () => expect(culto(), isEmpty));
    test('exige ubicación, enteros y fecha no futura', () {
      expect(culto(u: null).keys, contains('ubicacion'));
      expect(culto(hermanos: '2.5').keys, contains('hermanos'));
      expect(culto(fecha: '2999-01-01').keys, contains('fecha'));
    });
  });

  group('validarPersona', () {
    test('un amigo solo exige nombre y zona', () {
      expect(validarPersona(zonaId: 'z1', nombre: 'Carlos', edad: '', telefono: '', pideOracion: false, peticion: ''), isEmpty);
      expect(validarPersona(zonaId: null, nombre: ' ', edad: '', telefono: '', pideOracion: false, peticion: '').keys, containsAll(['zona', 'nombre']));
    });
    test('un amigo que pide oración necesita la petición', () {
      final e = validarPersona(zonaId: 'z1', nombre: 'Carlos', edad: '', telefono: '', pideOracion: true, peticion: '');
      expect(e.keys, ['peticion']);
    });
  });

  group('validarHogar', () {
    Map<String, String> hogar(List<Integrante> integrantes, {bool autorizacion = false, String familia = 'Familia Pérez'}) => validarHogar(
        zonaId: 'z1', familia: familia, direccion: 'Calle 1', telefono: '', pideOracion: false, peticion: '',
        autorizacion: autorizacion, integrantes: integrantes);
    Integrante adulto() => Integrante(nombre: 'Ana', edad: '34', parentesco: 'Madre');
    test('acepta un hogar con un adulto', () => expect(hogar([adulto()]), isEmpty));
    test('exige familia y al menos un integrante', () {
      expect(hogar([], familia: ' ').keys, containsAll(['familia', 'integrantes']));
    });
    test('marca el error en el integrante que corresponde', () {
      final e = hogar([adulto(), Integrante(nombre: '', edad: '7.5')]);
      expect(e.keys, containsAll(['i1.nombre', 'i1.edad', 'i1.parentesco']));
      expect(e.keys.where((k) => k.startsWith('i0.')), isEmpty);
    });
    test('con menores exige la autorización del adulto responsable', () {
      final nino = Integrante(nombre: 'Luis', edad: '8', parentesco: 'Hijo');
      expect(nino.esMenor, isTrue);
      expect(hogar([adulto(), nino]).keys, contains('autorizacion'));
      expect(hogar([adulto(), nino], autorizacion: true), isEmpty);
    });
    test('convierte el integrante en la fila que espera la base de datos', () {
      final fila = Integrante(nombre: ' Ana ', edad: '34', parentesco: 'Madre', peticion: 'x').aFila();
      expect(fila, containsPair('edad', 34));
      expect(fila, containsPair('nombre', 'Ana'));
      expect(fila, containsPair('peticion', null));
      expect(fila, containsPair('telefono', null));
    });
  });

  group('validarReporte', () {
    Map<String, String> reporte({int manzanas = 1, bool hayCaso = false, String? dificultad = 'ninguna'}) => validarReporte(
        zonaId: 'z1', responsable: 'Ana', coordinador: 'Luis', fecha: '2026-01-10', hogares: '12', personas: '20',
        aceptan: '3', resultado: 'Oraron', receptividad: '4', dificultad: dificultad, dificultadOtra: '',
        evangelismoNinos: false, ninos: '', hayCaso: hayCaso, descripcionCaso: '', manzanas: manzanas);
    test('acepta un reporte completo con más de 5 hogares', () => expect(reporte(), isEmpty));
    test('exige manzanas, descripción del caso y detalle de otra dificultad', () {
      expect(reporte(manzanas: 0).keys, contains('manzanas'));
      expect(reporte(hayCaso: true).keys, contains('caso'));
      expect(reporte(dificultad: 'otra').keys, contains('dificultad_otra'));
    });
  });
}
