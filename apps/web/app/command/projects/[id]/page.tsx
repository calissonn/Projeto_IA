import { ProjectDetail } from '@/components/command/ProjectDetail';

export const metadata = { title: 'Projeto · AI Command Center' };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetail id={id} />;
}
