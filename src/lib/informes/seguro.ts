// Excel ejecuta como fórmula el texto que empieza por estos signos.
export const textoSeguro = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
