"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import {
  apiGetReviews,
  apiCreateReview,
  apiDeleteReview,
  apiGetReservations,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  Plus,
  Trash2,
  MessageSquare,
  StarHalf,
} from "lucide-react";

interface Review {
  id: string;
  guestId: string;
  reservationId: string;
  rating: number;
  comment: string;
  createdAt: string;
  guest: { id: string; name: string };
  reservation: { id: string; checkIn: string; checkOut: string };
}

interface Reservation {
  id: string;
  guestId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guest: { id: string; name: string; phone: string };
  room: { id: string; number: string; name: string; type: string };
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${sizeClass} ${
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function ClickableStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const starVal = i + 1;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(starVal)}
            onMouseEnter={(e) => (e.currentTarget.previousElementSibling as HTMLElement)?.blur()}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`h-7 w-7 ${
                starVal <= value
                  ? "fill-amber-400 text-amber-400"
                  : "fill-none text-muted-foreground/30"
              } transition-colors`}
            />
          </button>
        );
      })}
      <span className="ml-2 text-sm font-medium text-muted-foreground">
        {value > 0 ? `${value}/5` : "Select rating"}
      </span>
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function ReviewsPage() {
  const { currentUser, refreshKey, triggerRefresh } = useAppStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [selectedResId, setSelectedResId] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = currentUser && ["SUPERUSER", "OPERATOR"].includes(currentUser.role);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [reviewsData, reservationsData] = await Promise.all([
        apiGetReviews(),
        apiGetReservations("status=COMPLETED"),
      ]);
      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
      setReservations(Array.isArray(reservationsData) ? reservationsData : []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load reviews";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // Build room map from reservations
  const roomMap = new Map<string, string>();
  reservations.forEach((r) => roomMap.set(r.id, r.room?.name || r.room?.number || r.id));

  // Filter out reservations that already have reviews
  const reviewedResIds = new Set(reviews.map((r) => r.reservationId));
  const availableReservations = reservations.filter((r) => !reviewedResIds.has(r.id));

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  const openAdd = () => {
    setSelectedResId("");
    setRating(0);
    setComment("");
    setAddOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedResId || rating === 0) {
      toast.error("Please select a reservation and rating");
      return;
    }
    const res = reservations.find((r) => r.id === selectedResId);
    if (!res) return;

    try {
      setSaving(true);
      await apiCreateReview({
        guestId: res.guestId,
        reservationId: selectedResId,
        rating,
        comment: comment.trim(),
      });
      toast.success("Review added successfully");
      setAddOpen(false);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create review";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiDeleteReview(deleteTarget.id);
      toast.success("Review deleted");
      setDeleteTarget(null);
      triggerRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete review";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Average Rating + Add Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50">
            <StarHalf className="h-7 w-7 fill-amber-400 text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Average Rating</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{avgRating}</span>
              <StarDisplay rating={Math.round(Number(avgRating))} size="md" />
              <span className="text-sm text-muted-foreground">({reviews.length} reviews)</span>
            </div>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Review
        </Button>
      </div>

      {/* Reviews Table */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            Guest Reviews
          </h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/40" />
              <p className="text-muted-foreground">No reviews yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead className="hidden md:table-cell">Comment</TableHead>
                  <TableHead>Date</TableHead>
                  {canDelete && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.guest?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium">
                        {roomMap.get(review.reservationId) || `${formatDateShort(review.reservation.checkIn)}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StarDisplay rating={review.rating} />
                    </TableCell>
                    <TableCell className="hidden max-w-[300px] truncate md:table-cell">
                      {review.comment || <span className="text-muted-foreground italic">No comment</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(review.createdAt)}
                    </TableCell>
                    {canDelete && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setDeleteTarget(review)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Add Review Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Review</DialogTitle>
            <DialogDescription>Select a completed reservation and leave a rating.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reservation</Label>
              <Select value={selectedResId} onValueChange={setSelectedResId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a completed reservation" />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {availableReservations.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No completed reservations without reviews
                    </SelectItem>
                  ) : (
                    availableReservations.map((res) => (
                      <SelectItem key={res.id} value={res.id}>
                        {res.guest?.name} — Room {res.room?.number || res.room?.name} ({formatDateShort(res.checkIn)})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rating</Label>
              <ClickableStars value={rating} onChange={setRating} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-comment">Comment</Label>
              <Textarea
                id="review-comment"
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !selectedResId || rating === 0}>
              {saving ? "Saving..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review by{" "}
              <strong>{deleteTarget?.guest?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}