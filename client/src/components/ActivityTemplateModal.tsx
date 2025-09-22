import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { Search, Clock, Users, Star } from 'lucide-react';
import { useState } from 'react';

interface ActivityTemplate {
  id: number | string;
  name: string;
  category: string;
  title: string;
  description: string;
  defaultDuration?: number;
  defaultMaxParticipants?: number;
  useCount: number;
  tags?: string[];
}

interface ActivityTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ActivityTemplate | null) => void;
}

export default function ActivityTemplateModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: ActivityTemplateModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: templates = [], isLoading } = useQuery<ActivityTemplate[]>({
    queryKey: ['/api/activity-templates'],
    retry: 1,
    enabled: isOpen,
  });

  const filteredTemplates = templates.filter(
    (template: ActivityTemplate) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelectTemplate = (template: ActivityTemplate) => {
    onSelectTemplate(template);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Choose Activity Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Templates List */}
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No templates found</p>
                <p className="text-sm text-gray-400">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTemplates.map((template: ActivityTemplate) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm text-gray-800 truncate flex-1">
                          {template.title}
                        </h3>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {template.category}
                        </Badge>
                      </div>

                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {template.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {template.defaultDuration && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.floor(template.defaultDuration / 60)}h{' '}
                            {template.defaultDuration % 60}m
                          </div>
                        )}
                        {template.defaultMaxParticipants && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {template.defaultMaxParticipants} people
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Used {template.useCount} times
                        </div>
                      </div>

                      {template.tags && template.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {template.tags.slice(0, 3).map((tag: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.tags.length - 3} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => onSelectTemplate(null)}>
              Start from scratch
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
