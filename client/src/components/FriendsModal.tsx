import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Search, UserPlus, Check, X, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UserProfileModal from "./UserProfileModal";

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FriendsModal({ isOpen, onClose }: FriendsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current friends
  const { data: friends = [] } = useQuery({
    queryKey: ["/api/friends"],
    enabled: isOpen,
  });

  // Fetch friend requests
  const { data: friendRequests = [] } = useQuery({
    queryKey: ["/api/friends/requests"],
    enabled: isOpen,
  });

  // Search users
  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["/api/users/search", searchQuery],
    enabled: searchQuery.length >= 2,
  });

  // Send friend request mutation
  const sendFriendRequestMutation = useMutation({
    mutationFn: async (receiverId: string) => {
      return await apiRequest("/api/friends/request", {
        method: "POST",
        body: JSON.stringify({ receiverId }),
      });
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/search"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
    onError: () => {
      toast({ title: "Failed to send friend request", variant: "destructive" });
    },
  });

  // Accept friend request mutation
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

  // Reject friend request mutation
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

  const handleSendFriendRequest = (userId: string) => {
    sendFriendRequestMutation.mutate(userId);
  };

  const handleAcceptRequest = (friendshipId: number) => {
    acceptFriendRequestMutation.mutate(friendshipId);
  };

  const handleRejectRequest = (friendshipId: number) => {
    rejectFriendRequestMutation.mutate(friendshipId);
  };

  const handleViewProfile = (userId: string) => {
    console.log("Viewing profile for user:", userId);
    setSelectedUserId(userId);
    setShowUserProfile(true);
  };

  const handleCloseProfile = () => {
    setShowUserProfile(false);
    setSelectedUserId(null);
  };

  const handleSendFriendRequestFromProfile = () => {
    if (selectedUserId) {
      handleSendFriendRequest(selectedUserId);
      handleCloseProfile();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Friends & Connections
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends">
              Friends ({Array.isArray(friends) ? friends.length : 0})
            </TabsTrigger>
            <TabsTrigger value="requests">
              Requests ({Array.isArray(friendRequests) ? friendRequests.length : 0})
            </TabsTrigger>
            <TabsTrigger value="search">Add Friends</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-3 mt-4">
            <div className="text-sm text-muted-foreground mb-3">
              Friends can see your private events and send you direct messages.
            </div>
            {Array.isArray(friends) && friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map((friend: any) => (
                  <Card key={friend.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-3 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors flex-1"
                        onClick={() => handleViewProfile(friend.friendId)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={friend.profileImageUrl} />
                          <AvatarFallback>
                            {friend.firstName?.[0]}{friend.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium hover:text-primary">
                            {friend.firstName} {friend.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {friend.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewProfile(friend.friendId)}
                        >
                          View Profile
                        </Button>
                        <Badge variant="secondary">Friends</Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No friends yet</p>
                <p className="text-sm text-muted-foreground">
                  Use the "Add Friends" tab to find people to connect with
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-3 mt-4">
            {Array.isArray(friendRequests) && friendRequests.length > 0 ? (
              <div className="space-y-2">
                {friendRequests.map((request: any) => (
                  <Card key={request.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center space-x-3 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors flex-1"
                        onClick={() => handleViewProfile(request.requesterId)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={request.profileImageUrl} />
                          <AvatarFallback>
                            {request.firstName?.[0]}{request.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium hover:text-primary">
                            {request.firstName} {request.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {request.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleViewProfile(request.requesterId)}
                        >
                          View Profile
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={acceptFriendRequestMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={rejectFriendRequestMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No pending friend requests</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="search" className="space-y-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {searchQuery.length >= 2 && (
              <div className="space-y-2">
                {isSearching ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Searching...</p>
                  </div>
                ) : Array.isArray(searchResults) && searchResults.length > 0 ? (
                  searchResults.map((user: any) => (
                    <Card key={user.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center space-x-3 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors flex-1"
                          onClick={() => handleViewProfile(user.id)}
                        >
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.profileImageUrl} />
                            <AvatarFallback>
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium hover:text-primary">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user.email}
                            </p>
                            {user.rating && (
                              <div className="flex items-center gap-1">
                                <span className="text-sm">⭐ {user.rating.toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          {user.isFriend ? (
                            <Badge variant="secondary">Friends</Badge>
                          ) : user.hasPendingRequest ? (
                            <Badge variant="outline">
                              {user.isRequestSentByMe ? "Request Sent" : "Pending"}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleSendFriendRequest(user.id)}
                              disabled={sendFriendRequestMutation.isPending}
                            >
                              <UserPlus className="h-4 w-4 mr-1" />
                              Add Friend
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No users found</p>
                  </div>
                )}
              </div>
            )}

            {searchQuery.length < 2 && (
              <div className="space-y-4">
                <div className="text-center py-8 space-y-2">
                  <Search className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">Search for users to add as friends</p>
                  <p className="text-sm text-muted-foreground">
                    Type at least 2 characters to start searching
                  </p>
                </div>
                
                {/* Test users for profile viewing */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Or try viewing these sample profiles:</p>
                  <div className="grid gap-2">
                    {[
                      { id: 'user_friend_1', name: 'Sarah Johnson', email: 'sarah.adventures@email.com' },
                      { id: 'user_friend_2', name: 'Mike Chen', email: 'mike.techie@email.com' },
                      { id: 'user_friend_3', name: 'Emma Davis', email: 'emma.wellness@email.com' }
                    ].map((user) => (
                      <Card key={user.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center space-x-3 cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors flex-1"
                            onClick={() => handleViewProfile(user.id)}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewProfile(user.id)}
                          >
                            View Profile
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* User Profile Modal */}
      {selectedUserId && (
        <UserProfileModal
          isOpen={showUserProfile}
          onClose={handleCloseProfile}
          userId={selectedUserId}
          onSendFriendRequest={handleSendFriendRequestFromProfile}
          showActions={true}
        />
      )}
    </Dialog>
  );
}