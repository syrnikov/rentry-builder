// Curated Google Fonts list for the font picker. Any Google font name is still accepted.
export const GOOGLE_FONTS: { name: string; cat: 'sans' | 'serif' | 'display' | 'hand' | 'mono' }[] = [
  ...['Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Nunito', 'Quicksand', 'Rubik', 'Work Sans',
    'DM Sans', 'Manrope', 'Karla', 'Outfit', 'Lexend', 'Figtree', 'Mulish', 'Raleway', 'Josefin Sans', 'Comfortaa',
    'Varela Round', 'M PLUS Rounded 1c', 'Atkinson Hyperlegible', 'Space Grotesk', 'Archivo', 'Barlow', 'Cabin',
    'Fredoka', 'Lilita One', 'Exo 2', 'Kanit', 'Chakra Petch', 'Orbitron', 'Oxanium', 'Sora'].map((name) => ({ name, cat: 'sans' as const })),
  ...['Merriweather', 'Playfair Display', 'Lora', 'EB Garamond', 'Cormorant Garamond', 'Libre Baskerville', 'Crimson Text',
    'Noto Serif', 'PT Serif', 'Source Serif 4', 'DM Serif Display', 'Spectral', 'Cardo', 'Old Standard TT', 'Bodoni Moda',
    'Cinzel', 'IM Fell English', 'Gelasio', 'Fraunces', 'Young Serif'].map((name) => ({ name, cat: 'serif' as const })),
  ...['Pacifico', 'Lobster', 'Righteous', 'Bungee', 'Press Start 2P', 'VT323', 'Silkscreen', 'Monoton', 'Abril Fatface',
    'Bebas Neue', 'Anton', 'Alfa Slab One', 'Rubik Mono One', 'Shrikhand', 'Unica One', 'Major Mono Display', 'Creepster',
    'UnifrakturMaguntia', 'Pirata One', 'Jacquard 12', 'Micro 5', 'Pixelify Sans', 'Bagel Fat One', 'Rampart One'].map((name) => ({ name, cat: 'display' as const })),
  ...['Caveat', 'Dancing Script', 'Indie Flower', 'Patrick Hand', 'Shadows Into Light', 'Amatic SC', 'Gloria Hallelujah',
    'Kalam', 'Permanent Marker', 'Sacramento', 'Great Vibes', 'Satisfy', 'Homemade Apple', 'Reenie Beanie', 'Coming Soon',
    'Itim', 'Gaegu', 'Delius', 'Short Stack', 'Sniglet', 'Schoolbell', 'Edu AU VIC WA NT Hand'].map((name) => ({ name, cat: 'hand' as const })),
  ...['JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono', 'Space Mono', 'Roboto Mono', 'Courier Prime',
    'Inconsolata', 'Share Tech Mono', 'Ubuntu Mono'].map((name) => ({ name, cat: 'mono' as const })),
];

export const toMetaFontName = (display: string) => display.trim().replace(/\s+/g, '_');
export const toDisplayFontName = (meta: string) => meta.replace(/_/g, ' ');

const loaded = new Set<string>();
/** Inject a Google Fonts stylesheet for a font so the preview can render it. */
export function loadGoogleFont(metaName: string) {
  const name = toDisplayFontName(metaName).trim();
  if (!name || loaded.has(name) || typeof document === 'undefined') return;
  loaded.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}&display=swap`;
  document.head.appendChild(link);
}
