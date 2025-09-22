import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckCircle, XCircle, Clock, User, Calendar, MapPin } from 'lucide-react';
import { useState } from 'react';

interface Application {
  id: number;
  user: {
    profileImageUrl?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  appliedAt: string;
  activity: {
    title: string;
    dateTime: string;
    location: string;
  };
  message?: string;
}

interface HostDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HostDashboard({ isOpen, onClose }: HostDashboardProps) {
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [hostMessage, setHostMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading } = useQuery<Application[]>({
    queryKey: ['/api/host/applications'],
    retry: 1,
    enabled: isOpen,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      applicationId,
      status,
      hostMessage,
    }: {
      applicationId: number;
      status: 'approved' | 'rejected';
      hostMessage?: string;
    }) => {
      const response = await apiRequest('PATCH', `/api/applications/${applicationId}`, {
        status,
        hostMessage,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/host/applications'] });
      setSelectedApplication(null);
      setHostMessage('');
    },
  });

  const handleReview = (application: Application, status: 'approved' | 'rejected') => {
    if (status === 'approved') {
      setSelectedApplication(application);
    } else {
      reviewMutation.mutate({
        applicationId: application.id,
        status,
        hostMessage: hostMessage || undefined,
      });
    }
  };

  const handleApprove = () => {
    if (selectedApplication) {
      reviewMutation.mutate({
        applicationId: selectedApplication.id,
        status: 'approved',
        hostMessage: hostMessage || undefined,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Host Dashboard - Pending Applications
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No pending applications</p>
            <p className="text-sm text-gray-400">
              Applications for your private events will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application: Application) => (
              <Card key={application.id} className="border-l-4 border-l-blue-500">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={application.user?.profileImageUrl} />
                        <AvatarFallback>
                          {application.user?.firstName?.[0]}
                          {application.user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {application.user?.firstName} {application.user?.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{application.user?.email}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {formatDistanceToNow(new Date(application.appliedAt), { addSuffix: true })}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Activity Info */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-medium text-sm text-gray-700 mb-2">Event Details</h4>
                    <div className="space-y-1">
                      <p className="font-semibold">{application.activity?.title}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(
                            new Date(application.activity?.dateTime),
                            "MMM dd, yyyy 'at' h:mm a",
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {application.activity?.location}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Message */}
                  {application.message && (
                    <div>
                      <h4 className="font-medium text-sm text-gray-700 mb-2">Applicant Message</h4>
                      <p className="text-sm bg-blue-50 p-3 rounded-lg border-l-4 border-l-blue-200">
                        &ldquo;{application.message}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={() => handleReview(application, 'rejected')}
                      disabled={reviewMutation.isPending}
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleReview(application, 'approved')}
                      disabled={reviewMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Approval Confirmation Modal */}
        {selectedApplication && (
          <Dialog open={!!selectedApplication} onOpenChange={() => setSelectedApplication(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Approve Application</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  You&apos;re about to approve{' '}
                  <strong>
                    {selectedApplication.user?.firstName} {selectedApplication.user?.lastName}
                  </strong>
                  for your event <strong>{selectedApplication.activity?.title}</strong>.
                </p>

                <div>
                  <label
                    htmlFor="host-message"
                    className="text-sm font-medium text-gray-700 mb-2 block"
                  >
                    Welcome message (optional)
                  </label>
                  <Textarea
                    id="host-message"
                    placeholder="Welcome! Looking forward to having you at the event..."
                    value={hostMessage}
                    onChange={(e) => setHostMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedApplication(null)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={reviewMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Confirm Approval
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
