/**
 * Returns a deterministic, high-quality Unsplash image URL for a given tour.
 * Keywords from the title and destination are matched against a curated map.
 * Used both as a fallback when imageUrl is not set, and when auto-generating
 * an image during tour creation.
 */

const KEYWORD_MAP: Array<{ keywords: string[]; photoId: string }> = [
  { keywords: ["goa", "beach", "coastal", "shore", "sea"],          photoId: "photo-1512343879784-a960bf40e7f2" },
  { keywords: ["bali", "indonesia", "ubud", "rice"],                photoId: "photo-1537996194471-e657df975ab4" },
  { keywords: ["kyoto", "japan", "tokyo", "osaka", "japanese"],     photoId: "photo-1493976040374-85c8e12f0c0e" },
  { keywords: ["paris", "france", "eiffel", "french"],              photoId: "photo-1502602898657-3e91760cbb34" },
  { keywords: ["maldives", "island", "atoll", "overwater"],         photoId: "photo-1573843981267-be1999ff37cd" },
  { keywords: ["alps", "switzerland", "swiss", "austria", "snow"],  photoId: "photo-1464822759023-fed622ff2c3b" },
  { keywords: ["manali", "himachal", "himalaya", "mountain", "trek", "himalayan"], photoId: "photo-1506905925346-21bda4d32df4" },
  { keywords: ["safari", "kenya", "africa", "serengeti", "savanna"], photoId: "photo-1551632436-cbf8dd35adfa" },
  { keywords: ["rome", "italy", "italian", "colosseum", "venice", "florence"], photoId: "photo-1552832230-c0197dd311b5" },
  { keywords: ["new york", "usa", "america", "manhattan", "nyc"],   photoId: "photo-1485871981521-5b1fd3805eee" },
  { keywords: ["dubai", "uae", "emirates", "desert", "abu dhabi"],  photoId: "photo-1512453979798-5ea266f8880c" },
  { keywords: ["london", "uk", "england", "britain", "british"],    photoId: "photo-1513635269975-59663e0ac1ad" },
  { keywords: ["sydney", "australia", "opera", "harbour"],          photoId: "photo-1506973035872-a4ec16b8e8d9" },
  { keywords: ["thailand", "bangkok", "phuket", "thai"],            photoId: "photo-1528360983277-13d401cdc186" },
  { keywords: ["istanbul", "turkey", "turkish", "bosphorus"],       photoId: "photo-1554232456-8727aae0cfa4" },
  { keywords: ["santorini", "greece", "greek", "athens", "mykonos"], photoId: "photo-1533105079780-92b9be482077" },
  { keywords: ["peru", "machu picchu", "andes", "lima"],            photoId: "photo-1526392060635-9d6019884377" },
  { keywords: ["china", "beijing", "great wall", "shanghai"],       photoId: "photo-1508804185872-d7badad00f7d" },
  { keywords: ["egypt", "cairo", "pyramid", "nile"],                photoId: "photo-1539768942893-daf53e448371" },
  { keywords: ["rio", "brazil", "brazilian", "amazon"],             photoId: "photo-1483729558449-99ef09a8c325" },
  { keywords: ["iceland", "nordic", "northern lights", "aurora"],   photoId: "photo-1531366936337-7c912a4589a7" },
  { keywords: ["rajasthan", "jaipur", "jodhpur", "india"],          photoId: "photo-1477587458883-47145ed31281" },
  { keywords: ["kerala", "backwater", "munnar"],                    photoId: "photo-1602216056096-3b40cc0c9944" },
  { keywords: ["singapore", "asia", "southeast"],                   photoId: "photo-1525625293412-2dfcbe8793e1" },
  { keywords: ["new zealand", "zealand", "queenstown", "hobbit"],   photoId: "photo-1469854523086-cc02fe5d8800" },
];

const DEFAULT_PHOTO_ID = "photo-1501854140801-50d01698950b"; // aerial view of nature

export function tourImageUrl(
  title: string | null | undefined,
  destinationName: string | null | undefined,
  size = "1200x800"
): string {
  const haystack = `${(title ?? "").toLowerCase()} ${(destinationName ?? "").toLowerCase()}`;

  for (const entry of KEYWORD_MAP) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      const [w, h] = size.split("x");
      return `https://images.unsplash.com/${entry.photoId}?w=${w}&h=${h}&fit=crop&auto=format`;
    }
  }

  const [w, h] = size.split("x");
  return `https://images.unsplash.com/${DEFAULT_PHOTO_ID}?w=${w}&h=${h}&fit=crop&auto=format`;
}
