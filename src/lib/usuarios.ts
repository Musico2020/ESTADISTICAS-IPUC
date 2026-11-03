// Supabase Auth exige un correo, así que el nombre de usuario se guarda como un correo interno.
// El dominio está reservado (RFC 2606), por lo que nunca llega un mensaje a un tercero.
const DOMINIO_INTERNO = "usuarios-ipuc.example.com";

export const aCorreo = (usuario: string) => {
  const limpio = usuario.trim().toLowerCase();
  return limpio.includes("@") ? limpio : `${limpio}@${DOMINIO_INTERNO}`;
};
