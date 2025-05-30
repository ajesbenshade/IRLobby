import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Camera, Plus, X, MapPin, Briefcase, Globe, Star } from "lucide-react";

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
}

const experienceLevels = ["Beginner", "Intermediate", "Advanced", "Expert"];
const activityCategories = [
  "Sports & Fitness", "Food & Drinks", "Outdoor Adventures", 
  "Arts & Culture", "Nightlife", "Learning", "Technology", 
  "Music", "Social", "Gaming"
];

const personalityTraits = [
  "Outgoing", "Adventurous", "Creative", "Analytical", "Energetic",
  "Calm", "Organized", "Spontaneous", "Reliable", "Funny",
  "Patient", "Competitive", "Collaborative", "Independent"
];

const languages = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Chinese", "Japanese", "Korean", "Arabic", "Russian", "Hindi"
];

export default function ProfileEditModal({ isOpen, onClose, currentUser }: ProfileEditModalProps) {
  const [profile, setProfile] = useState({
    firstName: currentUser?.firstName || "",
    lastName: currentUser?.lastName || "",
    bio: currentUser?.bio || "",
    age: currentUser?.age || "",
    occupation: currentUser?.occupation || "",
    location: currentUser?.location || "",
    experienceLevel: currentUser?.experienceLevel || "Beginner",
    interests: currentUser?.interests || [],
    activityPreferences: currentUser?.activityPreferences || [],
    languages: currentUser?.languages || [],
    personalityTraits: currentUser?.personalityTraits || [],
    socialLinks: currentUser?.socialLinks || {},
    emergencyContact: currentUser?.emergencyContact || { name: "", phone: "", relationship: "" },
  });

  const [newInterest, setNewInterest] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      return await apiRequest("/api/profile", "PATCH", profileData);
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

  const handleSubmit = () => {
    updateProfileMutation.mutate(profile);
  };

  const addInterest = () => {
    if (newInterest && !profile.interests.includes(newInterest)) {
      setProfile(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest]
      }));
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setProfile(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  const toggleActivityPreference = (category: string) => {
    setProfile(prev => ({
      ...prev,
      activityPreferences: prev.activityPreferences.includes(category)
        ? prev.activityPreferences.filter(c => c !== category)
        : [...prev.activityPreferences, category]
    }));
  };

  const togglePersonalityTrait = (trait: string) => {
    setProfile(prev => ({
      ...prev,
      personalityTraits: prev.personalityTraits.includes(trait)
        ? prev.personalityTraits.filter(t => t !== trait)
        : [...prev.personalityTraits, trait]
    }));
  };

  const addLanguage = () => {
    if (newLanguage && !profile.languages.includes(newLanguage)) {
      setProfile(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage]
      }));
      setNewLanguage("");
    }
  };

  const removeLanguage = (language: string) => {
    setProfile(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== language)
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Your Profile</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="interests">Interests</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={profile.firstName}
                      onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Your first name"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={profile.lastName}
                      onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Your last name"
                    />
                  </div>
                </div>

                <div>
                  <Label>Bio</Label>
                  <Textarea
                    value={profile.bio}
                    onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell others about yourself..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Age</Label>
                    <Input
                      type="number"
                      value={profile.age}
                      onChange={(e) => setProfile(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="Your age"
                    />
                  </div>
                  <div>
                    <Label>Occupation</Label>
                    <Input
                      value={profile.occupation}
                      onChange={(e) => setProfile(prev => ({ ...prev, occupation: e.target.value }))}
                      placeholder="Your job/profession"
                    />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    value={profile.location}
                    onChange={(e) => setProfile(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, State"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Interests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newInterest}
                    onChange={(e) => setNewInterest(e.target.value)}
                    placeholder="Add an interest..."
                    onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                  />
                  <Button onClick={addInterest} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest: string) => (
                    <Badge key={interest} variant="secondary" className="flex items-center gap-1">
                      {interest}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeInterest(interest)}
                      />
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Activity Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {activityCategories.map((category) => (
                    <Badge
                      key={category}
                      variant={profile.activityPreferences.includes(category) ? "default" : "outline"}
                      className="cursor-pointer justify-center py-2"
                      onClick={() => toggleActivityPreference(category)}
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Personality Traits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {personalityTraits.map((trait) => (
                    <Badge
                      key={trait}
                      variant={profile.personalityTraits.includes(trait) ? "default" : "outline"}
                      className="cursor-pointer justify-center py-2"
                      onClick={() => togglePersonalityTrait(trait)}
                    >
                      {trait}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="experience" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Experience Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={profile.experienceLevel} onValueChange={(value) => setProfile(prev => ({ ...prev, experienceLevel: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Languages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={newLanguage} onValueChange={setNewLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.filter(lang => !profile.languages.includes(lang)).map((language) => (
                        <SelectItem key={language} value={language}>
                          {language}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addLanguage} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((language: string) => (
                    <Badge key={language} variant="secondary" className="flex items-center gap-1">
                      {language}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeLanguage(language)}
                      />
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={profile.emergencyContact.name}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                    }))}
                    placeholder="Contact name"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={profile.emergencyContact.phone}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                    }))}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label>Relationship</Label>
                  <Input
                    value={profile.emergencyContact.relationship}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                    }))}
                    placeholder="e.g., Mother, Friend, Partner"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Instagram</Label>
                  <Input
                    value={profile.socialLinks.instagram || ""}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, instagram: e.target.value }
                    }))}
                    placeholder="@username"
                  />
                </div>
                <div>
                  <Label>Twitter</Label>
                  <Input
                    value={profile.socialLinks.twitter || ""}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                    }))}
                    placeholder="@username"
                  />
                </div>
                <div>
                  <Label>LinkedIn</Label>
                  <Input
                    value={profile.socialLinks.linkedin || ""}
                    onChange={(e) => setProfile(prev => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, linkedin: e.target.value }
                    }))}
                    placeholder="linkedin.com/in/username"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateProfileMutation.isPending}
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}