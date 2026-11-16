import 'package:flutter/material.dart';

/// Paleta del sistema, la misma de la web: azul marino con el dorado del logo y un color por sección.
abstract final class Colores {
  static const navy = Color(0xFF0B1B3F);
  static const navy2 = Color(0xFF16336E);
  static const oro = Color(0xFFF5B700);
  static const evangelismo = Color(0xFF2563EB);
  static const cultos = Color(0xFF059669);
  static const vis = Color(0xFFEA580C);
  static const amigos = Color(0xFFDB2777);
  static const casos = Color(0xFF0891B2);
  static const informes = Color(0xFF7C3AED);
  static const fondo = Color(0xFFF4F6FB);
  static const linea = Color(0xFFE6E9F2);
  static const tenue = Color(0xFF64708A);
  static const texto = Color(0xFF0F1A33);
  static const peligro = Color(0xFFDC2626);
}

/// Tema de la app con el acento de una sección. Cada formulario se envuelve en el de su color.
ThemeData temaIpuc(Color acento, {Brightness brillo = Brightness.light}) {
  final oscuro = brillo == Brightness.dark;
  final esquema = ColorScheme.fromSeed(
    seedColor: acento,
    brightness: brillo,
    primary: acento,
    surface: oscuro ? const Color(0xFF121A2E) : Colors.white,
    error: Colores.peligro,
  );
  final borde = OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: oscuro ? Colors.white24 : const Color(0xFFCFD5E3), width: 1.5));
  return ThemeData(
    useMaterial3: true,
    colorScheme: esquema,
    scaffoldBackgroundColor: oscuro ? const Color(0xFF0A1020) : Colores.fondo,
    appBarTheme: AppBarTheme(
      backgroundColor: oscuro ? const Color(0xFF0A1020) : Colores.fondo,
      foregroundColor: oscuro ? Colors.white : Colores.texto,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: oscuro ? Colors.white : Colores.texto),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: esquema.surface,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: oscuro ? Colors.white12 : Colores.linea)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: esquema.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      border: borde,
      enabledBorder: borde,
      focusedBorder: borde.copyWith(borderSide: BorderSide(color: acento, width: 2)),
      errorBorder: borde.copyWith(borderSide: const BorderSide(color: Colores.peligro, width: 1.5)),
      focusedErrorBorder: borde.copyWith(borderSide: const BorderSide(color: Colores.peligro, width: 2)),
      labelStyle: const TextStyle(fontWeight: FontWeight.w600),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        side: BorderSide(color: acento.withValues(alpha: 0.5), width: 1.5),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
    chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99))),
  );
}

/// Aplica el color de una sección a todo lo que va dentro.
class ConSeccion extends StatelessWidget {
  const ConSeccion(this.color, this.child, {super.key});
  final Color color;
  final Widget child;
  @override
  Widget build(BuildContext context) => Theme(data: temaIpuc(color, brillo: Theme.of(context).brightness), child: child);
}
