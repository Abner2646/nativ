// Loads the 11 restaurant-picker fonts only for admin panel routes.
// Inter is already in root layout; Satoshi comes from Fontshare.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href={[
          'https://fonts.googleapis.com/css2?',
          'family=Poppins:wght@400;500;600;700&',
          'family=Montserrat:wght@400;500;600;700&',
          'family=Raleway:wght@400;500;600;700&',
          'family=Nunito:wght@400;500;600;700&',
          'family=Lato:wght@400;700&',
          'family=Merriweather:wght@400;700&',
          'family=Playfair+Display:wght@400;600;700&',
          'family=Lora:wght@400;600;700&',
          'family=EB+Garamond:wght@400;600;700&',
          'family=Cormorant+Garamond:wght@400;600;700&',
          'family=Libre+Baskerville:wght@400;700&',
          'display=swap',
        ].join('')}
      />
      {children}
    </>
  )
}
