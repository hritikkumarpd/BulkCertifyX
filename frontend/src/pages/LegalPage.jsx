import MarketingNav from '../components/MarketingNav.jsx';
import MarketingFooter from '../components/MarketingFooter.jsx';

const CONTENT = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Acceptance', 'By creating an account or using BulkCertifyX, you agree to these terms. If you use the service on behalf of an organization, you accept these terms for that organization.'],
      ['Use of service', 'You may use BulkCertifyX to design, generate, deliver, and verify certificates. You are responsible for the accuracy of the data you upload and for having the right to issue certificates to your recipients.'],
      ['Plans and billing', 'Paid plans are billed via Razorpay on a monthly or annual cycle. Plan limits are enforced as described on the pricing page. You can cancel at any time; access continues until the end of the billing period.'],
      ['Acceptable use', 'You may not use the service to issue fraudulent or misleading certificates, or to violate any law. We may suspend accounts that abuse the platform.'],
      ['Liability', 'The service is provided "as is". To the extent permitted by law, BulkCertifyX is not liable for indirect or consequential damages.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Data we store', 'We store your account details, organization data, certificate records, recipient information you upload, and usage metrics needed to operate the service.'],
      ['How we use it', 'Data is used solely to provide the service — generating certificates, delivering emails, powering verification, and producing analytics for your organization.'],
      ['Data sharing', 'We do not sell your data. We use processors such as Supabase (database/storage), Resend (email), and Razorpay (payments) strictly to operate the service.'],
      ['Retention and deletion', 'You can export or delete your organization data. Deleting your account removes your personal data subject to legal retention requirements. Certificates remain verifiable unless revoked or deleted.'],
      ['Your rights', 'You may request access to, correction of, or deletion of your personal data by contacting us.'],
    ],
  },
  refund: {
    title: 'Refund Policy',
    sections: [
      ['Subscriptions', 'Subscription fees are billed in advance. You can cancel anytime to stop future charges; the current period remains active until it ends.'],
      ['Refund eligibility', 'If you experience a billing error or a service issue that prevents core functionality, contact us within 7 days of the charge and we will review a refund.'],
      ['Non-refundable', 'Partial periods and used certificate quota are generally non-refundable.'],
    ],
  },
  contact: {
    title: 'Contact Us',
    sections: [
      ['Support', 'For help with your account, billing, or the platform, email support@bulkcertifyx.com. Paid plans receive prioritized support.'],
      ['Sales', 'For Enterprise and custom needs, email sales@bulkcertifyx.com.'],
    ],
  },
};

export default function LegalPage({ kind }) {
  const c = CONTENT[kind] || CONTENT.terms;
  return (
    <div className="min-h-screen bg-canvas">
      <MarketingNav />
      <article className="mx-auto max-w-3xl px-4 py-16 lg:px-8">
        <h1 className="text-3xl font-bold text-ink">{c.title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {new Date().toLocaleDateString()}</p>
        <div className="mt-8 space-y-8">
          {c.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-semibold text-ink">{heading}</h2>
              <p className="mt-2 leading-relaxed text-muted">{body}</p>
            </section>
          ))}
        </div>
      </article>
      <MarketingFooter />
    </div>
  );
}
