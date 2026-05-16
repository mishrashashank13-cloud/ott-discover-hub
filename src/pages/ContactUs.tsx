/**
 * ContactUs Page Component
 * Displays contact information and a submission form
 * Form data is saved to database and emailed to support
 */

import React, { useState } from "react";
import { Mail, Phone, MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { SEO } from "@/components/SEO";

// Validation schema for contact form
const contactSchema = z.object({
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255),
  phoneNumber: z.string().trim().max(20).optional(),
  comments: z.string().trim().min(10, { message: "Comments must be at least 10 characters" }).max(1000),
});

export const ContactUs = () => {
  const { toast } = useToast();
  
  // Form state management
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; phoneNumber?: string; comments?: string }>({});

  /**
   * Handles form submission
   * 1. Validates input
   * 2. Saves to database
   * 3. Sends email notification via edge function
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate form data using zod schema
    const validationResult = contactSchema.safeParse({ email, phoneNumber, comments });
    
    if (!validationResult.success) {
      const fieldErrors: { email?: string; phoneNumber?: string; comments?: string } = {};
      validationResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Save to database
      const { error: dbError } = await supabase
        .from("contact_submissions")
        .insert({
          email: validationResult.data.email,
          phone_number: validationResult.data.phoneNumber || null,
          comments: validationResult.data.comments,
        });

      if (dbError) {
        console.error("Database error:", dbError);
        throw new Error("Failed to save your message. Please try again.");
      }

      // Step 2: Send email notification via edge function
      const { error: emailError } = await supabase.functions.invoke("send-contact-email", {
        body: {
          email: validationResult.data.email,
          phoneNumber: validationResult.data.phoneNumber,
          comments: validationResult.data.comments,
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        // Don't fail completely - data is saved, just email failed
      }

      // Success - reset form
      setEmail("");
      setPhoneNumber("");
      setComments("");
      
      toast({
        title: "Message Sent!",
        description: "Thank you for contacting us. We'll get back to you soon.",
      });
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <SEO
        title="Contact BingeGuide — Support, Feedback & Inquiries"
        description="Get in touch with the BingeGuide team. Email helpofbingeguide@gmail.com or use our contact form for support, feedback, and partnership inquiries."
        path="/contact"
      />
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">Contact Us</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Have questions, feedback, or suggestions? We'd love to hear from you. 
            Reach out to us and we'll respond as soon as possible.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Information Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Get in Touch
              </CardTitle>
              <CardDescription>
                You can reach us directly via email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Contact */}
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <Mail className="h-6 w-6 text-primary mt-1" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">Email</h2>
                  <a 
                    href="mailto:helpofbingeguide@gmail.com"
                    className="text-primary hover:underline"
                  >
                    helpofbingeguide@gmail.com
                  </a>
                  <p className="text-sm text-muted-foreground mt-1">
                    We typically respond within 24-48 hours
                  </p>
                </div>
              </div>

              {/* Additional Info */}
              <div className="p-4 bg-primary/10 rounded-lg">
                <h2 className="text-base font-semibold text-foreground mb-2">Why Contact Us?</h2>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Report bugs or technical issues</li>
                  <li>• Suggest new features or improvements</li>
                  <li>• Partnership or collaboration inquiries</li>
                  <li>• General questions about BingeGuide</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Contact Form Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Send Us a Message
              </CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? "border-destructive" : ""}
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                {/* Phone Number Field */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="text-foreground">
                    Phone Number <span className="text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={errors.phoneNumber ? "border-destructive" : ""}
                    disabled={isSubmitting}
                  />
                  {errors.phoneNumber && (
                    <p className="text-sm text-destructive">{errors.phoneNumber}</p>
                  )}
                </div>

                {/* Comments Field */}
                <div className="space-y-2">
                  <Label htmlFor="comments" className="text-foreground">
                    Comments <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="comments"
                    placeholder="Tell us how we can help you..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className={`min-h-[120px] ${errors.comments ? "border-destructive" : ""}`}
                    disabled={isSubmitting}
                  />
                  {errors.comments && (
                    <p className="text-sm text-destructive">{errors.comments}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
