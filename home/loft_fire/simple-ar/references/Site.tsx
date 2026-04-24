import { useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/site/Header";
import { HeroSectionWithFilters } from "@/components/site/HeroSectionWithFilters";
import { HeroSection} from "@/components/site/HeroSection";
import { WhyUsSection } from "@/components/site/WhyUsSection";
import { HowItWorksSection } from "@/components/site/HowItWorksSection";
import { DepositProtectionSection } from "@/components/site/DepositProtectionSection";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { FAQSection } from "@/components/site/FAQSection";
import { TelegramPromoSection } from "@/components/site/TelegramPromoSection";
import { ContactsSection } from "@/components/site/ContactsSection";
import { FinalCTASection } from "@/components/site/FinalCTASection";
import { Footer } from "@/components/site/Footer";
import { CarsClientsList } from "@/components/site/CarsClientsList";
import FilterResults, { DesktopFilterForm } from "@/components/site/FilterResults";
//import { ScrollToFleetButton } from "@/components/site/ScrollToFleetButton";

const Site = () => {
  // Shared state для FilterResults и DesktopFilterForm
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [filters, setFilters] = useState<any>({
    startDate: null,
    endDate: null,
    pickupLocation: '',
    returnLocation: '',
    days: 0
  });
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [isBookingSubmitted, setIsBookingSubmitted] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [deepLinkCarId, setDeepLinkCarId] = useState<string | null>(null);

  const handleFiltersChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
    if (selectedCategory && newFilters.startDate && newFilters.pickupLocation) {
      setShowResults(true);
    }
  }, [selectedCategory]);

  const handleCategoryChange = useCallback((category: string) => {
    setSelectedCategory(category);
    if (filters.startDate && filters.pickupLocation) {
      setShowResults(true);
    }
  }, [filters]);

  return (
    <>
      <Helmet>
        <title>Аренда авто на Пхукете от 600฿/день | Sunny Rentals</title>
        <meta 
          name="description" 
          content="Аренда автомобилей и байков на Пхукете без предоплаты. Проверенные машины, прозрачные цены, депозит под защитой. Поддержка 24/7. Бронирование в 2 клика." 
        />
        <meta 
          name="keywords" 
          content="аренда авто пхукет, прокат машин пхукет, car rental phuket, sunny rentals, аренда без депозита" 
        />
        
        {/* Open Graph */}
        <meta property="og:title" content="Sunny Rentals - Аренда авто на Пхукете" />
        <meta property="og:description" content="От 600฿/день. Без предоплаты. Поддержка 24/7." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://sunny-rentals.online/og-image.jpg" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {`{
            "@context": "https://schema.org",
            "@type": "AutoRental",
            "name": "Sunny Rentals",
            "description": "Car rental service in Phuket",
            "priceRange": "฿600-฿2000",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Phuket",
              "addressCountry": "TH"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "100"
            },
            "telephone": "+66842039140",
            "url": "https://sunny-rentals.online"
          }`}
        </script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <HeroSection
            desktopForm={
              <DesktopFilterForm
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                filters={filters}
                onFiltersChange={handleFiltersChange}
              />
            }
          />
          {/*<HeroSectionWithFilters />*/}
          <CarsClientsList />
          <ReviewsSection />
          <WhyUsSection />
          {/*<HowItWorksSection />*/}
          {/*<DepositProtectionSection />*/}
          <FAQSection />
          <FilterResults
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            showResults={showResults}
            setShowResults={setShowResults}
            filters={filters}
            setFilters={setFilters}
            selectedCar={selectedCar}
            setSelectedCar={setSelectedCar}
            isBookingModalOpen={isBookingModalOpen}
            setIsBookingModalOpen={setIsBookingModalOpen}
            isSubmittingBooking={isSubmittingBooking}
            setIsSubmittingBooking={setIsSubmittingBooking}
            isBookingSubmitted={isBookingSubmitted}
            setIsBookingSubmitted={setIsBookingSubmitted}
            bookingId={bookingId}
            setBookingId={setBookingId}
            deepLinkCarId={deepLinkCarId}
            setDeepLinkCarId={setDeepLinkCarId}
          />
          {/*<TelegramPromoSection />*/}
          {/*<ContactsSection />*/}
          <FinalCTASection />
        </main>
        <Footer />
       {/*<ScrollToFleetButton />*/}
      </div>
    </>
  );
};

export default Site;