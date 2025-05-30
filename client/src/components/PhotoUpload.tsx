import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface PhotoUploadProps {
  currentProfilePhoto?: string;
  currentGallery?: string[];
  onProfilePhotoUpdate?: (url: string) => void;
  onGalleryUpdate?: (gallery: string[]) => void;
}

export default function PhotoUpload({ 
  currentProfilePhoto, 
  currentGallery = [], 
  onProfilePhotoUpdate,
  onGalleryUpdate 
}: PhotoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async ({ photoData, type }: { photoData: string; type: 'profile' | 'gallery' }) => {
      const response = await fetch('/api/upload/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoData, type })
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.type === 'profile') {
        onProfilePhotoUpdate?.(data.photoUrl);
      } else {
        const updatedGallery = [...currentGallery, data.photoUrl];
        onGalleryUpdate?.(updatedGallery);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Photo uploaded successfully",
        description: variables.type === 'profile' ? "Profile photo updated" : "Photo added to gallery"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload photo",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (index: number) => {
      const response = await fetch(`/api/upload/photo/${index}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: (_, index) => {
      const updatedGallery = currentGallery.filter((_, i) => i !== index);
      onGalleryUpdate?.(updatedGallery);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Photo deleted",
        description: "Photo removed from gallery"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete photo",
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = async (file: File, type: 'profile' | 'gallery') => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return;
    }

    // Check gallery limit
    if (type === 'gallery' && currentGallery.length >= 12) {
      toast({
        title: "Gallery full",
        description: "You can only have up to 12 photos in your gallery",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const photoData = reader.result as string;
        uploadMutation.mutate({ photoData, type });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process image",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const triggerFileInput = (type: 'profile' | 'gallery') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileUpload(file, type);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Profile Photo Section */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-4">Profile Photo</h3>
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={currentProfilePhoto} />
              <AvatarFallback>
                <Camera className="w-8 h-8 text-gray-400" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Button 
                onClick={() => triggerFileInput('profile')}
                disabled={uploading || uploadMutation.isPending}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {currentProfilePhoto ? 'Change Photo' : 'Upload Photo'}
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                JPG, PNG or GIF. Max 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Gallery Section */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Photo Gallery</h3>
            <Badge variant="secondary">
              {currentGallery.length}/12
            </Badge>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {/* Existing Photos */}
            {currentGallery.map((photo, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={photo} 
                    alt={`Gallery photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 p-0"
                  onClick={() => deleteMutation.mutate(index)}
                  disabled={deleteMutation.isPending}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}

            {/* Add Photo Button */}
            {currentGallery.length < 12 && (
              <button
                onClick={() => triggerFileInput('gallery')}
                disabled={uploading || uploadMutation.isPending}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center bg-gray-50 hover:bg-gray-100"
              >
                <div className="text-center">
                  <Plus className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <span className="text-xs text-gray-500">Add Photo</span>
                </div>
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Add up to 12 photos to showcase your personality and interests. These photos help other users get to know you better.
          </p>
        </CardContent>
      </Card>

      {(uploading || uploadMutation.isPending || deleteMutation.isPending) && (
        <div className="text-center py-4">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-gray-600">
              {uploading || uploadMutation.isPending ? 'Uploading...' : 'Deleting...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}