import { Sun, ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function PrivacyPolicy({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-brand-sky">
      <header className="bg-white border-b-2 border-brand-blue sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:text-blue-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-2 ml-2">
            <Sun className="w-5 h-5 text-brand-blue" strokeWidth={2.5} />
            <span className="font-bold text-sm uppercase tracking-tight text-brand-blue">
              Summer Reading Program
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-white border-2 border-brand-blue shadow-[6px_6px_0px_0px_rgba(15,0,227,1)] px-8 py-10">
          <h1 className="text-3xl font-black uppercase tracking-tight text-gray-900 mb-1">
            Privacy Policy
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">
            Last updated: June 28, 2026
          </p>

          <div className="space-y-8 text-sm text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                1. Introduction
              </h2>
              <p>
                Welcome to the Summer Reading Program ("we," "our," or "us"). We are committed to
                protecting your personal information and your right to privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use
                our web application.
              </p>
              <p className="mt-2">
                Please read this policy carefully. If you disagree with its terms, please discontinue
                use of the application.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                2. Information We Collect
              </h2>
              <p className="mb-2">We collect information you provide directly when you:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Create an account (email address, display name, username)</li>
                <li>Log reading entries (book titles, pages read, time logged, notes)</li>
                <li>Post comments or interact with other users' entries</li>
                <li>Upload a profile photo or images attached to entries</li>
              </ul>
              <p className="mt-3">
                We also automatically collect certain technical information when you use the app,
                including your IP address, browser type, operating system, referring URLs, and
                usage activity (pages visited, actions taken, timestamps).
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                3. How We Use Your Information
              </h2>
              <p className="mb-2">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Create and maintain your account</li>
                <li>Display your reading activity and statistics to you and other participants</li>
                <li>Enable social features such as comments, mentions, and notifications</li>
                <li>Send you notifications about activity relevant to you</li>
                <li>Respond to your requests and provide customer support</li>
                <li>Monitor and analyze usage to improve the application</li>
                <li>Detect and prevent fraudulent, abusive, or unauthorized activity</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                4. How We Share Your Information
              </h2>
              <p className="mb-2">
                We do not sell your personal information. We may share your information in the
                following limited circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>
                  <span className="font-semibold">With other participants:</span> Your display name,
                  username, reading entries, comments, and profile photo are visible to other
                  registered users of the program.
                </li>
                <li>
                  <span className="font-semibold">Service providers:</span> We use Supabase to host
                  our database, authentication, and file storage. These providers process data on
                  our behalf under appropriate data protection agreements.
                </li>
                <li>
                  <span className="font-semibold">Legal requirements:</span> We may disclose
                  information if required by law, court order, or governmental authority.
                </li>
                <li>
                  <span className="font-semibold">Safety:</span> We may disclose information to
                  protect the rights, property, or safety of our users or the public.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                5. Data Retention
              </h2>
              <p>
                We retain your account information and reading data for as long as your account
                remains active or as needed to provide services. You may request deletion of your
                account and associated data at any time from your profile settings. Upon deletion,
                we will remove your personal information within 30 days, except where we are
                required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                6. Cookies and Tracking
              </h2>
              <p>
                We use browser local storage and session storage to maintain your login session and
                application preferences. We do not use third-party advertising cookies or tracking
                pixels. You can clear stored data through your browser settings, but this will log
                you out of the application.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                7. Children's Privacy
              </h2>
              <p>
                This application may be used by participants of all ages as part of an organized
                reading program. For participants under the age of 13, a parent or guardian must
                create and manage the account. We do not knowingly collect personal information
                from children under 13 without verifiable parental consent. If you believe we have
                inadvertently collected such information, please contact us immediately so we can
                delete it.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                8. Security
              </h2>
              <p>
                We implement industry-standard security measures including encrypted data
                transmission (HTTPS), hashed passwords, and role-based access controls. However,
                no method of transmission over the Internet or electronic storage is 100% secure.
                We cannot guarantee absolute security and encourage you to use a strong, unique
                password for your account.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                9. Your Rights
              </h2>
              <p className="mb-2">You have the right to:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Access the personal information we hold about you</li>
                <li>Correct inaccurate or incomplete information via your profile settings</li>
                <li>Request deletion of your account and personal data</li>
                <li>Object to or restrict certain processing of your data</li>
                <li>Receive a copy of your data in a portable format</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, please use the account management features in the
                app or contact us directly.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                10. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                material changes by updating the "Last updated" date at the top of this page and,
                where appropriate, by posting a notice in the application. Your continued use of
                the app after changes are posted constitutes your acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-base font-black uppercase tracking-wide text-gray-900 mb-3 border-b-2 border-brand-yellow pb-2">
                11. Contact Us
              </h2>
              <p>
                If you have questions, concerns, or requests regarding this Privacy Policy or our
                data practices, please contact the program administrator. We will respond to your
                inquiry within a reasonable timeframe.
              </p>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
