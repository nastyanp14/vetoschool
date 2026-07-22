import Footer from '@/components/Footer';
import BookingWizard from '@/components/trial-booking/BookingWizard';
import type { Lang } from '@/lib/i18n';

export default function TrialBooking({ lang }: { lang: Lang }) {
  return (
    <div className="min-h-screen overflow-x-hidden page-bg-home">
      <BookingWizard lang={lang} />
      <Footer lang={lang} />
    </div>
  );
}
