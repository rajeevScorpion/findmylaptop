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
import { createClient } from "@/lib/supabase/client";

interface DeleteLaptopButtonProps {
  laptopId: string;
  laptopName: string;
}

export function DeleteLaptopButton({ laptopId, laptopName }: DeleteLaptopButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.from("laptops").delete().eq("id", laptopId);
    window.location.reload();
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
