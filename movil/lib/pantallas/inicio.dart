import 'package:flutter/material.dart';

import '../datos/modelos.dart';
import '../ui/tema.dart';
import 'formulario_culto.dart';
import 'formulario_hogar.dart';
import 'formulario_persona.dart';
import 'formulario_reporte.dart';
import 'mapa_zona.dart';
import 'sesion.dart';

const _meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const _dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/// Números del año en el alcance del usuario (la base de datos solo entrega lo que puede ver).
class _Resumen {
  const _Resumen(this.avance, this.cultos, this.hogares);
  final int avance;
  final int cultos;
  final int hogares;

  static Future<_Resumen> cargar(Sesion s) async {
    final anio = DateTime.now().year;
    final r = await Future.wait([s.repo.manzanasAlcanzadas('$anio-01-01', '$anio-12-31'), s.repo.cultos('$anio-01-01', '$anio-12-31'), s.repo.hogares(soloConUbicacion: false)]);
    final ids = s.misZonas.map((z) => z.id).toSet();
    final activas = s.manzanas.where((m) => m.activa && ids.contains(m.zonaId)).toList();
    final alcanzadas = activas.where((m) => (r[0] as Set<String>).contains(m.id)).length;
    final hogares = (r[2] as List<Map<String, dynamic>>).where((h) => (h['creado_en'] as String).startsWith('$anio')).length;
    return _Resumen(activas.isEmpty ? 0 : (alcanzadas * 100 / activas.length).round(), (r[1] as List).length, hogares);
  }
}

class PantallaInicio extends StatefulWidget {
  const PantallaInicio({super.key, required this.sesion});
  final Sesion sesion;
  @override
  State<PantallaInicio> createState() => _PantallaInicioState();
}

class _PantallaInicioState extends State<PantallaInicio> {
  late Future<_Resumen> _resumen = _Resumen.cargar(widget.sesion);

  Future<void> _ir(Widget pantalla) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => pantalla));
    // Al volver de registrar algo, el resumen se actualiza.
    if (mounted) setState(() => _resumen = _Resumen.cargar(widget.sesion));
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.sesion;
    final p = s.perfil;
    final alcance = switch (p.rol) {
      Rol.coordinadorSector => 'Sector ${s.sectores.where((x) => x.id == p.sectorId).map((x) => x.numero).firstOrNull ?? ''}',
      Rol.coordinadorZona || Rol.liderZona => s.nombreZona(p.zonaId),
      _ => 'Todas las zonas',
    };
    final hoy = DateTime.now();
    final fecha = '${_dias[hoy.weekday - 1]} ${hoy.day} de ${_meses[hoy.month - 1]}';
    final nombre = p.nombre.split(' ').first;
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => setState(() => _resumen = _Resumen.cargar(s)),
        child: ListView(padding: EdgeInsets.zero, children: [
          Stack(clipBehavior: Clip.none, children: [
            Container(
              padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 12, 12, 70),
              decoration: const BoxDecoration(
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colores.navy, Color(0xFF1D3F8F), Colores.evangelismo]),
              ),
              child: Stack(clipBehavior: Clip.none, children: [
                Positioned(right: -60, top: -70, child: Container(width: 200, height: 200, decoration: BoxDecoration(shape: BoxShape.circle, color: Colores.oro.withValues(alpha: 0.22)))),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(11)),
                      child: ClipRRect(borderRadius: BorderRadius.circular(9), child: Image.asset('assets/logo-ipuc.png', width: 34, height: 34, fit: BoxFit.cover)),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(child: Text('IPUC Dangond', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
                    IconButton(
                      tooltip: 'Cerrar sesión',
                      style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.14)),
                      icon: const Icon(Icons.logout, color: Colors.white),
                      onPressed: s.repo.salir,
                    ),
                  ]),
                  const SizedBox(height: 18),
                  Text('¡Hola, $nombre!', style: const TextStyle(color: Colors.white, fontSize: 25, fontWeight: FontWeight.w800)),
                  Text(fecha[0].toUpperCase() + fecha.substring(1), style: const TextStyle(color: Colors.white70)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                    decoration: BoxDecoration(color: Colores.oro, borderRadius: BorderRadius.circular(99)),
                    child: Text('★ ${etiquetaRol[p.rol]} · $alcance', style: const TextStyle(color: Color(0xFF3B2C00), fontWeight: FontWeight.w800, fontSize: 12.5)),
                  ),
                ]),
              ]),
            ),
            Positioned(
              left: 16, right: 16, bottom: -44,
              child: FutureBuilder<_Resumen>(
                future: _resumen,
                builder: (context, r) {
                  String v(int Function(_Resumen) f, [String sufijo = '']) => r.hasData ? '${f(r.data!)}$sufijo' : (r.hasError ? '-' : '…');
                  return Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: const [BoxShadow(color: Color(0x330B1B3F), blurRadius: 24, offset: Offset(0, 10))],
                    ),
                    child: Row(children: [
                      _Dato(v((x) => x.avance, '%'), 'Manzanas', Colores.evangelismo),
                      _Dato(v((x) => x.cultos), 'Cultos', Colores.cultos),
                      _Dato(v((x) => x.hogares), 'Hogares VIS', Colores.vis),
                    ]),
                  );
                },
              ),
            ),
          ]),
          const SizedBox(height: 60),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(children: [
              Row(children: [
                _Mosaico(Icons.home, 'Culto en casa', 'Miércoles y viernes', Colores.cultos, () => _ir(FormularioCulto(sesion: s))),
                const SizedBox(width: 12),
                _Mosaico(Icons.family_restroom, 'Hogar VIS', 'La familia completa', Colores.vis, () => _ir(FormularioHogar(sesion: s))),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                _Mosaico(Icons.volunteer_activism, 'Amigo', 'Oración y entrega', Colores.amigos, () => _ir(FormularioPersona(sesion: s))),
                const SizedBox(width: 12),
                _Mosaico(Icons.campaign, 'Evangelismo', 'Jornada por manzanas', Colores.evangelismo, () => _ir(FormularioReporte(sesion: s))),
              ]),
              const SizedBox(height: 12),
              _Ancho(onTap: () => _ir(PantallaMapa(sesion: s))),
              const SizedBox(height: 24),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Dato extends StatelessWidget {
  const _Dato(this.valor, this.texto, this.color);
  final String valor;
  final String texto;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(children: [
          Text(valor, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
          Text(texto, style: const TextStyle(fontSize: 12, color: Colores.tenue, fontWeight: FontWeight.w600)),
        ]),
      );
}

class _Mosaico extends StatelessWidget {
  const _Mosaico(this.icono, this.titulo, this.detalle, this.color, this.alTocar);
  final IconData icono;
  final String titulo;
  final String detalle;
  final Color color;
  final VoidCallback alTocar;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Semantics(
          button: true,
          label: titulo,
          child: Material(
            borderRadius: BorderRadius.circular(20),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: alTocar,
              child: Ink(
                height: 124,
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.lerp(color, Colors.black, 0.18)!, Color.lerp(color, Colors.white, 0.22)!]),
                ),
                child: Stack(children: [
                  Positioned(right: -22, bottom: -22, child: Container(width: 84, height: 84, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.16)))),
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Container(
                        width: 40, height: 40,
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(12)),
                        child: Icon(icono, color: Colors.white),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(titulo, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15.5)),
                        Text(detalle, style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      ]),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
      );
}

class _Ancho extends StatelessWidget {
  const _Ancho({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: 'Mapa de mi zona',
        child: Material(
          borderRadius: BorderRadius.circular(20),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Ink(
              height: 86,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: const BoxDecoration(gradient: LinearGradient(colors: [Colores.navy, Colores.navy2])),
              child: Row(children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: Colores.oro.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(13)),
                  child: const Icon(Icons.map, color: Colores.oro),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Mapa de mi zona', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                    Text('Casas, hogares y manzanas en tiempo real', style: TextStyle(color: Colors.white70, fontSize: 12.5)),
                  ]),
                ),
                const Icon(Icons.chevron_right, color: Colors.white),
              ]),
            ),
          ),
        ),
      );
}
