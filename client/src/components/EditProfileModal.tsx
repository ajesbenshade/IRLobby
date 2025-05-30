import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Camera, Upload, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  interests: z.array(z.string()).optional(),
  profileImageUrl: z.string().optional(),
  photoAlbum: z.array(z.string()).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function EditProfileModal({ isOpen, onClose, user }: EditProfileModalProps) {
  const [newInterest, setNewInterest] = useState("");
  const [photoAlbum, setPhotoAlbum] = useState<string[]>(user?.photoAlbum || []);
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      bio: user?.bio || "",
      interests: user?.interests || [],
      profileImageUrl: user?.profileImageUrl || "",
      photoAlbum: user?.photoAlbum || [],
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return await apiRequest("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          profileImageUrl,
          photoAlbum,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const interests = form.watch("interests") || [];

  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      form.setValue("interests", [...interests, newInterest.trim()]);
      setNewInterest("");
    }
  };

  const removeInterest = (interestToRemove: string) => {
    form.setValue("interests", interests.filter(interest => interest !== interestToRemove));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, isProfilePic = false) => {
    const file = event.target.files?.[0];
    if (file) {
      // Create a local URL for the image
      const imageUrl = URL.createObjectURL(file);
      
      if (isProfilePic) {
        setProfileImageUrl(imageUrl);
        form.setValue("profileImageUrl", imageUrl);
      } else {
        if (photoAlbum.length < 12) {
          const newAlbum = [...photoAlbum, imageUrl];
          setPhotoAlbum(newAlbum);
          form.setValue("photoAlbum", newAlbum);
        } else {
          toast({ title: "Maximum 12 photos allowed", variant: "destructive" });
        }
      }
    }
  };

  const removePhotoFromAlbum = (index: number) => {
    const newAlbum = photoAlbum.filter((_, i) => i !== index);
    setPhotoAlbum(newAlbum);
    form.setValue("photoAlbum", newAlbum);
  };

  const onSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate({
      ...data,
      profileImageUrl,
      photoAlbum,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="photos">Photos</TabsTrigger>
                <TabsTrigger value="interests">Interests</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                {/* Profile Picture Section */}
                <div className="flex items-center space-x-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profileImageUrl} />
                    <AvatarFallback>
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <label htmlFor="profile-picture" className="cursor-pointer">
                      <Button type="button" variant="outline" size="sm" className="w-full" asChild>
                        <span>
                          <Camera className="h-4 w-4 mr-2" />
                          Change Profile Picture
                        </span>
                      </Button>
                    </label>
                    <input
                      id="profile-picture"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, true)}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your first name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter your last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell people about yourself..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="photos" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Photo Album ({photoAlbum.length}/12)</FormLabel>
                    <label htmlFor="album-photo" className="cursor-pointer">
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        disabled={photoAlbum.length >= 12}
                        asChild
                      >
                        <span>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Photo
                        </span>
                      </Button>
                    </label>
                    <input
                      id="album-photo"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, false)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {photoAlbum.map((photo, index) => (
                      <Card key={index} className="relative group">
                        <CardContent className="p-0">
                          <img 
                            src={photo} 
                            alt={`Album photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhotoFromAlbum(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {/* Empty slots */}
                    {Array.from({ length: 12 - photoAlbum.length }).map((_, index) => (
                      <Card key={`empty-${index}`} className="border-2 border-dashed border-gray-300">
                        <CardContent className="p-0 h-24 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-gray-400" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="interests" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <FormLabel>Interests</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an interest"
                      value={newInterest}
                      onChange={(e) => setNewInterest(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                    />
                    <Button type="button" onClick={addInterest} variant="outline">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {interests.map((interest) => (
                      <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                        {interest}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeInterest(interest)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
                className="flex-1"
              >
                {updateProfileMutation.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}