# Planning Guide

Een moderne AI chatbot applicatie voor bedrijfsanalyse en strategische ondersteuning, met focus op SWOT-analyses en modulaire hulpmiddelen.

**Experience Qualities**:
1. **Professional** - De interface moet vertrouwen uitstralen met een zakelijke maar moderne uitstraling die geschikt is voor bedrijfscontexten
2. **Efficient** - Snelle toegang tot chat geschiedenis en modules zonder onnodige stappen, met duidelijke visuele hiërarchie
3. **Intelligent** - De chatbot voelt responsief en slim aan, met real-time AI-gegenereerde antwoorden en contextuele suggesties

**Complexity Level**: Light Application (multiple features with basic state)
Dit is een chatbot met meerdere features (chat geschiedenis, modules, favorieten, aantekeningen) maar zonder complexe multi-view navigatie. De focus ligt op conversatie met ondersteunende functies.

## Essential Features

**Chat Conversatie**
- Functionality: Gebruikers kunnen vragen stellen aan de AI en gedetailleerde antwoorden ontvangen over bedrijfsanalyses (zoals SWOT)
- Purpose: Kernfunctionaliteit van de applicatie - directe interactie met AI voor bedrijfsinzichten
- Trigger: Gebruiker typt vraag in input veld en drukt op verzend knop
- Progression: Gebruiker typt vraag → klikt verzenden → AI genereert antwoord → antwoord verschijnt in chat → gebruiker kan doorvragen
- Success criteria: Berichten worden persistent opgeslagen, antwoorden zijn relevant en gestructureerd, chat historie blijft beschikbaar

**Chat Geschiedenis Sidebar**
- Functionality: Toon lijst van eerdere chat sessies met zoekfunctionaliteit
- Purpose: Snelle toegang tot eerdere conversaties en analyses
- Trigger: Automatisch geladen bij app start, klikbaar voor navigatie
- Progression: App laadt → geschiedenis verschijnt in sidebar → gebruiker kan klikken op sessie → chat laadt in hoofdvenster
- Success criteria: Alle sessies zijn zichtbaar, zoeken werkt op titel, recente chats bovenaan

**Modules Paneel**
- Functionality: Toon beschikbare AI modules (Samenvattingen maken, Praktijk voorbeelden, Oefentoets, Huiswerk ondersteuning, Feedback, Custom module toevoegen)
- Purpose: Geef gebruikers snelle toegang tot gespecialiseerde AI functies
- Trigger: Zichtbaar in rechter sidebar
- Progression: Gebruiker ziet modules → klikt op module → module functionaliteit activeert
- Success criteria: Modules zijn duidelijk gelabeld, visueel onderscheidend, en responderen op klik

**Bestand Uploaden**
- Functionality: Gebruikers kunnen bestanden uploaden voor analyse
- Purpose: Context toevoegen aan AI conversaties
- Trigger: Klik op "Bestanden uploaden" knop
- Progression: Klik knop → bestand selector opent → selecteer bestand → bestand wordt geüpload → bevestiging
- Success criteria: Bestanden worden geaccepteerd, gebruiker ziet upload status

**Favorieten & Aantekeningen**
- Functionality: Gebruikers kunnen chats markeren als favoriet en aantekeningen maken
- Purpose: Belangrijke conversaties organiseren en bijhouden
- Trigger: Klik op favoriet/aantekeningen icoon in sidebar
- Progression: Klik icoon → gefilterde view opent → relevante items tonen
- Success criteria: Items kunnen worden toegevoegd/verwijderd, persisteren tussen sessies

## Edge Case Handling

- **Lege Chat Geschiedenis**: Toon welkomstbericht met suggesties voor eerste vraag
- **Geen Internet/API Fout**: Toon duidelijke foutmelding met retry optie
- **Lange AI Antwoorden**: Scroll functionaliteit met smooth scrolling naar nieuwste bericht
- **Zoeken Zonder Resultaten**: Toon "Geen resultaten gevonden" met suggestie om nieuwe chat te starten
- **Upload Falen**: Toon error toast met duidelijke uitleg

## Design Direction

De interface moet een professionele, moderne uitstraling hebben met een donker thema dat vertrouwen en focus uitstraalt. De esthetiek moet high-tech en sophisticated aanvoelen, met subtiele gradients en een gevoel van diepte. De chatbot moet intelligent en betrouwbaar overkomen, geschikt voor zakelijke en educatieve contexten.

## Color Selection

Een donker, professioneel thema met elektrische blauwe accenten en zachte contrasten.

- **Primary Color**: Helder cyaan/blauw (oklch(0.65 0.15 230)) - Vertegenwoordigt intelligentie, technologie en betrouwbaarheid; gebruikt voor primaire actieknoppen en belangrijke UI elementen
- **Secondary Colors**: 
  - Diep charcoal (oklch(0.18 0.01 240)) - Basis achtergrond voor professionele uitstraling
  - Medium grijs (oklch(0.25 0.01 240)) - Cards en panelen voor subtiele diepte
  - Licht grijs (oklch(0.45 0.01 240)) - Muted elementen en borders
- **Accent Color**: Levendig gradient blauw-naar-paars (oklch(0.60 0.20 270)) - Voor call-to-action elementen zoals de grote module toevoeg knop
- **Foreground/Background Pairings**: 
  - Background (oklch(0.18 0.01 240)): Wit tekst (oklch(0.98 0 0)) - Ratio 12.4:1 ✓
  - Card (oklch(0.25 0.01 240)): Lichtgrijs tekst (oklch(0.85 0 0)) - Ratio 9.8:1 ✓
  - Primary (oklch(0.65 0.15 230)): Zwart tekst (oklch(0.18 0.01 240)) - Ratio 6.1:1 ✓
  - Accent Gradient: Wit tekst (oklch(0.98 0 0)) - Ratio 8.2:1 ✓

## Font Selection

Een moderne, professionele sans-serif met uitstekende leesbaarheid voor lange AI-gegenereerde tekstblokken, gecombineerd met een geometric sans voor headings die technologische precisie uitstraalt.

- **Typographic Hierarchy**: 
  - H1 (Section Titles): Space Grotesk Bold / 24px / tracking-wide / uppercase
  - H2 (Chat Titles): Inter SemiBold / 16px / normal tracking
  - Body (Chat Messages): Inter Regular / 15px / line-height 1.6
  - Small (Metadata): Inter Regular / 13px / text-muted-foreground
  - Button Labels: Inter Medium / 14px / tracking-tight

## Animations

Animaties moeten subtiel en functioneel zijn, met focus op het leiden van de gebruiker door de interface zonder afleidend te zijn. Gebruik smooth transitions voor state changes en micro-interactions die feedback geven.

- Chat berichten faden in met subtiele slide-up animatie (200ms ease-out)
- Sidebar toggle met smooth width transition (300ms)
- Hover states op modules en chat items met scale transform (150ms)
- Send button met korte pulse animatie bij succesvol verzenden
- Module cards met subtiele lift effect op hover
- Skeleton loaders tijdens AI response generatie

## Component Selection

- **Components**: 
  - `Input` - Voor zoekbalk in chat geschiedenis
  - `Button` - Voor verzenden, upload, module knoppen (primary variant voor send)
  - `Card` - Voor module items in rechter paneel
  - `ScrollArea` - Voor chat geschiedenis lijst en conversatie venster
  - `Separator` - Voor visuele scheiding tussen sidebar secties
  - `Dialog` - Voor bestand upload flow (indien nodig)
  - Custom ChatMessage component voor bericht bubbles
  - Custom Sidebar component voor navigatie structuur

- **Customizations**: 
  - Chat bubbles met aangepaste styling (user vs AI verschillende kleuren)
  - Gradient button voor "module toevoegen" met custom gradient
  - Custom sidebar met collapsed/expanded states
  - Search input met custom icon en styling

- **States**: 
  - Buttons: Default (solid), Hover (brightness+lift), Active (pressed), Disabled (opacity 50%)
  - Chat items: Default, Hover (bg-muted), Active/Selected (border accent)
  - Input: Default (border-input), Focus (ring-primary), Error (ring-destructive)
  - Modules: Default, Hover (lift+glow), Active (pressed)

- **Icon Selection**: 
  - `MagnifyingGlass` - Zoekfunctie
  - `Gear` - Instellingen
  - `Heart` - Favorieten
  - `Note` - Aantekeningen  
  - `Trash` - Prullenbak
  - `PaperPlaneRight` - Verzenden
  - `Plus` - Module toevoegen
  - `CaretLeft/Right` - Sidebar toggle
  - `Upload` - Bestand uploaden
  - `DotsThree` - Menu opties

- **Spacing**: 
  - Sidebar padding: p-4
  - Chat message gap: gap-4
  - Module grid gap: gap-3
  - Section margins: mb-6
  - Consistent use of spacing scale: 2, 3, 4, 6, 8

- **Mobile**: 
  - Sidebar wordt drawer op mobiel (< 768px)
  - Modules paneel verbergt standaard, toegankelijk via tab/toggle
  - Chat input blijft fixed aan onderkant
  - Stack layout: chat geschiedenis drawer → chat view → modules drawer
  - Touch-friendly targets (min 44px)
