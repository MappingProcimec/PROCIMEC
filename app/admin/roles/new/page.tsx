import { redirect } from 'next/navigation';

export default function NewRoleRedirectPage() {
  redirect('/admin/roles');
}
