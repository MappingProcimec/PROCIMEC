import { redirect } from 'next/navigation';

export default function RetornoEquipoRedirectPage() {
  redirect('/forms/registro-equipo?mode=retorno');
}
