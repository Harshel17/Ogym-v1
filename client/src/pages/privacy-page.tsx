import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPage() {
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
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
            <p className="text-muted-foreground">Last updated: February 2026</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Information We Collect</h2>
              <p className="text-muted-foreground">We collect information you provide directly:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Account Information:</strong> Name, email address, phone number, username, and password.</li>
                <li><strong>Profile Information:</strong> Profile picture, fitness goals, and body measurements (if you choose to provide them).</li>
                <li><strong>Workout Data:</strong> Exercise records, workout completions, attendance history, and training progress.</li>
                <li><strong>Payment Information:</strong> Subscription details and payment history (actual payment processing is handled by secure third-party providers).</li>
                <li><strong>Communications:</strong> Messages, announcements, and support requests.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">We use the collected information to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Provide and improve the OGym service.</li>
                <li>Enable gym owners and trainers to manage their members.</li>
                <li>Track your workout progress and attendance.</li>
                <li>Send important notifications about your account and gym activities.</li>
                <li>Process subscription payments.</li>
                <li>Respond to your support requests.</li>
                <li>Ensure the security and integrity of the service.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Information Sharing</h2>
              <p className="text-muted-foreground">Your information may be shared with:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li><strong>Your Gym:</strong> Gym owners and trainers can see member attendance, workout data, and contact information as needed to provide gym services.</li>
                <li><strong>Other Gym Members:</strong> Your profile name and workout achievements may be visible in social feed features (you can control what you share).</li>
                <li><strong>Service Providers:</strong> We use third-party services for hosting, email delivery, and payment processing. These providers only access data necessary to perform their services.</li>
                <li><strong>Legal Requirements:</strong> We may disclose information if required by law or to protect rights and safety.</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Third-Party AI Data Sharing</h2>
              <p className="text-muted-foreground">
                OGym uses artificial intelligence (AI) to power several features including the Dika personal fitness assistant, 
                nutrition estimation, photo-based food analysis, and sport training program generation. These AI features are 
                powered by <strong>OpenAI</strong> (openai.com), a third-party AI service provider.
              </p>

              <h3 className="text-base font-medium mt-4">4.1 What Data Is Sent</h3>
              <p className="text-muted-foreground">When you use AI-powered features, the following data may be sent to OpenAI:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Messages and queries you send to the AI assistant</li>
                <li>Workout and exercise data relevant to your request</li>
                <li>Nutrition and meal log information</li>
                <li>Body measurements and fitness goals</li>
                <li>Health and activity data (if you have connected a health device)</li>
                <li>Sports profiles and match history</li>
                <li>Photos of food (for photo-based food analysis only)</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                Your name, email address, account password, and other personal identifiers are <strong>never</strong> sent to OpenAI.
              </p>

              <h3 className="text-base font-medium mt-4">4.2 Who Receives the Data</h3>
              <p className="text-muted-foreground">
                The data is sent exclusively to <strong>OpenAI, L.L.C.</strong> (openai.com) via their secure API. 
                No other third parties receive your fitness or health data for AI processing.
              </p>

              <h3 className="text-base font-medium mt-4">4.3 How the Data Is Used</h3>
              <p className="text-muted-foreground">
                OpenAI processes the data solely to generate personalized responses for you, such as fitness advice, 
                nutrition analysis, and training recommendations. When accessed through our API:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>OpenAI does <strong>not</strong> use your data to train or improve their AI models.</li>
                <li>OpenAI may retain API inputs and outputs for up to 30 days solely for abuse and misuse monitoring, after which it is automatically deleted.</li>
                <li>OpenAI's data handling is governed by their <a href="https://openai.com/policies/api-data-usage-policies" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">API Data Usage Policy</a>.</li>
              </ul>

              <h3 className="text-base font-medium mt-4">4.4 Data Protection</h3>
              <p className="text-muted-foreground">
                We take the following measures to protect your data when using AI features:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>All data is transmitted over encrypted connections (HTTPS/TLS).</li>
                <li>Personal identifiers (name, email, credentials) are stripped before sending data to OpenAI.</li>
                <li>OpenAI provides the same or greater level of data protection as OGym, as outlined in their <a href="https://openai.com/policies/api-data-usage-policies" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">API Data Usage Policy</a> and enterprise Data Processing Agreement (DPA), which include strict confidentiality, security controls, and data deletion obligations.</li>
                <li>We minimize the amount of data sent — only information relevant to your current request is included.</li>
              </ul>

              <h3 className="text-base font-medium mt-4">4.5 Your Consent and Control</h3>
              <p className="text-muted-foreground">
                AI data sharing requires your explicit consent. You are asked for this consent during registration 
                and can also enable or disable it at any time:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li><strong>Opt-in:</strong> AI features are only enabled after you explicitly agree to data sharing.</li>
                <li><strong>Revoke anytime:</strong> You can withdraw consent from your Profile settings at any time. This immediately disables AI features.</li>
                <li><strong>No impact on core features:</strong> Declining or revoking AI consent does not affect your ability to use other OGym features like workout tracking, attendance, payments, or gym management.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Data Security</h2>
              <p className="text-muted-foreground">
                We implement appropriate security measures to protect your data, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Encrypted data transmission (HTTPS).</li>
                <li>Secure password hashing.</li>
                <li>Access controls and authentication.</li>
                <li>Regular security reviews.</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                However, no system is 100% secure. Please protect your account credentials and report any security concerns immediately.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your data for as long as your account is active or as needed to provide services. 
                When you delete your account or your gym subscription ends, we will delete or anonymize your 
                personal data within 90 days, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Your Rights</h2>
              <p className="text-muted-foreground">You have the right to:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Access your personal data.</li>
                <li>Correct inaccurate information.</li>
                <li>Request deletion of your account and data.</li>
                <li>Export your workout and progress data.</li>
                <li>Opt out of non-essential communications.</li>
              </ul>
              <p className="text-muted-foreground mt-2">
                To exercise these rights, contact your gym administrator or our support team.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Children's Privacy</h2>
              <p className="text-muted-foreground">
                OGym is not intended for use by children under 13 years of age. We do not knowingly collect 
                information from children under 13. If you believe a child has provided us with personal 
                information, please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. International Users</h2>
              <p className="text-muted-foreground">
                OGym operates globally. By using our service, you consent to the transfer and processing of 
                your data in the countries where our servers are located. We take steps to ensure your data 
                is protected regardless of where it is processed.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of significant changes 
                through the app or via email. Continued use of the Service after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Contact Us</h2>
              <p className="text-muted-foreground">
                For privacy-related questions or requests, contact us at:
              </p>
              <p className="text-muted-foreground">
                Email: support@ogym.fitness
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
