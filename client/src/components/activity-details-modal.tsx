import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { Activity } from "@shared/schema";

interface ActivityDetailsModalProps {
  activity: Activity & { host?: any; participants?: any[] };
  onClose: () => void;
  onJoin: (activity: Activity) => void;
}

export function ActivityDetailsModal({ activity, onClose, onJoin }: ActivityDetailsModalProps) {
  const participantCount = activity.currentParticipants || 0;
  const maxParticipants = activity.maxParticipants;
  const price = parseFloat(activity.price || "0");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <div className="space-y-4">
          {/* Image */}
          <div className="aspect-video bg-gradient-to-br from-primary to-purple-600 rounded-xl overflow-hidden">
            {activity.imageUrl ? (
              <img 
                src={activity.imageUrl} 
                alt={activity.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-4xl font-bold">
                  {activity.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          <DialogHeader>
            <DialogTitle className="text-xl">{activity.title}</DialogTitle>
          </DialogHeader>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center text-gray-600">
              <MapPin className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{activity.location}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <Clock className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{format(new Date(activity.datetime), "EEEE, MMM d, h:mm a")}</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <Users className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{participantCount} of {maxParticipants} spots filled</span>
            </div>
            
            <div className="flex items-center text-gray-600">
              <DollarSign className="h-5 w-5 mr-3 flex-shrink-0" />
              <span>{price > 0 ? `$${price.toFixed(2)}` : "Free"}</span>
            </div>
          </div>

          {/* Category */}
          <div>
            <Badge className="bg-secondary text-white">
              {activity.category}
            </Badge>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">What to expect</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {activity.description}
            </p>
          </div>

          {/* Tags */}
          {activity.tags && activity.tags.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {activity.tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Host Info */}
          {activity.host && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold text-gray-800 mb-2">Host</h3>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full overflow-hidden mr-3">
                  {activity.host.profileImageUrl ? (
                    <img 
                      src={activity.host.profileImageUrl} 
                      alt="Host"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold">
                        {activity.host.firstName?.charAt(0) || 'H'}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {activity.host.firstName && activity.host.lastName 
                      ? `${activity.host.firstName} ${activity.host.lastName}`
                      : activity.host.email?.split('@')[0] || 'Host'
                    }
                  </p>
                  <p className="text-sm text-gray-500">
                    Rating: {parseFloat(activity.host.rating || "0").toFixed(1)} ⭐
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
            <Button 
              onClick={() => onJoin(activity)}
              className="flex-1 bg-accent hover:bg-accent/90"
            >
              Join Event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
