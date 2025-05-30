import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, MapPin } from "lucide-react";
import { format } from "date-fns";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: any) => void;
  currentFilters: any;
}

const categories = [
  "All Categories",
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

const skillLevels = ["All Levels", "Beginner", "Intermediate", "Advanced"];
const ageRestrictions = ["All Ages", "18+", "21+"];

export default function FilterModal({ isOpen, onClose, onApplyFilters, currentFilters }: FilterModalProps) {
  const [filters, setFilters] = useState({
    category: currentFilters.category || "All Categories",
    maxDistance: currentFilters.maxDistance || [25],
    priceRange: currentFilters.priceRange || [0, 100],
    dateFrom: currentFilters.dateFrom || null,
    dateTo: currentFilters.dateTo || null,
    skillLevel: currentFilters.skillLevel || "All Levels",
    ageRestriction: currentFilters.ageRestriction || "All Ages",
    tags: currentFilters.tags || [],
    location: currentFilters.location || "",
    sortBy: currentFilters.sortBy || "date",
    participantRange: currentFilters.participantRange || [1, 50],
    showPrivateEvents: currentFilters.showPrivateEvents !== false,
  });

  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    if (newTag.trim() && !filters.tags.includes(newTag.trim())) {
      setFilters(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFilters(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({
      category: "All Categories",
      maxDistance: [25],
      priceRange: [0, 100],
      dateFrom: null,
      dateTo: null,
      skillLevel: "All Levels",
      ageRestriction: "All Ages",
      tags: [],
      location: "",
      sortBy: "date",
      participantRange: [1, 50],
      showPrivateEvents: true,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Filter Activities</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select value={filters.category} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <Label>Location</Label>
            <div className="relative mt-1">
              <Input
                placeholder="Enter city or address"
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                className="pr-10"
              />
              <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Sort By */}
          <div>
            <Label>Sort By</Label>
            <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date (Newest First)</SelectItem>
                <SelectItem value="distance">Distance (Closest First)</SelectItem>
                <SelectItem value="participants">Most Participants</SelectItem>
                <SelectItem value="popularity">Most Popular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Distance */}
          <div>
            <Label>Max Distance: {filters.maxDistance[0]} miles</Label>
            <Slider
              value={filters.maxDistance}
              onValueChange={(value) => setFilters(prev => ({ ...prev, maxDistance: value }))}
              max={50}
              min={1}
              step={1}
              className="mt-2"
            />
          </div>

          {/* Participant Count Range */}
          <div>
            <Label>Number of People: {filters.participantRange[0]} - {filters.participantRange[1]} participants</Label>
            <Slider
              value={filters.participantRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, participantRange: value }))}
              max={50}
              min={1}
              step={1}
              className="mt-2"
            />
          </div>

          {/* Price Range */}
          <div>
            <Label>Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}</Label>
            <Slider
              value={filters.priceRange}
              onValueChange={(value) => setFilters(prev => ({ ...prev, priceRange: value }))}
              max={200}
              min={0}
              step={5}
              className="mt-2"
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, "MMM dd") : "Any date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, "MMM dd") : "Any date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                    disabled={(date) => date < new Date() || (filters.dateFrom && date < filters.dateFrom)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Skill Level */}
          <div>
            <Label>Skill Level</Label>
            <Select value={filters.skillLevel} onValueChange={(value) => setFilters(prev => ({ ...prev, skillLevel: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {skillLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Age Restriction */}
          <div>
            <Label>Age Requirement</Label>
            <Select value={filters.ageRestriction} onValueChange={(value) => setFilters(prev => ({ ...prev, ageRestriction: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ageRestrictions.map((age) => (
                  <SelectItem key={age} value={age}>
                    {age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="Add tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleAddTag} size="sm">Add</Button>
            </div>
            {filters.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {filters.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Reset
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}