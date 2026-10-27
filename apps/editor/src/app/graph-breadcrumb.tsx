import { Breadcrumb, BreadcrumbItem, BreadcrumbList } from '@/shared/ui/breadcrumb'

/** Shown until graphs can be named (phase 3); later crumbs will add the open subgraph. */
const UNTITLED_GRAPH = 'Untitled graph'

/** Where you are: the graph's name, and later the subgraph path inside it. */
export function GraphBreadcrumb() {
  return (
    <Breadcrumb aria-label="Graph" className="flex min-w-0 items-center self-stretch px-2 sm:px-3">
      <BreadcrumbList className="min-w-0 flex-nowrap text-xs">
        <BreadcrumbItem className="min-w-0">
          {/* The current crumb is plain text: shadcn's page crumb is a disabled "link" nobody can use. */}
          <span aria-current="page" className="truncate text-foreground">
            {UNTITLED_GRAPH}
          </span>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
