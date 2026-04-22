import PublicMetadata from '@/components/public-metadata';
import PublicSiteLayout, { PublicHeroHeader } from '@/components/public-site-layout';

export default function TermsOfService() {
  return (
    <PublicSiteLayout activePath="/terms">
      <PublicMetadata
        title="IRLobby Terms of Service"
        description="Review the terms, responsibilities, and legal conditions for using IRLobby."
        canonicalPath="/terms"
      />
      <PublicHeroHeader
        eyebrow="Legal"
        title={<>Terms of Service</>}
        description="Last updated: September 8, 2025"
      />

      <section className="px-6 pb-24">
        <div className="prose prose-invert prose-headings:font-display prose-headings:text-white prose-p:text-white/75 prose-li:text-white/75 mx-auto max-w-4xl rounded-[32px] border border-white/8 bg-white/95 p-8 text-slate-900 shadow-[0_25px_100px_rgba(0,0,0,0.22)] sm:p-10 prose-h2:text-slate-900 prose-h3:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 leading-relaxed">
                By accessing and using IRLobby (&ldquo;the Service&rdquo;), you accept and agree to
                be bound by the terms and provision of this agreement. If you do not agree to abide
                by the above, please do not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">
                2. Description of Service
              </h2>
              <p className="text-gray-700 leading-relaxed">
                IRLobby is a platform that connects people for real-life activities and meetups. Our
                service allows users to discover, create, and participate in various activities in
                their local area.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">3. User Accounts</h2>

              <h3 className="text-xl font-medium mb-2">3.1 Account Creation</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                To use certain features of our service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your password</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>

              <h3 className="text-xl font-medium mb-2">3.2 Account Termination</h3>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to terminate or suspend your account at our discretion, with or
                without cause, and with or without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">4. User Conduct</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                You agree not to use the service to:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on the rights of others</li>
                <li>Transmit harmful, offensive, or inappropriate content</li>
                <li>Impersonate another person or entity</li>
                <li>Interfere with the proper functioning of the service</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Use the service for commercial purposes without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">
                5. Content and Activities
              </h2>

              <h3 className="text-xl font-medium mb-2">5.1 User-Generated Content</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                You retain ownership of content you create and post on our platform. By posting
                content, you grant us a non-exclusive, royalty-free license to use, display, and
                distribute your content in connection with our service.
              </p>

              <h3 className="text-xl font-medium mb-2">5.2 Activity Organization</h3>
              <p className="text-gray-700 leading-relaxed">
                When organizing activities, you agree to:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Provide accurate information about the activity</li>
                <li>Ensure the activity complies with local laws and regulations</li>
                <li>Respect the safety and well-being of all participants</li>
                <li>Handle any issues or disputes that arise professionally</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">6. Privacy</h2>
              <p className="text-gray-700 leading-relaxed">
                Your privacy is important to us. Please review our Privacy Policy, which also
                governs your use of the service, to understand our practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">7. Disclaimers</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                The service is provided &ldquo;as is&rdquo; without warranties of any kind. We
                disclaim all warranties, express or implied, including but not limited to:
              </p>
              <ul className="list-disc pl-6 text-gray-700">
                <li>Merchantability and fitness for a particular purpose</li>
                <li>Accuracy, reliability, or completeness of information</li>
                <li>Security or freedom from harmful components</li>
                <li>Non-infringement of third-party rights</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">
                8. Limitation of Liability
              </h2>
              <p className="text-gray-700 leading-relaxed">
                In no event shall IRLobby be liable for any indirect, incidental, special,
                consequential, or punitive damages arising out of or related to your use of the
                service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">9. Indemnification</h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to indemnify and hold harmless IRLobby and its affiliates from any claims,
                damages, losses, or expenses arising from your use of the service or violation of
                these terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">
                10. Modifications to Terms
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of
                material changes, and continued use of the service constitutes acceptance of the
                modified terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">11. Governing Law</h2>
              <p className="text-gray-700 leading-relaxed">
                These terms shall be governed by and construed in accordance with applicable laws,
                without regard to conflict of law provisions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-primary mb-4">12. Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mt-4">
                <p className="text-gray-700">
                  <strong>Email:</strong> legal@irlobby.com
                  <br />
                  <strong>Address:</strong> IRLobby Legal Team
                </p>
              </div>
            </section>
        </div>
      </section>
    </PublicSiteLayout>
  );
}
