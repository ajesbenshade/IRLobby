import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserPlus, Check, X, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
  const [searchEmail, setSearchEmail] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: friends = [] } = useQuery({
    queryKey: ["/api/friends"],
    enabled: isOpen,
  });

  const { data: friendRequests = [] } = useQuery({
    queryKey: ["/api/friends/requests"],
    enabled: isOpen,
  });

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      return await apiRequest("/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ receiverId }),
      });
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      setSearchEmail("");
    },
    onError: () => {
      toast({ title: "Failed to send friend request", variant: "destructive" });
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      return await apiRequest(`/api/friends/accept/${friendshipId}`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
    onError: () => {
      toast({ title: "Failed to accept friend request", variant: "destructive" });
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      return await apiRequest(`/api/friends/reject/${friendshipId}`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "Friend request rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
    onError: () => {
      toast({ title: "Failed to reject friend request", variant: "destructive" });
    },
  });

  const handleSendFriendRequest = () => {
    if (searchEmail.trim()) {
      sendFriendRequestMutation.mutate(searchEmail.trim());
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Friends
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              Requests ({friendRequests.length})
            </TabsTrigger>
            <TabsTrigger value="add">Add Friend</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            {friends.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No friends yet. Add some friends to see private events!
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {friends.map((friend: any) => (
                  <Card key={friend.id}>
                    <CardContent className="flex items-center gap-3 pt-6">
                      <Avatar>
                        <AvatarImage src={friend.profileImageUrl} />
                        <AvatarFallback>
                          {friend.firstName?.[0]}{friend.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">
                          {friend.firstName} {friend.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {friend.email}
                        </p>
                      </div>
                      <Badge variant="secondary">Friends</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {friendRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No pending friend requests
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {friendRequests.map((request: any) => (
                  <Card key={request.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Avatar>
                          <AvatarImage src={request.profileImageUrl} />
                          <AvatarFallback>
                            {request.firstName?.[0]}{request.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">
                            {request.firstName} {request.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => acceptFriendRequestMutation.mutate(request.id)}
                          disabled={acceptFriendRequestMutation.isPending}
                          className="flex-1"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => rejectFriendRequestMutation.mutate(request.id)}
                          disabled={rejectFriendRequestMutation.isPending}
                          className="flex-1"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Friend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter user ID or email"
                      value={searchEmail}
                      onChange={(e) => setSearchEmail(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    onClick={handleSendFriendRequest}
                    disabled={!searchEmail.trim() || sendFriendRequestMutation.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Request
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter their user ID or email address to send a friend request. 
                  Once they accept, you'll be able to see each other's private events.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}