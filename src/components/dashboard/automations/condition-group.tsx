"use client"

import { Button } from "@/components/ui/button"
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { ConditionRow } from "./condition-row"
import { createEmptyCondition, createEmptyGroup, type ConditionGroupNode, type ConditionNode } from "@/lib/automations/condition-tree"
import { cn } from "@/lib/utils"

type ConditionGroupProps = {
  group: ConditionGroupNode
  depth: number
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate: (group: ConditionGroupNode) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  readOnly?: boolean
}

const MAX_DEPTH = 5

export function ConditionGroup({
  group,
  depth,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  readOnly = false,
}: ConditionGroupProps) {
  const isOr = group.logicOperator === "OR"

  // ── Condition mutations ───────────────────────────────────────────────
  const addCondition = () => {
    onUpdate({ ...group, conditions: [...group.conditions, createEmptyCondition()] })
  }

  const updateCondition = (index: number, condition: ConditionNode) => {
    const next = [...group.conditions]
    next[index] = condition
    onUpdate({ ...group, conditions: next })
  }

  const removeCondition = (index: number) => {
    onUpdate({ ...group, conditions: group.conditions.filter((_, i) => i !== index) })
  }

  const moveCondition = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= group.conditions.length) return
    const next = [...group.conditions]
    const a = next[index]
    const b = next[newIndex]
    if (!a || !b) return
    next[index] = b
    next[newIndex] = a
    onUpdate({ ...group, conditions: next })
  }

  // ── Nested group mutations ────────────────────────────────────────────
  const addNestedGroup = () => {
    onUpdate({ ...group, children: [...group.children, createEmptyGroup(isOr ? "OR" : "AND")] })
  }

  const updateNestedGroup = (index: number, updated: ConditionGroupNode) => {
    const next = [...group.children]
    next[index] = updated
    onUpdate({ ...group, children: next })
  }

  const removeNestedGroup = (index: number) => {
    onUpdate({ ...group, children: group.children.filter((_, i) => i !== index) })
  }

  const moveNestedGroup = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= group.children.length) return
    const next = [...group.children]
    const a = next[index]
    const b = next[newIndex]
    if (!a || !b) return
    next[index] = b
    next[newIndex] = a
    onUpdate({ ...group, children: next })
  }

  // ── Toggle logic ──────────────────────────────────────────────────────
  const toggleLogic = () => {
    onUpdate({ ...group, logicOperator: isOr ? "AND" : "OR" })
  }

  const totalItems = group.conditions.length + group.children.length

  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden",
        isOr ? "border-amber-300/60 dark:border-amber-800/60" : "border-border",
      )}
    >
      {/* Group header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 border-b",
          isOr
            ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-800/50"
            : "bg-muted/50 border-border",
        )}
      >
        {depth === 0 && !readOnly && (
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canMoveUp} onClick={onMoveUp}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canMoveDown} onClick={onMoveDown}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <button
          type="button"
          className={cn(
            "px-2.5 py-0.5 rounded font-mono font-bold text-xs transition-colors",
            isOr
              ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
              : "bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200",
          )}
          onClick={toggleLogic}
          title={`Click to switch to ${isOr ? "AND" : "OR"}`}
        >
          {group.logicOperator}
        </button>

        <span className="text-sm text-muted-foreground">
          {totalItems} item{totalItems !== 1 ? "s" : ""}
        </span>

        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Tree content */}
      <div className="p-4">
        {totalItems === 0 ? (
          !readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-sm" onClick={addCondition}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Condition
              </Button>
              {depth < MAX_DEPTH && (
                <Button variant="outline" size="sm" className="text-sm" onClick={addNestedGroup}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Nested Group
                </Button>
              )}
            </div>
          )
        ) : (
          <div className="relative">
            {/* Vertical trunk — dashed ghost */}
            <div
              className="absolute left-[7px] top-3 w-px border-l border-dashed border-muted-foreground/25"
              style={{ bottom: readOnly ? 0 : "2.5rem" }}
            />

            {/* Conditions */}
            {group.conditions.map((condition, index) => (
              <div key={condition.id} className="relative flex items-start gap-3 pb-4">
                <div className="relative w-4 shrink-0 h-full">
                  <div className="absolute left-[7px] top-[0.875rem] w-3 border-t border-dashed border-muted-foreground/25" />
                </div>
                <div className="flex-1 min-w-0">
                  <ConditionRow
                    condition={condition}
                    canMoveUp={index > 0}
                    canMoveDown={index < group.conditions.length - 1}
                    onUpdate={updated => updateCondition(index, updated)}
                    onRemove={() => removeCondition(index)}
                    onMoveUp={() => moveCondition(index, "up")}
                    onMoveDown={() => moveCondition(index, "down")}
                    readOnly={readOnly}
                  />
                </div>
              </div>
            ))}

            {/* Nested groups */}
            {group.children.map((child, index) => (
              <div key={child.id} className="relative flex items-start gap-3 pb-4">
                <div className="relative w-4 shrink-0 h-full">
                  <div className="absolute left-[7px] top-[0.875rem] w-3 border-t border-dashed border-muted-foreground/25" />
                </div>
                <div className="flex-1 min-w-0">
                  <ConditionGroup
                    group={child}
                    depth={depth + 1}
                    canMoveUp={index > 0}
                    canMoveDown={index < group.children.length - 1}
                    onUpdate={updated => updateNestedGroup(index, updated)}
                    onRemove={() => removeNestedGroup(index)}
                    onMoveUp={() => moveNestedGroup(index, "up")}
                    onMoveDown={() => moveNestedGroup(index, "down")}
                    readOnly={readOnly}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add buttons row */}
        {!readOnly && totalItems > 0 && (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="text-sm" onClick={addCondition}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Condition
            </Button>
            {depth < MAX_DEPTH && (
              <Button variant="outline" size="sm" className="text-sm" onClick={addNestedGroup}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Nested Group
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
