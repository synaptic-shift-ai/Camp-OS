"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Eye } from "lucide-react"
import { ConditionGroup } from "./condition-group"
import { ConditionsPreview } from "./conditions-preview"
import { createEmptyGroup, type ConditionGroupNode } from "@/lib/automations/condition-tree"

type ConditionsSectionProps = {
  groups: ConditionGroupNode[]
  onChange: (groups: ConditionGroupNode[]) => void
  readOnly?: boolean
}

export function ConditionsSection({ groups, onChange, readOnly = false }: ConditionsSectionProps) {
  const [previewOpen, setPreviewOpen] = useState(false)

  const addGroup = () => {
    onChange([...groups, createEmptyGroup("AND")])
  }

  const updateGroup = (index: number, updated: ConditionGroupNode) => {
    const next = [...groups]
    next[index] = updated
    onChange(next)
  }

  const removeGroup = (index: number) => {
    onChange(groups.filter((_, i) => i !== index))
  }

  const moveGroup = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= groups.length) return
    const next = [...groups]
    const a = next[index]
    const b = next[newIndex]
    if (!a || !b) return
    next[index] = b
    next[newIndex] = a
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Conditions</h3>
          <p className="text-sm text-muted-foreground">
            Define when this automation should execute. All groups at the root level are combined with AND logic.
          </p>
        </div>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Preview
            </Button>
          )}
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addGroup}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Group
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
          No conditions defined. This automation will always execute when triggered.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <ConditionGroup
              key={group.id}
              group={group}
              depth={0}
              canMoveUp={index > 0}
              canMoveDown={index < groups.length - 1}
              onUpdate={updated => updateGroup(index, updated)}
              onRemove={() => removeGroup(index)}
              onMoveUp={() => moveGroup(index, "up")}
              onMoveDown={() => moveGroup(index, "down")}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      <ConditionsPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        groups={groups}
      />
    </div>
  )
}
