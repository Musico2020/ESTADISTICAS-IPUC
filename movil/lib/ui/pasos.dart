import 'package:flutter/material.dart';

import 'campos.dart';

/// Un paso de un formulario: su título, su contenido y los campos cuyos errores le pertenecen.
class Paso {
  const Paso(this.titulo, this.contenido, {this.campos = const {}});
  final String titulo;
  final List<Widget> Function() contenido;
  final Set<String> campos;
}

/// Formulario por pasos con barra de progreso y un botón fijo abajo, grande para el dedo.
/// [validar] recibe los campos del paso actual (o null en el último, para revisar todo), muestra solo esos errores
/// y devuelve todos; solo se avanza si el paso actual no tiene ninguno.
class FormularioPorPasos extends StatefulWidget {
  const FormularioPorPasos({
    super.key,
    required this.titulo,
    required this.pasos,
    required this.validar,
    required this.guardar,
    required this.textoGuardar,
    required this.enviando,
  });
  final String titulo;
  final List<Paso> pasos;
  final Map<String, String> Function(Set<String>? campos) validar;
  final VoidCallback guardar;
  final String textoGuardar;
  final bool enviando;

  @override
  State<FormularioPorPasos> createState() => _FormularioPorPasosState();
}

class _FormularioPorPasosState extends State<FormularioPorPasos> {
  int _actual = 0;
  final _desplazar = ScrollController();

  bool get _ultimo => _actual == widget.pasos.length - 1;

  void _ir(int paso) {
    setState(() => _actual = paso);
    if (_desplazar.hasClients) _desplazar.jumpTo(0);
  }

  void _siguiente() {
    final errores = widget.validar(widget.pasos[_actual].campos);
    final propios = errores.keys.where(widget.pasos[_actual].campos.contains);
    if (propios.isNotEmpty) {
      avisar(context, 'Revise los campos marcados', error: true);
      return;
    }
    if (_ultimo) {
      widget.guardar();
    } else {
      _ir(_actual + 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    final paso = widget.pasos[_actual];
    return PopScope(
      canPop: _actual == 0,
      onPopInvokedWithResult: (salio, _) {
        if (!salio && _actual > 0) _ir(_actual - 1);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(widget.titulo),
            Text('Paso ${_actual + 1} de ${widget.pasos.length} · ${paso.titulo}',
                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(0xFF64708A))),
          ]),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(14),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Row(children: [
                for (var i = 0; i < widget.pasos.length; i++)
                  Expanded(
                    child: GestureDetector(
                      // Solo se puede volver a pasos anteriores tocando la barra.
                      onTap: i < _actual ? () => _ir(i) : null,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        height: 6,
                        margin: EdgeInsets.only(right: i < widget.pasos.length - 1 ? 6 : 0),
                        decoration: BoxDecoration(color: i <= _actual ? color : color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(9)),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        ),
        body: ListView(controller: _desplazar, padding: const EdgeInsets.fromLTRB(14, 8, 14, 24), children: paso.contenido()),
        bottomNavigationBar: SafeArea(
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
            decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, boxShadow: const [BoxShadow(color: Color(0x1A0B1B3F), blurRadius: 18, offset: Offset(0, -6))]),
            child: Row(children: [
              if (_actual > 0) ...[
                SizedBox(width: 120, child: OutlinedButton(onPressed: () => _ir(_actual - 1), child: const Text('Atrás'))),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: FilledButton.icon(
                  onPressed: widget.enviando ? null : _siguiente,
                  icon: Icon(_ultimo ? Icons.check_circle : Icons.arrow_forward),
                  label: Text(_ultimo ? (widget.enviando ? 'Guardando...' : widget.textoGuardar) : 'Siguiente'),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Tarjeta de color con el resumen antes de guardar.
class Resumen extends StatelessWidget {
  const Resumen(this.filas, {super.key});
  final List<(String, String)> filas;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.lerp(c, Colors.black, 0.25)!, c, Color.lerp(c, Colors.white, 0.25)!]),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Resumen antes de guardar', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        for (final (k, v) in filas)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(children: [
              Text(k, style: const TextStyle(color: Colors.white)),
              const Spacer(),
              Text(v, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            ]),
          ),
      ]),
    );
  }
}
