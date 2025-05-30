import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { Activity } from "@shared/schema";

interface MatchSuccessModalProps {
  activity: Activity;
  onClose: () => void;
}

export function MatchSuccessModal({ activity, onClose }: MatchSuccessModalProps) {
  const handleStartChatting = () => {
    onClose();
    // Navigate to matches screen - this would be handled by parent component
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto bg-gradient-to-br from-green-400 to-emerald-500 border-none text-white">
        <div className="text-center py-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="w-32 h-32 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl"
          >
            <Heart className="text-green-500 text-5xl" fill="currentColor" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-3xl font-bold mb-2">It's a Match!</h2>
            <p className="text-xl mb-6 text-green-100">
              You've joined {activity.title}
            </p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button 
                onClick={handleStartChatting}
                className="bg-white text-green-600 hover:bg-gray-50 px-8 py-3 rounded-full font-semibold text-lg shadow-lg"
              >
                <MessageCircle className="h-5 w-5 mr-2" />
                Start Chatting
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
