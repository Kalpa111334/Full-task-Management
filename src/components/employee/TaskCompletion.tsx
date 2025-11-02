import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/sweetalert";
import { Camera, X } from "lucide-react";
import { notifyTaskCompleted } from "@/lib/notificationService";
import { notifyDeptHeadTaskProofReceived } from "@/lib/whatsappService";

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
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      
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
          video: { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (envError) {
        lastError = envError;
        console.warn("Environment camera not available, trying user-facing:", envError);
        
        // Try user-facing camera (front camera on mobile, default on desktop)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: "user", 
              width: { ideal: 1280 }, 
              height: { ideal: 720 } 
            } 
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
        setCameraLoading(false);
        return;
      }

      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      
      // Wait for video to be ready
      const handleLoadedMetadata = () => {
        setUseCamera(true);
        setCameraLoading(false);
      };
      
      videoRef.current.onloadedmetadata = handleLoadedMetadata;
      
      // Also listen for canplay event as backup
      videoRef.current.oncanplay = handleLoadedMetadata;
      
      // Fallback: if events don't fire, check readyState after a delay
      setTimeout(() => {
        if (videoRef.current && videoRef.current.readyState >= 2 && cameraLoading) {
          setUseCamera(true);
          setCameraLoading(false);
        }
      }, 1000);
      
    } catch (error) {
      console.error("Camera error:", error);
      setCameraLoading(false);
      setUseCamera(false);
      showError("Failed to access camera. Please check permissions and try again.");
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
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const canvas = document.createElement("canvas");
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Flip the image back since we mirrored the video
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `task-${taskId}-${Date.now()}.jpg`, { type: "image/jpeg" });
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(blob));
            stopCamera();
          } else {
            showError("Failed to capture photo");
          }
        }, "image/jpeg", 0.9);
      }
    } else {
      showError("Camera is not ready. Please wait a moment and try again.");
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
      const { data: taskData, error: taskDataError } = await supabase
        .from("tasks")
        .select("title, assigned_by, department_id, assigned_to")
        .eq("id", taskId)
        .single();
      
      if (taskDataError) {
        console.error('Error fetching task data:', taskDataError);
        throw new Error(`Failed to fetch task details: ${taskDataError.message}`);
      }
      
      if (!taskData) {
        throw new Error('Task not found');
      }

      // Compress and resize image before upload to reduce payload size
      const compressImage = (file: File, maxWidth: number = 1280, quality: number = 0.8): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              let width = img.width;
              let height = img.height;
              
              // Resize if too large
              if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
              }
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                reject(new Error('Failed to create canvas context'));
                return;
              }
              
              ctx.drawImage(img, 0, 0, width, height);
              canvas.toBlob(
                (blob) => {
                  if (!blob) {
                    reject(new Error('Failed to compress image'));
                    return;
                  }
                  const reader2 = new FileReader();
                  reader2.onload = () => resolve(reader2.result as string);
                  reader2.onerror = () => reject(new Error('Failed to read compressed image'));
                  reader2.readAsDataURL(blob);
                },
                'image/jpeg',
                quality
              );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
          };
          reader.onerror = () => reject(new Error('Failed to read photo file'));
          reader.readAsDataURL(file);
        });
      };

      // Upload via Edge Function with retry logic
      const path = `${taskId}/${Date.now()}-${photoFile.name}`;
      const compressedDataUrl = await compressImage(photoFile);

      // Retry function with exponential backoff
      const invokeWithRetry = async (maxRetries: number = 3): Promise<any> => {
        let lastError: any = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            // Try using Supabase function invoke first
            const { data: uploadRes, error: funcError } = await supabase.functions.invoke('upload-task-photo', {
              body: { 
                taskId, 
                path, 
                fileType: 'image/jpeg', 
                dataUrl: compressedDataUrl 
              }
            });
            
            if (funcError) {
              throw funcError;
            }
            
            if (uploadRes && typeof uploadRes === 'object' && 'error' in uploadRes) {
              throw new Error(uploadRes.error as string);
            }
            
            return uploadRes;
          } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || String(error);
            
            // Don't retry on validation errors
            if (errorMsg.includes('Invalid payload') || errorMsg.includes('Missing')) {
              throw error;
            }
            
            // If not the last attempt, wait and retry
            if (attempt < maxRetries - 1) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 seconds
              console.warn(`Upload attempt ${attempt + 1} failed, retrying in ${delay}ms...`, errorMsg);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
        }
        
        throw lastError;
      };

      // Try alternative method using fetch API if Supabase invoke fails
      const uploadViaFetch = async (): Promise<any> => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !anonKey) {
          throw new Error('Supabase configuration missing');
        }
        
        const functionUrl = `${supabaseUrl}/functions/v1/upload-task-photo`;
        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey
          },
          body: JSON.stringify({
            taskId,
            path,
            fileType: 'image/jpeg',
            dataUrl: compressedDataUrl
          })
        });
        
        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = `HTTP ${response.status}`;
          }
          throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }
        
        return await response.json();
      };

      let uploadRes: any;
      try {
        // Try with retry logic first
        uploadRes = await invokeWithRetry(3);
      } catch (primaryError: any) {
        console.warn('Primary upload method failed, trying fetch API:', primaryError);
        try {
          // Fallback to fetch API
          uploadRes = await uploadViaFetch();
        } catch (fetchError: any) {
          console.error('Both upload methods failed:', { primaryError, fetchError });
          const errorMsg = fetchError?.message || primaryError?.message || 'Unknown error';
          
          if (errorMsg.includes('Failed to send') || errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('Failed to fetch')) {
            throw new Error('Unable to connect to server. Please check your internet connection and try again.');
          }
          
          throw new Error(`Upload failed: ${errorMsg}`);
        }
      }
      
      const publicUrl = uploadRes?.publicUrl as string;
      if (!publicUrl) {
        throw new Error('Upload succeeded but no photo URL was returned');
      }

      // Update task with photo and completion time
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completion_photo_url: publicUrl,
        })
        .eq("id", taskId);

      if (updateError) {
        console.error('Task update error:', updateError);
        throw new Error(`Failed to update task: ${updateError.message}`);
      }

      showSuccess("Task completed successfully! Waiting for approval.");
      
      // Send notification to department head and admin (non-blocking)
      try {
        if (taskData) {
          const { data: employeeData } = await supabase
            .from("employees")
            .select("name")
            .eq("id", taskData.assigned_to)
            .single();
          
          const employeeName = employeeData?.name || "Employee";
          const approverIds: string[] = [];
          let departmentHeadId: string | null = null;
          
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
            
            if (deptHead) {
              departmentHeadId = deptHead.id;
              if (!approverIds.includes(deptHead.id)) {
                approverIds.push(deptHead.id);
              }
            }
          }
          
          // Send push notifications
          if (approverIds.length > 0) {
            await notifyTaskCompleted(taskData.title, employeeName, approverIds).catch(err => {
              console.warn('Failed to send push notification:', err);
            });
          }

          // Send WhatsApp notification to department head about task proof received
          if (departmentHeadId) {
            await notifyDeptHeadTaskProofReceived(
              taskData.title,
              departmentHeadId,
              employeeName,
              taskId
            ).catch(err => {
              console.warn('Failed to send WhatsApp notification:', err);
            });
          } else if (taskData.assigned_by) {
            // Fallback: if no department head found, use assigned_by
            await notifyDeptHeadTaskProofReceived(
              taskData.title,
              taskData.assigned_by,
              employeeName,
              taskId
            ).catch(err => {
              console.warn('Failed to send WhatsApp notification:', err);
            });
          }
        }
      } catch (notifError) {
        // Log but don't fail task completion if notifications fail
        console.warn('Notification error (non-critical):', notifError);
      }
      
      onComplete();
      onClose();
    } catch (error) {
      console.error('Task completion error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to complete task. Please try again.';
      showError(errorMessage.length > 100 ? 'Failed to complete task. Please try again.' : errorMessage);
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
      setCameraLoading(false);
      
      // Start camera automatically when dialog opens
      const timer = setTimeout(() => {
        startCamera();
      }, 300); // Small delay to ensure dialog is fully rendered
      
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      // Cleanup: stop camera when dialog closes
      stopCamera();
      setCameraLoading(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base">Complete Task - Submit Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {cameraLoading && (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Opening camera...</p>
            </div>
          )}
          
          {/* Always render video element so ref is available, hide when not in use */}
          <div className={`space-y-2 sm:space-y-3 ${useCamera && !cameraLoading ? '' : 'hidden'}`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg bg-black max-h-64 sm:max-h-96"
              style={{ transform: 'scaleX(-1)' }} // Mirror the video for better UX
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={capturePhoto} className="flex-1 bg-success hover:bg-success/90" size="sm">
                <Camera className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                Capture Photo
              </Button>
              <Button onClick={stopCamera} variant="outline" size="sm">
                <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                Cancel
              </Button>
            </div>
          </div>

          {!useCamera && !cameraLoading && !photoPreview && (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Waiting for camera...</p>
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
