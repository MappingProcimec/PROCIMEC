import { redirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Detalle de Proyecto — PROCIMEC',
};

interface ProjectPageProps {
  params: {
    projectId: string;
  };
}

export default function ProjectRedirectPage({ params }: ProjectPageProps) {
  redirect(`/projects/${params.projectId}/reports`);
}
