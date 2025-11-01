import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Play, CheckCircle, Camera, X, MapPin, Clock, User, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  location_address: string | null;
  is_required: boolean;
  started_at: string | null;
  assigned_by: string;
  admin: {
    name: string;
  };
}

interface DepartmentHeadAdminTasksProps {
  departmentHeadId: string;
}

const DepartmentHeadAdminTasks = ({ departmentHeadId }: DepartmentHeadAdminTasksProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchTasks();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("dept-head-admin-tasks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentHeadId]);

  const fetchTasks = async () => {
    // First get all admin IDs
    const { data: admins } = await supabase
      .from("employees")
      .select("id")
      .eq("role", "admin");

    if (!admins || admins.length === 0) {
      setTasks([]);
      return;
    }

    const adminIds = admins.map(a => a.id);

    // Fetch tasks assigned to this department head by admins
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        admin:employees!tasks_assigned_by_fkey (name)
      `)
      .eq("assigned_to", departmentHeadId)
      .in("assigned_by", adminIds)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Failed to fetch tasks");
      return;
    }

    setTasks(data || []);
  };

  const handleStartTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      showError("Failed to start task");
      return;
    }

    showSuccess("Task started successfully");
    fetchTasks();
  };

  const handleCompleteClick = (task: Task) => {
    setSelectedTask(task);
    setShowCameraDialog(true);
    startCamera();
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setUseCamera(true);
    } catch (error) {
      showError("Failed to access camera. Please allow camera permissions.");
      setShowCameraDialog(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseCamera(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob && selectedTask) {
            const file = new File([blob], `task-${selectedTask.id}-${Date.now()}.jpg`, { type: "image/jpeg" });
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(blob));
            stopCamera();
          }
        }, "image/jpeg", 0.8);
      }
    }
  };

  const handleSubmitPhoto = async () => {
    if (!photoFile || !selectedTask) {
      showError("Please capture a photo");
      return;
    }

    setIsUploading(true);

    try {
      // Upload photo via backend function
      const path = `${selectedTask.id}/${Date.now()}-${photoFile.name}`;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });

      const { data: uploadRes, error: funcError } = await supabase.functions.invoke('upload-task-photo', {
        body: { taskId: selectedTask.id, path, fileType: photoFile.type, dataUrl }
      });

      if (funcError) throw funcError;
      const publicUrl = uploadRes?.publicUrl as string;

      // Update task with photo and set status to awaiting_admin_review
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          status: "awaiting_admin_review",
          admin_review_status: "pending",
          completed_at: new Date().toISOString(),
          completion_photo_url: publicUrl,
        })
        .eq("id", selectedTask.id);

      if (updateError) throw updateError;

      showSuccess("Task completed and submitted for admin review");
      
      // Reset state
      setShowCameraDialog(false);
      setSelectedTask(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      
      fetchTasks();
    } catch (error: any) {
      showError(error.message || "Failed to submit task");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseCamera = () => {
    stopCamera();
    setShowCameraDialog(false);
    setSelectedTask(null);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-muted text-muted-foreground",
      medium: "bg-primary text-primary-foreground",
      high: "bg-warning text-warning-foreground",
      urgent: "bg-destructive text-destructive-foreground",
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-warning text-warning-foreground",
      in_progress: "bg-primary text-primary-foreground",
      completed: "bg-success text-success-foreground",
      awaiting_admin_review: "bg-blue-500 text-white",
    };
    return colors[status] || colors.pending;
  };

  // Show all tasks assigned by admin (required tasks or any task awaiting review)
  const displayTasks = tasks;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg sm:text-2xl font-bold">Admin-Assigned Tasks</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Tasks assigned by administrators that require completion
        </p>
      </div>

      {/* Tasks Grid */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {displayTasks.map((task) => (
          <Card key={task.id} className="p-3 sm:p-4 hover:shadow-lg transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm sm:text-base mb-1">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <Badge className={getPriorityColor(task.priority)}>
                {task.priority}
              </Badge>
              <Badge className={getStatusColor(task.status)}>
                {task.status.replace("_", " ")}
              </Badge>
              {task.is_required && (
                <Badge variant="default" className="bg-orange-500">
                  Required
                </Badge>
              )}
            </div>

            <div className="space-y-2 text-sm mb-3">
              {task.admin?.name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Assigned by: {task.admin.name}</span>
                </div>
              )}
              {task.location_address && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate">{task.location_address}</span>
                </div>
              )}
              {task.deadline && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(new Date(task.deadline), "PPP")}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {task.is_required && task.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => handleStartTask(task.id)}
                  className="flex-1 bg-gradient-primary"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              )}
              {task.is_required && task.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => handleCompleteClick(task)}
                  className="flex-1 bg-gradient-primary"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              )}
              {task.status === "awaiting_admin_review" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled
                >
                  <Clock className="h-3 w-3 mr-1" />
                  Awaiting Review
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {displayTasks.length === 0 && (
        <Card className="p-12 col-span-full text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No admin-assigned tasks yet.</p>
        </Card>
      )}

      {/* Camera Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={handleCloseCamera}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Capture Task Completion Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!photoPreview && useCamera && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-auto max-h-96"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={capturePhoto}
                    className="flex-1 bg-gradient-primary"
                    size="sm"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Capture Photo
                  </Button>
                  <Button
                    onClick={handleCloseCamera}
                    variant="outline"
                    size="sm"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {photoPreview && (
              <div className="space-y-3">
                <img
                  src={photoPreview}
                  alt="Task completion"
                  className="w-full rounded-lg max-h-96 object-cover"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleSubmitPhoto}
                    disabled={isUploading}
                    className="flex-1 bg-gradient-primary"
                    size="sm"
                  >
                    {isUploading ? "Uploading..." : "Submit & Complete Task"}
                  </Button>
                  <Button
                    onClick={async () => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      await startCamera();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={handleCloseCamera}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepartmentHeadAdminTasks;

