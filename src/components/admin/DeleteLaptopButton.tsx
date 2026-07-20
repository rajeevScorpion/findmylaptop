"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface DeleteLaptopButtonProps {
  laptopId: string;
  laptopName: string;
}

export function DeleteLaptopButton({ laptopId, laptopName }: DeleteLaptopButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/laptops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", laptopId }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(json.error ?? "Could not delete the laptop.");
        return;
      }
      window.location.reload();
    } catch {
      window.alert("Network error. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            disabled={loading}
          />
        }
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Trash2 className="w-3 h-3" />
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-background border-border/60">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete laptop?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{laptopName}&rdquo;. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
