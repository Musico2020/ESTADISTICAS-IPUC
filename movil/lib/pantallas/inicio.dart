import 'package:flutter/material.dart';

import '../datos/modelos.dart';
import 'formulario_culto.dart';
import 'formulario_persona.dart';
import 'formulario_reporte.dart';
import 'mapa_zona.dart';
import 'sesion.dart';

class PantallaInicio extends StatelessWidget {
  const PantallaInicio({super.key, required this.sesion});
  final Sesion sesion;

  @override
  Widget build(BuildContext context) {
    final p = sesion.perfil;
    final alcance = switch (p.rol) {
      Rol.coordinadorSector => 'Sector ${sesion.sectores.where((s) => s.id == p.sectorId).map((s) => s.numero).firstOrNull ?? ''}',
      Rol.coordinadorZona || Rol.liderZona => sesion.nombreZona(p.zonaId),
      _ => 'Todas las zonas',
    };
    void ir(Widget pantalla) => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => pantalla));
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(p.nombre),
          Text('${etiquetaRol[p.rol]} · $alcance', style: Theme.of(context).textTheme.bodySmall),
        ]),
        actions: [IconButton(tooltip: 'Cerrar sesión', icon: const Icon(Icons.logout), onPressed: sesion.repo.salir)],
      ),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _Opcion(Icons.map, 'Mapa de mi zona', 'Manzanas, cultos y fichas en tiempo real', () => ir(PantallaMapa(sesion: sesion))),
        _Opcion(Icons.home, 'Culto en casa', 'Miércoles y viernes, con la ubicación de la casa', () => ir(FormularioCulto(sesion: sesion))),
        _Opcion(Icons.child_care, 'VIS: niño visitado', 'Ficha del niño con autorización del acudiente', () => ir(FormularioPersona(sesion: sesion, nino: true))),
        _Opcion(Icons.volunteer_activism, 'Amigo', 'Entregas, enfermos y peticiones de oración', () => ir(FormularioPersona(sesion: sesion, nino: false))),
        _Opcion(Icons.campaign, 'Evangelismo', 'Jornada por manzanas', () => ir(FormularioReporte(sesion: sesion))),
      ]),
    );
  }
}

class _Opcion extends StatelessWidget {
  const _Opcion(this.icono, this.titulo, this.detalle, this.alTocar);
  final IconData icono;
  final String titulo;
  final String detalle;
  final VoidCallback alTocar;
  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          leading: CircleAvatar(radius: 26, child: Icon(icono, size: 28)),
          title: Text(titulo, style: Theme.of(context).textTheme.titleMedium),
          subtitle: Text(detalle),
          trailing: const Icon(Icons.chevron_right),
          onTap: alTocar,
        ),
      );
}
