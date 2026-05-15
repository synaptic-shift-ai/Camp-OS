"use client";

import { useState, useCallback, useMemo } from "react";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";

interface UseDialogCloseGuardOptions {
  /** Whether the dialog currently has unsaved changes */
  isDirty: boolean;
  /** Whether the dialog is currently open */
  open: boolean;
  /** The original onOpenChange handler from the dialog */
  onOpenChange: (open: boolean) => void;
  /** Optional save callback — if provided, shows "Save & Leave" button */
  onSave?: () => Promise<void> | void;
  /** Optional context message, e.g. "You have unsaved changes to this discount." */
  message?: string;
}

/**
 * Wraps a dialog's onOpenChange to intercept close attempts when
 * the form has unsaved changes. Shows UnsavedChangesDialog instead.
 *
 * Usage:
 * ```tsx
 * const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
 *   isDirty,
 *   open,
 *   onOpenChange,
 *   onSave: handleSave,
 *   message: "You have unsaved changes to this discount.",
 * });
 *
 * return (
 *   <>
 *     <Dialog open={open} onOpenChange={guardedOnOpenChange}>...</Dialog>
 *     {unsavedChangesDialog}
 *   </>
 * );
 * ```
 */
export function useDialogCloseGuard({
  isDirty,
  open,
  onOpenChange,
  onSave,
  message = "You have unsaved changes. Would you like to save before leaving?"
}: UseDialogCloseGuardOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const guardedOnOpenChange = useCallback(
    (nextOpen: boolean) => {
      // Opening the dialog — always allow
      if (nextOpen) {
        onOpenChange(nextOpen);
        return;
      }

      // Closing the dialog — check for unsaved changes
      if (isDirty) {
        setShowWarning(true);
        return;
      }

      // Clean close — proceed normally
      onOpenChange(false);
    },
    [isDirty, onOpenChange]
  );

  const handleDiscard = useCallback(() => {
    setShowWarning(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSaveAndLeave = useCallback(async () => {
    if (!onSave) return;
    setIsSaving(true);
    setShowWarning(false);
    try {
      await onSave();
      onOpenChange(false);
    } catch {
      // Save failed — stay in the dialog, warning already closed
    } finally {
      setIsSaving(false);
    }
  }, [onSave, onOpenChange]);

  const unsavedChangesDialog = useMemo(
    () =>
      open ? (
        <UnsavedChangesDialog
          open={showWarning}
          onOpenChange={setShowWarning}
          message={message}
          onDiscard={handleDiscard}
          onSaveAndLeave={onSave ? handleSaveAndLeave : undefined}
          isSaving={isSaving}
        />
      ) : null,
    [open, showWarning, message, handleDiscard, handleSaveAndLeave, onSave, isSaving]
  );

  return { guardedOnOpenChange, unsavedChangesDialog };
}
