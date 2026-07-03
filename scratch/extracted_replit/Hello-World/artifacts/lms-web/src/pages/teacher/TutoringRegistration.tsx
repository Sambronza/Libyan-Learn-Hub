import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function TutoringRegistration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const api = useApi();
  const queryClient = useQueryClient();

  const userAny = user as any;
  const [subjects, setSubjects] = useState(userAny?.tutoringSubjects || "");
  const [hourlyRate, setHourlyRate] = useState(userAny?.tutoringHourlyRate || "");
  const [commissionAgreed, setCommissionAgreed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commissionAgreed) {
      toast({
        title: "Agreement Required",
        description: "You must agree to the commission policy to register.",
        variant: "destructive",
      });
      return;
    }

    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate <= 0 || rate > 100) {
      toast({
        title: "Invalid Rate",
        description: "Hourly rate must be between 1 and 100 dinars.",
        variant: "destructive",
      });
      return;
    }

    if (!subjects.trim()) {
      toast({
        title: "Categories Required",
        description: "Please specify at least one category or subject you teach.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await api.post("/tutoring/register", {
        tutoringHourlyRate: rate,
        tutoringSubjects: subjects,
        commissionAgreed: true
      });
      
      toast({
        title: "Registration Successful",
        description: "You are now registered as a tutor!",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tutoring/tutors"] });
      setLocation("/teacher/dashboard");
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Only teachers can access this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <Card className="border-primary/20 shadow-lg relative overflow-hidden">
        {/* Aesthetic background accent */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary/10 blur-3xl -z-10 pointer-events-none" />
        
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold tracking-tight">Tutoring Registration</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Sign up to offer 1-to-1 live tutoring sessions to students.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={user.fullName} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Appears on your public profile</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={user.email} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Where you'll receive requests</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subjects">Categories / Subjects Taught</Label>
                <Input 
                  id="subjects" 
                  placeholder="e.g. Mathematics, Physics, English" 
                  value={subjects}
                  onChange={(e) => setSubjects(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate (LYD)</Label>
                <Input 
                  id="hourlyRate" 
                  type="number" 
                  min="1" 
                  max="100" 
                  step="0.5"
                  placeholder="Enter your rate (max 100)" 
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Maximum allowed rate is 100 dinars per hour.</p>
              </div>
            </div>

            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-4 mt-8">
              <h4 className="font-semibold text-primary flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Important Policies
              </h4>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="commission" 
                    checked={commissionAgreed} 
                    onCheckedChange={(c) => setCommissionAgreed(!!c)} 
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="commission" className="font-medium cursor-pointer text-sm leading-tight">
                      Commission Agreement
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      I understand and agree that the platform will retain a <strong>10% commission</strong> from each completed session payment.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 opacity-90">
                  <div className="mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-medium text-sm leading-tight">
                      Attendance Policy
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      If I accept a tutoring request but fail to show up for the session, I will be <strong>suspended from using the tutoring feature for 1 week</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </CardContent>
          <CardFooter className="pt-4">
            <Button 
              type="submit" 
              className="w-full text-md py-6 transition-all shadow-md hover:shadow-lg" 
              disabled={isLoading || !commissionAgreed}
            >
              {isLoading ? "Registering..." : (userAny?.isTutoringEnabled ? "Update Tutoring Profile" : "Register as Tutor")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
