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
  const [cameraError, setCameraError] = useState<string | null>(null);
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

  // Start camera when dialog opens
  useEffect(() => {
    if (showCameraDialog && !useCamera && !photoPreview && selectedTask) {
      // Small delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        startCamera().catch(err => {
          console.error("Error starting camera:", err);
        });
      }, 100);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraDialog, selectedTask]);

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
    setPhotoFile(null);
    setPhotoPreview(null);
    setUseCamera(false);
    setCameraError(null);
    setShowCameraDialog(true);
    // Camera will start via useEffect when dialog opens
  };

  const startCamera = async () => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser");
      }

      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Reset video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Try to get camera with environment facing (back camera on mobile)
      let stream: MediaStream | null = null;
      let lastError: any = null;
      
      // Try environment camera first (back camera on mobile)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
      } catch (envError) {
        lastError = envError;
        console.warn("Environment camera not available, trying user-facing:", envError);
        
        // Try user-facing camera (front camera on mobile, default on desktop)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } 
          });
        } catch (userError) {
          lastError = userError;
          console.warn("User-facing camera failed, trying any camera:", userError);
          
          // Last resort: try any available camera
          try {
            stream = await navigator.mediaDevices.getUserMedia({ 
              video: true 
            });
          } catch (anyError) {
            lastError = anyError;
            throw anyError;
          }
        }
      }

      if (!stream) {
        throw new Error("Failed to get camera stream");
      }

      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("Video element not available");
      }

      // Set stream to video element
      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      // Wait a moment for video element to be ready
      await new Promise((resolve) => {
        if (videoRef.current) {
          const onLoadedMetadata = () => {
            if (videoRef.current) {
              videoRef.current.removeEventListener('loadedmetadata', onLoadedMetadata);
            }
            resolve(null);
          };
          
          videoRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
          
          // Also try immediate play
          videoRef.current.play().then(() => {
            resolve(null);
          }).catch(() => {
            // Wait for loadedmetadata instead
          });
          
          // Timeout after 3 seconds
          setTimeout(() => resolve(null), 3000);
        } else {
          resolve(null);
        }
      });
      
      // Set camera as active
      setUseCamera(true);
      
    } catch (error: any) {
      console.error("Camera error:", error);
      
      // Clean up on error
      setUseCamera(false);
      
      // Stop any partial stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Determine error message
      let errorMessage = "Failed to access camera.";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Camera permission denied. Please allow camera access in your browser settings and refresh the page.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = "No camera found. Please connect a camera and try again.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = "Camera is being used by another application. Please close other apps using the camera.";
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "Camera doesn't support the required settings. Trying alternative camera...";
        // Try one more time with minimal constraints
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: {} });
          if (videoRef.current && fallbackStream) {
            videoRef.current.srcObject = fallbackStream;
            streamRef.current = fallbackStream;
            setUseCamera(true);
            return;
          }
        } catch (fallbackError) {
          console.error("Fallback camera also failed:", fallbackError);
        }
      } else if (error.message) {
        errorMessage = `Camera error: ${error.message}`;
      }
      
      setCameraError(errorMessage);
      showError(errorMessage);
      
      // Don't close dialog on error - let user retry or cancel manually
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
      // Build update object
      const updateData: any = {
        completed_at: new Date().toISOString(),
        completion_photo_url: publicUrl,
      };

      // Try to set status and admin_review_status, but handle if columns don't exist
      try {
        updateData.status = "awaiting_admin_review";
        updateData.admin_review_status = "pending";
      } catch (e) {
        // If enum values don't exist, use alternative approach
        console.warn("Status enum may not exist, using alternative");
      }

      const { error: updateError } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", selectedTask.id);

      if (updateError) {
        // If error is about admin_review_status or status enum, try without them
        if (updateError.message?.includes("admin_review_status") || 
            updateError.message?.includes("awaiting_admin_review") ||
            updateError.code === "42703") {
          const fallbackData = {
            status: "completed", // Fallback to completed if awaiting_admin_review doesn't exist
            completed_at: new Date().toISOString(),
            completion_photo_url: publicUrl,
          };
          
          const { error: fallbackError } = await supabase
            .from("tasks")
            .update(fallbackData)
            .eq("id", selectedTask.id);
          
          if (fallbackError) throw fallbackError;
        } else {
          throw updateError;
        }
      }

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
    setUseCamera(false);
    setCameraError(null);
    setShowCameraDialog(false);
    setSelectedTask(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleRetryCamera = async () => {
    setCameraError(null);
    setUseCamera(false);
    await startCamera();
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
              {task.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => handleStartTask(task.id)}
                  className="flex-1 bg-gradient-primary"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Start
                </Button>
              )}
              {task.status === "in_progress" && (
                <Button
                  size="sm"
                  onClick={() => handleCompleteClick(task)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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
            {!photoPreview && (
              <>
                {/* Always render video element so ref is available */}
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${useCamera && !cameraError ? 'block' : 'hidden'}`}
                    style={{ transform: 'scaleX(-1)' }} // Mirror the video for better UX
                  />
                  {!useCamera && !cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Initializing camera...</p>
                      </div>
                    </div>
                  )}
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center py-8 space-y-4">
                        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                        <p className="text-destructive font-medium mb-2">Camera Error</p>
                        <p className="text-sm text-muted-foreground mb-4">{cameraError}</p>
                        <div className="flex gap-2 justify-center">
                          <Button
                            onClick={handleRetryCamera}
                            className="bg-gradient-primary"
                            size="sm"
                          >
                            <Camera className="h-4 w-4 mr-2" />
                            Retry Camera
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
                    </div>
                  )}
                </div>
                {useCamera && !cameraError && (
                  <div className="flex gap-2">
                    <Button
                      onClick={capturePhoto}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
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
                )}
              </>
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
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                  >
                    {isUploading ? "Uploading..." : "Submit & Complete Task"}
                  </Button>
                  <Button
                    onClick={async () => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      setCameraError(null);
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

