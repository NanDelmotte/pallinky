import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function EventChatFallbackPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { token = '' } = await searchParams;
  const suffix = token ? `?token=${encodeURIComponent(token)}` : '';

  redirect(`/event/${encodeURIComponent(slug)}${suffix}`);
}
