interface auditingPageHeaderProps {
    propertyId: string | null
}

export default function AuditingPageHeader({ propertyId }: auditingPageHeaderProps) {
    return (
        <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Activity Logs</h1>
                    <p className="text-sm text-muted-foreground sm:text-base">
                        Track and manage all your property activities
                    </p>
                </div>
            </div>
        </>
    )
}