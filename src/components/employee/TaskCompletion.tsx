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
      const timeoutId = setTimeout(() => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          setUseCamera(true);
          setCameraLoading(false);
        }
      }, 1000);
      
      // Store timeout for cleanup
      (videoRef.current as any)._cameraTimeout = timeoutId;
      
    } catch (error) {
      console.error("Camera error:", error);
      setCameraLoading(false);
      setUseCamera(false);
      showError("Failed to access camera. Please check permissions and try again.");
    }
  };

  const stopCamera = () => {
    // Clear any pending timeouts
    if (videoRef.current && (videoRef.current as any)._cameraTimeout) {
      clearTimeout((videoRef.current as any)._cameraTimeout);
      (videoRef.current as any)._cameraTimeout = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setUseCamera(false);
    setCameraLoading(false);
  };

  const capturePhoto = () => {
    try {
      // Validate video element exists and is ready
      if (!videoRef.current) {
        showError("Camera is not available. Please try again.");
        return;
      }

      const video = videoRef.current;

      // Check if video is loaded and ready
      if (video.readyState < 2) {
        showError("Camera is not ready. Please wait a moment and try again.");
        return;
      }

      // Validate video dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
        showError("Invalid video dimensions. Please try again.");
        return;
      }

      // Create canvas for capturing
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        showError("Failed to initialize canvas. Please try again.");
        return;
      }

      // Flip the image back since we mirrored the video for better UX
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Convert canvas to blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            showError("Failed to capture photo. Please try again.");
            return;
          }

          try {
            // Create file from blob
            const fileName = `task-${taskId}-${Date.now()}.jpg`;
            const file = new File([blob], fileName, { 
              type: "image/jpeg",
              lastModified: Date.now()
            });

            // Validate file was created
            if (!file || file.size === 0) {
              showError("Failed to create photo file. Please try again.");
              return;
            }

            // Create preview URL
            const previewUrl = URL.createObjectURL(blob);
            
            // Set photo file and preview
            setPhotoFile(file);
            setPhotoPreview(previewUrl);
            
            // Stop camera after successful capture
            stopCamera();
          } catch (fileError) {
            console.error("Error creating file:", fileError);
            showError("Failed to process captured photo. Please try again.");
          }
        },
        "image/jpeg",
        0.85 // Slightly lower quality for smaller file size
      );
    } catch (error) {
      console.error("Capture photo error:", error);
      showError("An error occurred while capturing the photo. Please try again.");
    }
  };

  // No gallery uploads allowed — enforce real-time camera capture only

  // Compress and resize image before upload to reduce payload size
  const compressImage = (file: File, maxWidth: number = 1280, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        if (!file || !(file instanceof File)) {
          reject(new Error('Invalid file provided'));
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result;
            if (!result || typeof result !== 'string') {
              reject(new Error('Failed to read file'));
              return;
            }

            const img = new Image();
            img.onload = () => {
              try {
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
                    reader2.onload = () => {
                      const result2 = reader2.result;
                      if (result2 && typeof result2 === 'string') {
                        resolve(result2);
                      } else {
                        reject(new Error('Failed to read compressed image'));
                      }
                    };
                    reader2.onerror = () => reject(new Error('Failed to read compressed image'));
                    reader2.readAsDataURL(blob);
                  },
                  'image/jpeg',
                  quality
                );
              } catch (canvasError) {
                reject(new Error(`Image processing failed: ${canvasError instanceof Error ? canvasError.message : 'Unknown error'}`));
              }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = result;
          } catch (loadError) {
            reject(new Error(`Failed to process file: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read photo file'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(new Error(`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  };

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

      // Validate photo file
      if (!(photoFile instanceof File)) {
        throw new Error('Invalid photo file');
      }

      // Upload via Edge Function with retry logic
      const path = `${taskId}/${Date.now()}-${photoFile.name}`;
      
      let compressedDataUrl: string;
      try {
        compressedDataUrl = await compressImage(photoFile);
        
        // Validate compressed data URL
        if (!compressedDataUrl || typeof compressedDataUrl !== 'string' || !compressedDataUrl.startsWith('data:')) {
          throw new Error('Image compression failed. Please try again.');
        }
      } catch (compressionError) {
        console.error('Image compression error:', compressionError);
        throw new Error(`Failed to process image: ${compressionError instanceof Error ? compressionError.message : 'Unknown error'}`);
      }

      // Upload using fetch API directly (more reliable than supabase.functions.invoke)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase configuration missing. Please check your environment variables.');
      }
      
      const functionUrl = `${supabaseUrl}/functions/v1/upload-task-photo`;
      
      // Retry function with exponential backoff
      const uploadWithRetry = async (maxRetries: number = 3): Promise<any> => {
        let lastError: any = null;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
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
              }),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              let errorText = '';
              try {
                const errorData = await response.json();
                errorText = errorData.error || errorData.message || `HTTP ${response.status}`;
              } catch (e) {
                try {
                  errorText = await response.text();
                } catch (e2) {
                  errorText = `HTTP ${response.status}`;
                }
              }
              throw new Error(`Upload failed: ${errorText}`);
            }
            
            const result = await response.json();
            
            // Check if response contains error
            if (result && typeof result === 'object' && 'error' in result) {
              throw new Error(result.error as string);
            }
            
            return result;
          } catch (error: any) {
            lastError = error;
            const errorMsg = error?.message || String(error);
            
            // Don't retry on validation errors or aborted requests
            if (errorMsg.includes('Invalid payload') || errorMsg.includes('Missing') || error.name === 'AbortError') {
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

      // Try direct storage upload first (faster, no Edge Function needed)
      const directUploadToStorage = async (file: File, uploadPath: string): Promise<string> => {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-photos')
          .upload(uploadPath, file, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600'
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('task-photos')
          .getPublicUrl(uploadPath);

        if (!urlData?.publicUrl) {
          throw new Error('Failed to get public URL after upload');
        }

        return urlData.publicUrl;
      };

      let publicUrl: string;
      
      // Try direct storage upload first (faster, no Edge Function dependency)
      // If that fails due to RLS, fallback to Edge Function
      const uploadPhoto = async (): Promise<string> => {
        // Create file from compressed data URL for direct upload
        const base64Data = compressedDataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        const uploadFile = new File([blob], photoFile.name || 'photo.jpg', { type: 'image/jpeg' });
        
        try {
          // Try direct storage upload first
          return await directUploadToStorage(uploadFile, path);
        } catch (directError: any) {
          const directErrorMsg = directError?.message || String(directError);
          console.warn('Direct storage upload failed, trying Edge Function:', directErrorMsg);
          
          // If it's a policy/permission error, try Edge Function
          if (directErrorMsg.includes('policy') || directErrorMsg.includes('permission') || 
              directErrorMsg.includes('unauthorized') || directErrorMsg.includes('Row Level Security')) {
            // Fallback to Edge Function
            try {
              const uploadRes = await uploadWithRetry(3);
              const edgeUrl = uploadRes?.publicUrl as string;
              
              if (!edgeUrl) {
                throw new Error('Upload succeeded but no photo URL was returned');
              }
              
              return edgeUrl;
            } catch (edgeError: any) {
              console.error('Edge Function upload also failed:', edgeError);
              throw edgeError;
            }
          }
          
          // For other direct upload errors, throw them
          throw directError;
        }
      };
      
      try {
        publicUrl = await uploadPhoto();
      } catch (finalError: any) {
        console.error('All upload methods failed:', finalError);
        const errorMsg = finalError?.message || 'Unknown error';
        
        // Check for network/connection errors
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('network') || 
            errorMsg.includes('NetworkError') || errorMsg.includes('Network request failed') ||
            finalError?.name === 'TypeError' || finalError?.name === 'AbortError') {
          throw new Error('Unable to connect to server. Please check your internet connection and try again.');
        }
        
        // Check for configuration errors
        if (errorMsg.includes('configuration') || errorMsg.includes('missing') || errorMsg.includes('not configured')) {
          throw new Error('Server configuration error. Please contact support.');
        }
        
        // Check for storage policy errors
        if (errorMsg.includes('policy') || errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
          throw new Error('Upload permission denied. Please contact support.');
        }
        
        throw new Error(`Upload failed: ${errorMsg.length > 100 ? 'Please try again' : errorMsg}`);
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
      
      let errorMessage = 'Failed to complete task. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      }
      
      // Truncate very long error messages for UI
      if (errorMessage.length > 150) {
        errorMessage = errorMessage.substring(0, 147) + '...';
      }
      
      // Show error to user
      showError(errorMessage);
      
      // Don't close dialog on error so user can retry
      // Only reset uploading state
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
