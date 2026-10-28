import { useT } from '@/i18n/use-t'
import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/shared/ui/breadcrumb'

/**
 * Where you are: the graph's name ("Untitled graph" until graphs can be named, in phase 3), and
 * later the subgraph path inside it.
 */
export function GraphBreadcrumb() {
  const t = useT()
  return (
    <Breadcrumb
      aria-label={t('graph.breadcrumb')}
      className="flex min-w-0 items-center self-stretch px-2 sm:px-3"
    >
      <BreadcrumbList className="min-w-0 flex-nowrap text-xs">
        <BreadcrumbItem className="min-w-0">
          {/* The current crumb is plain text: shadcn's page crumb is a disabled "link" nobody can use. */}
          <span aria-current="page" className="truncate text-foreground">
            {t('graph.untitled')}
          </span>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
