"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function ModalDialog({
  open,
  onClose,
  title,
  description,
  maxWidthClass = "max-w-2xl",
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };

    dialog.addEventListener("close", handleClose);

    // Light-dismiss fallback for browsers without <dialog closedby="any">
    let cleanupFallback = () => {};
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) dialog.close();
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupFallback = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupFallback();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby={titleId}
      className={`bg-card text-foreground border-border/70 w-[calc(100%-2rem)] ${maxWidthClass} rounded-3xl border p-0 shadow-2xl open:flex open:flex-col`}
    >
      <div className="border-border/60 flex items-start justify-between gap-4 border-b px-6 py-4">
        <div>
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close dialog"
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}
