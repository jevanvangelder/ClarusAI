export default function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      {/* ClarusAI Logo */}
      <div className="mb-8">
        <img 
          src="/src/assets/ClarusAI logo licht groot.png" 
          alt="ClarusAI Logo" 
          className="w-72 h-auto object-contain"
        />
      </div>
      
      {/* Welkomsttekst */}
      <h1 className="text-3xl text-white font-medium text-center">
        Wat wil je vandaag leren?
      </h1>
    </div>
  );
}