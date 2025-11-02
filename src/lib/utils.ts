import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Task sorting utility
 * Sorts tasks so that:
 * - Pending tasks appear first (by priority and created_at)
 * - In-progress tasks appear next (by priority and created_at)
 * - Completed tasks appear at the bottom (by completed_at desc)
 */
export function sortTasksByStatus<T extends { status: string; priority?: string; created_at?: string; completed_at?: string }>(
  tasks: T[]
): T[] {
  const statusOrder = { pending: 1, in_progress: 2, completed: 3 };
  const priorityOrder = { urgent: 1, high: 2, medium: 3, low: 4 };

  return [...tasks].sort((a, b) => {
    // First sort by status (pending -> in_progress -> completed)
    const statusA = statusOrder[a.status as keyof typeof statusOrder] || 99;
    const statusB = statusOrder[b.status as keyof typeof statusOrder] || 99;
    
    if (statusA !== statusB) {
      return statusA - statusB;
    }

    // For completed tasks, sort by completed_at descending (most recent first)
    if (a.status === "completed" && b.status === "completed") {
      const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return dateB - dateA;
    }

    // For pending and in_progress, sort by priority first
    const priorityA = priorityOrder[(a.priority || "medium") as keyof typeof priorityOrder] || 99;
    const priorityB = priorityOrder[(b.priority || "medium") as keyof typeof priorityOrder] || 99;
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Then by created_at descending (newest first)
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });
}

/**
 * Check if a task was created or assigned today
 */
export function isTaskNewToday(createdAt: string | null, assignedAt?: string | null): boolean {
  if (!createdAt) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const createdDate = new Date(createdAt);
  createdDate.setHours(0, 0, 0, 0);
  
  // Check if created today
  if (createdDate.getTime() === today.getTime()) {
    return true;
  }
  
  // Also check if assigned today (if provided)
  if (assignedAt) {
    const assignedDate = new Date(assignedAt);
    assignedDate.setHours(0, 0, 0, 0);
    if (assignedDate.getTime() === today.getTime()) {
      return true;
    }
  }
  
  return false;
}