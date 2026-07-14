// Mock CMS Transport Layer — inline data for demo/development
// All data access goes through this module. data.ts calls these functions.
import type {
  Article,
  Category,
  Author,
  BreakingNews,
  NewstickerItem,
  Quiz,
  StockData,
  Video,
  Navigation,
  SiteConfig,
} from "@/types";

const mockArticles = [
  {
    id: "1",
    headline: "Berlins neue Verkehrsstrategie: Das ändert sich 2026",
    slug: "berlins-neue-verkehrsstrategie",
    teaser:
      "Die Hauptstadt plant umfassende Änderungen im öffentlichen Nahverkehr. Was Pendler und Anwohner wissen müssen.",
    body: '<p>Berlin steht vor einem <strong>grundlegenden Wandel</strong> im öffentlichen Nahverkehr. Die Senatsverwaltung hat einen umfassenden Plan vorgelegt, der bis Ende 2026 umgesetzt werden soll. Mit dem Paket reagiert die Landesregierung auf jahrelange Kritik von Pendlerverbänden und Bürgerinitiativen, die eine bessere Anbindung der Außenbezirke fordern.</p><h2>Neue Tramlinien für den Osten</h2><p>Drei neue Straßenbahnlinien sollen die östlichen Bezirke besser anbinden. „Wir schließen eine Lücke, die seit der Wiedervereinigung besteht", sagte Verkehrssenatorin Maria Hoffmann bei der Vorstellung des Plans im Roten Rathaus.</p><blockquote>Die Investitionen in Höhe von 2,3 Milliarden Euro sind die größten seit dem Mauerfall.</blockquote><p>Besonders profitieren werden die Bezirke Marzahn-Hellersdorf und Lichtenberg, wo bisher viele Bewohner auf Busverbindungen angewiesen waren. Die neue Linie M17 soll den Bahnhof Lichtenberg direkt mit dem Alexanderplatz verbinden und dabei sechs neue Haltestellen bedienen.</p><h2>Ausbau der Radinfrastruktur</h2><p>Parallel zum Tramausbau plant der Senat 85 Kilometer neue geschützte Radwege entlang der großen Ausfallstraßen. „Wir denken Mobilität nicht mehr in Silos", betonte Hoffmann. Die Radwege sollen baulich von der Fahrbahn getrennt werden — ein Novum für Berlin, das bisher vor allem auf aufgemalte Streifen setzte.</p><h3>Zeitplan und Umsetzung</h3><p>Die ersten Bauarbeiten beginnen im September 2026. Die vollständige Inbetriebnahme der drei Tramlinien ist für 2029 geplant. Kritiker wie der ADAC Berlin bezweifeln allerdings, dass der ambitionierte Zeitplan eingehalten werden kann. „Beim BER hat man ähnlich optimistisch geplant", sagte Sprecher Jens Kloppenburg.</p><h3>Finanzierung gesichert</h3><p>Die Finanzierung steht auf drei Säulen: 1,2 Milliarden Euro kommen aus Bundesmitteln des Gemeindeverkehrsfinanzierungsgesetzes, 800 Millionen aus dem Landeshaushalt und 300 Millionen aus EU-Strukturfonds. Der Berliner Fahrgastverband IGEB begrüßte den Plan, mahnte aber zur Transparenz bei der Kostenkontrolle.</p>',
    publicationDate: "2026-06-28T08:00:00Z",
    updatedAt: "2026-06-28T10:30:00Z",
    image: {
      alt: "Straßenbahn fährt durch Berlin-Mitte",
      fallbackSrc:
        "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
      caption: "Eine Straßenbahn der Linie M10 in Berlin-Mitte",
      credit: "Berliner Rundschau / Max Mustermann",
    },
    category: { id: "cat-1", name: "Politik", slug: "politik" },
    author: {
      id: "author-1",
      name: "Anna Schmidt",
      slug: "anna-schmidt",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["Verkehr", "BVG", "Infrastruktur", "Berlin"],
    readingTimeMinutes: 5,
    commentCount: 23,
    isPremium: false,
    paywall: "free" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: true,
    isBreaking: false,
    source: "Berliner Rundschau",
    aiSummary:
      "Berlin plant drei neue Tramlinien im Osten der Stadt. Die 2,3 Milliarden Euro teure Investition soll Marzahn-Hellersdorf und Lichtenberg besser anbinden. Baustart ist September 2026.",
    region: "berlin",
    comments: [
      {
        id: 1,
        author: "BerlinFan42",
        text: "Endlich! Wurde auch Zeit, dass der Osten besser angebunden wird.",
        date: "2026-06-28T09:15:00Z",
        likes: 15,
      },
      {
        id: 2,
        author: "PendlerPaul",
        text: "Hoffentlich wird der Zeitplan eingehalten. In Berlin dauert ja bekanntlich alles etwas länger.",
        date: "2026-06-28T09:45:00Z",
        likes: 8,
      },
    ],
  },
  {
    id: "2",
    headline:
      "Start-up Boom in Berlin-Mitte: Über 200 Gründungen im ersten Quartal",
    slug: "startup-boom-berlin-mitte",
    teaser:
      "Die Berliner Gründerszene erlebt einen neuen Höhenflug. Besonders KI-Start-ups treiben das Wachstum.",
    body: '<p>Die Berliner Start-up-Szene boomt wie nie zuvor. Im ersten Quartal 2026 wurden allein in Berlin-Mitte <strong>über 200 neue Unternehmen</strong> gegründet — ein Plus von 34 Prozent gegenüber dem Vorjahreszeitraum. Damit überholt Berlin erstmals London als europäische Gründermetropole, gemessen an der Zahl der Neugründungen pro Kopf.</p><h2>KI als Wachstumstreiber</h2><p>Besonders auffällig ist der Anstieg im Bereich Künstliche Intelligenz. Fast jede dritte Neugründung beschäftigt sich mit KI-Anwendungen — von automatisierter Textanalyse über medizinische Bildgebung bis hin zu autonomer Logistik.</p><p>„Berlin hat sich als europäische KI-Hauptstadt etabliert", sagt Prof. Dr. Laura Chen von der TU Berlin. Das liege an der Kombination aus exzellenter Forschung, verfügbaren Fachkräften und vergleichsweise günstigen Büroflächen.</p><h2>Venture Capital fließt in Rekordhöhe</h2><p>Auch die Investoren haben Berlin im Blick. Im ersten Halbjahr 2026 flossen laut Daten des Bundesverbands Deutsche Startups <strong>3,8 Milliarden Euro</strong> Risikokapital in Berliner Jungunternehmen. Zum Vergleich: Im gesamten Jahr 2024 waren es 4,2 Milliarden. „Wir sehen eine klare Trendwende nach der Durststrecke 2023", sagt Analystin Dr. Sarah Kellner von EY.</p><h3>Hotspots in der Stadt</h3><p>Die beliebtesten Standorte für Neugründungen sind weiterhin Kreuzberg und Friedrichshain, gefolgt von Prenzlauer Berg. Zunehmend gefragt ist aber auch der Bereich rund um den Hauptbahnhof, wo mehrere neue Co-Working-Spaces eröffnet haben. Das „Factory Berlin" am Görlitzer Park hat seine Fläche verdoppelt und beherbergt nun über 120 Start-ups unter einem Dach.</p><h3>Herausforderungen bleiben</h3><p>Trotz des Booms kämpfen viele Gründer mit der Bürokratie. Die durchschnittliche Dauer einer Gewerbeanmeldung beträgt in Berlin noch immer sechs Wochen — in Estland dauert der gleiche Vorgang 18 Minuten online. „Die Politik muss die Rahmenbedingungen endlich an die Dynamik der Szene anpassen", fordert Christian Miele, Präsident des Startup-Verbands.</p>',
    publicationDate: "2026-06-27T14:00:00Z",
    image: {
      alt: "Modernes Büro eines Berliner Start-ups",
      fallbackSrc:
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
    },
    category: { id: "cat-2", name: "Wirtschaft", slug: "wirtschaft" },
    author: {
      id: "author-2",
      name: "Markus Weber",
      slug: "markus-weber",
      avatar:
        "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["Start-ups", "KI", "Wirtschaft", "Gründerszene"],
    readingTimeMinutes: 4,
    commentCount: 12,
    isPremium: true,
    paywall: "paid" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: false,
    isBreaking: false,
    source: "Berliner Rundschau",
    aiSummary:
      "Über 200 Start-ups wurden im Q1 2026 in Berlin-Mitte gegründet (+34%). KI-Anwendungen treiben das Wachstum.",
    region: "berlin",
    comments: [],
  },
  {
    id: "3",
    headline:
      "Kulturhauptstadt Berlin: Die besten Ausstellungen im Sommer 2026",
    slug: "kulturhauptstadt-berlin-sommer",
    teaser:
      "Von der Berlinischen Galerie bis zum Humboldt Forum — diese Ausstellungen sollten Sie nicht verpassen.",
    body: '<p>Berlins Museumslandschaft bietet im Sommer 2026 ein <strong>außergewöhnlich vielfältiges Programm</strong>. Von klassischer Malerei über digitale Installationen bis hin zu interaktiven Erlebnisräumen — wir stellen die Highlights vor, die Sie nicht verpassen sollten.</p><h2>Berlinische Galerie: „Zukunft Metropole"</h2><p>Die große Sommerausstellung widmet sich der urbanen Transformation Berlins. Über 150 Werke zeitgenössischer Künstler zeigen Visionen für die Stadt von morgen. Kuratiert von Dr. Helena Brandt, vereint die Schau Arbeiten aus Malerei, Skulptur, Fotografie und digitaler Kunst. Besonders beeindruckend: Eine raumfüllende Installation von Olafur Eliasson, die Berlins Skyline im Jahr 2050 simuliert.</p><p>Öffnungszeiten: Mittwoch bis Montag, 10 bis 18 Uhr. Donnerstags bis 21 Uhr. Eintritt: 14 Euro, ermäßigt 8 Euro.</p><h2>Humboldt Forum: „Seidenstraße Digital"</h2><p>Eine interaktive Ausstellung verbindet historische Handelsrouten mit modernen Datenströmen. Virtual-Reality-Stationen ermöglichen eine Zeitreise entlang der alten Seidenstraße — von Xi\'an über Samarkand bis Konstantinopel. Besucher können an zwölf Stationen in historische Szenen eintauchen und dabei die kulturellen Verflechtungen zwischen Ost und West erleben.</p><h2>Hamburger Bahnhof: „After the Wall — 35 Jahre Mauerfall"</h2><p>Zum 35. Jahrestag des Mauerfalls zeigt der Hamburger Bahnhof eine umfassende Retrospektive der deutschen Gegenwartskunst nach 1989. Werke von Gerhard Richter, Neo Rauch und Katharina Grosse dokumentieren, wie die Wiedervereinigung die Kunstwelt verändert hat. Die Ausstellung umfasst drei Etagen und wurde von internationalen Kritikern bereits als „Pflichtbesuch" gelobt.</p><h2>Geheimtipp: KW Institute for Contemporary Art</h2><p>Abseits der großen Häuser lohnt sich ein Besuch im KW Institute in der Auguststraße. Die aktuelle Gruppenausstellung „Glitch Berlin" zeigt Arbeiten von 22 Nachwuchskünstlern, die sich mit Fehlern, Brüchen und Störungen in der digitalen Welt auseinandersetzen. Der Eintritt ist donnerstags frei.</p>',
    publicationDate: "2026-06-26T10:00:00Z",
    image: {
      alt: "Berlinische Galerie Ausstellungsraum",
      fallbackSrc:
        "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1758380742154-44738eb92832?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
      caption: "Blick in die Berlinische Galerie",
    },
    category: { id: "cat-4", name: "Kultur", slug: "kultur" },
    author: {
      id: "author-3",
      name: "Lisa Müller",
      slug: "lisa-mueller",
      avatar:
        "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["Kultur", "Ausstellungen", "Museum", "Sommer"],
    readingTimeMinutes: 6,
    commentCount: 7,
    isPremium: false,
    paywall: "free" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: false,
    isBreaking: false,
    aiSummary:
      'Die wichtigsten Sommerausstellungen in Berlin: Berlinische Galerie zeigt "Zukunft Metropole", Humboldt Forum präsentiert "Seidenstraße Digital".',
    region: "berlin",
    comments: [
      {
        id: 3,
        author: "KunstLiebhaber",
        text: "Die Berlinische Galerie ist immer einen Besuch wert!",
        date: "2026-06-26T12:00:00Z",
        likes: 5,
      },
    ],
  },
  {
    id: "4",
    headline:
      "Hertha BSC setzt auf Nachwuchs: Drei Talente schaffen den Sprung",
    slug: "hertha-bsc-nachwuchs-talente",
    teaser:
      "Die Jugendakademie von Hertha BSC zeigt Wirkung. Drei U19-Spieler erhalten Profiverträge.",
    body: '<p>Hertha BSC setzt weiter konsequent auf den eigenen Nachwuchs. Drei Spieler der U19-Mannschaft haben <strong>Profiverträge</strong> erhalten und werden zur neuen Saison fester Bestandteil des Kaders. Damit unterstreicht der Verein seine Strategie, verstärkt auf die eigene Jugendakademie zu setzen — ein Kurswechsel, der vor drei Jahren eingeleitet wurde.</p><h2>Die drei Neuzugänge</h2><ul><li><strong>Emre Yilmaz</strong> (18) — zentrales Mittelfeld, 14 Tore in der A-Junioren-Bundesliga</li><li><strong>Jonas Hartmann</strong> (19) — Innenverteidiger, U19-Nationalspieler</li><li><strong>Karim Benali</strong> (18) — Linksaußen, schnellster Spieler der Jugendabteilung</li></ul><p>Trainer Michael Krüger zeigte sich begeistert: „Diese drei Jungs haben in der Vorbereitung gezeigt, dass sie bereit sind für den nächsten Schritt. Sie bringen nicht nur Talent mit, sondern auch die richtige Mentalität."</p><h2>Akademie als Erfolgsmodell</h2><p>Die Herthanische Jugendakademie gehört mittlerweile zu den produktivsten im deutschen Profifußball. In den letzten vier Jahren schafften insgesamt elf Spieler den Sprung in den Profikader — eine Quote, die nur vom SC Freiburg übertroffen wird. Der Verein investiert jährlich rund 8 Millionen Euro in die Nachwuchsarbeit, doppelt so viel wie noch 2022.</p><p>„Wir haben die Infrastruktur komplett erneuert", erklärt Nachwuchsleiter Andreas Neuendorf. „Neue Trainingsplätze, ein modernes Internat und ein Sportpsychologie-Programm — das zahlt sich jetzt aus."</p><h3>Fans fordern mehr Einsatzzeiten</h3><p>In den sozialen Medien reagierten die Hertha-Fans überwiegend positiv. Viele fordern allerdings, dass die jungen Spieler auch tatsächlich Einsatzzeit bekommen und nicht nur auf der Bank sitzen. „Es reicht nicht, ihnen einen Vertrag zu geben. Sie müssen spielen", schrieb ein Fan auf X. Trainer Krüger versprach: „Jeder bekommt seine Chance — aber verdient, nicht geschenkt."</p>',
    publicationDate: "2026-06-25T16:00:00Z",
    image: {
      alt: "Olympiastadion Berlin — Heimstätte von Hertha BSC",
      fallbackSrc:
        "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1749651340944-4ac71fad61f6?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
      credit: "Berliner Rundschau / Sportredaktion",
    },
    category: { id: "cat-5", name: "Sport", slug: "sport" },
    author: {
      id: "author-4",
      name: "Thomas Becker",
      slug: "thomas-becker",
      avatar:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces",
    },
    tags: ["Hertha BSC", "Bundesliga", "Nachwuchs", "Fußball"],
    readingTimeMinutes: 3,
    commentCount: 31,
    isPremium: false,
    paywall: "free" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: false,
    isBreaking: false,
    source: "Berliner Rundschau",
    aiSummary:
      "Hertha BSC gibt drei U19-Spielern (Yilmaz, Hartmann, Benali) Profiverträge. Die Jugendakademie zeigt damit erneut ihre Stärke.",
    region: "berlin",
    comments: [],
  },
  {
    id: "5",
    headline:
      "Wohnungsmarkt Berlin: Mietpreise steigen weiter — was Mieter wissen müssen",
    slug: "wohnungsmarkt-berlin-mietpreise",
    teaser:
      "Die durchschnittliche Kaltmiete in Berlin hat erstmals die 15-Euro-Marke überschritten. Ein Überblick über die Lage.",
    body: "<p>Der Berliner Wohnungsmarkt bleibt angespannt. Die <strong>durchschnittliche Kaltmiete</strong> für Neuvermietungen hat im Juni 2026 erstmals die Marke von 15 Euro pro Quadratmeter überschritten. Im Vergleich zum Vorjahr ist das ein Anstieg von 8,3 Prozent — deutlich über der allgemeinen Inflationsrate von 2,1 Prozent.</p><h2>Bezirke im Vergleich</h2><p>Besonders teuer bleibt Berlin-Mitte mit durchschnittlich 19,50 Euro/m², gefolgt von Charlottenburg-Wilmersdorf (17,80 Euro/m²) und Friedrichshain-Kreuzberg (16,90 Euro/m²). Günstigere Alternativen bieten Spandau (12,80 Euro/m²) und Marzahn-Hellersdorf (11,90 Euro/m²), wobei auch dort die Preise steigen.</p><p>Eine Analyse der Investitionsbank Berlin zeigt: Selbst in den günstigeren Bezirken liegen die Mieten für Neubauwohnungen inzwischen bei über 14 Euro pro Quadratmeter. Der Bestandsmarkt ist kaum noch zugänglich — die Fluktuation liegt bei historisch niedrigen 4,2 Prozent.</p><h2>Neubau stockt weiter</h2><p>Ein wesentlicher Grund für die steigenden Mieten: Es wird zu wenig gebaut. Statt der geplanten 20.000 neuen Wohnungen pro Jahr wurden 2025 nur 11.400 fertiggestellt. Gestiegene Baukosten, Zinsen und langwierige Genehmigungsverfahren bremsen die Branche. „Ohne eine massive Vereinfachung der Bauvorschriften wird sich die Lage nicht entspannen“, warnt Felix Pakleppa, Hauptgeschäftsführer des Zentralverbands Deutsches Baugewerbe.</p><h3>Was Mieter tun können</h3><p>Der Berliner Mieterverein empfiehlt, die Mietpreisbremse zu prüfen. In vielen Fällen liegen die verlangten Mieten über dem zulässigen Niveau. Seit Einführung der verschärften Mietpreisbremse 2025 konnten Berliner Mieter im Durchschnitt 127 Euro monatlich zurückfordern. „Viele Mieter wissen gar nicht, dass sie Ansprüche haben“, sagt Vereinssprecherin Ulrike Hamann. Der Mieterverein bietet kostenlose Erstberatungen an und hat eine Online-Plattform eingerichtet, über die Mieter ihre Miethöhe überprüfen lassen können.</p>",
    publicationDate: "2026-06-24T09:00:00Z",
    image: {
      alt: "Wohnhäuser in Berlin-Kreuzberg",
      fallbackSrc:
        "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1755896487242-23cb0847e493?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
    },
    category: { id: "cat-3", name: "Berlin", slug: "berlin" },
    author: {
      id: "author-2",
      name: "Markus Weber",
      slug: "markus-weber",
      avatar:
        "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["Wohnen", "Mieten", "Immobilien", "Berlin"],
    readingTimeMinutes: 7,
    commentCount: 45,
    isPremium: true,
    paywall: "paid" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: false,
    isBreaking: false,
    source: "Berliner Rundschau",
    aiSummary:
      "Berliner Kaltmieten überschreiten erstmals 15 Euro/m². Berlin-Mitte führt mit 19,50 Euro, Spandau bleibt günstiger. Mieterverein empfiehlt Prüfung der Mietpreisbremse.",
    region: "berlin",
    comments: [],
  },
  {
    id: "6",
    headline: "Kommentar: Warum die Digitalisierung der Verwaltung scheitert",
    slug: "kommentar-digitalisierung-verwaltung",
    teaser:
      "Seit Jahren wird die digitale Verwaltung versprochen. Passiert ist wenig. Eine Analyse der Ursachen.",
    body: "<p>Es ist eine Geschichte des Scheiterns, die sich in Berlin besonders deutlich zeigt. Während Estland längst eine volldigitale Verwaltung betreibt und Bürger ihren Wohnsitz in drei Minuten online ummelden können, kämpfen Berliner Bürgerämter noch mit <strong>Faxgeräten und Papierformularen</strong>. Die durchschnittliche Wartezeit für einen Termin beim Bürgeramt beträgt aktuell 38 Tage — ein Negativrekord unter den deutschen Großstädten.</p><h2>Die drei Hauptprobleme</h2><p>Erstens fehlt der politische Wille. In jeder Legislaturperiode wird die Digitalisierung zur Priorität erklärt, doch die Budgets werden regelmäßig gekürzt. Zweitens scheitern Großprojekte an mangelhafter Projektsteuerung — das gescheiterte IT-Projekt „Berliner Serviceportal“ verschlang 47 Millionen Euro, bevor es 2024 eingestellt wurde. Drittens blockieren föderale Zuständigkeiten einheitliche Lösungen: Was in Hamburg funktioniert, muss in Berlin von Grund auf neu entwickelt werden.</p><h2>Das Onlinezugangsgesetz — eine Chronik des Versagens</h2><p>Das <em>Onlinezugangsgesetz</em> von 2017 sollte bis Ende 2022 alle Verwaltungsleistungen digitalisieren. Neun Jahre später sind weniger als 30 Prozent umgesetzt. Von den 575 identifizierten Leistungen können Berliner Bürger gerade einmal 163 online beantragen — und selbst davon funktionieren viele nur teilweise, weil am Ende doch ein Papierformular per Post geschickt werden muss.</p><h3>Europäische Vorbilder</h3><p>Dabei gibt es längst funktionierende Modelle. In Dänemark werden 92 Prozent aller Behördengänge digital erledigt. In Österreich hat die „ID Austria“ das analoge Amtswesen weitgehend abgelöst. Selbst das wirtschaftlich schwächere Portugal bietet mehr digitale Verwaltungsleistungen als Deutschland.</p><p>Der Berliner Landesrechnungshof kritisierte in seinem jüngsten Bericht: „Die Verwaltungsdigitalisierung in Berlin ist nicht an technischen Hürden gescheitert, sondern an organisatorischem Versagen und fehlendem Reformwillen.“ Ein vernichtendes Urteil, das die politisch Verantwortlichen nicht länger ignorieren dürfen.</p>",
    publicationDate: "2026-06-23T07:00:00Z",
    image: {
      alt: "Warteschlange vor einem Berliner Bürgeramt",
      fallbackSrc:
        "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1459767129954-1b1c1f9b9ace?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
    },
    category: { id: "cat-6", name: "Meinung", slug: "meinung" },
    author: {
      id: "author-1",
      name: "Anna Schmidt",
      slug: "anna-schmidt",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["Digitalisierung", "Verwaltung", "Kommentar", "Politik"],
    readingTimeMinutes: 5,
    commentCount: 67,
    isPremium: false,
    paywall: "free" as const,
    isLive: false,
    isOpinion: true,
    isFeatured: false,
    isBreaking: false,
    aiSummary:
      "Die Digitalisierung der Berliner Verwaltung scheitert an fehlendem Willen, schlechter Projektsteuerung und föderalen Blockaden. Weniger als 30% der OZG-Leistungen sind umgesetzt.",
    region: "berlin",
    comments: [],
  },
  {
    id: "7",
    headline: "BVG modernisiert U-Bahn-Netz: Diese Linien werden ausgebaut",
    slug: "bvg-ubahn-netz-ausbau",
    teaser:
      "Die BVG investiert Milliarden in die Modernisierung des U-Bahn-Netzes. Drei Linien stehen im Fokus.",
    body: "<p>Die Berliner Verkehrsbetriebe (BVG) haben ihren <strong>Modernisierungsplan</strong> für das U-Bahn-Netz vorgestellt. Insgesamt 4,1 Milliarden Euro sollen in den nächsten zehn Jahren investiert werden. Es ist das größte Infrastrukturprojekt der BVG seit dem Bau der U55 zum Hauptbahnhof.</p><h2>U5-Verlängerung nach Westen</h2><p>Die U5 soll vom Hauptbahnhof über die Turmstraße bis nach Jungfernheide verlängert werden. Die neue Strecke umfasst vier Stationen und schließt eine historische Lücke im Netz. Mit der Verlängerung wird die U5 zur längsten Berliner U-Bahn-Linie und verbindet den Osten der Stadt direkt mit dem Westen — ohne Umsteigen am Alexanderplatz.</p><p>Besonders profitieren wird der Stadtteil Moabit, der bisher nur über die U9 und Buslinien angebunden ist. „Die Turmstraße ist eine der am dichtesten besiedelten Gegenden Berlins ohne U-Bahn-Anschluss. Das ändern wir jetzt“, sagte BVG-Vorstandschefin Eva Kreienkamp.</p><h2>U7-Erweiterung zum BER</h2><p>Langfristig soll die U7 bis zum Flughafen BER verlängert werden. Die Machbarkeitsstudie läuft bereits und soll bis Ende 2027 abgeschlossen sein. Die geplante Strecke würde über Schönefeld führen und sieben neue Stationen umfassen. Experten schätzen die Bauzeit auf mindestens acht Jahre.</p><h2>Modernisierung bestehender Stationen</h2><p>Neben dem Neubau stehen 47 bestehende Stationen vor einer umfassenden Sanierung. Barrierefreie Aufzüge, moderne Beleuchtung, verbesserte Lüftungssysteme und digitale Fahrgastinformation stehen auf dem Programm. Bis 2030 sollen alle Stationen barrierefrei zugänglich sein — aktuell sind es nur 68 Prozent.</p><h3>Neue Züge ab 2028</h3><p>Die BVG hat außerdem 376 neue Wagen bei Stadler Rail bestellt. Die Züge der Baureihe JK sollen leiser, energieeffizienter und vollständig klimatisiert sein. Die ersten Fahrzeuge werden Ende 2028 auf der U5 eingesetzt. „Die neuen Züge verbrauchen 30 Prozent weniger Energie als die aktuellen Modelle“, so Kreienkamp.</p>",
    publicationDate: "2026-06-22T11:00:00Z",
    image: {
      alt: "Eingang zur U-Bahn-Station Alexanderplatz in Berlin",
      fallbackSrc:
        "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1746912904647-1b925eb88845?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
      caption: "U-Bahn-Station Alexanderplatz",
    },
    category: { id: "cat-3", name: "Berlin", slug: "berlin" },
    author: {
      id: "author-1",
      name: "Anna Schmidt",
      slug: "anna-schmidt",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["BVG", "U-Bahn", "Infrastruktur", "Mobilität"],
    readingTimeMinutes: 4,
    commentCount: 19,
    isPremium: false,
    paywall: "free" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: false,
    isBreaking: false,
    source: "Berliner Rundschau",
    aiSummary:
      "BVG investiert 4,1 Milliarden Euro in U-Bahn-Modernisierung. U5 wird nach Westen verlängert, U7-Verlängerung zum BER wird geprüft.",
    region: "berlin",
    comments: [],
  },
  {
    id: "8",
    headline:
      "Klimaschutz in der Hauptstadt: Berlins Weg zur klimaneutralen Stadt",
    slug: "klimaschutz-berlin-klimaneutral",
    teaser:
      "Berlin will bis 2045 klimaneutral werden. Neue Maßnahmen sollen den CO2-Ausstoß drastisch senken.",
    body: "<p>Der Berliner Senat hat ein <strong>umfassendes Klimaschutzpaket</strong> beschlossen. Bis 2045 soll die Hauptstadt klimaneutral werden — fünf Jahre früher als der Bundesdurchschnitt. Das Paket ist die Antwort auf den erfolgreichen Volksentscheid „Berlin 2030 klimaneutral“, der zwar knapp scheiterte, aber den politischen Druck massiv erhöhte.</p><h2>Die wichtigsten Maßnahmen</h2><ul><li>Ausbau der Solarenergie auf allen öffentlichen Gebäuden bis 2028</li><li>Verdopplung des Radwegenetzes von 1.600 auf 3.200 Kilometer bis 2030</li><li>Umstellung der BVG-Busflotte auf Elektroantrieb bis 2030 (aktuell: 42 Prozent)</li><li>Förderung energetischer Gebäudesanierung mit bis zu 40 Prozent Zuschuss</li><li>Ausbau der Fernwärme aus erneuerbaren Quellen</li><li>100 neue Schnellladestationen für E-Fahrzeuge pro Jahr</li></ul><h2>Gebäudesektor im Fokus</h2><p>Fast 40 Prozent der Berliner CO2-Emissionen stammen aus dem Gebäudesektor. Deshalb setzt der Senat hier den größten Hebel an. Bis 2035 sollen alle landeseigenen Gebäude energetisch saniert sein. Für private Eigentümer gibt es ein neues Förderprogramm: Wer seine Immobilie auf mindestens Energieeffizienzklasse B saniert, erhält einen Zuschuss von bis zu 80.000 Euro pro Wohneinheit.</p><p>„Das ist die ambitionierteste Sanierungsoffensive, die eine deutsche Stadt je aufgelegt hat“, sagte Umweltsenatorin Bettina Jarasch. „Aber ohne sie werden wir die Klimaziele nicht erreichen.“</p><h2>Kritik von Wirtschaft und Opposition</h2><p>Die IHK Berlin warnt vor Überforderung der Wirtschaft. Besonders die geplante City-Maut für Verbrenner ab 2030 stößt auf Widerstand. Die CDU-Fraktion bezeichnete das Paket als „ideologisch überladen“ und forderte stattdessen technologieoffene Lösungen.</p><h3>Finanzierung</h3><p>Das Paket umfasst Investitionen von 8,5 Milliarden Euro über die nächsten 20 Jahre. Ein Großteil soll durch EU-Fördermittel und den Berliner Klimafonds finanziert werden. Zusätzlich plant der Senat eine Klimaabgabe auf versiegelte Flächen, die jährlich rund 200 Millionen Euro einbringen soll.</p>",
    publicationDate: "2026-06-21T08:00:00Z",
    image: {
      alt: "Solaranlage auf einem Berliner Dach",
      fallbackSrc:
        "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
      crops: [
        {
          name: "default",
          srcset: [
            {
              src: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=400&h=225&q=80",
              imageWidth: "400w",
            },
            {
              src: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=800&h=450&q=80",
              imageWidth: "800w",
            },
            {
              src: "https://images.unsplash.com/photo-1549493131-9157a68aec24?auto=format&fit=crop&w=1200&h=675&q=80",
              imageWidth: "1200w",
            },
          ],
        },
      ],
      sizes: ["(max-width: 768px) 100vw", "800px"],
    },
    category: { id: "cat-1", name: "Politik", slug: "politik" },
    author: {
      id: "author-1",
      name: "Anna Schmidt",
      slug: "anna-schmidt",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    },
    tags: ["Klimaschutz", "Nachhaltigkeit", "Energie", "Politik"],
    readingTimeMinutes: 6,
    commentCount: 34,
    isPremium: false,
    paywall: "free" as const,
    isLive: false,
    isOpinion: false,
    isFeatured: false,
    isBreaking: true,
    source: "Berliner Rundschau",
    aiSummary:
      "Berlin will bis 2045 klimaneutral werden. Das Maßnahmenpaket umfasst Solar-Ausbau, Radwege-Verdopplung und E-Bus-Umstellung bei 8,5 Milliarden Euro Investition.",
    region: "berlin",
    comments: [],
  },
] satisfies ReadonlyArray<Article>;

const mockCategories = [
  {
    id: "cat-1",
    name: "Politik",
    slug: "politik",
    path: "/kategorie/politik",
    description:
      "Aktuelle politische Nachrichten aus Berlin, Deutschland und der Welt.",
    color: "var(--color-primary)",
    children: [
      {
        id: "cat-1-1",
        name: "Bundespolitik",
        slug: "bundespolitik",
        path: "/kategorie/bundespolitik",
        description: "Nachrichten aus dem Bundestag und der Bundesregierung.",
      },
      {
        id: "cat-1-2",
        name: "Landespolitik",
        slug: "landespolitik",
        path: "/kategorie/landespolitik",
        description: "Berliner Senat und Abgeordnetenhaus.",
      },
    ],
    articleCount: 2,
  },
  {
    id: "cat-2",
    name: "Wirtschaft",
    slug: "wirtschaft",
    path: "/kategorie/wirtschaft",
    description:
      "Wirtschaftsnachrichten, Börse, Unternehmen und Start-ups aus Berlin.",
    color: "var(--color-success)",
    children: [],
    articleCount: 1,
  },
  {
    id: "cat-3",
    name: "Berlin",
    slug: "berlin",
    path: "/kategorie/berlin",
    description:
      "Lokalnachrichten aus allen Berliner Bezirken — Verkehr, Wohnen, Stadtentwicklung.",
    color: "var(--color-accent)",
    children: [
      {
        id: "cat-3-1",
        name: "Bezirke",
        slug: "bezirke",
        path: "/kategorie/bezirke",
        description: "Nachrichten aus den Berliner Bezirken.",
      },
    ],
    articleCount: 2,
  },
  {
    id: "cat-4",
    name: "Kultur",
    slug: "kultur",
    path: "/kategorie/kultur",
    description: "Kunst, Musik, Theater, Film und Ausstellungen in Berlin.",
    color: "var(--color-secondary)",
    children: [],
    articleCount: 1,
  },
  {
    id: "cat-5",
    name: "Sport",
    slug: "sport",
    path: "/kategorie/sport",
    description:
      "Sportnachrichten aus Berlin — Hertha BSC, Union Berlin, Alba und mehr.",
    color: "var(--color-info)",
    children: [],
    articleCount: 1,
  },
  {
    id: "cat-6",
    name: "Meinung",
    slug: "meinung",
    path: "/kategorie/meinung",
    description: "Kommentare, Analysen und Gastbeiträge zu aktuellen Themen.",
    color: "var(--color-warning)",
    children: [],
    articleCount: 1,
  },
] satisfies ReadonlyArray<Category>;

const mockAuthors = [
  {
    id: "author-1",
    name: "Anna Schmidt",
    slug: "anna-schmidt",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    bio: "Chefredakteurin der Berliner Rundschau. Schwerpunkte: Landespolitik, Infrastruktur und Stadtentwicklung. Seit 15 Jahren Journalistin in Berlin.",
    role: "Chefredakteurin",
    socialLinks: {
      twitter: "https://twitter.com/annaschmidt",
      linkedin: "https://linkedin.com/in/annaschmidt",
    },
  },
  {
    id: "author-2",
    name: "Markus Weber",
    slug: "markus-weber",
    avatar:
      "https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    bio: "Wirtschaftsredakteur mit Fokus auf Start-ups, Immobilien und Berliner Wirtschaftspolitik.",
    role: "Wirtschaftsredakteur",
    socialLinks: {
      linkedin: "https://linkedin.com/in/markusweber",
    },
  },
  {
    id: "author-3",
    name: "Lisa Müller",
    slug: "lisa-mueller",
    avatar:
      "https://images.unsplash.com/photo-1573496527892-904f897eb744?auto=format&fit=crop&w=200&h=200&q=80&crop=face",
    bio: "Kulturredakteurin der Berliner Rundschau. Berichtet über Ausstellungen, Theater und die Berliner Kunstszene.",
    role: "Kulturredakteurin",
    socialLinks: {
      twitter: "https://twitter.com/lisamueller",
      website: "https://lisamueller.de",
    },
  },
  {
    id: "author-4",
    name: "Thomas Becker",
    slug: "thomas-becker",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80&crop=faces",
    bio: "Sportredakteur mit Leidenschaft für Berliner Fußball. Begleitet Hertha BSC und Union Berlin seit über zehn Jahren.",
    role: "Sportredakteur",
  },
] satisfies ReadonlyArray<Author>;

const mockNewsticker = [
  {
    id: "nt-1",
    type: "TimelineTeaser",
    topic: "Politik",
    headline: {
      label: "Bundestag beschließt neues Digitalgesetz",
      href: "/artikel/bundestag-digitalgesetz",
    },
    publicationDate: "2026-06-28T12:30:00Z",
    isPremium: false,
  },
  {
    id: "nt-2",
    type: "TimelineTeaser",
    topic: "Berlin",
    headline: {
      label: "S-Bahn-Störung auf der Ringbahn behoben",
      href: "/artikel/sbahn-ringbahn-stoerung",
    },
    publicationDate: "2026-06-28T11:45:00Z",
    isPremium: false,
  },
  {
    id: "nt-3",
    type: "TimelineTeaser",
    topic: "Wirtschaft",
    headline: {
      label: "DAX schließt mit Rekordhoch bei 24.987 Punkten",
      href: "/artikel/dax-rekordhoch",
    },
    publicationDate: "2026-06-28T10:00:00Z",
    isPremium: true,
  },
  {
    id: "nt-4",
    type: "TimelineTeaser",
    topic: "Sport",
    headline: {
      label: "Union Berlin verpflichtet schwedischen Stürmer",
      href: "/artikel/union-berlin-transfer",
    },
    publicationDate: "2026-06-28T09:15:00Z",
    isPremium: false,
  },
  {
    id: "nt-5",
    type: "TimelineTeaser",
    topic: "Kultur",
    headline: {
      label: "Berlinale kündigt Jury-Präsidentin für 2027 an",
      href: "/artikel/berlinale-jury",
    },
    publicationDate: "2026-06-28T08:30:00Z",
    isPremium: false,
  },
  {
    id: "nt-6",
    type: "TimelineTeaser",
    topic: "Berlin",
    headline: {
      label: "Neue Fahrradstraße in Friedrichshain eröffnet",
      href: "/artikel/fahrradstrasse-friedrichshain",
    },
    publicationDate: "2026-06-27T18:00:00Z",
    isPremium: false,
  },
] satisfies ReadonlyArray<NewstickerItem>;

const mockVideos = [
  {
    id: "vid-1",
    title: "Berlins neue Tramlinien: So sieht der Plan aus",
    sources: [{ src: "/videos/tram-plan.mp4", extension: "mp4" as const }],
    poster:
      "https://images.unsplash.com/photo-1747197028387-b60586b389e6?auto=format&fit=crop&w=1280&h=720&q=80",
    durationSeconds: 384,
    caption:
      "Verkehrssenatorin Maria Hoffmann stellt den neuen Nahverkehrsplan vor.",
    category: "/politik/",
    publishedAt: "2026-06-28T09:00:00Z",
  },
  {
    id: "vid-2",
    title: "Start-up-Szene Berlin: Ein Tag im Co-Working-Space",
    sources: [
      { src: "/videos/startup-coworking.mp4", extension: "mp4" as const },
    ],
    poster:
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1280&h=720&q=80",
    durationSeconds: 542,
    caption:
      "Einblick in den Alltag junger Gründerinnen und Gründer in Berlin-Mitte.",
    category: "/wirtschaft/",
    publishedAt: "2026-06-27T14:00:00Z",
  },
  {
    id: "vid-3",
    title: "Sommer in Berlin: Die schönsten Badestellen",
    sources: [{ src: "/videos/badestellen.mp4", extension: "mp4" as const }],
    poster:
      "https://images.unsplash.com/photo-1758912299313-36430bb41c44?auto=format&fit=crop&w=1280&h=720&q=80",
    durationSeconds: 267,
    caption: "Die besten Seen und Freibäder für den Berliner Sommer.",
    category: "/berlin/",
    publishedAt: "2026-06-26T10:00:00Z",
  },
] satisfies ReadonlyArray<Video>;

const mockNavigation: Navigation = {
  primaryMenu: [
    {
      reference: { type: "SECTION", href: "/", label: "Start", isActive: true },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/kategorie/politik",
        label: "Politik",
      },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/kategorie/wirtschaft",
        label: "Wirtschaft",
      },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/kategorie/berlin",
        label: "Berlin",
      },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/kategorie/kultur",
        label: "Kultur",
      },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/kategorie/sport",
        label: "Sport",
      },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/kategorie/meinung",
        label: "Meinung",
      },
      commercial: false,
    },
  ],
  footerMenu: [
    {
      reference: { type: "SECTION", href: "/impressum", label: "Impressum" },
      commercial: false,
    },
    {
      reference: {
        type: "SECTION",
        href: "/datenschutz",
        label: "Datenschutz",
      },
      commercial: false,
    },
    {
      reference: { type: "SECTION", href: "/kontakt", label: "Kontakt" },
      commercial: false,
    },
    {
      reference: { type: "SECTION", href: "/mediadaten", label: "Mediadaten" },
      commercial: true,
    },
  ],
  socialLinks: [
    {
      platform: "twitter",
      url: "https://twitter.com/berliner_rundschau",
      label: "Berliner Rundschau auf X",
    },
    {
      platform: "facebook",
      url: "https://facebook.com/berlinerrundschau",
      label: "Berliner Rundschau auf Facebook",
    },
    {
      platform: "instagram",
      url: "https://instagram.com/berlinerrundschau",
      label: "Berliner Rundschau auf Instagram",
    },
  ],
};

const mockSiteConfig: SiteConfig = {
  title: "Berliner Rundschau",
  description:
    "Nachrichten aus Berlin und der Welt — Politik, Wirtschaft, Kultur, Sport und Meinung.",
  url: "https://berliner-rundschau.de",
  language: "de-DE",
  tags: ["Berlin", "Nachrichten", "Politik", "Wirtschaft", "Kultur"],
  socialLinks: [
    { platform: "twitter", url: "https://twitter.com/berliner_rundschau" },
    {
      platform: "facebook",
      url: "https://facebook.com/berlinerrundschau",
    },
  ],
  analytics: { gtmId: "GTM-XXXXXX" },
};

const mockBreakingNews = [
  {
    id: "bn-1",
    headline: "Eilmeldung: Berliner Senat beschließt Klimaschutzpaket",
    href: "/artikel/klimaschutz-berlin-klimaneutral",
    severity: "breaking" as const,
    publishedAt: "2026-06-28T14:00:00Z",
    expiresAt: "2026-06-28T20:00:00Z",
  },
  {
    id: "bn-2",
    headline: "BVG: Signalstörung auf der U2 — Verspätungen erwartet",
    href: "/artikel/bvg-ubahn-netz-ausbau",
    severity: "alert" as const,
    publishedAt: "2026-06-28T12:00:00Z",
  },
] satisfies ReadonlyArray<BreakingNews>;

const mockQuiz: Quiz = {
  dailyQuiz: {
    date: "2026-06-28",
    title: "Wie gut kennen Sie Berlin?",
    questions: [
      {
        id: 1,
        question: "Wie viele Bezirke hat Berlin?",
        options: ["10", "12", "14", "16"],
        correctIndex: 1,
        explanation:
          "Berlin hat 12 Bezirke, die seit der Bezirksreform 2001 bestehen.",
      },
      {
        id: 2,
        question: "Wann fiel die Berliner Mauer?",
        options: [
          "3. Oktober 1989",
          "9. November 1989",
          "1. Januar 1990",
          "3. Oktober 1990",
        ],
        correctIndex: 1,
        explanation:
          "Die Berliner Mauer fiel am 9. November 1989 nach der legendären Pressekonferenz von Günter Schabowski.",
      },
      {
        id: 3,
        question: "Wie heißt Berlins größter See?",
        options: ["Wannsee", "Müggelsee", "Tegeler See", "Schlachtensee"],
        correctIndex: 1,
        explanation:
          "Der Müggelsee in Treptow-Köpenick ist mit 7,4 km² der größte See Berlins.",
      },
    ],
  },
  streakRewards: [
    { days: 3, badge: "Berlin-Kenner", emoji: "🏅" },
    { days: 7, badge: "Hauptstadt-Experte", emoji: "🎓" },
    { days: 14, badge: "Berlin-Meister", emoji: "🏆" },
  ],
};

const mockStockData: StockData = {
  indices: [
    {
      id: "dax",
      name: "DAX",
      value: 24987.45,
      change: 148.72,
      changePercent: 0.6,
      currency: "EUR",
      sparkline: [24750, 24810, 24870, 24920, 24987],
    },
    {
      id: "mdax",
      name: "MDAX",
      value: 30742.85,
      change: -62.3,
      changePercent: -0.2,
      currency: "EUR",
      sparkline: [30850, 30820, 30790, 30760, 30743],
    },
    {
      id: "dow",
      name: "Dow Jones",
      value: 52387.42,
      change: 189.34,
      changePercent: 0.36,
      currency: "USD",
      sparkline: [52150, 52220, 52280, 52340, 52387],
    },
    {
      id: "eurusd",
      name: "EUR/USD",
      value: 1.1392,
      change: 0.0018,
      changePercent: 0.16,
      currency: "",
      sparkline: [1.136, 1.137, 1.138, 1.139, 1.139],
    },
  ],
  watchlist: [
    {
      id: "sap",
      symbol: "SAP.DE",
      name: "SAP SE",
      price: 142.85,
      change: 2.15,
      changePercent: 1.53,
      marketCap: "165.8B",
      pe: 32.4,
      sector: "Technologie",
    },
    {
      id: "sie",
      symbol: "SIE.DE",
      name: "Siemens AG",
      price: 268.45,
      change: 3.8,
      changePercent: 1.44,
      marketCap: "214.5B",
      pe: 20.8,
      sector: "Industrie",
    },
    {
      id: "bayn",
      symbol: "BAYN.DE",
      name: "Bayer AG",
      price: 48.92,
      change: -0.73,
      changePercent: -1.47,
      marketCap: "48.2B",
      pe: null,
      sector: "Pharma",
    },
  ],
  chartData: {},
};

// Transport functions — called by data.ts, never directly from components
export function fetchAllArticles(): Article[] {
  return [...mockArticles];
}

export function fetchArticleBySlug(slug: string): Article | null {
  return mockArticles.find((a) => a.slug === slug) ?? null;
}

export function fetchArticlesByCategory(categorySlug: string): Article[] {
  return mockArticles.filter((a) => a.category.slug === categorySlug);
}

export function fetchAllCategories(): Category[] {
  return [...mockCategories];
}

export function fetchCategoryBySlug(slug: string): Category | null {
  return mockCategories.find((c) => c.slug === slug) ?? null;
}

export function fetchAllAuthors(): Author[] {
  return [...mockAuthors];
}

export function fetchAuthorBySlug(slug: string): Author | null {
  return mockAuthors.find((a) => a.slug === slug) ?? null;
}

export function fetchArticlesByAuthor(authorSlug: string): Article[] {
  return mockArticles.filter((a) => a.author.slug === authorSlug);
}

export function fetchNewsticker(): NewstickerItem[] {
  return [...mockNewsticker];
}

export function fetchVideos(): Video[] {
  return [...mockVideos];
}

export function fetchNavigation(): Navigation {
  return mockNavigation;
}

export function fetchSiteConfig(): SiteConfig {
  return mockSiteConfig;
}

export function searchArticlesByQuery(query: string): Article[] {
  const q = query.toLowerCase();
  return mockArticles.filter(
    (a) =>
      a.headline.toLowerCase().includes(q) ||
      a.teaser.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export function fetchBreakingNews(): BreakingNews[] {
  return [...mockBreakingNews];
}

export function fetchQuiz(): Quiz {
  return mockQuiz;
}

export function fetchStockData(): StockData {
  return mockStockData;
}

export function fetchArticleSlugs(): Array<{
  slug: string;
  modified: string;
}> {
  return mockArticles.map((a) => ({
    slug: a.slug,
    modified: a.updatedAt ?? a.publicationDate,
  }));
}
