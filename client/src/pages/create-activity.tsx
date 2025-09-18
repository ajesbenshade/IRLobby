import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import ActivityTemplateModal from "@/components/ActivityTemplateModal";
import HostDashboard from "@/components/HostDashboard";
import { Camera, MapPin, Settings, Users, Locate } from "lucide-react";
import { z } from "zod";

const insertActivitySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  location: z.string().min(1, "Location is required"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  dateTime: z.date(),
  endDateTime: z.date().optional(),
  maxParticipants: z.number().min(1, "At least 1 participant required"),
  isPrivate: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  imageUrl: z.string().optional(),
  imageUrls: z.array(z.string()).default([]),
  price: z.number().default(0),
  currency: z.string().default("USD"),
  requiresApproval: z.boolean().default(false),
  ageRestriction: z.string().optional(),
  skillLevel: z.string().optional(),
  equipmentProvided: z.boolean().default(false),
  equipmentRequired: z.string().optional(),
  weatherDependent: z.boolean().default(false),
});

const formSchema = insertActivitySchema.extend({
  dateTime: z.string().min(1, "Date and time is required"),
});

type FormData = z.infer<typeof formSchema>;

interface CreateActivityProps {
  onActivityCreated: () => void;
}

const categories = [
  "Sports & Fitness",
  "Food & Drinks", 
  "Outdoor Adventures",
  "Arts & Culture",
  "Nightlife",
  "Learning",
  "Technology",
  "Music",
  "Social",
  "Gaming"
];

const participantOptions = Array.from({ length: 50 }, (_, i) => i + 1);

export default function CreateActivity({ onActivityCreated }: CreateActivityProps) {
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHostDashboard, setShowHostDashboard] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const totalFiles = selectedImages.length + newFiles.length;

    if (totalFiles > 5) {
      toast({
        title: "Too many photos",
        description: "You can only upload up to 5 photos per activity.",
        variant: "destructive",
      });
      return;
    }

    // Add new files to existing ones
    setSelectedImages(prev => [...prev, ...newFiles]);

    // Create previews for new files
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => {
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      location: "",
      dateTime: "",
      maxParticipants: 6,
      isPrivate: false,
      tags: [],
      price: 0,
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const activityData = {
        ...data,
        dateTime: new Date(data.dateTime).toISOString(),
        // For now, just store image data as base64 or file references
        // This can be enhanced later with proper file upload
        images: imagePreviews, // Store preview URLs for now
      };
      const response = await apiRequest('POST', '/api/activities', activityData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Activity created!",
        description: "Your activity has been posted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/activities/discover'] });
      onActivityCreated();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating activity",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createActivityMutation.mutate(data);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="bg-white shadow-sm p-4">
        <h2 className="text-xl font-bold text-gray-800">Create Activity</h2>
        <p className="text-sm text-gray-500">Share your passion with others</p>
      </header>

      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Photo Upload */}
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Selected Images Grid */}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Area */}
                  {imagePreviews.length < 5 && (
                    <div
                      className="w-full h-32 bg-gray-200 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={handlePhotoClick}
                    >
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          {imagePreviews.length === 0 ? "Tap to add photos" : "Add more photos"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {imagePreviews.length}/5 photos
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Activity Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Weekend Hiking Adventure" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time */}
            <FormField
              control={form.control}
              name="dateTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & Time</FormLabel>
                  <FormControl>
                    <Input 
                      type="datetime-local" 
                      {...field} 
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Enter location or address" 
                        {...field} 
                        className="pr-10"
                      />
                      <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Max Participants */}
            <FormField
              control={form.control}
              name="maxParticipants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Participants</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {participantOptions.map((count) => (
                        <SelectItem key={count} value={count.toString()}>
                          {count} people
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell people what to expect, what to bring, and why they should join!"
                      rows={4}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Event Privacy Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Privacy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="isPrivate"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Private Event</FormLabel>
                        <div className="text-sm text-gray-500">
                          Only approved participants can join
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiresApproval"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Requires Approval</FormLabel>
                        <div className="text-sm text-gray-500">
                          Review each application before accepting
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value || false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full bg-primary text-white py-4 text-lg"
              disabled={createActivityMutation.isPending}
            >
              {createActivityMutation.isPending ? "Creating..." : "Create Activity"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
