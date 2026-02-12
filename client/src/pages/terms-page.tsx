import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function TermsPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="h-full overflow-y-auto bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto pb-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation("/")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing or using OGym ("the Service"), you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Description of Service</h2>
              <p className="text-muted-foreground">
                OGym is a gym management platform that allows gym owners, trainers, and members to manage 
                attendance, workout programs, payments, and communication. The Service is provided on a 
                subscription basis for gym owners.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. User Accounts</h2>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>You must provide accurate and complete information when creating an account.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>You must notify us immediately of any unauthorized use of your account.</li>
                <li>One person may not maintain multiple accounts.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Gym Owner Responsibilities</h2>
              <p className="text-muted-foreground">
                Gym owners who subscribe to OGym are responsible for:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Ensuring their trainers and members use the platform appropriately.</li>
                <li>Managing their gym's data and member information in compliance with applicable laws.</li>
                <li>Paying subscription fees on time.</li>
                <li>Obtaining necessary consents from members for data collection and processing.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Acceptable Use</h2>
              <p className="text-muted-foreground">You agree not to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Use the Service for any illegal purpose.</li>
                <li>Share your account credentials with others.</li>
                <li>Attempt to gain unauthorized access to any part of the Service.</li>
                <li>Upload malicious content or interfere with the Service's operation.</li>
                <li>Scrape, copy, or extract data from the Service without permission.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Payment Terms</h2>
              <p className="text-muted-foreground">
                Subscription fees are billed monthly. Gym owners are responsible for maintaining valid 
                payment information. Failure to pay may result in suspension or termination of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Data and Privacy</h2>
              <p className="text-muted-foreground">
                Your use of the Service is also governed by our Privacy Policy. By using the Service, 
                you consent to the collection and use of information as described in the Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate your access to the Service at any time for 
                violation of these Terms. Upon termination, your right to use the Service will immediately 
                cease. You may also cancel your subscription at any time.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                The Service is provided "as is" without warranties of any kind. We shall not be liable for 
                any indirect, incidental, special, consequential, or punitive damages arising from your use 
                of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We may update these Terms from time to time. Continued use of the Service after changes 
                constitutes acceptance of the new Terms. We will notify users of significant changes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Contact</h2>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact us at support@ogym.fitness
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
