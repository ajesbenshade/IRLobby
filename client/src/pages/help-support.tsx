import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, Phone, MessageSquare, HelpCircle, FileText } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function HelpSupport({ onBack }: { onBack?: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // In a real app, this would send the form data to your backend
      // For now, we'll just simulate a submission with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message
      toast({
        title: "Message sent",
        description: "We've received your message and will respond soon.",
      });
      
      // Reset form
      setName("");
      setEmail("");
      setMessage("");
    } catch (error) {
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-4">
      {/* Header */}
      <header className="bg-white shadow-sm p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Help & Support</h1>
          <p className="text-sm text-gray-500">Get assistance with your IRlobby experience</p>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        {/* Contact Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>Reach out to us through these channels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-full">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Email</p>
                <a href="mailto:ajesbenshade@gmail.com" className="text-primary hover:underline">
                  ajesbenshade@gmail.com
                </a>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-full">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Phone</p>
                <a href="tel:2345752085" className="text-primary hover:underline">
                  234-575-2085
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Quick answers to common questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-b pb-3">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                How do I create an activity?
              </h3>
              <p className="text-sm text-gray-600">
                To create an activity, go to the "Create" tab in the bottom navigation. Fill out the activity details including title, description, date, time, location, and capacity. Once complete, click "Create Activity" to publish it.
              </p>
            </div>
            
            <div className="border-b pb-3">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                How do I join an activity?
              </h3>
              <p className="text-sm text-gray-600">
                Browse activities in the "Discover" tab. When you find an activity you'd like to join, swipe right or tap the green heart button. If it's an open activity, you'll be joined immediately. For private activities, the host will need to approve your request.
              </p>
            </div>
            
            <div className="border-b pb-3">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                How do I message other participants?
              </h3>
              <p className="text-sm text-gray-600">
                Once you've joined an activity, you can access the group chat from the "Matches" tab. Select the activity and tap on the chat icon to open the conversation with all participants.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact Form */}
        <Card>
          <CardHeader>
            <CardTitle>Send Us a Message</CardTitle>
            <CardDescription>We'll get back to you as soon as possible</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-1">
                  Message
                </label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="How can we help you?"
                  rows={5}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
            <CardDescription>Helpful information about using IRlobby</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" />
              User Guide
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" />
              Privacy Policy
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2">
              <FileText className="h-4 w-4" />
              Terms of Service
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
