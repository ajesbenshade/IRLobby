import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import type { Activity } from "@shared/client-types";

interface MatchSuccessModalProps {
  activity: Activity | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MatchSuccessModal({ 
  activity, 
  isOpen, 
  onClose 
}: MatchSuccessModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-gradient-to-br from-green-500 to-green-600 border-0 text-white">
        <div className="text-center py-8">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce">
            <Heart className="w-16 h-16 text-green-500" fill="currentColor" />
          </div>
          
          <h2 className="text-3xl font-bold mb-2">It's a Match!</h2>
          
          {activity && (
            <p className="text-xl mb-6 opacity-90">
              You've joined {activity.title}
            </p>
          )}
          
          <Button 
            onClick={onClose}
            className="bg-white text-green-600 px-8 py-3 rounded-full font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:bg-gray-50"
          >
            Start Chatting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
