import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <article>
      <PageHeader
        title="Page not found"
        description="There is no page at this address in CampusOS. It may have been renamed, or the link may be incomplete."
      />
      <Button asChild className="min-h-11">
        <Link to="/">Back to Home</Link>
      </Button>
    </article>
  )
}
