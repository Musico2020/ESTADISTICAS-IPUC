import 'package:latlong2/latlong.dart';

import 'modelos.dart';

// Mismas reglas que la web (src/lib/*.ts). La base de datos vuelve a validarlas; esto solo avisa antes.

/// Supabase Auth exige correo: el nombre de usuario se guarda en un dominio reservado.
String aCorreo(String usuario) {
  final limpio = usuario.trim().toLowerCase();
  return limpio.contains('@') ? limpio : '$limpio@usuarios-ipuc.example.com';
}

List<Zona> zonasPermitidas(Perfil p, List<Zona> zonas) => switch (p.rol) {
      Rol.administrador || Rol.usuario => zonas,
      Rol.coordinadorSector => zonas.where((z) => z.sectorId == p.sectorId).toList(),
      _ => zonas.where((z) => z.id == p.zonaId).toList(),
    };

bool eligeZona(Perfil p) => p.rol == Rol.administrador || p.rol == Rol.usuario || p.rol == Rol.coordinadorSector;

// Regla del rayo: cuenta cuántas veces una línea horizontal desde el punto cruza el borde.
bool _enAnillo(LatLng p, List<LatLng> anillo) {
  var dentro = false;
  for (var i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    final a = anillo[i], b = anillo[j];
    if ((a.latitude > p.latitude) != (b.latitude > p.latitude) &&
        p.longitude < (b.longitude - a.longitude) * (p.latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude) {
      dentro = !dentro;
    }
  }
  return dentro;
}

bool contiene(Area area, LatLng p) =>
    area.any((poligono) => _enAnillo(p, poligono.first) && !poligono.skip(1).any((hueco) => _enAnillo(p, hueco)));

Zona? zonaDePunto(List<Zona> zonas, LatLng p) {
  for (final z in zonas) {
    if (contiene(z.area, p)) return z;
  }
  return null;
}

final _entero = RegExp(r'^\d+$');
bool esEntero(String v) => _entero.hasMatch(v.trim());

/// Pesos sin centavos: "50000", "50.000" o "$ 50.000". Null si no es válido.
int? pesos(String texto) {
  final limpio = texto.trim().replaceFirst(RegExp(r'^\$\s*'), '');
  if (limpio.isEmpty) return 0;
  if (!RegExp(r'^\d{1,3}(\.\d{3})*$|^\d+$').hasMatch(limpio)) return null;
  return int.parse(limpio.replaceAll('.', ''));
}

bool telefonoValido(String t) => RegExp(r'^(\+?57)?\d{7,10}$').hasMatch(t.replaceAll(RegExp(r'[\s()-]'), ''));

String hoyIso() => DateTime.now().toIso8601String().substring(0, 10);
bool fechaFutura(String f) => f.compareTo(hoyIso()) > 0;

String formatoPesos(int n) {
  final s = n.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write('.');
    b.write(s[i]);
  }
  return '\$ $b';
}

const dias = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

Map<String, String> validarCulto({
  required String? zonaId, required String fecha, required String direccion, required LatLng? ubicacion,
  required String hermanos, required String amigos, required String ninos, required String ofrenda,
}) {
  final e = <String, String>{};
  if (zonaId == null || zonaId.isEmpty) e['zona'] = 'Elija la zona';
  if (fecha.isEmpty) {
    e['fecha'] = 'Elija la fecha del culto';
  } else if (fechaFutura(fecha)) {
    e['fecha'] = 'La fecha no puede ser futura';
  }
  if (direccion.trim().isEmpty) e['direccion'] = 'Escriba la dirección de la casa';
  if (ubicacion == null) e['ubicacion'] = 'Toque «Usar mi ubicación» o marque la casa en el mapa';
  if (!esEntero(hermanos)) e['hermanos'] = 'Escriba un número entero';
  if (!esEntero(amigos)) e['amigos'] = 'Escriba un número entero';
  if (!esEntero(ninos)) e['ninos'] = 'Escriba un número entero';
  if (pesos(ofrenda) == null) e['ofrenda'] = 'Escriba solo el valor en pesos, por ejemplo 50000';
  return e;
}

/// Ficha de un amigo. Los integrantes de los hogares de VIS se validan con validarHogar.
Map<String, String> validarPersona({
  required String? zonaId, required String nombre, required String edad, required String telefono,
  required bool pideOracion, required String peticion,
}) {
  final e = <String, String>{};
  if (zonaId == null || zonaId.isEmpty) e['zona'] = 'Elija la zona';
  if (nombre.trim().isEmpty) e['nombre'] = 'Escriba el nombre';
  final ed = edad.trim();
  if (ed.isNotEmpty && !esEntero(ed)) {
    e['edad'] = 'Escriba la edad en años, sin decimales';
  } else if (ed.isNotEmpty && int.parse(ed) > 120) {
    e['edad'] = 'Revise la edad';
  }
  if (telefono.trim().isNotEmpty && !telefonoValido(telefono)) e['telefono'] = 'Escriba un teléfono de 7 a 10 dígitos';
  if (pideOracion && peticion.trim().isEmpty) e['peticion'] = 'Escriba la petición de oración';
  return e;
}

const parentescos = ['Padre', 'Madre', 'Hijo', 'Hija', 'Abuelo', 'Abuela', 'Tío', 'Tía', 'Nieto', 'Nieta', 'Hermano', 'Hermana', 'Otro'];

/// Una persona que vive en el hogar visitado. Los textos se editan directamente en el formulario.
class Integrante {
  Integrante({this.id, this.nombre = '', this.edad = '', this.parentesco, this.telefono = '', this.peticion = '',
      this.enfermo = false, this.pideOracion = false, this.entregoVida = false, this.estado = 'nuevo'});
  final String? id;
  String nombre;
  String edad;
  String? parentesco;
  String telefono;
  String peticion;
  bool enfermo;
  bool pideOracion;
  bool entregoVida;
  String estado;

  bool get esMenor => esEntero(edad) && int.parse(edad.trim()) < 18;

  Map<String, dynamic> aFila() => {
        'id': id, 'nombre': nombre.trim(), 'edad': int.parse(edad.trim()), 'parentesco': parentesco,
        'telefono': telefono.trim().isEmpty ? null : telefono.trim(), 'enfermo': enfermo, 'pide_oracion': pideOracion,
        'peticion': pideOracion && peticion.trim().isNotEmpty ? peticion.trim() : null, 'entrego_vida': entregoVida, 'estado_seguimiento': estado,
      };
}

/// Errores del hogar. Los de cada integrante usan la clave `i<n>.<campo>`, por ejemplo "i1.edad".
Map<String, String> validarHogar({
  required String? zonaId, required String familia, required String direccion, required String telefono,
  required bool pideOracion, required String peticion, required bool autorizacion, required List<Integrante> integrantes,
}) {
  final e = <String, String>{};
  if (zonaId == null || zonaId.isEmpty) e['zona'] = 'Elija la zona';
  if (familia.trim().isEmpty) e['familia'] = 'Escriba el nombre de la familia';
  if (direccion.trim().isEmpty) e['direccion'] = 'Escriba la dirección del hogar';
  if (telefono.trim().isNotEmpty && !telefonoValido(telefono)) e['telefono'] = 'Escriba un teléfono de 7 a 10 dígitos';
  if (pideOracion && peticion.trim().isEmpty) e['peticion'] = 'Escriba la petición de oración';
  if (integrantes.isEmpty) e['integrantes'] = 'Agregue al menos un integrante de la familia';
  for (var n = 0; n < integrantes.length; n++) {
    final i = integrantes[n];
    if (i.nombre.trim().isEmpty) e['i$n.nombre'] = 'Escriba el nombre';
    if (i.edad.trim().isEmpty) {
      e['i$n.edad'] = 'Escriba la edad';
    } else if (!esEntero(i.edad)) {
      e['i$n.edad'] = 'Edad en años, sin decimales';
    } else if (int.parse(i.edad.trim()) > 120) {
      e['i$n.edad'] = 'Revise la edad';
    }
    if (i.parentesco == null || i.parentesco!.isEmpty) e['i$n.parentesco'] = 'Elija el parentesco';
    if (i.telefono.trim().isNotEmpty && !telefonoValido(i.telefono)) e['i$n.telefono'] = 'Teléfono de 7 a 10 dígitos';
    if (i.pideOracion && i.peticion.trim().isEmpty) e['i$n.peticion'] = 'Escriba la petición';
  }
  if (integrantes.any((i) => i.esMenor) && !autorizacion) e['autorizacion'] = 'Hay menores de edad: falta la autorización del adulto responsable';
  return e;
}

Map<String, String> validarReporte({
  required String? zonaId, required String responsable, required String coordinador, required String fecha,
  required String hogares, required String personas, required String aceptan, required String resultado,
  required String? receptividad, required String? dificultad, required String dificultadOtra,
  required bool evangelismoNinos, required String ninos, required bool hayCaso, required String descripcionCaso,
  required int manzanas,
}) {
  final e = <String, String>{};
  if (zonaId == null || zonaId.isEmpty) e['zona'] = 'Elija la zona';
  if (responsable.trim().isEmpty) e['responsable'] = 'Escriba el nombre del responsable';
  if (coordinador.trim().isEmpty) e['coordinador'] = 'Escriba el nombre del coordinador';
  if (fecha.isEmpty) {
    e['fecha'] = 'Elija la fecha de la jornada';
  } else if (fechaFutura(fecha)) {
    e['fecha'] = 'La fecha no puede ser futura';
  }
  for (final (c, v) in [('hogares', hogares), ('personas', personas), ('aceptan', aceptan)]) {
    if (!esEntero(v)) e[c] = 'Escriba un número entero, sin decimales';
  }
  if (resultado.trim().isEmpty) e['resultado'] = 'Describa el resultado espiritual';
  if (receptividad == null) e['receptividad'] = 'Califique de 1 a 5';
  if (dificultad == null) e['dificultad'] = 'Elija una opción';
  if (dificultad == 'otra' && dificultadOtra.trim().isEmpty) e['dificultad_otra'] = 'Describa la dificultad';
  if (evangelismoNinos && !esEntero(ninos)) e['ninos'] = 'Escriba un número entero, sin decimales';
  if (hayCaso && descripcionCaso.trim().isEmpty) e['caso'] = 'Describa brevemente el caso';
  if (manzanas == 0) e['manzanas'] = 'Toque en el mapa al menos una manzana';
  return e;
}

const dificultades = {
  'poco_tiempo': 'Poco tiempo',
  'falta_acompanamiento': 'Falta de acompañamiento',
  'rechazo': 'Rechazo de las personas',
  'clima': 'Condiciones climáticas',
  'ninguna': 'Ninguna',
  'otra': 'Otra',
};

const estadosSeguimiento = {
  'nuevo': 'Nuevo',
  'en_seguimiento': 'En seguimiento',
  'congregado': 'Ya se congrega',
  'sin_contacto': 'Sin contacto',
};
