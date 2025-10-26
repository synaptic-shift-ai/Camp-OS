import { SiteDetailsClient } from "@/components/site-details-client"

export default async function SiteDetailsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params

  return <SiteDetailsClient siteId={siteId} />
}
