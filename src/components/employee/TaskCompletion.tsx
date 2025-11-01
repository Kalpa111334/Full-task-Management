import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Camera, X } from "lucide-react";
import { notifyTaskCompleted } from "@/lib/notificationService";

interface TaskCompletionProps {
  taskId: string;
  onComplete: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const TaskCompletion = ({ taskId, onComplete, isOpen, onClose }: TaskCompletionProps) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
      showError("Failed to access camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUseCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `task-${taskId}-${Date.now()}.jpg`, { type: "image/jpeg" });
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(blob));
            stopCamera();
          }
        }, "image/jpeg", 0.8);
      }
    }
  };

  // No gallery uploads allowed — enforce real-time camera capture only

  const handleSubmit = async () => {
    if (!photoFile) {
      showError("Please capture or upload a photo");
      return;
    }

    setIsUploading(true);

    try {
      // Get task details for notification
      const { data: taskData } = await supabase
        .from("tasks")
        .select("title, assigned_by, department_id, assigned_to")
        .eq("id", taskId)
        .single();

      // Upload via backend function to bypass storage RLS
      const path = `${taskId}/${Date.now()}-${photoFile.name}`;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
      });

      const { data: uploadRes, error: funcError } = await supabase.functions.invoke('upload-task-photo', {
        body: { taskId, path, fileType: photoFile.type, dataUrl }
      });
      if (funcError) throw funcError;
      const publicUrl = uploadRes?.publicUrl as string;

      // Update task with photo and completion time
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completion_photo_url: publicUrl,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      showSuccess("Task completed successfully! Waiting for approval.");
      
      // Send notification to department head and admin
      if (taskData) {
        const { data: employeeData } = await supabase
          .from("employees")
          .select("name")
          .eq("id", taskData.assigned_to)
          .single();
        
        const employeeName = employeeData?.name || "Employee";
        const approverIds: string[] = [];
        
        // Add assigned_by (department head or admin)
        if (taskData.assigned_by) {
          approverIds.push(taskData.assigned_by);
        }
        
        // Add department head if different
        if (taskData.department_id) {
          const { data: deptHead } = await supabase
            .from("employees")
            .select("id")
            .eq("department_id", taskData.department_id)
            .eq("role", "department_head")
            .eq("is_active", true)
            .single();
          
          if (deptHead && !approverIds.includes(deptHead.id)) {
            approverIds.push(deptHead.id);
          }
        }
        
        if (approverIds.length > 0) {
          await notifyTaskCompleted(taskData.title, employeeName, approverIds);
        }
      }
      
      onComplete();
      onClose();
    } catch (error) {
      console.error(error);
      showError("Failed to complete task");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setPhotoFile(null);
    setPhotoPreview(null);
    onClose();
  };

  // Auto-start camera when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setPhotoFile(null);
      setPhotoPreview(null);
      setUseCamera(false);
      // Start camera automatically after a small delay to ensure state is reset
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Cleanup: stop camera when dialog closes
      stopCamera();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base">Complete Task - Submit Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {useCamera && (
            <div className="space-y-2 sm:space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full rounded-lg bg-black max-h-64 sm:max-h-96"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={capturePhoto} className="flex-1" size="sm">
                  <Camera className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  Capture Photo
                </Button>
                <Button onClick={stopCamera} variant="outline" size="sm">
                  <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {photoPreview && (
            <div className="space-y-2 sm:space-y-3">
              <img
                src={photoPreview}
                alt="Task completion"
                className="w-full rounded-lg max-h-64 sm:max-h-96 object-cover"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleSubmit}
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
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskCompletion;
