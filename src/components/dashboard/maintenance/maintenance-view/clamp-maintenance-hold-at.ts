export type TaskDetailsForHoldClamp = {
  started_at: string | null
}

export function clampMaintenanceHoldAtIso(
  serverOnHoldAt: string | undefined,
  previous: TaskDetailsForHoldClamp,
  lastProgressEndMs: number,
): string {
  const parsedServer =
    typeof serverOnHoldAt === "string" ? new Date(serverOnHoldAt).getTime() : Number.NaN
  const serverMs = Number.isFinite(parsedServer) ? parsedServer : lastProgressEndMs
  const startMs = previous.started_at ? new Date(previous.started_at).getTime() : 0
  return new Date(Math.max(serverMs, lastProgressEndMs, startMs)).toISOString()
}
