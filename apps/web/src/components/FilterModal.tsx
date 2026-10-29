import { DiscoverSheet } from '@/components/DiscoverSheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  AGES_OPTIONS,
  ALL_AGES,
  ALL_GATHERING_TYPES,
  AUDIENCE_OPTIONS,
  EVERYONE_AUDIENCE,
  GATHERING_TYPE_OPTIONS,
} from '@/lib/activityFilters';
import type { ActivityFilters } from '@/types/activity';
import { format } from 'date-fns';
import { CalendarIcon, MapPin } from 'lucide-react';
import { useState } from 'react';

type FilterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: ActivityFilters) => void;
  currentFilters: Partial<ActivityFilters>;
};

const DEFAULT_FILTERS: ActivityFilters = {
  location: '',
  maxDistance: [25],
  dateFrom: null,
  dateTo: null,
  gatheringType: ALL_GATHERING_TYPES,
  audience: EVERYONE_AUDIENCE,
  ages: ALL_AGES,
};

function filtersFrom(current: Partial<ActivityFilters>): ActivityFilters {
  return {
    location: current.location ?? '',
    maxDistance: current.maxDistance?.length ? current.maxDistance : [25],
    dateFrom: current.dateFrom ?? null,
    dateTo: current.dateTo ?? null,
    gatheringType: current.gatheringType || ALL_GATHERING_TYPES,
    audience: current.audience || EVERYONE_AUDIENCE,
    ages: current.ages || ALL_AGES,
  };
}

function ChoiceField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[60]">
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterModal({ isOpen, onClose, onApplyFilters, currentFilters }: FilterModalProps) {
  const [filters, setFilters] = useState<ActivityFilters>(() => filtersFrom(currentFilters));

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const miles = filters.maxDistance[0] ?? 25;

  return (
    <DiscoverSheet
      open={isOpen}
      onClose={onClose}
      testId="discover-filter-sheet"
      title="Filter gatherings"
      description="Narrow Discover to gatherings that fit you."
    >
      <div className="space-y-6">
        <ChoiceField
          id="discover-filter-type"
          label="Type"
          value={filters.gatheringType}
          options={GATHERING_TYPE_OPTIONS}
          onChange={(value) => setFilters((prev) => ({ ...prev, gatheringType: value }))}
        />

        <div>
          <Label htmlFor="discover-filter-location">Location</Label>
          <div className="relative mt-1">
            <Input
              id="discover-filter-location"
              placeholder="City or church / place"
              value={filters.location}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, location: event.currentTarget.value }))
              }
              className="pr-10"
            />
            <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        <div>
          <Label id="discover-filter-distance">Within: {miles} miles</Label>
          <Slider
            aria-labelledby="discover-filter-distance"
            value={filters.maxDistance}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, maxDistance: value }))}
            max={50}
            min={1}
            step={1}
            className="mt-2"
          />
        </div>

        <div>
          <p className="text-sm font-medium leading-none">When</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label>From date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="mt-1 w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, 'MMM dd') : 'Any date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[60] w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom ?? undefined}
                    onSelect={(date) => setFilters((prev) => ({ ...prev, dateFrom: date ?? null }))}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>To date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="mt-1 w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, 'MMM dd') : 'Any date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="z-[60] w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo ?? undefined}
                    onSelect={(date) => setFilters((prev) => ({ ...prev, dateTo: date ?? null }))}
                    disabled={(date) =>
                      date < new Date() || (filters.dateFrom ? date < filters.dateFrom : false)
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <ChoiceField
          id="discover-filter-audience"
          label="Audience"
          value={filters.audience}
          options={AUDIENCE_OPTIONS}
          onChange={(value) => setFilters((prev) => ({ ...prev, audience: value }))}
        />

        <ChoiceField
          id="discover-filter-ages"
          label="Ages"
          value={filters.ages}
          options={AGES_OPTIONS}
          onChange={(value) => setFilters((prev) => ({ ...prev, ages: value }))}
        />

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply
          </Button>
        </div>
      </div>
    </DiscoverSheet>
  );
}

export default FilterModal;
